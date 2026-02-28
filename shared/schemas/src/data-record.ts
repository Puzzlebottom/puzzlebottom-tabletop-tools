import { z } from 'zod'

/** Validates that payload is a JSON object (keys strings, values any). */
export const PayloadSchema = z.record(z.string(), z.unknown())

export type Payload = z.infer<typeof PayloadSchema>

/** Validates DataRecord structure matching backend/shared/types.ts. */
export const DataRecordSchema = z.object({
  id: z.string(),
  source: z.string(),
  payload: PayloadSchema,
  submittedAt: z.string(),
  submittedBy: z.string(),
})

export type DataRecord = z.infer<typeof DataRecordSchema>
