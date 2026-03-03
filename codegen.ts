import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: './infrastructure/lib/graphql/schema.graphql',
  documents: ['frontend/src/graphql/**/*.ts'],
  generates: {
    './shared/graphql-types/src/generated.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-validation-schema',
      ],
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
