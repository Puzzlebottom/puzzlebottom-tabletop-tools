import type { AppSyncResolverEvent, AppSyncResolverHandler } from 'aws-lambda'

import { createPlayTableApplication } from '../application/index.js'
import { createPlayTableStore } from '../store/index.js'
import { createEventPort } from './event-port.js'

const TABLE_NAME = process.env.TABLE_NAME!
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!

let app: ReturnType<typeof createPlayTableApplication> | undefined

function getApp() {
  app ??= createPlayTableApplication({
    store: createPlayTableStore({ tableName: TABLE_NAME }),
    events: createEventPort(EVENT_BUS_NAME),
  })
  return app
}

export const handler: AppSyncResolverHandler<unknown, unknown> = async (
  event: AppSyncResolverEvent<unknown>
) => {
  const fieldName = event.info?.fieldName ?? ''
  const parentType = event.info?.parentTypeName ?? ''

  if (parentType === 'Query') {
    if (fieldName === 'playTable') {
      const { id } = (event as AppSyncResolverEvent<{ id: string }>).arguments
      return getApp().getPlayTable(id)
    }
    if (fieldName === 'playTableByInviteCode') {
      const { inviteCode } = (
        event as AppSyncResolverEvent<{ inviteCode: string }>
      ).arguments
      return getApp().getPlayTableByInviteCode(inviteCode)
    }
  }

  if (parentType === 'Mutation') {
    if (fieldName === 'createPlayTable') {
      const gmUserId =
        event.identity && 'sub' in (event.identity as object)
          ? (event.identity as { sub: string }).sub
          : undefined
      if (!gmUserId) {
        throw new Error(
          'Unauthorized: createPlayTable requires Cognito authentication'
        )
      }
      return getApp().createPlayTable(gmUserId)
    }
    if (fieldName === 'joinPlayTable') {
      const { inviteCode, input } = (
        event as AppSyncResolverEvent<{
          inviteCode: string
          input: { characterName: string; initiativeModifier: number }
        }>
      ).arguments
      return getApp().joinPlayTable(inviteCode, input)
    }
    if (fieldName === 'leavePlayTable') {
      const { playTableId, playerId } = (
        event as AppSyncResolverEvent<{ playTableId: string; playerId: string }>
      ).arguments
      return getApp().leavePlayTable(playTableId, playerId)
    }
  }

  throw new Error(`Unknown resolver: ${parentType}.${fieldName}`)
}
