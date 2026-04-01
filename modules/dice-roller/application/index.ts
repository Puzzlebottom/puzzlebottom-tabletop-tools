import type {
  CreateRollInput,
  CreateRollRequestInput,
  PaginatedRolls,
  Roll as GqlRoll,
  RollRequest as GqlRollRequest,
} from '@puzzlebottom-tabletop-tools/graphql-types'
import type { GenerateAndStoreRollPayload } from '@puzzlebottom-tabletop-tools/schemas/steps/roll-pipeline'
import type { RollRequestStepPayload } from '@puzzlebottom-tabletop-tools/schemas/steps/roll-request-pipeline'
import { randomUUID } from 'crypto'

import type { IPlayTableStore } from '../../play-table/store/index.js'
import type { IDiceRollerStore } from '../store/index.js'

export interface IDiceRollerWorkflowPort {
  startRollRequestPipeline(payload: RollRequestStepPayload): Promise<void>
  startRollPipeline(payload: GenerateAndStoreRollPayload): Promise<void>
}

export interface IDiceRollerApplication {
  createRollRequest(
    gmUserId: string,
    playTableId: string,
    input: CreateRollRequestInput
  ): Promise<GqlRollRequest>
  createRoll(
    identity: { sub?: string; playerId?: string | null },
    playTableId: string,
    input: CreateRollInput
  ): Promise<GqlRoll>
  clearInitiative(gmUserId: string, playTableId: string): Promise<boolean>
  rollHistory(
    playTableId: string,
    args: { limit?: number | null; nextToken?: string | null }
  ): Promise<PaginatedRolls>
}

export function createDiceRollerApplication(config: {
  playTableStore: IPlayTableStore
  diceRollerStore: IDiceRollerStore
  workflows: IDiceRollerWorkflowPort
}): IDiceRollerApplication {
  const { playTableStore, diceRollerStore, workflows } = config

  return {
    async createRollRequest(
      gmUserId: string,
      playTableId: string,
      input: CreateRollRequestInput
    ): Promise<GqlRollRequest> {
      const {
        targetPlayerIds,
        type,
        diceNotation,
        dc,
        isPrivate = false,
      } = input

      if (!targetPlayerIds?.length) {
        throw new Error('targetPlayerIds must not be empty')
      }

      const playTable = await playTableStore.getPlayTable(playTableId)
      if (!playTable) throw new Error('Play table not found')

      if (playTable.gmUserId !== gmUserId) {
        throw new Error('Only the GM can create roll requests')
      }

      const active = await diceRollerStore.getActiveRollRequest(playTableId)
      if (active) {
        throw new Error(
          'An active roll request already exists for this play table. Clear initiative or wait for the current request to finish before starting a new one.'
        )
      }

      if (type !== 'initiative') {
        throw new Error(`Unsupported roll request type: ${String(type)}`)
      }

      const rollRequestId = randomUUID()
      const createdAt = new Date().toISOString()

      await workflows.startRollRequestPipeline({
        playTableId,
        rollRequestId,
        targetPlayerIds,
        rollNotation: diceNotation,
        type,
        dc: dc ?? null,
        isPrivate: isPrivate ?? false,
        createdAt,
      })

      return {
        id: rollRequestId,
        playTableId,
        targetPlayerIds,
        rollNotation: diceNotation,
        type,
        dc: dc ?? null,
        isPrivate: isPrivate ?? false,
        createdAt,
        deletedAt: null,
        rolls: [],
      }
    },

    async createRoll(
      identity: { sub?: string; playerId?: string | null },
      playTableId: string,
      input: CreateRollInput
    ): Promise<GqlRoll> {
      const { sub, playerId: identityPlayerId } = identity
      const resolvedPlayerId = identityPlayerId ?? input.playerId

      type RollerIdentity =
        | { type: 'gm'; rollerId: string }
        | { type: 'player'; rollerId: string }

      let roller: RollerIdentity
      if (sub) {
        roller = { type: 'gm', rollerId: sub }
      } else if (resolvedPlayerId) {
        const player = await playTableStore.getPlayer(
          playTableId,
          resolvedPlayerId
        )
        if (!player) throw new Error('Player not found in play table')
        roller = { type: 'player', rollerId: resolvedPlayerId }
      } else {
        throw new Error(
          'Unauthorized: createRoll requires Cognito (GM) or playerId in input (player)'
        )
      }

      const playTable = await playTableStore.getPlayTable(playTableId)
      if (!playTable) throw new Error('Play table not found')

      let rollRequestId: string | null = null
      let rollRequestType: 'ad_hoc' | 'initiative' = 'ad_hoc'

      if (input.rollRequestId) {
        rollRequestId = input.rollRequestId
        rollRequestType = 'initiative'

        const rollRequest = await diceRollerStore.getRollRequest(
          playTableId,
          rollRequestId
        )
        if (!rollRequest) throw new Error('Roll request not found')

        if (!rollRequest.targetPlayerIds.includes(roller.rollerId)) {
          throw new Error('Player is not a target of this roll request')
        }

        if (!rollRequest.taskToken) {
          throw new Error('Roll request is no longer accepting rolls')
        }
      }

      const rollId = randomUUID()
      const createdAt = new Date().toISOString()

      await workflows.startRollPipeline({
        rollId,
        playTableId,
        roller,
        rollNotation: input.diceNotation,
        modifier: input.modifier,
        isPrivate: input.isPrivate,
        rollRequestId,
        rollRequestType,
      })

      return {
        id: rollId,
        playTableId,
        rollerId: roller.rollerId,
        rollNotation: input.diceNotation,
        type: null,
        values: [],
        modifier: input.modifier,
        rollResult: 0,
        isPrivate: input.isPrivate,
        rollRequestId,
        createdAt,
        deletedAt: null,
      }
    },

    async clearInitiative(
      _gmUserId: string,
      playTableId: string
    ): Promise<boolean> {
      const playTable = await playTableStore.getPlayTable(playTableId)
      if (!playTable) throw new Error('Play table not found')

      const active = await diceRollerStore.getActiveRollRequest(playTableId)
      if (!active) return true

      await diceRollerStore.clearRollRequest(playTableId, active.id)
      return true
    },

    async rollHistory(
      playTableId: string,
      args: { limit?: number | null; nextToken?: string | null }
    ): Promise<PaginatedRolls> {
      const { limit, nextToken } = args
      const pageSize = Math.min(Math.max(limit ?? 20, 1), 100)

      const allItems = await diceRollerStore.listRollsForPlayTable(playTableId)
      allItems.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

      let startIndex = 0
      if (nextToken) {
        const cursor = JSON.parse(
          Buffer.from(nextToken, 'base64').toString()
        ) as { offset: number }
        startIndex = cursor.offset
      }

      const pageItems = allItems.slice(startIndex, startIndex + pageSize)
      const hasMore = startIndex + pageSize < allItems.length

      const items: GqlRoll[] = pageItems.map((r) => ({
        id: r.id,
        playTableId: r.playTableId,
        rollerId: r.rollerId,
        rollNotation: r.rollNotation,
        type: (r.type as GqlRoll['type']) ?? null,
        values: r.values,
        modifier: r.modifier,
        rollResult: r.rollResult,
        isPrivate: r.isPrivate,
        rollRequestId: r.rollRequestId ?? null,
        createdAt: r.createdAt,
        deletedAt: r.deletedAt ?? null,
      }))

      return {
        items,
        nextToken: hasMore
          ? Buffer.from(
              JSON.stringify({ offset: startIndex + pageSize })
            ).toString('base64')
          : null,
      }
    },
  }
}
