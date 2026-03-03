import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge'
import type {
  MutationSubmitDataArgs,
  SubmitDataResponse,
} from '@puzzlebottom-tabletop-tools/graphql-types'
import {
  type DataRecord,
  EVENT_SOURCE,
  PayloadSchema,
} from '@puzzlebottom-tabletop-tools/schemas'
import { type AppSyncResolverHandler } from 'aws-lambda'
import { randomUUID } from 'crypto'

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
