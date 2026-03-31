import type { AttributeValue, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { describe, expect, it, vi } from 'vitest'

import { createPlayTableStore } from './index.js'

const TABLE_NAME = 'test-table'

interface MockCommand {
  input: Record<string, Record<string, AttributeValue>>
}

function makeClient(...responses: unknown[]) {
  const send = vi.fn()
  for (const r of responses) send.mockResolvedValueOnce(r)
  return { client: { send } as unknown as DynamoDBClient, send }
}

describe('PlayTableStore', () => {
  describe('getPlayTable', () => {
    it('returns PlayTable when found', async () => {
      const { client } = makeClient({
        Item: marshall({
          id: 'pt-1',
          gmUserId: 'gm-1',
          inviteCode: 'ABC123',
          createdAt: '2025-01-01T00:00:00.000Z',
        }),
      })
      const store = createPlayTableStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      expect(await store.getPlayTable('pt-1')).toEqual({
        id: 'pt-1',
        gmUserId: 'gm-1',
        inviteCode: 'ABC123',
        createdAt: '2025-01-01T00:00:00.000Z',
        deletedAt: null,
      })
    })

    it('returns null when not found', async () => {
      const { client } = makeClient({})
      const store = createPlayTableStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      expect(await store.getPlayTable('pt-1')).toBeNull()
    })
  })

  describe('getPlayTableByInviteCode', () => {
    it('returns PlayTable when invite code matches', async () => {
      const { client } = makeClient({
        Items: [
          marshall({
            id: 'pt-1',
            gmUserId: 'gm-1',
            inviteCode: 'ABC123',
            createdAt: '2025-01-01T00:00:00.000Z',
          }),
        ],
      })
      const store = createPlayTableStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      expect(await store.getPlayTableByInviteCode('ABC123')).toEqual({
        id: 'pt-1',
        gmUserId: 'gm-1',
        inviteCode: 'ABC123',
        createdAt: '2025-01-01T00:00:00.000Z',
        deletedAt: null,
      })
    })

    it('returns null when no match', async () => {
      const { client } = makeClient({ Items: [] })
      const store = createPlayTableStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      expect(await store.getPlayTableByInviteCode('XXXXXX')).toBeNull()
    })

    it('normalises lowercase input to uppercase before querying', async () => {
      const { client, send } = makeClient({ Items: [] })
      const store = createPlayTableStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      await store.getPlayTableByInviteCode('abc123')
      const [command] = send.mock.calls[0] as [MockCommand]
      const values = unmarshall(command.input.ExpressionAttributeValues)
      expect(values[':pk']).toBe('INVITECODE#ABC123')
    })
  })

  describe('listPlayers', () => {
    it('returns all players for a table', async () => {
      const { client } = makeClient({
        Items: [
          marshall({
            id: 'p-1',
            characterName: 'Frodo',
            initiativeModifier: 2,
          }),
          marshall({
            id: 'p-2',
            characterName: 'Gandalf',
            initiativeModifier: 5,
          }),
        ],
      })
      const store = createPlayTableStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      const result = await store.listPlayers('pt-1')
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        id: 'p-1',
        characterName: 'Frodo',
        initiativeModifier: 2,
        playTableId: 'pt-1',
        deletedAt: null,
      })
      expect(result[1]).toMatchObject({
        id: 'p-2',
        characterName: 'Gandalf',
        initiativeModifier: 5,
        playTableId: 'pt-1',
        deletedAt: null,
      })
    })

    it('returns empty array when no players', async () => {
      const { client } = makeClient({ Items: [] })
      const store = createPlayTableStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      expect(await store.listPlayers('pt-1')).toEqual([])
    })
  })

  describe('getPlayer', () => {
    it('returns Player when found', async () => {
      const { client } = makeClient({
        Item: marshall({
          id: 'p-1',
          characterName: 'Frodo',
          initiativeModifier: 2,
          createdAt: '2025-01-01T00:00:00.000Z',
        }),
      })
      const store = createPlayTableStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      expect(await store.getPlayer('pt-1', 'p-1')).toEqual({
        id: 'p-1',
        characterName: 'Frodo',
        initiativeModifier: 2,
        createdAt: '2025-01-01T00:00:00.000Z',
        playTableId: 'pt-1',
        deletedAt: null,
      })
    })

    it('returns null when not found', async () => {
      const { client } = makeClient({})
      const store = createPlayTableStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      expect(await store.getPlayer('pt-1', 'p-1')).toBeNull()
    })
  })

  describe('deletePlayer', () => {
    it('deletes player with correct PK/SK', async () => {
      const { client, send } = makeClient({})
      const store = createPlayTableStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      await store.deletePlayer('pt-1', 'p-1')
      const [command] = send.mock.calls[0] as [MockCommand]
      const key = unmarshall(command.input.Key)
      expect(key.PK).toBe('PLAYTABLE#pt-1')
      expect(key.SK).toBe('PLAYER#p-1')
    })
  })

  describe('putPlayer', () => {
    it('writes Player with correct PK/SK', async () => {
      const { client, send } = makeClient({})
      const store = createPlayTableStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      await store.putPlayer('pt-1', {
        id: 'p-1',
        playTableId: 'pt-1',
        characterName: 'Frodo',
        initiativeModifier: 2,
        createdAt: '2025-01-01T00:00:00.000Z',
        deletedAt: null,
      })
      const [command] = send.mock.calls[0] as [MockCommand]
      const item = unmarshall(command.input.Item)
      expect(item.PK).toBe('PLAYTABLE#pt-1')
      expect(item.SK).toBe('PLAYER#p-1')
      expect(item.characterName).toBe('Frodo')
      expect(item.initiativeModifier).toBe(2)
      expect(item.playTableId).toBe('pt-1')
    })
  })

  describe('putPlayTable', () => {
    it('writes PlayTable with correct PK/SK and GSI keys', async () => {
      const { client, send } = makeClient({})
      const store = createPlayTableStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      await store.putPlayTable({
        id: 'pt-1',
        gmUserId: 'gm-1',
        inviteCode: 'ABC123',
        createdAt: '2025-01-01T00:00:00.000Z',
        deletedAt: null,
      })
      const [command] = send.mock.calls[0] as [MockCommand]
      const item = unmarshall(command.input.Item)
      expect(item.PK).toBe('PLAYTABLE#pt-1')
      expect(item.SK).toBe('METADATA')
      expect(item.GSI1PK).toBe('GM#gm-1')
      expect(item.GSI1SK).toBe('2025-01-01T00:00:00.000Z')
      expect(item.GSI2PK).toBe('INVITECODE#ABC123')
    })

    it('normalises inviteCode to uppercase in GSI2PK', async () => {
      const { client, send } = makeClient({})
      const store = createPlayTableStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      await store.putPlayTable({
        id: 'pt-1',
        gmUserId: 'gm-1',
        inviteCode: 'abc123',
        createdAt: '2025-01-01T00:00:00.000Z',
        deletedAt: null,
      })
      const [command] = send.mock.calls[0] as [MockCommand]
      const item = unmarshall(command.input.Item)
      expect(item.GSI2PK).toBe('INVITECODE#ABC123')
      expect(item.GSI2SK).toBe('PLAYTABLE')
      expect(item.id).toBe('pt-1')
    })
  })
})
