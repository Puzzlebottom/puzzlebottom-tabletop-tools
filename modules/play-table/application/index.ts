import type {
  JoinPlayTableInput,
  PlayTable as GqlPlayTable,
} from '@puzzlebottom-tabletop-tools/graphql-types'
import type {
  PlayerJoinedDetail,
  PlayerLeftDetail,
} from '@puzzlebottom-tabletop-tools/schemas'
import { randomUUID } from 'crypto'

import type { IPlayTableStore } from '../store/index.js'

export interface IPlayTableEventPort {
  publishPlayerJoined(detail: PlayerJoinedDetail): Promise<void>
  publishPlayerLeft(detail: PlayerLeftDetail): Promise<void>
}

export interface IPlayTableApplication {
  createPlayTable(gmUserId: string): Promise<GqlPlayTable>
  joinPlayTable(
    inviteCode: string,
    input: JoinPlayTableInput
  ): Promise<GqlPlayTable>
  leavePlayTable(playTableId: string, playerId: string): Promise<boolean>
  getPlayTable(playTableId: string): Promise<GqlPlayTable | null>
  getPlayTableByInviteCode(inviteCode: string): Promise<GqlPlayTable | null>
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function defaultGenerateInviteCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return code
}

export function createPlayTableApplication(config: {
  store: IPlayTableStore
  events: IPlayTableEventPort
  generateInviteCode?: () => string
}): IPlayTableApplication {
  const {
    store,
    events,
    generateInviteCode = defaultGenerateInviteCode,
  } = config

  async function getPlayTableView(
    playTableId: string
  ): Promise<GqlPlayTable | null> {
    const [table, players] = await Promise.all([
      store.getPlayTable(playTableId),
      store.listPlayers(playTableId),
    ])
    if (!table) return null
    return {
      id: table.id,
      gmUserId: table.gmUserId,
      inviteCode: table.inviteCode,
      createdAt: table.createdAt,
      deletedAt: table.deletedAt,
      players: players.map((p) => ({
        id: p.id,
        playTableId: p.playTableId,
        characterName: p.characterName,
        initiativeModifier: p.initiativeModifier,
        createdAt: p.createdAt ?? table.createdAt,
        deletedAt: p.deletedAt,
      })),
    }
  }

  return {
    async createPlayTable(gmUserId: string): Promise<GqlPlayTable> {
      const id = randomUUID()
      const createdAt = new Date().toISOString()

      let inviteCode = ''
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateInviteCode()
        const existing = await store.getPlayTableByInviteCode(candidate)
        if (!existing) {
          inviteCode = candidate
          break
        }
      }
      if (!inviteCode) throw new Error('Failed to generate unique invite code')

      const playTable = { id, gmUserId, inviteCode, createdAt, deletedAt: null }
      await store.putPlayTable(playTable)

      return { ...playTable, players: [] }
    },

    async joinPlayTable(
      inviteCode: string,
      input: JoinPlayTableInput
    ): Promise<GqlPlayTable> {
      const table = await store.getPlayTableByInviteCode(inviteCode)
      if (!table) throw new Error('Invalid invite code')

      const playerId = randomUUID()
      const createdAt = new Date().toISOString()
      const player = {
        id: playerId,
        playTableId: table.id,
        characterName: input.characterName,
        initiativeModifier: input.initiativeModifier,
        createdAt,
        deletedAt: null,
      }
      await store.putPlayer(table.id, player)

      await events.publishPlayerJoined({
        playTableId: table.id,
        id: playerId,
        characterName: input.characterName,
        initiativeModifier: input.initiativeModifier,
      })

      const view = await getPlayTableView(table.id)
      if (!view) throw new Error('Play table not found after joining')
      return view
    },

    async leavePlayTable(
      playTableId: string,
      playerId: string
    ): Promise<boolean> {
      await store.deletePlayer(playTableId, playerId)
      await events.publishPlayerLeft({ playTableId, id: playerId })
      return true
    },

    async getPlayTable(playTableId: string): Promise<GqlPlayTable | null> {
      return getPlayTableView(playTableId)
    },

    async getPlayTableByInviteCode(
      inviteCode: string
    ): Promise<GqlPlayTable | null> {
      const table = await store.getPlayTableByInviteCode(inviteCode)
      if (!table) return null
      return getPlayTableView(table.id)
    },
  }
}
