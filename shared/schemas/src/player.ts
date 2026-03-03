import { z } from 'zod'

export const PlayerSchema = z.object({
  id: z.string(),
  characterName: z.string(),
  initiativeModifier: z.number(),
})

export type Player = z.infer<typeof PlayerSchema>
