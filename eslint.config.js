const js = require('@eslint/js')
const tseslint = require('typescript-eslint')
const react = require('eslint-plugin-react')
const reactHooks = require('eslint-plugin-react-hooks')
const prettier = require('eslint-plugin-prettier')
const simpleImportSort = require('eslint-plugin-simple-import-sort')
const prettierConfig = require('eslint-config-prettier/flat')

module.exports = tseslint.config(
  // Ignore build outputs and generated files
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cdk.out/**',
      '**/*.min.js',
      '**/generated.ts',
      'eslint.config.js',
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
  prettierConfig
)
