import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppSyncEvent } from '../../../backend/test/appsync-event.js'
import {
  createPlayTable,
  handler,
  joinPlayTable,
  leavePlayTable,
  playTable,
  playTableByInviteCode,
} from './play-table.js'

const { mockSend } = vi.hoisted(() => {
  const fn = vi.fn()
  ;(
    globalThis as { __playTableMockSend?: ReturnType<typeof vi.fn> }
  ).__playTableMockSend = fn
  return { mockSend: fn }
})

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class MockDynamoDBClient {
    send = (globalThis as { __playTableMockSend?: ReturnType<typeof vi.fn> })
      .__playTableMockSend!
  },
  DeleteItemCommand: class {},
  GetItemCommand: class {},
  PutItemCommand: class {},
  QueryCommand: class {},
}))

vi.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: class MockEventBridgeClient {
    send = (globalThis as { __playTableMockSend?: ReturnType<typeof vi.fn> })
      .__playTableMockSend!
  },
  PutEventsCommand: class {},
}))

function createEvent<T>(
  args: T,
  options: {
    fieldName?: string
    parentTypeName?: string
    identity?: { sub: string }
  }
) {
  const base = createAppSyncEvent(args, options.identity)
  return {
    ...base,
    info: {
      ...base.info,
      fieldName: options.fieldName ?? base.info?.fieldName ?? 'createPlayTable',
      parentTypeName:
        options.parentTypeName ?? base.info?.parentTypeName ?? 'Mutation',
    },
  }
}

