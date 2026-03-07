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
  GetItemCommand: class MockGetItemCommand {
    input: unknown
    constructor(input: unknown) {
      this.input = input
    }
  },
  PutItemCommand: class MockPutItemCommand {
    input: unknown

    constructor(input: unknown) {
      this.input = input
    }
  },
}))

vi.mock('../handlers/shared/notify-appsync.js', () => ({
  notifyRollRequestCreated: vi.fn().mockResolvedValue(undefined),
}))

describe('create-initiative-pending handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
    mockSend.mockResolvedValue({})
  })

  it('writes INITIATIVE_PENDING to DynamoDB', async () => {
    process.env.APPSYNC_GRAPHQL_URL =
      'https://xxx.appsync-api.us-east-1.amazonaws.com/graphql'
    mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({
      Item: {
        PK: { S: 'PLAYTABLE#pt-1' },
        SK: { S: 'ROLLREQUEST#rr-1' },
        id: { S: 'rr-1' },
        playTableId: { S: 'pt-1' },
        targetPlayerIds: { L: [{ S: 'p1' }, { S: 'p2' }] },
        type: { S: 'initiative' },
        dc: { NULL: true },
        advantage: { NULL: true },
        isPrivate: { BOOL: false },
        status: { S: 'pending' },
        createdAt: { S: '2024-01-01T00:00:00Z' },
      },
    })

    const payload = {
      playTableId: 'pt-1',
      rollRequestId: 'rr-1',
      targetPlayerIds: ['p1', 'p2'],
      expectedCount: 2,
      taskToken: 'token-123',
    }

    await handler(payload, MINIMAL_CONTEXT, vi.fn())

    expect(mockSend).toHaveBeenCalledTimes(2)
  })
})
