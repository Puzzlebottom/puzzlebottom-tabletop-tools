import { describe, expect, it } from 'vitest'

import {
  RollerTypeSchema,
  RollRequestTypeSchema,
  RollSchema,
  VisibilitySchema,
} from './domain'

describe('RollerTypeSchema', () => {
  it('accepts gm and player', () => {
    expect(RollerTypeSchema.safeParse('gm').success).toBe(true)
    expect(RollerTypeSchema.safeParse('player').success).toBe(true)
  })

  it('rejects invalid values', () => {
    expect(RollerTypeSchema.safeParse('other').success).toBe(false)
    expect(RollerTypeSchema.safeParse('').success).toBe(false)
  })
})

describe('RollRequestTypeSchema', () => {
  it('accepts ad_hoc and initiative', () => {
    expect(RollRequestTypeSchema.safeParse('ad_hoc').success).toBe(true)
    expect(RollRequestTypeSchema.safeParse('initiative').success).toBe(true)
  })

  it('rejects invalid values', () => {
    expect(RollRequestTypeSchema.safeParse('other').success).toBe(false)
  })
})

describe('VisibilitySchema', () => {
  it('accepts all and gm_only', () => {
    expect(VisibilitySchema.safeParse('all').success).toBe(true)
    expect(VisibilitySchema.safeParse('gm_only').success).toBe(true)
  })

  it('rejects invalid values', () => {
    expect(VisibilitySchema.safeParse('public').success).toBe(false)
  })
})

describe('RollSchema', () => {
  const validRoll = {
    id: 'roll-123',
    playTableId: 'pt-123',
    rollerId: 'cognito-sub-abc',
    rollerType: 'gm' as const,
    diceType: 'd20',
    values: [15],
    modifier: 2,
    total: 17,
    advantage: null as const,
    dc: 15,
    success: true,
    visibility: 'all' as const,
    rollRequestType: 'ad_hoc' as const,
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

  it('accepts roll without rollRequestId', () => {
    expect(RollSchema.safeParse(validRoll).success).toBe(true)
  })

  it('accepts advantage and disadvantage', () => {
    expect(
      RollSchema.safeParse({ ...validRoll, advantage: 'advantage' }).success
    ).toBe(true)
    expect(
      RollSchema.safeParse({ ...validRoll, advantage: 'disadvantage' }).success
    ).toBe(true)
  })

  it('accepts multiple values for multi-dice (e.g. 2d6)', () => {
    expect(
      RollSchema.safeParse({
        ...validRoll,
        diceType: '2d6',
        values: [4, 6],
        total: 12,
      }).success
    ).toBe(true)
  })

  it('accepts two values for advantage/disadvantage (e.g. 2d20kh1)', () => {
    expect(
      RollSchema.safeParse({
        ...validRoll,
        values: [15, 8],
        advantage: 'advantage',
      }).success
    ).toBe(true)
  })

  it('accepts empty values array (GraphQL [Int!]! allows empty)', () => {
    expect(RollSchema.safeParse({ ...validRoll, values: [] }).success).toBe(
      true
    )
  })

  it('rejects invalid rollerType', () => {
    expect(
      RollSchema.safeParse({ ...validRoll, rollerType: 'npc' }).success
    ).toBe(false)
  })

  it('rejects invalid rollRequestType', () => {
    expect(
      RollSchema.safeParse({ ...validRoll, rollRequestType: 'saving_throw' })
        .success
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
