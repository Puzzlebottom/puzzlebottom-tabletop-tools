import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppSyncEvent } from '../../test/appsync-event.js'
import {
  clearInitiative,
  handler,
  notifyInitiativeUpdated,
  notifyRollRequestCreated,
} from './initiative'

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
    process.env.TABLE_NAME = 'test-table'
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

    it('routes notifyRollRequestCreated to notifyRollRequestCreated resolver', async () => {
      const input = {
        id: 'rr-1',
        playTableId: 'pt-1',
        targetPlayerIds: ['p1', 'p2'],
        type: 'initiative',
        dc: null,
        advantage: null,
        isPrivate: false,
        status: 'pending',
        createdAt: '2024-01-01T00:00:00Z',
      }
      const event = createEvent(
        { input },
        {
          fieldName: 'notifyRollRequestCreated',
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

    it('routes notifyInitiativeUpdated to notifyInitiativeUpdated resolver', async () => {
      const order = [
        {
          id: 'p1',
          characterName: 'Frodo',
          value: 18,
          modifier: 2,
          total: 20,
        },
      ]
      const event = createEvent(
        { playTableId: 'pt-1', order },
        {
          fieldName: 'notifyInitiativeUpdated',
          parentTypeName: 'Mutation',
        }
      )
      const result = (await handler(event, {} as never, vi.fn())) as {
        playTableId: string
        order: typeof order
      }
      expect(result).toEqual({ playTableId: 'pt-1', order })
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

  describe('notifyRollRequestCreated', () => {
    it('returns input as pass-through', async () => {
      const input = {
        id: 'rr-1',
        playTableId: 'pt-1',
        targetPlayerIds: ['p1'],
        type: 'initiative',
        dc: 15,
        advantage: 'advantage',
        isPrivate: false,
        status: 'pending',
        createdAt: '2024-01-01T00:00:00Z',
      }
      const event = createEvent(
        { input },
        {
          fieldName: 'notifyRollRequestCreated',
          parentTypeName: 'Mutation',
        }
      )
      const result = await notifyRollRequestCreated(
        event as Parameters<typeof notifyRollRequestCreated>[0],
        {} as never,
        vi.fn()
      )
      expect(result).toEqual(input)
    })
  })

  describe('notifyInitiativeUpdated', () => {
    it('returns order from input', async () => {
      const order = [
        {
          id: 'p1',
          characterName: 'Frodo',
          value: 18,
          modifier: 2,
          total: 20,
        },
      ]
      const event = createEvent(
        { playTableId: 'pt-1', order },
        {
          fieldName: 'notifyInitiativeUpdated',
          parentTypeName: 'Mutation',
        }
      )
      const result = await notifyInitiativeUpdated(
        event as Parameters<typeof notifyInitiativeUpdated>[0],
        {} as never,
        vi.fn()
      )
      expect(result).toEqual({ playTableId: 'pt-1', order })
    })
  })
})
