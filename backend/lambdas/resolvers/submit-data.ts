import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge'
import type {
  MutationSubmitDataArgs,
  SubmitDataResponse,
} from '@aws-step-function-test/graphql-types'
import { PayloadSchema } from '@aws-step-function-test/schemas'
import { type AppSyncResolverHandler } from 'aws-lambda'
import { randomUUID } from 'crypto'

import {
  type DataRecord,
  DETAIL_TYPE_DATA_SUBMITTED,
  EVENT_SOURCE,
} from '../../shared/types'

const eventBridgeClient = new EventBridgeClient({})
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!

export const handler: AppSyncResolverHandler<
  MutationSubmitDataArgs,
  SubmitDataResponse
> = async (event) => {
  const { source, payload } = event.arguments
  const submittedBy =
    event.identity && 'sub' in event.identity ? event.identity.sub : 'anonymous'

  let parsedPayload: unknown
  try {
    parsedPayload = JSON.parse(payload)
  } catch {
    throw new Error('Invalid JSON in payload')
  }

  const payloadResult = PayloadSchema.safeParse(parsedPayload)
  if (!payloadResult.success) {
    const errors = payloadResult.error.flatten().formErrors.join(', ')
    throw new Error(`Invalid payload: ${errors}`)
  }

  const record: DataRecord = {
    id: randomUUID(),
    source,
    payload: payloadResult.data,
    submittedAt: new Date().toISOString(),
    submittedBy,
  }

  await eventBridgeClient.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: EVENT_BUS_NAME,
          Source: EVENT_SOURCE,
          DetailType: DETAIL_TYPE_DATA_SUBMITTED,
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
