import {
  type RollRequestStepPayload as Payload,
  RollRequestStepPayload,
} from '@puzzlebottom-tabletop-tools/schemas/steps/roll-request-pipeline'
import type { Handler } from 'aws-lambda'

import { createDiceRollerStore, type IDiceRollerStore } from '../store/index.js'

export function createPersistRollRequestHandler(
  store: IDiceRollerStore
): Handler<Payload, Payload> {
  return async (event) => {
    const payload = RollRequestStepPayload.parse(event)

    await store.putRollRequest({
      id: payload.rollRequestId,
      playTableId: payload.playTableId,
      targetPlayerIds: payload.targetPlayerIds,
      rollNotation: payload.rollNotation,
      type: payload.type,
      dc: payload.dc ?? null,
      isPrivate: payload.isPrivate,
      createdAt: payload.createdAt,
      deletedAt: null,
    })

    return payload
  }
}

export const handler = createPersistRollRequestHandler(
  createDiceRollerStore({ tableName: process.env.TABLE_NAME! })
)
