/**
 * Migration health check
 *
 * Runs at server startup to detect unapplied migrations early.
 * If any migration in the journal has not been applied to the DB,
 * the server logs a clear warning and throws an error so the
 * operator knows to run `pnpm db:push` before serving traffic.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

interface JournalEntry {
  idx: number;
  tag: string;
  when: number;
}

interface Journal {
  entries: JournalEntry[];
}

export async function checkMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    // No DB configured; skip check (e.g. test environment).
    return;
  }

  const journalPath = path.join(process.cwd(), "drizzle", "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    console.warn("[MigrationCheck] Journal file not found, skipping check.");
    return;
  }

  const journal: Journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));

  let conn: mysql.Connection | null = null;
  try {
    conn = process.env.DB_SSL === "true"
      ? await mysql.createConnection({ uri: databaseUrl, ssl: { rejectUnauthorized: false } })
      : await mysql.createConnection(databaseUrl);

    // Fetch all applied migration hashes
    const [rows] = await conn.execute<mysql.RowDataPacket[]>(
      "SELECT hash FROM __drizzle_migrations"
    );
    const appliedHashes = new Set(rows.map((r) => r.hash as string));

    const unapplied: string[] = [];
    for (const entry of journal.entries) {
      const sqlFile = path.join(process.cwd(), "drizzle", `${entry.tag}.sql`);
      if (!fs.existsSync(sqlFile)) continue;

      const content = fs.readFileSync(sqlFile, "utf8");
      const possibleHashes = [
        crypto.createHash("sha256").update(content).digest("hex"),
        crypto.createHash("sha256").update(content.replace(/\r\n/g, "\n")).digest("hex"),
      ];

      if (!possibleHashes.some((hash) => appliedHashes.has(hash))) {
        unapplied.push(entry.tag);
      }
    }

    if (unapplied.length > 0) {
      const msg =
        `[MigrationCheck] ${unapplied.length} unapplied migration(s) detected:\n` +
        unapplied.map((t) => `  - ${t}`).join("\n") +
        "\n  Run `pnpm db:push` then restart the server.";
      console.error(msg);
      throw new Error(
        `Server startup aborted: unapplied migrations detected. Run \`pnpm db:push\` first.\n` +
          unapplied.join(", ")
      );
    }

    console.log(
      `[MigrationCheck] All ${journal.entries.length} migration(s) applied.`
    );
  } finally {
    if (conn) await conn.end();
  }
}
