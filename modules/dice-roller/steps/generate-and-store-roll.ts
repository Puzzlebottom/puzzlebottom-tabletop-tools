import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import type { PublishRollInput } from '@puzzlebottom-tabletop-tools/graphql-types'
import type { Handler } from 'aws-lambda'

const dynamo = new DynamoDBClient({})
const TABLE_NAME = process.env.TABLE_NAME!

function rollD20(): { values: number[]; used: number } {
  const roll = () => Math.floor(Math.random() * 20) + 1
  const v = roll()
  return { values: [v], used: v }
}

interface GenerateAndStoreRollInput {
  rollId: string
  playTableId: string
  roller: { type: 'gm' | 'player'; rollerId: string }
  rollNotation: string
  modifier: number
  isPrivate: boolean
  rollRequestId?: string | null
  rollRequestType: 'ad_hoc' | 'initiative'
}

export const handler: Handler<
  GenerateAndStoreRollInput,
  PublishRollInput
> = async (event) => {
  const {
    rollId,
    playTableId,
    roller,
    rollNotation,
    modifier = 0,
    isPrivate,
    rollRequestId,
    rollRequestType,
  } = event

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
