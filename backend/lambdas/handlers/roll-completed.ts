import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { SendTaskSuccessCommand, SFNClient } from '@aws-sdk/client-sfn'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { RollCompletedDetailSchema } from '@puzzlebottom-tabletop-tools/schemas'
import type { Handler } from 'aws-lambda'

import { notifyInitiativeUpdated } from './shared/notify-appsync.js'

const dynamo = new DynamoDBClient({})
const sfn = new SFNClient({})
const TABLE_NAME = process.env.TABLE_NAME!
const APPSYNC_GRAPHQL_URL = process.env.APPSYNC_GRAPHQL_URL!

interface InitiativePendingItem {
  taskToken: string
  rollRequestId: string
  expectedPlayerKeys: string[]
  completedPlayerKeys: string[]
}

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

interface PlayerItem {
  characterName: string
}

export const handler: Handler<unknown, void> = async (event) => {
  const detail = RollCompletedDetailSchema.parse(event)
  const { playTableId, rollRequestId, rollerId, values, modifier, total } =
    detail

  const pk = `PLAYTABLE#${playTableId}`

  const pendingResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: pk, SK: 'INITIATIVE_PENDING' }),
    })
  )

  if (pendingResult.Item) {
    const pending = unmarshall(pendingResult.Item) as InitiativePendingItem
    if (rollRequestId && pending.rollRequestId !== rollRequestId) {
      return
    }
    if (!pending.expectedPlayerKeys.includes(rollerId)) {
      return
    }
    const completedSet = new Set(pending.completedPlayerKeys)
    if (completedSet.has(rollerId)) {
      return
    }
    completedSet.add(rollerId)
    const completedPlayerKeys = Array.from(completedSet)

    await dynamo.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ PK: pk, SK: 'INITIATIVE_PENDING' }),
        UpdateExpression: 'SET completedPlayerKeys = :c',
        ExpressionAttributeValues: marshall({ ':c': completedPlayerKeys }),
      })
    )

    if (completedPlayerKeys.length >= pending.expectedPlayerKeys.length) {
      await sfn.send(
        new SendTaskSuccessCommand({
          taskToken: pending.taskToken,
          output: JSON.stringify({ playTableId, rollRequestId }),
        })
      )
    }
    return
  }

  const initiativeResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: pk, SK: 'INITIATIVE' }),
    })
  )

  if (!initiativeResult.Item) {
    return
  }

  const initiative = unmarshall(initiativeResult.Item) as InitiativeItem
  if (rollRequestId && initiative.rollRequestId !== rollRequestId) {
    return
  }
  if (initiative.order.some((e) => e.id === rollerId)) {
    return
  }

  const playerResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: pk, SK: `PLAYER#${rollerId}` }),
    })
  )
  const player = playerResult.Item
    ? (unmarshall(playerResult.Item) as PlayerItem)
    : null
  const characterName = player?.characterName ?? 'Unknown'
  const d20Value = values[0] ?? total - modifier

  const newEntry = {
    id: rollerId,
    characterName,
    value: d20Value,
    modifier,
    total,
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

  await notifyInitiativeUpdated(APPSYNC_GRAPHQL_URL, playTableId, updatedOrder)
}
