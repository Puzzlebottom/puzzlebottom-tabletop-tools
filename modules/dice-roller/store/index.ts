import type { DynamoDBClient } from '@aws-sdk/client-dynamodb'

export interface RollRequest {
  id: string
  playTableId: string
  targetPlayerIds: string[]
  rollNotation: string
  type: 'initiative'
  dc: number | null
  isPrivate: boolean
  createdAt: string
  deletedAt: string | null
  taskToken?: string
}

export interface Roll {
  id: string
  playTableId: string
  rollerId: string
  rollNotation: string
  type: 'initiative' | null
  values: number[]
  modifier: number
  rollResult: number
  isPrivate: boolean
  rollRequestId: string | null
  createdAt: string
  deletedAt: string | null
}

export interface IDiceRollerStore {
  getActiveRollRequest(playTableId: string): Promise<RollRequest | null>
  getRollRequest(
    playTableId: string,
    rollRequestId: string
  ): Promise<RollRequest | null>
  listRollsForRequest(
    playTableId: string,
    rollRequestId: string
  ): Promise<Roll[]>
  addPlayerToRollRequest(
    playTableId: string,
    rollRequestId: string,
    playerId: string
  ): Promise<void>
  removePlayerFromActiveRollRequest(
    playTableId: string,
    playerId: string
  ): Promise<void>
  putRollRequest(rollRequest: RollRequest): Promise<void>
  putRoll(roll: Roll): Promise<void>
  setRollRequestTaskToken(
    playTableId: string,
    rollRequestId: string,
    taskToken: string
  ): Promise<void>
  clearRollRequest(playTableId: string, rollRequestId: string): Promise<void>
  isRollRequestFulfilled(
    playTableId: string,
    rollRequestId: string
  ): Promise<boolean>
}

export interface DiceRollerStoreConfig {
  tableName: string
  dynamoClient?: DynamoDBClient
}

export declare function createDiceRollerStore(
  config: DiceRollerStoreConfig
): IDiceRollerStore
