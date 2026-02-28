import type {
  MutationSubmitDataArgs,
  SubmitDataResponse,
} from '@aws-step-function-test/graphql-types'
import type { AppSyncResolverEvent } from 'aws-lambda/trigger/appsync-resolver'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppSyncEvent } from '../../test/appsync-event.js'
import { MINIMAL_CONTEXT } from '../../test/lambda-context.js'
import { handler } from './submit-data'

async function invokeHandler(
  args: MutationSubmitDataArgs,
  identity?: AppSyncResolverEvent<MutationSubmitDataArgs>['identity']
): Promise<SubmitDataResponse> {
  const event = createAppSyncEvent(args, identity)
  const result = await handler(event, MINIMAL_CONTEXT, vi.fn())
  if (result === undefined) throw new Error('Handler returned void')
  return result
}

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
    const result = await invokeHandler(
      { source: 'test-source', payload: JSON.stringify({ key: 'value' }) },
      {
        sub: 'user-123',
      } as AppSyncResolverEvent<MutationSubmitDataArgs>['identity']
    )

    expect(result).toMatchObject({
      id: 'mock-uuid-123',
      status: 'SUBMITTED',
    })
    expect(typeof result.submittedAt).toBe('string')
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('uses anonymous when identity has no sub', async () => {
    const result = await invokeHandler(
      { source: 'test-source', payload: JSON.stringify({}) },
      null
    )

    expect(result.id).toBe('mock-uuid-123')
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('throws error when payload is invalid JSON', async () => {
    await expect(
      invokeHandler({ source: 'test-source', payload: 'not valid json' }, null)
    ).rejects.toThrow('Invalid JSON in payload')
  })

  it('throws error when payload is not an object', async () => {
    await expect(
      invokeHandler(
        { source: 'test-source', payload: JSON.stringify('string-value') },
        null
      )
    ).rejects.toThrow(/Invalid payload/)
  })
})
