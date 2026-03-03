import { marshall } from '@aws-sdk/util-dynamodb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MINIMAL_CONTEXT } from '../../test/lambda-context.js'
import { handler } from './roll-completed.js'

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

describe('roll-completed handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
    process.env.APPSYNC_GRAPHQL_URL =
      'https://xxx.appsync-api.us-east-1.amazonaws.com/graphql'
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('{}') })
  })

  it('updates completedPlayerKeys and sends SendTaskSuccess when all players rolled', async () => {
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

    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestId: 'rr-1',
      rollRequestType: 'initiative' as const,
      rollerId: 'p2',
      rollerType: 'player' as const,
      values: [15],
      modifier: 2,
      total: 17,
    }

    await handler(event, MINIMAL_CONTEXT)

    expect(mockDynamoSend).toHaveBeenCalledTimes(2)
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

  it('updates completedPlayerKeys but does not SendTaskSuccess when not all rolled', async () => {
    const pendingItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'INITIATIVE_PENDING',
      taskToken: 'token-123',
      rollRequestId: 'rr-1',
      expectedPlayerKeys: ['p1', 'p2', 'p3'],
      completedPlayerKeys: ['p1'],
    })
    mockDynamoSend
      .mockResolvedValueOnce({ Item: pendingItem })
      .mockResolvedValue({})

    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestId: 'rr-1',
      rollRequestType: 'initiative' as const,
      rollerId: 'p2',
      rollerType: 'player' as const,
      values: [12],
      modifier: 1,
      total: 13,
    }

    await handler(event, MINIMAL_CONTEXT)

    expect(mockDynamoSend).toHaveBeenCalledTimes(2)
    expect(mockSfnSend).not.toHaveBeenCalled()
  })

  it('adds late joiner to INITIATIVE and notifies AppSync', async () => {
    const playerItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'PLAYER#p3',
      characterName: 'Charlie',
    })
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
      .mockResolvedValueOnce({ Item: playerItem })
      .mockResolvedValue({})

    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestId: 'rr-1',
      rollRequestType: 'initiative' as const,
      rollerId: 'p3',
      rollerType: 'player' as const,
      values: [14],
      modifier: 3,
      total: 17,
    }

    await handler(event, MINIMAL_CONTEXT)

    expect(mockDynamoSend).toHaveBeenCalledTimes(4)
    const putCall = mockDynamoSend.mock.calls[3]
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

  it('parses valid RollCompleted detail without throwing when no initiative state', async () => {
    mockDynamoSend.mockResolvedValue({ Item: undefined })

    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestType: 'initiative' as const,
      rollerId: 'p1',
      rollerType: 'player' as const,
      values: [15],
      modifier: 2,
      total: 17,
    }

    await expect(handler(event, MINIMAL_CONTEXT)).resolves.toBeUndefined()
    expect(mockDynamoSend).toHaveBeenCalledTimes(2)
  })
})
