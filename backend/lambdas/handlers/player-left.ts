import {
  type PlayerLeftDetail,
  PlayerLeftDetailSchema,
} from '@puzzlebottom-tabletop-tools/schemas'
import type { Handler } from 'aws-lambda'

/**
 * Handles PlayerLeft events.
 * Invoked by dispatcher.
 * C4 adds full logic: remove from expected set, initiative order, notifyInitiativeUpdated.
 */
export const handler: Handler<unknown, void> = (event) => {
  const detail = PlayerLeftDetailSchema.parse(event)
  void detail as PlayerLeftDetail
  // C4: update INITIATIVE_PENDING, remove from order, notifyInitiativeUpdated
  return Promise.resolve()
}
