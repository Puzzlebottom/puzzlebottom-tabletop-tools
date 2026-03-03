import {
  type PlayerJoinedDetail,
  PlayerJoinedDetailSchema,
} from '@puzzlebottom-tabletop-tools/schemas'
import type { Handler } from 'aws-lambda'

/**
 * Handles PlayerJoined events.
 * Invoked by dispatcher.
 * C4 adds full logic: amend order if prior roll exists, else create RollRequest.
 */
export const handler: Handler<unknown, void> = (event) => {
  const detail = PlayerJoinedDetailSchema.parse(event)
  void detail as PlayerJoinedDetail
  // C4: check initiative order, amend or create RollRequest, notifyInitiativeUpdated
  return Promise.resolve()
}
