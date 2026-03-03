import { marshall } from '@aws-sdk/util-dynamodb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MINIMAL_CONTEXT } from '../../test/lambda-context.js'
import { handler } from './player-joined.js'

const { mockDynamoSend, mockFetch } = vi.hoisted(() => ({
  mockDynamoSend: vi.fn(),
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
  QueryCommand: class {
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

describe('player-joined handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
    process.env.APPSYNC_GRAPHQL_URL =
      'https://xxx.appsync-api.us-east-1.amazonaws.com/graphql'
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('{}') })
  })

  it('amends INITIATIVE order when prior roll exists and notifies AppSync', async () => {
    const initiativeItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'INITIATIVE',
      rollRequestId: 'rr-1',
      order: [
        { id: 'p1', characterName: 'Alice', value: 18, modifier: 2, total: 20 },
        { id: 'p2', characterName: 'Bob', value: 15, modifier: 1, total: 16 },
      ],
    })
    const rollItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'ROLL#r-p3',
      rollerId: 'p3',
      values: [14],
      modifier: 3,
      total: 17,
      rollRequestType: 'initiative',
      rollRequestId: 'rr-1',
    })
    mockDynamoSend
      .mockResolvedValueOnce({ Item: initiativeItem })
      .mockResolvedValueOnce({
        Items: [rollItem],
      })
      .mockResolvedValue({})

    const event = {
      playTableId: 'pt-1',
      id: 'p3',
      characterName: 'Charlie',
      initiativeModifier: 3,
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(3)
    const putCall = mockDynamoSend.mock.calls[2]
    const putInput = (putCall?.[0] as { input?: unknown })?.input as {
      Item?: {
        order?: {
          L?: { M?: Record<string, { S?: string; N?: string }> }[]
        }
      }
    }
    const order = putInput?.Item?.order?.L ?? []
    expect(order).toHaveLength(3)
    const p3Entry = order.find((e) => e?.M?.id?.S === 'p3')
    expect(p3Entry?.M?.characterName?.S).toBe('Charlie')
    expect(p3Entry?.M?.total?.N).toBe('17')
  })

  it('creates RollRequest when INITIATIVE_PENDING exists and no prior roll', async () => {
    const pendingItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'INITIATIVE_PENDING',
      taskToken: 'token-123',
      rollRequestId: 'rr-1',
      expectedPlayerKeys: ['p1', 'p2'],
      completedPlayerKeys: ['p1'],
    })
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValueOnce({ Item: pendingItem })
      .mockResolvedValue({})

    const event = {
      playTableId: 'pt-1',
      id: 'p3',
      characterName: 'Charlie',
      initiativeModifier: 3,
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(3)
    const putCall = mockDynamoSend.mock.calls[2]
    const putInput = (putCall?.[0] as { input?: unknown })?.input as {
      Item?: Record<string, { S?: string; L?: unknown[] }>
    }
    expect(putInput?.Item?.SK?.S).toBeDefined()
    expect(putInput?.Item?.SK?.S?.startsWith('ROLLREQUEST#')).toBe(true)
    const targetIds = putInput?.Item?.targetPlayerIds as { L: { S: string }[] }
    expect(targetIds?.L?.map((x) => x.S)).toEqual(['p3'])
    expect(putInput?.Item?.type?.S).toBe('initiative')
  })

  it('returns early when no initiative state exists', async () => {
    mockDynamoSend.mockResolvedValue({ Item: undefined })

    const event = {
      playTableId: 'pt-1',
      id: 'p1',
      characterName: 'Alice',
      initiativeModifier: 3,
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(2)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('parses valid PlayerJoined detail without throwing', async () => {
    mockDynamoSend.mockResolvedValue({ Item: undefined })

    const event = {
      playTableId: 'pt-1',
      id: 'p1',
      characterName: 'Alice',
      initiativeModifier: 3,
    }

    await expect(
      handler(event, MINIMAL_CONTEXT, vi.fn())
    ).resolves.toBeUndefined()
  })

  it('sorts new entry by total then value then modifier when adding to order', async () => {
    const initiativeItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'INITIATIVE',
      rollRequestId: 'rr-1',
      order: [
        { id: 'p1', characterName: 'Alice', value: 18, modifier: 2, total: 20 },
        { id: 'p2', characterName: 'Bob', value: 15, modifier: 1, total: 16 },
      ],
    })
    const rollItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'ROLL#r-p3',
      rollerId: 'p3',
      values: [17],
      modifier: 2,
      total: 19,
      rollRequestType: 'initiative',
      rollRequestId: 'rr-1',
    })
    mockDynamoSend
      .mockResolvedValueOnce({ Item: initiativeItem })
      .mockResolvedValueOnce({ Items: [rollItem] })
      .mockResolvedValue({})

    const event = {
      playTableId: 'pt-1',
      id: 'p3',
      characterName: 'Charlie',
      initiativeModifier: 2,
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    const putCall = mockDynamoSend.mock.calls[2]
    const putInput = (putCall?.[0] as { input?: unknown })?.input as {
      Item?: { order?: { L?: { M?: { id?: { S?: string } } }[] } }
    }
    const order = putInput?.Item?.order?.L ?? []
    expect(order).toHaveLength(3)
    const ids = order.map((e) => e?.M?.id?.S)
    expect(ids).toEqual(['p1', 'p3', 'p2'])
  })

  it('amends order when prior roll has no rollRequestId and initiative has no rollRequestId', async () => {
    const initiativeItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'INITIATIVE',
      order: [
        { id: 'p1', characterName: 'Alice', value: 18, modifier: 2, total: 20 },
      ],
    })
    const rollItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'ROLL#r-p2',
      rollerId: 'p2',
      values: [12],
      modifier: 1,
      total: 13,
      rollRequestType: 'initiative',
      rollRequestId: null,
    })
    mockDynamoSend
      .mockResolvedValueOnce({ Item: initiativeItem })
      .mockResolvedValueOnce({ Items: [rollItem] })
      .mockResolvedValue({})

    const event = {
      playTableId: 'pt-1',
      id: 'p2',
      characterName: 'Bob',
      initiativeModifier: 1,
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(3)
    const putCall = mockDynamoSend.mock.calls[2]
    const putInput = (putCall?.[0] as { input?: unknown })?.input as {
      Item?: { order?: { L?: { M?: { id?: { S?: string } } }[] } }
    }
    const order = putInput?.Item?.order?.L ?? []
    expect(order).toHaveLength(2)
    expect(order?.[1]?.M?.id?.S).toBe('p2')
  })

  it('sorts by modifier when total and value are tied', async () => {
    const initiativeItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'INITIATIVE',
      rollRequestId: 'rr-1',
      order: [
        { id: 'p1', characterName: 'Alice', value: 18, modifier: 1, total: 19 },
        { id: 'p2', characterName: 'Bob', value: 18, modifier: 0, total: 19 },
      ],
    })
    const rollItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'ROLL#r-p3',
      rollerId: 'p3',
      values: [18],
      modifier: 2,
      total: 19,
      rollRequestType: 'initiative',
      rollRequestId: 'rr-1',
    })
    mockDynamoSend
      .mockResolvedValueOnce({ Item: initiativeItem })
      .mockResolvedValueOnce({ Items: [rollItem] })
      .mockResolvedValue({})

    const event = {
      playTableId: 'pt-1',
      id: 'p3',
      characterName: 'Charlie',
      initiativeModifier: 2,
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    const putCall = mockDynamoSend.mock.calls[2]
    const putInput = (putCall?.[0] as { input?: unknown })?.input as {
      Item?: {
        order?: {
          L?: { M?: { id?: { S?: string }; modifier?: { N?: string } } }[]
        }
      }
    }
    const order = putInput?.Item?.order?.L ?? []
    expect(order).toHaveLength(3)
    expect(order?.[0]?.M?.id?.S).toBe('p3')
    expect(order?.[0]?.M?.modifier?.N).toBe('2')
    expect(order?.[1]?.M?.id?.S).toBe('p1')
    expect(order?.[2]?.M?.id?.S).toBe('p2')
  })

  it('returns early when player already in INITIATIVE order', async () => {
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
      .mockResolvedValueOnce({ Item: initiativeItem })
      .mockResolvedValue({})

    const event = {
      playTableId: 'pt-1',
      id: 'p1',
      characterName: 'Alice',
      initiativeModifier: 3,
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(1)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
