import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppSyncEvent } from '../../test/appsync-event.js'
import { fulfillRollRequest, handler, rollDice } from './roll-dice'

const { mockDynamoSend, mockSfnSend } = vi.hoisted(() => {
  const dynamoFn = vi.fn()
  const sfnFn = vi.fn()
  ;(
    globalThis as { __rollDiceMockDynamoSend?: ReturnType<typeof vi.fn> }
  ).__rollDiceMockDynamoSend = dynamoFn
  ;(
    globalThis as { __rollDiceMockSfnSend?: ReturnType<typeof vi.fn> }
  ).__rollDiceMockSfnSend = sfnFn
  return { mockDynamoSend: dynamoFn, mockSfnSend: sfnFn }
})

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class MockDynamoDBClient {
    send = (
      globalThis as { __rollDiceMockDynamoSend?: ReturnType<typeof vi.fn> }
    ).__rollDiceMockDynamoSend!
  },
  GetItemCommand: class {},
  PutItemCommand: class {},
}))

vi.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: class MockSFNClient {
    send = (globalThis as { __rollDiceMockSfnSend?: ReturnType<typeof vi.fn> })
      .__rollDiceMockSfnSend!
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
      fieldName: options.fieldName ?? base.info?.fieldName ?? 'rollDice',
      parentTypeName:
        options.parentTypeName ?? base.info?.parentTypeName ?? 'Mutation',
    },
  }
}

