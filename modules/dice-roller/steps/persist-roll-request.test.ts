import { describe, expect, it, vi } from 'vitest'

import type { IDiceRollerStore } from '../store/index.js'
import { createPersistRollRequestHandler } from './persist-roll-request.js'

describe('persist-roll-request', () => {
  it('puts roll request via store and returns the parsed payload', async () => {
    const putRollRequest = vi.fn().mockResolvedValue(undefined)
    const store = { putRollRequest } as Pick<IDiceRollerStore, 'putRollRequest'>
    const handler = createPersistRollRequestHandler(store as IDiceRollerStore)

    const payload = {
      playTableId: 'pt-1',
      rollRequestId: 'rr-1',
      targetPlayerIds: ['p-1'],
      rollNotation: '1d20',
      type: 'initiative' as const,
      dc: null as number | null,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    }

    await expect(
      handler(payload, {} as never, () => undefined)
    ).resolves.toEqual(payload)

    expect(putRollRequest).toHaveBeenCalledTimes(1)
    expect(putRollRequest).toHaveBeenCalledWith({
      id: 'rr-1',
      playTableId: 'pt-1',
      targetPlayerIds: ['p-1'],
      rollNotation: '1d20',
      type: 'initiative',
      dc: null,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      deletedAt: null,
    })
  })
})
