import { transmitir } from "../../utils/index.js";

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ changes: this?.changes || 0, lastID: this?.lastID || 0 });
    });
  });
}

export function registrarRutasCortesias(app, bdVentas, bdProduccion) {
  app.post("/cortesia/:id", (req, res) => {
    const { nombre_receta, cantidad, numero_pedido, motivo, para_quien } = req.body;
    const fechaNow = new Date().toISOString();

    bdVentas.run(
      "INSERT INTO cortesias (nombre_receta, cantidad, fecha_cortesia, numero_pedido, motivo, para_quien) VALUES (?,?,?,?,?,?)",
      [nombre_receta, cantidad, fechaNow, numero_pedido || "", motivo || "", para_quien || ""],
      (err) => {
        if (err) return res.status(500).json({ error: "Error cortesias" });
        bdProduccion.run("DELETE FROM produccion WHERE id=?", [req.params.id], () => {
          transmitir({ tipo: "produccion_actualizado" });
          transmitir({ tipo: "cortesias_actualizado" });
          res.json({ ok: true });
        });
      }
    );
  });

  app.get("/cortesias", (req, res) => {
    bdVentas.all(
      "SELECT * FROM cortesias ORDER BY fecha_cortesia DESC",
      (err, cortesias) => res.json(cortesias || [])
    );
  });

  app.post("/cortesias/limpiar-pruebas", async (req, res) => {
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setUTCDate(manana.getUTCDate() + 1);

    try {
      const cortesia = await dbGet(
        bdVentas,
        "SELECT * FROM cortesias WHERE fecha_cortesia >= ? AND fecha_cortesia < ? ORDER BY fecha_cortesia DESC LIMIT 1",
        [hoy.toISOString(), manana.toISOString()]
      );

      if (!cortesia) return res.status(404).json({ error: "No hay cortesia de hoy" });

      await dbRun(bdVentas, "BEGIN");
      await dbRun(bdVentas, "DELETE FROM ventas");
      await dbRun(bdVentas, "DELETE FROM cortesias WHERE id <> ?", [cortesia.id]);
      await dbRun(bdVentas, "COMMIT");

      transmitir({ tipo: "ventas_actualizado" });
      transmitir({ tipo: "cortesias_actualizado" });
      return res.json({ ok: true, cortesia_id: Number(cortesia.id || 0) });
    } catch {
      try {
        await dbRun(bdVentas, "ROLLBACK");
      } catch {
        // Ignorar rollback fallido.
      }
      return res.status(500).json({ error: "Error limpiando registros" });
    }
  });

  app.delete("/cortesias/:id", (req, res) => {
    bdVentas.run("DELETE FROM cortesias WHERE id=?", [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: "Error al eliminar" });
      transmitir({ tipo: "cortesias_actualizado" });
      res.json({ ok: true });
    });
  });
}
