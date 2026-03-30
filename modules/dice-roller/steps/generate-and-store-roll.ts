import type { PublishRollInput } from '@puzzlebottom-tabletop-tools/graphql-types'
import {
  GenerateAndStoreRollPayload,
  type GenerateAndStoreRollPayload as Payload,
} from '@puzzlebottom-tabletop-tools/schemas/steps/roll-pipeline'
import type { Handler } from 'aws-lambda'

import { createDiceRollerStore, type IDiceRollerStore } from '../store/index.js'

function rollD20(): { values: number[]; used: number } {
  const roll = () => Math.floor(Math.random() * 20) + 1
  const v = roll()
  return { values: [v], used: v }
}

export function createGenerateAndStoreRollHandler(
  store: IDiceRollerStore
): Handler<Payload, PublishRollInput> {
  return async (event) => {
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

    await store.putRoll({
      id: rollItem.id,
      playTableId: rollItem.playTableId,
      rollerId: rollItem.rollerId,
      rollNotation: rollItem.rollNotation,
      type: rollItem.type ?? null,
      values: rollItem.values,
      modifier: rollItem.modifier,
      rollResult: rollItem.rollResult,
      isPrivate: rollItem.isPrivate,
      rollRequestId: rollItem.rollRequestId ?? null,
      createdAt: rollItem.createdAt,
      deletedAt: rollItem.deletedAt ?? null,
    })

    return rollItem
  }
}

export const handler = createGenerateAndStoreRollHandler(
  createDiceRollerStore({ tableName: process.env.TABLE_NAME! })
)
