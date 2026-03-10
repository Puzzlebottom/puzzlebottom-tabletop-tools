import {
  PaginatedRollsSchema,
  PlayTableSchema,
} from '@puzzlebottom-tabletop-tools/graphql-types'
import * as z from 'zod'

/** Validates playTableByInviteCode query response. */
export const playTableByInviteCodeResponseSchema = z.object({
  data: z
    .object({
      playTableByInviteCode: PlayTableSchema().nullish(),
    })
    .nullish(),
})

/** Validates playTable query response. */
export const playTableResponseSchema = z.object({
  data: z
    .object({
      playTable: PlayTableSchema().nullish(),
    })
    .nullish(),
})

/** Validates rollHistory query response. */
export const rollHistoryResponseSchema = z.object({
  data: z
    .object({
      rollHistory: PaginatedRollsSchema().nullish(),
    })
    .nullish(),
})

/** Validates joinPlayTable mutation response. */
export const joinPlayTableResponseSchema = z.object({
  data: z
    .object({
      joinPlayTable: PlayTableSchema(),
    })
    .nullish(),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
})

export type PlayTableByInviteCodeResponse = z.infer<
  typeof playTableByInviteCodeResponseSchema
>
export type PlayTableResponse = z.infer<typeof playTableResponseSchema>
export type RollHistoryResponse = z.infer<typeof rollHistoryResponseSchema>
export type JoinPlayTableResponse = z.infer<typeof joinPlayTableResponseSchema>
