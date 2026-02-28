import { describe, expect, it } from 'vitest'

import { DataRecordSchema, PayloadSchema } from './data-record'

describe('PayloadSchema', () => {
  it('accepts valid objects', () => {
    expect(PayloadSchema.safeParse({ key: 'value' }).success).toBe(true)
    expect(PayloadSchema.safeParse({ a: 1, b: null }).success).toBe(true)
    expect(PayloadSchema.safeParse({}).success).toBe(true)
  })

  it('rejects arrays', () => {
    expect(PayloadSchema.safeParse([]).success).toBe(false)
  })

  it('rejects strings', () => {
    expect(PayloadSchema.safeParse('foo').success).toBe(false)
  })

  it('rejects null', () => {
    expect(PayloadSchema.safeParse(null).success).toBe(false)
  })
})

describe('DataRecordSchema', () => {
  const validRecord = {
    id: 'uuid-123',
    source: 'test-source',
    payload: { key: 'value' },
    submittedAt: '2025-01-01T00:00:00.000Z',
    submittedBy: 'user-1',
  }

  it('accepts valid records', () => {
    expect(DataRecordSchema.safeParse(validRecord).success).toBe(true)
  })

  it('rejects missing id', () => {
    const { id, ...withoutId } = validRecord
    void id
    expect(DataRecordSchema.safeParse(withoutId).success).toBe(false)
  })

  it('rejects missing source', () => {
    const { source, ...withoutSource } = validRecord
    void source
    expect(DataRecordSchema.safeParse(withoutSource).success).toBe(false)
  })

  it('rejects missing payload', () => {
    const { payload, ...withoutPayload } = validRecord
    void payload
    expect(DataRecordSchema.safeParse(withoutPayload).success).toBe(false)
  })

  it('rejects payload that is not an object', () => {
    expect(
      DataRecordSchema.safeParse({ ...validRecord, payload: [] }).success
    ).toBe(false)
  })

  it('rejects missing submittedAt', () => {
    const { submittedAt, ...withoutSubmittedAt } = validRecord
    void submittedAt
    expect(DataRecordSchema.safeParse(withoutSubmittedAt).success).toBe(false)
  })

  it('rejects missing submittedBy', () => {
    const { submittedBy, ...withoutSubmittedBy } = validRecord
    void submittedBy
    expect(DataRecordSchema.safeParse(withoutSubmittedBy).success).toBe(false)
  })
})
