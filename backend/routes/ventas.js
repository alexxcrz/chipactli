import { transmitir } from "../utils/transmitir.js";

export function registrarRutasVentas(app, bdVentas, bdProduccion, bdInventario, bdRecetas) {
  app.post("/ventas", (req, res) => {
    const { nombre_receta, cantidad, fecha_produccion, costo_produccion, precio_venta, id_produccion, numero_pedido } = req.body;
    const ganancia = (precio_venta * cantidad) - costo_produccion;
    const fechaNow = new Date().toISOString();

    bdVentas.run(
      `INSERT INTO ventas (nombre_receta, cantidad, fecha_produccion, fecha_venta, costo_produccion, precio_venta, ganancia, numero_pedido)
       VALUES (?,?,?,?,?,?,?,?)`,
      [nombre_receta, cantidad, fecha_produccion, fechaNow, costo_produccion, precio_venta, ganancia, numero_pedido || ""],
      (err) => {
        if (err) return res.status(500).json({ error: "Error venta" });

        const finalizar = () => {
          bdInventario.run(
            "INSERT INTO inversion_recuperada (fecha_venta, costo_recuperado) VALUES (?,?)",
            [fechaNow, costo_produccion],
            () => {
              bdInventario.get(
                "SELECT COALESCE(SUM(costo_total),0) as inversion_total FROM inventario",
                (errInv, inv) => {
                  bdInventario.get(
                    "SELECT COALESCE(SUM(costo_recuperado),0) as inversion_recuperada FROM inversion_recuperada",
                    (errRec, rec) => {
                      const inversionTotal = inv ? inv.inversion_total : 0;
                      const inversionRecuperada = rec ? rec.inversion_recuperada : 0;
                      if (inversionRecuperada >= inversionTotal && ganancia > 0) {
                        bdInventario.run(
                          "INSERT INTO recuperado_utensilios (fecha_recuperado, monto_recuperado) VALUES (?,?)",
                          [fechaNow, ganancia],
                          () => {
                            transmitir({ tipo: "utensilios_actualizado" });
                            transmitir({ tipo: "ventas_actualizado" });
                            res.json({ ok: true });
                          }
                        );
                      } else {
                        transmitir({ tipo: "ventas_actualizado" });
                        res.json({ ok: true });
                      }
                    }
                  );
                }
              );
            }
          );
        };

        if (id_produccion) {
          bdProduccion.run("DELETE FROM produccion WHERE id=?", [id_produccion], () => {
            transmitir({ tipo: "produccion_actualizado" });
            finalizar();
          });
        } else {
          finalizar();
        }
      }
    );
  });

  app.get("/ventas", (req, res) => {
    const idCategoria = req.query.categoria || "";

    bdVentas.all("SELECT * FROM ventas ORDER BY fecha_venta DESC", (err, ventas) => {
      if (!ventas || ventas.length === 0) return res.json([]);

      let procesados = 0;
      ventas.forEach(venta => {
        bdRecetas.get(
          `SELECT r.id_categoria, c.nombre as categoria
           FROM recetas r
           LEFT JOIN categorias c ON r.id_categoria = c.id
           WHERE r.nombre = ?`,
          [venta.nombre_receta],
          (err2, receta) => {
            if (receta) {
              venta.id_categoria = receta.id_categoria;
              venta.categoria = receta.categoria;
            }
            procesados++;
            if (procesados === ventas.length) {
              if (idCategoria) {
                const filtradas = ventas.filter(v => v.id_categoria == idCategoria);
                res.json(filtradas);
              } else {
                res.json(ventas);
              }
            }
          }
        );
      });
    });
  });

  app.get("/ventas/estadisticas/:periodo", (req, res) => {
    const periodo = req.params.periodo;
    const idCategoria = req.query.categoria || "";

    let filtroFecha = "";
    if (periodo === "dia" || periodo === "hoy") {
      const hoy = new Date().toISOString().split("T")[0];
      filtroFecha = `WHERE DATE(fecha_venta) = '${hoy}'`;
    } else if (periodo === "semana") {
      filtroFecha = "WHERE DATE(fecha_venta) >= DATE('now', '-7 days')";
    } else if (periodo === "quincena") {
      filtroFecha = "WHERE DATE(fecha_venta) >= DATE('now', '-15 days')";
    } else if (periodo === "mes") {
      filtroFecha = "WHERE DATE(fecha_venta) >= DATE('now', '-30 days')";
    }

    bdVentas.all(`SELECT * FROM ventas ${filtroFecha}`, (err, ventas) => {
      if (!ventas || ventas.length === 0) {
        return res.json({ total_sales: 0, total_units: 0, total_cost: 0, total_revenue: 0, total_profit: 0 });
      }

      const calcular = (lista) => {
        const stats = {
          total_sales: lista.length,
          total_units: lista.reduce((sum, v) => sum + (v.cantidad || 0), 0),
          total_cost: lista.reduce((sum, v) => sum + (v.costo_produccion || 0), 0),
          total_revenue: lista.reduce((sum, v) => sum + ((v.precio_venta || 0) * (v.cantidad || 0)), 0),
          total_profit: lista.reduce((sum, v) => sum + (v.ganancia || 0), 0)
        };
        res.json(stats);
      };

      if (idCategoria) {
        let procesados = 0;
        const filtradas = [];
        ventas.forEach(venta => {
          bdRecetas.get("SELECT id_categoria FROM recetas WHERE nombre = ?", [venta.nombre_receta], (err2, receta) => {
            if (receta && receta.id_categoria == idCategoria) filtradas.push(venta);
            procesados++;
            if (procesados === ventas.length) calcular(filtradas);
          });
        });
      } else {
        calcular(ventas);
      }
    });
  });

  app.delete("/ventas/:id", (req, res) => {
    const id = req.params.id;
    const { motivo } = req.body || {};

    bdVentas.get("SELECT * FROM ventas WHERE id=?", [id], (err, venta) => {
      if (!venta) {
        return res.status(404).json({ error: "Venta no encontrada" });
      }

      const costo = venta.costo_produccion || 0;

      // Primero obtener el costo_recuperado actual
      bdInventario.get(
        "SELECT COALESCE(SUM(costo_recuperado),0) as total FROM inversion_recuperada",
        (errRec, rec) => {
          const totalActual = rec ? rec.total : 0;
          const nuevoTotal = Math.max(0, totalActual - costo);

          // Actualizar el total de inversion_recuperada restando este costo
          bdInventario.run(
            "UPDATE inversion_recuperada SET costo_recuperado = ? WHERE id = (SELECT MAX(id) FROM inversion_recuperada)",
            [nuevoTotal],
            () => {
              // Eliminar la venta
              bdVentas.run("DELETE FROM ventas WHERE id=?", [id], () => {
                transmitir({ tipo: "ventas_actualizado" });
                res.json({ ok: true });
              });
            }
          );
        }
      );
    });
  });
}
