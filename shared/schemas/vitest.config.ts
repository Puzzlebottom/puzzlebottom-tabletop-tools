import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules'],
    onConsoleLog(): boolean {
      return process.env.HUSKY !== '1'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
    },
  },
})
