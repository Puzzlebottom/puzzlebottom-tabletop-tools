import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'

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

export function createDiceRollerStore(
  config: DiceRollerStoreConfig
): IDiceRollerStore {
  const { tableName, dynamoClient } = config
  const client = dynamoClient ?? new DynamoDBClient({})

  return {
    async getRollRequest(
      playTableId: string,
      rollRequestId: string
    ): Promise<RollRequest | null> {
      const result = await client.send(
        new GetItemCommand({
          TableName: tableName,
          Key: marshall({
            PK: `PLAYTABLE#${playTableId}`,
            SK: `ROLLREQUEST#${rollRequestId}`,
          }),
        })
      )
      if (!result.Item) return null
      const item = unmarshall(result.Item) as RollRequest
      return {
        id: item.id,
        playTableId: item.playTableId,
        targetPlayerIds: item.targetPlayerIds,
        rollNotation: item.rollNotation,
        type: item.type,
        dc: item.dc,
        isPrivate: item.isPrivate,
        createdAt: item.createdAt,
        deletedAt: item.deletedAt,
        ...(item.taskToken !== undefined && { taskToken: item.taskToken }),
      }
    },

    async getActiveRollRequest(
      playTableId: string
    ): Promise<RollRequest | null> {
      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'GSI4',
          KeyConditionExpression: 'GSI4PK = :pk',
          ExpressionAttributeValues: marshall({
            ':pk': `ACTIVE#${playTableId}`,
          }),
          Limit: 1,
        })
      )
      const items = result.Items ?? []
      if (items.length === 0) return null
      const item = unmarshall(items[0]) as RollRequest
      return {
        id: item.id,
        playTableId: item.playTableId,
        targetPlayerIds: item.targetPlayerIds,
        rollNotation: item.rollNotation,
        type: item.type,
        dc: item.dc,
        isPrivate: item.isPrivate,
        createdAt: item.createdAt,
        deletedAt: item.deletedAt,
        ...(item.taskToken !== undefined && { taskToken: item.taskToken }),
      }
    },

    async listRollsForRequest(
      playTableId: string,
      rollRequestId: string
    ): Promise<Roll[]> {
      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'GSI5',
          KeyConditionExpression: 'GSI5PK = :pk',
          ExpressionAttributeValues: marshall({
            ':pk': `ROLLREQUEST#${playTableId}#${rollRequestId}`,
          }),
        })
      )
      return (result.Items ?? []).map((i) => {
        const r = unmarshall(i) as Roll
        return {
          id: r.id,
          playTableId: r.playTableId,
          rollerId: r.rollerId,
          rollNotation: r.rollNotation,
          type: r.type,
          values: r.values,
          modifier: r.modifier,
          rollResult: r.rollResult,
          isPrivate: r.isPrivate,
          rollRequestId: r.rollRequestId,
          createdAt: r.createdAt,
          deletedAt: r.deletedAt,
        }
      })
    },

    async addPlayerToRollRequest(
      playTableId: string,
      rollRequestId: string,
      playerId: string
    ): Promise<void> {
      await client.send(
        new UpdateItemCommand({
          TableName: tableName,
          Key: marshall({
            PK: `PLAYTABLE#${playTableId}`,
            SK: `ROLLREQUEST#${rollRequestId}`,
          }),
          UpdateExpression:
            'SET targetPlayerIds = list_append(targetPlayerIds, :p)',
          ExpressionAttributeValues: marshall({ ':p': [playerId] }),
        })
      )
    },

    async removePlayerFromActiveRollRequest(
      playTableId: string,
      playerId: string
    ): Promise<void> {
      const active = await this.getActiveRollRequest(playTableId)
      if (!active) return
      const updated = active.targetPlayerIds.filter((id) => id !== playerId)
      await client.send(
        new UpdateItemCommand({
          TableName: tableName,
          Key: marshall({
            PK: `PLAYTABLE#${playTableId}`,
            SK: `ROLLREQUEST#${active.id}`,
          }),
          UpdateExpression: 'SET targetPlayerIds = :t',
          ExpressionAttributeValues: marshall({ ':t': updated }),
        })
      )
    },

    async putRollRequest(rollRequest: RollRequest): Promise<void> {
      await client.send(
        new PutItemCommand({
          TableName: tableName,
          Item: marshall(
            {
              PK: `PLAYTABLE#${rollRequest.playTableId}`,
              SK: `ROLLREQUEST#${rollRequest.id}`,
              activePK: `ACTIVE#${rollRequest.playTableId}`,
              ...rollRequest,
            },
            { removeUndefinedValues: true }
          ),
        })
      )
    },

    async putRoll(roll: Roll): Promise<void> {
      await client.send(
        new PutItemCommand({
          TableName: tableName,
          Item: marshall(
            {
              PK: `PLAYTABLE#${roll.playTableId}`,
              SK: `ROLL#${roll.id}`,
              ...(roll.rollRequestId !== null && {
                rollRequestPK: `ROLLREQUEST#${roll.playTableId}#${roll.rollRequestId}`,
              }),
              ...roll,
            },
            { removeUndefinedValues: true }
          ),
        })
      )
    },

    async setRollRequestTaskToken(
      playTableId: string,
      rollRequestId: string,
      taskToken: string
    ): Promise<void> {
      await client.send(
        new UpdateItemCommand({
          TableName: tableName,
          Key: marshall({
            PK: `PLAYTABLE#${playTableId}`,
            SK: `ROLLREQUEST#${rollRequestId}`,
          }),
          UpdateExpression: 'SET taskToken = :t',
          ExpressionAttributeValues: marshall({ ':t': taskToken }),
        })
      )
    },

    async clearRollRequest(
      playTableId: string,
      rollRequestId: string
    ): Promise<void> {
      await client.send(
        new UpdateItemCommand({
          TableName: tableName,
          Key: marshall({
            PK: `PLAYTABLE#${playTableId}`,
            SK: `ROLLREQUEST#${rollRequestId}`,
          }),
          UpdateExpression: 'SET deletedAt = :d REMOVE activePK',
          ExpressionAttributeValues: marshall({
            ':d': new Date().toISOString(),
          }),
        })
      )
    },

    async isRollRequestFulfilled(
      playTableId: string,
      rollRequestId: string
    ): Promise<boolean> {
      const rollRequest = await this.getRollRequest(playTableId, rollRequestId)
      if (!rollRequest) return false
      const rolls = await this.listRollsForRequest(playTableId, rollRequestId)
      const rollerIds = new Set(rolls.map((r) => r.rollerId))
      return rollRequest.targetPlayerIds.every((id) => rollerIds.has(id))
    },
  }
}
