import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MINIMAL_CONTEXT } from '../../../backend/test/lambda-context.js'
import type { RollRequest } from '../store/index.js'
import { handler } from './player-joined.js'

const mockStore = vi.hoisted(() => ({
  getActiveRollRequest: vi.fn(),
  listRollsForRequest: vi.fn(),
  addPlayerToRollRequest: vi.fn(),
}))

vi.mock('../store/index.js', () => ({
  createDiceRollerStore: () => mockStore,
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
    taskToken: 'task-token-123',
    ...overrides,
  }
}

describe('player-joined handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.getActiveRollRequest.mockReset()
    mockStore.listRollsForRequest.mockReset()
    mockStore.addPlayerToRollRequest.mockReset()
    process.env.TABLE_NAME = 'test-table'
  })

  it('returns early when player already in derived order (has prior roll)', async () => {
    mockStore.getActiveRollRequest.mockResolvedValue(rollRequest())
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
      {
        id: 'r-p3',
        playTableId: 'pt-1',
        rollerId: 'p3',
        rollNotation: 'd20',
        type: 'initiative',
        values: [14],
        modifier: 3,
        rollResult: 17,
        isPrivate: false,
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      },
    ])

    const event = {
      playTableId: 'pt-1',
      id: 'p3',
      characterName: 'Charlie',
      initiativeModifier: 3,
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockStore.getActiveRollRequest).toHaveBeenCalledWith('pt-1')
    expect(mockStore.listRollsForRequest).toHaveBeenCalledWith('pt-1', 'rr-1')
    expect(mockStore.addPlayerToRollRequest).not.toHaveBeenCalled()
  })

  it('updates RollRequest targetPlayerIds when player joins with no prior roll', async () => {
    mockStore.getActiveRollRequest.mockResolvedValue(rollRequest())
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

    const event = {
      playTableId: 'pt-1',
      id: 'p3',
      characterName: 'Charlie',
      initiativeModifier: 3,
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockStore.addPlayerToRollRequest).toHaveBeenCalledWith(
      'pt-1',
      'rr-1',
      'p3'
    )
  })

  it('returns early when no active roll request exists', async () => {
    mockStore.getActiveRollRequest.mockResolvedValue(null)

    const event = {
      playTableId: 'pt-1',
      id: 'p1',
      characterName: 'Alice',
      initiativeModifier: 3,
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockStore.getActiveRollRequest).toHaveBeenCalledTimes(1)
    expect(mockStore.listRollsForRequest).not.toHaveBeenCalled()
  })

  it('parses valid PlayerJoined detail without throwing', async () => {
    mockStore.getActiveRollRequest.mockResolvedValue(null)

    const event = {
      playTableId: 'pt-1',
      id: 'p1',
      characterName: 'Alice',
      initiativeModifier: 3,
    }

    await expect(
      handler(event, MINIMAL_CONTEXT, vi.fn())
    ).resolves.toBeUndefined()
  })

  it('returns early when joining player already in derived order (sorts by total)', async () => {
    mockStore.getActiveRollRequest.mockResolvedValue(rollRequest())
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
      {
        id: 'r-p3',
        playTableId: 'pt-1',
        rollerId: 'p3',
        rollNotation: 'd20',
        type: 'initiative',
        values: [17],
        modifier: 2,
        rollResult: 19,
        isPrivate: false,
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      },
    ])

    const event = {
      playTableId: 'pt-1',
      id: 'p3',
      characterName: 'Charlie',
      initiativeModifier: 2,
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockStore.addPlayerToRollRequest).not.toHaveBeenCalled()
  })

  it('returns early when joining player already in derived order (sorts by modifier)', async () => {
    mockStore.getActiveRollRequest.mockResolvedValue(rollRequest())
    mockStore.listRollsForRequest.mockResolvedValue([
      {
        id: 'r-p1',
        playTableId: 'pt-1',
        rollerId: 'p1',
        rollNotation: 'd20',
        type: 'initiative',
        values: [18],
        modifier: 1,
        rollResult: 19,
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
        values: [18],
        modifier: 0,
        rollResult: 19,
        isPrivate: false,
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      },
      {
        id: 'r-p3',
        playTableId: 'pt-1',
        rollerId: 'p3',
        rollNotation: 'd20',
        type: 'initiative',
        values: [18],
        modifier: 2,
        rollResult: 19,
        isPrivate: false,
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      },
    ])

    const event = {
      playTableId: 'pt-1',
      id: 'p3',
      characterName: 'Charlie',
      initiativeModifier: 2,
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockStore.addPlayerToRollRequest).not.toHaveBeenCalled()
  })

  it('returns early when player already in derived order', async () => {
    mockStore.getActiveRollRequest.mockResolvedValue(rollRequest())
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

    const event = {
      playTableId: 'pt-1',
      id: 'p1',
      characterName: 'Alice',
      initiativeModifier: 3,
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockStore.getActiveRollRequest).toHaveBeenCalledTimes(1)
    expect(mockStore.listRollsForRequest).toHaveBeenCalledTimes(1)
    expect(mockStore.addPlayerToRollRequest).not.toHaveBeenCalled()
  })
})
