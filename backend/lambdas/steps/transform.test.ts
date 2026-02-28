import type { IngestOutput } from '@puzzlebottom-tabletop-tools/schemas'
import { describe, expect, it } from 'vitest'

import { handler } from './transform'

const createMockInput = (
  overrides: Partial<IngestOutput> = {}
): IngestOutput => ({
  record: {
    id: 'test-id-123',
    source: 'test-source',
    payload: { ' Key With Spaces ': '  value  ', UPPER: 'CASE' },
    submittedAt: new Date().toISOString(),
    submittedBy: 'test-user',
  },
  pipelineId: 'pipeline-123',
  timestamp: new Date().toISOString(),
  ingested: true,
  rawSize: 100,
  ...overrides,
})

describe('transform handler', () => {
  it('normalizes payload keys (trim, lowercase, spaces to underscores)', async () => {
    const input = createMockInput()

    const result = await handler(input)

    expect(result.transformed).toBe(true)
    expect(result.normalizedPayload).toEqual({
      key_with_spaces: 'value',
      upper: 'CASE',
    })
    expect(result.pipelineId).toBe(input.pipelineId)
  })

  it('trims string values', async () => {
    const input = createMockInput({
      record: {
        id: 'test-id',
        source: 'test-source',
        payload: { key: '  trimmed  ' },
        submittedAt: new Date().toISOString(),
        submittedBy: 'test-user',
      },
    })

    const result = await handler(input)

    expect(result.normalizedPayload).toEqual({ key: 'trimmed' })
  })

  it('leaves non-string values unchanged', async () => {
    const input = createMockInput({
      record: {
        id: 'test-id',
        source: 'test-source',
        payload: { num: 42, nested: { a: 1 } },
        submittedAt: new Date().toISOString(),
        submittedBy: 'test-user',
      },
    })

    const result = await handler(input)

    expect(result.normalizedPayload).toEqual({ num: 42, nested: { a: 1 } })
  })

  it('throws error when input does not match IngestOutputSchema', async () => {
    try {
      await handler({})
      expect.fail('Expected handler to throw')
    } catch (e) {
      expect(e).toBeInstanceOf(Error)
      expect((e as Error).message).toContain('Invalid ingest output')
    }
  })
})
