import { describe, expect, it } from 'vitest'

import {
  InitiativeCreateHandlerPayload,
  RollRequestStepPayload,
} from './roll-request-pipeline'

const validBase = {
  playTableId: 'pt-123',
  rollRequestId: 'rr-456',
  targetPlayerIds: ['p-1', 'p-2'],
  rollNotation: 'd20',
  type: 'initiative' as const,
  dc: null,
  isPrivate: false,
  createdAt: '2025-01-01T00:00:00.000Z',
}

describe('RollRequestStepPayload', () => {
  it('accepts a valid payload', () => {
    expect(RollRequestStepPayload.safeParse(validBase).success).toBe(true)
  })

  it('accepts omitted dc', () => {
    const { dc, ...withoutDc } = validBase
    void dc
    expect(RollRequestStepPayload.safeParse(withoutDc).success).toBe(true)
  })

  it.each([
    'playTableId',
    'rollRequestId',
    'targetPlayerIds',
    'rollNotation',
    'type',
    'isPrivate',
    'createdAt',
  ] as const)('rejects missing %s', (field) => {
    const { [field]: _, ...without } = validBase
    void _
    expect(RollRequestStepPayload.safeParse(without).success).toBe(false)
  })

  it('rejects unknown roll type', () => {
    expect(
      RollRequestStepPayload.safeParse({ ...validBase, type: 'ad_hoc' }).success
    ).toBe(false)
  })
})

describe('InitiativeCreateHandlerPayload', () => {
  const valid = { ...validBase, taskToken: 'token-abc' }

  it('accepts a valid payload with taskToken', () => {
    expect(InitiativeCreateHandlerPayload.safeParse(valid).success).toBe(true)
  })

  it('rejects missing taskToken', () => {
    expect(InitiativeCreateHandlerPayload.safeParse(validBase).success).toBe(
      false
    )
  })
})
