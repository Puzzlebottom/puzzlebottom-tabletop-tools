import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: './infrastructure/lib/graphql/schema.graphql',
  generates: {
    './shared/graphql-types/src/generated.ts': {
      plugins: ['typescript', 'typescript-validation-schema'],
      config: {
        skipTypename: true,
        enumsAsTypes: true,
        strictScalars: true,
        scalars: { ID: 'string' },
        schema: 'zodv4',
        withObjectType: true,
      },
    },
  },
}

export default config
