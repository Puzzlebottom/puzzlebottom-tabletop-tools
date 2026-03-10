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
const TABLE_NAME = process.env.TABLE_NAME!
const ROLL_REQUEST_STATE_MACHINE_ARN =
  process.env.ROLL_REQUEST_STATE_MACHINE_ARN!

export const createRollRequest: AppSyncResolverHandler<
  {
    playTableId: string
    input: {
      targetPlayerIds: string[]
      type: string
      dc?: number | null
      advantage?: string | null
      isPrivate?: boolean | null
    }
  },
  {
    rollRequestId: string
    accepted: boolean
  }
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
  const { targetPlayerIds, type, dc, advantage, isPrivate = false } = input

  if (!targetPlayerIds?.length) {
    throw new Error('targetPlayerIds must not be empty')
  }

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

  const playTable = unmarshall(playTableResult.Item) as { gmUserId: string }
  if (playTable.gmUserId !== gmUserId) {
    throw new Error('Only the GM can create roll requests')
  }

  const rollRequestId = randomUUID()
  const createdAt = new Date().toISOString()
  const status = 'pending'

  if (type !== 'initiative') {
    throw new Error(`Unsupported roll request type: ${type}`)
  }

  const executionInput = {
    playTableId,
    rollRequestId,
    targetPlayerIds,
    type,
    dc: dc ?? null,
    advantage: advantage ?? null,
    isPrivate: isPrivate ?? false,
    status,
    createdAt,
    initiatedBy: gmUserId,
  }

  await sfn.send(
    new StartExecutionCommand({
      stateMachineArn: ROLL_REQUEST_STATE_MACHINE_ARN,
      name: rollRequestId,
      input: JSON.stringify(executionInput),
    })
  )

  return {
    rollRequestId,
    accepted: true,
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
      input: {
        targetPlayerIds: string[]
        type: string
        dc?: number | null
        advantage?: string | null
        isPrivate?: boolean | null
      }
    }>
    return createRollRequest(e, NOOP_CONTEXT, NOOP_CALLBACK)
  }

  throw new Error(`Unknown resolver: ${parentType}.${fieldName}`)
}
