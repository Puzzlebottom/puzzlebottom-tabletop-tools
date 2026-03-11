import { z } from 'zod'

/** EventBridge source for pipeline events. Add new sources here when extending. */
export const EVENT_SOURCE = 'puzzlebottom-tabletop-tools' as const
export type EventSource = typeof EVENT_SOURCE

/** EventBridge detail types for dice roller events. */
export const DETAIL_TYPE_ROLL_COMPLETED = 'RollCompleted' as const
export const DETAIL_TYPE_ROLL_REQUEST_COMPLETED =
  'RollRequestCompleted' as const
export const DETAIL_TYPE_PLAYER_LEFT = 'PlayerLeft' as const
export const DETAIL_TYPE_PLAYER_JOINED = 'PlayerJoined' as const

export type EventDetailType =
  | typeof DETAIL_TYPE_ROLL_COMPLETED
  | typeof DETAIL_TYPE_ROLL_REQUEST_COMPLETED
  | typeof DETAIL_TYPE_PLAYER_LEFT
  | typeof DETAIL_TYPE_PLAYER_JOINED

/** RollCompleted event detail (from createRoll / roll pipeline). Aligns with GraphQL Roll type. */
export const RollCompletedDetailSchema = z.object({
  playTableId: z.string(),
  rollId: z.string(),
  rollRequestId: z.string().nullish(),
  type: z.enum(['initiative']).nullish(),
  rollerId: z.string(),
  rollNotation: z.string(),
  values: z.array(z.number()),
  modifier: z.number(),
  rollResult: z.number(),
  isPrivate: z.boolean(),
  createdAt: z.string(),
  deletedAt: z.string().nullish(),
})

export type RollCompletedDetail = z.infer<typeof RollCompletedDetailSchema>

/** RollRequestCompleted event detail (from Roll Request Step Function when all players have rolled). */
export const RollRequestCompletedDetailSchema = z.object({
  playTableId: z.string(),
  rollRequestId: z.string(),
  type: z.enum(['initiative']),
  timestamps: z.object({
    createdAt: z.string(),
    completedAt: z.string(),
  }),
  playerIds: z.array(z.string()),
  rollIds: z.array(z.string()),
  initiatedBy: z.string(),
})

export type RollRequestCompletedDetail = z.infer<
  typeof RollRequestCompletedDetailSchema
>

/** PlayerLeft event detail (from leavePlayTable Lambda). */
export const PlayerLeftDetailSchema = z.object({
  playTableId: z.string(),
  id: z.string(),
})

export type PlayerLeftDetail = z.infer<typeof PlayerLeftDetailSchema>

/** PlayerJoined event detail (from joinPlayTable Lambda). */
export const PlayerJoinedDetailSchema = z.object({
  playTableId: z.string(),
  id: z.string(),
  characterName: z.string(),
  initiativeModifier: z.number(),
})

export type PlayerJoinedDetail = z.infer<typeof PlayerJoinedDetailSchema>

/** Discriminated union of all event details with their detail-type. */
export const EventDetailSchema = z.discriminatedUnion('detailType', [
  z.object({
    detailType: z.literal(DETAIL_TYPE_ROLL_COMPLETED),
    detail: RollCompletedDetailSchema,
  }),
  z.object({
    detailType: z.literal(DETAIL_TYPE_ROLL_REQUEST_COMPLETED),
    detail: RollRequestCompletedDetailSchema,
  }),
  z.object({
    detailType: z.literal(DETAIL_TYPE_PLAYER_LEFT),
    detail: PlayerLeftDetailSchema,
  }),
  z.object({
    detailType: z.literal(DETAIL_TYPE_PLAYER_JOINED),
    detail: PlayerJoinedDetailSchema,
  }),
])

export type EventDetail = z.infer<typeof EventDetailSchema>

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
 * Parses an EventBridge envelope and returns typed detail based on detail-type.
 * Throws if detail-type is unknown or detail fails validation.
 */
export function parseEventDetail(envelope: EventBridgeEnvelope): EventDetail {
  const detailType = envelope['detail-type']
  const detail = envelope.detail

  switch (detailType) {
    case DETAIL_TYPE_ROLL_COMPLETED:
      return {
        detailType,
        detail: RollCompletedDetailSchema.parse(detail),
      }
    case DETAIL_TYPE_ROLL_REQUEST_COMPLETED:
      return {
        detailType,
        detail: RollRequestCompletedDetailSchema.parse(detail),
      }
    case DETAIL_TYPE_PLAYER_LEFT:
      return {
        detailType,
        detail: PlayerLeftDetailSchema.parse(detail),
      }
    case DETAIL_TYPE_PLAYER_JOINED:
      return {
        detailType,
        detail: PlayerJoinedDetailSchema.parse(detail),
      }
    default:
      throw new Error(`Unknown detail-type: ${detailType}`)
  }
}

/** Alias for EventBridgeEnvelopeSchema. Validates SQS message body (EventBridge envelope). */
export const EventBridgeEventBodySchema = EventBridgeEnvelopeSchema

/** Alias for EventBridgeEnvelope. */
export type EventBridgeEventBody = EventBridgeEnvelope
