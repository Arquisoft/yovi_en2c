import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      all: true,
      include: ['gateway-service.js']
    }
  }
})
