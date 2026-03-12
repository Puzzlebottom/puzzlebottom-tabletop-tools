import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb'
import { SendTaskSuccessCommand, SFNClient } from '@aws-sdk/client-sfn'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import type { RollRequestCompletedDetail } from '@puzzlebottom-tabletop-tools/schemas'
import {
  RollCompletedDetailSchema,
  RollRequestCompletedDetailSchema,
} from '@puzzlebottom-tabletop-tools/schemas'
import type { Handler } from 'aws-lambda'

const dynamo = new DynamoDBClient({})
const sfn = new SFNClient({})
const TABLE_NAME = process.env.TABLE_NAME!

interface RollRequestItem {
  taskToken: string
  targetPlayerIds: string[]
  createdAt: string
  type: string
}

interface RollItem {
  id: string
  rollerId: string
  rollRequestId: string | null
}

export const handler: Handler<unknown, void> = async (event) => {
  const detail = RollCompletedDetailSchema.parse(event)
  const { playTableId, rollRequestId, rollerId } = detail

  if (!rollRequestId) {
    return
  }

  const pk = `PLAYTABLE#${playTableId}`

  const rollRequestResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        PK: pk,
        SK: `ROLLREQUEST#${rollRequestId}`,
      }),
    })
  )

  if (!rollRequestResult.Item) {
    return
  }

  const rollRequest = unmarshall(rollRequestResult.Item) as RollRequestItem

  if (!rollRequest.taskToken) {
    return
  }

  if (!rollRequest.targetPlayerIds.includes(rollerId)) {
    return
  }

  const queryResult = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: marshall({
        ':pk': pk,
        ':sk': 'ROLL#',
      }),
    })
  )

  const rolls = queryResult.Items?.map((i) => unmarshall(i) as RollItem) ?? []
  const rollsForRequest = rolls.filter((r) => r.rollRequestId === rollRequestId)
  const rollerIds = [...new Set(rollsForRequest.map((r) => r.rollerId))]

  const allRolled = rollRequest.targetPlayerIds.every((id) =>
    rollerIds.includes(id)
  )
  if (!allRolled) {
    return
  }

  const rollIds = rollsForRequest.map((r) => r.id).sort()
  const playerIds = [...rollRequest.targetPlayerIds].sort()

  const payload: RollRequestCompletedDetail =
    RollRequestCompletedDetailSchema.parse({
      playTableId,
      rollRequestId,
      type: rollRequest.type as 'initiative',
      timestamps: {
        createdAt: rollRequest.createdAt,
        completedAt: new Date().toISOString(),
      },
      playerIds,
      rollIds,
    })

  await sfn.send(
    new SendTaskSuccessCommand({
      taskToken: rollRequest.taskToken,
      output: JSON.stringify(payload),
    })
  )
}
