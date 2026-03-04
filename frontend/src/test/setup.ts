import '@testing-library/jest-dom/vitest'

// Provide API key for join flow tests (JoinPlayTablePage uses apiKey auth)
process.env.VITE_GRAPHQL_API_KEY =
  process.env.VITE_GRAPHQL_API_KEY ?? 'test-api-key'

// Required by @react-three/fiber (react-use-measure) in jsdom
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
