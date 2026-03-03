import { z } from 'zod'

export const RollRequestTypeSchema = z.enum(['ad_hoc', 'initiative'])
export type RollRequestType = z.infer<typeof RollRequestTypeSchema>

export const RollRequestSchema = z.object({
  id: z.string(),
  playTableId: z.string(),
  targetPlayerIds: z.array(z.string()),
  type: RollRequestTypeSchema,
  dc: z.number().optional(),
  advantage: z.string().optional(),
  isPrivate: z.boolean(),
  status: z.string(),
  createdAt: z.string(),
})

export type RollRequest = z.infer<typeof RollRequestSchema>
