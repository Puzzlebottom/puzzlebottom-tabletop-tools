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
}))

vi.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: class MockSFNClient {
    send = (globalThis as { __rollRequestMockSend?: ReturnType<typeof vi.fn> })
      .__rollRequestMockSend!
  },
  StartExecutionCommand: class {},
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
    process.env.ROLL_REQUEST_STATE_MACHINE_ARN =
      'arn:aws:states:us-east-1:123:stateMachine:test-roll-request'
  })

  describe('handler', () => {
    it('routes createRollRequest to createRollRequest resolver', async () => {
      mockSend
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'METADATA' },
            gmUserId: { S: 'gm-123' },
          },
        })
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
        rollRequestId: string
        accepted: boolean
      }
      expect(result).toMatchObject({
        accepted: true,
      })
      expect(result.rollRequestId).toBeDefined()
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
    it('starts Roll Request Step Function when type is initiative', async () => {
      mockSend
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'METADATA' },
            gmUserId: { S: 'gm-123' },
          },
        })
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
        rollRequestId: string
        accepted: boolean
      }
      expect(result).toMatchObject({
        accepted: true,
      })
      expect(result.rollRequestId).toBeDefined()
      expect(mockSend).toHaveBeenCalledTimes(2)
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

    it('throws when GM does not own play table', async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          PK: { S: 'PLAYTABLE#pt-1' },
          SK: { S: 'METADATA' },
          gmUserId: { S: 'other-gm' },
        },
      })
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
      await expect(
        createRollRequest(event as never, {} as never, vi.fn())
      ).rejects.toThrow('Only the GM can create roll requests')
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

    it('throws for unsupported roll request type', async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          PK: { S: 'PLAYTABLE#pt-1' },
          SK: { S: 'METADATA' },
          gmUserId: { S: 'gm-123' },
        },
      })
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
      await expect(
        createRollRequest(
          event as Parameters<typeof createRollRequest>[0],
          {} as never,
          vi.fn()
        )
      ).rejects.toThrow('Unsupported roll request type: ad_hoc')
    })

    it('starts Step Function with empty targetPlayerIds for initiative', async () => {
      mockSend
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'METADATA' },
            gmUserId: { S: 'gm-123' },
          },
        })
        .mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: {
            targetPlayerIds: [],
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
      )) as { rollRequestId: string; accepted: boolean }
      expect(result.accepted).toBe(true)
      expect(result.rollRequestId).toBeDefined()
    })
  })
})
