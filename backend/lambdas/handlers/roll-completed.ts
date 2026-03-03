import {
  type RollCompletedDetail,
  RollCompletedDetailSchema,
} from '@puzzlebottom-tabletop-tools/schemas'
import type { Handler } from 'aws-lambda'

/**
 * Handles RollCompleted events for initiative rolls.
 * Invoked by dispatcher when rollRequestType === 'initiative'.
 * C4 adds full logic: increment completed count, SendTaskSuccess when done.
 */
export const handler: Handler<unknown, void> = (event) => {
  const detail = RollCompletedDetailSchema.parse(event)
  void detail as RollCompletedDetail
  // C4: fetch INITIATIVE_PENDING, update completedPlayerKeys, SendTaskSuccess
  return Promise.resolve()
}
