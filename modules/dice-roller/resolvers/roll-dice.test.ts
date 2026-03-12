import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppSyncEvent } from '../../../backend/test/appsync-event.js'
import { createRoll, handler } from './roll-dice.js'

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
      fieldName: options.fieldName ?? base.info?.fieldName ?? 'createRoll',
      parentTypeName:
        options.parentTypeName ?? base.info?.parentTypeName ?? 'Mutation',
    },
  }
}

describe('roll-dice resolvers', () => {
  beforeEach(() => {
    mockDynamoSend.mockReset()
    mockSfnSend.mockReset()
    process.env.PLAY_TABLE_NAME = 'test-play-table'
    process.env.DICE_ROLLER_TABLE_NAME = 'test-dice-roller-table'
    process.env.ROLL_STATE_MACHINE_ARN =
      'arn:aws:states:us-east-1:123456789012:stateMachine:test-roll-pipeline'
  })

  describe('handler', () => {
    it('routes createRoll to createRoll resolver', async () => {
      mockDynamoSend.mockResolvedValueOnce({
        Item: { PK: { S: 'x' } },
      })
      mockSfnSend.mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: { diceNotation: 'd20', modifier: 0, isPrivate: false },
        },
        {
          fieldName: 'createRoll',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      const result = (await handler(event, {} as never, vi.fn())) as {
        id: string
        playTableId: string
        rollerId: string
      }
      expect(result).toMatchObject({
        id: expect.any(String),
        playTableId: 'pt-1',
        rollerId: 'gm-123',
      })
    })

    it('routes createRoll with rollRequestId for initiative', async () => {
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
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'ROLLREQUEST#rr-1' },
            targetPlayerIds: { L: [{ S: 'p1' }] },
            taskToken: { S: 'token-123' },
          },
        })
      mockSfnSend.mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'pt-1',
          playerId: 'p1',
          input: {
            diceNotation: 'd20',
            modifier: 0,
            isPrivate: false,
            rollRequestId: 'rr-1',
          },
        },
        {
          fieldName: 'createRoll',
          parentTypeName: 'Mutation',
        }
      )
      const result = (await handler(event, {} as never, vi.fn())) as {
        id: string
        playTableId: string
        rollerId: string
      }
      expect(result).toMatchObject({
        id: expect.any(String),
        playTableId: 'pt-1',
        rollerId: 'p1',
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

  describe('createRoll', () => {
    it('validates, generates rollId, starts SF, and returns Roll', async () => {
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
          input: { diceNotation: 'd20', modifier: 0, isPrivate: false },
        },
        {
          fieldName: 'createRoll',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      const result = (await createRoll(
        event as Parameters<typeof createRoll>[0],
        {} as never,
        vi.fn()
      )) as { id: string; playTableId: string; rollerId: string }
      expect(result).toMatchObject({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        ),
        playTableId: 'pt-1',
        rollerId: 'gm-123',
      })
      expect(mockSfnSend).toHaveBeenCalledOnce()
    })

    it('rolls as player when playerId provided', async () => {
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
          playerId: 'p1',
          input: {
            diceNotation: 'd20',
            modifier: 0,
            isPrivate: false,
          },
        },
        {
          fieldName: 'createRoll',
          parentTypeName: 'Mutation',
        }
      )
      const result = (await createRoll(
        event as Parameters<typeof createRoll>[0],
        {} as never,
        vi.fn()
      )) as { id: string; rollerId: string }
      expect(result.id).toBeDefined()
      expect(result.rollerId).toBe('p1')
      expect(mockSfnSend).toHaveBeenCalledOnce()
    })

    it('throws when neither GM nor player', async () => {
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: { diceNotation: 'd20', modifier: 0, isPrivate: false },
        },
        {
          fieldName: 'createRoll',
          parentTypeName: 'Mutation',
          identity: undefined,
        }
      )
      await expect(
        createRoll(event as never, {} as never, vi.fn())
      ).rejects.toThrow(
        'Unauthorized: createRoll requires Cognito (GM) or playerId in input (player)'
      )
    })

    it('throws when player not in play table', async () => {
      mockDynamoSend.mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'pt-1',
          playerId: 'unknown-player',
          input: {
            diceNotation: 'd20',
            modifier: 0,
            isPrivate: false,
          },
        },
        {
          fieldName: 'createRoll',
          parentTypeName: 'Mutation',
        }
      )
      await expect(
        createRoll(event as never, {} as never, vi.fn())
      ).rejects.toThrow('Player not found in play table')
    })

    it('throws when play table not found', async () => {
      mockDynamoSend.mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'nonexistent',
          input: { diceNotation: 'd20', modifier: 0, isPrivate: false },
        },
        {
          fieldName: 'createRoll',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      await expect(
        createRoll(event as never, {} as never, vi.fn())
      ).rejects.toThrow('Play table not found')
    })

    it('fulfills initiative roll when rollRequestId and playerId provided', async () => {
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
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'ROLLREQUEST#rr-1' },
            targetPlayerIds: { L: [{ S: 'p1' }] },
            taskToken: { S: 'token-123' },
          },
        })
      mockSfnSend.mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'pt-1',
          playerId: 'p1',
          input: {
            diceNotation: 'd20',
            modifier: 0,
            isPrivate: false,
            rollRequestId: 'rr-1',
          },
        },
        { fieldName: 'createRoll', parentTypeName: 'Mutation' }
      )
      const result = (await createRoll(
        event as Parameters<typeof createRoll>[0],
        {} as never,
        vi.fn()
      )) as { id: string; rollerId: string }
      expect(result).toMatchObject({
        id: expect.any(String),
        rollerId: 'p1',
      })
      expect(mockSfnSend).toHaveBeenCalledOnce()
    })

    it('throws when roll request not found', async () => {
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
        .mockResolvedValueOnce({})
      const event = createEvent(
        {
          playTableId: 'pt-1',
          playerId: 'p1',
          input: {
            diceNotation: 'd20',
            modifier: 0,
            isPrivate: false,
            rollRequestId: 'nonexistent',
          },
        },
        { fieldName: 'createRoll', parentTypeName: 'Mutation' }
      )
      await expect(
        createRoll(event as never, {} as never, vi.fn())
      ).rejects.toThrow('Roll request not found')
    })

    it('throws when player not a target', async () => {
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
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'ROLLREQUEST#rr-1' },
            targetPlayerIds: { L: [{ S: 'p2' }] },
            taskToken: { S: 'token-123' },
          },
        })
      const event = createEvent(
        {
          playTableId: 'pt-1',
          playerId: 'p1',
          input: {
            diceNotation: 'd20',
            modifier: 0,
            isPrivate: false,
            rollRequestId: 'rr-1',
          },
        },
        { fieldName: 'createRoll', parentTypeName: 'Mutation' }
      )
      await expect(
        createRoll(event as never, {} as never, vi.fn())
      ).rejects.toThrow('Player is not a target of this roll request')
    })

    it('throws when roll request has no taskToken', async () => {
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
        .mockResolvedValueOnce({
          Item: {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'ROLLREQUEST#rr-1' },
            targetPlayerIds: { L: [{ S: 'p1' }] },
          },
        })
      const event = createEvent(
        {
          playTableId: 'pt-1',
          playerId: 'p1',
          input: {
            diceNotation: 'd20',
            modifier: 0,
            isPrivate: false,
            rollRequestId: 'rr-1',
          },
        },
        { fieldName: 'createRoll', parentTypeName: 'Mutation' }
      )
      await expect(
        createRoll(event as never, {} as never, vi.fn())
      ).rejects.toThrow('Roll request is no longer accepting rolls')
    })
  })
})
