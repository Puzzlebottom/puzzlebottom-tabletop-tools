import { Sha256 } from '@aws-crypto/sha256-js'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { HttpRequest } from '@smithy/protocol-http'
import { SignatureV4 } from '@smithy/signature-v4'

const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1'

async function callAppSync(
  graphqlUrl: string,
  query: string,
  variables: Record<string, unknown>,
  operationName: string
): Promise<void> {
  const url = new URL(graphqlUrl)
  const body = JSON.stringify({ query, variables, operationName })

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
  const response = await fetch(graphqlUrl, {
    method: signedRequest.method,
    headers,
    body,
  })

  const responseBody = await response.text()

  if (!response.ok) {
    throw new Error(
      `AppSync ${operationName} failed: ${response.status} ${responseBody}`
    )
  }

  const parsed = JSON.parse(responseBody) as {
    errors?: { message: string }[]
  }
  if (parsed.errors?.length) {
    throw new Error(
      `AppSync ${operationName} GraphQL errors: ${JSON.stringify(parsed.errors)}`
    )
  }
}

interface InitiativeEntry {
  id: string
  characterName: string
  value: number
  modifier: number
  total: number
}

export async function notifyInitiativeUpdated(
  graphqlUrl: string,
  playTableId: string,
  order: InitiativeEntry[]
): Promise<void> {
  const mutation = `
    mutation NotifyInitiativeUpdated($playTableId: ID!, $order: [InitiativeEntryInput!]!) {
      notifyInitiativeUpdated(playTableId: $playTableId, order: $order) {
        order {
          id
          characterName
          value
          modifier
          total
        }
      }
    }
  `
  await callAppSync(
    graphqlUrl,
    mutation,
    { playTableId, order },
    'NotifyInitiativeUpdated'
  )
}

export interface RollResultPayload {
  playTableId: string
  rollId: string
  values: number[]
  modifier: number
  total: number
  advantage?: string | null
  dc?: number | null
  success?: boolean | null
  visibility: string
}

export async function notifyRollCompleted(
  graphqlUrl: string,
  input: RollResultPayload
): Promise<void> {
  const mutation = `
    mutation NotifyRollCompleted($input: RollResultInput!) {
      notifyRollCompleted(input: $input) {
        playTableId
        rollId
        values
        modifier
        total
        advantage
        dc
        success
        visibility
      }
    }
  `
  await callAppSync(graphqlUrl, mutation, { input }, 'NotifyRollCompleted')
}
