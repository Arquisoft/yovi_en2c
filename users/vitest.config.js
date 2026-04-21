import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Ensures every test run targets the isolated _test database
    env: {
      NODE_ENV: 'test',
    },
    // Drop the test database once after all suites finish
    globalSetup: './vitest.globalSetup.js',
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
})