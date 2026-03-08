import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MINIMAL_CONTEXT } from '../../test/lambda-context.js'
import { createSqsEvent } from '../../test/sqs-event.js'
import { handler } from './trigger'

const { mockLambdaSend, mockInvokeCommand } = vi.hoisted(() => {
  process.env.ROLL_COMPLETED_HANDLER_ARN =
    'arn:aws:lambda:us-east-1:123:function:roll-completed'
  process.env.PLAYER_LEFT_HANDLER_ARN =
    'arn:aws:lambda:us-east-1:123:function:player-left'
  process.env.PLAYER_JOINED_HANDLER_ARN =
    'arn:aws:lambda:us-east-1:123:function:player-joined'
  return {
    mockLambdaSend: vi.fn(),
    mockInvokeCommand: vi.fn().mockImplementation(function (
      params: Record<string, unknown>
    ) {
      return { input: params }
    }),
  }
})

vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: vi.fn(function () {
    return { send: mockLambdaSend }
  }),
  InvokeCommand: mockInvokeCommand,
}))

describe('trigger handler (dispatcher)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ROLL_COMPLETED_HANDLER_ARN =
      'arn:aws:lambda:us-east-1:123:function:roll-completed'
    process.env.PLAYER_LEFT_HANDLER_ARN =
      'arn:aws:lambda:us-east-1:123:function:player-left'
    process.env.PLAYER_JOINED_HANDLER_ARN =
      'arn:aws:lambda:us-east-1:123:function:player-joined'
    mockLambdaSend.mockResolvedValue({})
  })

  it('handles RollRequestCompleted (persist only, no handler invocation)', async () => {
    const detail = {
      playTableId: 'pt-1',
      rollRequestId: 'rr-1',
      type: 'initiative' as const,
      timestamps: {
        createdAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T00:01:00Z',
      },
      playerIds: ['p1', 'p2'],
      rollIds: ['roll-1', 'roll-2'],
      initiatedBy: 'gm-sub',
    }
    const event = createSqsEvent([
      JSON.stringify({
        version: '0',
        id: 'evt-123',
        'detail-type': 'RollRequestCompleted',
        source: 'puzzlebottom-tabletop-tools',
        detail,
      }),
    ])

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockLambdaSend).not.toHaveBeenCalled()
  })

  it('invokes roll-completed handler for initiative RollCompleted', async () => {
    const detail = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestType: 'initiative' as const,
      rollerId: 'p1',
      rollerType: 'player' as const,
      values: [15],
      modifier: 2,
      total: 17,
    }
    const event = createSqsEvent([
      JSON.stringify({
        version: '0',
        id: 'evt-123',
        'detail-type': 'RollCompleted',
        source: 'puzzlebottom-tabletop-tools',
        detail,
      }),
    ])

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockLambdaSend).toHaveBeenCalledTimes(1)
    const invokeParams = mockInvokeCommand.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >
    expect(invokeParams?.FunctionName).toBe(
      'arn:aws:lambda:us-east-1:123:function:roll-completed'
    )
    expect(JSON.parse(invokeParams?.Payload as string)).toEqual(detail)
  })

  it('skips ad_hoc RollCompleted (no handler invocation)', async () => {
    const detail = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestType: 'ad_hoc' as const,
      rollerId: 'p1',
      rollerType: 'player' as const,
      values: [15],
      modifier: 2,
      total: 17,
    }
    const event = createSqsEvent([
      JSON.stringify({
        version: '0',
        id: 'evt-123',
        'detail-type': 'RollCompleted',
        source: 'puzzlebottom-tabletop-tools',
        detail,
      }),
    ])

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockLambdaSend).not.toHaveBeenCalled()
  })

  it('invokes player-left handler for PlayerLeft', async () => {
    const detail = { playTableId: 'pt-1', id: 'p1' }
    const event = createSqsEvent([
      JSON.stringify({
        version: '0',
        id: 'evt-123',
        'detail-type': 'PlayerLeft',
        source: 'puzzlebottom-tabletop-tools',
        detail,
      }),
    ])

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockLambdaSend).toHaveBeenCalledTimes(1)
    const invokeParams = mockInvokeCommand.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >
    expect(invokeParams?.FunctionName).toBe(
      'arn:aws:lambda:us-east-1:123:function:player-left'
    )
    expect(JSON.parse(invokeParams?.Payload as string)).toEqual(detail)
  })

  it('invokes player-joined handler for PlayerJoined', async () => {
    const detail = {
      playTableId: 'pt-1',
      id: 'p1',
      characterName: 'Alice',
      initiativeModifier: 3,
    }
    const event = createSqsEvent([
      JSON.stringify({
        version: '0',
        id: 'evt-123',
        'detail-type': 'PlayerJoined',
        source: 'puzzlebottom-tabletop-tools',
        detail,
      }),
    ])

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockLambdaSend).toHaveBeenCalledTimes(1)
    const invokeParams = mockInvokeCommand.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >
    expect(invokeParams?.FunctionName).toBe(
      'arn:aws:lambda:us-east-1:123:function:player-joined'
    )
    expect(JSON.parse(invokeParams?.Payload as string)).toEqual(detail)
  })

  it('skips record with invalid JSON in body', async () => {
    const event = createSqsEvent(['not valid json'])

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockLambdaSend).not.toHaveBeenCalled()
  })

  it('skips record with invalid EventBridge event body', async () => {
    const event = createSqsEvent([JSON.stringify({ invalid: 'envelope' })])

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockLambdaSend).not.toHaveBeenCalled()
  })

  it('skips record with unsupported detail-type', async () => {
    const event = createSqsEvent([
      JSON.stringify({
        version: '0',
        id: 'evt-123',
        'detail-type': 'OtherEventType',
        source: 'puzzlebottom-tabletop-tools',
        detail: {},
      }),
    ])

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockLambdaSend).not.toHaveBeenCalled()
  })

  it('skips RollRequestCompleted with invalid detail', async () => {
    const event = createSqsEvent([
      JSON.stringify({
        version: '0',
        id: 'evt-123',
        'detail-type': 'RollRequestCompleted',
        source: 'puzzlebottom-tabletop-tools',
        detail: null,
      }),
    ])

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockLambdaSend).not.toHaveBeenCalled()
  })

  it('skips RollCompleted with invalid detail', async () => {
    const event = createSqsEvent([
      JSON.stringify({
        version: '0',
        id: 'evt-123',
        'detail-type': 'RollCompleted',
        source: 'puzzlebottom-tabletop-tools',
        detail: { invalid: 'detail' },
      }),
    ])

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockLambdaSend).not.toHaveBeenCalled()
  })

  it('rethrows when Lambda invoke fails', async () => {
    mockLambdaSend.mockRejectedValueOnce(new Error('Lambda error'))
    const detail = {
      playTableId: 'pt-1',
      rollId: 'roll-1',
      rollRequestType: 'initiative' as const,
      rollerId: 'p1',
      rollerType: 'player' as const,
      values: [15],
      modifier: 2,
      total: 17,
    }
    const event = createSqsEvent([
      JSON.stringify({
        version: '0',
        id: 'evt-123',
        'detail-type': 'RollCompleted',
        source: 'puzzlebottom-tabletop-tools',
        detail,
      }),
    ])

    await expect(handler(event, MINIMAL_CONTEXT, vi.fn())).rejects.toThrow(
      'Lambda error'
    )
  })
})
