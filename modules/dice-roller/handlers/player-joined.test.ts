import { marshall } from '@aws-sdk/util-dynamodb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MINIMAL_CONTEXT } from '../../../backend/test/lambda-context.js'
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
  UpdateItemCommand: class {
    input: unknown
    constructor(i: unknown) {
      this.input = i
    }
  },
}))

vi.stubGlobal('fetch', mockFetch)

vi.mock('../shared/notify-appsync.js', () => ({
  publishInitiativeUpdated: vi.fn().mockResolvedValue(undefined),
}))

describe('player-joined handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDynamoSend.mockReset()
    process.env.TABLE_NAME = 'test-table'
    process.env.PLAY_TABLE_NAME = 'test-play-table'
    process.env.APPSYNC_GRAPHQL_URL =
      'https://xxx.appsync-api.us-east-1.amazonaws.com/graphql'
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('{}') })
  })

  it('returns early when player already in derived order (has prior roll)', async () => {
    const metaItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'INITIATIVE_META',
      currentRollRequestId: 'rr-1',
    })
    const rollItems = [
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: 'ROLL#r-p1',
        id: 'r-p1',
        rollerId: 'p1',
        rollNotation: 'd20',
        values: [18],
        modifier: 2,
        rollResult: 20,
        isPrivate: false,
        type: 'initiative',
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      }),
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: 'ROLL#r-p2',
        id: 'r-p2',
        rollerId: 'p2',
        rollNotation: 'd20',
        values: [15],
        modifier: 1,
        rollResult: 16,
        isPrivate: false,
        type: 'initiative',
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      }),
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: 'ROLL#r-p3',
        id: 'r-p3',
        rollerId: 'p3',
        rollNotation: 'd20',
        values: [14],
        modifier: 3,
        rollResult: 17,
        isPrivate: false,
        type: 'initiative',
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      }),
    ]
    const playerItems = ['p1', 'p2', 'p3'].map((id) =>
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: `PLAYER#${id}`,
        id,
        characterName: id === 'p1' ? 'Alice' : id === 'p2' ? 'Bob' : 'Charlie',
      })
    )
    mockDynamoSend
      .mockResolvedValueOnce({ Item: metaItem })
      .mockResolvedValueOnce({ Items: rollItems })
      .mockResolvedValueOnce({ Item: playerItems[0] })
      .mockResolvedValueOnce({ Item: playerItems[1] })
      .mockResolvedValueOnce({ Item: playerItems[2] })
      .mockResolvedValue({})

    const event = {
      playTableId: 'pt-1',
      id: 'p3',
      characterName: 'Charlie',
      initiativeModifier: 3,
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(2)
    const { publishInitiativeUpdated } =
      await import('../shared/notify-appsync.js')
    expect(publishInitiativeUpdated).not.toHaveBeenCalled()
  })

  it('updates RollRequest targetPlayerIds when player joins with no prior roll', async () => {
    const metaItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'INITIATIVE_META',
      currentRollRequestId: 'rr-1',
    })
    const rollItems = [
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: 'ROLL#r-p1',
        id: 'r-p1',
        rollerId: 'p1',
        rollNotation: 'd20',
        values: [18],
        modifier: 2,
        rollResult: 20,
        isPrivate: false,
        type: 'initiative',
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      }),
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: 'ROLL#r-p2',
        id: 'r-p2',
        rollerId: 'p2',
        rollNotation: 'd20',
        values: [15],
        modifier: 1,
        rollResult: 16,
        isPrivate: false,
        type: 'initiative',
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      }),
    ]
    const rollRequestItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'ROLLREQUEST#rr-1',
      id: 'rr-1',
      targetPlayerIds: ['p1', 'p2'],
      type: 'initiative',
      taskToken: 'task-token-123',
    })
    mockDynamoSend
      .mockResolvedValueOnce({ Item: metaItem })
      .mockResolvedValueOnce({ Items: rollItems })
      .mockResolvedValueOnce({ Item: rollRequestItem })
      .mockResolvedValueOnce({})

    const event = {
      playTableId: 'pt-1',
      id: 'p3',
      characterName: 'Charlie',
      initiativeModifier: 3,
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(4)
    const updateCall = mockDynamoSend.mock.calls[3]
    const updateInput = (updateCall?.[0] as { input?: unknown })?.input as {
      Key?: { PK?: { S?: string }; SK?: { S?: string } }
      ExpressionAttributeValues?: { ':t': { L?: { S: string }[] } }
    }
    expect(updateInput?.Key?.SK?.S).toContain('ROLLREQUEST#')
    const targetIds = updateInput?.ExpressionAttributeValues?.[':t']?.L?.map(
      (x) => x.S
    )
    expect(targetIds).toEqual(['p1', 'p2', 'p3'])
  })

  it('returns early when no initiative meta exists', async () => {
    mockDynamoSend.mockResolvedValue({ Item: undefined })

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

  it('returns early when joining player already in derived order (sorts by total)', async () => {
    const metaItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'INITIATIVE_META',
      currentRollRequestId: 'rr-1',
    })
    const rollItems = [
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: 'ROLL#r-p1',
        id: 'r-p1',
        rollerId: 'p1',
        rollNotation: 'd20',
        values: [18],
        modifier: 2,
        rollResult: 20,
        isPrivate: false,
        type: 'initiative',
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      }),
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: 'ROLL#r-p2',
        id: 'r-p2',
        rollerId: 'p2',
        rollNotation: 'd20',
        values: [15],
        modifier: 1,
        rollResult: 16,
        isPrivate: false,
        type: 'initiative',
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      }),
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: 'ROLL#r-p3',
        id: 'r-p3',
        rollerId: 'p3',
        rollNotation: 'd20',
        values: [17],
        modifier: 2,
        rollResult: 19,
        isPrivate: false,
        type: 'initiative',
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      }),
    ]
    const playerItems = ['p1', 'p2', 'p3'].map((id) =>
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: `PLAYER#${id}`,
        id,
        characterName: id === 'p1' ? 'Alice' : id === 'p2' ? 'Bob' : 'Charlie',
      })
    )
    mockDynamoSend
      .mockResolvedValueOnce({ Item: metaItem })
      .mockResolvedValueOnce({ Items: rollItems })
      .mockResolvedValueOnce({ Item: playerItems[0] })
      .mockResolvedValueOnce({ Item: playerItems[1] })
      .mockResolvedValueOnce({ Item: playerItems[2] })
      .mockResolvedValue({})

    const event = {
      playTableId: 'pt-1',
      id: 'p3',
      characterName: 'Charlie',
      initiativeModifier: 2,
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    const { publishInitiativeUpdated } =
      await import('../shared/notify-appsync.js')
    expect(publishInitiativeUpdated).not.toHaveBeenCalled()
  })

  it('returns early when joining player already in derived order (sorts by modifier)', async () => {
    const metaItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'INITIATIVE_META',
      currentRollRequestId: 'rr-1',
    })
    const rollItems = [
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: 'ROLL#r-p1',
        id: 'r-p1',
        rollerId: 'p1',
        rollNotation: 'd20',
        values: [18],
        modifier: 1,
        rollResult: 19,
        isPrivate: false,
        type: 'initiative',
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      }),
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: 'ROLL#r-p2',
        id: 'r-p2',
        rollerId: 'p2',
        rollNotation: 'd20',
        values: [18],
        modifier: 0,
        rollResult: 19,
        isPrivate: false,
        type: 'initiative',
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      }),
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: 'ROLL#r-p3',
        id: 'r-p3',
        rollerId: 'p3',
        rollNotation: 'd20',
        values: [18],
        modifier: 2,
        rollResult: 19,
        isPrivate: false,
        type: 'initiative',
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      }),
    ]
    const playerItems = ['p1', 'p2', 'p3'].map((id) =>
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: `PLAYER#${id}`,
        id,
        characterName: id === 'p1' ? 'Alice' : id === 'p2' ? 'Bob' : 'Charlie',
      })
    )
    mockDynamoSend
      .mockResolvedValueOnce({ Item: metaItem })
      .mockResolvedValueOnce({ Items: rollItems })
      .mockResolvedValueOnce({ Item: playerItems[0] })
      .mockResolvedValueOnce({ Item: playerItems[1] })
      .mockResolvedValueOnce({ Item: playerItems[2] })
      .mockResolvedValue({})

    const event = {
      playTableId: 'pt-1',
      id: 'p3',
      characterName: 'Charlie',
      initiativeModifier: 2,
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    const { publishInitiativeUpdated } =
      await import('../shared/notify-appsync.js')
    expect(publishInitiativeUpdated).not.toHaveBeenCalled()
  })

  it('returns early when player already in derived order', async () => {
    const metaItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'INITIATIVE_META',
      currentRollRequestId: 'rr-1',
    })
    const rollItems = [
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: 'ROLL#r-p1',
        id: 'r-p1',
        rollerId: 'p1',
        rollNotation: 'd20',
        values: [18],
        modifier: 2,
        rollResult: 20,
        isPrivate: false,
        type: 'initiative',
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      }),
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: 'ROLL#r-p2',
        id: 'r-p2',
        rollerId: 'p2',
        rollNotation: 'd20',
        values: [15],
        modifier: 1,
        rollResult: 16,
        isPrivate: false,
        type: 'initiative',
        rollRequestId: 'rr-1',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      }),
    ]
    const playerItems = ['p1', 'p2'].map((id) =>
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: `PLAYER#${id}`,
        id,
        characterName: id === 'p1' ? 'Alice' : 'Bob',
      })
    )
    mockDynamoSend
      .mockResolvedValueOnce({ Item: metaItem })
      .mockResolvedValueOnce({ Items: rollItems })
      .mockResolvedValueOnce({ Item: playerItems[0] })
      .mockResolvedValueOnce({ Item: playerItems[1] })
      .mockResolvedValue({})

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
})
