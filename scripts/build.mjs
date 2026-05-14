#!/usr/bin/env node

import { runAll } from "./_run.mjs";

await runAll([
  { command: "vite", args: ["build"] },
  {
    command: "esbuild",
    args: [
      "server/_core/index.ts",
      "--platform=node",
      "--packages=external",
      "--bundle",
      "--format=esm",
      "--outdir=dist",
    ],
  },
]);

