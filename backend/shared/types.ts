export interface DataRecord {
  id: string
  source: string
  payload: Record<string, unknown>
  submittedAt: string
  submittedBy: string
}

export interface PipelineEvent {
  source: 'data-pipeline'
  detailType: 'DataSubmitted'
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
