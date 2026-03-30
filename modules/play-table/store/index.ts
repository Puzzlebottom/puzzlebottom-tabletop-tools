import type { DynamoDBClient } from '@aws-sdk/client-dynamodb'

export interface PlayTable {
  id: string
  gmUserId: string
  inviteCode: string
  createdAt: string
}

export interface Player {
  id: string
  characterName: string
  initiativeModifier: number
  createdAt?: string
  deletedAt?: string
}

export interface IPlayTableStore {
  getPlayTable(playTableId: string): Promise<PlayTable | null>
  getPlayer(playTableId: string, playerId: string): Promise<Player | null>
  listPlayers(playTableId: string): Promise<Player[]>
  getPlayTableByInviteCode(inviteCode: string): Promise<PlayTable | null>
  putPlayTable(playTable: PlayTable): Promise<void>
  putPlayer(playTableId: string, player: Player): Promise<void>
  deletePlayer(playTableId: string, playerId: string): Promise<void>
}

export interface PlayTableStoreConfig {
  tableName: string
  dynamoClient?: DynamoDBClient
}

export declare function createPlayTableStore(
  config: PlayTableStoreConfig
): IPlayTableStore
