import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import type { PublishRollInput } from '@puzzlebottom-tabletop-tools/graphql-types'
import {
  GenerateAndStoreRollPayload,
  type GenerateAndStoreRollPayload as Payload,
} from '@puzzlebottom-tabletop-tools/schemas/steps/roll-pipeline'
import type { Handler } from 'aws-lambda'

const dynamo = new DynamoDBClient({})
const TABLE_NAME = process.env.TABLE_NAME!

function rollD20(): { values: number[]; used: number } {
  const roll = () => Math.floor(Math.random() * 20) + 1
  const v = roll()
  return { values: [v], used: v }
}

export const handler: Handler<Payload, PublishRollInput> = async (event) => {
  const {
    rollId,
    playTableId,
    roller,
    rollNotation,
    modifier,
    isPrivate,
    rollRequestId,
    rollRequestType,
  } = GenerateAndStoreRollPayload.parse(event)

  const { values, used } = rollD20()
  const rollResult = used + modifier
  const createdAt = new Date().toISOString()

  const rollItem: PublishRollInput = {
    id: rollId,
    playTableId,
    rollerId: roller.rollerId,
    rollNotation,
    type: rollRequestType === 'initiative' ? 'initiative' : null,
    values,
    modifier,
    rollResult,
    isPrivate,
    rollRequestId: rollRequestId ?? null,
    createdAt,
    deletedAt: null,
  }

  const dynamoItem = {
    PK: `PLAYTABLE#${playTableId}`,
    SK: `ROLL#${rollId}`,
    ...rollItem,
  }

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(dynamoItem, { removeUndefinedValues: true }),
    })
  )

  return rollItem
}
