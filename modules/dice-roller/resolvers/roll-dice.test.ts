import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppSyncEvent } from '../../../backend/test/appsync-event.js'
import {
  __resetRollDiceResolverDepsCache,
  createRollWithDeps,
  handler,
  type RollDiceResolverDeps,
} from './roll-dice.js'

const mockPlayTableStore = vi.hoisted(() => ({
  getPlayer: vi.fn(),
  getPlayTable: vi.fn(),
}))

const mockDiceRollerStore = vi.hoisted(() => ({
  getRollRequest: vi.fn(),
}))

const mockSfnSend = vi.hoisted(() => vi.fn())

vi.mock('../../play-table/store/index.js', () => ({
  createPlayTableStore: () => mockPlayTableStore,
}))

vi.mock('../store/index.js', () => ({
  createDiceRollerStore: () => mockDiceRollerStore,
}))

vi.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: class MockSFNClient {
    send = mockSfnSend
  },
  StartExecutionCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
}))

function createDeps(): RollDiceResolverDeps {
  return {
    playTableStore: mockPlayTableStore,
    diceRollerStore: mockDiceRollerStore,
    sfnClient: { send: mockSfnSend },
    rollStateMachineArn:
      'arn:aws:states:us-east-1:123456789012:stateMachine:test-roll-pipeline',
  } as unknown as RollDiceResolverDeps
}

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
    __resetRollDiceResolverDepsCache()
    mockPlayTableStore.getPlayer.mockReset()
    mockPlayTableStore.getPlayTable.mockReset()
    mockDiceRollerStore.getRollRequest.mockReset()
    mockSfnSend.mockReset()
    process.env.PLAY_TABLE_NAME = 'test-play-table'
    process.env.DICE_ROLLER_TABLE_NAME = 'test-dice-roller-table'
    process.env.ROLL_STATE_MACHINE_ARN =
      'arn:aws:states:us-east-1:123456789012:stateMachine:test-roll-pipeline'
  })

  describe('handler', () => {
    it('routes createRoll to createRoll resolver', async () => {
      mockPlayTableStore.getPlayTable.mockResolvedValue({
        id: 'pt-1',
        gmUserId: 'gm-123',
        inviteCode: 'abc',
        createdAt: '2024-01-01T00:00:00Z',
      })
      mockSfnSend.mockResolvedValue({})
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
      mockPlayTableStore.getPlayer.mockResolvedValue({
        id: 'p1',
        characterName: 'Hero',
        initiativeModifier: 0,
      })
      mockPlayTableStore.getPlayTable.mockResolvedValue({
        id: 'pt-1',
        gmUserId: 'gm-123',
        inviteCode: 'abc',
        createdAt: '2024-01-01T00:00:00Z',
      })
      mockDiceRollerStore.getRollRequest.mockResolvedValue({
        id: 'rr-1',
        playTableId: 'pt-1',
        targetPlayerIds: ['p1'],
        rollNotation: 'd20',
        type: 'initiative',
        dc: null,
        isPrivate: false,
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
        taskToken: 'token-123',
      })
      mockSfnSend.mockResolvedValue({})
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

  describe('createRollWithDeps', () => {
    it('validates, generates rollId, starts SF, and returns Roll', async () => {
      mockPlayTableStore.getPlayTable.mockResolvedValue({
        id: 'pt-1',
        gmUserId: 'gm-123',
        inviteCode: 'abc',
        createdAt: '2024-01-01T00:00:00Z',
      })
      mockSfnSend.mockResolvedValue({})
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
      const result = (await createRollWithDeps(
        event as Parameters<typeof createRollWithDeps>[0],
        createDeps()
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
      mockPlayTableStore.getPlayer.mockResolvedValue({
        id: 'p1',
        characterName: 'Hero',
        initiativeModifier: 0,
      })
      mockPlayTableStore.getPlayTable.mockResolvedValue({
        id: 'pt-1',
        gmUserId: 'gm-123',
        inviteCode: 'abc',
        createdAt: '2024-01-01T00:00:00Z',
      })
      mockSfnSend.mockResolvedValue({})
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
      const result = (await createRollWithDeps(
        event as Parameters<typeof createRollWithDeps>[0],
        createDeps()
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
        createRollWithDeps(event as never, createDeps())
      ).rejects.toThrow(
        'Unauthorized: createRoll requires Cognito (GM) or playerId in input (player)'
      )
    })

    it('throws when player not in play table', async () => {
      mockPlayTableStore.getPlayer.mockResolvedValue(null)
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
        createRollWithDeps(event as never, createDeps())
      ).rejects.toThrow('Player not found in play table')
    })

    it('throws when play table not found', async () => {
      mockPlayTableStore.getPlayTable.mockResolvedValue(null)
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
        createRollWithDeps(event as never, createDeps())
      ).rejects.toThrow('Play table not found')
    })

    it('fulfills initiative roll when rollRequestId and playerId provided', async () => {
      mockPlayTableStore.getPlayer.mockResolvedValue({
        id: 'p1',
        characterName: 'Hero',
        initiativeModifier: 0,
      })
      mockPlayTableStore.getPlayTable.mockResolvedValue({
        id: 'pt-1',
        gmUserId: 'gm-123',
        inviteCode: 'abc',
        createdAt: '2024-01-01T00:00:00Z',
      })
      mockDiceRollerStore.getRollRequest.mockResolvedValue({
        id: 'rr-1',
        playTableId: 'pt-1',
        targetPlayerIds: ['p1'],
        rollNotation: 'd20',
        type: 'initiative',
        dc: null,
        isPrivate: false,
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
        taskToken: 'token-123',
      })
      mockSfnSend.mockResolvedValue({})
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
      const result = (await createRollWithDeps(
        event as Parameters<typeof createRollWithDeps>[0],
        createDeps()
      )) as { id: string; rollerId: string }
      expect(result).toMatchObject({
        id: expect.any(String),
        rollerId: 'p1',
      })
      expect(mockSfnSend).toHaveBeenCalledOnce()
    })

    it('throws when roll request not found', async () => {
      mockPlayTableStore.getPlayer.mockResolvedValue({
        id: 'p1',
        characterName: 'Hero',
        initiativeModifier: 0,
      })
      mockPlayTableStore.getPlayTable.mockResolvedValue({
        id: 'pt-1',
        gmUserId: 'gm-123',
        inviteCode: 'abc',
        createdAt: '2024-01-01T00:00:00Z',
      })
      mockDiceRollerStore.getRollRequest.mockResolvedValue(null)
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
        createRollWithDeps(event as never, createDeps())
      ).rejects.toThrow('Roll request not found')
    })

    it('throws when player not a target', async () => {
      mockPlayTableStore.getPlayer.mockResolvedValue({
        id: 'p1',
        characterName: 'Hero',
        initiativeModifier: 0,
      })
      mockPlayTableStore.getPlayTable.mockResolvedValue({
        id: 'pt-1',
        gmUserId: 'gm-123',
        inviteCode: 'abc',
        createdAt: '2024-01-01T00:00:00Z',
      })
      mockDiceRollerStore.getRollRequest.mockResolvedValue({
        id: 'rr-1',
        playTableId: 'pt-1',
        targetPlayerIds: ['p2'],
        rollNotation: 'd20',
        type: 'initiative',
        dc: null,
        isPrivate: false,
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
        taskToken: 'token-123',
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
        createRollWithDeps(event as never, createDeps())
      ).rejects.toThrow('Player is not a target of this roll request')
    })

    it('throws when roll request has no taskToken', async () => {
      mockPlayTableStore.getPlayer.mockResolvedValue({
        id: 'p1',
        characterName: 'Hero',
        initiativeModifier: 0,
      })
      mockPlayTableStore.getPlayTable.mockResolvedValue({
        id: 'pt-1',
        gmUserId: 'gm-123',
        inviteCode: 'abc',
        createdAt: '2024-01-01T00:00:00Z',
      })
      mockDiceRollerStore.getRollRequest.mockResolvedValue({
        id: 'rr-1',
        playTableId: 'pt-1',
        targetPlayerIds: ['p1'],
        rollNotation: 'd20',
        type: 'initiative',
        dc: null,
        isPrivate: false,
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
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
        createRollWithDeps(event as never, createDeps())
      ).rejects.toThrow('Roll request is no longer accepting rolls')
    })
  })
})
