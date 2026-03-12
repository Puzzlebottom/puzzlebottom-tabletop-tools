import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { SendTaskSuccessCommand, SFNClient } from '@aws-sdk/client-sfn'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import type { PublishRollInput } from '@puzzlebottom-tabletop-tools/graphql-types'
import { PlayerLeftDetailSchema } from '@puzzlebottom-tabletop-tools/schemas'
import {
  type RollRequestCompletedDetail,
  RollRequestCompletedDetailSchema,
} from '@puzzlebottom-tabletop-tools/schemas'
import type { Handler } from 'aws-lambda'

import { publishInitiativeUpdated } from '../shared/notify-appsync.js'

const dynamo = new DynamoDBClient({})
const sfn = new SFNClient({})
const TABLE_NAME = process.env.TABLE_NAME!

interface InitiativeMetaItem {
  currentRollRequestId: string
}

interface RollRequestItem {
  id: string
  taskToken?: string
  targetPlayerIds: string[]
  type: string
  createdAt: string
}

function rollsForInitiative(
  rolls: PublishRollInput[],
  rollRequestId: string
): PublishRollInput[] {
  return rolls.filter(
    (r) => r.rollRequestId === rollRequestId && r.type === 'initiative'
  )
}

export const handler: Handler<unknown, void> = async (event) => {
  const detail = PlayerLeftDetailSchema.parse(event)
  const { playTableId, id: playerId } = detail

  const pk = `PLAYTABLE#${playTableId}`

  const rollRequestsResult = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: marshall({
        ':pk': pk,
        ':sk': 'ROLLREQUEST#',
      }),
    })
  )

  const rollRequestItems = (rollRequestsResult.Items ?? []).map(
    (i) => unmarshall(i) as RollRequestItem
  )
  const rollRequestsWithPlayer = rollRequestItems.filter((rr) =>
    rr.targetPlayerIds.includes(playerId)
  )

  for (const rr of rollRequestsWithPlayer) {
    const updatedTargets = rr.targetPlayerIds.filter((id) => id !== playerId)

    await dynamo.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({
          PK: pk,
          SK: `ROLLREQUEST#${rr.id}`,
        }),
        UpdateExpression: 'SET targetPlayerIds = :t',
        ExpressionAttributeValues: marshall({ ':t': updatedTargets }),
      })
    )

    if (rr.taskToken) {
      if (updatedTargets.length === 0) {
        const payload: RollRequestCompletedDetail =
          RollRequestCompletedDetailSchema.parse({
            playTableId,
            rollRequestId: rr.id,
            type: rr.type as 'initiative',
            timestamps: {
              createdAt: rr.createdAt,
              completedAt: new Date().toISOString(),
            },
            playerIds: [],
            rollIds: [],
          })
        await sfn.send(
          new SendTaskSuccessCommand({
            taskToken: rr.taskToken,
            output: JSON.stringify(payload),
          })
        )
      } else {
        const rollsResult = await dynamo.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: marshall({
              ':pk': pk,
              ':sk': 'ROLL#',
            }),
          })
        )
        const rolls = (rollsResult.Items ?? []).map(
          (i) => unmarshall(i) as PublishRollInput
        )
        const rollsForRequest = rollsForInitiative(rolls, rr.id)
        const rollerIds = [...new Set(rollsForRequest.map((r) => r.rollerId))]
        const allRolled = updatedTargets.every((id) => rollerIds.includes(id))
        if (allRolled) {
          const rollIds = rollsForRequest.map((r) => r.id).sort()
          const payload: RollRequestCompletedDetail =
            RollRequestCompletedDetailSchema.parse({
              playTableId,
              rollRequestId: rr.id,
              type: rr.type as 'initiative',
              timestamps: {
                createdAt: rr.createdAt,
                completedAt: new Date().toISOString(),
              },
              playerIds: [...updatedTargets].sort(),
              rollIds,
            })
          await sfn.send(
            new SendTaskSuccessCommand({
              taskToken: rr.taskToken,
              output: JSON.stringify(payload),
            })
          )
        }
      }
    }
  }

  const metaResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: pk, SK: 'INITIATIVE_META' }),
    })
  )

  if (!metaResult.Item) {
    return
  }

  const meta = unmarshall(metaResult.Item) as InitiativeMetaItem
  const currentRollRequestId = meta.currentRollRequestId
  if (!currentRollRequestId) {
    return
  }

  const rollsResult = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: marshall({
        ':pk': pk,
        ':sk': 'ROLL#',
      }),
    })
  )

  const rolls = (rollsResult.Items ?? []).map(
    (i) => unmarshall(i) as PublishRollInput
  )
  const initiativeRolls = rollsForInitiative(rolls, currentRollRequestId)
  const updatedRolls = initiativeRolls.filter((r) => r.rollerId !== playerId)

  if (updatedRolls.length === initiativeRolls.length) {
    return
  }

  const url = process.env.APPSYNC_GRAPHQL_URL!
  await publishInitiativeUpdated(url, { rolls: updatedRolls })
}
