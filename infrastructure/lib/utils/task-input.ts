import { type z } from 'zod'

export function taskInputFromSchema<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(schema.shape)) {
    result[`${key}.$`] = `$.${key}`
  }
  return result
}
