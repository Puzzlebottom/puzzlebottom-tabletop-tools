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

/**
 * Main handler that routes AppSync invocations to the appropriate resolver.
 * AppSync sends the full context when using Direct Lambda (no request template).
 */
export const handler: AppSyncResolverHandler<unknown, unknown> = async (
  event: AppSyncResolverEvent<unknown>,
  context: Context,
  callback: Callback<unknown>
) => {
  const fieldName = event.info?.fieldName ?? ''
  const parentType = event.info?.parentTypeName ?? ''

  if (parentType === 'Query') {
    if (fieldName === 'playTable') {
      const e = event as AppSyncResolverEvent<{ id: string }>
      return playTable(e, context, callback)
    }
    if (fieldName === 'playTableByInviteCode') {
      const e = event as AppSyncResolverEvent<{ inviteCode: string }>
      return playTableByInviteCode(e, context, callback)
    }
  }

  if (parentType === 'Mutation') {
    if (fieldName === 'createPlayTable') {
      const e = event as AppSyncResolverEvent<Record<string, never>>
      return createPlayTable(e, context, callback)
    }
    if (fieldName === 'joinPlayTable') {
      const e = event as AppSyncResolverEvent<{
        inviteCode: string
        input: { characterName: string; initiativeModifier: number }
      }>
      return joinPlayTable(e, context, callback)
    }
    if (fieldName === 'leavePlayTable') {
      const e = event as AppSyncResolverEvent<{
        playTableId: string
        playerId: string
      }>
      return leavePlayTable(e, context, callback)
    }
  }

  throw new Error(`Unknown resolver: ${parentType}.${fieldName}`)
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
