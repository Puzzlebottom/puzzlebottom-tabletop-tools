import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import {
  DETAIL_TYPE_ROLL_COMPLETED,
  EVENT_SOURCE,
  RollCompletedDetailSchema,
} from '@puzzlebottom-tabletop-tools/schemas'
import type {
  AppSyncResolverEvent,
  AppSyncResolverHandler,
  Callback,
  Context,
} from 'aws-lambda'
import { randomUUID } from 'crypto'

const dynamo = new DynamoDBClient({})
const TABLE_NAME = process.env.TABLE_NAME!
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!

type RollerIdentity =
  | { type: 'gm'; rollerId: string }
  | { type: 'player'; rollerId: string }

function parseVisibility(v: string | null | undefined): 'all' | 'gm_only' {
  if (v === 'gm_only') return 'gm_only'
  return 'all'
}

function rollD20(advantage?: string | null): {
  values: number[]
  used: number
} {
  const roll = () => Math.floor(Math.random() * 20) + 1
  if (advantage === 'advantage') {
    const a = roll()
    const b = roll()
    const used = Math.max(a, b)
    return { values: [a, b], used }
  }
  if (advantage === 'disadvantage') {
    const a = roll()
    const b = roll()
    const used = Math.min(a, b)
    return { values: [a, b], used }
  }
  const v = roll()
  return { values: [v], used: v }
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

async function performRoll(params: {
  playTableId: string
  roller: RollerIdentity
  diceType: string
  advantage?: string | null
  modifier?: number | null
  dc?: number | null
  visibility?: string | null
  rollRequestId?: string | null
  rollRequestType: 'ad_hoc' | 'initiative'
}): Promise<{
  rollId: string
  values: number[]
  modifier: number
  total: number
  advantage: string | null
  dc: number | null
  success: boolean | null
  visibility: 'all' | 'gm_only'
}> {
  const {
    playTableId,
    roller,
    diceType,
    advantage,
    modifier = 0,
    dc,
    visibility,
    rollRequestId,
    rollRequestType,
  } = params

  const { values, used } = rollD20(advantage)
  const total = used + (modifier ?? 0)
  const success = dc !== undefined && dc !== null ? total >= dc : null

  const rollId = randomUUID()
  const createdAt = new Date().toISOString()
  const vis = parseVisibility(visibility)

  const rollItem = {
    PK: `PLAYTABLE#${playTableId}`,
    SK: `ROLL#${rollId}`,
    id: rollId,
    playTableId,
    rollerId: roller.rollerId,
    rollerType: roller.type,
    diceType,
    values,
    modifier,
    total,
    advantage: advantage ?? null,
    dc: dc ?? null,
    success: success ?? null,
    visibility: vis,
    rollRequestType,
    rollRequestId: rollRequestId ?? null,
    createdAt,
  }

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(rollItem, { removeUndefinedValues: true }),
    })
  )

  const detail = RollCompletedDetailSchema.parse({
    playTableId,
    rollId,
    rollRequestId: rollRequestId ?? undefined,
    rollRequestType,
    rollerId: roller.rollerId,
    rollerType: roller.type,
    values,
    modifier,
    total,
    advantage: advantage ?? null,
    dc: dc ?? null,
    success: success ?? null,
  })

  const eb = new EventBridgeClient({})
  await eb.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: EVENT_SOURCE,
          DetailType: DETAIL_TYPE_ROLL_COMPLETED,
          Detail: JSON.stringify(detail),
          EventBusName: EVENT_BUS_NAME,
        },
      ],
    })
  )

  return {
    rollId,
    values,
    modifier: modifier ?? 0,
    total,
    advantage: advantage ?? null,
    dc: dc ?? null,
    success: success ?? null,
    visibility: vis,
  }
}

interface RollResult {
  rollId: string
  values: number[]
  modifier: number
  total: number
  advantage: string | null
  dc: number | null
  success: boolean | null
  visibility: 'all' | 'gm_only'
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
  RollResult
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

  return performRoll({
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
}

export const fulfillRollRequest: AppSyncResolverHandler<
  {
    rollRequestId: string
    playTableId: string
    playerId: string
  },
  RollResult
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

  return performRoll({
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
}

/** Dummy values for sub-resolver calls; sub-resolvers are async and don't use them. */
const NOOP_CONTEXT = {} as Context
const NOOP_CALLBACK = undefined as unknown as Callback<unknown>

/**
 * Main handler that routes AppSync invocations to rollDice or fulfillRollRequest.
 * Uses async/await (no callback param) for Node.js 24+ compatibility.
 */
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
