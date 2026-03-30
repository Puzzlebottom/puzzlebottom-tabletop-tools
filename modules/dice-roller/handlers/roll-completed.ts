import { SendTaskSuccessCommand, SFNClient } from '@aws-sdk/client-sfn'
import type { RollRequestCompletedDetail } from '@puzzlebottom-tabletop-tools/schemas'
import {
  RollCompletedDetailSchema,
  RollRequestCompletedDetailSchema,
} from '@puzzlebottom-tabletop-tools/schemas'
import type { Handler } from 'aws-lambda'

import { createDiceRollerStore, type IDiceRollerStore } from '../store/index.js'

const sfn = new SFNClient({})

export function createRollCompletedHandler(
  store: IDiceRollerStore,
  sfnClient: SFNClient
): Handler<unknown, void> {
  return async (event) => {
    const detail = RollCompletedDetailSchema.parse(event)
    const { playTableId, rollRequestId, rollerId } = detail

    if (!rollRequestId) {
      return
    }

    const rollRequest = await store.getRollRequest(playTableId, rollRequestId)

    if (!rollRequest) {
      return
    }

    if (!rollRequest.taskToken) {
      return
    }

    if (!rollRequest.targetPlayerIds.includes(rollerId)) {
      return
    }

    if (!(await store.isRollRequestFulfilled(playTableId, rollRequestId))) {
      return
    }

    const rolls = await store.listRollsForRequest(playTableId, rollRequestId)
    const rollIds = rolls.map((r) => r.id).sort()
    const playerIds = [...rollRequest.targetPlayerIds].sort()

    const payload: RollRequestCompletedDetail =
      RollRequestCompletedDetailSchema.parse({
        playTableId,
        rollRequestId,
        type: rollRequest.type,
        timestamps: {
          createdAt: rollRequest.createdAt,
          completedAt: new Date().toISOString(),
        },
        playerIds,
        rollIds,
      })

    await sfnClient.send(
      new SendTaskSuccessCommand({
        taskToken: rollRequest.taskToken,
        output: JSON.stringify(payload),
      })
    )
  }
}

const defaultStore = createDiceRollerStore({
  tableName: process.env.TABLE_NAME!,
})

export const handler: Handler<unknown, void> = createRollCompletedHandler(
  defaultStore,
  sfn
)
