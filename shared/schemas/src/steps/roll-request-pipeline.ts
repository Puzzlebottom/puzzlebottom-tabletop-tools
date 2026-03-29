import { z } from 'zod'

export const RollRequestStepPayload = z.object({
  playTableId: z.string(),
  rollRequestId: z.string(),
  targetPlayerIds: z.array(z.string()),
  rollNotation: z.string(),
  type: z.enum(['initiative']),
  dc: z.number().nullable().optional(),
  isPrivate: z.boolean(),
  createdAt: z.string(),
})

export type RollRequestStepPayload = z.infer<typeof RollRequestStepPayload>

export const InitiativeCreateHandlerPayload = RollRequestStepPayload.extend({
  taskToken: z.string(),
})

export type InitiativeCreateHandlerPayload = z.infer<
  typeof InitiativeCreateHandlerPayload
>
