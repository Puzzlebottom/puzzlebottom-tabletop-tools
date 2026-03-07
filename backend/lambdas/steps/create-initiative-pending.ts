import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import {
  type InitiativeRollRequestCreatedDetail,
  InitiativeRollRequestCreatedDetailSchema,
} from '@puzzlebottom-tabletop-tools/schemas'
import type { Handler } from 'aws-lambda'
import { z } from 'zod'

import { notifyRollRequestCreated } from '../handlers/shared/notify-appsync.js'

const PayloadSchema = InitiativeRollRequestCreatedDetailSchema.extend({
  taskToken: z.string(),
})

type Payload = z.infer<typeof PayloadSchema>

const dynamo = new DynamoDBClient({})
const TABLE_NAME = process.env.TABLE_NAME!
const APPSYNC_GRAPHQL_URL = process.env.APPSYNC_GRAPHQL_URL!

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

export const handler: Handler<Payload, void> = async (event) => {
  const payload = PayloadSchema.parse(event)

  const { playTableId, rollRequestId, targetPlayerIds, taskToken } =
    payload as Payload & InitiativeRollRequestCreatedDetail

  const item = {
    PK: `PLAYTABLE#${playTableId}`,
    SK: 'INITIATIVE_PENDING',
    taskToken,
    rollRequestId,
    expectedPlayerKeys: targetPlayerIds,
    completedPlayerKeys: [] as string[],
    createdAt: new Date().toISOString(),
  }

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(item, { removeUndefinedValues: true }),
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
