import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb'
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import {
  DETAIL_TYPE_PLAYER_JOINED,
  DETAIL_TYPE_PLAYER_LEFT,
  EVENT_SOURCE,
  PlayerJoinedDetailSchema,
  PlayerLeftDetailSchema,
} from '@puzzlebottom-tabletop-tools/schemas'
import type {
  AppSyncResolverEvent,
  AppSyncResolverHandler,
  Callback,
  Context,
} from 'aws-lambda'
import { randomUUID } from 'crypto'

const dynamo = new DynamoDBClient({})
const TABLE_NAME = process.env.TABLE_NAME!
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Exclude ambiguous chars

function generateInviteCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return code
}

export const createPlayTable: AppSyncResolverHandler<
  Record<string, never>,
  { id: string; gmUserId: string; inviteCode: string; createdAt: string }
> = async (event) => {
  const gmUserId =
    event.identity && 'sub' in event.identity
      ? (event.identity as { sub: string }).sub
      : undefined
  if (!gmUserId) {
    throw new Error(
      'Unauthorized: createPlayTable requires Cognito authentication'
    )
  }

  const id = randomUUID()
  const createdAt = new Date().toISOString()

  let inviteCode = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateInviteCode()
    const existing = await dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk AND GSI2SK = :sk',
        ExpressionAttributeValues: marshall({
          ':pk': `INVITECODE#${candidate}`,
          ':sk': 'PLAYTABLE',
        }),
        Limit: 1,
      })
    )
    if ((existing.Items?.length ?? 0) === 0) {
      inviteCode = candidate
      break
    }
    if (attempt === 4) throw new Error('Failed to generate unique invite code')
  }
  if (!inviteCode) throw new Error('Failed to generate unique invite code')

  const item = {
    PK: `PLAYTABLE#${id}`,
    SK: 'METADATA',
    GSI1PK: `GM#${gmUserId}`,
    GSI1SK: createdAt,
    GSI2PK: `INVITECODE#${inviteCode}`,
    GSI2SK: 'PLAYTABLE',
    id,
    gmUserId,
    inviteCode,
    createdAt,
  }

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(item, { removeUndefinedValues: true }),
    })
  )

  return {
    id,
    gmUserId,
    inviteCode,
    createdAt,
  }
}

export const joinPlayTable: AppSyncResolverHandler<
  {
    inviteCode: string
    input: { characterName: string; initiativeModifier: number }
  },
  { id: string; playTableId: string }
> = async (event) => {
  const { inviteCode, input } = event.arguments
  const { characterName, initiativeModifier } = input

  const queryResult = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk AND GSI2SK = :sk',
      ExpressionAttributeValues: marshall({
        ':pk': `INVITECODE#${inviteCode.toUpperCase()}`,
        ':sk': 'PLAYTABLE',
      }),
      Limit: 1,
    })
  )

  const items = queryResult.Items ?? []
  if (items.length === 0) {
    throw new Error('Invalid invite code')
  }

  const playTable = unmarshall(items[0]) as { id: string }
  const playTableId = playTable.id

  const playerId = randomUUID()
  const playerItem = {
    PK: `PLAYTABLE#${playTableId}`,
    SK: `PLAYER#${playerId}`,
    id: playerId,
    characterName,
    initiativeModifier,
  }

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(playerItem, { removeUndefinedValues: true }),
    })
  )

  const playerJoinedDetail = PlayerJoinedDetailSchema.parse({
    playTableId,
    id: playerId,
    characterName,
    initiativeModifier,
  })

  const eb = new EventBridgeClient({})
  await eb.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: EVENT_SOURCE,
          DetailType: DETAIL_TYPE_PLAYER_JOINED,
          Detail: JSON.stringify(playerJoinedDetail),
          EventBusName: EVENT_BUS_NAME,
        },
      ],
    })
  )

  return {
    id: playerId,
    playTableId,
  }
}

export const leavePlayTable: AppSyncResolverHandler<
  { playTableId: string; playerId: string },
  boolean
> = async (event) => {
  const { playTableId, playerId } = event.arguments

  await dynamo.send(
    new DeleteItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `PLAYTABLE#${playTableId}`,
        SK: `PLAYER#${playerId}`,
      }),
    })
  )

  const playerLeftDetail = PlayerLeftDetailSchema.parse({
    playTableId,
    id: playerId,
  })

  const eb = new EventBridgeClient({})
  await eb.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: EVENT_SOURCE,
          DetailType: DETAIL_TYPE_PLAYER_LEFT,
          Detail: JSON.stringify(playerLeftDetail),
          EventBusName: EVENT_BUS_NAME,
        },
      ],
    })
  )

  return true
}

