import path from "path";
import { fileURLToPath } from "url";
import pkg from "sqlite3";
import { Client } from "pg";

const { Database } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SQLITE_DB_FILES = {
  inventario: "inventario.db",
  recetas: "recetas.db",
  produccion: "produccion.db",
  ventas: "ventas.db",
  admin: "admin.db"
};

function qIdent(value) {
  return `"${String(value || "").replaceAll('"', '""')}"`;
}

function mapSqliteTypeToPg(sqliteType) {
  const t = String(sqliteType || "").toUpperCase();
  if (t.includes("INT")) return "BIGINT";
  if (t.includes("CHAR") || t.includes("CLOB") || t.includes("TEXT")) return "TEXT";
  if (t.includes("BLOB")) return "BYTEA";
  if (t.includes("REAL") || t.includes("FLOA") || t.includes("DOUB")) return "DOUBLE PRECISION";
  if (t.includes("NUM") || t.includes("DEC") || t.includes("BOOL")) return "NUMERIC";
  if (t.includes("DATE") || t.includes("TIME")) return "TIMESTAMP";
  return "TEXT";
}

function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function sqliteClose(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => (err ? reject(err) : resolve()));
  });
}

async function ensurePgTableFromSqlite({ pg, schema, tableName, columns }) {
  const orderedColumns = [...columns].sort((a, b) => Number(a.pk || 0) - Number(b.pk || 0));
  const pkColumns = orderedColumns.filter((c) => Number(c.pk || 0) > 0).map((c) => c.name);

  const colDefs = orderedColumns.map((col) => {
    const pgType = mapSqliteTypeToPg(col.type);
    const notNull = Number(col.notnull || 0) ? " NOT NULL" : "";
    return `${qIdent(col.name)} ${pgType}${notNull}`;
  });

  const pkConstraint = pkColumns.length
    ? `, PRIMARY KEY (${pkColumns.map((c) => qIdent(c)).join(", ")})`
    : "";

  const createSql = `
    CREATE TABLE IF NOT EXISTS ${qIdent(schema)}.${qIdent(tableName)} (
      ${colDefs.join(",\n      ")}${pkConstraint}
    )
  `;

  await pg.query(createSql);
}

async function copyRowsToPg({ pg, schema, tableName, rows, columns }) {
  if (!rows.length || !columns.length) return 0;

  await pg.query(`TRUNCATE TABLE ${qIdent(schema)}.${qIdent(tableName)} RESTART IDENTITY CASCADE`);

  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    const values = [];
    const placeholders = [];

    batch.forEach((row, rowIdx) => {
      const rowPlaceholders = [];
      columns.forEach((col, colIdx) => {
        const value = row[col];
        values.push(value === undefined ? null : value);
        rowPlaceholders.push(`$${rowIdx * columns.length + colIdx + 1}`);
      });
      placeholders.push(`(${rowPlaceholders.join(", ")})`);
    });

    const insertSql = `
      INSERT INTO ${qIdent(schema)}.${qIdent(tableName)} (${columns.map((c) => qIdent(c)).join(", ")})
      VALUES ${placeholders.join(",\n")}
    `;

    await pg.query(insertSql, values);
    inserted += batch.length;
  }

  return inserted;
}

async function migrateOneDb({ pg, sqliteFilePath, dbName, schemaPrefix }) {
  const schema = `${schemaPrefix}_${dbName}`;
  const sqlite = new Database(sqliteFilePath);

  await pg.query(`CREATE SCHEMA IF NOT EXISTS ${qIdent(schema)}`);

  const tables = await sqliteAll(
    sqlite,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );

  const summary = { dbName, schema, tables: {}, totalTables: 0, totalRows: 0 };

  for (const table of tables) {
    const tableName = String(table.name || "").trim();
    if (!tableName) continue;

    const pragmaRows = await sqliteAll(sqlite, `PRAGMA table_info(${qIdent(tableName)})`);
    const columns = pragmaRows.map((c) => ({
      name: c.name,
      type: c.type,
      notnull: c.notnull,
      pk: c.pk
    }));

    if (!columns.length) continue;

    await ensurePgTableFromSqlite({ pg, schema, tableName, columns });

    const rows = await sqliteAll(sqlite, `SELECT * FROM ${qIdent(tableName)}`);
    const inserted = await copyRowsToPg({
      pg,
      schema,
      tableName,
      rows,
      columns: columns.map((c) => c.name)
    });

    summary.tables[tableName] = inserted;
    summary.totalTables += 1;
    summary.totalRows += inserted;
    console.log(`[${dbName}] ${tableName}: ${inserted} filas`);
  }

  await sqliteClose(sqlite);
  return summary;
}

async function run() {
  const sqliteDir = process.env.SQLITE_DB_DIR
    ? path.resolve(process.env.SQLITE_DB_DIR)
    : (process.env.DB_DIR ? path.resolve(process.env.DB_DIR) : path.resolve(__dirname, "..", "data"));

  const schemaPrefix = String(process.env.PG_SCHEMA_PREFIX || "chipactli").trim().toLowerCase();
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  const useSsl = String(process.env.PG_SSL || "1").trim() !== "0";

  if (!databaseUrl) {
    throw new Error("Falta DATABASE_URL para conectar a PostgreSQL");
  }

  const pg = new Client({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : false
  });

  await pg.connect();
  console.log(`Conectado a PostgreSQL. Migrando SQLite desde: ${sqliteDir}`);

  const report = {};

  try {
    for (const [dbName, fileName] of Object.entries(SQLITE_DB_FILES)) {
      const sqliteFilePath = path.join(sqliteDir, fileName);
      console.log(`\n== Migrando ${dbName} (${sqliteFilePath}) ==`);
      report[dbName] = await migrateOneDb({ pg, sqliteFilePath, dbName, schemaPrefix });
    }
  } finally {
    await pg.end();
  }

  const totalRows = Object.values(report).reduce((acc, item) => acc + Number(item.totalRows || 0), 0);
  const totalTables = Object.values(report).reduce((acc, item) => acc + Number(item.totalTables || 0), 0);

  console.log("\nMigracion completada.");
  console.log(`Tablas migradas: ${totalTables}`);
  console.log(`Filas migradas: ${totalRows}`);
  console.log("Resumen:");
  console.log(JSON.stringify(report, null, 2));
}

run().catch((error) => {
  console.error("Error en migracion SQLite -> PostgreSQL:", error.message);
  process.exit(1);
});
