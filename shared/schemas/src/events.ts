import { z } from 'zod'

import { DataRecordSchema } from './data-record'

/** EventBridge source for pipeline events. Add new sources here when extending. */
export const EVENT_SOURCE = 'data-pipeline' as const
export type EventSource = typeof EVENT_SOURCE

/** EventBridge detail types for pipeline events. Add new types here when extending. */
export const DETAIL_TYPE_DATA_SUBMITTED = 'DataSubmitted' as const
export type EventDetailType = typeof DETAIL_TYPE_DATA_SUBMITTED

/** EventBridge event body structure when delivered to SQS. */
export const EventBridgeEventBodySchema = z.object({
  detail: DataRecordSchema,
})

export type EventBridgeEventBody = z.infer<typeof EventBridgeEventBodySchema>
