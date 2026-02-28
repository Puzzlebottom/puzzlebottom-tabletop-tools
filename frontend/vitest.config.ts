import type { UserConfig } from 'vite'
import { mergeConfig } from 'vite'
import { defineConfig } from 'vitest/config'

import viteConfig from './vite.config'

export default defineConfig(() =>
  mergeConfig(viteConfig as UserConfig, {
    test: {
      ...(process.env.HUSKY === '1' && { reporters: ['dot'] }),
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      onConsoleLog(): boolean {
        return process.env.HUSKY !== '1' // suppress only in pre-commit/pre-push
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'text-summary', 'html'],
        exclude: [
          '**/generated.ts',
          '**/*.test.{ts,tsx}',
          '**/*.spec.{ts,tsx}',
          'src/test/**',
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
)
