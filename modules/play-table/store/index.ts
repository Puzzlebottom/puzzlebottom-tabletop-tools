import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'

export interface PlayTable {
  id: string
  gmUserId: string
  inviteCode: string
  createdAt: string
  deletedAt: string | null
}

export interface Player {
  id: string
  playTableId: string
  characterName: string
  initiativeModifier: number
  createdAt?: string
  deletedAt: string | null
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

export function createPlayTableStore(
  config: PlayTableStoreConfig
): IPlayTableStore {
  const { tableName, dynamoClient } = config
  const client = dynamoClient ?? new DynamoDBClient({})

  return {
    async getPlayTable(playTableId: string): Promise<PlayTable | null> {
      const result = await client.send(
        new GetItemCommand({
          TableName: tableName,
          Key: marshall({ PK: `PLAYTABLE#${playTableId}`, SK: 'METADATA' }),
        })
      )
      if (!result.Item) return null
      const item = unmarshall(result.Item) as PlayTable
      return {
        id: item.id,
        gmUserId: item.gmUserId,
        inviteCode: item.inviteCode,
        createdAt: item.createdAt,
        deletedAt: null,
      }
    },

    async getPlayer(
      playTableId: string,
      playerId: string
    ): Promise<Player | null> {
      const result = await client.send(
        new GetItemCommand({
          TableName: tableName,
          Key: marshall({
            PK: `PLAYTABLE#${playTableId}`,
            SK: `PLAYER#${playerId}`,
          }),
        })
      )
      if (!result.Item) return null
      const item = unmarshall(result.Item) as Player
      return {
        id: item.id,
        playTableId: playTableId,
        characterName: item.characterName,
        initiativeModifier: item.initiativeModifier,
        ...(item.createdAt !== undefined && { createdAt: item.createdAt }),
        deletedAt: null,
      }
    },

    async listPlayers(playTableId: string): Promise<Player[]> {
      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: marshall({
            ':pk': `PLAYTABLE#${playTableId}`,
            ':sk': 'PLAYER#',
          }),
        })
      )
      return (result.Items ?? []).map((i) => {
        const p = unmarshall(i) as Player
        return {
          id: p.id,
          playTableId: playTableId,
          characterName: p.characterName,
          initiativeModifier: p.initiativeModifier,
          ...(p.createdAt !== undefined && { createdAt: p.createdAt }),
          deletedAt: null,
        }
      })
    },

    async getPlayTableByInviteCode(
      inviteCode: string
    ): Promise<PlayTable | null> {
      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'GSI2',
          KeyConditionExpression: 'GSI2PK = :pk AND GSI2SK = :sk',
          ExpressionAttributeValues: marshall({
            ':pk': `INVITECODE#${inviteCode.toUpperCase()}`,
            ':sk': 'PLAYTABLE',
          }),
          Limit: 1,
        })
      )
      const items = result.Items ?? []
      if (items.length === 0) return null
      const item = unmarshall(items[0]) as PlayTable
      return {
        id: item.id,
        gmUserId: item.gmUserId,
        inviteCode: item.inviteCode,
        createdAt: item.createdAt,
        deletedAt: null,
      }
    },

    async putPlayTable(playTable: PlayTable): Promise<void> {
      await client.send(
        new PutItemCommand({
          TableName: tableName,
          Item: marshall(
            {
              PK: `PLAYTABLE#${playTable.id}`,
              SK: 'METADATA',
              GSI1PK: `GM#${playTable.gmUserId}`,
              GSI1SK: playTable.createdAt,
              GSI2PK: `INVITECODE#${playTable.inviteCode.toUpperCase()}`,
              GSI2SK: 'PLAYTABLE',
              ...playTable,
            },
            { removeUndefinedValues: true }
          ),
        })
      )
    },

    async putPlayer(playTableId: string, player: Player): Promise<void> {
      await client.send(
        new PutItemCommand({
          TableName: tableName,
          Item: marshall(
            {
              PK: `PLAYTABLE#${playTableId}`,
              SK: `PLAYER#${player.id}`,
              ...player,
            },
            { removeUndefinedValues: true }
          ),
        })
      )
    },

    async deletePlayer(playTableId: string, playerId: string): Promise<void> {
      await client.send(
        new DeleteItemCommand({
          TableName: tableName,
          Key: marshall({
            PK: `PLAYTABLE#${playTableId}`,
            SK: `PLAYER#${playerId}`,
          }),
        })
      )
    },
  }
}
