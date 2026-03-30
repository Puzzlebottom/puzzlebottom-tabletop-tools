import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { IDiceRollerStore } from '../store/index.js'
import { createGenerateAndStoreRollHandler } from './generate-and-store-roll.js'

describe('generate-and-store-roll', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-01T12:00:00.000Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('puts roll via store and returns publish shape', async () => {
    const putRoll = vi.fn().mockResolvedValue(undefined)
    const store = { putRoll } as Pick<IDiceRollerStore, 'putRoll'>
    const handler = createGenerateAndStoreRollHandler(store as IDiceRollerStore)

    const event = {
      rollId: 'roll-1',
      playTableId: 'pt-1',
      roller: { type: 'player' as const, rollerId: 'p-1' },
      rollNotation: '1d20',
      modifier: 2,
      isPrivate: false,
      rollRequestId: 'rr-1',
      rollRequestType: 'initiative' as const,
    }

    await expect(handler(event, {} as never, () => undefined)).resolves.toEqual(
      {
        id: 'roll-1',
        playTableId: 'pt-1',
        rollerId: 'p-1',
        rollNotation: '1d20',
        type: 'initiative',
        values: [11],
        modifier: 2,
        rollResult: 13,
        isPrivate: false,
        rollRequestId: 'rr-1',
        createdAt: '2025-06-01T12:00:00.000Z',
        deletedAt: null,
      }
    )

    expect(putRoll).toHaveBeenCalledTimes(1)
    expect(putRoll).toHaveBeenCalledWith({
      id: 'roll-1',
      playTableId: 'pt-1',
      rollerId: 'p-1',
      rollNotation: '1d20',
      type: 'initiative',
      values: [11],
      modifier: 2,
      rollResult: 13,
      isPrivate: false,
      rollRequestId: 'rr-1',
      createdAt: '2025-06-01T12:00:00.000Z',
      deletedAt: null,
    })
  })

  it('stores null rollRequestId on the roll when absent', async () => {
    const putRoll = vi.fn().mockResolvedValue(undefined)
    const store = { putRoll } as Pick<IDiceRollerStore, 'putRoll'>
    const handler = createGenerateAndStoreRollHandler(store as IDiceRollerStore)

    const event = {
      rollId: 'roll-1',
      playTableId: 'pt-1',
      roller: { type: 'gm' as const, rollerId: 'gm-1' },
      rollNotation: '1d20',
      modifier: 0,
      isPrivate: true,
      rollRequestType: 'ad_hoc' as const,
    }

    await handler(event, {} as never, () => undefined)

    expect(putRoll).toHaveBeenCalledWith(
      expect.objectContaining({
        rollRequestId: null,
        type: null,
      })
    )
  })
})
