const path = require('path')
const js = require('@eslint/js')
const tseslint = require('typescript-eslint')
const boundaries = require('eslint-plugin-boundaries')
const react = require('eslint-plugin-react')
const reactHooks = require('eslint-plugin-react-hooks')
const prettier = require('eslint-plugin-prettier')
const simpleImportSort = require('eslint-plugin-simple-import-sort')
const vitest = require('@vitest/eslint-plugin')
const prettierConfig = require('eslint-config-prettier/flat')

module.exports = tseslint.config(
  // Ignore build outputs and generated files
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cdk.out/**',
      '**/coverage/**',
      '**/*.min.js',
      'eslint.config.js',
      'commitlint.config.js',
      '**/vitest.config.ts',
    ],
  },
  // Base: ESLint recommended + TypeScript recommended (type-checked)
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },

  // Boundaries: enforce clean architecture (tests inherit element of code under test)
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { boundaries },
    settings: {
      'boundaries/root-path': path.join(__dirname),
      'boundaries/elements': [
        { type: 'domain', pattern: 'shared/schemas/**/*.ts', mode: 'full' },
        {
          type: 'contracts',
          pattern: 'shared/graphql-types/**/*.ts',
          mode: 'full',
        },
        {
          type: 'steps',
          pattern: 'backend/lambdas/steps/**/*.ts',
          mode: 'full',
        },
        {
          type: 'resolvers',
          pattern: 'backend/lambdas/resolvers/**/*.ts',
          mode: 'full',
        },
        {
          type: 'handlers',
          pattern: 'backend/lambdas/handlers/**/*.ts',
          mode: 'full',
        },
        { type: 'frontend', pattern: 'frontend/src/**/*.ts', mode: 'full' },
        { type: 'frontend', pattern: 'frontend/src/**/*.tsx', mode: 'full' },
        {
          type: 'infrastructure',
          pattern: 'infrastructure/lib/**/*.ts',
          mode: 'full',
        },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'domain', allow: ['contracts'] },
            { from: 'contracts', disallow: ['*'] },
            { from: 'steps', allow: ['domain'] },
            { from: 'resolvers', allow: ['domain', 'contracts'] },
            { from: 'handlers', allow: ['domain', 'handlers'] },
            { from: 'frontend', allow: ['domain', 'contracts'] },
            { from: 'infrastructure', allow: [] },
          ],
        },
      ],
    },
  },

  // All TypeScript files: import order + rules not in presets
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: 'error',
      'no-console': 'warn',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },

  // Frontend: React rules
  {
    files: ['frontend/**/*.ts', 'frontend/**/*.tsx'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // React 17+ JSX transform
      'react/self-closing-comp': 'error',
    },
  },

  // Prettier as ESLint rule: squiggles for formatting, fixable via lint:fix
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { prettier },
    rules: {
      'prettier/prettier': 'error',
    },
  },

  // Must be last: disables ESLint rules that conflict with Prettier
  prettierConfig,

  // DiceRoller + DiceRollerScene: Three.js/R3F use lowercase primitives and types that strict TS may not resolve
  {
    files: [
      'frontend/src/components/DiceRoller.tsx',
      'frontend/src/components/DiceRollerScene.tsx',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'react/no-unknown-property': [
        'error',
        {
          ignore: [
            'args',
            'intensity',
            'position',
            'roughness',
            'metalness',
            'flatShading',
          ],
        },
      ],
    },
  },

  // Test files: Vitest plugin + relax no-unsafe-assignment for expect.any(), expect.objectContaining, etc.
  {
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/test/**/*.ts',
      '**/test/**/*.tsx',
    ],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },

  // Infrastructure CDK tests: use Template assertions, not expect()
  {
    files: ['infrastructure/**/*.test.ts'],
    rules: {
      'vitest/expect-expect': 'off',
    },
  },

  // Test setup: ResizeObserver mock needs empty methods
  {
    files: ['frontend/src/test/setup.ts'],
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
    },
  },

  // Lambda dispatcher: console is intentional for CloudWatch logging
  {
    files: ['backend/lambdas/steps/trigger.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // Generated code: relax rules so it can be loaded for type resolution without failing lint
  {
    files: ['**/generated.ts'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      '@typescript-eslint/consistent-indexed-object-style': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
)
