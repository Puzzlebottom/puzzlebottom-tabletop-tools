import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge'
import { marshall } from '@aws-sdk/util-dynamodb'
import {
  DETAIL_TYPE_INITIATIVE_ROLL_REQUEST_CREATED,
  EVENT_SOURCE,
  InitiativeRollRequestCreatedDetailSchema,
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
    id: string
    playTableId: string
    targetPlayerIds: string[]
    type: string
    dc?: number | null
    advantage?: string | null
    isPrivate: boolean
    status: string
    createdAt: string
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

  const rollRequestId = randomUUID()
  const createdAt = new Date().toISOString()
  const status = 'pending'

  const rollRequestItem = {
    PK: `PLAYTABLE#${playTableId}`,
    SK: `ROLLREQUEST#${rollRequestId}`,
    GSI3PK:
      targetPlayerIds.length > 0 ? `TARGET#${targetPlayerIds[0]}` : undefined,
    GSI3SK: `status#${status}#${createdAt}`,
    id: rollRequestId,
    playTableId,
    targetPlayerIds,
    type,
    dc: dc ?? null,
    advantage: advantage ?? null,
    isPrivate,
    status,
    createdAt,
  }

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(rollRequestItem, { removeUndefinedValues: true }),
    })
  )

  if (type === 'initiative') {
    const detail = InitiativeRollRequestCreatedDetailSchema.parse({
      playTableId,
      rollRequestId,
      targetPlayerIds,
      expectedCount: targetPlayerIds.length,
    })

    const eb = new EventBridgeClient({})
    await eb.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: EVENT_SOURCE,
            DetailType: DETAIL_TYPE_INITIATIVE_ROLL_REQUEST_CREATED,
            Detail: JSON.stringify(detail),
            EventBusName: EVENT_BUS_NAME,
          },
        ],
      })
    )
  }

  return {
    id: rollRequestId,
    playTableId,
    targetPlayerIds,
    type,
    dc: dc ?? null,
    advantage: advantage ?? null,
    isPrivate: isPrivate ?? false,
    status,
    createdAt,
  }
}

export const handler: AppSyncResolverHandler<unknown, unknown> = async (
  event: AppSyncResolverEvent<unknown>,
  context: Context,
  callback: Callback<unknown>
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
    return createRollRequest(e, context, callback)
  }

  throw new Error(`Unknown resolver: ${parentType}.${fieldName}`)
}
