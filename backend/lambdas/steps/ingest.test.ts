import type { StepInput } from '@aws-step-function-test/schemas'
import { describe, expect, it } from 'vitest'

import { handler } from './ingest'

const createMockInput = (overrides: Partial<StepInput> = {}): StepInput => ({
  record: {
    id: 'test-id-123',
    source: 'test-source',
    payload: { key: 'value' },
    submittedAt: new Date().toISOString(),
    submittedBy: 'test-user',
  },
  pipelineId: 'pipeline-123',
  timestamp: new Date().toISOString(),
  ...overrides,
})

describe('ingest handler', () => {
  it('returns ingested output for valid input', async () => {
    const input = createMockInput()

    const result = await handler(input)

    expect(result.ingested).toBe(true)
    expect(result.rawSize).toBe(JSON.stringify(input.record.payload).length)
    expect(result.pipelineId).toBe(input.pipelineId)
    expect(result.record).toEqual(input.record)
  })

  it('throws error when input does not match StepInputSchema', async () => {
    try {
      await handler({})
      expect.fail('Expected handler to throw')
    } catch (e) {
      expect(e).toBeInstanceOf(Error)
      expect((e as Error).message).toContain('Invalid step input')
    }
  })

  it('throws error when payload exceeds 1MB', async () => {
    const input = createMockInput({
      record: {
        id: 'test-id',
        source: 'test-source',
        payload: { x: 'a'.repeat(1_000_001) },
        submittedAt: new Date().toISOString(),
        submittedBy: 'test-user',
      },
    })

    try {
      await handler(input)
      expect.fail('Expected handler to throw')
    } catch (e) {
      expect(e).toBeInstanceOf(Error)
      expect((e as Error).message).toContain('Payload too large')
    }
  })
})
