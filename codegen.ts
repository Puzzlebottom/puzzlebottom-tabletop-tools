import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  generates: {
    './shared/graphql-types/src/generated.ts': {
      schema: './infrastructure/lib/graphql/schema.graphql',
      documents: ['frontend/src/graphql/**/*.ts'],
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
    './shared/schemas/src/events/generated.ts': {
      schema: './infrastructure/lib/graphql/events.graphql',
      documents: [],
      plugins: ['typescript', 'typescript-validation-schema'],
      config: {
        skipTypename: false,
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
