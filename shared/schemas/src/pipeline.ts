import { z } from 'zod'

import { DataRecordSchema, PayloadSchema } from './data-record'

/** Step Function input from trigger. */
export const StepInputSchema = z.object({
  record: DataRecordSchema,
  pipelineId: z.string(),
  timestamp: z.string(),
})

export type StepInput = z.infer<typeof StepInputSchema>

/** Output of ingest step. */
export const IngestOutputSchema = StepInputSchema.extend({
  ingested: z.literal(true),
  rawSize: z.number(),
})

export type IngestOutput = z.infer<typeof IngestOutputSchema>

/** Output of transform step. */
export const TransformOutputSchema = IngestOutputSchema.extend({
  transformed: z.literal(true),
  normalizedPayload: PayloadSchema,
})

export type TransformOutput = z.infer<typeof TransformOutputSchema>

/** Output of validate step. */
export const ValidateOutputSchema = TransformOutputSchema.extend({
  validated: z.literal(true),
  validationErrors: z.array(z.string()),
})

export type ValidateOutput = z.infer<typeof ValidateOutputSchema>

/** Output of store step. */
export const StoreOutputSchema = ValidateOutputSchema.extend({
  stored: z.literal(true),
  tableName: z.string(),
  itemKey: z.object({
    PK: z.string(),
    SK: z.string(),
  }),
})

export type StoreOutput = z.infer<typeof StoreOutputSchema>

/** EventBridge event envelope (source, detailType, detail). */
export const PipelineEventSchema = z.object({
  source: z.literal('puzzlebottom-tabletop-tools'),
  detailType: z.literal('DataSubmitted'),
  detail: DataRecordSchema,
})

export type PipelineEvent = z.infer<typeof PipelineEventSchema>

/** Pipeline execution status. */
export const PipelineStatusSchema = z.enum([
  'SUBMITTED',
  'INGESTING',
  'TRANSFORMING',
  'VALIDATING',
  'STORING',
  'COMPLETED',
  'FAILED',
])

export type PipelineStatus = z.infer<typeof PipelineStatusSchema>
