import { beforeEach, describe, expect, it, vi } from 'vitest'

import { handler } from './submit-data'

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}))

vi.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: vi.fn(function () {
    return { send: mockSend }
  }),
  PutEventsCommand: class MockPutEventsCommand {
    constructor() {
      // no-op
    }
  },
}))

vi.mock('crypto', () => ({
  randomUUID: () => 'mock-uuid-123',
}))

describe('submit-data handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.EVENT_BUS_NAME = 'test-event-bus'
    mockSend.mockResolvedValue({})
  })

  it('publishes to EventBridge and returns submit response', async () => {
    const event = {
      arguments: {
        source: 'test-source',
        payload: JSON.stringify({ key: 'value' }),
      },
      identity: { sub: 'user-123' },
    }

    const result = await handler(event as never, {} as never, () => {})

    expect(result).toEqual({
      id: 'mock-uuid-123',
      status: 'SUBMITTED',
      submittedAt: expect.any(String),
    })
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('uses anonymous when identity has no sub', async () => {
    const event = {
      arguments: {
        source: 'test-source',
        payload: JSON.stringify({}),
      },
      identity: null,
    }

    const result = await handler(event as never, {} as never, () => {})

    expect(result.id).toBe('mock-uuid-123')
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('throws error when payload is invalid JSON', async () => {
    const event = {
      arguments: {
        source: 'test-source',
        payload: 'not valid json',
      },
      identity: null,
    }

    await expect(
      handler(event as never, {} as never, () => {})
    ).rejects.toThrow('Invalid JSON in payload')
  })

  it('throws error when payload is not an object', async () => {
    const event = {
      arguments: {
        source: 'test-source',
        payload: JSON.stringify('string-value'),
      },
      identity: null,
    }

    await expect(
      handler(event as never, {} as never, () => {})
    ).rejects.toThrow(/Invalid payload/)
  })
})
