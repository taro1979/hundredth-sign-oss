#!/usr/bin/env node

import { run } from "./_run.mjs";

await run("c8", [
  "report",
  "--include=server/**/*.ts",
  "--exclude=**/*.test.ts",
  "--reporter=html",
  "--reporter=text",
  "--check-coverage",
]);

