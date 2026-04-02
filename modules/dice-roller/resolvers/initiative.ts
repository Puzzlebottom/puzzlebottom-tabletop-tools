import type {
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

import { createPlayTableStore } from '../../play-table/store/index.js'
import { createDiceRollerApplication } from '../application/index.js'
import { createDiceRollerStore } from '../store/index.js'
import { createAuthorizationAdapter } from './authorization-adapter.js'
import { createWorkflowPort } from './workflow-port.js'

const PLAY_TABLE_NAME = process.env.PLAY_TABLE_NAME!
const DICE_ROLLER_TABLE_NAME = process.env.DICE_ROLLER_TABLE_NAME!
const ROLL_REQUEST_STATE_MACHINE_ARN =
  process.env.ROLL_REQUEST_STATE_MACHINE_ARN!
const ROLL_STATE_MACHINE_ARN = process.env.ROLL_STATE_MACHINE_ARN!

let app: ReturnType<typeof createDiceRollerApplication> | undefined

function getApp() {
  app ??= createDiceRollerApplication({
    authorization: createAuthorizationAdapter(
      createPlayTableStore({ tableName: PLAY_TABLE_NAME })
    ),
    diceRollerStore: createDiceRollerStore({
      tableName: DICE_ROLLER_TABLE_NAME,
    }),
    workflows: createWorkflowPort({
      rollRequestStateMachineArn: ROLL_REQUEST_STATE_MACHINE_ARN,
      rollStateMachineArn: ROLL_STATE_MACHINE_ARN,
    }),
  })
  return app
}

const publishRollRequestCreated: AppSyncResolverHandler<
  { input: PublishRollRequestInput },
  PublishRollRequestInput
> = (event) => Promise.resolve(event.arguments.input)

const publishInitiativeUpdated: AppSyncResolverHandler<
  { input: PublishInitiativeUpdatedInput },
  Roll[]
> = (event) => {
  const rolls = event.arguments.input.rolls.filter(
    (r): r is PublishRollInput => r !== null && r !== undefined
  )
  return Promise.resolve(rolls)
}

const publishRollCompleted: AppSyncResolverHandler<
  { input: PublishRollInput },
  Roll
> = (event) => Promise.resolve(event.arguments.input)

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
      const { playTableId, limit, nextToken } = (
        event as AppSyncResolverEvent<{
          playTableId: string
          limit?: number | null
          nextToken?: string | null
        }>
      ).arguments
      return getApp().rollHistory(playTableId, { limit, nextToken })
    }
  }

  if (parentType === 'Mutation') {
    if (fieldName === 'clearInitiative') {
      const { playTableId } = (
        event as AppSyncResolverEvent<{ playTableId: string }>
      ).arguments
      const gmUserId =
        event.identity && 'sub' in (event.identity as object)
          ? (event.identity as { sub: string }).sub
          : undefined
      if (!gmUserId) {
        throw new Error(
          'Unauthorized: clearInitiative requires Cognito authentication'
        )
      }
      return getApp().clearInitiative(gmUserId, playTableId)
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
