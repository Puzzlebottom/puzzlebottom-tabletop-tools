export const PLAYER_KEY_STORAGE = 'playerKey'
export const PLAY_TABLE_ID_STORAGE = 'playTableId'

export function storePlayer(playerId: string, playTableId: string): void {
  localStorage.setItem(PLAYER_KEY_STORAGE, playerId)
  localStorage.setItem(PLAY_TABLE_ID_STORAGE, playTableId)
}

export function getStoredPlayer(): {
  playerId: string
  playTableId: string
} | null {
  const playerId = localStorage.getItem(PLAYER_KEY_STORAGE)
  const playTableId = localStorage.getItem(PLAY_TABLE_ID_STORAGE)
  if (playerId !== null && playTableId !== null) {
    return { playerId, playTableId }
  }
  return null
}

export function clearStoredPlayer(): void {
  localStorage.removeItem(PLAYER_KEY_STORAGE)
  localStorage.removeItem(PLAY_TABLE_ID_STORAGE)
}
