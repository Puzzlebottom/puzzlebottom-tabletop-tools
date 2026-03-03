import '@testing-library/jest-dom/vitest'

// Required by @react-three/fiber (react-use-measure) in jsdom
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
