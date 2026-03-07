import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import {
  type InitiativeRollRequestCreatedDetail,
  InitiativeRollRequestCreatedDetailSchema,
} from '@puzzlebottom-tabletop-tools/schemas'
import type { Handler } from 'aws-lambda'

import { notifyInitiativeUpdated } from '../handlers/shared/notify-appsync.js'

const dynamo = new DynamoDBClient({})
const TABLE_NAME = process.env.TABLE_NAME!
const APPSYNC_GRAPHQL_URL = process.env.APPSYNC_GRAPHQL_URL!

interface InitiativeEntry {
  id: string
  characterName: string
  value: number
  modifier: number
  total: number
}

interface RollItem {
  rollerId: string
  values: number[]
  modifier: number
  total: number
  rollRequestId: string | null
}

interface PlayerItem {
  characterName: string
}

export const handler: Handler<
  InitiativeRollRequestCreatedDetail,
  void
> = async (event) => {
  const payload = InitiativeRollRequestCreatedDetailSchema.parse(event)
  const { playTableId, rollRequestId } = payload

  const pk = `PLAYTABLE#${playTableId}`

  const pendingResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: pk, SK: 'INITIATIVE_PENDING' }),
    })
  )
  if (!pendingResult.Item) {
    throw new Error('INITIATIVE_PENDING not found')
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

  const rolls = (rollsResult.Items ?? [])
    .map((i) => unmarshall(i) as RollItem & { rollRequestType: string })
    .filter(
      (r) =>
        r.rollRequestType === 'initiative' &&
        (r.rollRequestId === rollRequestId || !r.rollRequestId)
    )

  const entries: InitiativeEntry[] = []
  for (const roll of rolls) {
    const playerResult = await dynamo.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({
          PK: pk,
          SK: `PLAYER#${roll.rollerId}`,
        }),
      })
    )
    const player = playerResult.Item
      ? (unmarshall(playerResult.Item) as PlayerItem)
      : null
    const characterName = player?.characterName ?? 'Unknown'
    const d20Value = roll.values[0] ?? roll.total - roll.modifier
    entries.push({
      id: roll.rollerId,
      characterName,
      value: d20Value,
      modifier: roll.modifier,
      total: roll.total,
    })
  }

  entries.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    if (b.value !== a.value) return b.value - a.value
    return b.modifier - a.modifier
  })

  const order = entries

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(
        {
          PK: pk,
          SK: 'INITIATIVE',
          rollRequestId,
          order,
          updatedAt: new Date().toISOString(),
        },
        { removeUndefinedValues: true }
      ),
    })
  )

  await notifyInitiativeUpdated(APPSYNC_GRAPHQL_URL, playTableId, order)
}
