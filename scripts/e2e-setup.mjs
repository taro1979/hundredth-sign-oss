#!/usr/bin/env node

import { runAll } from "./_run.mjs";

await runAll([
  { command: "docker", args: ["compose", "-f", "docker-compose.e2e.yml", "up", "-d", "--wait"] },
  { command: "dotenv", args: ["-e", ".env.e2e", "--", "drizzle-kit", "generate"] },
  { command: "dotenv", args: ["-e", ".env.e2e", "--", "drizzle-kit", "migrate"] },
  { command: "dotenv", args: ["-e", ".env.e2e", "--", "tsx", "e2e/seed.ts"] },
]);

