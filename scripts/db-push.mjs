#!/usr/bin/env node

import { runAll } from "./_run.mjs";

await runAll([
  { command: "drizzle-kit", args: ["generate"] },
  { command: "drizzle-kit", args: ["migrate"] },
]);

