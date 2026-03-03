import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  clearStoredPlayer,
  getStoredPlayer,
  storePlayer,
} from './player-storage'

describe('player-storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('storePlayer saves playerId and playTableId to localStorage', () => {
    storePlayer('player-123', 'table-456')
    expect(localStorage.getItem('playerKey')).toBe('player-123')
    expect(localStorage.getItem('playTableId')).toBe('table-456')
  })

  it('getStoredPlayer returns null when nothing stored', () => {
    expect(getStoredPlayer()).toBeNull()
  })

  it('getStoredPlayer returns null when only playerKey stored', () => {
    localStorage.setItem('playerKey', 'p1')
    expect(getStoredPlayer()).toBeNull()
  })

  it('getStoredPlayer returns null when only playTableId stored', () => {
    localStorage.setItem('playTableId', 't1')
    expect(getStoredPlayer()).toBeNull()
  })

  it('getStoredPlayer returns object when both stored', () => {
    storePlayer('player-123', 'table-456')
    expect(getStoredPlayer()).toEqual({
      playerId: 'player-123',
      playTableId: 'table-456',
    })
  })

  it('clearStoredPlayer removes both keys', () => {
    storePlayer('p1', 't1')
    clearStoredPlayer()
    expect(getStoredPlayer()).toBeNull()
    expect(localStorage.getItem('playerKey')).toBeNull()
    expect(localStorage.getItem('playTableId')).toBeNull()
  })
})
