import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppSyncEvent } from '../../test/appsync-event.js'
import { createRollRequest, handler } from './roll-request'

const { mockSend } = vi.hoisted(() => {
  const fn = vi.fn()
  ;(
    globalThis as { __rollRequestMockSend?: ReturnType<typeof vi.fn> }
  ).__rollRequestMockSend = fn
  return { mockSend: fn }
})

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class MockDynamoDBClient {
    send = (globalThis as { __rollRequestMockSend?: ReturnType<typeof vi.fn> })
      .__rollRequestMockSend!
  },
  GetItemCommand: class {},
  PutItemCommand: class {},
}))

vi.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: class MockEventBridgeClient {
    send = (globalThis as { __rollRequestMockSend?: ReturnType<typeof vi.fn> })
      .__rollRequestMockSend!
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
      fieldName: options.fieldName ?? 'createRollRequest',
      parentTypeName:
        options.parentTypeName ?? base.info?.parentTypeName ?? 'Mutation',
    },
  }
}

describe('roll-request resolvers', () => {
  beforeEach(() => {
    mockSend.mockReset()
    process.env.TABLE_NAME = 'test-table'
    process.env.EVENT_BUS_NAME = 'test-bus'
  })

  describe('handler', () => {
    it('routes createRollRequest to createRollRequest resolver', async () => {
      mockSend
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'METADATA' },
          },
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: {
            targetPlayerIds: ['p1'],
            type: 'initiative',
          },
        },
        {
          fieldName: 'createRollRequest',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      const result = (await handler(event, {} as never, vi.fn())) as {
        id: string
        playTableId: string
        targetPlayerIds: string[]
        type: string
        status: string
      }
      expect(result).toMatchObject({
        playTableId: 'pt-1',
        targetPlayerIds: ['p1'],
        type: 'initiative',
        status: 'pending',
      })
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
  })

  describe('createRollRequest', () => {
    it('creates RollRequest and publishes InitiativeRollRequestCreated when type is initiative', async () => {
      mockSend
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'METADATA' },
          },
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: {
            targetPlayerIds: ['p1', 'p2'],
            type: 'initiative',
          },
        },
        {
          fieldName: 'createRollRequest',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      const result = (await createRollRequest(
        event as Parameters<typeof createRollRequest>[0],
        {} as never,
        vi.fn()
      )) as {
        id: string
        playTableId: string
        targetPlayerIds: string[]
        type: string
        status: string
      }
      expect(result).toMatchObject({
        playTableId: 'pt-1',
        targetPlayerIds: ['p1', 'p2'],
        type: 'initiative',
        status: 'pending',
      })
      expect(mockSend).toHaveBeenCalledTimes(3)
    })

    it('throws when identity is missing', async () => {
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: {
            targetPlayerIds: ['p1'],
            type: 'initiative',
          },
        },
        {
          fieldName: 'createRollRequest',
          parentTypeName: 'Mutation',
          identity: undefined,
        }
      )
      await expect(
        createRollRequest(event as never, {} as never, vi.fn())
      ).rejects.toThrow(
        'Unauthorized: createRollRequest requires Cognito authentication'
      )
    })

    it('throws when play table not found', async () => {
      mockSend.mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'nonexistent',
          input: {
            targetPlayerIds: ['p1'],
            type: 'initiative',
          },
        },
        {
          fieldName: 'createRollRequest',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      await expect(
        createRollRequest(event as never, {} as never, vi.fn())
      ).rejects.toThrow('Play table not found')
    })

    it('creates ad_hoc RollRequest without publishing EventBridge', async () => {
      mockSend
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'METADATA' },
          },
        })
        .mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: {
            targetPlayerIds: ['p1'],
            type: 'ad_hoc',
          },
        },
        {
          fieldName: 'createRollRequest',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      const result = (await createRollRequest(
        event as Parameters<typeof createRollRequest>[0],
        {} as never,
        vi.fn()
      )) as { type: string }
      expect(result.type).toBe('ad_hoc')
      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('creates RollRequest with empty targetPlayerIds', async () => {
      mockSend
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'METADATA' },
          },
        })
        .mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: {
            targetPlayerIds: [],
            type: 'ad_hoc',
          },
        },
        {
          fieldName: 'createRollRequest',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      const result = (await createRollRequest(
        event as Parameters<typeof createRollRequest>[0],
        {} as never,
        vi.fn()
      )) as { targetPlayerIds: string[] }
      expect(result.targetPlayerIds).toEqual([])
    })
  })
})
