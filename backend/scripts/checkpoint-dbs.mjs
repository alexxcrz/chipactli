import path from "node:path";
import { fileURLToPath } from "node:url";
import sqlite3 from "sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = process.argv[2] || process.env.DB_DIR || path.resolve(__dirname, "..", "data");
const dbNames = ["inventario", "recetas", "produccion", "ventas", "admin"];

const run = (db, sql) =>
  new Promise((resolve, reject) => {
    db.run(sql, [], (err) => (err ? reject(err) : resolve()));
  });

for (const name of dbNames) {
  const dbPath = path.join(baseDir, `${name}.db`);
  const db = new sqlite3.Database(dbPath);

  try {
    // Merge WAL changes into the main DB file before file-copy backups.
    await run(db, "PRAGMA wal_checkpoint(TRUNCATE)");
    console.log(`CHECKPOINT_OK ${name}`);
  } catch (error) {
    console.error(`CHECKPOINT_ERR ${name}: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await new Promise((resolve) => db.close(() => resolve()));
  }
}
