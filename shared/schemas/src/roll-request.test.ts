import { describe, expect, it } from 'vitest'

import { RollRequestSchema } from './roll-request'

describe('RollRequestSchema', () => {
  const validRollRequest = {
    id: 'rr-123',
    playTableId: 'pt-123',
    targetPlayerIds: ['pk-1', 'pk-2'],
    type: 'initiative',
    isPrivate: false,
    status: 'pending',
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

  it('accepts roll request with optional advantage', () => {
    expect(
      RollRequestSchema.safeParse({
        ...validRollRequest,
        advantage: 'advantage',
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

  it('accepts ad_hoc type', () => {
    expect(
      RollRequestSchema.safeParse({
        ...validRollRequest,
        type: 'ad_hoc',
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

  it('rejects missing status', () => {
    const { status, ...withoutStatus } = validRollRequest
    void status
    expect(RollRequestSchema.safeParse(withoutStatus).success).toBe(false)
  })
})
