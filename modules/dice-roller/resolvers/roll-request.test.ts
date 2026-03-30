import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppSyncEvent } from '../../../backend/test/appsync-event.js'
import {
  __resetRollRequestResolverDepsCache,
  createRollRequestWithDeps,
  handler,
  type RollRequestResolverDeps,
} from './roll-request.js'

const mockPlayTableStore = vi.hoisted(() => ({
  getPlayTable: vi.fn(),
}))

const mockDiceRollerStore = vi.hoisted(() => ({
  getActiveRollRequest: vi.fn(),
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

function createDeps(): RollRequestResolverDeps {
  return {
    playTableStore: mockPlayTableStore,
    diceRollerStore: mockDiceRollerStore,
    sfnClient: { send: mockSfnSend },
    rollRequestStateMachineArn:
      'arn:aws:states:us-east-1:123:stateMachine:test-roll-request',
  } as unknown as RollRequestResolverDeps
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
      fieldName:
        options.fieldName ?? base.info?.fieldName ?? 'createRollRequest',
      parentTypeName:
        options.parentTypeName ?? base.info?.parentTypeName ?? 'Mutation',
    },
  }
}

describe('roll-request resolvers', () => {
  beforeEach(() => {
    __resetRollRequestResolverDepsCache()
    mockPlayTableStore.getPlayTable.mockReset()
    mockDiceRollerStore.getActiveRollRequest.mockReset()
    mockSfnSend.mockReset()
    process.env.PLAY_TABLE_NAME = 'test-play-table'
    process.env.DICE_ROLLER_TABLE_NAME = 'test-dice-roller-table'
    process.env.ROLL_REQUEST_STATE_MACHINE_ARN =
      'arn:aws:states:us-east-1:123:stateMachine:test-roll-request'
  })

  describe('handler', () => {
    it('routes createRollRequest to createRollRequest resolver', async () => {
      mockPlayTableStore.getPlayTable.mockResolvedValue({
        id: 'pt-1',
        gmUserId: 'gm-123',
        inviteCode: 'abc',
        createdAt: '2024-01-01T00:00:00Z',
      })
      mockDiceRollerStore.getActiveRollRequest.mockResolvedValue(null)
      mockSfnSend.mockResolvedValue({})
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: {
            targetPlayerIds: ['p1'],
            type: 'initiative',
            diceNotation: 'd20',
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
        rollNotation: string
      }
      expect(result).toMatchObject({
        playTableId: 'pt-1',
        targetPlayerIds: ['p1'],
        rollNotation: 'd20',
      })
      expect(result.id).toBeDefined()
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

  describe('createRollRequestWithDeps', () => {
    it('starts Roll Request Step Function when type is initiative', async () => {
      mockPlayTableStore.getPlayTable.mockResolvedValue({
        id: 'pt-1',
        gmUserId: 'gm-123',
        inviteCode: 'abc',
        createdAt: '2024-01-01T00:00:00Z',
      })
      mockDiceRollerStore.getActiveRollRequest.mockResolvedValue(null)
      mockSfnSend.mockResolvedValue({})
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: {
            targetPlayerIds: ['p1', 'p2'],
            type: 'initiative',
            diceNotation: 'd20',
          },
        },
        {
          fieldName: 'createRollRequest',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      const deps = createDeps()
      const result = (await createRollRequestWithDeps(
        event as Parameters<typeof createRollRequestWithDeps>[0],
        deps
      )) as {
        id: string
        playTableId: string
        targetPlayerIds: string[]
        rollNotation: string
      }
      expect(result).toMatchObject({
        playTableId: 'pt-1',
        targetPlayerIds: ['p1', 'p2'],
        rollNotation: 'd20',
      })
      expect(result.id).toBeDefined()
      expect(mockPlayTableStore.getPlayTable).toHaveBeenCalledWith('pt-1')
      expect(mockDiceRollerStore.getActiveRollRequest).toHaveBeenCalledWith(
        'pt-1'
      )
      expect(mockSfnSend).toHaveBeenCalledOnce()
    })

    it('throws when identity is missing', async () => {
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: {
            targetPlayerIds: ['p1'],
            type: 'initiative',
            diceNotation: 'd20',
          },
        },
        {
          fieldName: 'createRollRequest',
          parentTypeName: 'Mutation',
          identity: undefined,
        }
      )
      await expect(
        createRollRequestWithDeps(event as never, createDeps())
      ).rejects.toThrow(
        'Unauthorized: createRollRequest requires Cognito authentication'
      )
    })

    it('throws when GM does not own play table', async () => {
      mockPlayTableStore.getPlayTable.mockResolvedValue({
        id: 'pt-1',
        gmUserId: 'other-gm',
        inviteCode: 'abc',
        createdAt: '2024-01-01T00:00:00Z',
      })
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: {
            targetPlayerIds: ['p1'],
            type: 'initiative',
            diceNotation: 'd20',
          },
        },
        {
          fieldName: 'createRollRequest',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      await expect(
        createRollRequestWithDeps(event as never, createDeps())
      ).rejects.toThrow('Only the GM can create roll requests')
    })

    it('throws when play table not found', async () => {
      mockPlayTableStore.getPlayTable.mockResolvedValue(null)
      const event = createEvent(
        {
          playTableId: 'nonexistent',
          input: {
            targetPlayerIds: ['p1'],
            type: 'initiative',
            diceNotation: 'd20',
          },
        },
        {
          fieldName: 'createRollRequest',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      await expect(
        createRollRequestWithDeps(event as never, createDeps())
      ).rejects.toThrow('Play table not found')
    })

    it('throws when an active roll request already exists', async () => {
      mockPlayTableStore.getPlayTable.mockResolvedValue({
        id: 'pt-1',
        gmUserId: 'gm-123',
        inviteCode: 'abc',
        createdAt: '2024-01-01T00:00:00Z',
      })
      mockDiceRollerStore.getActiveRollRequest.mockResolvedValue({
        id: 'rr-existing',
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
          input: {
            targetPlayerIds: ['p1'],
            type: 'initiative',
            diceNotation: 'd20',
          },
        },
        {
          fieldName: 'createRollRequest',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      await expect(
        createRollRequestWithDeps(
          event as Parameters<typeof createRollRequestWithDeps>[0],
          createDeps()
        )
      ).rejects.toThrow(/active roll request already exists/i)
      expect(mockSfnSend).not.toHaveBeenCalled()
    })

    it('throws for unsupported roll request type', async () => {
      mockPlayTableStore.getPlayTable.mockResolvedValue({
        id: 'pt-1',
        gmUserId: 'gm-123',
        inviteCode: 'abc',
        createdAt: '2024-01-01T00:00:00Z',
      })
      mockDiceRollerStore.getActiveRollRequest.mockResolvedValue(null)
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: {
            targetPlayerIds: ['p1'],
            type: 'ad_hoc',
            diceNotation: 'd20',
          },
        },
        {
          fieldName: 'createRollRequest',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      await expect(
        createRollRequestWithDeps(
          event as Parameters<typeof createRollRequestWithDeps>[0],
          createDeps()
        )
      ).rejects.toThrow('Unsupported roll request type: ad_hoc')
    })

    it('throws when targetPlayerIds is empty', async () => {
      const event = createEvent(
        {
          playTableId: 'pt-1',
          input: {
            targetPlayerIds: [],
            type: 'initiative',
            diceNotation: 'd20',
          },
        },
        {
          fieldName: 'createRollRequest',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      await expect(
        createRollRequestWithDeps(
          event as Parameters<typeof createRollRequestWithDeps>[0],
          createDeps()
        )
      ).rejects.toThrow('targetPlayerIds must not be empty')
    })
  })
})
