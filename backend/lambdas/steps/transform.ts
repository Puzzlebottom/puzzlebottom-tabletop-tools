import { type IngestOutput, type TransformOutput } from '../../shared/types'

export const handler = (event: IngestOutput): Promise<TransformOutput> => {
  console.log(
    'Transform step received:',
    JSON.stringify({ pipelineId: event.pipelineId })
  )

  const normalizedPayload: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(event.record.payload)) {
    const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '_')
    normalizedPayload[normalizedKey] =
      typeof value === 'string' ? value.trim() : value
  }

  return Promise.resolve({
    ...event,
    transformed: true,
    normalizedPayload,
  })
}
