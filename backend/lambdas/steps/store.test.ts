import type { ValidateOutput } from '@aws-step-function-test/schemas'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { handler } from './store'

const { mockSend } = vi.hoisted(() => {
  process.env.TABLE_NAME = 'test-table'
  return { mockSend: vi.fn() }
})

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: () => ({
      send: mockSend,
    }),
  },
  PutCommand: class MockPutCommand {
    input: Record<string, unknown>

    constructor(params: Record<string, unknown>) {
      this.input = params
    }
  },
}))

const createMockInput = (
  overrides: Partial<ValidateOutput> = {}
): ValidateOutput => ({
  record: {
    id: 'test-id-123',
    source: 'test-source',
    payload: { key: 'value' },
    submittedAt: new Date().toISOString(),
    submittedBy: 'test-user',
  },
  pipelineId: 'pipeline-123',
  timestamp: new Date().toISOString(),
  ingested: true,
  rawSize: 100,
  transformed: true,
  normalizedPayload: { normalized: 'data' },
  validated: true,
  validationErrors: [],
  ...overrides,
})

describe('store handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSend.mockResolvedValue({})
  })

  it('writes to DynamoDB and returns store output', async () => {
    const input = createMockInput()

    const result = await handler(input)

    expect(result.stored).toBe(true)
    expect(result.tableName).toBe('test-table')
    expect(result.itemKey).toEqual({
      PK: 'RECORD#test-id-123',
      SK: 'PIPELINE#pipeline-123',
    })
    expect(mockSend).toHaveBeenCalledTimes(1)
    const putCall = mockSend.mock.calls[0][0] as {
      input: { TableName: string; Item: Record<string, unknown> }
    }
    expect(putCall.input.TableName).toBe('test-table')
    expect(putCall.input.Item.PK).toBe('RECORD#test-id-123')
    expect(putCall.input.Item.GSI1PK).toBe('SOURCE#test-source')
    expect(putCall.input.Item.payload).toEqual({ normalized: 'data' })
  })

  it('throws error when input does not match ValidateOutputSchema', async () => {
    await expect(handler({})).rejects.toThrow(/Invalid validate output/)
  })
})
