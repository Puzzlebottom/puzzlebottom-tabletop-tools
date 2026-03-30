import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MINIMAL_CONTEXT } from '../../../backend/test/lambda-context.js'
import type { RollRequest } from '../store/index.js'
import { handler } from './roll-completed.js'

const { mockStore, mockSfnSend } = vi.hoisted(() => ({
  mockStore: {
    getRollRequest: vi.fn(),
    isRollRequestFulfilled: vi.fn(),
    listRollsForRequest: vi.fn(),
  },
  mockSfnSend: vi.fn(),
}))

vi.mock('../store/index.js', () => ({
  createDiceRollerStore: () => mockStore,
}))

vi.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: vi.fn(function () {
    return { send: mockSfnSend }
  }),
  SendTaskSuccessCommand: class {
    input: unknown
    constructor(i: unknown) {
      this.input = i
    }
  },
}))

function rollRequest(overrides: Partial<RollRequest> = {}): RollRequest {
  return {
    id: 'rr-1',
    playTableId: 'pt-1',
    targetPlayerIds: ['p1', 'p2'],
    rollNotation: 'd20',
    type: 'initiative',
    dc: null,
    isPrivate: false,
    createdAt: '2024-01-01T00:00:00Z',
    deletedAt: null,
    taskToken: 'token-123',
    ...overrides,
  }
}

describe('roll-completed handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.getRollRequest.mockReset()
    mockStore.isRollRequestFulfilled.mockReset()
    mockStore.listRollsForRequest.mockReset()
    mockSfnSend.mockReset()
    process.env.TABLE_NAME = 'test-table'
  })

  it('derives completion from rolls and sends SendTaskSuccess when all players rolled', async () => {
    mockStore.getRollRequest.mockResolvedValue(rollRequest())
    mockStore.isRollRequestFulfilled.mockResolvedValue(true)
    mockStore.listRollsForRequest.mockResolvedValue([
      {
        id: 'roll-1',
        playTableId: 'pt-1',
        rollerId: 'p1',
        rollNotation: 'd20',
        type: 'initiative',
        values: [10],
        modifier: 0,
        rollResult: 10,
        isPrivate: false,
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      },
      {
        id: 'roll-2',
        playTableId: 'pt-1',
        rollerId: 'p2',
        rollNotation: 'd20',
        type: 'initiative',
        values: [15],
        modifier: 2,
        rollResult: 17,
        isPrivate: false,
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      },
    ])

    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-2',
      rollRequestId: 'rr-1',
      type: 'initiative' as const,
      rollerId: 'p2',
      rollNotation: 'd20',
      values: [15],
      modifier: 2,
      rollResult: 17,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockStore.getRollRequest).toHaveBeenCalledWith('pt-1', 'rr-1')
    expect(mockStore.isRollRequestFulfilled).toHaveBeenCalledWith(
      'pt-1',
      'rr-1'
    )
    expect(mockStore.listRollsForRequest).toHaveBeenCalledWith('pt-1', 'rr-1')
    expect(mockSfnSend).toHaveBeenCalledTimes(1)
    const sfnCall = mockSfnSend.mock.calls[0]?.[0] as {
      input?: { taskToken?: string; output?: string }
    }
    expect(sfnCall?.input?.taskToken).toBe('token-123')
    expect(sfnCall?.input?.output).toContain('"playTableId":"pt-1"')
  })

  it('does not SendTaskSuccess when not all players have rolled', async () => {
    mockStore.getRollRequest.mockResolvedValue(
      rollRequest({ targetPlayerIds: ['p1', 'p2', 'p3'] })
    )
    mockStore.isRollRequestFulfilled.mockResolvedValue(false)

    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestId: 'rr-1',
      type: 'initiative' as const,
      rollerId: 'p2',
      rollNotation: 'd20',
      values: [12],
      modifier: 1,
      rollResult: 13,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockStore.listRollsForRequest).not.toHaveBeenCalled()
    expect(mockSfnSend).not.toHaveBeenCalled()
  })

  it('parses valid RollCompleted detail without throwing when no rollRequestId', async () => {
    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      type: 'initiative' as const,
      rollerId: 'p1',
      rollNotation: 'd20',
      values: [15],
      modifier: 2,
      rollResult: 17,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    }

    await expect(
      handler(event, MINIMAL_CONTEXT, vi.fn())
    ).resolves.toBeUndefined()
    expect(mockStore.getRollRequest).not.toHaveBeenCalled()
  })

  it('returns early when RollRequest not found', async () => {
    mockStore.getRollRequest.mockResolvedValue(null)

    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestId: 'rr-1',
      type: 'initiative' as const,
      rollerId: 'p1',
      rollNotation: 'd20',
      values: [15],
      modifier: 2,
      rollResult: 17,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockStore.getRollRequest).toHaveBeenCalledTimes(1)
    expect(mockStore.isRollRequestFulfilled).not.toHaveBeenCalled()
  })

  it('returns early when RollRequest has no taskToken', async () => {
    mockStore.getRollRequest.mockResolvedValue(
      rollRequest({ taskToken: undefined })
    )

    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestId: 'rr-1',
      type: 'initiative' as const,
      rollerId: 'p1',
      rollNotation: 'd20',
      values: [15],
      modifier: 2,
      rollResult: 17,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockStore.getRollRequest).toHaveBeenCalledTimes(1)
    expect(mockStore.isRollRequestFulfilled).not.toHaveBeenCalled()
  })

  it('returns early when rollerId not in targetPlayerIds', async () => {
    mockStore.getRollRequest.mockResolvedValue(rollRequest())

    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestId: 'rr-1',
      type: 'initiative' as const,
      rollerId: 'p3',
      rollNotation: 'd20',
      values: [15],
      modifier: 2,
      rollResult: 17,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockStore.getRollRequest).toHaveBeenCalledTimes(1)
    expect(mockStore.isRollRequestFulfilled).not.toHaveBeenCalled()
  })

  it('returns early when not all target players have rolled', async () => {
    mockStore.getRollRequest.mockResolvedValue(rollRequest())
    mockStore.isRollRequestFulfilled.mockResolvedValue(false)

    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestId: 'rr-1',
      type: 'initiative' as const,
      rollerId: 'p1',
      rollNotation: 'd20',
      values: [15],
      modifier: 2,
      rollResult: 17,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockStore.isRollRequestFulfilled).toHaveBeenCalledTimes(1)
    expect(mockStore.listRollsForRequest).not.toHaveBeenCalled()
    expect(mockSfnSend).not.toHaveBeenCalled()
  })
})
