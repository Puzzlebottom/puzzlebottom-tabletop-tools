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
  type RollerType,
  RollerTypeSchema,
  type RollRequest,
  RollRequestSchema as rollRequestSchemaFn,
  type RollRequestType,
  RollRequestTypeSchema,
  RollSchema as rollSchemaFn,
  type Visibility,
  VisibilitySchema,
} from '@puzzlebottom-tabletop-tools/graphql-types'

export const PlayTableSchema = playTableSchemaFn()
export const PlayerSchema = playerSchemaFn()
export const RollSchema = rollSchemaFn()
export const RollRequestSchema = rollRequestSchemaFn()

export { RollerTypeSchema, RollRequestTypeSchema, VisibilitySchema }
export type {
  Player,
  PlayTable,
  Roll,
  RollerType,
  RollRequest,
  RollRequestType,
  Visibility,
}
