import type { AppSyncResolverEvent } from 'aws-lambda/trigger/appsync-resolver'

/**
 * Creates a minimal AppSyncResolverEvent for unit testing.
 * Only arguments and identity are configurable; other fields use dummy values
 * since most resolvers only use those.
 */
export function createAppSyncEvent<TArguments>(
  args: TArguments,
  identity?: AppSyncResolverEvent<TArguments>['identity']
): AppSyncResolverEvent<TArguments> {
  return {
    arguments: args,
    identity: identity ?? undefined,
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