describe('roll-dice resolvers', () => {
  beforeEach(() => {
    mockDynamoSend.mockReset()
    mockSfnSend.mockReset()
    process.env.TABLE_NAME = 'test-table'
    process.env.ROLL_STATE_MACHINE_ARN =
      'arn:aws:states:us-east-1:123456789012:stateMachine:test-roll-pipeline'
  })

  describe('handler', () => {
    it('routes rollDice to rollDice resolver', async () => {
      mockDynamoSend.mockResolvedValueOnce({
        Item: { PK: { S: 'x' } },
      })
      mockSfnSend.mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: { diceType: 'd20' },
        },
        {
          fieldName: 'rollDice',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      const result = (await handler(event, {} as never, vi.fn())) as {
        rollId: string
        accepted: boolean
      }
      expect(result).toMatchObject({
        rollId: expect.any(String),
        accepted: true,
      })
    })

    it('routes fulfillRollRequest to fulfillRollRequest resolver', async () => {
      mockDynamoSend
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'ROLLREQUEST#rr-1' },
            id: { S: 'rr-1' },
            targetPlayerIds: { L: [{ S: 'p1' }] },
            type: { S: 'initiative' },
            status: { S: 'pending' },
          },
        })
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'PLAYER#p1' },
          },
        })
      mockSfnSend.mockResolvedValueOnce({})
      const event = createEvent(
        {
          rollRequestId: 'rr-1',
          playTableId: 'pt-1',
          playerId: 'p1',
        },
        {
          fieldName: 'fulfillRollRequest',
          parentTypeName: 'Mutation',
        }
      )
      const result = (await handler(event, {} as never, vi.fn())) as {
        rollId: string
        accepted: boolean
      }
      expect(result).toMatchObject({
        rollId: expect.any(String),
        accepted: true,
      })
    })

    it('throws for unknown resolver', async () => {
      const event = createEvent(
        {},
        {
          fieldName: 'unknownField',
          parentTypeName: 'Mutation',
        }
      )
      await expect(handler(event, {} as never, vi.fn())).rejects.toThrow(
        'Unknown resolver'
      )
    })
  })

  describe('rollDice', () => {
    it('validates, generates rollId, starts SF, and returns acknowledgment', async () => {
      mockDynamoSend.mockResolvedValueOnce({
        Item: {
          PK: { S: 'PLAYTABLE#pt-1' },
          SK: { S: 'METADATA' },
        },
      })
      mockSfnSend.mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: { diceType: 'd20' },
        },
        {
          fieldName: 'rollDice',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      const result = (await rollDice(
        event as Parameters<typeof rollDice>[0],
        {} as never,
        vi.fn()
      )) as {
        rollId: string
        accepted: boolean
      }
      expect(result).toMatchObject({
        rollId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        ),
        accepted: true,
      })
      expect(mockSfnSend).toHaveBeenCalledOnce()
    })

    it('rolls as player when id provided', async () => {
      mockDynamoSend
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'PLAYER#p1' },
          },
        })
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'METADATA' },
          },
        })
      mockSfnSend.mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: { id: 'p1', diceType: 'd20' },
        },
        {
          fieldName: 'rollDice',
          parentTypeName: 'Mutation',
        }
      )
      const result = (await rollDice(
        event as Parameters<typeof rollDice>[0],
        {} as never,
        vi.fn()
      )) as { rollId: string; accepted: boolean }
      expect(result.rollId).toBeDefined()
      expect(result.accepted).toBe(true)
      expect(mockSfnSend).toHaveBeenCalledOnce()
    })

    it('throws when neither GM nor player', async () => {
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: { diceType: 'd20' },
        },
        {
          fieldName: 'rollDice',
          parentTypeName: 'Mutation',
          identity: undefined,
        }
      )
      await expect(
        rollDice(event as never, {} as never, vi.fn())
      ).rejects.toThrow(
        'Unauthorized: rollDice requires Cognito (GM) or playerId in input (player)'
      )
    })

    it('throws when player not in play table', async () => {
      mockDynamoSend.mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: { id: 'unknown-player', diceType: 'd20' },
        },
        {
          fieldName: 'rollDice',
          parentTypeName: 'Mutation',
        }
      )
      await expect(
        rollDice(event as never, {} as never, vi.fn())
      ).rejects.toThrow('Player not found in play table')
    })

    it('throws when play table not found', async () => {
      mockDynamoSend.mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'nonexistent',
          input: { diceType: 'd20' },
        },
        {
          fieldName: 'rollDice',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      await expect(
        rollDice(event as never, {} as never, vi.fn())
      ).rejects.toThrow('Play table not found')
    })
  })

  describe('fulfillRollRequest', () => {
    it('fulfills and returns rollId with accepted', async () => {
      mockDynamoSend
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'ROLLREQUEST#rr-1' },
            id: { S: 'rr-1' },
            targetPlayerIds: { L: [{ S: 'p1' }] },
            type: { S: 'initiative' },
            status: { S: 'pending' },
          },
        })
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'PLAYER#p1' },
          },
        })
      mockSfnSend.mockResolvedValueOnce({})
      const event = createEvent(
        {
          rollRequestId: 'rr-1',
          playTableId: 'pt-1',
          playerId: 'p1',
        },
        { fieldName: 'fulfillRollRequest', parentTypeName: 'Mutation' }
      )
      const result = (await fulfillRollRequest(
        event as Parameters<typeof fulfillRollRequest>[0],
        {} as never,
        vi.fn()
      )) as {
        rollId: string
        accepted: boolean
      }
      expect(result).toMatchObject({
        rollId: expect.any(String),
        accepted: true,
      })
      expect(mockSfnSend).toHaveBeenCalledOnce()
    })

    it('throws when roll request not found', async () => {
      mockDynamoSend.mockResolvedValueOnce({}).mockResolvedValueOnce({
        Item: {
          PK: { S: 'PLAYTABLE#pt-1' },
          SK: { S: 'PLAYER#p1' },
        },
      })
      const event = createEvent(
        {
          rollRequestId: 'nonexistent',
          playTableId: 'pt-1',
          playerId: 'p1',
        },
        { fieldName: 'fulfillRollRequest', parentTypeName: 'Mutation' }
      )
      await expect(
        fulfillRollRequest(event as never, {} as never, vi.fn())
      ).rejects.toThrow('Roll request not found')
    })

    it('throws when player not a target', async () => {
      mockDynamoSend
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'ROLLREQUEST#rr-1' },
            id: { S: 'rr-1' },
            targetPlayerIds: { L: [{ S: 'p2' }] },
            type: { S: 'initiative' },
            status: { S: 'pending' },
          },
        })
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'PLAYER#p1' },
          },
        })
      const event = createEvent(
        {
          rollRequestId: 'rr-1',
          playTableId: 'pt-1',
          playerId: 'p1',
        },
        { fieldName: 'fulfillRollRequest', parentTypeName: 'Mutation' }
      )
      await expect(
        fulfillRollRequest(event as never, {} as never, vi.fn())
      ).rejects.toThrow('Player is not a target of this roll request')
    })

    it('throws when roll request not pending', async () => {
      mockDynamoSend
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'ROLLREQUEST#rr-1' },
            id: { S: 'rr-1' },
            targetPlayerIds: { L: [{ S: 'p1' }] },
            type: { S: 'initiative' },
            status: { S: 'completed' },
          },
        })
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'PLAYER#p1' },
          },
        })
      const event = createEvent(
        {
          rollRequestId: 'rr-1',
          playTableId: 'pt-1',
          playerId: 'p1',
        },
        { fieldName: 'fulfillRollRequest', parentTypeName: 'Mutation' }
      )
      await expect(
        fulfillRollRequest(event as never, {} as never, vi.fn())
      ).rejects.toThrow('Roll request is no longer pending')
    })
  })
})
