export interface DataRecord {
  id: string
  source: string
  payload: Record<string, unknown>
  submittedAt: string
  submittedBy: string
}

/** EventBridge source for pipeline events. Add new sources here when extending. */
export const EVENT_SOURCE = 'data-pipeline' as const
export type EventSource = typeof EVENT_SOURCE

/** EventBridge detail types for pipeline events. Add new types here when extending. */
export const DETAIL_TYPE_DATA_SUBMITTED = 'DataSubmitted' as const
export type EventDetailType = typeof DETAIL_TYPE_DATA_SUBMITTED

export interface PipelineEvent {
  source: EventSource
  detailType: EventDetailType
  detail: DataRecord
}

export interface StepInput {
  record: DataRecord
  pipelineId: string
  timestamp: string
}

export interface IngestOutput extends StepInput {
  ingested: true
  rawSize: number
}

export interface TransformOutput extends IngestOutput {
  transformed: true
  normalizedPayload: Record<string, unknown>
}

export interface ValidateOutput extends TransformOutput {
  validated: true
  validationErrors: string[]
}

export interface StoreOutput extends ValidateOutput {
  stored: true
  tableName: string
  itemKey: { PK: string; SK: string }
}

export enum PipelineStatus {
  SUBMITTED = 'SUBMITTED',
  INGESTING = 'INGESTING',
  TRANSFORMING = 'TRANSFORMING',
  VALIDATING = 'VALIDATING',
  STORING = 'STORING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
