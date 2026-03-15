import { Sha256 } from '@aws-crypto/sha256-js'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import type {
  PublishInitiativeUpdatedInput,
  PublishRollInput,
  PublishRollRequestInput,
} from '@puzzlebottom-tabletop-tools/graphql-types'
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

export async function publishInitiativeUpdated(
  graphqlUrl: string,
  input: PublishInitiativeUpdatedInput
): Promise<void> {
  const mutation = `
    mutation PublishInitiativeUpdated($input: PublishInitiativeUpdatedInput!) {
      publishInitiativeUpdated(input: $input) {
        id
        playTableId
        rollerId
        rollNotation
        type
        values
        modifier
        rollResult
        isPrivate
        rollRequestId
        createdAt
        deletedAt
      }
    }
  `
  await callAppSync(graphqlUrl, mutation, { input }, 'PublishInitiativeUpdated')
}

export async function publishRollRequestCreated(
  graphqlUrl: string,
  input: PublishRollRequestInput
): Promise<void> {
  const mutation = `
    mutation PublishRollRequestCreated($input: PublishRollRequestInput!) {
      publishRollRequestCreated(input: $input) {
        id
        playTableId
        targetPlayerIds
        rolls {
          id
          playTableId
          rollerId
          rollNotation
          type
          values
          modifier
          rollResult
          isPrivate
          rollRequestId
          createdAt
          deletedAt
        }
        rollNotation
        type
        dc
        isPrivate
        createdAt
        deletedAt
      }
    }
  `
  await callAppSync(
    graphqlUrl,
    mutation,
    { input },
    'PublishRollRequestCreated'
  )
}

export async function publishRollCompleted(
  graphqlUrl: string,
  input: PublishRollInput
): Promise<void> {
  const mutation = `
    mutation PublishRollCompleted($input: PublishRollInput!) {
      publishRollCompleted(input: $input) {
        id
        playTableId
        rollerId
        rollNotation
        type
        values
        modifier
        rollResult
        isPrivate
        rollRequestId
        createdAt
        deletedAt
      }
    }
  `
  await callAppSync(graphqlUrl, mutation, { input }, 'PublishRollCompleted')
}
