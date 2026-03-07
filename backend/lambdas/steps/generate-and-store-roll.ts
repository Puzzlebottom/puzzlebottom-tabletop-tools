import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import type { Handler } from 'aws-lambda'

const dynamo = new DynamoDBClient({})
const TABLE_NAME = process.env.TABLE_NAME!

function rollD20(advantage?: string | null): {
  values: number[]
  used: number
} {
  const roll = () => Math.floor(Math.random() * 20) + 1
  if (advantage === 'advantage') {
    const a = roll()
    const b = roll()
    return { values: [a, b], used: Math.max(a, b) }
  }
  if (advantage === 'disadvantage') {
    const a = roll()
    const b = roll()
    return { values: [a, b], used: Math.min(a, b) }
  }
  const v = roll()
  return { values: [v], used: v }
}

function parseVisibility(v: string | null | undefined): 'all' | 'gm_only' {
  if (v === 'gm_only') return 'gm_only'
  return 'all'
}

export interface GenerateAndStoreRollInput {
  rollId: string
  playTableId: string
  roller: { type: 'gm' | 'player'; rollerId: string }
  diceType: string
  advantage?: string | null
  modifier?: number | null
  dc?: number | null
  visibility?: string | null
  rollRequestId?: string | null
  rollRequestType: 'ad_hoc' | 'initiative'
}

export interface GenerateAndStoreRollOutput {
  playTableId: string
  rollId: string
  rollerId: string
  rollerType: 'gm' | 'player'
  values: number[]
  modifier: number
  total: number
  advantage: string | null
  dc: number | null
  success: boolean | null
  visibility: 'all' | 'gm_only'
  rollRequestId: string | null
  rollRequestType: 'ad_hoc' | 'initiative'
}

export const handler: Handler<
  GenerateAndStoreRollInput,
  GenerateAndStoreRollOutput
> = async (event) => {
  const {
    rollId,
    playTableId,
    roller,
    diceType,
    advantage,
    modifier = 0,
    dc,
    visibility,
    rollRequestId,
    rollRequestType,
  } = event

  const { values, used } = rollD20(advantage)
  const total = used + (modifier ?? 0)
  const success = dc !== undefined && dc !== null ? total >= dc : null
  const vis = parseVisibility(visibility)
  const createdAt = new Date().toISOString()

  const rollItem = {
    PK: `PLAYTABLE#${playTableId}`,
    SK: `ROLL#${rollId}`,
    id: rollId,
    playTableId,
    rollerId: roller.rollerId,
    rollerType: roller.type,
    diceType,
    values,
    modifier: modifier ?? 0,
    total,
    advantage: advantage ?? null,
    dc: dc ?? null,
    success: success ?? null,
    visibility: vis,
    rollRequestType,
    rollRequestId: rollRequestId ?? null,
    createdAt,
  }

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(rollItem, { removeUndefinedValues: true }),
    })
  )

  return {
    playTableId,
    rollId,
    rollerId: roller.rollerId,
    rollerType: roller.type,
    values,
    modifier: modifier ?? 0,
    total,
    advantage: advantage ?? null,
    dc: dc ?? null,
    success: success ?? null,
    visibility: vis,
    rollRequestId: rollRequestId ?? null,
    rollRequestType,
  }
}
