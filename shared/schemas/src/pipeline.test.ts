import { describe, expect, it } from 'vitest'

import {
  IngestOutputSchema,
  PipelineEventSchema,
  PipelineStatusSchema,
  StepInputSchema,
  StoreOutputSchema,
  TransformOutputSchema,
  ValidateOutputSchema,
} from './pipeline'

const validRecord = {
  id: 'uuid-123',
  source: 'test-source',
  payload: { key: 'value' },
  submittedAt: '2025-01-01T00:00:00.000Z',
  submittedBy: 'user-1',
}

const validStepInput = {
  record: validRecord,
  pipelineId: 'pipeline-123',
  timestamp: '2025-01-01T00:00:00.000Z',
}

describe('StepInputSchema', () => {
  it('accepts valid step input', () => {
    expect(StepInputSchema.safeParse(validStepInput).success).toBe(true)
  })

  it('rejects missing pipelineId', () => {
    const { pipelineId, ...rest } = validStepInput
    void pipelineId
    expect(StepInputSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing timestamp', () => {
    const { timestamp, ...rest } = validStepInput
    void timestamp
    expect(StepInputSchema.safeParse(rest).success).toBe(false)
  })
})

describe('IngestOutputSchema', () => {
  const validIngestOutput = {
    ...validStepInput,
    ingested: true as const,
    rawSize: 100,
  }

  it('accepts valid ingest output', () => {
    expect(IngestOutputSchema.safeParse(validIngestOutput).success).toBe(true)
  })

  it('rejects ingested !== true', () => {
    expect(
      IngestOutputSchema.safeParse({ ...validIngestOutput, ingested: false })
        .success
    ).toBe(false)
  })

  it('rejects missing rawSize', () => {
    const { rawSize, ...rest } = validIngestOutput
    void rawSize
    expect(IngestOutputSchema.safeParse(rest).success).toBe(false)
  })
})

describe('TransformOutputSchema', () => {
  const validTransformOutput = {
    ...validStepInput,
    ingested: true as const,
    rawSize: 100,
    transformed: true as const,
    normalizedPayload: { key: 'value' },
  }

  it('accepts valid transform output', () => {
    expect(TransformOutputSchema.safeParse(validTransformOutput).success).toBe(
      true
    )
  })

  it('rejects transformed !== true', () => {
    expect(
      TransformOutputSchema.safeParse({
        ...validTransformOutput,
        transformed: false,
      }).success
    ).toBe(false)
  })
})

describe('ValidateOutputSchema', () => {
  const validValidateOutput = {
    ...validStepInput,
    ingested: true as const,
    rawSize: 100,
    transformed: true as const,
    normalizedPayload: { key: 'value' },
    validated: true as const,
    validationErrors: [] as string[],
  }

  it('accepts valid validate output', () => {
    expect(ValidateOutputSchema.safeParse(validValidateOutput).success).toBe(
      true
    )
  })

  it('accepts validation errors array', () => {
    expect(
      ValidateOutputSchema.safeParse({
        ...validValidateOutput,
        validationErrors: ['error1'],
      }).success
    ).toBe(true)
  })
})

describe('StoreOutputSchema', () => {
  const validStoreOutput = {
    ...validStepInput,
    ingested: true as const,
    rawSize: 100,
    transformed: true as const,
    normalizedPayload: { key: 'value' },
    validated: true as const,
    validationErrors: [] as string[],
    stored: true as const,
    tableName: 'my-table',
    itemKey: { PK: 'pk-1', SK: 'sk-1' },
  }

  it('accepts valid store output', () => {
    expect(StoreOutputSchema.safeParse(validStoreOutput).success).toBe(true)
  })

  it('rejects missing itemKey', () => {
    const { itemKey, ...rest } = validStoreOutput
    void itemKey
    expect(StoreOutputSchema.safeParse(rest).success).toBe(false)
  })
})

describe('PipelineEventSchema', () => {
  it('accepts valid pipeline event', () => {
    expect(
      PipelineEventSchema.safeParse({
        source: 'data-pipeline',
        detailType: 'DataSubmitted',
        detail: validRecord,
      }).success
    ).toBe(true)
  })

  it('rejects wrong source', () => {
    expect(
      PipelineEventSchema.safeParse({
        source: 'wrong-source',
        detailType: 'DataSubmitted',
        detail: validRecord,
      }).success
    ).toBe(false)
  })

  it('rejects wrong detailType', () => {
    expect(
      PipelineEventSchema.safeParse({
        source: 'data-pipeline',
        detailType: 'WrongType',
        detail: validRecord,
      }).success
    ).toBe(false)
  })
})

describe('PipelineStatusSchema', () => {
  it('accepts all valid statuses', () => {
    const statuses = [
      'SUBMITTED',
      'INGESTING',
      'TRANSFORMING',
      'VALIDATING',
      'STORING',
      'COMPLETED',
      'FAILED',
    ]
    for (const status of statuses) {
      expect(PipelineStatusSchema.safeParse(status).success).toBe(true)
    }
  })

  it('rejects invalid status', () => {
    expect(PipelineStatusSchema.safeParse('INVALID').success).toBe(false)
  })
})
