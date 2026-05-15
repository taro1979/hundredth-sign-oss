#!/usr/bin/env node

import { run } from "./_run.mjs";
import { config } from "dotenv";

config({ path: ".env.e2e" });

const port = process.env.PORT ?? "4818";
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;

await run("tsx", ["server/_core/index.ts"], {
  env: {
    PORT: port,
    APP_URL: baseURL,
    BASE_URL: baseURL,
    NODE_ENV: "development",
  },
});
