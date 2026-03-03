import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MINIMAL_CONTEXT } from '../../test/lambda-context.js'
import { handler } from './order-initiative'

const { mockDynamoSend, mockFetch } = vi.hoisted(() => {
  process.env.TABLE_NAME = 'test-table'
  process.env.APPSYNC_GRAPHQL_URL =
    'https://xxx.appsync-api.us-east-1.amazonaws.com/graphql'
  process.env.AWS_REGION = 'us-east-1'
  return {
    mockDynamoSend: vi.fn(),
    mockFetch: vi.fn(),
  }
})

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(function () {
    return { send: mockDynamoSend }
  }),
  GetItemCommand: class {
    input: unknown
    constructor(i: unknown) {
      this.input = i
    }
  },
  PutItemCommand: class {
    input: unknown
    constructor(i: unknown) {
      this.input = i
    }
  },
  QueryCommand: class {
    input: unknown
    constructor(i: unknown) {
      this.input = i
    }
  },
}))

vi.stubGlobal('fetch', mockFetch)

describe('order-initiative handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDynamoSend
      .mockResolvedValueOnce({
        Item: {
          PK: { S: 'PLAYTABLE#pt-1' },
          SK: { S: 'INITIATIVE_PENDING' },
          taskToken: { S: 't' },
          rollRequestId: { S: 'rr-1' },
          expectedPlayerKeys: { L: [] },
          completedPlayerKeys: { L: [] },
        },
      })
      .mockResolvedValueOnce({
        Items: [
          {
            PK: { S: 'PLAYTABLE#pt-1' },
            SK: { S: 'ROLL#r1' },
            rollerId: { S: 'p1' },
            values: { L: [{ N: '15' }] },
            modifier: { N: '2' },
            total: { N: '17' },
            rollRequestType: { S: 'initiative' },
            rollRequestId: { S: 'rr-1' },
          },
        ],
      })
      .mockResolvedValueOnce({
        Item: {
          PK: { S: 'PLAYTABLE#pt-1' },
          SK: { S: 'PLAYER#p1' },
          characterName: { S: 'Alice' },
        },
      })
      .mockResolvedValue({})

    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('{}') })
  })

  it('fetches rolls, sorts, writes INITIATIVE, and notifies AppSync', async () => {
    const payload = {
      playTableId: 'pt-1',
      rollRequestId: 'rr-1',
      targetPlayerIds: ['p1'],
      expectedCount: 1,
    }

    await handler(payload, MINIMAL_CONTEXT)

    expect(mockDynamoSend).toHaveBeenCalledTimes(4)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const putCmd = mockDynamoSend.mock.calls[3]?.[0] as {
      input?: { Item?: Record<string, unknown> }
    }
    const putInput = putCmd?.input
    const item = putInput?.Item as Record<
      string,
      {
        S?: string
        L?: { M?: Record<string, { S?: string; N?: string }> }[]
      }
    >
    expect(item?.PK?.S).toBe('PLAYTABLE#pt-1')
    expect(item?.SK?.S).toBe('INITIATIVE')
    const order = item?.order?.L
    expect(order).toHaveLength(1)
    expect(order?.[0]?.M?.id?.S).toBe('p1')
    expect(order?.[0]?.M?.characterName?.S).toBe('Alice')
    expect(order?.[0]?.M?.total?.N).toBe('17')
  })
})
