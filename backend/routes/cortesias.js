import { transmitir } from "../utils/transmitir.js";

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

  app.post("/cortesias/limpiar-pruebas", (req, res) => {
    const hoy = new Date().toISOString().split("T")[0];

    bdVentas.get(
      "SELECT * FROM cortesias WHERE DATE(fecha_cortesia) = ? ORDER BY fecha_cortesia DESC LIMIT 1",
      [hoy],
      (err, cortesia) => {
        if (err) return res.status(500).json({ error: "Error consultando cortesias" });
        if (!cortesia) return res.status(404).json({ error: "No hay cortesia de hoy" });

        bdVentas.serialize(() => {
          bdVentas.run("BEGIN TRANSACTION");
          bdVentas.run("DELETE FROM ventas");
          bdVentas.run("DELETE FROM cortesias WHERE id <> ?", [cortesia.id]);
          bdVentas.run("UPDATE cortesias SET id = 1 WHERE id = ?", [cortesia.id]);
          bdVentas.run("DELETE FROM sqlite_sequence WHERE name IN ('ventas','cortesias')");
          bdVentas.run("COMMIT", (errCommit) => {
            if (errCommit) {
              bdVentas.run("ROLLBACK");
              return res.status(500).json({ error: "Error limpiando registros" });
            }
            transmitir({ tipo: "ventas_actualizado" });
            transmitir({ tipo: "cortesias_actualizado" });
            res.json({ ok: true, cortesia_id: 1 });
          });
        });
      }
    );
  });

  app.delete("/cortesias/:id", (req, res) => {
    bdVentas.run("DELETE FROM cortesias WHERE id=?", [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: "Error al eliminar" });
      transmitir({ tipo: "cortesias_actualizado" });
      res.json({ ok: true });
    });
  });
}
