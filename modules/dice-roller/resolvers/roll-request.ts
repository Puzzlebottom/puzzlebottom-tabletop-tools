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
const sfn = new SFNClient({})
const PLAY_TABLE_NAME = process.env.PLAY_TABLE_NAME!
const ROLL_REQUEST_STATE_MACHINE_ARN =
  process.env.ROLL_REQUEST_STATE_MACHINE_ARN!

import type {
  CreateRollRequestInput,
  RollRequest,
  RollType,
} from '@puzzlebottom-tabletop-tools/graphql-types'

export const createRollRequest: AppSyncResolverHandler<
  {
    playTableId: string
    input: CreateRollRequestInput
  },
  RollRequest
> = async (event) => {
  const gmUserId =
    event.identity && 'sub' in event.identity
      ? (event.identity as { sub: string }).sub
      : undefined
  if (!gmUserId) {
    throw new Error(
      'Unauthorized: createRollRequest requires Cognito authentication'
    )
  }

  const { playTableId, input } = event.arguments
  const { targetPlayerIds, type, diceNotation, dc, isPrivate = false } = input

  if (!targetPlayerIds?.length) {
    throw new Error('targetPlayerIds must not be empty')
  }

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

  const playTable = unmarshall(playTableResult.Item) as { gmUserId: string }
  if (playTable.gmUserId !== gmUserId) {
    throw new Error('Only the GM can create roll requests')
  }

  const rollRequestId = randomUUID()
  const createdAt = new Date().toISOString()

  if (type !== 'initiative') {
    throw new Error(`Unsupported roll request type: ${String(type)}`)
  }

  const executionInput = {
    playTableId,
    rollRequestId,
    targetPlayerIds,
    rollNotation: diceNotation,
    type,
    dc: dc ?? null,
    isPrivate: isPrivate ?? false,
    createdAt,
  }

  await sfn.send(
    new StartExecutionCommand({
      stateMachineArn: ROLL_REQUEST_STATE_MACHINE_ARN,
      name: rollRequestId,
      input: JSON.stringify(executionInput),
    })
  )

  return {
    id: rollRequestId,
    playTableId,
    targetPlayerIds,
    rollNotation: diceNotation,
    type: type as RollType,
    dc: dc ?? null,
    isPrivate: isPrivate ?? false,
    createdAt,
    deletedAt: null,
    rolls: [],
  }
}

/** Dummy values for sub-resolver calls; sub-resolvers are async and don't use them. */
const NOOP_CONTEXT = {} as Context
const NOOP_CALLBACK = undefined as unknown as Callback<unknown>

/**
 * Main handler for createRollRequest. Uses async/await (no callback param) for Node.js 24+ compatibility.
 */
export const handler: AppSyncResolverHandler<unknown, unknown> = async (
  event: AppSyncResolverEvent<unknown>
) => {
  const fieldName = event.info?.fieldName ?? ''
  const parentType = event.info?.parentTypeName ?? ''

  if (parentType === 'Mutation' && fieldName === 'createRollRequest') {
    const e = event as AppSyncResolverEvent<{
      playTableId: string
      input: CreateRollRequestInput
    }>
    return createRollRequest(e, NOOP_CONTEXT, NOOP_CALLBACK)
  }

  throw new Error(`Unknown resolver: ${parentType}.${fieldName}`)
}
