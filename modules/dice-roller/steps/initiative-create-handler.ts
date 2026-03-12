import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import type {
  PublishRollRequestInput,
  RollType,
} from '@puzzlebottom-tabletop-tools/graphql-types'
import type { Handler } from 'aws-lambda'
import { z } from 'zod'

import { publishRollRequestCreated } from '../shared/notify-appsync.js'

const PayloadSchema = z.object({
  taskToken: z.string(),
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
    const rr = unmarshall(rollRequestResult.Item) as PublishRollRequestInput
    await publishRollRequestCreated(APPSYNC_GRAPHQL_URL, {
      id: rr.id,
      playTableId: rr.playTableId,
      targetPlayerIds: rr.targetPlayerIds,
      rolls: rr.rolls ?? [],
      rollNotation: rr.rollNotation,
      type: rr.type as RollType,
      dc: rr.dc ?? null,
      isPrivate: rr.isPrivate,
      createdAt: rr.createdAt,
      deletedAt: rr.deletedAt ?? null,
    })
  }
}
