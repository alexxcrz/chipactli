import { transmitir } from "../utils/transmitir.js";

export function registrarRutasUtensilios(app, bdInventario) {
  app.get("/utensilios", (req, res) => {
    const termino = (req.query.busqueda || "").trim();
    if (termino) {
      const like = `%${termino}%`;
      bdInventario.all(
        "SELECT * FROM utensilios WHERE nombre LIKE ? OR codigo LIKE ? ORDER BY nombre",
        [like, like],
        (e, r) => res.json(r || [])
      );
    } else {
      bdInventario.all(
        "SELECT * FROM utensilios ORDER BY nombre",
        (e, r) => res.json(r || [])
      );
    }
  });

  app.get("/utensilios/estadisticas", (req, res) => {
    bdInventario.get(
      "SELECT COUNT(*) as total_utensilios, COALESCE(SUM(costo_total),0) as inversion_total FROM utensilios",
      (err, inv) => {
        bdInventario.get(
          "SELECT COALESCE(SUM(monto_recuperado),0) as inversion_recuperada FROM recuperado_utensilios",
          (err2, rec) => {
            const inversionTotal = inv ? inv.inversion_total : 0;
            const inversionRecuperada = rec ? rec.inversion_recuperada : 0;
            const inversionNeta = inversionTotal - inversionRecuperada;
            res.json({
              total_utensilios: inv ? inv.total_utensilios : 0,
              inversion_total: inversionTotal,
              inversion_recuperada: inversionRecuperada,
              inversion_neta: inversionNeta
            });
          }
        );
      }
    );
  });

  app.post("/utensilios/agregar", (req, res) => {
    const { codigo, nombre, unidad, cantidad, costo } = req.body;
    if (!codigo || !nombre || !unidad || !Number.isFinite(cantidad) || !Number.isFinite(costo)) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    bdInventario.get("SELECT * FROM utensilios WHERE codigo=?", [codigo], (e, utensilio) => {
      if (!utensilio) {
        const costoPorUnidad = cantidad > 0 ? costo / cantidad : 0;
        bdInventario.run(
          `INSERT INTO utensilios (codigo, nombre, unidad, cantidad_total, costo_total, costo_por_unidad)
           VALUES (?,?,?,?,?,?)`,
          [codigo, nombre, unidad, cantidad, costo, costoPorUnidad],
          function () {
            const idU = this.lastID;
            bdInventario.run(
              "INSERT INTO historial_utensilios (id_utensilio, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)",
              [idU, new Date().toISOString(), cantidad, costo],
              () => {
                transmitir({ tipo: "utensilios_actualizado" });
                res.json({ ok: true });
              }
            );
          }
        );
      } else {
        const nuevaCantidadTotal = (utensilio.cantidad_total || 0) + cantidad;
        const nuevoCostoTotal = (utensilio.costo_total || 0) + costo;
        const costoPorUnidad = nuevaCantidadTotal > 0 ? nuevoCostoTotal / nuevaCantidadTotal : 0;

        bdInventario.run(
          "UPDATE utensilios SET nombre=?, unidad=?, cantidad_total=?, costo_total=?, costo_por_unidad=? WHERE id=?",
          [nombre, unidad, nuevaCantidadTotal, nuevoCostoTotal, costoPorUnidad, utensilio.id],
          () => {
            bdInventario.run(
              "INSERT INTO historial_utensilios (id_utensilio, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)",
              [utensilio.id, new Date().toISOString(), cantidad, costo],
              () => {
                transmitir({ tipo: "utensilios_actualizado" });
                res.json({ ok: true });
              }
            );
          }
        );
      }
    });
  });

  app.post("/utensilios/recuperado", (req, res) => {
    const monto = Number(req.body.monto) || 0;
    if (!Number.isFinite(monto) || monto <= 0) {
      return res.status(400).json({ error: "Monto invalido" });
    }

    bdInventario.run(
      "INSERT INTO recuperado_utensilios (fecha_recuperado, monto_recuperado) VALUES (?,?)",
      [new Date().toISOString(), monto],
      () => {
        transmitir({ tipo: "utensilios_actualizado" });
        res.json({ ok: true });
      }
    );
  });

  app.get("/utensilios/:id", (req, res) => {
    bdInventario.get("SELECT * FROM utensilios WHERE id=?", [req.params.id], (e, r) => {
      if (!r) return res.status(404).json({ error: "No encontrado" });
      res.json(r);
    });
  });

  app.patch("/utensilios/:id", (req, res) => {
    const { nombre, unidad, cantidad_total, costo_total } = req.body;
    const id = req.params.id;

    bdInventario.get("SELECT * FROM utensilios WHERE id=?", [id], (e, utensilio) => {
      if (!utensilio) return res.status(404).json({ error: "No encontrado" });

      const nuevaCantidadTotal = Number(cantidad_total) || 0;
      const nuevoCostoTotal = Number(costo_total) || 0;
      const deltaCantidad = nuevaCantidadTotal - (utensilio.cantidad_total || 0);
      const deltaCosto = nuevoCostoTotal - (utensilio.costo_total || 0);
      const costoPorUnidad = nuevaCantidadTotal > 0 ? nuevoCostoTotal / nuevaCantidadTotal : 0;

      bdInventario.run(
        "UPDATE utensilios SET nombre=?, unidad=?, cantidad_total=?, costo_total=?, costo_por_unidad=? WHERE id=?",
        [nombre, unidad, nuevaCantidadTotal, nuevoCostoTotal, costoPorUnidad, id],
        () => {
          if (deltaCantidad !== 0 || deltaCosto !== 0) {
            bdInventario.run(
              "INSERT INTO historial_utensilios (id_utensilio, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)",
              [id, new Date().toISOString(), deltaCantidad, deltaCosto],
              () => {
                transmitir({ tipo: "utensilios_actualizado" });
                res.json({ ok: true });
              }
            );
          } else {
            transmitir({ tipo: "utensilios_actualizado" });
            res.json({ ok: true });
          }
        }
      );
    });
  });

  app.delete("/utensilios/:id", (req, res) => {
    const id = req.params.id;
    bdInventario.run("DELETE FROM utensilios WHERE id=?", [id], () => {
      bdInventario.run("DELETE FROM historial_utensilios WHERE id_utensilio=?", [id], () => {
        transmitir({ tipo: "utensilios_actualizado" });
        res.json({ ok: true });
      });
    });
  });

  app.get("/utensilios/:id/historial", (req, res) => {
    bdInventario.all(
      "SELECT * FROM historial_utensilios WHERE id_utensilio=? ORDER BY fecha_cambio DESC",
      [req.params.id],
      (e, r) => res.json(r || [])
    );
  });

  app.get("/utensilios/historial/agrupar/fechas", (req, res) => {
    bdInventario.all(
      "SELECT DATE(hu.fecha_cambio) as fecha, COUNT(*) as total_utensilios, COALESCE(SUM(hu.cambio_costo),0) as total_costo FROM historial_utensilios hu WHERE hu.cambio_costo > 0 GROUP BY DATE(hu.fecha_cambio) ORDER BY fecha DESC",
      (err, filas) => {
        if (!filas || filas.length === 0) return res.json([]);

        const respuesta = [];
        let procesados = 0;

        filas.forEach(fila => {
          bdInventario.all(
            `SELECT TIME(hu.fecha_cambio) as hora, u.codigo, u.nombre, u.unidad, hu.cambio_cantidad, hu.cambio_costo
             FROM historial_utensilios hu
             LEFT JOIN utensilios u ON hu.id_utensilio = u.id
             WHERE DATE(hu.fecha_cambio) = ? AND hu.cambio_costo > 0
             ORDER BY hu.fecha_cambio DESC`,
            [fila.fecha],
            (err2, utensilios) => {
              respuesta.push({
                fecha: fila.fecha,
                total_utensilios: fila.total_utensilios || 0,
                total_costo: fila.total_costo || 0,
                utensilios: utensilios || []
              });
              procesados++;
              if (procesados === filas.length) {
                respuesta.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
                res.json(respuesta);
              }
            }
          );
        });
      }
    );
  });
}
