/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppSyncEvent } from '../../test/appsync-event.js'
import { fulfillRollRequest, handler, rollDice } from './roll-dice'

const { mockSend } = vi.hoisted(() => {
  const fn = vi.fn()
  ;(
    globalThis as { __rollDiceMockSend?: ReturnType<typeof vi.fn> }
  ).__rollDiceMockSend = fn
  return { mockSend: fn }
})

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class MockDynamoDBClient {
    send = (globalThis as { __rollDiceMockSend?: ReturnType<typeof vi.fn> })
      .__rollDiceMockSend!
  },
  GetItemCommand: class {},
  PutItemCommand: class {},
}))

vi.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: class MockEventBridgeClient {
    send = (globalThis as { __rollDiceMockSend?: ReturnType<typeof vi.fn> })
      .__rollDiceMockSend!
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
      fieldName: options.fieldName ?? base.info?.fieldName ?? 'rollDice',
      parentTypeName:
        options.parentTypeName ?? base.info?.parentTypeName ?? 'Mutation',
    },
  }
}

describe('roll-dice resolvers', () => {
  beforeEach(() => {
    mockSend.mockReset()
    process.env.TABLE_NAME = 'test-table'
    process.env.EVENT_BUS_NAME = 'test-bus'
  })

  describe('handler', () => {
    it('routes rollDice to rollDice resolver', async () => {
      mockSend.mockResolvedValueOnce({ Item: { PK: { S: 'x' } } })
      mockSend.mockResolvedValueOnce({ Item: { PK: { S: 'x' } } })
      mockSend.mockResolvedValueOnce({})
      mockSend.mockResolvedValueOnce({})
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
      mockSend
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
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
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
    it('rolls as GM and returns rollId', async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          PK: { S: 'PLAYTABLE#pt-1' },
          SK: { S: 'METADATA' },
        },
      })
      mockSend.mockResolvedValueOnce({})
      mockSend.mockResolvedValueOnce({})
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
      )) as { rollId: string; accepted: boolean }
      expect(result).toMatchObject({
        rollId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        ),
        accepted: true,
      })
    })

    it('rolls as player when id provided', async () => {
      mockSend
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
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
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
      expect(result.accepted).toBe(true)
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
      mockSend.mockResolvedValueOnce({})
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

    it('rolls with advantage when specified', async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          PK: { S: 'PLAYTABLE#pt-1' },
          SK: { S: 'METADATA' },
        },
      })
      mockSend.mockResolvedValueOnce({})
      mockSend.mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: { diceType: 'd20', advantage: 'advantage' },
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
      )) as { rollId: string; accepted: boolean }
      expect(result).toMatchObject({ accepted: true })
      expect(result.rollId).toBeDefined()
    })

    it('rolls with disadvantage when specified', async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          PK: { S: 'PLAYTABLE#pt-1' },
          SK: { S: 'METADATA' },
        },
      })
      mockSend.mockResolvedValueOnce({})
      mockSend.mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: { diceType: 'd20', advantage: 'disadvantage' },
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
      )) as { rollId: string; accepted: boolean }
      expect(result).toMatchObject({ accepted: true })
      expect(result.rollId).toBeDefined()
    })

    it('throws when play table not found', async () => {
      mockSend.mockResolvedValueOnce({})
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
    it('fulfills and returns rollId', async () => {
      mockSend
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
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
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
      )) as { rollId: string; accepted: boolean }
      expect(result).toMatchObject({
        rollId: expect.any(String),
        accepted: true,
      })
    })

    it('throws when roll request not found', async () => {
      mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({
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
      mockSend
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
      mockSend
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
