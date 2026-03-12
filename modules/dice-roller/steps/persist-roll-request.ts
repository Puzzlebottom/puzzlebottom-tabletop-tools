import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import type { Handler } from 'aws-lambda'
import { z } from 'zod'

const PayloadSchema = z.object({
  playTableId: z.string(),
  rollRequestId: z.string(),
  targetPlayerIds: z.array(z.string()),
  rollNotation: z.string(),
  type: z.enum(['initiative']),
  dc: z.number().nullable().optional(),
  isPrivate: z.boolean(),
  createdAt: z.string(),
})

type Payload = z.infer<typeof PayloadSchema>

const dynamo = new DynamoDBClient({})
const TABLE_NAME = process.env.TABLE_NAME!

export const handler: Handler<Payload, Payload> = async (event) => {
  const payload = PayloadSchema.parse(event)

  const { playTableId, rollRequestId, targetPlayerIds, type } = payload

  const item: Record<string, unknown> = {
    PK: `PLAYTABLE#${playTableId}`,
    SK: `ROLLREQUEST#${rollRequestId}`,
    GSI3PK:
      targetPlayerIds.length > 0 ? `TARGET#${targetPlayerIds[0]}` : undefined,
    GSI3SK: `createdAt#${payload.createdAt}`,
    id: rollRequestId,
    playTableId,
    targetPlayerIds,
    rollNotation: payload.rollNotation,
    type,
    dc: payload.dc ?? null,
    isPrivate: payload.isPrivate,
    createdAt: payload.createdAt,
    deletedAt: null,
    rolls: [],
  }

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(item, { removeUndefinedValues: true }),
    })
  )

  if (type === 'initiative') {
    await dynamo.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({
          PK: `PLAYTABLE#${playTableId}`,
          SK: 'INITIATIVE_META',
        }),
        UpdateExpression: 'SET currentRollRequestId = :r',
        ExpressionAttributeValues: marshall({ ':r': rollRequestId }),
      })
    )
  }

  return payload
}
