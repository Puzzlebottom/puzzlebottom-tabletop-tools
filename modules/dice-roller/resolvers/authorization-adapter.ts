import type { IPlayTableStore } from '../../play-table/store/index.js'
import type { IDiceRollerAuthorizationPort } from '../application/authorization-port.js'

export function createAuthorizationAdapter(
  store: IPlayTableStore
): IDiceRollerAuthorizationPort {
  return {
    async getTableGmUserId(playTableId: string): Promise<string | null> {
      const table = await store.getPlayTable(playTableId)
      return table?.gmUserId ?? null
    },
    async verifyPlayerMembership(
      playTableId: string,
      playerId: string
    ): Promise<{ playerId: string } | null> {
      const player = await store.getPlayer(playTableId, playerId)
      return player ? { playerId: player.id } : null
    },
  }
}
