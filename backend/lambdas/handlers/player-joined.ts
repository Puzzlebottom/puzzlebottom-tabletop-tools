import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { PlayerJoinedDetailSchema } from '@puzzlebottom-tabletop-tools/schemas'
import type { Handler } from 'aws-lambda'
import { randomUUID } from 'crypto'

import { notifyInitiativeUpdated } from './shared/notify-appsync.js'

const dynamo = new DynamoDBClient({})
const TABLE_NAME = process.env.TABLE_NAME!
const APPSYNC_GRAPHQL_URL = process.env.APPSYNC_GRAPHQL_URL!

interface InitiativeItem {
  rollRequestId?: string
  order: {
    id: string
    characterName: string
    value: number
    modifier: number
    total: number
  }[]
}

interface RollItem {
  rollerId: string
  values: number[]
  modifier: number
  total: number
  rollRequestId: string | null
  rollRequestType: string
}

export const handler: Handler<unknown, void> = async (event) => {
  const detail = PlayerJoinedDetailSchema.parse(event)
  const { playTableId, id: playerId, characterName } = detail

  const pk = `PLAYTABLE#${playTableId}`

  const initiativeResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: pk, SK: 'INITIATIVE' }),
    })
  )

  if (initiativeResult.Item) {
    const initiative = unmarshall(initiativeResult.Item) as InitiativeItem
    if (initiative.order.some((e) => e.id === playerId)) {
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
      (i) => unmarshall(i) as RollItem
    )
    const priorRoll = rolls.find(
      (r) =>
        r.rollerId === playerId &&
        r.rollRequestType === 'initiative' &&
        (!initiative.rollRequestId ||
          r.rollRequestId === initiative.rollRequestId)
    )

    if (priorRoll) {
      const d20Value =
        priorRoll.values[0] ?? priorRoll.total - priorRoll.modifier
      const newEntry = {
        id: playerId,
        characterName,
        value: d20Value,
        modifier: priorRoll.modifier,
        total: priorRoll.total,
      }

      const updatedOrder = [...initiative.order, newEntry].sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total
        if (b.value !== a.value) return b.value - a.value
        return b.modifier - a.modifier
      })

      await dynamo.send(
        new PutItemCommand({
          TableName: TABLE_NAME,
          Item: marshall(
            {
              PK: pk,
              SK: 'INITIATIVE',
              rollRequestId: initiative.rollRequestId,
              order: updatedOrder,
              updatedAt: new Date().toISOString(),
            },
            { removeUndefinedValues: true }
          ),
        })
      )

      await notifyInitiativeUpdated(
        APPSYNC_GRAPHQL_URL,
        playTableId,
        updatedOrder
      )
      return
    }
  }

  const pendingResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: pk, SK: 'INITIATIVE_PENDING' }),
    })
  )

  const hasInitiativeState = initiativeResult.Item ?? pendingResult.Item
  if (!hasInitiativeState) {
    return
  }

  const rollRequestId = randomUUID()
  const createdAt = new Date().toISOString()
  const status = 'pending'

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(
        {
          PK: pk,
          SK: `ROLLREQUEST#${rollRequestId}`,
          GSI3PK: `TARGET#${playerId}`,
          GSI3SK: `status#${status}#${createdAt}`,
          id: rollRequestId,
          playTableId,
          targetPlayerIds: [playerId],
          type: 'initiative',
          dc: null,
          advantage: null,
          isPrivate: false,
          status,
          createdAt,
        },
        { removeUndefinedValues: true }
      ),
    })
  )
}
