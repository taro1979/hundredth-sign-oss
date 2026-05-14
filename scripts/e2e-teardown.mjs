#!/usr/bin/env node

import fs from "node:fs/promises";
import { run } from "./_run.mjs";

await run("docker", ["compose", "-f", "docker-compose.e2e.yml", "down", "-v"]);
await fs.rm("coverage", { recursive: true, force: true });

