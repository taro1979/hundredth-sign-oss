/**
 * Playwright global setup — runs seed before all tests.
 *
 * Note: Docker + DB migration should already be done via `pnpm test:e2e:setup`.
 * This global-setup only re-runs the seed for safety (idempotent).
 */
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";

/** Parse a .env file into key/value pairs (skips comments and empty lines). */
function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of readFileSync(filePath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

export default async function globalSetup() {
  // Playwright may strip env vars from process.env, so read .env.e2e directly
  // and merge into the child process env explicitly.
  // Use .env.e2e if present, otherwise fall back to .env (worktree may have only .env)
  const cwd = process.cwd();
  const envFile = [".env.e2e", ".env"].find(f => {
    try {
      readFileSync(resolve(cwd, f));
      return true;
    } catch {
      return false;
    }
  });
  const e2eEnv = envFile ? parseEnvFile(resolve(cwd, envFile)) : {};

  console.log("[global-setup] Running E2E seed...");
  try {
    const tsxBin =
      process.platform === "win32"
        ? "node_modules\\.bin\\tsx.cmd"
        : "node_modules/.bin/tsx";
    execSync(`"${tsxBin}" e2e/seed.ts`, {
      stdio: "inherit",
      env: { ...process.env, ...e2eEnv },
    });
  } catch (err) {
    console.error("[global-setup] Seed failed:", err);
    throw err;
  }
}
