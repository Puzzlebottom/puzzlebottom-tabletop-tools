import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    ...(process.env.HUSKY === '1' && { reporters: ['dot'] }),
    globals: true,
    testTimeout: 60_000, // CDK synthesis + Lambda bundling can take 30+ seconds
    include: ['**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist', 'cdk.out'],
    onConsoleLog(): boolean {
      return process.env.HUSKY !== '1'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/bin/**'],
    },
  },
})
