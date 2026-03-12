import { marshall } from '@aws-sdk/util-dynamodb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MINIMAL_CONTEXT } from '../../../backend/test/lambda-context.js'
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

vi.mock('../shared/notify-appsync.js', () => ({
  publishInitiativeUpdated: vi.fn().mockResolvedValue(undefined),
}))

describe('player-left handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDynamoSend.mockReset()
    process.env.TABLE_NAME = 'test-table'
    process.env.PLAY_TABLE_NAME = 'test-play-table'
    process.env.APPSYNC_GRAPHQL_URL =
      'https://xxx.appsync-api.us-east-1.amazonaws.com/graphql'
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('{}') })
  })

  it('removes player from initiative order and notifies AppSync', async () => {
    const rollRequestItems: ReturnType<typeof marshall>[] = []
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
        playTableId: 'pt-1',
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
        playTableId: 'pt-1',
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
      .mockResolvedValueOnce({ Items: rollRequestItems })
      .mockResolvedValueOnce({ Item: metaItem })
      .mockResolvedValueOnce({ Items: rollItems })
      .mockResolvedValueOnce({ Item: playerItems[0] })
      .mockResolvedValueOnce({ Item: playerItems[1] })
      .mockResolvedValue({})

    const event = { playTableId: 'pt-1', id: 'p2' }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    const { publishInitiativeUpdated } =
      await import('../shared/notify-appsync.js')
    expect(publishInitiativeUpdated).toHaveBeenCalled()
    expect(publishInitiativeUpdated).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        rolls: expect.arrayContaining([
          expect.objectContaining({ rollerId: 'p1', rollResult: 20 }),
        ]),
      })
    )
    const callArgs = (publishInitiativeUpdated as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as { rolls: unknown[] }
    expect(callArgs.rolls).toHaveLength(1)
  })

  it('updates RollRequest and sends SendTaskSuccess when last target player leaves', async () => {
    const rollRequestItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'ROLLREQUEST#rr-1',
      id: 'rr-1',
      taskToken: 'token-123',
      targetPlayerIds: ['p2'],
      type: 'initiative',
      createdAt: '2024-01-01T00:00:00Z',
    })
    mockDynamoSend
      .mockResolvedValueOnce({ Items: [rollRequestItem] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValue({})

    const event = { playTableId: 'pt-1', id: 'p2' }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(3)
    expect(mockSfnSend).toHaveBeenCalledTimes(1)
    expect(mockSfnSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          taskToken: 'token-123',
        }),
      })
    )
  })

  it('parses valid PlayerLeft detail without throwing when no initiative state', async () => {
    mockDynamoSend
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValue({ Item: undefined })

    const event = { playTableId: 'pt-1', id: 'p1' }

    await expect(
      handler(event, MINIMAL_CONTEXT, vi.fn())
    ).resolves.toBeUndefined()
    expect(mockDynamoSend).toHaveBeenCalledTimes(2)
  })

  it('returns early when leaving player is not in any RollRequest targetPlayerIds', async () => {
    mockDynamoSend
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Item: undefined })

    const event = { playTableId: 'pt-1', id: 'p3' }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(2)
    expect(mockSfnSend).not.toHaveBeenCalled()
  })

  it('sends SendTaskSuccess when targetPlayerIds becomes empty after update', async () => {
    const rollRequestItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'ROLLREQUEST#rr-1',
      id: 'rr-1',
      taskToken: 'token-123',
      targetPlayerIds: ['p1'],
      type: 'initiative',
      createdAt: '2024-01-01T00:00:00Z',
    })
    mockDynamoSend
      .mockResolvedValueOnce({ Items: [rollRequestItem] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValue({})

    const event = { playTableId: 'pt-1', id: 'p1' }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(3)
    expect(mockSfnSend).toHaveBeenCalledTimes(1)
  })

  it('returns early when player not in derived initiative order', async () => {
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
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Item: metaItem })
      .mockResolvedValueOnce({ Items: rollItems })
      .mockResolvedValueOnce({ Item: playerItems[0] })
      .mockResolvedValueOnce({ Item: playerItems[1] })
      .mockResolvedValue({})

    const event = { playTableId: 'pt-1', id: 'p3' }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockFetch).not.toHaveBeenCalled()
  })
})
