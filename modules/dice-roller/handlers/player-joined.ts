import { PlayerJoinedDetailSchema } from '@puzzlebottom-tabletop-tools/schemas'
import type { Handler } from 'aws-lambda'

import {
  createDiceRollerStore,
  type IDiceRollerStore,
  type Roll,
} from '../store/index.js'

function rollsForInitiative(rolls: Roll[], rollRequestId: string): Roll[] {
  return rolls.filter(
    (r) => r.rollRequestId === rollRequestId && r.type === 'initiative'
  )
}

export function createPlayerJoinedHandler(
  store: IDiceRollerStore
): Handler<unknown, void> {
  return async (event) => {
    const detail = PlayerJoinedDetailSchema.parse(event)
    const { playTableId, id: playerId } = detail

    const active = await store.getActiveRollRequest(playTableId)
    if (!active) {
      return
    }

    const currentRollRequestId = active.id
    const rolls = await store.listRollsForRequest(
      playTableId,
      currentRollRequestId
    )
    const initiativeRolls = rollsForInitiative(rolls, currentRollRequestId)

    if (initiativeRolls.some((r) => r.rollerId === playerId)) {
      return
    }

    if (active.type !== 'initiative') {
      return
    }
    if (!active.taskToken) {
      return
    }
    if (active.targetPlayerIds.includes(playerId)) {
      return
    }

    await store.addPlayerToRollRequest(
      playTableId,
      currentRollRequestId,
      playerId
    )
  }
}

const defaultStore = createDiceRollerStore({
  tableName: process.env.TABLE_NAME!,
})

export const handler: Handler<unknown, void> =
  createPlayerJoinedHandler(defaultStore)
