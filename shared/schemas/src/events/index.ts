/**
 * Event schemas. Detail types and Zod schemas are generated from infrastructure/lib/graphql/events.graphql.
 * This file provides envelope validation, parseEventDetail, and constants.
 */
import { z } from 'zod'

import {
  type EventDetail,
  EventDetailSchema as EventDetailSchemaFn,
  type EventDetailType,
  EventDetailTypeSchema,
  PlayerJoinedDetailSchema as PlayerJoinedDetailSchemaFn,
  PlayerLeftDetailSchema as PlayerLeftDetailSchemaFn,
  RollCompletedDetailSchema as RollCompletedDetailSchemaFn,
  RollRequestCompletedDetailSchema as RollRequestCompletedDetailSchemaFn,
} from './generated.js'

/** EventBridge source for pipeline events. Add new sources here when extending. */
export const EVENT_SOURCE = 'puzzlebottom-tabletop-tools' as const
export type EventSource = typeof EVENT_SOURCE

/** AWS detail-type values (EventBridge envelope). Match EventDetailType enum. */
export const DETAIL_TYPE_ROLL_COMPLETED = 'RollCompleted' as const
export const DETAIL_TYPE_ROLL_REQUEST_COMPLETED =
  'RollRequestCompleted' as const
export const DETAIL_TYPE_PLAYER_LEFT = 'PlayerLeft' as const
export const DETAIL_TYPE_PLAYER_JOINED = 'PlayerJoined' as const

export type { EventDetail, EventDetailType }

export const EventDetailSchema = EventDetailSchemaFn()
export const RollCompletedDetailSchema = RollCompletedDetailSchemaFn()
export const RollRequestCompletedDetailSchema =
  RollRequestCompletedDetailSchemaFn()
export const PlayerLeftDetailSchema = PlayerLeftDetailSchemaFn()
export const PlayerJoinedDetailSchema = PlayerJoinedDetailSchemaFn()

export { EventDetailTypeSchema }

export type {
  PlayerJoinedDetail,
  PlayerLeftDetail,
  RollCompletedDetail,
  RollRequestCompletedDetail,
} from './generated.js'

/** EventBridge event envelope when delivered to SQS. */
export const EventBridgeEnvelopeSchema = z.object({
  version: z.string(),
  id: z.string(),
  'detail-type': z.string(),
  source: z.string(),
  detail: z.unknown().refine((v) => v !== undefined, {
    message: 'detail is required',
  }),
})

export type EventBridgeEnvelope = z.infer<typeof EventBridgeEnvelopeSchema>

/**
 * Parses an EventBridge envelope and returns typed event with __typename (flat structure).
 * Throws if detail-type is unknown or detail fails validation.
 */
export function parseEventDetail(envelope: EventBridgeEnvelope): EventDetail {
  const awsDetailType = envelope['detail-type']
  const detail = envelope.detail

  switch (awsDetailType) {
    case DETAIL_TYPE_ROLL_COMPLETED: {
      const parsed = RollCompletedDetailSchema.parse(detail)
      return { ...parsed, __typename: 'RollCompletedDetail' as const }
    }
    case DETAIL_TYPE_ROLL_REQUEST_COMPLETED: {
      const parsed = RollRequestCompletedDetailSchema.parse(detail)
      return { ...parsed, __typename: 'RollRequestCompletedDetail' as const }
    }
    case DETAIL_TYPE_PLAYER_LEFT: {
      const parsed = PlayerLeftDetailSchema.parse(detail)
      return { ...parsed, __typename: 'PlayerLeftDetail' as const }
    }
    case DETAIL_TYPE_PLAYER_JOINED: {
      const parsed = PlayerJoinedDetailSchema.parse(detail)
      return { ...parsed, __typename: 'PlayerJoinedDetail' as const }
    }
    default:
      throw new Error(`Unknown detail-type: ${awsDetailType}`)
  }
}

/** Alias for EventBridgeEnvelopeSchema. Validates SQS message body (EventBridge envelope). */
export const EventBridgeEventBodySchema = EventBridgeEnvelopeSchema

/** Alias for EventBridgeEnvelope. */
export type EventBridgeEventBody = EventBridgeEnvelope
