import { SendTaskSuccessCommand, SFNClient } from '@aws-sdk/client-sfn'
import type { PublishRollInput } from '@puzzlebottom-tabletop-tools/graphql-types'
import { PlayerLeftDetailSchema } from '@puzzlebottom-tabletop-tools/schemas'
import {
  type RollRequestCompletedDetail,
  RollRequestCompletedDetailSchema,
} from '@puzzlebottom-tabletop-tools/schemas'
import type { Handler } from 'aws-lambda'

import { publishInitiativeUpdated } from '../shared/notify-appsync.js'
import {
  createDiceRollerStore,
  type IDiceRollerStore,
  type Roll,
} from '../store/index.js'

const sfn = new SFNClient({})

function rollsForInitiative(rolls: Roll[], rollRequestId: string): Roll[] {
  return rolls.filter(
    (r) => r.rollRequestId === rollRequestId && r.type === 'initiative'
  )
}

function rollToPublishInput(r: Roll): PublishRollInput {
  return {
    id: r.id,
    playTableId: r.playTableId,
    rollerId: r.rollerId,
    rollNotation: r.rollNotation,
    type: r.type ?? undefined,
    values: r.values,
    modifier: r.modifier,
    rollResult: r.rollResult,
    isPrivate: r.isPrivate,
    rollRequestId: r.rollRequestId ?? undefined,
    createdAt: r.createdAt,
    deletedAt: r.deletedAt ?? undefined,
  }
}

export function createPlayerLeftHandler(
  store: IDiceRollerStore,
  sfnClient: SFNClient
): Handler<unknown, void> {
  return async (event) => {
    const detail = PlayerLeftDetailSchema.parse(event)
    const { playTableId, id: playerId } = detail

    const activeBefore = await store.getActiveRollRequest(playTableId)

    await store.removePlayerFromActiveRollRequest(playTableId, playerId)

    if (!activeBefore) {
      return
    }

    if (
      activeBefore.targetPlayerIds.includes(playerId) &&
      activeBefore.taskToken
    ) {
      const updatedTargets = activeBefore.targetPlayerIds.filter(
        (id) => id !== playerId
      )

      if (updatedTargets.length === 0) {
        const payload: RollRequestCompletedDetail =
          RollRequestCompletedDetailSchema.parse({
            playTableId,
            rollRequestId: activeBefore.id,
            type: activeBefore.type,
            timestamps: {
              createdAt: activeBefore.createdAt,
              completedAt: new Date().toISOString(),
            },
            playerIds: [],
            rollIds: [],
          })
        await sfnClient.send(
          new SendTaskSuccessCommand({
            taskToken: activeBefore.taskToken,
            output: JSON.stringify(payload),
          })
        )
      } else if (
        await store.isRollRequestFulfilled(playTableId, activeBefore.id)
      ) {
        const rolls = await store.listRollsForRequest(
          playTableId,
          activeBefore.id
        )
        const initiativeRolls = rollsForInitiative(rolls, activeBefore.id)
        const rollIds = initiativeRolls.map((r) => r.id).sort()
        const payload: RollRequestCompletedDetail =
          RollRequestCompletedDetailSchema.parse({
            playTableId,
            rollRequestId: activeBefore.id,
            type: activeBefore.type,
            timestamps: {
              createdAt: activeBefore.createdAt,
              completedAt: new Date().toISOString(),
            },
            playerIds: [...updatedTargets].sort(),
            rollIds,
          })
        await sfnClient.send(
          new SendTaskSuccessCommand({
            taskToken: activeBefore.taskToken,
            output: JSON.stringify(payload),
          })
        )
      }
    }

    const active = await store.getActiveRollRequest(playTableId)
    if (!active) {
      return
    }

    const rolls = await store.listRollsForRequest(playTableId, active.id)
    const initiativeRolls = rollsForInitiative(rolls, active.id)
    const updatedRolls = initiativeRolls.filter((r) => r.rollerId !== playerId)

    if (updatedRolls.length === initiativeRolls.length) {
      return
    }

    const url = process.env.APPSYNC_GRAPHQL_URL!
    await publishInitiativeUpdated(url, {
      rolls: updatedRolls.map(rollToPublishInput),
    })
  }
}

const defaultStore = createDiceRollerStore({
  tableName: process.env.TABLE_NAME!,
})

export const handler: Handler<unknown, void> = createPlayerLeftHandler(
  defaultStore,
  sfn
)
