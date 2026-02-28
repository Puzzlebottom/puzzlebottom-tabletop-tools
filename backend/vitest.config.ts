import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    ...(process.env.HUSKY === '1' && { reporters: ['dot'] }),
    globals: true,
    include: ['**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    onConsoleLog(): boolean {
      return process.env.HUSKY !== '1' // suppress only in pre-commit/pre-push
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      exclude: [
        '**/generated.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/test/**',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
})
