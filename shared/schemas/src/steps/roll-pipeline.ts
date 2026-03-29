import { z } from 'zod'

export const GenerateAndStoreRollPayload = z.object({
  rollId: z.string(),
  playTableId: z.string(),
  roller: z.object({
    type: z.enum(['gm', 'player']),
    rollerId: z.string(),
  }),
  rollNotation: z.string(),
  modifier: z.number(),
  isPrivate: z.boolean(),
  rollRequestId: z.string().nullable().optional(),
  rollRequestType: z.enum(['ad_hoc', 'initiative']),
})

export type GenerateAndStoreRollPayload = z.infer<
  typeof GenerateAndStoreRollPayload
>
