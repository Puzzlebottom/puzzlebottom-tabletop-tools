import type { RollType } from '@puzzlebottom-tabletop-tools/graphql-types'
import {
  InitiativeCreateHandlerPayload,
  type InitiativeCreateHandlerPayload as Payload,
} from '@puzzlebottom-tabletop-tools/schemas/steps/roll-request-pipeline'
import type { Handler } from 'aws-lambda'

import { publishRollRequestCreated } from '../shared/notify-appsync.js'
import { createDiceRollerStore, type IDiceRollerStore } from '../store/index.js'

export interface InitiativeCreateHandlerOptions {
  graphqlUrl: string
}

export function createInitiativeCreateHandler(
  store: IDiceRollerStore,
  options: InitiativeCreateHandlerOptions
): Handler<Payload, void> {
  return async (event) => {
    const payload = InitiativeCreateHandlerPayload.parse(event)

    const { playTableId, rollRequestId, taskToken } = payload

    await store.setRollRequestTaskToken(playTableId, rollRequestId, taskToken)

    const rr = await store.getRollRequest(playTableId, rollRequestId)

    if (rr) {
      await publishRollRequestCreated(options.graphqlUrl, {
        id: rr.id,
        playTableId: rr.playTableId,
        targetPlayerIds: rr.targetPlayerIds,
        rolls: [],
        rollNotation: rr.rollNotation,
        type: rr.type as RollType,
        dc: rr.dc ?? null,
        isPrivate: rr.isPrivate,
        createdAt: rr.createdAt,
        deletedAt: rr.deletedAt ?? null,
      })
    }
  }
}

export const handler = createInitiativeCreateHandler(
  createDiceRollerStore({ tableName: process.env.TABLE_NAME! }),
  { graphqlUrl: process.env.APPSYNC_GRAPHQL_URL! }
)