async function fetchPlayTableWithPlayers(playTableId: string) {
  const [metadataResult, playersResult] = await Promise.all([
    dynamo.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({
          PK: `PLAYTABLE#${playTableId}`,
          SK: 'METADATA',
        }),
      })
    ),
    dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: marshall({
          ':pk': `PLAYTABLE#${playTableId}`,
          ':sk': 'PLAYER#',
        }),
      })
    ),
  ])

  const metadata = metadataResult.Item
  if (!metadata) return null

  const playTable = unmarshall(metadata) as {
    id: string
    gmUserId: string
    inviteCode: string
    createdAt: string
  }
  const players =
    playersResult.Items?.map((i) => {
      const p = unmarshall(i) as {
        id: string
        characterName: string
        initiativeModifier: number
      }
      return {
        id: p.id,
        playTableId: playTable.id,
        characterName: p.characterName,
        initiativeModifier: p.initiativeModifier,
      }
    }) ?? []

  return {
    id: playTable.id,
    gmUserId: playTable.gmUserId,
    inviteCode: playTable.inviteCode,
    createdAt: playTable.createdAt,
    players,
  }
}

export const playTable: AppSyncResolverHandler<
  { id: string },
  {
    id: string
    gmUserId: string
    inviteCode: string
    createdAt: string
    players?: unknown[]
  } | null
> = async (event) => {
  const playTableId = event.arguments.id
  return fetchPlayTableWithPlayers(playTableId)
}

/** Dummy values for sub-resolver calls; sub-resolvers are async and don't use them. Kept for AppSyncResolverHandler type compatibility. */
const NOOP_CONTEXT = {} as Context
const NOOP_CALLBACK = undefined as unknown as Callback<unknown>

/**
 * Main handler that routes AppSync invocations to the appropriate resolver.
 * AppSync sends the full context when using Direct Lambda (no request template).
 * Uses async/await (no callback param) for Node.js 24+ compatibility.
 */
export const handler: AppSyncResolverHandler<unknown, unknown> = async (
  event: AppSyncResolverEvent<unknown>
) => {
  const fieldName = event.info?.fieldName ?? ''
  const parentType = event.info?.parentTypeName ?? ''

  if (parentType === 'Query') {
    if (fieldName === 'playTable') {
      const e = event as AppSyncResolverEvent<{ id: string }>
      return playTable(e, NOOP_CONTEXT, NOOP_CALLBACK)
    }
    if (fieldName === 'playTableByInviteCode') {
      const e = event as AppSyncResolverEvent<{ inviteCode: string }>
      return playTableByInviteCode(e, NOOP_CONTEXT, NOOP_CALLBACK)
    }
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
    if (fieldName === 'createPlayTable') {
      const e = event as AppSyncResolverEvent<Record<string, never>>
      return createPlayTable(e, NOOP_CONTEXT, NOOP_CALLBACK)
    }
    if (fieldName === 'joinPlayTable') {
      const e = event as AppSyncResolverEvent<{
        inviteCode: string
        input: { characterName: string; initiativeModifier: number }
      }>
      return joinPlayTable(e, NOOP_CONTEXT, NOOP_CALLBACK)
    }
    if (fieldName === 'leavePlayTable') {
      const e = event as AppSyncResolverEvent<{
        playTableId: string
        playerId: string
      }>
      return leavePlayTable(e, NOOP_CONTEXT, NOOP_CALLBACK)
    }
  }

  throw new Error(`Unknown resolver: ${parentType}.${fieldName}`)
}

interface RollItem {
  id: string
  playTableId: string
  rollerId: string
  rollerType: string
  diceType: string
  values: number[]
  modifier: number
  total: number
  advantage: string | null
  dc: number | null
  success: boolean | null
  visibility: string
  rollRequestType: string
  rollRequestId: string | null
  createdAt: string
}

export const rollHistory: AppSyncResolverHandler<
  { playTableId: string; limit?: number | null; nextToken?: string | null },
  { items: RollItem[]; nextToken: string | null }
> = async (event) => {
  const { playTableId, limit, nextToken } = event.arguments
  const pageSize = Math.min(Math.max(limit ?? 20, 1), 100)

  const baseParams = {
    TableName: TABLE_NAME,
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

  return {
    items: pageItems.map((r) => ({
      id: r.id as string,
      playTableId: r.playTableId as string,
      rollerId: r.rollerId as string,
      rollerType: r.rollerType as string,
      diceType: r.diceType as string,
      values: r.values as number[],
      modifier: r.modifier as number,
      total: r.total as number,
      advantage: (r.advantage as string) ?? null,
      dc: (r.dc as number) ?? null,
      success: (r.success as boolean) ?? null,
      visibility: r.visibility as string,
      rollRequestType: r.rollRequestType as string,
      rollRequestId: (r.rollRequestId as string) ?? null,
      createdAt: r.createdAt as string,
    })),
    nextToken: hasMore
      ? Buffer.from(JSON.stringify({ offset: startIndex + pageSize })).toString(
          'base64'
        )
      : null,
  }
}

export const playTableByInviteCode: AppSyncResolverHandler<
  { inviteCode: string },
  {
    id: string
    gmUserId: string
    inviteCode: string
    createdAt: string
    players?: unknown[]
  } | null
> = async (event) => {
  const { inviteCode } = event.arguments

  const queryResult = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk AND GSI2SK = :sk',
      ExpressionAttributeValues: marshall({
        ':pk': `INVITECODE#${inviteCode.toUpperCase()}`,
        ':sk': 'PLAYTABLE',
      }),
      Limit: 1,
    })
  )

  const items = queryResult.Items ?? []
  if (items.length === 0) return null

  const playTable = unmarshall(items[0]) as { id: string }
  return fetchPlayTableWithPlayers(playTable.id)
}
