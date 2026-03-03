import { z } from 'zod'

import { RollRequestTypeSchema } from './roll-request'

export const RollerTypeSchema = z.enum(['gm', 'player'])
export type RollerType = z.infer<typeof RollerTypeSchema>

/** Who can see the roll result: all (everyone) or gm_only (GM and sometimes the rolling player). */
export const VisibilitySchema = z.enum(['all', 'gm_only'])
export type Visibility = z.infer<typeof VisibilitySchema>

export const RollSchema = z.object({
  id: z.string(),
  playTableId: z.string(),
  rollerId: z.string(),
  rollerType: RollerTypeSchema,
  diceType: z.string(),
  /** Raw die face values, e.g. [15] for d20, [15, 8] for 2d20kh1, [4, 6] for 2d6. */
  values: z.array(z.number()).min(1),
  modifier: z.number(),
  total: z.number(),
  advantage: z.enum(['advantage', 'disadvantage']).nullable(),
  dc: z.number().nullable(),
  success: z.boolean().nullable(),
  visibility: VisibilitySchema,
  rollRequestType: RollRequestTypeSchema,
  rollRequestId: z.string().optional(),
  createdAt: z.string(),
})

export type Roll = z.infer<typeof RollSchema>
