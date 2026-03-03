import { Sha256 } from '@aws-crypto/sha256-js'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { HttpRequest } from '@smithy/protocol-http'
import { SignatureV4 } from '@smithy/signature-v4'

const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1'

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
  const url = new URL(graphqlUrl)
  const mutation = `
    mutation NotifyInitiativeUpdated($playTableId: ID!, $order: [InitiativeEntry!]!) {
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
  const response = await fetch(graphqlUrl, {
    method: signedRequest.method,
    headers,
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `AppSync notifyInitiativeUpdated failed: ${response.status} ${text}`
    )
  }
}
