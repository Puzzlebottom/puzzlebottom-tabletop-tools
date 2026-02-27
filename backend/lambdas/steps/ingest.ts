import { type IngestOutput, type StepInput } from '../../shared/types'

export const handler = (event: StepInput): Promise<IngestOutput> => {
  console.log('Ingest step received:', JSON.stringify(event))

  const { record } = event

  const rawSize = JSON.stringify(record.payload).length
  if (rawSize > 1_000_000) {
    throw new Error(`Payload too large: ${rawSize} bytes (max 1MB)`)
  }

  return Promise.resolve({
    ...event,
    ingested: true,
    rawSize,
  })
}
