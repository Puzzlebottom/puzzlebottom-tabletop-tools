import { AppSyncResolverHandler } from 'aws-lambda';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { randomUUID } from 'crypto';
import { DataRecord } from '../../shared/types';

const eventBridgeClient = new EventBridgeClient({});
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;

interface SubmitDataInput {
  source: string;
  payload: string;
}

interface SubmitDataResponse {
  id: string;
  status: string;
  submittedAt: string;
}

export const handler: AppSyncResolverHandler<SubmitDataInput, SubmitDataResponse> = async (event) => {
  const { source, payload } = event.arguments;
  const submittedBy = event.identity && 'sub' in event.identity
    ? event.identity.sub
    : 'anonymous';

  const record: DataRecord = {
    id: randomUUID(),
    source,
    payload: JSON.parse(payload),
    submittedAt: new Date().toISOString(),
    submittedBy,
  };

  await eventBridgeClient.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: EVENT_BUS_NAME,
          Source: 'data-pipeline',
          DetailType: 'DataSubmitted',
          Detail: JSON.stringify(record),
        },
      ],
    })
  );

  return {
    id: record.id,
    status: 'SUBMITTED',
    submittedAt: record.submittedAt,
  };
};
