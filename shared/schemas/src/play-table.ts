import { z } from 'zod'

export const PlayTableSchema = z.object({
  id: z.string(),
  gmUserId: z.string(),
  inviteCode: z.string(),
  createdAt: z.string(),
})

export type PlayTable = z.infer<typeof PlayTableSchema>
