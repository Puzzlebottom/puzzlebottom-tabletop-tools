import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppSyncEvent } from '../../../backend/test/appsync-event.js'
import { handler } from './roll-dice.js'

const mockApp = {
  createRoll: vi.fn(),
}

vi.mock('../application/index.js', () => ({
  createDiceRollerApplication: () => mockApp,
}))

vi.mock('../store/index.js', () => ({ createDiceRollerStore: vi.fn() }))
vi.mock('../../play-table/store/index.js', () => ({
  createPlayTableStore: vi.fn(),
}))
vi.mock('./workflow-port.js', () => ({
  createWorkflowPort: vi.fn().mockReturnValue({}),
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

describe('roll-dice handler routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PLAY_TABLE_NAME = 'test-play-table'
    process.env.DICE_ROLLER_TABLE_NAME = 'test-dice-roller'
    process.env.ROLL_REQUEST_STATE_MACHINE_ARN = 'arn:test:rr'
    process.env.ROLL_STATE_MACHINE_ARN = 'arn:test:roll'
  })

  it('routes Mutation.createRoll (GM) → app.createRoll({ sub }, playTableId, input)', async () => {
    mockApp.createRoll.mockResolvedValue({ id: 'roll-1' })
    const input = { diceNotation: 'd20', modifier: 0, isPrivate: false }
    const event = makeEvent(
      { playTableId: 'pt-1', input },
      {
        fieldName: 'createRoll',
        parentTypeName: 'Mutation',
        identity: { sub: 'gm-1' },
      }
    )

    await handler(event, {} as never, vi.fn())

    expect(mockApp.createRoll).toHaveBeenCalledWith(
      { sub: 'gm-1', playerId: undefined },
      'pt-1',
      input
    )
  })

  it('routes Mutation.createRoll (player) → app.createRoll({ playerId }, playTableId, input)', async () => {
    mockApp.createRoll.mockResolvedValue({ id: 'roll-1' })
    const input = { diceNotation: 'd20', modifier: 0, isPrivate: false }
    const event = makeEvent(
      { playTableId: 'pt-1', playerId: 'p-1', input },
      { fieldName: 'createRoll', parentTypeName: 'Mutation' }
    )

    await handler(event, {} as never, vi.fn())

    expect(mockApp.createRoll).toHaveBeenCalledWith(
      { sub: undefined, playerId: 'p-1' },
      'pt-1',
      input
    )
  })

  it('throws for unknown resolver', async () => {
    const event = makeEvent(
      {},
      { fieldName: 'unknownField', parentTypeName: 'Mutation' }
    )

    await expect(handler(event, {} as never, vi.fn())).rejects.toThrow(
      'Unknown resolver'
    )
  })
})
