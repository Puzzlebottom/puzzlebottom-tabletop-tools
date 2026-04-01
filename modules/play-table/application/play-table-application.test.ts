import { randomUUID } from 'crypto'
import { describe, expect, it, vi } from 'vitest'

import type { IPlayTableStore, Player, PlayTable } from '../store/index.js'
import {
  createPlayTableApplication,
  type IPlayTableEventPort,
} from './index.js'

function makeStore(overrides: Partial<IPlayTableStore> = {}): IPlayTableStore {
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

function makeEvents(
  overrides: Partial<IPlayTableEventPort> = {}
): IPlayTableEventPort {
  return {
    publishPlayerJoined: vi.fn().mockResolvedValue(undefined),
    publishPlayerLeft: vi.fn().mockResolvedValue(undefined),
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

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: randomUUID(),
    playTableId: 'pt-1',
    characterName: 'Gandalf',
    initiativeModifier: 2,
    deletedAt: null,
    ...overrides,
  }
}

describe('createPlayTableApplication', () => {
  describe('createPlayTable', () => {
    it('returns PlayTable with correct gmUserId, UUID id, ISO createdAt, 6-char invite code', async () => {
      const store = makeStore()
      const events = makeEvents()
      const app = createPlayTableApplication({ store, events })

      const result = await app.createPlayTable('gm-user-1')

      expect(result).toMatchObject({
        gmUserId: 'gm-user-1',
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        ),
        createdAt: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
        ),
        inviteCode: expect.stringMatching(/^[A-Z0-9]{6}$/),
        players: [],
      })
    })

    it('retries invite code generation on collision', async () => {
      const existingTable = makePlayTable()
      let callCount = 0
      const getPlayTableByInviteCode = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return Promise.resolve(existingTable)
        return Promise.resolve(null)
      })
      const store = makeStore({ getPlayTableByInviteCode })
      const codes = ['TAKEN1', 'FREE22']
      let codeIdx = 0
      const app = createPlayTableApplication({
        store,
        events: makeEvents(),
        generateInviteCode: () => codes[codeIdx++],
      })

      const result = await app.createPlayTable('gm-1')

      expect(result.inviteCode).toBe('FREE22')
      expect(getPlayTableByInviteCode).toHaveBeenCalledTimes(2)
    })

    it('throws after 5 failed uniqueness attempts', async () => {
      const existingTable = makePlayTable()
      const getPlayTableByInviteCode = vi.fn().mockResolvedValue(existingTable)
      const store = makeStore({ getPlayTableByInviteCode })
      const app = createPlayTableApplication({ store, events: makeEvents() })

      await expect(app.createPlayTable('gm-1')).rejects.toThrow(
        'Failed to generate unique invite code'
      )
      expect(getPlayTableByInviteCode).toHaveBeenCalledTimes(5)
    })
  })

  describe('joinPlayTable', () => {
    it('returns PlayTable with players on valid invite code', async () => {
      const table = makePlayTable({ id: 'pt-1' })
      const player = makePlayer({
        id: 'p-1',
        playTableId: 'pt-1',
        characterName: 'Frodo',
        initiativeModifier: 2,
      })
      const store = makeStore({
        getPlayTableByInviteCode: vi.fn().mockResolvedValue(table),
        getPlayTable: vi.fn().mockResolvedValue(table),
        listPlayers: vi.fn().mockResolvedValue([player]),
      })
      const app = createPlayTableApplication({ store, events: makeEvents() })

      const result = await app.joinPlayTable('ABC123', {
        characterName: 'Frodo',
        initiativeModifier: 2,
      })

      expect(result).toMatchObject({
        id: 'pt-1',
        gmUserId: table.gmUserId,
        players: [{ id: 'p-1', characterName: 'Frodo', initiativeModifier: 2 }],
      })
    })

    it('throws on invalid invite code', async () => {
      const store = makeStore({
        getPlayTableByInviteCode: vi.fn().mockResolvedValue(null),
      })
      const app = createPlayTableApplication({ store, events: makeEvents() })

      await expect(
        app.joinPlayTable('BADCODE', {
          characterName: 'Frodo',
          initiativeModifier: 2,
        })
      ).rejects.toThrow('Invalid invite code')
    })

    it('publishes PlayerJoined event with correct detail', async () => {
      const table = makePlayTable({ id: 'pt-1' })
      const store = makeStore({
        getPlayTableByInviteCode: vi.fn().mockResolvedValue(table),
        getPlayTable: vi.fn().mockResolvedValue(table),
      })
      const publishPlayerJoined = vi.fn().mockResolvedValue(undefined)
      const app = createPlayTableApplication({
        store,
        events: makeEvents({ publishPlayerJoined }),
      })

      await app.joinPlayTable('ABC123', {
        characterName: 'Bilbo',
        initiativeModifier: -1,
      })

      expect(publishPlayerJoined).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          playTableId: 'pt-1',
          characterName: 'Bilbo',
          initiativeModifier: -1,
        })
      )
    })
  })

  describe('leavePlayTable', () => {
    it('returns true', async () => {
      const app = createPlayTableApplication({
        store: makeStore(),
        events: makeEvents(),
      })
      const result = await app.leavePlayTable('pt-1', 'p-1')
      expect(result).toBe(true)
    })

    it('publishes PlayerLeft event', async () => {
      const publishPlayerLeft = vi.fn().mockResolvedValue(undefined)
      const app = createPlayTableApplication({
        store: makeStore(),
        events: makeEvents({ publishPlayerLeft }),
      })

      await app.leavePlayTable('pt-1', 'p-1')

      expect(publishPlayerLeft).toHaveBeenCalledExactlyOnceWith({
        playTableId: 'pt-1',
        id: 'p-1',
      })
    })
  })

  describe('getPlayTable', () => {
    it('returns PlayTable with players when found', async () => {
      const table = makePlayTable({ id: 'pt-1' })
      const player = makePlayer({ playTableId: 'pt-1' })
      const store = makeStore({
        getPlayTable: vi.fn().mockResolvedValue(table),
        listPlayers: vi.fn().mockResolvedValue([player]),
      })
      const app = createPlayTableApplication({ store, events: makeEvents() })

      const result = await app.getPlayTable('pt-1')

      expect(result).toMatchObject({
        id: 'pt-1',
        players: [{ id: player.id, characterName: player.characterName }],
      })
    })

    it('returns null when not found', async () => {
      const app = createPlayTableApplication({
        store: makeStore(),
        events: makeEvents(),
      })
      const result = await app.getPlayTable('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getPlayTableByInviteCode', () => {
    it('returns PlayTable view when invite code matches', async () => {
      const table = makePlayTable({ id: 'pt-1', inviteCode: 'XYZ999' })
      const player = makePlayer({ playTableId: 'pt-1' })
      const store = makeStore({
        getPlayTableByInviteCode: vi.fn().mockResolvedValue(table),
        getPlayTable: vi.fn().mockResolvedValue(table),
        listPlayers: vi.fn().mockResolvedValue([player]),
      })
      const app = createPlayTableApplication({ store, events: makeEvents() })

      const result = await app.getPlayTableByInviteCode('XYZ999')

      expect(result).toMatchObject({
        id: 'pt-1',
        inviteCode: 'XYZ999',
        players: [{ id: player.id }],
      })
    })

    it('returns null when no match', async () => {
      const app = createPlayTableApplication({
        store: makeStore(),
        events: makeEvents(),
      })
      const result = await app.getPlayTableByInviteCode('NOTFOUND')
      expect(result).toBeNull()
    })
  })
})
