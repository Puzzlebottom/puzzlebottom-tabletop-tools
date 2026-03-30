import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MINIMAL_CONTEXT } from '../../../backend/test/lambda-context.js'
import type { RollRequest } from '../store/index.js'
import { handler } from './player-left.js'

const { mockStore, mockSfnSend, mockFetch } = vi.hoisted(() => ({
  mockStore: {
    getActiveRollRequest: vi.fn(),
    removePlayerFromActiveRollRequest: vi.fn(),
    isRollRequestFulfilled: vi.fn(),
    listRollsForRequest: vi.fn(),
  },
  mockSfnSend: vi.fn(),
  mockFetch: vi.fn(),
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

vi.stubGlobal('fetch', mockFetch)

vi.mock('../shared/notify-appsync.js', () => ({
  publishInitiativeUpdated: vi.fn().mockResolvedValue(undefined),
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
    ...overrides,
  }
}

describe('player-left handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.getActiveRollRequest.mockReset()
    mockStore.removePlayerFromActiveRollRequest.mockReset()
    mockStore.isRollRequestFulfilled.mockReset()
    mockStore.listRollsForRequest.mockReset()
    mockSfnSend.mockReset()
    process.env.TABLE_NAME = 'test-table'
    process.env.PLAY_TABLE_NAME = 'test-play-table'
    process.env.APPSYNC_GRAPHQL_URL =
      'https://xxx.appsync-api.us-east-1.amazonaws.com/graphql'
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('{}') })
  })

  it('removes player from initiative order and notifies AppSync', async () => {
    mockStore.getActiveRollRequest
      .mockResolvedValueOnce(
        rollRequest({ targetPlayerIds: ['p1', 'p2'], taskToken: undefined })
      )
      .mockResolvedValueOnce(
        rollRequest({ targetPlayerIds: ['p1', 'p2'], taskToken: undefined })
      )
    mockStore.removePlayerFromActiveRollRequest.mockResolvedValue(undefined)
    mockStore.listRollsForRequest.mockResolvedValue([
      {
        id: 'r-p1',
        playTableId: 'pt-1',
        rollerId: 'p1',
        rollNotation: 'd20',
        type: 'initiative',
        values: [18],
        modifier: 2,
        rollResult: 20,
        isPrivate: false,
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      },
      {
        id: 'r-p2',
        playTableId: 'pt-1',
        rollerId: 'p2',
        rollNotation: 'd20',
        type: 'initiative',
        values: [15],
        modifier: 1,
        rollResult: 16,
        isPrivate: false,
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      },
    ])

    const event = { playTableId: 'pt-1', id: 'p2' }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    const { publishInitiativeUpdated } =
      await import('../shared/notify-appsync.js')
    expect(publishInitiativeUpdated).toHaveBeenCalled()
    expect(publishInitiativeUpdated).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        rolls: expect.arrayContaining([
          expect.objectContaining({ rollerId: 'p1', rollResult: 20 }),
        ]),
      })
    )
    const callArgs = (publishInitiativeUpdated as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as { rolls: unknown[] }
    expect(callArgs.rolls).toHaveLength(1)
  })

  it('updates RollRequest and sends SendTaskSuccess when last target player leaves', async () => {
    mockStore.getActiveRollRequest
      .mockResolvedValueOnce(
        rollRequest({
          targetPlayerIds: ['p2'],
          taskToken: 'token-123',
        })
      )
      .mockResolvedValueOnce(
        rollRequest({
          targetPlayerIds: [],
          taskToken: 'token-123',
        })
      )
    mockStore.removePlayerFromActiveRollRequest.mockResolvedValue(undefined)
    mockStore.listRollsForRequest.mockResolvedValue([])

    const event = { playTableId: 'pt-1', id: 'p2' }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockSfnSend).toHaveBeenCalledTimes(1)
    expect(mockSfnSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          taskToken: 'token-123',
        }),
      })
    )
  })

  it('parses valid PlayerLeft detail without throwing when no initiative state', async () => {
    mockStore.getActiveRollRequest.mockResolvedValue(null)
    mockStore.removePlayerFromActiveRollRequest.mockResolvedValue(undefined)

    const event = { playTableId: 'pt-1', id: 'p1' }

    await expect(
      handler(event, MINIMAL_CONTEXT, vi.fn())
    ).resolves.toBeUndefined()
    expect(mockStore.getActiveRollRequest).toHaveBeenCalledTimes(1)
    expect(mockStore.removePlayerFromActiveRollRequest).toHaveBeenCalledWith(
      'pt-1',
      'p1'
    )
  })

  it('returns early when leaving player is not in any RollRequest targetPlayerIds', async () => {
    mockStore.getActiveRollRequest
      .mockResolvedValueOnce(rollRequest({ targetPlayerIds: ['p1', 'p2'] }))
      .mockResolvedValueOnce(rollRequest({ targetPlayerIds: ['p1', 'p2'] }))
    mockStore.removePlayerFromActiveRollRequest.mockResolvedValue(undefined)
    mockStore.listRollsForRequest.mockResolvedValue([
      {
        id: 'r-p1',
        playTableId: 'pt-1',
        rollerId: 'p1',
        rollNotation: 'd20',
        type: 'initiative',
        values: [18],
        modifier: 2,
        rollResult: 20,
        isPrivate: false,
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      },
      {
        id: 'r-p2',
        playTableId: 'pt-1',
        rollerId: 'p2',
        rollNotation: 'd20',
        type: 'initiative',
        values: [15],
        modifier: 1,
        rollResult: 16,
        isPrivate: false,
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      },
    ])

    const event = { playTableId: 'pt-1', id: 'p3' }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockSfnSend).not.toHaveBeenCalled()
    const { publishInitiativeUpdated } =
      await import('../shared/notify-appsync.js')
    expect(publishInitiativeUpdated).not.toHaveBeenCalled()
  })

  it('sends SendTaskSuccess when targetPlayerIds becomes empty after update', async () => {
    mockStore.getActiveRollRequest
      .mockResolvedValueOnce(
        rollRequest({
          targetPlayerIds: ['p1'],
          taskToken: 'token-123',
        })
      )
      .mockResolvedValueOnce(
        rollRequest({
          targetPlayerIds: [],
          taskToken: 'token-123',
        })
      )
    mockStore.removePlayerFromActiveRollRequest.mockResolvedValue(undefined)
    mockStore.listRollsForRequest.mockResolvedValue([])

    const event = { playTableId: 'pt-1', id: 'p1' }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockSfnSend).toHaveBeenCalledTimes(1)
  })

  it('returns early when player not in derived initiative order', async () => {
    mockStore.getActiveRollRequest
      .mockResolvedValueOnce(rollRequest({ targetPlayerIds: ['p1', 'p2'] }))
      .mockResolvedValueOnce(rollRequest({ targetPlayerIds: ['p1', 'p2'] }))
    mockStore.removePlayerFromActiveRollRequest.mockResolvedValue(undefined)
    mockStore.listRollsForRequest.mockResolvedValue([
      {
        id: 'r-p1',
        playTableId: 'pt-1',
        rollerId: 'p1',
        rollNotation: 'd20',
        type: 'initiative',
        values: [18],
        modifier: 2,
        rollResult: 20,
        isPrivate: false,
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      },
      {
        id: 'r-p2',
        playTableId: 'pt-1',
        rollerId: 'p2',
        rollNotation: 'd20',
        type: 'initiative',
        values: [15],
        modifier: 1,
        rollResult: 16,
        isPrivate: false,
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      },
    ])

    const event = { playTableId: 'pt-1', id: 'p3' }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockFetch).not.toHaveBeenCalled()
  })
})
