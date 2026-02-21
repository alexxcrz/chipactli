import { transmitir } from "../utils/transmitir.js";

export function registrarRutasInventario(app, bdInventario) {
  app.get("/inventario", (req, res) => {
    const termino = (req.query.busqueda || "").trim();
    const select = "id, codigo, nombre, unidad, cantidad_total, cantidad_disponible, costo_total, costo_por_unidad, pendiente";
    if (termino) {
      const like = `%${termino}%`;
      bdInventario.all(
        `SELECT ${select} FROM inventario WHERE nombre LIKE ? OR codigo LIKE ? ORDER BY nombre`,
        [like, like],
        (e, r) => res.json(r || [])
      );
    } else {
      bdInventario.all(
        `SELECT ${select} FROM inventario ORDER BY nombre`,
        (e, r) => res.json(r || [])
      );
    }
  });

  app.get("/inventario/estadisticas", (req, res) => {
    bdInventario.get(
      "SELECT COUNT(*) as total_insumos, COALESCE(SUM(costo_total),0) as inversion_total FROM inventario",
      (err, inv) => {
        bdInventario.get(
          "SELECT COALESCE(SUM(costo_recuperado),0) as inversion_recuperada FROM inversion_recuperada",
          (err2, rec) => {
            const inversionTotal = inv ? inv.inversion_total : 0;
            const inversionRecuperada = rec ? rec.inversion_recuperada : 0;
            const inversionNeta = inversionTotal - inversionRecuperada;
            res.json({
              total_insumos: inv ? inv.total_insumos : 0,
              inversion_total: inversionTotal,
              inversion_recuperada: inversionRecuperada,
              inversion_neta: inversionNeta
            });
          }
        );
      }
    );
  });

  app.post("/inventario/agregar", (req, res) => {
    // Permitir crear insumo pendiente con solo nombre (desde receta)
    const { codigo, nombre, unidad, cantidad, costo, pendiente } = req.body;
    if (pendiente === true || pendiente === 1) {
      // Crear insumo pendiente: solo nombre, los demás campos por default
      if (!nombre) return res.status(400).json({ error: "Falta el nombre" });
      const codigoPendiente = codigo || ("PEND-" + Date.now());
      bdInventario.run(
        `INSERT INTO inventario (codigo, nombre, unidad, cantidad_total, cantidad_disponible, costo_total, costo_por_unidad, pendiente)
         VALUES (?,?,?,?,?,?,?,1)` ,
        [codigoPendiente, nombre, unidad || '', 0, 0, 0, 0],
        function () {
          transmitir({ tipo: "inventario_actualizado" });
          res.json({ ok: true, id: this.lastID });
        }
      );
      return;
    }
    // ...comportamiento normal...
    if (!codigo || !nombre || !unidad || !Number.isFinite(cantidad) || !Number.isFinite(costo)) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    bdInventario.get("SELECT * FROM inventario WHERE codigo=?", [codigo], (e, insumo) => {
      if (!insumo) {
        const costoPorUnidad = cantidad > 0 ? costo / cantidad : 0;
        bdInventario.run(
          `INSERT INTO inventario (codigo, nombre, unidad, cantidad_total, cantidad_disponible, costo_total, costo_por_unidad, pendiente)
           VALUES (?,?,?,?,?,?,?,0)`,
          [codigo, nombre, unidad, cantidad, cantidad, costo, costoPorUnidad],
          function () {
            const idInv = this.lastID;
            bdInventario.run(
              "INSERT INTO historial_inventario (id_inventario, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)",
              [idInv, new Date().toISOString(), cantidad, costo],
              () => {
                transmitir({ tipo: "inventario_actualizado" });
                res.json({ ok: true });
              }
            );
          }
        );
      } else {
        const nuevaCantidadTotal = (insumo.cantidad_total || 0) + cantidad;
        const nuevaCantidadDisponible = (insumo.cantidad_disponible || 0) + cantidad;
        const nuevoCostoTotal = (insumo.costo_total || 0) + costo;
        const costoPorUnidad = nuevaCantidadTotal > 0 ? nuevoCostoTotal / nuevaCantidadTotal : 0;

        bdInventario.run(
          "UPDATE inventario SET nombre=?, unidad=?, cantidad_total=?, cantidad_disponible=?, costo_total=?, costo_por_unidad=? WHERE id=?",
          [nombre, unidad, nuevaCantidadTotal, nuevaCantidadDisponible, nuevoCostoTotal, costoPorUnidad, insumo.id],
          () => {
            bdInventario.run(
              "INSERT INTO historial_inventario (id_inventario, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)",
              [insumo.id, new Date().toISOString(), cantidad, costo],
              () => {
                transmitir({ tipo: "inventario_actualizado" });
                res.json({ ok: true });
              }
            );
          }
        );
      }
    });
  });

  app.post("/inventario/aumentar", (req, res) => {
    const { id, cantidad, costo } = req.body;
    if (!id || !Number.isFinite(cantidad) || !Number.isFinite(costo) || cantidad <= 0 || costo < 0) {
      return res.status(400).json({ error: "Datos incompletos o inválidos" });
    }

    bdInventario.get("SELECT * FROM inventario WHERE id=?", [id], (e, insumo) => {
      if (!insumo) {
        return res.status(404).json({ error: "Insumo no encontrado" });
      }

      const nuevaCantidadTotal = (insumo.cantidad_total || 0) + cantidad;
      const nuevaCantidadDisponible = (insumo.cantidad_disponible || 0) + cantidad;
      const nuevoCostoTotal = (insumo.costo_total || 0) + costo;
      const costoPorUnidad = nuevaCantidadTotal > 0 ? nuevoCostoTotal / nuevaCantidadTotal : 0;

      bdInventario.run(
        "UPDATE inventario SET cantidad_total=?, cantidad_disponible=?, costo_total=?, costo_por_unidad=? WHERE id=?",
        [nuevaCantidadTotal, nuevaCantidadDisponible, nuevoCostoTotal, costoPorUnidad, id],
        () => {
          bdInventario.run(
            "INSERT INTO historial_inventario (id_inventario, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)",
            [id, new Date().toISOString(), cantidad, costo],
            () => {
              transmitir({ tipo: "inventario_actualizado" });
              res.json({ ok: true });
            }
          );
        }
      );
    });
  });

  app.get("/inventario/:id", (req, res) => {
    bdInventario.get("SELECT id, codigo, nombre, unidad, cantidad_total, cantidad_disponible, costo_total, costo_por_unidad, pendiente FROM inventario WHERE id=?", [req.params.id], (e, r) => {
      if (!r) return res.status(404).json({ error: "No encontrado" });
      res.json(r);
    });
  });

  app.patch("/inventario/:id", (req, res) => {
    const { nombre, unidad, cantidad_total, costo_total, codigo } = req.body;
    const id = req.params.id;

    bdInventario.get("SELECT * FROM inventario WHERE id=?", [id], (e, insumo) => {
      if (!insumo) return res.status(404).json({ error: "No encontrado" });

      const nuevaCantidadTotal = Number(cantidad_total) || 0;
      const nuevoCostoTotal = Number(costo_total) || 0;
      const deltaCantidad = nuevaCantidadTotal - (insumo.cantidad_total || 0);
      const deltaCosto = nuevoCostoTotal - (insumo.costo_total || 0);
      const nuevaDisponible = Math.max(0, (insumo.cantidad_disponible || 0) + deltaCantidad);
      const costoPorUnidad = nuevaCantidadTotal > 0 ? nuevoCostoTotal / nuevaCantidadTotal : 0;

      // Si es pendiente y se edita el código, quitar pendiente
      let updateQuery, updateParams;
      if (insumo.pendiente && codigo && codigo !== insumo.codigo) {
        updateQuery = "UPDATE inventario SET codigo=?, nombre=?, unidad=?, cantidad_total=?, cantidad_disponible=?, costo_total=?, costo_por_unidad=?, pendiente=0 WHERE id=?";
        updateParams = [codigo, nombre, unidad, nuevaCantidadTotal, nuevaDisponible, nuevoCostoTotal, costoPorUnidad, id];
      } else {
        updateQuery = "UPDATE inventario SET nombre=?, unidad=?, cantidad_total=?, cantidad_disponible=?, costo_total=?, costo_por_unidad=? WHERE id=?";
        updateParams = [nombre, unidad, nuevaCantidadTotal, nuevaDisponible, nuevoCostoTotal, costoPorUnidad, id];
      }

      bdInventario.run(
        updateQuery,
        updateParams,
        () => {
          if (deltaCantidad !== 0 || deltaCosto !== 0) {
            bdInventario.run(
              "INSERT INTO historial_inventario (id_inventario, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)",
              [id, new Date().toISOString(), deltaCantidad, deltaCosto],
              () => {
                transmitir({ tipo: "inventario_actualizado" });
                res.json({ ok: true });
              }
            );
          } else {
            transmitir({ tipo: "inventario_actualizado" });
            res.json({ ok: true });
          }
        }
      );
    });
  });

  app.delete("/inventario/:id", (req, res) => {
    const id = req.params.id;
    bdInventario.run("DELETE FROM inventario WHERE id=?", [id], () => {
      bdInventario.run("DELETE FROM historial_inventario WHERE id_inventario=?", [id], () => {
        transmitir({ tipo: "inventario_actualizado" });
        res.json({ ok: true });
      });
    });
  });

  app.get("/inventario/:id/historial", (req, res) => {
    bdInventario.all(
      "SELECT * FROM historial_inventario WHERE id_inventario=? ORDER BY fecha_cambio DESC",
      [req.params.id],
      (e, r) => res.json(r || [])
    );
  });

  app.get("/inventario/historial/agrupar/fechas", (req, res) => {
    bdInventario.all(
      "SELECT DATE(hi.fecha_cambio) as fecha, COUNT(*) as total_insumos, COALESCE(SUM(hi.cambio_costo),0) as total_costo FROM historial_inventario hi WHERE hi.cambio_costo > 0 GROUP BY DATE(hi.fecha_cambio) ORDER BY fecha DESC",
      (err, filas) => {
        if (!filas || filas.length === 0) return res.json([]);

        const respuesta = [];
        let procesados = 0;

        filas.forEach(fila => {
          bdInventario.all(
            `SELECT TIME(hi.fecha_cambio) as hora, inv.codigo, inv.nombre, inv.unidad, hi.cambio_cantidad, hi.cambio_costo
             FROM historial_inventario hi
             LEFT JOIN inventario inv ON hi.id_inventario = inv.id
             WHERE DATE(hi.fecha_cambio) = ? AND hi.cambio_costo > 0
             ORDER BY hi.fecha_cambio DESC`,
            [fila.fecha],
            (err2, insumos) => {
              respuesta.push({
                fecha: fila.fecha,
                total_insumos: fila.total_insumos || 0,
                total_costo: fila.total_costo || 0,
                insumos: insumos || []
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

  app.delete("/inventario/historial/fecha/:fecha", (req, res) => {
    const fecha = req.params.fecha;
    
    // Primero obtenemos los registros que se van a eliminar para actualizar el inventario
    bdInventario.all(
      `SELECT hi.id_inventario, hi.cambio_cantidad, hi.cambio_costo
       FROM historial_inventario hi
       WHERE DATE(hi.fecha_cambio) = ? AND hi.cambio_costo > 0`,
      [fecha],
      (err, registros) => {
        if (!registros || registros.length === 0) {
          return res.json({ ok: true });
        }

        // Procesar cada insumo afectado para actualizar sus totales
        let procesados = 0;
        registros.forEach(registro => {
          bdInventario.get(
            "SELECT * FROM inventario WHERE id=?",
            [registro.id_inventario],
            (errInv, insumo) => {
              if (insumo) {
                // Restar la cantidad y costo que se habían agregado
                const nuevaCantidadTotal = Math.max(0, (insumo.cantidad_total || 0) - registro.cambio_cantidad);
                const nuevaCantidadDisponible = Math.max(0, (insumo.cantidad_disponible || 0) - registro.cambio_cantidad);
                const nuevoCostoTotal = Math.max(0, (insumo.costo_total || 0) - registro.cambio_costo);
                const nuevoCostoPorUnidad = nuevaCantidadTotal > 0 ? nuevoCostoTotal / nuevaCantidadTotal : 0;

                bdInventario.run(
                  "UPDATE inventario SET cantidad_total=?, cantidad_disponible=?, costo_total=?, costo_por_unidad=? WHERE id=?",
                  [nuevaCantidadTotal, nuevaCantidadDisponible, nuevoCostoTotal, nuevoCostoPorUnidad, registro.id_inventario],
                  () => {
                    procesados++;
                    if (procesados === registros.length) {
                      // Ahora eliminar los registros del historial
                      bdInventario.run(
                        "DELETE FROM historial_inventario WHERE DATE(fecha_cambio) = ? AND cambio_costo > 0",
                        [fecha],
                        () => {
                          transmitir({ tipo: "inventario_actualizado" });
                          res.json({ ok: true });
                        }
                      );
                    }
                  }
                );
              } else {
                procesados++;
                if (procesados === registros.length) {
                  bdInventario.run(
                    "DELETE FROM historial_inventario WHERE DATE(fecha_cambio) = ? AND cambio_costo > 0",
                    [fecha],
                    () => {
                      transmitir({ tipo: "inventario_actualizado" });
                      res.json({ ok: true });
                    }
                  );
                }
              }
            }
          );
        });
      }
    );
  });
}