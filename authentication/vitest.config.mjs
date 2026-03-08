import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',           // modern V8 coverage
      reporter: ['text', 'lcov'],
      all: true,
    }
  }
})