import { describe, expect, it } from 'vitest'

import { RollRequestSchema } from './domain'

describe('RollRequestSchema', () => {
  const validRollRequest = {
    id: 'rr-123',
    playTableId: 'pt-123',
    targetPlayerIds: ['pk-1', 'pk-2'],
    type: 'initiative' as const,
    isPrivate: false,
    rollNotation: 'd20',
    rolls: [],
    createdAt: '2025-01-01T00:00:00.000Z',
  }

  it('accepts valid roll request', () => {
    expect(RollRequestSchema.safeParse(validRollRequest).success).toBe(true)
  })

  it('accepts roll request with optional dc', () => {
    expect(
      RollRequestSchema.safeParse({ ...validRollRequest, dc: 15 }).success
    ).toBe(true)
  })

  it('accepts roll request with rolls', () => {
    expect(
      RollRequestSchema.safeParse({
        ...validRollRequest,
        rolls: [
          {
            id: 'r-1',
            playTableId: 'pt-123',
            rollerId: 'roller-1',
            rollNotation: 'd20',
            values: [15],
            modifier: 2,
            rollResult: 17,
            isPrivate: false,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }).success
    ).toBe(true)
  })

  it('accepts empty targetPlayerIds', () => {
    expect(
      RollRequestSchema.safeParse({
        ...validRollRequest,
        targetPlayerIds: [],
      }).success
    ).toBe(true)
  })

  it('rejects invalid type', () => {
    expect(
      RollRequestSchema.safeParse({
        ...validRollRequest,
        type: 'saving_throw',
      }).success
    ).toBe(false)
  })

  it('rejects missing id', () => {
    const { id, ...withoutId } = validRollRequest
    void id
    expect(RollRequestSchema.safeParse(withoutId).success).toBe(false)
  })

  it('rejects missing playTableId', () => {
    const { playTableId, ...withoutPlayTableId } = validRollRequest
    void playTableId
    expect(RollRequestSchema.safeParse(withoutPlayTableId).success).toBe(false)
  })

  it('rejects missing targetPlayerIds', () => {
    const { targetPlayerIds, ...withoutTargets } = validRollRequest
    void targetPlayerIds
    expect(RollRequestSchema.safeParse(withoutTargets).success).toBe(false)
  })

  it('rejects targetPlayerIds that is not an array', () => {
    expect(
      RollRequestSchema.safeParse({
        ...validRollRequest,
        targetPlayerIds: 'pk-1',
      }).success
    ).toBe(false)
  })

  it('rejects missing isPrivate', () => {
    const { isPrivate, ...withoutIsPrivate } = validRollRequest
    void isPrivate
    expect(RollRequestSchema.safeParse(withoutIsPrivate).success).toBe(false)
  })

  it('rejects missing rollNotation', () => {
    const { rollNotation, ...withoutRollNotation } = validRollRequest
    void rollNotation
    expect(RollRequestSchema.safeParse(withoutRollNotation).success).toBe(false)
  })

  it('rejects missing rolls', () => {
    const { rolls, ...withoutRolls } = validRollRequest
    void rolls
    expect(RollRequestSchema.safeParse(withoutRolls).success).toBe(false)
  })
})
