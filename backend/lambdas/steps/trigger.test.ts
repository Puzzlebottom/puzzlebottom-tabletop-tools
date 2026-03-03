import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MINIMAL_CONTEXT } from '../../test/lambda-context.js'
import { createSqsEvent } from '../../test/sqs-event.js'
import { handler } from './trigger'

const { mockSfnSend, mockLambdaSend, mockInvokeCommand } = vi.hoisted(() => {
  process.env.STATE_MACHINE_ARN =
    'arn:aws:states:us-east-1:123:stateMachine:test'
  process.env.ROLL_COMPLETED_HANDLER_ARN =
    'arn:aws:lambda:us-east-1:123:function:roll-completed'
  process.env.PLAYER_LEFT_HANDLER_ARN =
    'arn:aws:lambda:us-east-1:123:function:player-left'
  process.env.PLAYER_JOINED_HANDLER_ARN =
    'arn:aws:lambda:us-east-1:123:function:player-joined'
  return {
    mockSfnSend: vi.fn(),
    mockLambdaSend: vi.fn(),
    mockInvokeCommand: vi.fn().mockImplementation(function (
      params: Record<string, unknown>
    ) {
      return { input: params }
    }),
  }
})

vi.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: vi.fn(function () {
    return { send: mockSfnSend }
  }),
  StartExecutionCommand: class MockStartExecutionCommand {
    input: Record<string, unknown>

    constructor(params: Record<string, unknown>) {
      this.input = params
    }
  },
}))

vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: vi.fn(function () {
    return { send: mockLambdaSend }
  }),
  InvokeCommand: mockInvokeCommand,
}))

describe('trigger handler (dispatcher)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STATE_MACHINE_ARN =
      'arn:aws:states:us-east-1:123:stateMachine:test'
    process.env.ROLL_COMPLETED_HANDLER_ARN =
      'arn:aws:lambda:us-east-1:123:function:roll-completed'
    process.env.PLAYER_LEFT_HANDLER_ARN =
      'arn:aws:lambda:us-east-1:123:function:player-left'
    process.env.PLAYER_JOINED_HANDLER_ARN =
      'arn:aws:lambda:us-east-1:123:function:player-joined'
    mockSfnSend.mockResolvedValue({ executionArn: 'arn:aws:...' })
    mockLambdaSend.mockResolvedValue({})
  })

  it('starts Step Function for InitiativeRollRequestCreated', async () => {
    const detail = {
      playTableId: 'pt-1',
      rollRequestId: 'rr-1',
      targetPlayerIds: ['p1', 'p2'],
      expectedCount: 2,
    }
    const event = createSqsEvent([
      JSON.stringify({
        version: '0',
        id: 'evt-123',
        'detail-type': 'InitiativeRollRequestCreated',
        source: 'puzzlebottom-tabletop-tools',
        detail,
      }),
    ])

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockSfnSend).toHaveBeenCalledTimes(1)
    const [command] = mockSfnSend.mock.calls[0] as [unknown]
    const params =
      (command as { input?: Record<string, unknown> }).input ??
      (command as Record<string, unknown>)
    expect(params.stateMachineArn ?? params.input).toBeDefined()
    expect(params.input).toBe(JSON.stringify(detail))
    expect(params.name).toBe('rr-1')
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
    expect(mockSfnSend).not.toHaveBeenCalled()
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
    expect(mockSfnSend).not.toHaveBeenCalled()
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

    expect(mockSfnSend).not.toHaveBeenCalled()
    expect(mockLambdaSend).not.toHaveBeenCalled()
  })

  it('skips record with invalid EventBridge event body', async () => {
    const event = createSqsEvent([JSON.stringify({ invalid: 'envelope' })])

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockSfnSend).not.toHaveBeenCalled()
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

    expect(mockSfnSend).not.toHaveBeenCalled()
    expect(mockLambdaSend).not.toHaveBeenCalled()
  })

  it('skips InitiativeRollRequestCreated with invalid detail', async () => {
    const event = createSqsEvent([
      JSON.stringify({
        version: '0',
        id: 'evt-123',
        'detail-type': 'InitiativeRollRequestCreated',
        source: 'puzzlebottom-tabletop-tools',
        detail: null,
      }),
    ])

    await handler(event, MINIMAL_CONTEXT, vi.fn())

    expect(mockSfnSend).not.toHaveBeenCalled()
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
