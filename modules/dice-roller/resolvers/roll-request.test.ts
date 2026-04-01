import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppSyncEvent } from '../../../backend/test/appsync-event.js'
import { handler } from './roll-request.js'

const mockApp = {
  createRollRequest: vi.fn(),
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

describe('roll-request handler routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PLAY_TABLE_NAME = 'test-play-table'
    process.env.DICE_ROLLER_TABLE_NAME = 'test-dice-roller'
    process.env.ROLL_REQUEST_STATE_MACHINE_ARN = 'arn:test:rr'
    process.env.ROLL_STATE_MACHINE_ARN = 'arn:test:roll'
  })

  it('routes Mutation.createRollRequest → app.createRollRequest(gmUserId, playTableId, input)', async () => {
    mockApp.createRollRequest.mockResolvedValue({ id: 'rr-1' })
    const input = {
      targetPlayerIds: ['p-1'],
      type: 'initiative',
      diceNotation: 'd20',
      dc: null,
      isPrivate: false,
    }
    const event = makeEvent(
      { playTableId: 'pt-1', input },
      {
        fieldName: 'createRollRequest',
        parentTypeName: 'Mutation',
        identity: { sub: 'gm-1' },
      }
    )

    await handler(event, {} as never, vi.fn())

    expect(mockApp.createRollRequest).toHaveBeenCalledWith(
      'gm-1',
      'pt-1',
      input
    )
  })

  it('throws for Mutation.createRollRequest without Cognito identity', async () => {
    const event = makeEvent(
      { playTableId: 'pt-1', input: {} },
      { fieldName: 'createRollRequest', parentTypeName: 'Mutation' }
    )

    await expect(handler(event, {} as never, vi.fn())).rejects.toThrow(
      'Unauthorized'
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
