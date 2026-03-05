import sqlite3 from "sqlite3";
import path from "node:path";

const baseDir = process.argv[2] || path.join(process.env.TEMP || ".", "chipactli-render-check2");

const openDb = (name) => new sqlite3.Database(path.join(baseDir, `${name}.db`));
const one = (db, sql) =>
  new Promise((resolve, reject) => {
    db.get(sql, [], (err, row) => (err ? reject(err) : resolve(row)));
  });
const many = (db, sql) =>
  new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const admin = openDb("admin");
const inventario = openDb("inventario");
const recetas = openDb("recetas");
const produccion = openDb("produccion");
const ventas = openDb("ventas");

try {
  const adminTables = await many(admin, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const users = await many(admin, "SELECT id, username, rol, debe_cambiar_password FROM usuarios ORDER BY id");

  const inv = await one(inventario, "SELECT COUNT(*) AS c FROM inventario");
  const rec = await one(recetas, "SELECT COUNT(*) AS c FROM recetas");
  const prod = await one(produccion, "SELECT COUNT(*) AS c FROM produccion");
  const tc = await one(ventas, "SELECT COUNT(*) AS c FROM tienda_catalogo");
  const tp = await one(ventas, "SELECT COUNT(*) AS c FROM tienda_puntos_entrega");

  console.log("ADMIN_TABLES", JSON.stringify(adminTables));
  console.log("RENDER_USERS", JSON.stringify(users));
  console.log(
    "RENDER_COUNTS",
    JSON.stringify(
      {
        inventario: inv.c,
        recetas: rec.c,
        produccion: prod.c,
        tienda_catalogo: tc.c,
        tienda_puntos: tp.c,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error("VERIFY_ERR", error.message);
  process.exitCode = 1;
} finally {
  admin.close();
  inventario.close();
  recetas.close();
  produccion.close();
  ventas.close();
}
