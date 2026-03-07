import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import type {
  AppSyncResolverEvent,
  AppSyncResolverHandler,
  Callback,
  Context,
} from 'aws-lambda'
import { randomUUID } from 'crypto'

const dynamo = new DynamoDBClient({})
const sfnClient = new SFNClient({})
const TABLE_NAME = process.env.TABLE_NAME!
const ROLL_STATE_MACHINE_ARN = process.env.ROLL_STATE_MACHINE_ARN!

type RollerIdentity =
  | { type: 'gm'; rollerId: string }
  | { type: 'player'; rollerId: string }

interface RollDiceResponse {
  rollId: string
  accepted: boolean
}

async function resolveActor(
  playTableId: string,
  identity: AppSyncResolverEvent<unknown>['identity'],
  playerId?: string | null
): Promise<RollerIdentity> {
  const gmSub =
    identity && 'sub' in identity
      ? (identity as { sub: string }).sub
      : undefined
  if (gmSub) {
    return { type: 'gm', rollerId: gmSub }
  }
  if (playerId) {
    const result = await dynamo.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({
          PK: `PLAYTABLE#${playTableId}`,
          SK: `PLAYER#${playerId}`,
        }),
      })
    )
    if (!result.Item) {
      throw new Error('Player not found in play table')
    }
    return { type: 'player', rollerId: playerId }
  }
  throw new Error(
    'Unauthorized: rollDice requires Cognito (GM) or playerId in input (player)'
  )
}

async function startRollExecution(params: {
  rollId: string
  playTableId: string
  roller: RollerIdentity
  diceType: string
  advantage?: string | null
  modifier?: number | null
  dc?: number | null
  visibility?: string | null
  rollRequestId?: string | null
  rollRequestType: 'ad_hoc' | 'initiative'
}): Promise<void> {
  await sfnClient.send(
    new StartExecutionCommand({
      stateMachineArn: ROLL_STATE_MACHINE_ARN,
      name: `roll-${params.rollId}`,
      input: JSON.stringify(params),
    })
  )
}

export const rollDice: AppSyncResolverHandler<
  {
    playTableId: string
    input: {
      id?: string | null
      diceType: string
      advantage?: string | null
      modifier?: number | null
      dc?: number | null
      visibility?: string | null
      rollRequestId?: string | null
    }
  },
  RollDiceResponse
> = async (event) => {
  const { playTableId, input } = event.arguments
  const identity = event.identity

  const roller = await resolveActor(playTableId, identity, input.id)

  const playTableResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `PLAYTABLE#${playTableId}`,
        SK: 'METADATA',
      }),
    })
  )
  if (!playTableResult.Item) {
    throw new Error('Play table not found')
  }

  const rollId = randomUUID()

  await startRollExecution({
    rollId,
    playTableId,
    roller,
    diceType: input.diceType,
    advantage: input.advantage,
    modifier: input.modifier,
    dc: input.dc,
    visibility: input.visibility,
    rollRequestId: input.rollRequestId,
    rollRequestType: input.rollRequestId ? 'initiative' : 'ad_hoc',
  })

  return { rollId, accepted: true }
}

export const fulfillRollRequest: AppSyncResolverHandler<
  {
    rollRequestId: string
    playTableId: string
    playerId: string
  },
  RollDiceResponse
> = async (event) => {
  const { rollRequestId, playTableId, playerId } = event.arguments

  const rollRequestResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `PLAYTABLE#${playTableId}`,
        SK: `ROLLREQUEST#${rollRequestId}`,
      }),
    })
  )

  const playerResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `PLAYTABLE#${playTableId}`,
        SK: `PLAYER#${playerId}`,
      }),
    })
  )

  const rollRequest = rollRequestResult.Item
    ? (unmarshall(rollRequestResult.Item) as {
        id: string
        targetPlayerIds: string[]
        type: string
        dc?: number
        advantage?: string
        status: string
      })
    : null

  if (!rollRequest) {
    throw new Error('Roll request not found')
  }
  if (!playerResult.Item) {
    throw new Error('Player not found in play table')
  }
  if (!rollRequest.targetPlayerIds.includes(playerId)) {
    throw new Error('Player is not a target of this roll request')
  }
  if (rollRequest.status !== 'pending') {
    throw new Error('Roll request is no longer pending')
  }

  const roller: RollerIdentity = { type: 'player', rollerId: playerId }
  const rollId = randomUUID()

  await startRollExecution({
    rollId,
    playTableId,
    roller,
    diceType: 'd20',
    advantage: rollRequest.advantage ?? null,
    modifier: 0,
    dc: rollRequest.dc ?? null,
    visibility: 'all',
    rollRequestId,
    rollRequestType: rollRequest.type as 'ad_hoc' | 'initiative',
  })

  return { rollId, accepted: true }
}

const NOOP_CONTEXT = {} as Context
const NOOP_CALLBACK = undefined as unknown as Callback<unknown>

export const handler: AppSyncResolverHandler<unknown, unknown> = async (
  event: AppSyncResolverEvent<unknown>
) => {
  const fieldName = event.info?.fieldName ?? ''
  const parentType = event.info?.parentTypeName ?? ''

  if (parentType === 'Mutation') {
    if (fieldName === 'rollDice') {
      const e = event as AppSyncResolverEvent<{
        playTableId: string
        input: {
          id?: string | null
          diceType: string
          advantage?: string | null
          modifier?: number | null
          dc?: number | null
          visibility?: string | null
          rollRequestId?: string | null
        }
      }>
      return rollDice(e, NOOP_CONTEXT, NOOP_CALLBACK)
    }
    if (fieldName === 'fulfillRollRequest') {
      const e = event as AppSyncResolverEvent<{
        rollRequestId: string
        playTableId: string
        playerId: string
      }>
      return fulfillRollRequest(e, NOOP_CONTEXT, NOOP_CALLBACK)
    }
  }

  throw new Error(`Unknown resolver: ${parentType}.${fieldName}`)
}
