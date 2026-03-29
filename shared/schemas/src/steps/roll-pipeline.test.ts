import { describe, expect, it } from 'vitest'

import { GenerateAndStoreRollPayload } from './roll-pipeline'

const validBase = {
  rollId: 'roll-123',
  playTableId: 'pt-456',
  roller: { type: 'player' as const, rollerId: 'p-1' },
  rollNotation: 'd20',
  modifier: 0,
  isPrivate: false,
  rollRequestId: null,
  rollRequestType: 'ad_hoc' as const,
}

describe('GenerateAndStoreRollPayload', () => {
  it('accepts a valid payload', () => {
    expect(GenerateAndStoreRollPayload.safeParse(validBase).success).toBe(true)
  })

  it('accepts omitted rollRequestId', () => {
    const { rollRequestId, ...without } = validBase
    void rollRequestId
    expect(GenerateAndStoreRollPayload.safeParse(without).success).toBe(true)
  })

  it('accepts rollRequestId as a string', () => {
    expect(
      GenerateAndStoreRollPayload.safeParse({
        ...validBase,
        rollRequestId: 'rr-999',
      }).success
    ).toBe(true)
  })

  it('rejects unknown rollRequestType', () => {
    expect(
      GenerateAndStoreRollPayload.safeParse({
        ...validBase,
        rollRequestType: 'initiative_bonus',
      }).success
    ).toBe(false)
  })

  it.each([
    'rollId',
    'playTableId',
    'roller',
    'rollNotation',
    'modifier',
    'isPrivate',
    'rollRequestType',
  ] as const)('rejects missing %s', (field) => {
    const { [field]: _, ...without } = validBase
    void _
    expect(GenerateAndStoreRollPayload.safeParse(without).success).toBe(false)
  })
})
