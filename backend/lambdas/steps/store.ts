import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ValidateOutput, StoreOutput } from '../../shared/types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: ValidateOutput): Promise<StoreOutput> => {
  console.log('Store step received:', JSON.stringify({ pipelineId: event.pipelineId }));

  const itemKey = {
    PK: `RECORD#${event.record.id}`,
    SK: `PIPELINE#${event.pipelineId}`,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...itemKey,
        GSI1PK: `SOURCE#${event.record.source}`,
        GSI1SK: event.record.submittedAt,
        recordId: event.record.id,
        pipelineId: event.pipelineId,
        source: event.record.source,
        payload: event.normalizedPayload,
        submittedBy: event.record.submittedBy,
        submittedAt: event.record.submittedAt,
        processedAt: new Date().toISOString(),
        rawSize: event.rawSize,
      },
    })
  );

  return {
    ...event,
    stored: true,
    tableName: TABLE_NAME,
    itemKey,
  };
};
