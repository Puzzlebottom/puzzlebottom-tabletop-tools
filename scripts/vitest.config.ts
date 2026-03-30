import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    ...(process.env.HUSKY === '1' && { reporters: ['dot'] }),
    globals: true,
    include: ['**/*.test.ts'],
    exclude: ['node_modules', 'frontend/**'],
    onConsoleLog(): boolean {
      return process.env.HUSKY !== '1'
    },
  },
})
