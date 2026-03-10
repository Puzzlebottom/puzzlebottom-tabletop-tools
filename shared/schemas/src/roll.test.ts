import { describe, expect, it } from 'vitest'

import { RollSchema, RollTypeSchema } from './domain'

describe('RollTypeSchema', () => {
  it('accepts initiative', () => {
    expect(RollTypeSchema.safeParse('initiative').success).toBe(true)
  })

  it('rejects invalid values', () => {
    expect(RollTypeSchema.safeParse('other').success).toBe(false)
    expect(RollTypeSchema.safeParse('ad_hoc').success).toBe(false)
    expect(RollTypeSchema.safeParse('').success).toBe(false)
  })
})

describe('RollSchema', () => {
  const validRoll = {
    id: 'roll-123',
    playTableId: 'pt-123',
    rollerId: 'cognito-sub-abc',
    rollNotation: 'd20',
    values: [15],
    modifier: 2,
    rollResult: 17,
    isPrivate: false,
    createdAt: '2025-01-01T00:00:00.000Z',
  }

  it('accepts valid roll', () => {
    expect(RollSchema.safeParse(validRoll).success).toBe(true)
  })

  it('accepts roll with optional rollRequestId', () => {
    expect(
      RollSchema.safeParse({ ...validRoll, rollRequestId: 'rr-456' }).success
    ).toBe(true)
  })

  it('accepts roll with optional type', () => {
    expect(
      RollSchema.safeParse({ ...validRoll, type: 'initiative' }).success
    ).toBe(true)
  })

  it('accepts roll without rollRequestId', () => {
    expect(RollSchema.safeParse(validRoll).success).toBe(true)
  })

  it('accepts multiple values for multi-dice (e.g. 2d6)', () => {
    expect(
      RollSchema.safeParse({
        ...validRoll,
        rollNotation: '2d6',
        values: [4, 6],
        rollResult: 10,
      }).success
    ).toBe(true)
  })

  it('accepts empty values array (GraphQL [Int!]! allows empty)', () => {
    expect(
      RollSchema.safeParse({ ...validRoll, values: [], rollResult: 0 }).success
    ).toBe(true)
  })

  it('rejects invalid type', () => {
    expect(
      RollSchema.safeParse({ ...validRoll, type: 'saving_throw' }).success
    ).toBe(false)
  })

  it('rejects missing required fields', () => {
    const { id, ...withoutId } = validRoll
    void id
    expect(RollSchema.safeParse(withoutId).success).toBe(false)
  })

  it('rejects values that is not an array of numbers', () => {
    expect(RollSchema.safeParse({ ...validRoll, values: '15' }).success).toBe(
      false
    )
    expect(RollSchema.safeParse({ ...validRoll, values: ['15'] }).success).toBe(
      false
    )
  })
})
