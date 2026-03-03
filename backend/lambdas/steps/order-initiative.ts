import { Sha256 } from '@aws-crypto/sha256-js'
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import {
  type InitiativeRollRequestCreatedDetail,
  InitiativeRollRequestCreatedDetailSchema,
} from '@puzzlebottom-tabletop-tools/schemas'
import { HttpRequest } from '@smithy/protocol-http'
import { SignatureV4 } from '@smithy/signature-v4'
import type { Handler } from 'aws-lambda'

const dynamo = new DynamoDBClient({})
const TABLE_NAME = process.env.TABLE_NAME!
const APPSYNC_GRAPHQL_URL = process.env.APPSYNC_GRAPHQL_URL!
const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1'

interface InitiativeEntry {
  id: string
  characterName: string
  value: number
  modifier: number
  total: number
}

interface RollItem {
  rollerId: string
  values: number[]
  modifier: number
  total: number
  rollRequestId: string | null
}

interface PlayerItem {
  characterName: string
}

export const handler: Handler<
  InitiativeRollRequestCreatedDetail,
  void
> = async (event) => {
  const payload = InitiativeRollRequestCreatedDetailSchema.parse(event)
  const { playTableId, rollRequestId } = payload

  const pk = `PLAYTABLE#${playTableId}`

  const pendingResult = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: pk, SK: 'INITIATIVE_PENDING' }),
    })
  )
  if (!pendingResult.Item) {
    throw new Error('INITIATIVE_PENDING not found')
  }

  const rollsResult = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: marshall({
        ':pk': pk,
        ':sk': 'ROLL#',
      }),
    })
  )

  const rolls = (rollsResult.Items ?? [])
    .map((i) => unmarshall(i) as RollItem & { rollRequestType: string })
    .filter(
      (r) =>
        r.rollRequestType === 'initiative' &&
        (r.rollRequestId === rollRequestId || !r.rollRequestId)
    )

  const entries: InitiativeEntry[] = []
  for (const roll of rolls) {
    const playerResult = await dynamo.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({
          PK: pk,
          SK: `PLAYER#${roll.rollerId}`,
        }),
      })
    )
    const player = playerResult.Item
      ? (unmarshall(playerResult.Item) as PlayerItem)
      : null
    const characterName = player?.characterName ?? 'Unknown'
    const d20Value = roll.values[0] ?? roll.total - roll.modifier
    entries.push({
      id: roll.rollerId,
      characterName,
      value: d20Value,
      modifier: roll.modifier,
      total: roll.total,
    })
  }

  entries.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    if (b.value !== a.value) return b.value - a.value
    return b.modifier - a.modifier
  })

  const order = entries

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(
        {
          PK: pk,
          SK: 'INITIATIVE',
          rollRequestId,
          order,
          updatedAt: new Date().toISOString(),
        },
        { removeUndefinedValues: true }
      ),
    })
  )

  await notifyAppSync(playTableId, order)
}

async function notifyAppSync(
  playTableId: string,
  order: InitiativeEntry[]
): Promise<void> {
  const url = new URL(APPSYNC_GRAPHQL_URL)
  const mutation = `
    mutation NotifyInitiativeUpdated($playTableId: ID!, $order: [InitiativeEntryInput!]!) {
      notifyInitiativeUpdated(playTableId: $playTableId, order: $order) {
        id
        characterName
        value
        modifier
        total
      }
    }
  `
  const body = JSON.stringify({
    query: mutation,
    variables: { playTableId, order },
    operationName: 'NotifyInitiativeUpdated',
  })

  const request = new HttpRequest({
    method: 'POST',
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 443,
    path: url.pathname,
    headers: {
      'Content-Type': 'application/json',
      host: url.host,
    },
    body,
  })

  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: AWS_REGION,
    service: 'appsync',
    sha256: Sha256,
  })

  const signedRequest = await signer.sign(request)

  const headers = signedRequest.headers as Record<string, string>
  const response = await fetch(APPSYNC_GRAPHQL_URL, {
    method: signedRequest.method,
    headers,
    body: body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `AppSync notifyInitiativeUpdated failed: ${response.status} ${text}`
    )
  }
}
