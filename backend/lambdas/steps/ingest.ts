import { StepInput, IngestOutput } from '../../shared/types';

export const handler = async (event: StepInput): Promise<IngestOutput> => {
  console.log('Ingest step received:', JSON.stringify(event));

  const { record } = event;

  const rawSize = JSON.stringify(record.payload).length;
  if (rawSize > 1_000_000) {
    throw new Error(`Payload too large: ${rawSize} bytes (max 1MB)`);
  }

  return {
    ...event,
    ingested: true,
    rawSize,
  };
};
