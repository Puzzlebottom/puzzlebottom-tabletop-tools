import { z } from 'zod'

import { DataRecordSchema } from './data-record'

/** EventBridge event body structure when delivered to SQS. */
export const EventBridgeEventBodySchema = z.object({
  detail: DataRecordSchema,
})

export type EventBridgeEventBody = z.infer<typeof EventBridgeEventBodySchema>
