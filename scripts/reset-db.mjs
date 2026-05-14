import { createConnection } from "mysql2/promise";
import { config } from "dotenv";

config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const conn = await createConnection(url);

try {
  console.log("Disabling foreign key checks...");
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");

  const [rows] = await conn.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()",
  );

  const tables = rows.map((r) => r.table_name || r.TABLE_NAME);
  console.log(`Found ${tables.length} tables:`, tables);

  for (const table of tables) {
    console.log(`Dropping table: ${table}`);
    await conn.query(`DROP TABLE IF EXISTS \`${table}\``);
  }

  console.log("Re-enabling foreign key checks...");
  await conn.query("SET FOREIGN_KEY_CHECKS = 1");

  console.log("All tables dropped successfully.");
} catch (err) {
  console.error("Error:", err);
  process.exit(1);
} finally {
  await conn.end();
}

