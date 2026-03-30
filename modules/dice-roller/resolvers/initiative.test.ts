import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppSyncEvent } from '../../../backend/test/appsync-event.js'
import {
  __resetInitiativeResolverDepsCache,
  clearInitiativeWithDeps,
  handler,
  type InitiativeResolverDeps,
  publishInitiativeUpdated,
  publishRollRequestCreated,
  rollHistoryWithDeps,
} from './initiative.js'

const mockPlayTableStore = vi.hoisted(() => ({
  getPlayTable: vi.fn(),
}))

const mockDiceRollerStore = vi.hoisted(() => ({
  getActiveRollRequest: vi.fn(),
  clearRollRequest: vi.fn(),
  listRollsForPlayTable: vi.fn(),
}))

vi.mock('../../play-table/store/index.js', () => ({
  createPlayTableStore: () => mockPlayTableStore,
}))

vi.mock('../store/index.js', () => ({
  createDiceRollerStore: () => mockDiceRollerStore,
}))

function createDeps(): InitiativeResolverDeps {
  return {
    playTableStore: mockPlayTableStore,
    diceRollerStore: mockDiceRollerStore,
  } as unknown as InitiativeResolverDeps
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
      fieldName: options.fieldName ?? base.info?.fieldName ?? 'clearInitiative',
      parentTypeName:
        options.parentTypeName ?? base.info?.parentTypeName ?? 'Mutation',
    },
  }
}

