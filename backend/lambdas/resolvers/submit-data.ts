import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge'
import type {
  MutationSubmitDataArgs,
  SubmitDataResponse,
} from '@aws-step-function-test/graphql-types'
import { type AppSyncResolverHandler } from 'aws-lambda'
import { randomUUID } from 'crypto'

import { type DataRecord } from '../../shared/types'

const eventBridgeClient = new EventBridgeClient({})
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!

export const handler: AppSyncResolverHandler<
  MutationSubmitDataArgs,
  SubmitDataResponse
> = async (event) => {
  const { source, payload } = event.arguments
  const submittedBy =
    event.identity && 'sub' in event.identity ? event.identity.sub : 'anonymous'

  const record: DataRecord = {
    id: randomUUID(),
    source,
    payload: JSON.parse(payload) as Record<string, unknown>,
    submittedAt: new Date().toISOString(),
    submittedBy,
  }

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
  )

  return {
    id: record.id,
    status: 'SUBMITTED',
    submittedAt: record.submittedAt,
  }
}
