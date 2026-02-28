import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { ValidateOutputSchema } from '@aws-step-function-test/schemas'

import { type StoreOutput } from '../../shared/types'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

const TABLE_NAME = process.env.TABLE_NAME!

export const handler = async (event: unknown): Promise<StoreOutput> => {
  const parseResult = ValidateOutputSchema.safeParse(event)
  if (!parseResult.success) {
    throw new Error(
      `Invalid validate output: ${parseResult.error.flatten().formErrors.join(', ')}`
    )
  }
  const input = parseResult.data

  console.log(
    'Store step received:',
    JSON.stringify({ pipelineId: input.pipelineId })
  )

  const itemKey = {
    PK: `RECORD#${input.record.id}`,
    SK: `PIPELINE#${input.pipelineId}`,
  }

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...itemKey,
        GSI1PK: `SOURCE#${input.record.source}`,
        GSI1SK: input.record.submittedAt,
        recordId: input.record.id,
        pipelineId: input.pipelineId,
        source: input.record.source,
        payload: input.normalizedPayload,
        submittedBy: input.record.submittedBy,
        submittedAt: input.record.submittedAt,
        processedAt: new Date().toISOString(),
        rawSize: input.rawSize,
      },
    })
  )

  return {
    ...input,
    stored: true,
    tableName: TABLE_NAME,
    itemKey,
  }
}
