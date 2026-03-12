import { marshall } from '@aws-sdk/util-dynamodb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MINIMAL_CONTEXT } from '../../../backend/test/lambda-context.js'
import { handler } from './roll-completed.js'

const { mockDynamoSend, mockSfnSend } = vi.hoisted(() => ({
  mockDynamoSend: vi.fn(),
  mockSfnSend: vi.fn(),
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

describe('roll-completed handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TABLE_NAME = 'test-table'
  })

  it('derives completion from rolls and sends SendTaskSuccess when all players rolled', async () => {
    const rollRequestItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'ROLLREQUEST#rr-1',
      taskToken: 'token-123',
      targetPlayerIds: ['p1', 'p2'],
      createdAt: '2024-01-01T00:00:00Z',
      initiatedBy: 'gm-sub',
      type: 'initiative',
    })
    const rollItems = [
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: 'ROLL#roll-1',
        id: 'roll-1',
        rollerId: 'p1',
        rollRequestId: 'rr-1',
      }),
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: 'ROLL#roll-2',
        id: 'roll-2',
        rollerId: 'p2',
        rollRequestId: 'rr-1',
      }),
    ]
    mockDynamoSend
      .mockResolvedValueOnce({ Item: rollRequestItem })
      .mockResolvedValueOnce({ Items: rollItems })

    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-2',
      rollRequestId: 'rr-1',
      type: 'initiative' as const,
      rollerId: 'p2',
      rollNotation: 'd20',
      values: [15],
      modifier: 2,
      rollResult: 17,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(2)
    expect(mockSfnSend).toHaveBeenCalledTimes(1)
    const sfnCall = mockSfnSend.mock.calls[0]?.[0] as {
      input?: { taskToken?: string; output?: string }
    }
    expect(sfnCall?.input?.taskToken).toBe('token-123')
    expect(sfnCall?.input?.output).toContain('"playTableId":"pt-1"')
  })

  it('does not SendTaskSuccess when not all players have rolled', async () => {
    const rollRequestItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'ROLLREQUEST#rr-1',
      taskToken: 'token-123',
      targetPlayerIds: ['p1', 'p2', 'p3'],
      createdAt: '2024-01-01T00:00:00Z',
      initiatedBy: 'gm-sub',
      type: 'initiative',
    })
    const rollItems = [
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: 'ROLL#roll-1',
        id: 'roll-1',
        rollerId: 'p1',
        rollRequestId: 'rr-1',
      }),
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: 'ROLL#roll-2',
        id: 'roll-2',
        rollerId: 'p2',
        rollRequestId: 'rr-1',
      }),
    ]
    mockDynamoSend
      .mockResolvedValueOnce({ Item: rollRequestItem })
      .mockResolvedValueOnce({ Items: rollItems })

    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestId: 'rr-1',
      type: 'initiative' as const,
      rollerId: 'p2',
      rollNotation: 'd20',
      values: [12],
      modifier: 1,
      rollResult: 13,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(2)
    expect(mockSfnSend).not.toHaveBeenCalled()
  })

  it('parses valid RollCompleted detail without throwing when no rollRequestId', async () => {
    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      type: 'initiative' as const,
      rollerId: 'p1',
      rollNotation: 'd20',
      values: [15],
      modifier: 2,
      rollResult: 17,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    }

    await expect(
      handler(event, MINIMAL_CONTEXT, vi.fn())
    ).resolves.toBeUndefined()
    expect(mockDynamoSend).not.toHaveBeenCalled()
  })

  it('returns early when RollRequest not found', async () => {
    mockDynamoSend.mockResolvedValueOnce({ Item: undefined })

    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestId: 'rr-1',
      type: 'initiative' as const,
      rollerId: 'p1',
      rollNotation: 'd20',
      values: [15],
      modifier: 2,
      rollResult: 17,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(1)
  })

  it('returns early when RollRequest has no taskToken', async () => {
    const rollRequestItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'ROLLREQUEST#rr-1',
      targetPlayerIds: ['p1'],
      createdAt: '2024-01-01T00:00:00Z',
      initiatedBy: 'gm-sub',
      type: 'initiative',
    })
    mockDynamoSend.mockResolvedValueOnce({ Item: rollRequestItem })

    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestId: 'rr-1',
      type: 'initiative' as const,
      rollerId: 'p1',
      rollNotation: 'd20',
      values: [15],
      modifier: 2,
      rollResult: 17,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(1)
  })

  it('returns early when rollerId not in targetPlayerIds', async () => {
    const rollRequestItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'ROLLREQUEST#rr-1',
      taskToken: 'token-123',
      targetPlayerIds: ['p1', 'p2'],
      createdAt: '2024-01-01T00:00:00Z',
      initiatedBy: 'gm-sub',
      type: 'initiative',
    })
    mockDynamoSend.mockResolvedValueOnce({ Item: rollRequestItem })

    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestId: 'rr-1',
      type: 'initiative' as const,
      rollerId: 'p3',
      rollNotation: 'd20',
      values: [15],
      modifier: 2,
      rollResult: 17,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(1)
  })

  it('returns early when not all target players have rolled', async () => {
    const rollRequestItem = marshall({
      PK: 'PLAYTABLE#pt-1',
      SK: 'ROLLREQUEST#rr-1',
      taskToken: 'token-123',
      targetPlayerIds: ['p1', 'p2'],
      createdAt: '2024-01-01T00:00:00Z',
      initiatedBy: 'gm-sub',
      type: 'initiative',
    })
    const rollItems = [
      marshall({
        PK: 'PLAYTABLE#pt-1',
        SK: 'ROLL#roll-1',
        id: 'roll-1',
        rollerId: 'p1',
        rollRequestId: 'rr-1',
      }),
    ]
    mockDynamoSend
      .mockResolvedValueOnce({ Item: rollRequestItem })
      .mockResolvedValueOnce({ Items: rollItems })

    const event = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestId: 'rr-1',
      type: 'initiative' as const,
      rollerId: 'p1',
      rollNotation: 'd20',
      values: [15],
      modifier: 2,
      rollResult: 17,
      isPrivate: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    }

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockDynamoSend).toHaveBeenCalledTimes(2)
    expect(mockSfnSend).not.toHaveBeenCalled()
  })
})
