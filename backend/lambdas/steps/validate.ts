import { type TransformOutput, type ValidateOutput } from '../../shared/types'

export const handler = (event: TransformOutput): Promise<ValidateOutput> => {
  console.log(
    'Validate step received:',
    JSON.stringify({ pipelineId: event.pipelineId })
  )

  const errors: string[] = []

  if (!event.record.id) {
    errors.push('Missing required field: id')
  }

  if (!event.record.source) {
    errors.push('Missing required field: source')
  }

  if (Object.keys(event.normalizedPayload).length === 0) {
    errors.push('Normalized payload is empty')
  }

  if (errors.length > 0) {
    return Promise.reject(new Error(`Validation failed: ${errors.join('; ')}`))
  }

  return Promise.resolve({
    ...event,
    validated: true,
    validationErrors: errors,
  })
}
