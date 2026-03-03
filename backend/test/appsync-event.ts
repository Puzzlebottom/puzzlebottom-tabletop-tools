import type {
  AppSyncIdentityCognito,
  AppSyncResolverEvent,
} from 'aws-lambda/trigger/appsync-resolver'

/** Minimal Cognito identity for tests. Resolvers typically only need sub. */
function toTestIdentity(
  identity?: { sub?: string } | null
): AppSyncIdentityCognito | undefined {
  if (!identity?.sub) return undefined
  return {
    sub: identity.sub,
    issuer: 'https://cognito-idp.test.amazonaws.com/test',
    username: 'test-user',
    claims: {},
    sourceIp: [],
    defaultAuthStrategy: 'user',
    groups: null,
  }
}

/**
 * Creates a minimal AppSyncResolverEvent for unit testing.
 * Only arguments and identity are configurable; other fields use dummy values
 * since most resolvers only use those.
 */
export function createAppSyncEvent<TArguments>(
  args: TArguments,
  identity?: { sub?: string } | null
): AppSyncResolverEvent<TArguments> {
  return {
    arguments: args,
    identity: toTestIdentity(identity),
    source: null,
    request: { headers: {}, domainName: null },
    info: {
      selectionSetList: [],
      selectionSetGraphQL: '{}',
      parentTypeName: 'Mutation',
      fieldName: 'submitData',
      variables: {},
    },
    prev: null,
    stash: {},
  }
}
