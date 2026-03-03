import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { SendTaskSuccessCommand, SFNClient } from '@aws-sdk/client-sfn'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { PlayerLeftDetailSchema } from '@puzzlebottom-tabletop-tools/schemas'
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

export const handler: Handler<unknown, void> = async (event) => {
  const detail = PlayerLeftDetailSchema.parse(event)
  const { playTableId, id: playerId } = detail

  const pk = `PLAYTABLE#${playTableId}`

  const pendingResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: pk, SK: 'INITIATIVE_PENDING' }),
    })
  )

  if (pendingResult.Item) {
    const pending = unmarshall(pendingResult.Item) as InitiativePendingItem
    const expectedPlayerKeys = pending.expectedPlayerKeys.filter(
      (k) => k !== playerId
    )
    if (expectedPlayerKeys.length === pending.expectedPlayerKeys.length) {
      return
    }
    const completedPlayerKeys = pending.completedPlayerKeys.filter(
      (k) => k !== playerId
    )

    if (expectedPlayerKeys.length === 0) {
      await dynamo.send(
        new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: marshall({ PK: pk, SK: 'INITIATIVE_PENDING' }),
          UpdateExpression:
            'SET expectedPlayerKeys = :e, completedPlayerKeys = :c',
          ExpressionAttributeValues: marshall({
            ':e': expectedPlayerKeys,
            ':c': completedPlayerKeys,
          }),
        })
      )
      return
    }

    await dynamo.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ PK: pk, SK: 'INITIATIVE_PENDING' }),
        UpdateExpression:
          'SET expectedPlayerKeys = :e, completedPlayerKeys = :c',
        ExpressionAttributeValues: marshall({
          ':e': expectedPlayerKeys,
          ':c': completedPlayerKeys,
        }),
      })
    )

    if (completedPlayerKeys.length >= expectedPlayerKeys.length) {
      await sfn.send(
        new SendTaskSuccessCommand({
          taskToken: pending.taskToken,
          output: JSON.stringify({
            playTableId,
            rollRequestId: pending.rollRequestId,
          }),
        })
      )
    }
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
  const updatedOrder = initiative.order.filter((e) => e.id !== playerId)
  if (updatedOrder.length === initiative.order.length) {
    return
  }

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
