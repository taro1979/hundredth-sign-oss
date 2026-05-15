#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import mysql from "mysql2/promise";

const migrationFlag = process.env.SIGN_RUN_MIGRATIONS ?? "false";
const shouldRunMigrations = ["1", "true", "yes"].includes(migrationFlag.toLowerCase());
const waitTimeoutMs = Number(process.env.SIGN_DB_WAIT_TIMEOUT_MS ?? "60000");
const defaultCommand = ["node", "dist/index.js"];
const command = process.argv.slice(2).length > 0 ? process.argv.slice(2) : defaultCommand;

function dbConfig() {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    throw new Error("DATABASE_URL is required");
  }
  return process.env.DB_SSL === "true"
    ? { uri, ssl: { rejectUnauthorized: false } }
    : uri;
}

async function connect() {
  return mysql.createConnection(dbConfig());
}

async function waitForDatabase() {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < waitTimeoutMs) {
    try {
      const conn = await connect();
      await conn.ping();
      await conn.end();
      return;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error(
    `Database did not become ready within ${waitTimeoutMs}ms: ${lastError?.message ?? lastError}`
  );
}

function migrationHash(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function migrationStatements(content) {
  return content
    .split("--> statement-breakpoint")
    .map(statement => statement.trim())
    .filter(Boolean);
}

async function ensureMigrationTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      hash TEXT NOT NULL,
      created_at BIGINT,
      PRIMARY KEY (id)
    )
  `);
}

async function appliedMigrationHashes(conn) {
  const [rows] = await conn.query("SELECT hash FROM __drizzle_migrations");
  return new Set(rows.map(row => row.hash));
}

async function runMigrations() {
  const journalPath = path.join(process.cwd(), "drizzle", "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  const conn = await connect();

  try {
    await ensureMigrationTable(conn);
    const applied = await appliedMigrationHashes(conn);

    for (const entry of journal.entries) {
      const sqlPath = path.join(process.cwd(), "drizzle", `${entry.tag}.sql`);
      const content = fs.readFileSync(sqlPath, "utf8");
      const hash = migrationHash(content);

      if (applied.has(hash)) {
        console.log(`[DockerEntrypoint] Migration already applied: ${entry.tag}`);
        continue;
      }

      console.log(`[DockerEntrypoint] Applying migration: ${entry.tag}`);
      await conn.beginTransaction();
      try {
        for (const statement of migrationStatements(content)) {
          await conn.query(statement);
        }
        await conn.query(
          "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
          [hash, entry.when]
        );
        await conn.commit();
      } catch (error) {
        await conn.rollback();
        throw error;
      }

      applied.add(hash);
    }
  } finally {
    await conn.end();
  }
}

function runApp() {
  const child = spawn(command[0], command.slice(1), { stdio: "inherit" });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      child.kill(signal);
    });
  }

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  child.on("error", error => {
    console.error(error);
    process.exit(1);
  });
}

await waitForDatabase();

if (shouldRunMigrations) {
  await runMigrations();
} else {
  console.log("[DockerEntrypoint] SIGN_RUN_MIGRATIONS is false; skipping automatic migrations.");
}

runApp();
