/**
 * Domain schemas generated from GraphQL. Re-exports from graphql-types with
 * function-based schemas wrapped as const for backward compatibility.
 */
import {
  type Player,
  PlayerSchema as playerSchemaFn,
  type PlayTable,
  PlayTableSchema as playTableSchemaFn,
  type Roll,
  type RollRequest,
  RollRequestSchema as rollRequestSchemaFn,
  RollSchema as rollSchemaFn,
  type RollType,
  RollTypeSchema,
} from '@puzzlebottom-tabletop-tools/graphql-types'

export const PlayTableSchema = playTableSchemaFn()
export const PlayerSchema = playerSchemaFn()
export const RollSchema = rollSchemaFn()
export const RollRequestSchema = rollRequestSchemaFn()

export { RollTypeSchema }
export type { Player, PlayTable, Roll, RollRequest, RollType }
