import { StepInputSchema } from '@aws-step-function-test/schemas'

import { type IngestOutput } from '../../shared/types'

export const handler = (event: unknown): Promise<IngestOutput> => {
  const parseResult = StepInputSchema.safeParse(event)
  if (!parseResult.success) {
    throw new Error(
      `Invalid step input: ${parseResult.error.flatten().formErrors.join(', ')}`
    )
  }
  const { record } = parseResult.data

  console.log('Ingest step received:', JSON.stringify(parseResult.data))

  const rawSize = JSON.stringify(record.payload).length
  if (rawSize > 1_000_000) {
    throw new Error(`Payload too large: ${rawSize} bytes (max 1MB)`)
  }

  return Promise.resolve({
    ...parseResult.data,
    ingested: true,
    rawSize,
  })
}
