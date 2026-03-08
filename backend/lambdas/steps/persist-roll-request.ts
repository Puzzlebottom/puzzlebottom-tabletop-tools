import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import type { Handler } from 'aws-lambda'
import { z } from 'zod'

const PayloadSchema = z.object({
  playTableId: z.string(),
  rollRequestId: z.string(),
  targetPlayerIds: z.array(z.string()),
  type: z.enum(['initiative']),
  dc: z.number().nullable().optional(),
  advantage: z.string().nullable().optional(),
  isPrivate: z.boolean(),
  status: z.string(),
  createdAt: z.string(),
  initiatedBy: z.string(),
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
    GSI3SK: `status#${payload.status}#${payload.createdAt}`,
    id: rollRequestId,
    playTableId,
    targetPlayerIds,
    type,
    dc: payload.dc ?? null,
    advantage: payload.advantage ?? null,
    isPrivate: payload.isPrivate,
    status: payload.status,
    createdAt: payload.createdAt,
    initiatedBy: payload.initiatedBy,
  }

  if (type === 'initiative') {
    item.completedPlayerKeys = []
  }

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(item, { removeUndefinedValues: true }),
    })
  )

  return payload
}
