import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/__tests__/**",
        "src/server.ts",
        "src/dtos/**",
        "src/models/**"
      ]
    }
  }
});