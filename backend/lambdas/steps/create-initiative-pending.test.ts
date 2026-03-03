import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MINIMAL_CONTEXT } from '../../test/lambda-context.js'
import { handler } from './create-initiative-pending'

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({}),
}))

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(function () {
    return { send: mockSend }
  }),
  PutItemCommand: class MockPutItemCommand {
    input: unknown

    constructor(input: unknown) {
      this.input = input
    }
  },
}))

describe('create-initiative-pending handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
    mockSend.mockResolvedValue({})
  })

  it('writes INITIATIVE_PENDING to DynamoDB', async () => {
    const payload = {
      playTableId: 'pt-1',
      rollRequestId: 'rr-1',
      targetPlayerIds: ['p1', 'p2'],
      expectedCount: 2,
      taskToken: 'token-123',
    }

    await handler(payload, MINIMAL_CONTEXT)

    expect(mockSend).toHaveBeenCalledTimes(1)
  })
})
