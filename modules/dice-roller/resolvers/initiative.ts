import type {
  PaginatedRolls,
  PublishInitiativeUpdatedInput,
  PublishRollInput,
  PublishRollRequestInput,
  Roll,
} from '@puzzlebottom-tabletop-tools/graphql-types'
import type {
  AppSyncResolverEvent,
  AppSyncResolverHandler,
  Callback,
  Context,
} from 'aws-lambda'

import {
  createPlayTableStore,
  type IPlayTableStore,
} from '../../play-table/store/index.js'
import { createDiceRollerStore, type IDiceRollerStore } from '../store/index.js'

export interface InitiativeResolverDeps {
  playTableStore: IPlayTableStore
  diceRollerStore: IDiceRollerStore
}

function buildInitiativeResolverDeps(): InitiativeResolverDeps {
  return {
    playTableStore: createPlayTableStore({
      tableName: process.env.PLAY_TABLE_NAME!,
    }),
    diceRollerStore: createDiceRollerStore({
      tableName: process.env.DICE_ROLLER_TABLE_NAME!,
    }),
  }
}

let cachedInitiativeResolverDeps: InitiativeResolverDeps | undefined

function getInitiativeResolverDeps(): InitiativeResolverDeps {
  cachedInitiativeResolverDeps ??= buildInitiativeResolverDeps()
  return cachedInitiativeResolverDeps
}

/** @internal Resets cached deps (tests only). */
export function __resetInitiativeResolverDepsCache(): void {
  cachedInitiativeResolverDeps = undefined
}

export async function clearInitiativeWithDeps(
  event: AppSyncResolverEvent<{ playTableId: string }>,
  deps: InitiativeResolverDeps
): Promise<boolean> {
  const gmUserId =
    event.identity && 'sub' in event.identity
      ? (event.identity as { sub: string }).sub
      : undefined
  if (!gmUserId) {
    throw new Error(
      'Unauthorized: clearInitiative requires Cognito authentication'
    )
  }

  const { playTableId } = event.arguments

  const playTable = await deps.playTableStore.getPlayTable(playTableId)
  if (!playTable) {
    throw new Error('Play table not found')
  }

  const active = await deps.diceRollerStore.getActiveRollRequest(playTableId)
  if (!active) {
    return true
  }

  await deps.diceRollerStore.clearRollRequest(playTableId, active.id)
  return true
}

export const clearInitiative: AppSyncResolverHandler<
  { playTableId: string },
  boolean
> = async (event) => {
  return clearInitiativeWithDeps(event, getInitiativeResolverDeps())
}

export const publishRollRequestCreated: AppSyncResolverHandler<
  { input: PublishRollRequestInput },
  PublishRollRequestInput
> = (event) => {
  return Promise.resolve(event.arguments.input)
}

export const publishInitiativeUpdated: AppSyncResolverHandler<
  { input: PublishInitiativeUpdatedInput },
  Roll[]
> = (event) => {
  const rolls = event.arguments.input.rolls.filter(
    (r): r is PublishRollInput => r !== null && r !== undefined
  )
  return Promise.resolve(rolls)
}

export const publishRollCompleted: AppSyncResolverHandler<
  { input: PublishRollInput },
  Roll
> = (event) => {
  return Promise.resolve(event.arguments.input)
}

export async function rollHistoryWithDeps(
  event: AppSyncResolverEvent<{
    playTableId: string
    limit?: number | null
    nextToken?: string | null
  }>,
  deps: InitiativeResolverDeps
): Promise<PaginatedRolls> {
  const { playTableId, limit, nextToken } = event.arguments
  const pageSize = Math.min(Math.max(limit ?? 20, 1), 100)

  const allItems = await deps.diceRollerStore.listRollsForPlayTable(playTableId)

  allItems.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  let startIndex = 0
  if (nextToken) {
    const cursor = JSON.parse(Buffer.from(nextToken, 'base64').toString()) as {
      offset: number
    }
    startIndex = cursor.offset
  }

  const pageItems = allItems.slice(startIndex, startIndex + pageSize)
  const hasMore = startIndex + pageSize < allItems.length

  const items: Roll[] = pageItems.map((r) => ({
    id: r.id,
    playTableId: r.playTableId,
    rollerId: r.rollerId,
    rollNotation: r.rollNotation,
    type: (r.type as Roll['type']) ?? null,
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
      ? Buffer.from(JSON.stringify({ offset: startIndex + pageSize })).toString(
          'base64'
        )
      : null,
  }
}

export const rollHistory: AppSyncResolverHandler<
  { playTableId: string; limit?: number | null; nextToken?: string | null },
  PaginatedRolls
> = async (event) => {
  return rollHistoryWithDeps(event, getInitiativeResolverDeps())
}

/** Dummy values for sub-resolver calls; sub-resolvers are async and don't use them. */
const NOOP_CONTEXT = {} as Context
const NOOP_CALLBACK = undefined as unknown as Callback<unknown>

export const handler: AppSyncResolverHandler<unknown, unknown> = async (
  event: AppSyncResolverEvent<unknown>
) => {
  const fieldName = event.info?.fieldName ?? ''
  const parentType = event.info?.parentTypeName ?? ''

  if (parentType === 'Query') {
    if (fieldName === 'rollHistory') {
      const e = event as AppSyncResolverEvent<{
        playTableId: string
        limit?: number | null
        nextToken?: string | null
      }>
      return rollHistoryWithDeps(e, getInitiativeResolverDeps())
    }
  }

  if (parentType === 'Mutation') {
    if (fieldName === 'clearInitiative') {
      const e = event as AppSyncResolverEvent<{ playTableId: string }>
      return clearInitiativeWithDeps(e, getInitiativeResolverDeps())
    }
    if (fieldName === 'publishRollCompleted') {
      const e = event as AppSyncResolverEvent<{ input: PublishRollInput }>
      return publishRollCompleted(e, NOOP_CONTEXT, NOOP_CALLBACK)
    }
    if (fieldName === 'publishRollRequestCreated') {
      const e = event as AppSyncResolverEvent<{
        input: PublishRollRequestInput
      }>
      return publishRollRequestCreated(e, NOOP_CONTEXT, NOOP_CALLBACK)
    }
    if (fieldName === 'publishInitiativeUpdated') {
      const e = event as AppSyncResolverEvent<{
        input: PublishInitiativeUpdatedInput
      }>
      return publishInitiativeUpdated(e, NOOP_CONTEXT, NOOP_CALLBACK)
    }
  }

  throw new Error(`Unknown resolver: ${parentType}.${fieldName}`)
}
