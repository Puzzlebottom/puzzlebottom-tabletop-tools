import type { AttributeValue, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { describe, expect, it, vi } from 'vitest'

import { createDiceRollerStore } from './index.js'

const TABLE_NAME = 'test-table'

interface MockCommand {
  input: Record<string, unknown>
}

function makeClient(...responses: unknown[]) {
  const send = vi.fn()
  for (const r of responses) send.mockResolvedValueOnce(r)
  return { client: { send } as unknown as DynamoDBClient, send }
}

function marshalledRollRequest(overrides: Record<string, unknown> = {}) {
  return marshall({
    id: 'rr-1',
    playTableId: 'pt-1',
    targetPlayerIds: ['p-1', 'p-2'],
    rollNotation: '1d20',
    type: 'initiative',
    dc: null,
    isPrivate: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  })
}

function marshalledRoll(overrides: Record<string, unknown> = {}) {
  return marshall({
    id: 'roll-1',
    playTableId: 'pt-1',
    rollerId: 'p-1',
    rollNotation: '1d20',
    type: 'initiative',
    values: [15],
    modifier: 2,
    rollResult: 17,
    isPrivate: false,
    rollRequestId: 'rr-1',
    createdAt: '2025-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  })
}

describe('DiceRollerStore', () => {
  describe('isRollRequestFulfilled', () => {
    it('returns true when all target players have rolled', async () => {
      const { client } = makeClient(
        { Item: marshalledRollRequest({ targetPlayerIds: ['p-1', 'p-2'] }) },
        {
          Items: [
            marshalledRoll({ rollerId: 'p-1' }),
            marshalledRoll({ rollerId: 'p-2' }),
          ],
        }
      )
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      expect(await store.isRollRequestFulfilled('pt-1', 'rr-1')).toBe(true)
    })

    it('returns false when not all target players have rolled', async () => {
      const { client } = makeClient(
        { Item: marshalledRollRequest({ targetPlayerIds: ['p-1', 'p-2'] }) },
        { Items: [marshalledRoll({ rollerId: 'p-1' })] }
      )
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      expect(await store.isRollRequestFulfilled('pt-1', 'rr-1')).toBe(false)
    })

    it('returns false when roll request not found', async () => {
      const { client } = makeClient({})
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      expect(await store.isRollRequestFulfilled('pt-1', 'rr-1')).toBe(false)
    })
  })

  describe('removePlayerFromActiveRollRequest', () => {
    it('removes player from targetPlayerIds of the active roll request', async () => {
      const { client, send } = makeClient(
        { Items: [marshalledRollRequest({ targetPlayerIds: ['p-1', 'p-2'] })] },
        {}
      )
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      await store.removePlayerFromActiveRollRequest('pt-1', 'p-1')
      const [, updateCommand] = send.mock.calls as [MockCommand, MockCommand][]
      const eav = unmarshall(
        updateCommand[0].input.ExpressionAttributeValues as Record<
          string,
          AttributeValue
        >
      )
      expect(eav[':t']).toEqual(['p-2'])
    })

    it('does nothing when no active roll request', async () => {
      const { client, send } = makeClient({ Items: [] })
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      await store.removePlayerFromActiveRollRequest('pt-1', 'p-1')
      expect(send).toHaveBeenCalledTimes(1)
    })
  })

  describe('clearRollRequest', () => {
    it('sets deletedAt and removes activePK', async () => {
      const { client, send } = makeClient({})
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      await store.clearRollRequest('pt-1', 'rr-1')
      const [command] = send.mock.calls[0] as [MockCommand]
      const key = unmarshall(
        command.input.Key as Record<string, AttributeValue>
      )
      expect(key.PK).toBe('PLAYTABLE#pt-1')
      expect(key.SK).toBe('ROLLREQUEST#rr-1')
      expect(command.input.UpdateExpression).toContain('SET deletedAt = :d')
      expect(command.input.UpdateExpression).toContain('REMOVE activePK')
    })
  })

  describe('addPlayerToRollRequest', () => {
    it('appends player to targetPlayerIds via list_append', async () => {
      const { client, send } = makeClient({})
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      await store.addPlayerToRollRequest('pt-1', 'rr-1', 'p-3')
      const [command] = send.mock.calls[0] as [MockCommand]
      const key = unmarshall(
        command.input.Key as Record<string, AttributeValue>
      )
      const eav = unmarshall(
        command.input.ExpressionAttributeValues as Record<
          string,
          AttributeValue
        >
      )
      expect(key.PK).toBe('PLAYTABLE#pt-1')
      expect(key.SK).toBe('ROLLREQUEST#rr-1')
      expect(command.input.UpdateExpression).toBe(
        'SET targetPlayerIds = list_append(targetPlayerIds, :p)'
      )
      expect(eav[':p']).toEqual(['p-3'])
    })
  })

  describe('setRollRequestTaskToken', () => {
    it('sets taskToken on roll request', async () => {
      const { client, send } = makeClient({})
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      await store.setRollRequestTaskToken('pt-1', 'rr-1', 'token-abc')
      const [command] = send.mock.calls[0] as [MockCommand]
      const key = unmarshall(
        command.input.Key as Record<string, AttributeValue>
      )
      const eav = unmarshall(
        command.input.ExpressionAttributeValues as Record<
          string,
          AttributeValue
        >
      )
      expect(key.PK).toBe('PLAYTABLE#pt-1')
      expect(key.SK).toBe('ROLLREQUEST#rr-1')
      expect(command.input.UpdateExpression).toBe('SET taskToken = :t')
      expect(eav[':t']).toBe('token-abc')
    })
  })

  describe('putRoll', () => {
    it('writes Roll with PK/SK and rollRequestPK when rollRequestId present', async () => {
      const { client, send } = makeClient({})
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      await store.putRoll({
        id: 'roll-1',
        playTableId: 'pt-1',
        rollerId: 'p-1',
        rollNotation: '1d20',
        type: 'initiative',
        values: [15],
        modifier: 2,
        rollResult: 17,
        isPrivate: false,
        rollRequestId: 'rr-1',
        createdAt: '2025-01-01T00:00:00.000Z',
        deletedAt: null,
      })
      const [command] = send.mock.calls[0] as [MockCommand]
      const item = unmarshall(
        command.input.Item as Record<string, AttributeValue>
      )
      expect(item.PK).toBe('PLAYTABLE#pt-1')
      expect(item.SK).toBe('ROLL#roll-1')
      expect(item.rollRequestPK).toBe('ROLLREQUEST#pt-1#rr-1')
    })

    it('omits rollRequestPK when rollRequestId is null', async () => {
      const { client, send } = makeClient({})
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      await store.putRoll({
        id: 'roll-1',
        playTableId: 'pt-1',
        rollerId: 'p-1',
        rollNotation: '1d20',
        type: null,
        values: [15],
        modifier: 2,
        rollResult: 17,
        isPrivate: false,
        rollRequestId: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        deletedAt: null,
      })
      const [command] = send.mock.calls[0] as [MockCommand]
      const item = unmarshall(
        command.input.Item as Record<string, AttributeValue>
      )
      expect(item.rollRequestPK).toBeUndefined()
    })
  })

  describe('putRollRequest', () => {
    it('writes RollRequest with PK/SK and activePK', async () => {
      const { client, send } = makeClient({})
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      await store.putRollRequest({
        id: 'rr-1',
        playTableId: 'pt-1',
        targetPlayerIds: ['p-1'],
        rollNotation: '1d20',
        type: 'initiative',
        dc: null,
        isPrivate: false,
        createdAt: '2025-01-01T00:00:00.000Z',
        deletedAt: null,
      })
      const [command] = send.mock.calls[0] as [MockCommand]
      const item = unmarshall(
        command.input.Item as Record<string, AttributeValue>
      )
      expect(item.PK).toBe('PLAYTABLE#pt-1')
      expect(item.SK).toBe('ROLLREQUEST#rr-1')
      expect(item.activePK).toBe('ACTIVE#pt-1')
      expect(item.id).toBe('rr-1')
    })
  })

  describe('listRollsForPlayTable', () => {
    it('returns all rolls for PK and ROLL# prefix, following pagination', async () => {
      const page1Key = { PK: { S: 'PLAYTABLE#pt-1' }, SK: { S: 'ROLL#roll-1' } }
      const send = vi.fn()
      send
        .mockResolvedValueOnce({
          Items: [
            marshalledRoll({
              id: 'roll-1',
              createdAt: '2025-01-01T00:00:00.000Z',
            }),
          ],
          LastEvaluatedKey: page1Key,
        })
        .mockResolvedValueOnce({
          Items: [
            marshalledRoll({
              id: 'roll-2',
              createdAt: '2025-01-02T00:00:00.000Z',
            }),
          ],
        })
      const client = { send } as unknown as DynamoDBClient
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      const result = await store.listRollsForPlayTable('pt-1')
      expect(send).toHaveBeenCalledTimes(2)
      expect(result.map((r) => r.id)).toEqual(['roll-1', 'roll-2'])
    })

    it('queries base table with PK and begins_with ROLL#', async () => {
      const { client, send } = makeClient({ Items: [] })
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      await store.listRollsForPlayTable('pt-1')
      const [command] = send.mock.calls[0] as [MockCommand]
      const eav = unmarshall(
        command.input.ExpressionAttributeValues as Record<
          string,
          AttributeValue
        >
      )
      expect(eav[':pk']).toBe('PLAYTABLE#pt-1')
      expect(eav[':sk']).toBe('ROLL#')
      expect(command.input.KeyConditionExpression).toContain('begins_with')
    })
  })

  describe('listRollsForRequest', () => {
    it('returns rolls for a request via GSI5', async () => {
      const { client } = makeClient({
        Items: [
          marshalledRoll({ id: 'roll-1', rollerId: 'p-1' }),
          marshalledRoll({ id: 'roll-2', rollerId: 'p-2' }),
        ],
      })
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      const result = await store.listRollsForRequest('pt-1', 'rr-1')
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({ id: 'roll-1', rollerId: 'p-1' })
      expect(result[1]).toMatchObject({ id: 'roll-2', rollerId: 'p-2' })
    })

    it('returns empty array when no rolls', async () => {
      const { client } = makeClient({ Items: [] })
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      expect(await store.listRollsForRequest('pt-1', 'rr-1')).toEqual([])
    })

    it('queries GSI5 with rollRequestPK', async () => {
      const { client, send } = makeClient({ Items: [] })
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      await store.listRollsForRequest('pt-1', 'rr-1')
      const [command] = send.mock.calls[0] as [MockCommand]
      const eav = unmarshall(
        command.input.ExpressionAttributeValues as Record<
          string,
          AttributeValue
        >
      )
      expect(eav[':pk']).toBe('ROLLREQUEST#pt-1#rr-1')
      expect(command.input.IndexName).toBe('GSI5')
    })
  })

  describe('getActiveRollRequest', () => {
    it('returns active RollRequest via GSI4', async () => {
      const { client } = makeClient({ Items: [marshalledRollRequest()] })
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      const result = await store.getActiveRollRequest('pt-1')
      expect(result).toMatchObject({ id: 'rr-1', playTableId: 'pt-1' })
    })

    it('returns null when no active request', async () => {
      const { client } = makeClient({ Items: [] })
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      expect(await store.getActiveRollRequest('pt-1')).toBeNull()
    })

    it('queries GSI4 with activePK', async () => {
      const { client, send } = makeClient({ Items: [] })
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      await store.getActiveRollRequest('pt-1')
      const [command] = send.mock.calls[0] as [MockCommand]
      const eav = unmarshall(
        command.input.ExpressionAttributeValues as Record<
          string,
          AttributeValue
        >
      )
      expect(eav[':pk']).toBe('ACTIVE#pt-1')
      expect(command.input.IndexName).toBe('GSI4')
    })
  })

  describe('getRollRequest', () => {
    it('returns RollRequest when found', async () => {
      const { client } = makeClient({ Item: marshalledRollRequest() })
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      expect(await store.getRollRequest('pt-1', 'rr-1')).toEqual({
        id: 'rr-1',
        playTableId: 'pt-1',
        targetPlayerIds: ['p-1', 'p-2'],
        rollNotation: '1d20',
        type: 'initiative',
        dc: null,
        isPrivate: false,
        createdAt: '2025-01-01T00:00:00.000Z',
        deletedAt: null,
      })
    })

    it('returns null when not found', async () => {
      const { client } = makeClient({})
      const store = createDiceRollerStore({
        tableName: TABLE_NAME,
        dynamoClient: client,
      })
      expect(await store.getRollRequest('pt-1', 'rr-1')).toBeNull()
    })
  })
})
