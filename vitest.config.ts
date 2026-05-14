import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  plugins: [react()],
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    testTimeout: 60000,
    hookTimeout: 30000,
    environment: "node",
    // Route CPU-heavy integration tests to forks pool to avoid IPC timeouts
    poolMatchGlobs: [
      ["**/*.integration.test.ts", "forks"],
    ],
    environmentMatchGlobs: [
      ["client/**/*.test.tsx", "jsdom"],
      ["client/**/*.spec.tsx", "jsdom"],
    ],
    env: {
      NODE_ENV: "test",
    },
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "client/**/*.test.tsx",
    ],
    setupFiles: ["./client/src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["server/**/*.ts", "shared/**/*.ts"],
      exclude: [
        "server/**/*.test.ts",
        "server/**/*.spec.ts",
        "server/index.ts",
        "server/_core/context.ts",
        "server/_core/trpc.ts",
        "server/_core/oauth.ts",
        // Entry point — not unit-testable (starts the HTTP server)
        "server/_core/index.ts",
        // Template utility files not used by this project
        "server/_core/dataApi.ts",
        "server/_core/imageGeneration.ts",
        "server/_core/llm.ts",
        "server/_core/map.ts",
        "server/_core/sdk.ts",
        "server/_core/vite.ts",
        "server/_core/voiceTranscription.ts",
        "shared/types.ts",
        "shared/_core/**",
        // Infrastructure: requires real DB connection, not unit-testable
        "server/checkMigrations.ts",
      ],
      reporter: ["text", "text-summary", "json-summary", "json"],
      reportsDirectory: "./coverage",
      thresholds: {
        statements: 90,
        branches: 90,
      },
    },
  },
});