describe('play-table resolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
    process.env.DICE_ROLLER_TABLE_NAME = 'test-dice-roller-table'
    process.env.EVENT_BUS_NAME = 'test-bus'
  })

  describe('handler', () => {
    it('routes createPlayTable to createPlayTable resolver', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })
      mockSend.mockResolvedValueOnce({})
      const event = createEvent(
        {},
        {
          fieldName: 'createPlayTable',
          parentTypeName: 'Mutation',
          identity: { sub: 'cognito-sub-123' },
        }
      )
      const result = (await handler(event, {} as never, vi.fn())) as {
        id: string
        gmUserId: string
        inviteCode: string
        createdAt: string
      }
      expect(result).toMatchObject({
        id: expect.any(String),
        gmUserId: 'cognito-sub-123',
        inviteCode: expect.any(String),
        createdAt: expect.any(String),
      })
    })

    it('routes playTable to playTable resolver', async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          PK: { S: 'PLAYTABLE#pt-1' },
          SK: { S: 'METADATA' },
          id: { S: 'pt-1' },
          gmUserId: { S: 'gm-1' },
          inviteCode: { S: 'ABC123' },
          createdAt: { S: '2025-01-01T00:00:00.000Z' },
        },
      })
      mockSend.mockResolvedValueOnce({ Items: [] })
      const event = createEvent(
        { id: 'pt-1' },
        {
          fieldName: 'playTable',
          parentTypeName: 'Query',
        }
      )
      const result = (await handler(event, {} as never, vi.fn())) as {
        id: string
        gmUserId: string
        inviteCode: string
        createdAt: string
        players?: unknown[]
      }
      expect(result).toMatchObject({
        id: 'pt-1',
        gmUserId: 'gm-1',
        inviteCode: 'ABC123',
        players: [],
      })
    })

    it('routes playTableByInviteCode to playTableByInviteCode resolver', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })
      const event = createEvent(
        { inviteCode: 'XYZ789' },
        {
          fieldName: 'playTableByInviteCode',
          parentTypeName: 'Query',
        }
      )
      const result = (await handler(event, {} as never, vi.fn())) as {
        id: string
      } | null
      expect(result).toBeNull()
    })

    it('routes joinPlayTable to joinPlayTable resolver', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'METADATA' },
            id: { S: 'pt-1' },
          },
        ],
      })
      mockSend.mockResolvedValueOnce({})
      mockSend.mockResolvedValueOnce({})
      mockSend.mockResolvedValueOnce({
        Item: {
          PK: { S: 'PLAYTABLE#pt-1' },
          SK: { S: 'METADATA' },
          id: { S: 'pt-1' },
          gmUserId: { S: 'gm-1' },
          inviteCode: { S: 'ABC123' },
          createdAt: { S: '2025-01-01T00:00:00.000Z' },
        },
      })
      mockSend.mockResolvedValueOnce({ Items: [] })
      const event = createEvent(
        {
          inviteCode: 'ABC123',
          input: { characterName: 'Gandalf', initiativeModifier: 1 },
        },
        { fieldName: 'joinPlayTable', parentTypeName: 'Mutation' }
      )
      const result = (await handler(event, {} as never, vi.fn())) as {
        id: string
        gmUserId: string
        inviteCode: string
        players?: unknown[]
      }
      expect(result).toMatchObject({
        id: 'pt-1',
        gmUserId: 'gm-1',
        inviteCode: 'ABC123',
        players: [],
      })
    })

    it('routes leavePlayTable to leavePlayTable resolver', async () => {
      mockSend.mockResolvedValueOnce({})
      mockSend.mockResolvedValueOnce({})
      const event = createEvent(
        { playTableId: 'pt-1', playerId: 'p1' },
        { fieldName: 'leavePlayTable', parentTypeName: 'Mutation' }
      )
      const result = (await handler(event, {} as never, vi.fn())) as boolean
      expect(result).toBe(true)
    })

    it('throws for unknown resolver', async () => {
      const event = createEvent(
        {},
        {
          fieldName: 'unknownField',
          parentTypeName: 'Query',
        }
      )
      await expect(handler(event, {} as never, vi.fn())).rejects.toThrow(
        'Unknown resolver'
      )
    })
  })

  describe('createPlayTable', () => {
    it('creates PlayTable and returns it', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })
      mockSend.mockResolvedValueOnce({})
      const event = createEvent(
        {},
        {
          fieldName: 'createPlayTable',
          parentTypeName: 'Mutation',
          identity: { sub: 'cognito-sub-abc' },
        }
      )
      const result = (await createPlayTable(
        event as Parameters<typeof createPlayTable>[0],
        {} as never,
        vi.fn()
      )) as {
        id: string
        gmUserId: string
        inviteCode: string
        createdAt: string
      }
      expect(result).toMatchObject({
        gmUserId: 'cognito-sub-abc',
        inviteCode: expect.stringMatching(/^[A-Z0-9]{6}$/),
        createdAt: expect.any(String),
      })
      expect(result.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    })

    it('throws when identity is missing', async () => {
      const event = createEvent(
        {},
        {
          fieldName: 'createPlayTable',
          parentTypeName: 'Mutation',
          identity: undefined,
        }
      )
      await expect(
        createPlayTable(event as never, {} as never, vi.fn())
      ).rejects.toThrow(
        'Unauthorized: createPlayTable requires Cognito authentication'
      )
    })

    it('throws when unable to generate unique invite code after retries', async () => {
      mockSend.mockResolvedValue({ Items: [{ id: { S: 'existing' } }] })
      const event = createEvent(
        {},
        {
          fieldName: 'createPlayTable',
          parentTypeName: 'Mutation',
          identity: { sub: 'cognito-sub-abc' },
        }
      )
      await expect(
        createPlayTable(event as never, {} as never, vi.fn())
      ).rejects.toThrow('Failed to generate unique invite code')
    })
  })

  describe('joinPlayTable', () => {
    it('creates player and returns full PlayTable', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'METADATA' },
            id: { S: 'pt-1' },
          },
        ],
      })
      mockSend.mockResolvedValueOnce({})
      mockSend.mockResolvedValueOnce({})
      mockSend.mockResolvedValueOnce({
        Item: {
          PK: { S: 'PLAYTABLE#pt-1' },
          SK: { S: 'METADATA' },
          id: { S: 'pt-1' },
          gmUserId: { S: 'gm-1' },
          inviteCode: { S: 'ABC123' },
          createdAt: { S: '2025-01-01T00:00:00.000Z' },
        },
      })
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'PLAYER#p-new' },
            id: { S: 'p-new' },
            characterName: { S: 'Frodo' },
            initiativeModifier: { N: '2' },
          },
        ],
      })
      const event = createEvent(
        {
          inviteCode: 'ABC123',
          input: { characterName: 'Frodo', initiativeModifier: 2 },
        },
        { fieldName: 'joinPlayTable', parentTypeName: 'Mutation' }
      )
      const result = (await joinPlayTable(
        event as Parameters<typeof joinPlayTable>[0],
        {} as never,
        vi.fn()
      )) as {
        id: string
        gmUserId: string
        inviteCode: string
        players?: {
          id: string
          characterName: string
          initiativeModifier: number
        }[]
      }
      expect(result).toMatchObject({
        id: 'pt-1',
        gmUserId: 'gm-1',
        inviteCode: 'ABC123',
        players: [
          {
            id: 'p-new',
            characterName: 'Frodo',
            initiativeModifier: 2,
          },
        ],
      })
    })

    it('throws when invite code is invalid', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })
      const event = createEvent(
        {
          inviteCode: 'INVALID',
          input: { characterName: 'Frodo', initiativeModifier: 2 },
        },
        { fieldName: 'joinPlayTable', parentTypeName: 'Mutation' }
      )
      await expect(
        joinPlayTable(event as never, {} as never, vi.fn())
      ).rejects.toThrow('Invalid invite code')
    })
  })

  describe('leavePlayTable', () => {
    it('deletes player and publishes PlayerLeft', async () => {
      mockSend.mockResolvedValueOnce({})
      mockSend.mockResolvedValueOnce({})
      const event = createEvent(
        { playTableId: 'pt-1', playerId: 'player-1' },
        { fieldName: 'leavePlayTable', parentTypeName: 'Mutation' }
      )
      const result = await leavePlayTable(event as never, {} as never, vi.fn())
      expect(result).toBe(true)
      expect(mockSend).toHaveBeenCalledTimes(2)
    })
  })

  describe('playTable', () => {
    it('returns PlayTable with players', async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          PK: { S: 'PLAYTABLE#pt-1' },
          SK: { S: 'METADATA' },
          id: { S: 'pt-1' },
          gmUserId: { S: 'gm-1' },
          inviteCode: { S: 'ABC123' },
          createdAt: { S: '2025-01-01T00:00:00.000Z' },
        },
      })
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'PLAYER#p1' },
            id: { S: 'p1' },
            characterName: { S: 'Frodo' },
            initiativeModifier: { N: '2' },
          },
        ],
      })
      const event = createEvent(
        { id: 'pt-1' },
        { fieldName: 'playTable', parentTypeName: 'Query' }
      )
      const result = (await playTable(
        event as Parameters<typeof playTable>[0],
        {} as never,
        vi.fn()
      )) as {
        id: string
        gmUserId: string
        inviteCode: string
        players?: unknown[]
      } | null
      expect(result).toMatchObject({
        id: 'pt-1',
        gmUserId: 'gm-1',
        inviteCode: 'ABC123',
        players: [
          {
            id: 'p1',
            characterName: 'Frodo',
            initiativeModifier: 2,
          },
        ],
      })
    })

    it('returns null when PlayTable does not exist', async () => {
      mockSend.mockResolvedValueOnce({})
      mockSend.mockResolvedValueOnce({ Items: [] })
      const event = createEvent(
        { id: 'nonexistent' },
        { fieldName: 'playTable', parentTypeName: 'Query' }
      )
      const result = (await playTable(
        event as Parameters<typeof playTable>[0],
        {} as never,
        vi.fn()
      )) as {
        id: string
        gmUserId: string
        inviteCode: string
        players?: unknown[]
      } | null
      expect(result).toBeNull()
    })
  })

  describe('playTableByInviteCode', () => {
    it('returns PlayTable when invite code matches', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'METADATA' },
            id: { S: 'pt-1' },
          },
        ],
      })
      mockSend.mockResolvedValueOnce({
        Item: {
          PK: { S: 'PLAYTABLE#pt-1' },
          SK: { S: 'METADATA' },
          id: { S: 'pt-1' },
          gmUserId: { S: 'gm-1' },
          inviteCode: { S: 'ABC123' },
          createdAt: { S: '2025-01-01T00:00:00.000Z' },
        },
      })
      mockSend.mockResolvedValueOnce({ Items: [] })
      const event = createEvent(
        { inviteCode: 'ABC123' },
        { fieldName: 'playTableByInviteCode', parentTypeName: 'Query' }
      )
      const result = (await playTableByInviteCode(
        event as Parameters<typeof playTableByInviteCode>[0],
        {} as never,
        vi.fn()
      )) as {
        id: string
        gmUserId: string
        inviteCode: string
        players?: unknown[]
      } | null
      expect(result).toMatchObject({
        id: 'pt-1',
        gmUserId: 'gm-1',
        inviteCode: 'ABC123',
        players: [],
      })
    })

    it('returns null when invite code does not match', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })
      const event = createEvent(
        { inviteCode: 'NOTFOUND' },
        { fieldName: 'playTableByInviteCode', parentTypeName: 'Query' }
      )
      const result = (await playTableByInviteCode(
        event as Parameters<typeof playTableByInviteCode>[0],
        {} as never,
        vi.fn()
      )) as {
        id: string
        gmUserId: string
        inviteCode: string
        players?: unknown[]
      } | null
      expect(result).toBeNull()
    })
  })
})
