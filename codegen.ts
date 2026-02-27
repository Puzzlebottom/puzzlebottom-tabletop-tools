import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: './infrastructure/lib/graphql/schema.graphql',
  generates: {
    './shared/graphql-types/src/generated.ts': {
      plugins: ['typescript'],
      config: {
        skipTypename: true,
        enumsAsTypes: true,
      },
    },
  },
}

export default config
