import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import type {
  PaginatedRolls,
  PublishInitiativeUpdatedInput,
  PublishRollInput,
  PublishRollRequestInput,
  Roll,
} from '@puzzlebottom-tabletop-tools/graphql-types'
import type {
  AppSyncResolverEvent,
  AppSyncResolverHandler,
  Callback,
  Context,
} from 'aws-lambda'

const dynamo = new DynamoDBClient({})
const PLAY_TABLE_NAME = process.env.PLAY_TABLE_NAME!
const DICE_ROLLER_TABLE_NAME = process.env.DICE_ROLLER_TABLE_NAME!

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
      TableName: PLAY_TABLE_NAME,
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
      TableName: DICE_ROLLER_TABLE_NAME,
      Key: marshall({
        PK: `PLAYTABLE#${playTableId}`,
        SK: 'INITIATIVE_META',
      }),
    })
  )

  return true
}

export const publishRollRequestCreated: AppSyncResolverHandler<
  { input: PublishRollRequestInput },
  PublishRollRequestInput
> = (event) => {
  return Promise.resolve(event.arguments.input)
}

export const publishInitiativeUpdated: AppSyncResolverHandler<
  { input: PublishInitiativeUpdatedInput },
  Roll[]
> = (event) => {
  const rolls = event.arguments.input.rolls.filter(
    (r): r is PublishRollInput => r !== null && r !== undefined
  )
  return Promise.resolve(rolls)
}

export const publishRollCompleted: AppSyncResolverHandler<
  { input: PublishRollInput },
  Roll
> = (event) => {
  return Promise.resolve(event.arguments.input)
}

export const rollHistory: AppSyncResolverHandler<
  { playTableId: string; limit?: number | null; nextToken?: string | null },
  PaginatedRolls
> = async (event) => {
  const { playTableId, limit, nextToken } = event.arguments
  const pageSize = Math.min(Math.max(limit ?? 20, 1), 100)

  const baseParams = {
    TableName: DICE_ROLLER_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: marshall({
      ':pk': `PLAYTABLE#${playTableId}`,
      ':sk': 'ROLL#',
    }),
  }

  const allItems: Record<string, unknown>[] = []
  let exclusiveStartKey: Record<string, { S: string }> | undefined

  do {
    const queryResult = await dynamo.send(
      new QueryCommand({
        ...baseParams,
        ...(exclusiveStartKey && { ExclusiveStartKey: exclusiveStartKey }),
      })
    )
    allItems.push(...(queryResult.Items ?? []).map((i) => unmarshall(i)))
    exclusiveStartKey = queryResult.LastEvaluatedKey as
      | Record<string, { S: string }>
      | undefined
  } while (exclusiveStartKey)

  allItems.sort((a, b) =>
    (b.createdAt as string).localeCompare(a.createdAt as string)
  )

  let startIndex = 0
  if (nextToken) {
    const cursor = JSON.parse(Buffer.from(nextToken, 'base64').toString()) as {
      offset: number
    }
    startIndex = cursor.offset
  }

  const pageItems = allItems.slice(startIndex, startIndex + pageSize)
  const hasMore = startIndex + pageSize < allItems.length

  const items: Roll[] = pageItems.map((r) => ({
    id: r.id as string,
    playTableId: r.playTableId as string,
    rollerId: r.rollerId as string,
    rollNotation: r.rollNotation as string,
    type: (r.type as Roll['type']) ?? null,
    values: r.values as number[],
    modifier: r.modifier as number,
    rollResult: r.rollResult as number,
    isPrivate: r.isPrivate as boolean,
    rollRequestId: (r.rollRequestId as string) ?? null,
    createdAt: r.createdAt as string,
    deletedAt: (r.deletedAt as string) ?? null,
  }))

  return {
    items,
    nextToken: hasMore
      ? Buffer.from(JSON.stringify({ offset: startIndex + pageSize })).toString(
          'base64'
        )
      : null,
  }
}

/** Dummy values for sub-resolver calls; sub-resolvers are async and don't use them. */
const NOOP_CONTEXT = {} as Context
const NOOP_CALLBACK = undefined as unknown as Callback<unknown>

export const handler: AppSyncResolverHandler<unknown, unknown> = async (
  event: AppSyncResolverEvent<unknown>
) => {
  const fieldName = event.info?.fieldName ?? ''
  const parentType = event.info?.parentTypeName ?? ''

  if (parentType === 'Query') {
    if (fieldName === 'rollHistory') {
      const e = event as AppSyncResolverEvent<{
        playTableId: string
        limit?: number | null
        nextToken?: string | null
      }>
      return rollHistory(e, NOOP_CONTEXT, NOOP_CALLBACK)
    }
  }

  if (parentType === 'Mutation') {
    if (fieldName === 'clearInitiative') {
      const e = event as AppSyncResolverEvent<{ playTableId: string }>
      return clearInitiative(e, NOOP_CONTEXT, NOOP_CALLBACK)
    }
    if (fieldName === 'publishRollCompleted') {
      const e = event as AppSyncResolverEvent<{ input: PublishRollInput }>
      return publishRollCompleted(e, NOOP_CONTEXT, NOOP_CALLBACK)
    }
    if (fieldName === 'publishRollRequestCreated') {
      const e = event as AppSyncResolverEvent<{
        input: PublishRollRequestInput
      }>
      return publishRollRequestCreated(e, NOOP_CONTEXT, NOOP_CALLBACK)
    }
    if (fieldName === 'publishInitiativeUpdated') {
      const e = event as AppSyncResolverEvent<{
        input: PublishInitiativeUpdatedInput
      }>
      return publishInitiativeUpdated(e, NOOP_CONTEXT, NOOP_CALLBACK)
    }
  }

  throw new Error(`Unknown resolver: ${parentType}.${fieldName}`)
}