describe('initiative resolvers', () => {
  beforeEach(() => {
    __resetInitiativeResolverDepsCache()
    mockPlayTableStore.getPlayTable.mockReset()
    mockDiceRollerStore.getActiveRollRequest.mockReset()
    mockDiceRollerStore.clearRollRequest.mockReset()
    mockDiceRollerStore.listRollsForPlayTable.mockReset()
    process.env.PLAY_TABLE_NAME = 'test-play-table'
    process.env.DICE_ROLLER_TABLE_NAME = 'test-dice-roller-table'
  })

  describe('handler', () => {
    it('routes clearInitiative to clearInitiative resolver', async () => {
      mockPlayTableStore.getPlayTable.mockResolvedValue({
        id: 'pt-1',
        gmUserId: 'gm-123',
        inviteCode: 'abc',
        createdAt: '2024-01-01T00:00:00Z',
      })
      mockDiceRollerStore.getActiveRollRequest.mockResolvedValue({
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
      mockDiceRollerStore.clearRollRequest.mockResolvedValue(undefined)
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
      expect(mockDiceRollerStore.clearRollRequest).toHaveBeenCalledWith(
        'pt-1',
        'rr-1'
      )
    })

    it('routes rollHistory to rollHistory resolver', async () => {
      mockDiceRollerStore.listRollsForPlayTable.mockResolvedValue([])
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

  describe('clearInitiativeWithDeps', () => {
    it('clears active roll request and returns true', async () => {
      mockPlayTableStore.getPlayTable.mockResolvedValue({
        id: 'pt-1',
        gmUserId: 'gm-123',
        inviteCode: 'abc',
        createdAt: '2024-01-01T00:00:00Z',
      })
      mockDiceRollerStore.getActiveRollRequest.mockResolvedValue({
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
      mockDiceRollerStore.clearRollRequest.mockResolvedValue(undefined)
      const event = createEvent(
        { playTableId: 'pt-1' },
        {
          fieldName: 'clearInitiative',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      const result = await clearInitiativeWithDeps(
        event as Parameters<typeof clearInitiativeWithDeps>[0],
        createDeps()
      )
      expect(result).toBe(true)
      expect(mockDiceRollerStore.clearRollRequest).toHaveBeenCalledWith(
        'pt-1',
        'rr-1'
      )
    })

    it('returns true without calling clearRollRequest when no active request', async () => {
      mockPlayTableStore.getPlayTable.mockResolvedValue({
        id: 'pt-1',
        gmUserId: 'gm-123',
        inviteCode: 'abc',
        createdAt: '2024-01-01T00:00:00Z',
      })
      mockDiceRollerStore.getActiveRollRequest.mockResolvedValue(null)
      const event = createEvent(
        { playTableId: 'pt-1' },
        {
          fieldName: 'clearInitiative',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      const result = await clearInitiativeWithDeps(
        event as Parameters<typeof clearInitiativeWithDeps>[0],
        createDeps()
      )
      expect(result).toBe(true)
      expect(mockDiceRollerStore.clearRollRequest).not.toHaveBeenCalled()
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
        clearInitiativeWithDeps(event as never, createDeps())
      ).rejects.toThrow(
        'Unauthorized: clearInitiative requires Cognito authentication'
      )
    })

    it('throws when play table not found', async () => {
      mockPlayTableStore.getPlayTable.mockResolvedValue(null)
      const event = createEvent(
        { playTableId: 'nonexistent' },
        {
          fieldName: 'clearInitiative',
          parentTypeName: 'Mutation',
          identity: { sub: 'gm-123' },
        }
      )
      await expect(
        clearInitiativeWithDeps(event as never, createDeps())
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

  describe('rollHistoryWithDeps', () => {
    const rollRow = (id: string, createdAt: string) => ({
      id,
      playTableId: 'pt-1',
      rollerId: 'player-1',
      rollNotation: 'd20',
      values: [15] as number[],
      modifier: 2,
      rollResult: 17,
      isPrivate: false,
      type: 'initiative' as const,
      rollRequestId: null as string | null,
      createdAt,
      deletedAt: null as string | null,
    })

    it('returns rolls sorted by createdAt descending', async () => {
      mockDiceRollerStore.listRollsForPlayTable.mockResolvedValue([
        rollRow('roll-1', '2025-01-01T00:00:00.000Z'),
        rollRow('roll-2', '2025-01-02T00:00:00.000Z'),
        rollRow('roll-3', '2025-01-01T12:00:00.000Z'),
      ])
      const event = createEvent(
        { playTableId: 'pt-1' },
        { fieldName: 'rollHistory', parentTypeName: 'Query' }
      )
      const result = (await rollHistoryWithDeps(
        event as Parameters<typeof rollHistoryWithDeps>[0],
        createDeps()
      )) as { items: { id: string }[]; nextToken: string | null }
      expect(result.items).toHaveLength(3)
      expect(result.items[0].id).toBe('roll-2')
      expect(result.items[1].id).toBe('roll-3')
      expect(result.items[2].id).toBe('roll-1')
      expect(result.nextToken).toBeNull()
    })

    it('respects limit and returns nextToken when more items exist', async () => {
      mockDiceRollerStore.listRollsForPlayTable.mockResolvedValue([
        rollRow('roll-1', '2025-01-01T00:00:00.000Z'),
        rollRow('roll-2', '2025-01-02T00:00:00.000Z'),
        rollRow('roll-3', '2025-01-03T00:00:00.000Z'),
      ])
      const event = createEvent(
        { playTableId: 'pt-1', limit: 2 },
        { fieldName: 'rollHistory', parentTypeName: 'Query' }
      )
      const result = (await rollHistoryWithDeps(
        event as Parameters<typeof rollHistoryWithDeps>[0],
        createDeps()
      )) as { items: { id: string }[]; nextToken: string | null }
      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe('roll-3')
      expect(result.items[1].id).toBe('roll-2')
      expect(result.nextToken).not.toBeNull()
    })

    it('uses nextToken to return subsequent pages', async () => {
      mockDiceRollerStore.listRollsForPlayTable.mockResolvedValue([
        rollRow('roll-1', '2025-01-01T00:00:00.000Z'),
        rollRow('roll-2', '2025-01-02T00:00:00.000Z'),
        rollRow('roll-3', '2025-01-03T00:00:00.000Z'),
      ])
      const nextToken = Buffer.from(JSON.stringify({ offset: 2 })).toString(
        'base64'
      )
      const event = createEvent(
        { playTableId: 'pt-1', limit: 2, nextToken },
        { fieldName: 'rollHistory', parentTypeName: 'Query' }
      )
      const result = (await rollHistoryWithDeps(
        event as Parameters<typeof rollHistoryWithDeps>[0],
        createDeps()
      )) as { items: { id: string }[]; nextToken: string | null }
      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe('roll-1')
      expect(result.nextToken).toBeNull()
    })

    it('returns empty items when no rolls exist', async () => {
      mockDiceRollerStore.listRollsForPlayTable.mockResolvedValue([])
      const event = createEvent(
        { playTableId: 'pt-1' },
        { fieldName: 'rollHistory', parentTypeName: 'Query' }
      )
      const result = (await rollHistoryWithDeps(
        event as Parameters<typeof rollHistoryWithDeps>[0],
        createDeps()
      )) as { items: unknown[]; nextToken: string | null }
      expect(result.items).toHaveLength(0)
      expect(result.nextToken).toBeNull()
    })
  })
})
