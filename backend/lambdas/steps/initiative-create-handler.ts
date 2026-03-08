import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import type { Handler } from 'aws-lambda'
import { z } from 'zod'

import { notifyRollRequestCreated } from '../handlers/shared/notify-appsync.js'

const PayloadSchema = z.object({
  taskToken: z.string(),
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

interface RollRequestItem {
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

const dynamo = new DynamoDBClient({})
const TABLE_NAME = process.env.TABLE_NAME!
const APPSYNC_GRAPHQL_URL = process.env.APPSYNC_GRAPHQL_URL!

export const handler: Handler<Payload, void> = async (event) => {
  const payload = PayloadSchema.parse(event)

  const { playTableId, rollRequestId, taskToken } = payload

  await dynamo.send(
    new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `PLAYTABLE#${playTableId}`,
        SK: `ROLLREQUEST#${rollRequestId}`,
      }),
      UpdateExpression: 'SET taskToken = :t',
      ExpressionAttributeValues: marshall({ ':t': taskToken }),
    })
  )

  const rollRequestResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `PLAYTABLE#${playTableId}`,
        SK: `ROLLREQUEST#${rollRequestId}`,
      }),
    })
  )

  if (rollRequestResult.Item) {
    const rr = unmarshall(rollRequestResult.Item) as RollRequestItem
    await notifyRollRequestCreated(APPSYNC_GRAPHQL_URL, {
      id: rr.id,
      playTableId: rr.playTableId,
      targetPlayerIds: rr.targetPlayerIds,
      type: rr.type,
      dc: rr.dc,
      advantage: rr.advantage,
      isPrivate: rr.isPrivate,
      status: rr.status,
      createdAt: rr.createdAt,
    })
  }
}
