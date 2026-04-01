import type { CreateRollRequestInput } from '@puzzlebottom-tabletop-tools/graphql-types'
import type { AppSyncResolverEvent, AppSyncResolverHandler } from 'aws-lambda'

import { createPlayTableStore } from '../../play-table/store/index.js'
import { createDiceRollerApplication } from '../application/index.js'
import { createDiceRollerStore } from '../store/index.js'
import { createWorkflowPort } from './workflow-port.js'

const PLAY_TABLE_NAME = process.env.PLAY_TABLE_NAME!
const DICE_ROLLER_TABLE_NAME = process.env.DICE_ROLLER_TABLE_NAME!
const ROLL_REQUEST_STATE_MACHINE_ARN =
  process.env.ROLL_REQUEST_STATE_MACHINE_ARN!
const ROLL_STATE_MACHINE_ARN = process.env.ROLL_STATE_MACHINE_ARN!

let app: ReturnType<typeof createDiceRollerApplication> | undefined

function getApp() {
  app ??= createDiceRollerApplication({
    playTableStore: createPlayTableStore({ tableName: PLAY_TABLE_NAME }),
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

export const handler: AppSyncResolverHandler<unknown, unknown> = async (
  event: AppSyncResolverEvent<unknown>
) => {
  const fieldName = event.info?.fieldName ?? ''
  const parentType = event.info?.parentTypeName ?? ''

  if (parentType === 'Mutation' && fieldName === 'createRollRequest') {
    const { playTableId, input } = (
      event as AppSyncResolverEvent<{
        playTableId: string
        input: CreateRollRequestInput
      }>
    ).arguments
    const gmUserId =
      event.identity && 'sub' in (event.identity as object)
        ? (event.identity as { sub: string }).sub
        : undefined
    if (!gmUserId) {
      throw new Error(
        'Unauthorized: createRollRequest requires Cognito authentication'
      )
    }
    return getApp().createRollRequest(gmUserId, playTableId, input)
  }

  throw new Error(`Unknown resolver: ${parentType}.${fieldName}`)
}
