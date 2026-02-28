import { describe, expect, it } from 'vitest'

import { EventBridgeEventBodySchema } from './events'

const validDetail = {
  id: 'uuid-123',
  source: 'test-source',
  payload: { key: 'value' },
  submittedAt: '2025-01-01T00:00:00.000Z',
  submittedBy: 'user-1',
}

describe('EventBridgeEventBodySchema', () => {
  it('accepts valid event bodies', () => {
    expect(
      EventBridgeEventBodySchema.safeParse({ detail: validDetail }).success
    ).toBe(true)
  })

  it('rejects missing detail', () => {
    expect(EventBridgeEventBodySchema.safeParse({}).success).toBe(false)
  })

  it('rejects malformed detail', () => {
    expect(
      EventBridgeEventBodySchema.safeParse({ detail: { id: 'only' } }).success
    ).toBe(false)
  })

  it('rejects detail that is not an object', () => {
    expect(
      EventBridgeEventBodySchema.safeParse({ detail: 'string' }).success
    ).toBe(false)
  })
})
