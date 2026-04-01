import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppSyncEvent } from '../../../backend/test/appsync-event.js'
import { handler } from './initiative.js'

const mockApp = {
  clearInitiative: vi.fn(),
  rollHistory: vi.fn(),
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

describe('initiative handler routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PLAY_TABLE_NAME = 'test-play-table'
    process.env.DICE_ROLLER_TABLE_NAME = 'test-dice-roller'
    process.env.ROLL_REQUEST_STATE_MACHINE_ARN = 'arn:test:rr'
    process.env.ROLL_STATE_MACHINE_ARN = 'arn:test:roll'
  })

  it('routes Mutation.clearInitiative → app.clearInitiative(gmUserId, playTableId)', async () => {
    mockApp.clearInitiative.mockResolvedValue(true)
    const event = makeEvent(
      { playTableId: 'pt-1' },
      {
        fieldName: 'clearInitiative',
        parentTypeName: 'Mutation',
        identity: { sub: 'gm-1' },
      }
    )

    await handler(event, {} as never, vi.fn())

    expect(mockApp.clearInitiative).toHaveBeenCalledWith('gm-1', 'pt-1')
  })

  it('throws for Mutation.clearInitiative without Cognito identity', async () => {
    const event = makeEvent(
      { playTableId: 'pt-1' },
      { fieldName: 'clearInitiative', parentTypeName: 'Mutation' }
    )

    await expect(handler(event, {} as never, vi.fn())).rejects.toThrow(
      'Unauthorized'
    )
  })

  it('routes Query.rollHistory → app.rollHistory(playTableId, { limit, nextToken })', async () => {
    mockApp.rollHistory.mockResolvedValue({ items: [], nextToken: null })
    const event = makeEvent(
      { playTableId: 'pt-1', limit: 10, nextToken: null },
      { fieldName: 'rollHistory', parentTypeName: 'Query' }
    )

    await handler(event, {} as never, vi.fn())

    expect(mockApp.rollHistory).toHaveBeenCalledWith('pt-1', {
      limit: 10,
      nextToken: null,
    })
  })

  it('routes Mutation.publishRollRequestCreated → pass-through', async () => {
    const input = {
      id: 'rr-1',
      playTableId: 'pt-1',
      targetPlayerIds: ['p-1'],
      rollNotation: 'd20',
      type: 'initiative' as const,
      dc: null,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      deletedAt: null,
      rolls: [],
    }
    const event = makeEvent(
      { input },
      { fieldName: 'publishRollRequestCreated', parentTypeName: 'Mutation' }
    )

    const result = await handler(event, {} as never, vi.fn())

    expect(result).toEqual(input)
  })

  it('routes Mutation.publishInitiativeUpdated → pass-through (filters nulls)', async () => {
    const roll = {
      id: 'r-1',
      playTableId: 'pt-1',
      rollerId: 'p-1',
      rollNotation: 'd20',
      values: [18],
      modifier: 2,
      rollResult: 20,
      isPrivate: false,
      type: 'initiative' as const,
      rollRequestId: 'rr-1',
      createdAt: '2025-01-01T00:00:00.000Z',
      deletedAt: null,
    }
    const event = makeEvent(
      { input: { rolls: [roll] } },
      { fieldName: 'publishInitiativeUpdated', parentTypeName: 'Mutation' }
    )

    const result = await handler(event, {} as never, vi.fn())

    expect(result).toEqual([roll])
  })

  it('routes Mutation.publishRollCompleted → pass-through', async () => {
    const input = {
      id: 'r-1',
      playTableId: 'pt-1',
      rollerId: 'p-1',
      rollNotation: 'd20',
      values: [15],
      modifier: 0,
      rollResult: 15,
      isPrivate: false,
      type: null,
      rollRequestId: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      deletedAt: null,
    }
    const event = makeEvent(
      { input },
      { fieldName: 'publishRollCompleted', parentTypeName: 'Mutation' }
    )

    const result = await handler(event, {} as never, vi.fn())

    expect(result).toEqual(input)
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
