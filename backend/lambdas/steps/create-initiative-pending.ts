import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import {
  type InitiativeRollRequestCreatedDetail,
  InitiativeRollRequestCreatedDetailSchema,
} from '@puzzlebottom-tabletop-tools/schemas'
import type { Handler } from 'aws-lambda'
import { z } from 'zod'

const PayloadSchema = InitiativeRollRequestCreatedDetailSchema.extend({
  taskToken: z.string(),
})

type Payload = z.infer<typeof PayloadSchema>

const dynamo = new DynamoDBClient({})
const TABLE_NAME = process.env.TABLE_NAME!

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
}
