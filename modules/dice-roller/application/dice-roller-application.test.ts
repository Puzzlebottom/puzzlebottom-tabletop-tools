import { randomUUID } from 'crypto'
import { describe, expect, it, vi } from 'vitest'

import type {
  IPlayTableStore,
  PlayTable,
} from '../../play-table/store/index.js'
import type { IDiceRollerStore, Roll, RollRequest } from '../store/index.js'
import {
  createDiceRollerApplication,
  type IDiceRollerWorkflowPort,
} from './index.js'

function makePlayTableStore(
  overrides: Partial<IPlayTableStore> = {}
): IPlayTableStore {
  return {
    getPlayTable: vi.fn().mockResolvedValue(null),
    getPlayer: vi.fn().mockResolvedValue(null),
    listPlayers: vi.fn().mockResolvedValue([]),
    getPlayTableByInviteCode: vi.fn().mockResolvedValue(null),
    putPlayTable: vi.fn().mockResolvedValue(undefined),
    putPlayer: vi.fn().mockResolvedValue(undefined),
    deletePlayer: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function makeDiceRollerStore(
  overrides: Partial<IDiceRollerStore> = {}
): IDiceRollerStore {
  return {
    getActiveRollRequest: vi.fn().mockResolvedValue(null),
    getRollRequest: vi.fn().mockResolvedValue(null),
    listRollsForRequest: vi.fn().mockResolvedValue([]),
    addPlayerToRollRequest: vi.fn().mockResolvedValue(undefined),
    removePlayerFromActiveRollRequest: vi.fn().mockResolvedValue(undefined),
    putRollRequest: vi.fn().mockResolvedValue(undefined),
    putRoll: vi.fn().mockResolvedValue(undefined),
    setRollRequestTaskToken: vi.fn().mockResolvedValue(undefined),
    clearRollRequest: vi.fn().mockResolvedValue(undefined),
    isRollRequestFulfilled: vi.fn().mockResolvedValue(false),
    listRollsForPlayTable: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

function makeWorkflowPort(
  overrides: Partial<IDiceRollerWorkflowPort> = {}
): IDiceRollerWorkflowPort {
  return {
    startRollRequestPipeline: vi.fn().mockResolvedValue(undefined),
    startRollPipeline: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function makePlayTable(overrides: Partial<PlayTable> = {}): PlayTable {
  return {
    id: randomUUID(),
    gmUserId: 'gm-1',
    inviteCode: 'ABC123',
    createdAt: '2025-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

function makeRollRequest(overrides: Partial<RollRequest> = {}): RollRequest {
  return {
    id: randomUUID(),
    playTableId: 'pt-1',
    targetPlayerIds: ['p-1'],
    rollNotation: 'd20',
    type: 'initiative',
    dc: null,
    isPrivate: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    deletedAt: null,
    taskToken: 'token-abc',
    ...overrides,
  }
}

function makeRoll(overrides: Partial<Roll> = {}): Roll {
  return {
    id: randomUUID(),
    playTableId: 'pt-1',
    rollerId: 'p-1',
    rollNotation: 'd20',
    type: null,
    values: [],
    modifier: 0,
    rollResult: 0,
    isPrivate: false,
    rollRequestId: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

describe('createDiceRollerApplication', () => {
  describe('createRollRequest', () => {
    it('starts roll-request pipeline and returns RollRequest', async () => {
      const table = makePlayTable({ id: 'pt-1', gmUserId: 'gm-1' })
      const playTableStore = makePlayTableStore({
        getPlayTable: vi.fn().mockResolvedValue(table),
      })
      const diceRollerStore = makeDiceRollerStore()
      const startRollRequestPipeline = vi.fn().mockResolvedValue(undefined)
      const app = createDiceRollerApplication({
        playTableStore,
        diceRollerStore,
        workflows: makeWorkflowPort({ startRollRequestPipeline }),
      })

      const result = await app.createRollRequest('gm-1', 'pt-1', {
        targetPlayerIds: ['p-1', 'p-2'],
        type: 'initiative',
        diceNotation: 'd20',
        dc: null,
        isPrivate: false,
      })

      expect(result).toMatchObject({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        ),
        playTableId: 'pt-1',
        targetPlayerIds: ['p-1', 'p-2'],
        rollNotation: 'd20',
        type: 'initiative',
        dc: null,
        isPrivate: false,
        createdAt: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
        ),
        deletedAt: null,
        rolls: [],
      })
      expect(startRollRequestPipeline).toHaveBeenCalledOnce()
    })

    it('throws when GM does not own play table', async () => {
      const table = makePlayTable({ id: 'pt-1', gmUserId: 'other-gm' })
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore({
          getPlayTable: vi.fn().mockResolvedValue(table),
        }),
        diceRollerStore: makeDiceRollerStore(),
        workflows: makeWorkflowPort(),
      })

      await expect(
        app.createRollRequest('gm-1', 'pt-1', {
          targetPlayerIds: ['p-1'],
          type: 'initiative',
          diceNotation: 'd20',
          dc: null,
          isPrivate: false,
        })
      ).rejects.toThrow('Only the GM can create roll requests')
    })

    it('throws when play table not found', async () => {
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore(),
        diceRollerStore: makeDiceRollerStore(),
        workflows: makeWorkflowPort(),
      })

      await expect(
        app.createRollRequest('gm-1', 'nonexistent', {
          targetPlayerIds: ['p-1'],
          type: 'initiative',
          diceNotation: 'd20',
          dc: null,
          isPrivate: false,
        })
      ).rejects.toThrow('Play table not found')
    })

    it('throws when active roll request already exists', async () => {
      const table = makePlayTable({ id: 'pt-1', gmUserId: 'gm-1' })
      const active = makeRollRequest({ playTableId: 'pt-1' })
      const startRollRequestPipeline = vi.fn().mockResolvedValue(undefined)
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore({
          getPlayTable: vi.fn().mockResolvedValue(table),
        }),
        diceRollerStore: makeDiceRollerStore({
          getActiveRollRequest: vi.fn().mockResolvedValue(active),
        }),
        workflows: makeWorkflowPort({ startRollRequestPipeline }),
      })

      await expect(
        app.createRollRequest('gm-1', 'pt-1', {
          targetPlayerIds: ['p-1'],
          type: 'initiative',
          diceNotation: 'd20',
          dc: null,
          isPrivate: false,
        })
      ).rejects.toThrow(/active roll request already exists/i)
      expect(startRollRequestPipeline).not.toHaveBeenCalled()
    })

    it('throws for unsupported roll request type', async () => {
      const table = makePlayTable({ id: 'pt-1', gmUserId: 'gm-1' })
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore({
          getPlayTable: vi.fn().mockResolvedValue(table),
        }),
        diceRollerStore: makeDiceRollerStore(),
        workflows: makeWorkflowPort(),
      })

      await expect(
        app.createRollRequest('gm-1', 'pt-1', {
          targetPlayerIds: ['p-1'],
          type: 'ad_hoc' as never,
          diceNotation: 'd20',
          dc: null,
          isPrivate: false,
        })
      ).rejects.toThrow('Unsupported roll request type: ad_hoc')
    })

    it('throws when targetPlayerIds is empty', async () => {
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore(),
        diceRollerStore: makeDiceRollerStore(),
        workflows: makeWorkflowPort(),
      })

      await expect(
        app.createRollRequest('gm-1', 'pt-1', {
          targetPlayerIds: [],
          type: 'initiative',
          diceNotation: 'd20',
          dc: null,
          isPrivate: false,
        })
      ).rejects.toThrow('targetPlayerIds must not be empty')
    })
  })

  describe('createRoll', () => {
    const baseInput = { diceNotation: 'd20', modifier: 0, isPrivate: false }

    it('GM rolls ad-hoc and returns Roll with UUID id and correct rollerId', async () => {
      const table = makePlayTable({ id: 'pt-1' })
      const startRollPipeline = vi.fn().mockResolvedValue(undefined)
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore({
          getPlayTable: vi.fn().mockResolvedValue(table),
        }),
        diceRollerStore: makeDiceRollerStore(),
        workflows: makeWorkflowPort({ startRollPipeline }),
      })

      const result = await app.createRoll({ sub: 'gm-1' }, 'pt-1', baseInput)

      expect(result).toMatchObject({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        ),
        playTableId: 'pt-1',
        rollerId: 'gm-1',
        rollNotation: 'd20',
      })
      expect(startRollPipeline).toHaveBeenCalledOnce()
    })

    it('player rolls with playerId and returns Roll with correct rollerId', async () => {
      const table = makePlayTable({ id: 'pt-1' })
      const player = { id: 'p-1', characterName: 'Hero', initiativeModifier: 0 }
      const startRollPipeline = vi.fn().mockResolvedValue(undefined)
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore({
          getPlayTable: vi.fn().mockResolvedValue(table),
          getPlayer: vi.fn().mockResolvedValue(player),
        }),
        diceRollerStore: makeDiceRollerStore(),
        workflows: makeWorkflowPort({ startRollPipeline }),
      })

      const result = await app.createRoll(
        { playerId: 'p-1' },
        'pt-1',
        baseInput
      )

      expect(result.rollerId).toBe('p-1')
      expect(startRollPipeline).toHaveBeenCalledOnce()
    })

    it('throws when neither sub nor playerId provided', async () => {
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore(),
        diceRollerStore: makeDiceRollerStore(),
        workflows: makeWorkflowPort(),
      })

      await expect(app.createRoll({}, 'pt-1', baseInput)).rejects.toThrow(
        'Unauthorized: createRoll requires Cognito (GM) or playerId in input (player)'
      )
    })

    it('throws when player not found in play table', async () => {
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore({
          getPlayer: vi.fn().mockResolvedValue(null),
        }),
        diceRollerStore: makeDiceRollerStore(),
        workflows: makeWorkflowPort(),
      })

      await expect(
        app.createRoll({ playerId: 'unknown' }, 'pt-1', baseInput)
      ).rejects.toThrow('Player not found in play table')
    })

    it('throws when play table not found', async () => {
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore(),
        diceRollerStore: makeDiceRollerStore(),
        workflows: makeWorkflowPort(),
      })

      await expect(
        app.createRoll({ sub: 'gm-1' }, 'nonexistent', baseInput)
      ).rejects.toThrow('Play table not found')
    })

    it('throws when roll request not found', async () => {
      const table = makePlayTable({ id: 'pt-1' })
      const player = { id: 'p-1', characterName: 'Hero', initiativeModifier: 0 }
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore({
          getPlayTable: vi.fn().mockResolvedValue(table),
          getPlayer: vi.fn().mockResolvedValue(player),
        }),
        diceRollerStore: makeDiceRollerStore({
          getRollRequest: vi.fn().mockResolvedValue(null),
        }),
        workflows: makeWorkflowPort(),
      })

      await expect(
        app.createRoll({ playerId: 'p-1' }, 'pt-1', {
          ...baseInput,
          rollRequestId: 'nonexistent',
        })
      ).rejects.toThrow('Roll request not found')
    })

    it('throws when player is not a target of the roll request', async () => {
      const table = makePlayTable({ id: 'pt-1' })
      const player = { id: 'p-1', characterName: 'Hero', initiativeModifier: 0 }
      const rollRequest = makeRollRequest({
        targetPlayerIds: ['p-2'],
        taskToken: 'tok',
      })
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore({
          getPlayTable: vi.fn().mockResolvedValue(table),
          getPlayer: vi.fn().mockResolvedValue(player),
        }),
        diceRollerStore: makeDiceRollerStore({
          getRollRequest: vi.fn().mockResolvedValue(rollRequest),
        }),
        workflows: makeWorkflowPort(),
      })

      await expect(
        app.createRoll({ playerId: 'p-1' }, 'pt-1', {
          ...baseInput,
          rollRequestId: rollRequest.id,
        })
      ).rejects.toThrow('Player is not a target of this roll request')
    })

    it('throws when roll request has no taskToken', async () => {
      const table = makePlayTable({ id: 'pt-1' })
      const player = { id: 'p-1', characterName: 'Hero', initiativeModifier: 0 }
      const rollRequest = makeRollRequest({
        targetPlayerIds: ['p-1'],
        taskToken: undefined,
      })
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore({
          getPlayTable: vi.fn().mockResolvedValue(table),
          getPlayer: vi.fn().mockResolvedValue(player),
        }),
        diceRollerStore: makeDiceRollerStore({
          getRollRequest: vi.fn().mockResolvedValue(rollRequest),
        }),
        workflows: makeWorkflowPort(),
      })

      await expect(
        app.createRoll({ playerId: 'p-1' }, 'pt-1', {
          ...baseInput,
          rollRequestId: rollRequest.id,
        })
      ).rejects.toThrow('Roll request is no longer accepting rolls')
    })
  })

  describe('clearInitiative', () => {
    it('clears active roll request and returns true', async () => {
      const table = makePlayTable({ id: 'pt-1', gmUserId: 'gm-1' })
      const active = makeRollRequest({ id: 'rr-1', playTableId: 'pt-1' })
      const clearRollRequest = vi.fn().mockResolvedValue(undefined)
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore({
          getPlayTable: vi.fn().mockResolvedValue(table),
        }),
        diceRollerStore: makeDiceRollerStore({
          getActiveRollRequest: vi.fn().mockResolvedValue(active),
          clearRollRequest,
        }),
        workflows: makeWorkflowPort(),
      })

      const result = await app.clearInitiative('gm-1', 'pt-1')

      expect(result).toBe(true)
      expect(clearRollRequest).toHaveBeenCalledExactlyOnceWith('pt-1', 'rr-1')
    })

    it('returns true without clearing when no active request', async () => {
      const table = makePlayTable({ id: 'pt-1' })
      const clearRollRequest = vi.fn()
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore({
          getPlayTable: vi.fn().mockResolvedValue(table),
        }),
        diceRollerStore: makeDiceRollerStore({ clearRollRequest }),
        workflows: makeWorkflowPort(),
      })

      const result = await app.clearInitiative('gm-1', 'pt-1')

      expect(result).toBe(true)
      expect(clearRollRequest).not.toHaveBeenCalled()
    })

    it('throws when play table not found', async () => {
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore(),
        diceRollerStore: makeDiceRollerStore(),
        workflows: makeWorkflowPort(),
      })

      await expect(app.clearInitiative('gm-1', 'nonexistent')).rejects.toThrow(
        'Play table not found'
      )
    })
  })

  describe('rollHistory', () => {
    const rollRow = (id: string, createdAt: string): Roll =>
      makeRoll({ id, playTableId: 'pt-1', createdAt })

    it('returns rolls sorted by createdAt descending', async () => {
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore(),
        diceRollerStore: makeDiceRollerStore({
          listRollsForPlayTable: vi
            .fn()
            .mockResolvedValue([
              rollRow('roll-1', '2025-01-01T00:00:00.000Z'),
              rollRow('roll-2', '2025-01-03T00:00:00.000Z'),
              rollRow('roll-3', '2025-01-02T00:00:00.000Z'),
            ]),
        }),
        workflows: makeWorkflowPort(),
      })

      const result = await app.rollHistory('pt-1', {})

      expect(result.items.map((r) => r.id)).toEqual([
        'roll-2',
        'roll-3',
        'roll-1',
      ])
      expect(result.nextToken).toBeNull()
    })

    it('respects limit and returns nextToken when more items exist', async () => {
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore(),
        diceRollerStore: makeDiceRollerStore({
          listRollsForPlayTable: vi
            .fn()
            .mockResolvedValue([
              rollRow('roll-1', '2025-01-01T00:00:00.000Z'),
              rollRow('roll-2', '2025-01-02T00:00:00.000Z'),
              rollRow('roll-3', '2025-01-03T00:00:00.000Z'),
            ]),
        }),
        workflows: makeWorkflowPort(),
      })

      const result = await app.rollHistory('pt-1', { limit: 2 })

      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe('roll-3')
      expect(result.nextToken).not.toBeNull()
    })

    it('uses nextToken to return subsequent page', async () => {
      const nextToken = Buffer.from(JSON.stringify({ offset: 2 })).toString(
        'base64'
      )
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore(),
        diceRollerStore: makeDiceRollerStore({
          listRollsForPlayTable: vi
            .fn()
            .mockResolvedValue([
              rollRow('roll-1', '2025-01-01T00:00:00.000Z'),
              rollRow('roll-2', '2025-01-02T00:00:00.000Z'),
              rollRow('roll-3', '2025-01-03T00:00:00.000Z'),
            ]),
        }),
        workflows: makeWorkflowPort(),
      })

      const result = await app.rollHistory('pt-1', { limit: 2, nextToken })

      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe('roll-1')
      expect(result.nextToken).toBeNull()
    })

    it('returns empty items when no rolls exist', async () => {
      const app = createDiceRollerApplication({
        playTableStore: makePlayTableStore(),
        diceRollerStore: makeDiceRollerStore(),
        workflows: makeWorkflowPort(),
      })

      const result = await app.rollHistory('pt-1', {})

      expect(result.items).toHaveLength(0)
      expect(result.nextToken).toBeNull()
    })
  })
})
