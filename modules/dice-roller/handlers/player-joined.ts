import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import type { PublishRollInput } from '@puzzlebottom-tabletop-tools/graphql-types'
import { PlayerJoinedDetailSchema } from '@puzzlebottom-tabletop-tools/schemas'
import type { Handler } from 'aws-lambda'

import { publishInitiativeUpdated } from '../shared/notify-appsync.js'

const dynamo = new DynamoDBClient({})
const TABLE_NAME = process.env.TABLE_NAME!

interface InitiativeMetaItem {
  currentRollRequestId: string
}

interface RollRequestItem {
  id: string
  targetPlayerIds: string[]
  type: string
  taskToken?: string
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
  const detail = PlayerJoinedDetailSchema.parse(event)
  const { playTableId, id: playerId } = detail

  const pk = `PLAYTABLE#${playTableId}`

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

  if (initiativeRolls.some((r) => r.rollerId === playerId)) {
    return
  }

  const priorRoll = rolls.find(
    (r) =>
      r.rollerId === playerId &&
      r.rollRequestId === currentRollRequestId &&
      r.type === 'initiative'
  )
  if (priorRoll) {
    const url = process.env.APPSYNC_GRAPHQL_URL!
    await publishInitiativeUpdated(url, { rolls: initiativeRolls })
    return
  }

  const rollRequestResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        PK: pk,
        SK: `ROLLREQUEST#${currentRollRequestId}`,
      }),
    })
  )

  if (!rollRequestResult.Item) {
    return
  }

  const rollRequest = unmarshall(rollRequestResult.Item) as RollRequestItem
  if (rollRequest.type !== 'initiative') {
    return
  }
  if (!rollRequest.taskToken) {
    return
  }
  if (rollRequest.targetPlayerIds.includes(playerId)) {
    return
  }

  const updatedTargets = [...rollRequest.targetPlayerIds, playerId]
  await dynamo.send(
    new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        PK: pk,
        SK: `ROLLREQUEST#${currentRollRequestId}`,
      }),
      UpdateExpression: 'SET targetPlayerIds = :t',
      ExpressionAttributeValues: marshall({ ':t': updatedTargets }),
    })
  )
}
