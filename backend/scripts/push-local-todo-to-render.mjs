import path from "path";
import { fileURLToPath } from "url";
import pkg from "sqlite3";

const { Database } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = String(process.env.TARGET_URL || "https://chipactli.onrender.com").replace(/\/$/, "");
const DB_DIR = process.env.LOCAL_DB_DIR
  ? path.resolve(process.env.LOCAL_DB_DIR)
  : path.resolve(__dirname, "..", "data");

const DB_FILES = {
  inventario: "inventario.db",
  recetas: "recetas.db",
  produccion: "produccion.db",
  ventas: "ventas.db",
  admin: "admin.db"
};

function qIdent(value) {
  return `"${String(value || "").replaceAll('"', '""')}"`;
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function dbClose(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => (err ? reject(err) : resolve()));
  });
}

async function exportDb(filePath) {
  const db = new Database(filePath);
  const out = { tablas: {} };

  try {
    const tablas = await dbAll(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    for (const t of tablas) {
      const nombre = String(t?.name || "").trim();
      if (!nombre) continue;
      out.tablas[nombre] = await dbAll(db, `SELECT * FROM ${qIdent(nombre)}`);
    }

    return out;
  } finally {
    await dbClose(db);
  }
}

async function run() {
  const payload = {
    tipo: "todo",
    version: 1,
    generado_en: new Date().toISOString(),
    dbs: {}
  };

  for (const [key, file] of Object.entries(DB_FILES)) {
    const full = path.join(DB_DIR, file);
    payload.dbs[key] = await exportDb(full);
  }

  const res = await fetch(`${BASE_URL}/api/importar/todo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  }

  console.log(JSON.stringify(data, null, 2));
}

run().catch((error) => {
  console.error("Error importando TODO local -> Render:", error.message);
  process.exit(1);
});
