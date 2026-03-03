import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import type {
  AppSyncResolverEvent,
  AppSyncResolverHandler,
  Callback,
  Context,
} from 'aws-lambda'

const dynamo = new DynamoDBClient({})
const TABLE_NAME = process.env.TABLE_NAME!

export const clearInitiative: AppSyncResolverHandler<
  { playTableId: string },
  boolean
> = async (event) => {
  const gmUserId =
    event.identity && 'sub' in event.identity
      ? (event.identity as { sub: string }).sub
      : undefined
  if (!gmUserId) {
    throw new Error(
      'Unauthorized: clearInitiative requires Cognito authentication'
    )
  }

  const { playTableId } = event.arguments

  const playTableResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `PLAYTABLE#${playTableId}`,
        SK: 'METADATA',
      }),
    })
  )
  if (!playTableResult.Item) {
    throw new Error('Play table not found')
  }

  await dynamo.send(
    new DeleteItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `PLAYTABLE#${playTableId}`,
        SK: 'INITIATIVE',
      }),
    })
  )

  return true
}

/**
 * IAM-only: invoked by EventBridge consumers (OrderInitiative step, handlers).
 * Returns order from input; no DB fetch.
 * Wrapper type required: AppSync subscriptions must return a single object, not a list.
 */
export const notifyInitiativeUpdated: AppSyncResolverHandler<
  {
    playTableId: string
    order: {
      id: string
      characterName: string
      value: number
      modifier: number
      total: number
    }[]
  },
  {
    order: {
      id: string
      characterName: string
      value: number
      modifier: number
      total: number
    }[]
  }
> = (event) => {
  return Promise.resolve({ order: event.arguments.order })
}

export const handler: AppSyncResolverHandler<unknown, unknown> = async (
  event: AppSyncResolverEvent<unknown>,
  context: Context,
  callback: Callback<unknown>
) => {
  const fieldName = event.info?.fieldName ?? ''
  const parentType = event.info?.parentTypeName ?? ''

  if (parentType === 'Mutation') {
    if (fieldName === 'clearInitiative') {
      const e = event as AppSyncResolverEvent<{ playTableId: string }>
      return clearInitiative(e, context, callback)
    }
    if (fieldName === 'notifyInitiativeUpdated') {
      const e = event as AppSyncResolverEvent<{
        playTableId: string
        order: {
          id: string
          characterName: string
          value: number
          modifier: number
          total: number
        }[]
      }>
      return notifyInitiativeUpdated(e, context, callback)
    }
  }

  throw new Error(`Unknown resolver: ${parentType}.${fieldName}`)
}
