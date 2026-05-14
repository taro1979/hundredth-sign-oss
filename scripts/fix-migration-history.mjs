import mysql from "mysql2/promise";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Read migration hashes already registered in the target database.
const [rows] = await conn.execute("SELECT hash FROM __drizzle_migrations");
const applied = new Set(rows.map((r) => r.hash));

const journal = JSON.parse(fs.readFileSync("drizzle/meta/_journal.json", "utf8"));

let inserted = 0;
for (const entry of journal.entries) {
  const sqlFile = path.join("drizzle", entry.tag + ".sql");
  if (fs.existsSync(sqlFile) === false) {
    console.log("File not found: " + sqlFile);
    continue;
  }

  const content = fs.readFileSync(sqlFile, "utf8");
  const hash = crypto.createHash("sha256").update(content).digest("hex");

  if (applied.has(hash)) {
    console.log("Already applied: " + entry.tag);
  } else {
    // Register history only. SQL files are assumed to have been applied already.
    await conn.execute("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)", [
      hash,
      entry.when,
    ]);
    console.log("Registered: " + entry.tag + " (" + hash.substring(0, 8) + "...)");
    inserted++;
  }
}

console.log("Done. Inserted " + inserted + " entries.");
await conn.end();

