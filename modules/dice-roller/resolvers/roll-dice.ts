import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import type {
  CreateRollInput,
  Roll,
} from '@puzzlebottom-tabletop-tools/graphql-types'
import type { GenerateAndStoreRollPayload } from '@puzzlebottom-tabletop-tools/schemas/steps/roll-pipeline'
import type { AppSyncResolverEvent, AppSyncResolverHandler } from 'aws-lambda'
import { randomUUID } from 'crypto'

import {
  createPlayTableStore,
  type IPlayTableStore,
} from '../../play-table/store/index.js'
import { createDiceRollerStore, type IDiceRollerStore } from '../store/index.js'

export interface RollDiceResolverDeps {
  playTableStore: IPlayTableStore
  diceRollerStore: IDiceRollerStore
  sfnClient: SFNClient
  rollStateMachineArn: string
}

function buildRollDiceResolverDeps(): RollDiceResolverDeps {
  return {
    playTableStore: createPlayTableStore({
      tableName: process.env.PLAY_TABLE_NAME!,
    }),
    diceRollerStore: createDiceRollerStore({
      tableName: process.env.DICE_ROLLER_TABLE_NAME!,
    }),
    sfnClient: new SFNClient({}),
    rollStateMachineArn: process.env.ROLL_STATE_MACHINE_ARN!,
  }
}

let cachedRollDiceResolverDeps: RollDiceResolverDeps | undefined

function getRollDiceResolverDeps(): RollDiceResolverDeps {
  cachedRollDiceResolverDeps ??= buildRollDiceResolverDeps()
  return cachedRollDiceResolverDeps
}

/** @internal Resets cached deps (tests only). */
export function __resetRollDiceResolverDepsCache(): void {
  cachedRollDiceResolverDeps = undefined
}

type RollerIdentity =
  | { type: 'gm'; rollerId: string }
  | { type: 'player'; rollerId: string }

async function resolveActor(
  playTableStore: IPlayTableStore,
  playTableId: string,
  identity: AppSyncResolverEvent<unknown>['identity'],
  playerId?: string | null
): Promise<RollerIdentity> {
  const gmSub =
    identity && 'sub' in identity
      ? (identity as { sub: string }).sub
      : undefined
  if (gmSub) {
    return { type: 'gm', rollerId: gmSub }
  }
  if (playerId) {
    const player = await playTableStore.getPlayer(playTableId, playerId)
    if (!player) {
      throw new Error('Player not found in play table')
    }
    return { type: 'player', rollerId: playerId }
  }
  throw new Error(
    'Unauthorized: createRoll requires Cognito (GM) or playerId in input (player)'
  )
}

async function startRollExecution(
  deps: RollDiceResolverDeps,
  params: GenerateAndStoreRollPayload
): Promise<void> {
  await deps.sfnClient.send(
    new StartExecutionCommand({
      stateMachineArn: deps.rollStateMachineArn,
      name: `roll-${params.rollId}`,
      input: JSON.stringify(params),
    })
  )
}

export async function createRollWithDeps(
  event: AppSyncResolverEvent<{
    playTableId: string
    playerId?: string | null
    input: CreateRollInput
  }>,
  deps: RollDiceResolverDeps
): Promise<Roll> {
  const { playTableId, playerId, input } = event.arguments
  const identity = event.identity

  const roller = await resolveActor(
    deps.playTableStore,
    playTableId,
    identity,
    playerId ?? input.playerId
  )

  const playTable = await deps.playTableStore.getPlayTable(playTableId)
  if (!playTable) {
    throw new Error('Play table not found')
  }

  let rollRequestId: string | null = null
  let rollRequestType: 'ad_hoc' | 'initiative' = 'ad_hoc'

  if (input.rollRequestId) {
    rollRequestId = input.rollRequestId
    rollRequestType = 'initiative'

    const rollRequest = await deps.diceRollerStore.getRollRequest(
      playTableId,
      rollRequestId
    )

    if (!rollRequest) {
      throw new Error('Roll request not found')
    }

    if (!rollRequest.targetPlayerIds.includes(roller.rollerId)) {
      throw new Error('Player is not a target of this roll request')
    }

    if (!rollRequest.taskToken) {
      throw new Error('Roll request is no longer accepting rolls')
    }
  }

  const rollId = randomUUID()
  const createdAt = new Date().toISOString()

  await startRollExecution(deps, {
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
}

export const createRoll: AppSyncResolverHandler<
  {
    playTableId: string
    playerId?: string | null
    input: CreateRollInput
  },
  Roll
> = async (event) => {
  return createRollWithDeps(event, getRollDiceResolverDeps())
}

export const handler: AppSyncResolverHandler<unknown, unknown> = async (
  event: AppSyncResolverEvent<unknown>
) => {
  const fieldName = event.info?.fieldName ?? ''
  const parentType = event.info?.parentTypeName ?? ''

  if (parentType === 'Mutation' && fieldName === 'createRoll') {
    const e = event as AppSyncResolverEvent<{
      playTableId: string
      playerId?: string | null
      input: CreateRollInput
    }>
    return createRollWithDeps(e, getRollDiceResolverDeps())
  }

  throw new Error(`Unknown resolver: ${parentType}.${fieldName}`)
}
