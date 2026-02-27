import { describe, expect, it } from 'vitest'

import type { TransformOutput } from '../../shared/types'
import { handler } from './validate'

const createMockInput = (
  overrides: Partial<TransformOutput> = {}
): TransformOutput => ({
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
  ...overrides,
})

describe('validate handler', () => {
  it('returns validated output for valid input', async () => {
    const input = createMockInput()

    const result = await handler(input)

    expect(result.validated).toBe(true)
    expect(result.validationErrors).toEqual([])
    expect(result.pipelineId).toBe(input.pipelineId)
  })

  it('throws error when record.id is missing', async () => {
    const input = createMockInput({
      record: {
        id: '',
        source: 'test-source',
        payload: {},
        submittedAt: new Date().toISOString(),
        submittedBy: 'test-user',
      },
    })

    await expect(handler(input)).rejects.toThrow('Missing required field: id')
  })

  it('throws error when record.source is missing', async () => {
    const input = createMockInput({
      record: {
        id: 'test-id',
        source: '',
        payload: {},
        submittedAt: new Date().toISOString(),
        submittedBy: 'test-user',
      },
    })

    await expect(handler(input)).rejects.toThrow(
      'Missing required field: source'
    )
  })

  it('throws error when normalizedPayload is empty', async () => {
    const input = createMockInput({
      normalizedPayload: {},
    })

    await expect(handler(input)).rejects.toThrow('Normalized payload is empty')
  })

  it('combines multiple validation errors', async () => {
    const input = createMockInput({
      record: {
        id: '',
        source: '',
        payload: {},
        submittedAt: new Date().toISOString(),
        submittedBy: 'test-user',
      },
      normalizedPayload: {},
    })

    await expect(handler(input)).rejects.toThrow(
      'Validation failed: Missing required field: id; Missing required field: source; Normalized payload is empty'
    )
  })
})
