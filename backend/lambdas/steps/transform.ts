import {
  IngestOutputSchema,
  type TransformOutput,
} from '@aws-step-function-test/schemas'

export const handler = (event: unknown): Promise<TransformOutput> => {
  const parseResult = IngestOutputSchema.safeParse(event)
  if (!parseResult.success) {
    throw new Error(
      `Invalid ingest output: ${parseResult.error.flatten().formErrors.join(', ')}`
    )
  }
  const input = parseResult.data

  console.log(
    'Transform step received:',
    JSON.stringify({ pipelineId: input.pipelineId })
  )

  const normalizedPayload: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input.record.payload)) {
    const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '_')
    normalizedPayload[normalizedKey] =
      typeof value === 'string' ? value.trim() : value
  }

  return Promise.resolve({
    ...input,
    transformed: true,
    normalizedPayload,
  })
}
