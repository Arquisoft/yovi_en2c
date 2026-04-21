import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8', // you already installed this 👍
            reporter: ['text', 'lcov'], // 👈 THIS is the key
            reportsDirectory: './coverage'
        }
    }
})