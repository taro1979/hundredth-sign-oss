import { defineConfig } from "@playwright/test";

const shouldReuseExistingServer = process.env.PW_REUSE_SERVER === "1";
const baseURL = process.env.BASE_URL ?? "http://localhost:3001";
const parsedBaseURL = new URL(baseURL);
const serverPort = Number(
  parsedBaseURL.port || (parsedBaseURL.protocol === "https:" ? 443 : 80)
);

export default defineConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  // Keep E2E serial because several document/template tests share seeded fixtures.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: `node scripts/e2e-web-server.mjs`,
    port: serverPort,
    reuseExistingServer: shouldReuseExistingServer,
    timeout: 60_000,
  },
});
