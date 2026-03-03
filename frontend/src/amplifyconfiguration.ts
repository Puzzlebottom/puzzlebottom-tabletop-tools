const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
    },
  },
  API: {
    GraphQL: {
      endpoint: import.meta.env.VITE_GRAPHQL_ENDPOINT,
      defaultAuthMode: 'userPool' as const,
      apiKey: import.meta.env.VITE_GRAPHQL_API_KEY as string | undefined,
    },
  },
}

export default amplifyConfig
