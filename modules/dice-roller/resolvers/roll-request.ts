import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import type {
  CreateRollRequestInput,
  RollRequest,
  RollType,
} from '@puzzlebottom-tabletop-tools/graphql-types'
import type { RollRequestStepPayload } from '@puzzlebottom-tabletop-tools/schemas/steps/roll-request-pipeline'
import type { AppSyncResolverEvent, AppSyncResolverHandler } from 'aws-lambda'
import { randomUUID } from 'crypto'

import {
  createPlayTableStore,
  type IPlayTableStore,
} from '../../play-table/store/index.js'
import { createDiceRollerStore, type IDiceRollerStore } from '../store/index.js'

export interface RollRequestResolverDeps {
  playTableStore: IPlayTableStore
  diceRollerStore: IDiceRollerStore
  sfnClient: SFNClient
  rollRequestStateMachineArn: string
}

function buildRollRequestResolverDeps(): RollRequestResolverDeps {
  return {
    playTableStore: createPlayTableStore({
      tableName: process.env.PLAY_TABLE_NAME!,
    }),
    diceRollerStore: createDiceRollerStore({
      tableName: process.env.DICE_ROLLER_TABLE_NAME!,
    }),
    sfnClient: new SFNClient({}),
    rollRequestStateMachineArn: process.env.ROLL_REQUEST_STATE_MACHINE_ARN!,
  }
}

let cachedRollRequestResolverDeps: RollRequestResolverDeps | undefined

function getRollRequestResolverDeps(): RollRequestResolverDeps {
  cachedRollRequestResolverDeps ??= buildRollRequestResolverDeps()
  return cachedRollRequestResolverDeps
}

/** @internal Resets cached deps (tests only). */
export function __resetRollRequestResolverDepsCache(): void {
  cachedRollRequestResolverDeps = undefined
}

export async function createRollRequestWithDeps(
  event: AppSyncResolverEvent<{
    playTableId: string
    input: CreateRollRequestInput
  }>,
  deps: RollRequestResolverDeps
): Promise<RollRequest> {
  const gmUserId =
    event.identity && 'sub' in event.identity
      ? (event.identity as { sub: string }).sub
      : undefined
  if (!gmUserId) {
    throw new Error(
      'Unauthorized: createRollRequest requires Cognito authentication'
    )
  }

  const { playTableId, input } = event.arguments
  const { targetPlayerIds, type, diceNotation, dc, isPrivate = false } = input

  if (!targetPlayerIds?.length) {
    throw new Error('targetPlayerIds must not be empty')
  }

  const playTable = await deps.playTableStore.getPlayTable(playTableId)
  if (!playTable) {
    throw new Error('Play table not found')
  }

  if (playTable.gmUserId !== gmUserId) {
    throw new Error('Only the GM can create roll requests')
  }

  const active = await deps.diceRollerStore.getActiveRollRequest(playTableId)
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

  const executionInput: RollRequestStepPayload = {
    playTableId,
    rollRequestId,
    targetPlayerIds,
    rollNotation: diceNotation,
    type,
    dc: dc ?? null,
    isPrivate: isPrivate ?? false,
    createdAt,
  }

  await deps.sfnClient.send(
    new StartExecutionCommand({
      stateMachineArn: deps.rollRequestStateMachineArn,
      name: rollRequestId,
      input: JSON.stringify(executionInput),
    })
  )

  return {
    id: rollRequestId,
    playTableId,
    targetPlayerIds,
    rollNotation: diceNotation,
    type: type as RollType,
    dc: dc ?? null,
    isPrivate: isPrivate ?? false,
    createdAt,
    deletedAt: null,
    rolls: [],
  }
}

export const createRollRequest: AppSyncResolverHandler<
  {
    playTableId: string
    input: CreateRollRequestInput
  },
  RollRequest
> = async (event) => {
  return createRollRequestWithDeps(event, getRollRequestResolverDeps())
}

/**
 * Main handler for createRollRequest. Uses async/await (no callback param) for Node.js 24+ compatibility.
 */
export const handler: AppSyncResolverHandler<unknown, unknown> = async (
  event: AppSyncResolverEvent<unknown>
) => {
  const fieldName = event.info?.fieldName ?? ''
  const parentType = event.info?.parentTypeName ?? ''

  if (parentType === 'Mutation' && fieldName === 'createRollRequest') {
    const e = event as AppSyncResolverEvent<{
      playTableId: string
      input: CreateRollRequestInput
    }>
    return createRollRequestWithDeps(e, getRollRequestResolverDeps())
  }

  throw new Error(`Unknown resolver: ${parentType}.${fieldName}`)
}
