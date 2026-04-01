import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppSyncEvent } from '../../../backend/test/appsync-event.js'
import { handler } from './play-table.js'

const mockApp = {
  createPlayTable: vi.fn(),
  joinPlayTable: vi.fn(),
  leavePlayTable: vi.fn(),
  getPlayTable: vi.fn(),
  getPlayTableByInviteCode: vi.fn(),
}

vi.mock('../application/index.js', () => ({
  createPlayTableApplication: () => mockApp,
}))

vi.mock('../store/index.js', () => ({
  createPlayTableStore: vi.fn(),
}))

vi.mock('./event-port.js', () => ({
  createEventPort: vi.fn().mockReturnValue({}),
}))

function makeEvent<T>(
  args: T,
  options: {
    fieldName: string
    parentTypeName: string
    identity?: { sub: string }
  }
) {
  const base = createAppSyncEvent(args, options.identity)
  return {
    ...base,
    info: {
      ...base.info,
      fieldName: options.fieldName,
      parentTypeName: options.parentTypeName,
    },
  }
}

describe('play-table handler routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
    process.env.EVENT_BUS_NAME = 'test-bus'
  })

  it('routes Mutation.createPlayTable → app.createPlayTable(sub)', async () => {
    mockApp.createPlayTable.mockResolvedValue({ id: 'pt-1' })
    const event = makeEvent(
      {},
      {
        fieldName: 'createPlayTable',
        parentTypeName: 'Mutation',
        identity: { sub: 'user-42' },
      }
    )

    await handler(event, {} as never, vi.fn())

    expect(mockApp.createPlayTable).toHaveBeenCalledWith('user-42')
  })

  it('throws for Mutation.createPlayTable without Cognito identity', async () => {
    const event = makeEvent(
      {},
      { fieldName: 'createPlayTable', parentTypeName: 'Mutation' }
    )

    await expect(handler(event, {} as never, vi.fn())).rejects.toThrow(
      'Unauthorized'
    )
  })

  it('routes Query.playTable → app.getPlayTable(id)', async () => {
    mockApp.getPlayTable.mockResolvedValue({ id: 'pt-1' })
    const event = makeEvent(
      { id: 'pt-1' },
      { fieldName: 'playTable', parentTypeName: 'Query' }
    )

    await handler(event, {} as never, vi.fn())

    expect(mockApp.getPlayTable).toHaveBeenCalledWith('pt-1')
  })

  it('routes Query.playTableByInviteCode → app.getPlayTableByInviteCode(inviteCode)', async () => {
    mockApp.getPlayTableByInviteCode.mockResolvedValue(null)
    const event = makeEvent(
      { inviteCode: 'ABC123' },
      { fieldName: 'playTableByInviteCode', parentTypeName: 'Query' }
    )

    await handler(event, {} as never, vi.fn())

    expect(mockApp.getPlayTableByInviteCode).toHaveBeenCalledWith('ABC123')
  })

  it('routes Mutation.joinPlayTable → app.joinPlayTable(inviteCode, input)', async () => {
    mockApp.joinPlayTable.mockResolvedValue({ id: 'pt-1' })
    const input = { characterName: 'Gandalf', initiativeModifier: 5 }
    const event = makeEvent(
      { inviteCode: 'XYZ999', input },
      { fieldName: 'joinPlayTable', parentTypeName: 'Mutation' }
    )

    await handler(event, {} as never, vi.fn())

    expect(mockApp.joinPlayTable).toHaveBeenCalledWith('XYZ999', input)
  })

  it('routes Mutation.leavePlayTable → app.leavePlayTable(playTableId, playerId)', async () => {
    mockApp.leavePlayTable.mockResolvedValue(true)
    const event = makeEvent(
      { playTableId: 'pt-1', playerId: 'p-1' },
      { fieldName: 'leavePlayTable', parentTypeName: 'Mutation' }
    )

    await handler(event, {} as never, vi.fn())

    expect(mockApp.leavePlayTable).toHaveBeenCalledWith('pt-1', 'p-1')
  })

  it('throws for unknown resolver', async () => {
    const event = makeEvent(
      {},
      { fieldName: 'unknownField', parentTypeName: 'Query' }
    )

    await expect(handler(event, {} as never, vi.fn())).rejects.toThrow(
      'Unknown resolver'
    )
  })
})
