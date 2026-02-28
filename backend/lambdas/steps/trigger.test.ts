import type { DataRecord } from '@aws-step-function-test/schemas'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { handler } from './trigger'

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}))

vi.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: vi.fn(function () {
    return { send: mockSend }
  }),
  StartExecutionCommand: class MockStartExecutionCommand {
    input: Record<string, unknown>

    constructor(params: Record<string, unknown>) {
      this.input = params
    }
  },
}))

const createDataRecord = (overrides: Partial<DataRecord> = {}): DataRecord => ({
  id: 'record-123',
  source: 'test-source',
  payload: { key: 'value' },
  submittedAt: new Date().toISOString(),
  submittedBy: 'test-user',
  ...overrides,
})

describe('trigger handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STATE_MACHINE_ARN = 'arn:aws:states:us-east-1:123:stateMachine:test'
    mockSend.mockResolvedValue({ executionArn: 'arn:aws:...' })
  })

  it('starts Step Function execution for valid SQS record', async () => {
    const record = createDataRecord()
    const event = {
      Records: [
        {
          body: JSON.stringify({ detail: record }),
          messageId: 'msg-1',
          receiptHandle: 'receipt-1',
          attributes: {},
          messageAttributes: {},
          md5OfBody: '',
          eventSource: 'aws:sqs',
          eventSourceARN: '',
          awsRegion: 'us-east-1',
        },
      ],
    }

    await handler(event, {} as never, () => {})

    expect(mockSend).toHaveBeenCalledTimes(1)
    const [command] = mockSend.mock.calls[0]
    expect(command).toBeDefined()
    // AWS SDK v3 Command stores params in input
    const params =
      (command as { input?: Record<string, unknown> }).input ??
      (command as Record<string, unknown>)
    expect(params.stateMachineArn ?? params.input).toBeDefined()
    const stepInputStr =
      typeof params.input === 'string' ? params.input : JSON.stringify(params)
    const stepInput = JSON.parse(stepInputStr) as { record: DataRecord }
    expect(stepInput.record).toEqual(record)
    expect(stepInput.pipelineId).toBeDefined()
    expect(stepInput.timestamp).toBeDefined()
  })

  it('skips record with invalid JSON in body', async () => {
    const event = {
      Records: [
        {
          body: 'not valid json',
          messageId: 'msg-1',
          receiptHandle: 'receipt-1',
          attributes: {},
          messageAttributes: {},
          md5OfBody: '',
          eventSource: 'aws:sqs',
          eventSourceARN: '',
          awsRegion: 'us-east-1',
        },
      ],
    }

    await handler(event, {} as never, () => {})

    expect(mockSend).not.toHaveBeenCalled()
  })

  it('skips record with invalid EventBridge event body', async () => {
    const event = {
      Records: [
        {
          body: JSON.stringify({ detail: null }),
          messageId: 'msg-1',
          receiptHandle: 'receipt-1',
          attributes: {},
          messageAttributes: {},
          md5OfBody: '',
          eventSource: 'aws:sqs',
          eventSourceARN: '',
          awsRegion: 'us-east-1',
        },
      ],
    }

    await handler(event, {} as never, () => {})

    expect(mockSend).not.toHaveBeenCalled()
  })
})
