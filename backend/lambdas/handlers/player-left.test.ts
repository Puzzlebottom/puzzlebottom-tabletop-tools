import { marshall } from '@aws-sdk/util-dynamodb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MINIMAL_CONTEXT } from '../../test/lambda-context.js'
import { handler } from './player-left.js'

const { mockDynamoSend, mockSfnSend, mockFetch } = vi.hoisted(() => ({
  mockDynamoSend: vi.fn(),
  mockSfnSend: vi.fn(),
  mockFetch: vi.fn(),
}))

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
  UpdateItemCommand: class {
    input: unknown
    constructor(i: unknown) {
      this.input = i
    }
  },
}))

vi.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: vi.fn(function () {
    return { send: mockSfnSend }
  }),
  SendTaskSuccessCommand: class {
    input: unknown
    constructor(i: unknown) {
      this.input = i
    }
  },
}))

vi.stubGlobal('fetch', mockFetch)

vi.mock('./shared/notify-appsync.js', () => ({
  notifyInitiativeUpdated: vi.fn().mockResolvedValue(undefined),
}))

describe('player-left handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
    process.env.APPSYNC_GRAPHQL_URL =
      'https://xxx.appsync-api.us-east-1.amazonaws.com/graphql'
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('{}') })
  })

  it('removes player from INITIATIVE order and notifies AppSync', async () => {
    const initiativeItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'INITIATIVE',
      rollRequestId: 'rr-1',
      order: [
        { id: 'p1', characterName: 'Alice', value: 18, modifier: 2, total: 20 },
        { id: 'p2', characterName: 'Bob', value: 15, modifier: 1, total: 16 },
      ],
    })
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValueOnce({ Item: initiativeItem })
      .mockResolvedValue({})

    const event = { playTableId: 'pt-1', id: 'p2' }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(3)
    const putCall = mockDynamoSend.mock.calls[2]
    const putInput = (putCall?.[0] as { input?: unknown })?.input as {
      Item?: { order?: { L?: { M?: { id?: { S?: string } } }[] } }
    }
    const order = putInput?.Item?.order?.L ?? []
    expect(order).toHaveLength(1)
    expect(order?.[0]?.M?.id?.S).toBe('p1')
  })

  it('removes player from INITIATIVE_PENDING and sends SendTaskSuccess when last expected leaves', async () => {
    const pendingItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'INITIATIVE_PENDING',
      taskToken: 'token-123',
      rollRequestId: 'rr-1',
      expectedPlayerKeys: ['p1', 'p2'],
      completedPlayerKeys: ['p1'],
    })
    mockDynamoSend
      .mockResolvedValueOnce({ Item: pendingItem })
      .mockResolvedValue({})

    const event = { playTableId: 'pt-1', id: 'p2' }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(3)
    expect(mockSfnSend).toHaveBeenCalledTimes(1)
    expect(mockSfnSend).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest matcher
        input: expect.objectContaining({
          taskToken: 'token-123',
        }),
      })
    )
  })

  it('parses valid PlayerLeft detail without throwing when no initiative state', async () => {
    mockDynamoSend.mockResolvedValue({ Item: undefined })

    const event = { playTableId: 'pt-1', id: 'p1' }

    await expect(
      handler(event, MINIMAL_CONTEXT, vi.fn())
    ).resolves.toBeUndefined()
    expect(mockDynamoSend).toHaveBeenCalledTimes(2)
  })

  it('returns early when leaving player is not in expectedPlayerKeys', async () => {
    const pendingItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'INITIATIVE_PENDING',
      taskToken: 'token-123',
      rollRequestId: 'rr-1',
      expectedPlayerKeys: ['p1', 'p2'],
      completedPlayerKeys: ['p1'],
    })
    mockDynamoSend
      .mockResolvedValueOnce({ Item: pendingItem })
      .mockResolvedValue({})

    const event = { playTableId: 'pt-1', id: 'p3' }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(1)
    expect(mockSfnSend).not.toHaveBeenCalled()
  })

  it('updates INITIATIVE_PENDING with empty arrays when last expected player leaves', async () => {
    const pendingItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'INITIATIVE_PENDING',
      taskToken: 'token-123',
      rollRequestId: 'rr-1',
      expectedPlayerKeys: ['p1'],
      completedPlayerKeys: ['p1'],
    })
    mockDynamoSend
      .mockResolvedValueOnce({ Item: pendingItem })
      .mockResolvedValue({})

    const event = { playTableId: 'pt-1', id: 'p1' }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(2)
    expect(mockSfnSend).not.toHaveBeenCalled()
  })

  it('returns early when player not in INITIATIVE order', async () => {
    const initiativeItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'INITIATIVE',
      rollRequestId: 'rr-1',
      order: [
        { id: 'p1', characterName: 'Alice', value: 18, modifier: 2, total: 20 },
        { id: 'p2', characterName: 'Bob', value: 15, modifier: 1, total: 16 },
      ],
    })
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValueOnce({ Item: initiativeItem })
      .mockResolvedValue({})

    const event = { playTableId: 'pt-1', id: 'p3' }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(2)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
