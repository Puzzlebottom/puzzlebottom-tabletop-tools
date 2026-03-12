import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import type {
  CreateRollInput,
  Roll,
} from '@puzzlebottom-tabletop-tools/graphql-types'
import type {
  AppSyncResolverEvent,
  AppSyncResolverHandler,
  Callback,
  Context,
} from 'aws-lambda'
import { randomUUID } from 'crypto'

const dynamo = new DynamoDBClient({})
const sfnClient = new SFNClient({})
const PLAY_TABLE_NAME = process.env.PLAY_TABLE_NAME!
const DICE_ROLLER_TABLE_NAME = process.env.DICE_ROLLER_TABLE_NAME!
const ROLL_STATE_MACHINE_ARN = process.env.ROLL_STATE_MACHINE_ARN!

type RollerIdentity =
  | { type: 'gm'; rollerId: string }
  | { type: 'player'; rollerId: string }

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
        TableName: PLAY_TABLE_NAME,
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
    'Unauthorized: createRoll requires Cognito (GM) or playerId in input (player)'
  )
}

async function startRollExecution(params: {
  rollId: string
  playTableId: string
  roller: RollerIdentity
  rollNotation: string
  modifier: number
  isPrivate: boolean
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

export const createRoll: AppSyncResolverHandler<
  {
    playTableId: string
    playerId?: string | null
    input: CreateRollInput
  },
  Roll
> = async (event) => {
  const { playTableId, playerId, input } = event.arguments
  const identity = event.identity

  const roller = await resolveActor(
    playTableId,
    identity,
    playerId ?? input.playerId
  )

  const playTableResult = await dynamo.send(
    new GetItemCommand({
      TableName: PLAY_TABLE_NAME,
      Key: marshall({
        PK: `PLAYTABLE#${playTableId}`,
        SK: 'METADATA',
      }),
    })
  )
  if (!playTableResult.Item) {
    throw new Error('Play table not found')
  }

  let rollRequestId: string | null = null
  let rollRequestType: 'ad_hoc' | 'initiative' = 'ad_hoc'

  if (input.rollRequestId) {
    rollRequestId = input.rollRequestId
    rollRequestType = 'initiative'

    const rollRequestResult = await dynamo.send(
      new GetItemCommand({
        TableName: DICE_ROLLER_TABLE_NAME,
        Key: marshall({
          PK: `PLAYTABLE#${playTableId}`,
          SK: `ROLLREQUEST#${rollRequestId}`,
        }),
      })
    )

    if (!rollRequestResult.Item) {
      throw new Error('Roll request not found')
    }

    const rollRequest = unmarshall(rollRequestResult.Item) as {
      targetPlayerIds: string[]
      taskToken?: string
    }

    if (!rollRequest.targetPlayerIds.includes(roller.rollerId)) {
      throw new Error('Player is not a target of this roll request')
    }

    if (!rollRequest.taskToken) {
      throw new Error('Roll request is no longer accepting rolls')
    }
  }

  const rollId = randomUUID()
  const createdAt = new Date().toISOString()

  await startRollExecution({
    rollId,
    playTableId,
    roller,
    rollNotation: input.diceNotation,
    modifier: input.modifier,
    isPrivate: input.isPrivate,
    rollRequestId,
    rollRequestType,
  })

  return {
    id: rollId,
    playTableId,
    rollerId: roller.rollerId,
    rollNotation: input.diceNotation,
    type: null,
    values: [],
    modifier: input.modifier,
    rollResult: 0,
    isPrivate: input.isPrivate,
    rollRequestId,
    createdAt,
    deletedAt: null,
  }
}

const NOOP_CONTEXT = {} as Context
const NOOP_CALLBACK = undefined as unknown as Callback<unknown>

export const handler: AppSyncResolverHandler<unknown, unknown> = async (
  event: AppSyncResolverEvent<unknown>
) => {
  const fieldName = event.info?.fieldName ?? ''
  const parentType = event.info?.parentTypeName ?? ''

  if (parentType === 'Mutation' && fieldName === 'createRoll') {
    const e = event as AppSyncResolverEvent<{
      playTableId: string
      playerId?: string | null
      input: CreateRollInput
    }>
    return createRoll(e, NOOP_CONTEXT, NOOP_CALLBACK)
  }

  throw new Error(`Unknown resolver: ${parentType}.${fieldName}`)
}
