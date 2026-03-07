import type { Handler } from 'aws-lambda'

import {
  notifyRollCompleted,
  type RollResultPayload,
} from '../handlers/shared/notify-appsync.js'

const APPSYNC_GRAPHQL_URL = process.env.APPSYNC_GRAPHQL_URL!

interface NotifyRollCompletedInput extends RollResultPayload {
  rollerId: string
  rollerType: 'gm' | 'player'
  rollRequestId: string | null
  rollRequestType: 'ad_hoc' | 'initiative'
}

export const handler: Handler<NotifyRollCompletedInput, void> = async (
  event
) => {
  await notifyRollCompleted(APPSYNC_GRAPHQL_URL, {
    playTableId: event.playTableId,
    rollId: event.rollId,
    values: event.values,
    modifier: event.modifier,
    total: event.total,
    advantage: event.advantage,
    dc: event.dc,
    success: event.success,
    visibility: event.visibility,
  })
}
