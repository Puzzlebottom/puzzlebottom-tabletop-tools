import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppSyncEvent } from '../../../backend/test/appsync-event.js'
import {
  clearInitiative,
  handler,
  publishInitiativeUpdated,
  publishRollRequestCreated,
  rollHistory,
} from './initiative.js'

const { mockSend } = vi.hoisted(() => {
  const fn = vi.fn()
  ;(
    globalThis as { __initiativeMockSend?: ReturnType<typeof vi.fn> }
  ).__initiativeMockSend = fn
  return { mockSend: fn }
})

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class MockDynamoDBClient {
    send = (globalThis as { __initiativeMockSend?: ReturnType<typeof vi.fn> })
      .__initiativeMockSend!
  },
  DeleteItemCommand: class {},
  GetItemCommand: class {},
  QueryCommand: class {},
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
      fieldName: options.fieldName ?? 'clearInitiative',
      parentTypeName:
        options.parentTypeName ?? base.info?.parentTypeName ?? 'Mutation',
    },
  }
}

describe('initiative resolvers', () => {
  beforeEach(() => {
    mockSend.mockReset()
    process.env.PLAY_TABLE_NAME = 'test-play-table'
    process.env.DICE_ROLLER_TABLE_NAME = 'test-dice-roller-table'
  })

  describe('handler', () => {
    it('routes clearInitiative to clearInitiative resolver', async () => {
      mockSend
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'METADATA' },
          },
        })
        .mockResolvedValueOnce({})
      const event = createEvent(
        { playTableId: 'pt-1' },
        {
          fieldName: 'clearInitiative',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      const result = await handler(event, {} as never, vi.fn())
      expect(result).toBe(true)
    })

    it('routes rollHistory to rollHistory resolver', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })
      const event = createEvent(
        { playTableId: 'pt-1' },
        {
          fieldName: 'rollHistory',
          parentTypeName: 'Query',
        }
      )
      const result = (await handler(event, {} as never, vi.fn())) as {
        items: unknown[]
        nextToken: string | null
      }
      expect(result).toMatchObject({
        items: [],
        nextToken: null,
      })
    })

    it('routes publishRollRequestCreated to publishRollRequestCreated resolver', async () => {
      const input = {
        id: 'rr-1',
        playTableId: 'pt-1',
        targetPlayerIds: ['p1', 'p2'],
        rollNotation: 'd20',
        type: 'initiative' as const,
        dc: null,
        isPrivate: false,
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
        rolls: [],
      }
      const event = createEvent(
        { input },
        {
          fieldName: 'publishRollRequestCreated',
          parentTypeName: 'Mutation',
        }
      )
      const result = (await handler(
        event,
        {} as never,
        vi.fn()
      )) as typeof input
      expect(result).toEqual(input)
    })

    it('routes publishInitiativeUpdated to publishInitiativeUpdated resolver', async () => {
      const rolls = [
        {
          id: 'r-1',
          playTableId: 'pt-1',
          rollerId: 'p1',
          rollNotation: 'd20',
          values: [18],
          modifier: 2,
          rollResult: 20,
          isPrivate: false,
          type: 'initiative' as const,
          rollRequestId: 'rr-1',
          createdAt: '2024-01-01T00:00:00Z',
          deletedAt: null,
        },
      ]
      const event = createEvent(
        { input: { rolls } },
        {
          fieldName: 'publishInitiativeUpdated',
          parentTypeName: 'Mutation',
        }
      )
      const result = (await handler(
        event,
        {} as never,
        vi.fn()
      )) as typeof rolls
      expect(result).toEqual(rolls)
    })

    it('throws for unknown resolver', async () => {
      const event = createEvent(
        {},
        { fieldName: 'unknownField', parentTypeName: 'Mutation' }
      )
      await expect(handler(event, {} as never, vi.fn())).rejects.toThrow(
        'Unknown resolver'
      )
    })

    it('throws when parentType is not Mutation', async () => {
      const event = createEvent(
        {},
        { fieldName: 'clearInitiative', parentTypeName: 'Query' }
      )
      await expect(handler(event, {} as never, vi.fn())).rejects.toThrow(
        'Unknown resolver'
      )
    })
  })

  describe('clearInitiative', () => {
    it('deletes initiative and returns true', async () => {
      mockSend
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'METADATA' },
          },
        })
        .mockResolvedValueOnce({})
      const event = createEvent(
        { playTableId: 'pt-1' },
        {
          fieldName: 'clearInitiative',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      const result = await clearInitiative(
        event as Parameters<typeof clearInitiative>[0],
        {} as never,
        vi.fn()
      )
      expect(result).toBe(true)
      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('throws when identity is missing', async () => {
      const event = createEvent(
        { playTableId: 'pt-1' },
        {
          fieldName: 'clearInitiative',
          parentTypeName: 'Mutation',
          identity: undefined,
        }
      )
      await expect(
        clearInitiative(event as never, {} as never, vi.fn())
      ).rejects.toThrow(
        'Unauthorized: clearInitiative requires Cognito authentication'
      )
    })

    it('throws when play table not found', async () => {
      mockSend.mockResolvedValueOnce({})
      const event = createEvent(
        { playTableId: 'nonexistent' },
        {
          fieldName: 'clearInitiative',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      await expect(
        clearInitiative(event as never, {} as never, vi.fn())
      ).rejects.toThrow('Play table not found')
    })
  })

  describe('publishRollRequestCreated', () => {
    it('returns input as pass-through', async () => {
      const input = {
        id: 'rr-1',
        playTableId: 'pt-1',
        targetPlayerIds: ['p1'],
        rollNotation: 'd20',
        type: 'initiative' as const,
        dc: 15,
        isPrivate: false,
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
        rolls: [],
      }
      const event = createEvent(
        { input },
        {
          fieldName: 'publishRollRequestCreated',
          parentTypeName: 'Mutation',
        }
      )
      const result = await publishRollRequestCreated(
        event as Parameters<typeof publishRollRequestCreated>[0],
        {} as never,
        vi.fn()
      )
      expect(result).toEqual(input)
    })
  })

  describe('publishInitiativeUpdated', () => {
    it('returns rolls from input', async () => {
      const rolls = [
        {
          id: 'r-1',
          playTableId: 'pt-1',
          rollerId: 'p1',
          rollNotation: 'd20',
          values: [18],
          modifier: 2,
          rollResult: 20,
          isPrivate: false,
          type: 'initiative' as const,
          rollRequestId: 'rr-1',
          createdAt: '2024-01-01T00:00:00Z',
          deletedAt: null,
        },
      ]
      const event = createEvent(
        { input: { rolls } },
        {
          fieldName: 'publishInitiativeUpdated',
          parentTypeName: 'Mutation',
        }
      )
      const result = await publishInitiativeUpdated(
        event as Parameters<typeof publishInitiativeUpdated>[0],
        {} as never,
        vi.fn()
      )
      expect(result).toEqual(rolls)
    })
  })

  describe('rollHistory', () => {
    const rollItem = (id: string, createdAt: string) => ({
      PK: { S: 'PLAYTABLE#pt-1' },
      SK: { S: `ROLL#${id}` },
      id: { S: id },
      playTableId: { S: 'pt-1' },
      rollerId: { S: 'player-1' },
      rollNotation: { S: 'd20' },
      values: { L: [{ N: '15' }] },
      modifier: { N: '2' },
      rollResult: { N: '17' },
      isPrivate: { BOOL: false },
      type: { S: 'initiative' },
      rollRequestId: { NULL: true },
      createdAt: { S: createdAt },
      deletedAt: { NULL: true },
    })

    it('returns rolls sorted by createdAt descending', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          rollItem('roll-1', '2025-01-01T00:00:00.000Z'),
          rollItem('roll-2', '2025-01-02T00:00:00.000Z'),
          rollItem('roll-3', '2025-01-01T12:00:00.000Z'),
        ],
      })
      const event = createEvent(
        { playTableId: 'pt-1' },
        { fieldName: 'rollHistory', parentTypeName: 'Query' }
      )
      const result = (await rollHistory(
        event as Parameters<typeof rollHistory>[0],
        {} as never,
        vi.fn()
      )) as { items: { id: string }[]; nextToken: string | null }
      expect(result.items).toHaveLength(3)
      expect(result.items[0].id).toBe('roll-2')
      expect(result.items[1].id).toBe('roll-3')
      expect(result.items[2].id).toBe('roll-1')
      expect(result.nextToken).toBeNull()
    })

    it('respects limit and returns nextToken when more items exist', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          rollItem('roll-1', '2025-01-01T00:00:00.000Z'),
          rollItem('roll-2', '2025-01-02T00:00:00.000Z'),
          rollItem('roll-3', '2025-01-03T00:00:00.000Z'),
        ],
      })
      const event = createEvent(
        { playTableId: 'pt-1', limit: 2 },
        { fieldName: 'rollHistory', parentTypeName: 'Query' }
      )
      const result = (await rollHistory(
        event as Parameters<typeof rollHistory>[0],
        {} as never,
        vi.fn()
      )) as { items: { id: string }[]; nextToken: string | null }
      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe('roll-3')
      expect(result.items[1].id).toBe('roll-2')
      expect(result.nextToken).not.toBeNull()
    })

    it('uses nextToken to return subsequent pages', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          rollItem('roll-1', '2025-01-01T00:00:00.000Z'),
          rollItem('roll-2', '2025-01-02T00:00:00.000Z'),
          rollItem('roll-3', '2025-01-03T00:00:00.000Z'),
        ],
      })
      const nextToken = Buffer.from(JSON.stringify({ offset: 2 })).toString(
        'base64'
      )
      const event = createEvent(
        { playTableId: 'pt-1', limit: 2, nextToken },
        { fieldName: 'rollHistory', parentTypeName: 'Query' }
      )
      const result = (await rollHistory(
        event as Parameters<typeof rollHistory>[0],
        {} as never,
        vi.fn()
      )) as { items: { id: string }[]; nextToken: string | null }
      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe('roll-1')
      expect(result.nextToken).toBeNull()
    })

    it('returns empty items when no rolls exist', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })
      const event = createEvent(
        { playTableId: 'pt-1' },
        { fieldName: 'rollHistory', parentTypeName: 'Query' }
      )
      const result = (await rollHistory(
        event as Parameters<typeof rollHistory>[0],
        {} as never,
        vi.fn()
      )) as { items: unknown[]; nextToken: string | null }
      expect(result.items).toHaveLength(0)
      expect(result.nextToken).toBeNull()
    })
  })
})
