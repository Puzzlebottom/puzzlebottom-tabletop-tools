import {
  TransformOutputSchema,
  type ValidateOutput,
} from '@puzzlebottom-tabletop-tools/schemas'

export const handler = (event: unknown): Promise<ValidateOutput> => {
  const parseResult = TransformOutputSchema.safeParse(event)
  if (!parseResult.success) {
    throw new Error(
      `Invalid transform output: ${parseResult.error.flatten().formErrors.join(', ')}`
    )
  }
  const input = parseResult.data

  console.log(
    'Validate step received:',
    JSON.stringify({ pipelineId: input.pipelineId })
  )

  const errors: string[] = []

  if (!input.record.id) {
    errors.push('Missing required field: id')
  }

  if (!input.record.source) {
    errors.push('Missing required field: source')
  }

  if (Object.keys(input.normalizedPayload).length === 0) {
    errors.push('Normalized payload is empty')
  }

  if (errors.length > 0) {
    return Promise.reject(new Error(`Validation failed: ${errors.join('; ')}`))
  }

  return Promise.resolve({
    ...input,
    validated: true,
    validationErrors: errors,
  })
}
