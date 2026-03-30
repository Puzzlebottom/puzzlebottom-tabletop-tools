import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { IDiceRollerStore } from '../store/index.js'
import { createInitiativeCreateHandler } from './initiative-create-handler.js'

const { mockPublish } = vi.hoisted(() => ({
  mockPublish: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../shared/notify-appsync.js', () => ({
  publishRollRequestCreated: mockPublish,
}))

describe('initiative-create-handler', () => {
  beforeEach(() => {
    mockPublish.mockClear()
  })

  it('sets task token, loads roll request, then publishes to AppSync', async () => {
    const setRollRequestTaskToken = vi.fn().mockResolvedValue(undefined)
    const rollRequest = {
      id: 'rr-1',
      playTableId: 'pt-1',
      targetPlayerIds: ['p-1'],
      rollNotation: '1d20',
      type: 'initiative' as const,
      dc: null as number | null,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      deletedAt: null as string | null,
    }
    const getRollRequest = vi.fn().mockResolvedValue(rollRequest)
    const store = {
      setRollRequestTaskToken,
      getRollRequest,
    } as Pick<IDiceRollerStore, 'setRollRequestTaskToken' | 'getRollRequest'>

    const handler = createInitiativeCreateHandler(store as IDiceRollerStore, {
      graphqlUrl: 'https://appsync.example/graphql',
    })

    await handler(
      {
        playTableId: 'pt-1',
        rollRequestId: 'rr-1',
        targetPlayerIds: ['p-1'],
        rollNotation: '1d20',
        type: 'initiative',
        isPrivate: false,
        createdAt: '2025-01-01T00:00:00.000Z',
        taskToken: 'token-abc',
      },
      {} as never,
      () => undefined
    )

    expect(setRollRequestTaskToken.mock.invocationCallOrder[0]).toBeLessThan(
      getRollRequest.mock.invocationCallOrder[0]
    )
    expect(setRollRequestTaskToken).toHaveBeenCalledWith(
      'pt-1',
      'rr-1',
      'token-abc'
    )
    expect(getRollRequest).toHaveBeenCalledWith('pt-1', 'rr-1')
    expect(mockPublish).toHaveBeenCalledWith(
      'https://appsync.example/graphql',
      {
        id: 'rr-1',
        playTableId: 'pt-1',
        targetPlayerIds: ['p-1'],
        rolls: [],
        rollNotation: '1d20',
        type: 'initiative',
        dc: null,
        isPrivate: false,
        createdAt: '2025-01-01T00:00:00.000Z',
        deletedAt: null,
      }
    )
  })

  it('does not publish when roll request is missing', async () => {
    const setRollRequestTaskToken = vi.fn().mockResolvedValue(undefined)
    const getRollRequest = vi.fn().mockResolvedValue(null)
    const store = {
      setRollRequestTaskToken,
      getRollRequest,
    } as Pick<IDiceRollerStore, 'setRollRequestTaskToken' | 'getRollRequest'>

    const handler = createInitiativeCreateHandler(store as IDiceRollerStore, {
      graphqlUrl: 'https://appsync.example/graphql',
    })

    await handler(
      {
        playTableId: 'pt-1',
        rollRequestId: 'rr-1',
        targetPlayerIds: ['p-1'],
        rollNotation: '1d20',
        type: 'initiative',
        isPrivate: false,
        createdAt: '2025-01-01T00:00:00.000Z',
        taskToken: 'token-abc',
      },
      {} as never,
      () => undefined
    )

    expect(mockPublish).not.toHaveBeenCalled()
  })
})
