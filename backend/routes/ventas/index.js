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

export function registrarRutasVentas(app, bdVentas, bdProduccion, bdInventario, bdRecetas) {
  const PREFIJO_VENTA = 'CHV';
  const LONGITUD_CONSECUTIVO_VENTA = 7;

  const generarNumeroVenta = (callback) => {
    bdVentas.get(
      `SELECT numero_pedido
       FROM ventas
       WHERE numero_pedido LIKE ?
       ORDER BY numero_pedido DESC
       LIMIT 1`,
      [`${PREFIJO_VENTA}%`],
      (err, row) => {
        if (err) {
          callback(`${PREFIJO_VENTA}${String(1).padStart(LONGITUD_CONSECUTIVO_VENTA, '0')}`);
          return;
        }
        const actual = String(row?.numero_pedido || '').trim();
        const match = actual.match(/^CHV(\d+)$/);
        const consecutivo = match ? (Number(match[1]) || 0) + 1 : 1;
        callback(`${PREFIJO_VENTA}${String(consecutivo).padStart(LONGITUD_CONSECUTIVO_VENTA, '0')}`);
      }
    );
  };

  app.post("/ventas", async (req, res) => {
    try {
      const body = req.body || {};
      const idProduccion = Number(body.id_produccion || 0);
      const nombreRecetaBody = String(body.nombre_receta || '').trim();
      const cantidadBody = Number(body.cantidad || 0);
      const fechaNow = new Date().toISOString();

      let nombreReceta = nombreRecetaBody;
      let cantidad = cantidadBody;
      let fechaProduccion = String(body.fecha_produccion || '').trim() || fechaNow;
      let costoProduccion = Number(body.costo_produccion || 0);
      let precioVenta = Number(body.precio_venta || 0);

      if (idProduccion > 0) {
        const lote = await dbGet(bdProduccion, "SELECT * FROM produccion WHERE id=?", [idProduccion]);
        if (!lote) return res.status(404).json({ error: "Lote de producción no encontrado" });

        const cantidadLote = Number(lote?.cantidad || 0);
        if (cantidadLote <= 0) return res.status(400).json({ error: "El lote ya no tiene piezas disponibles" });

        const cantidadSolicitada = Number.isFinite(cantidadBody) && cantidadBody > 0 ? cantidadBody : cantidadLote;
        if (cantidadSolicitada > cantidadLote) {
          return res.status(400).json({ error: "La cantidad a vender supera las piezas del lote" });
        }

        nombreReceta = String(lote?.nombre_receta || nombreRecetaBody).trim();
        cantidad = cantidadSolicitada;
        fechaProduccion = String(lote?.fecha_produccion || fechaProduccion || fechaNow).trim();
        precioVenta = Number(body.precio_venta || lote?.precio_venta || 0);

        const costoLote = Number(lote?.costo_produccion || 0);
        costoProduccion = cantidadLote > 0
          ? (costoLote * (cantidad / cantidadLote))
          : Number(body.costo_produccion || 0);

        const restante = cantidadLote - cantidad;
        if (restante <= 1e-9) {
          await dbRun(bdProduccion, "DELETE FROM produccion WHERE id=?", [idProduccion]);
        } else {
          const costoRestante = costoLote - costoProduccion;
          await dbRun(
            bdProduccion,
            "UPDATE produccion SET cantidad=?, costo_produccion=? WHERE id=?",
            [restante, Math.max(0, costoRestante), idProduccion]
          );
        }
        transmitir({ tipo: "produccion_actualizado" });
      }

      if (!nombreReceta || cantidad <= 0) {
        return res.status(400).json({ error: "Datos de venta incompletos" });
      }

      const numeroPedidoBody = String(body.numero_pedido || '').trim();
      const numeroPedido = await new Promise((resolve) => {
        if (numeroPedidoBody) return resolve(numeroPedidoBody);
        generarNumeroVenta((num) => resolve(num));
      });

      const ganancia = (precioVenta * cantidad) - costoProduccion;

      await dbRun(
        bdVentas,
        `INSERT INTO ventas (nombre_receta, cantidad, fecha_produccion, fecha_venta, costo_produccion, precio_venta, ganancia, numero_pedido)
         VALUES (?,?,?,?,?,?,?,?)`,
        [nombreReceta, cantidad, fechaProduccion, fechaNow, costoProduccion, precioVenta, ganancia, numeroPedido]
      );

      await dbRun(
        bdInventario,
        "INSERT INTO inversion_recuperada (fecha_venta, costo_recuperado) VALUES (?,?)",
        [fechaNow, costoProduccion]
      );

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
    } catch {
      return res.status(500).json({ error: "Error venta" });
    }
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
    const paramsFecha = [];
    const ahora = new Date();

    const inicioDelDia = (fecha) => {
      const d = new Date(fecha);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    };

    if (periodo === "dia" || periodo === "hoy") {
      const desde = inicioDelDia(ahora);
      const hasta = new Date(desde);
      hasta.setUTCDate(hasta.getUTCDate() + 1);
      filtroFecha = "WHERE fecha_venta >= ? AND fecha_venta < ?";
      paramsFecha.push(desde.toISOString(), hasta.toISOString());
    } else if (periodo === "semana") {
      const desde = new Date(ahora);
      desde.setUTCDate(desde.getUTCDate() - 7);
      filtroFecha = "WHERE fecha_venta >= ?";
      paramsFecha.push(desde.toISOString());
    } else if (periodo === "quincena") {
      const desde = new Date(ahora);
      desde.setUTCDate(desde.getUTCDate() - 15);
      filtroFecha = "WHERE fecha_venta >= ?";
      paramsFecha.push(desde.toISOString());
    } else if (periodo === "mes") {
      const desde = new Date(ahora);
      desde.setUTCDate(desde.getUTCDate() - 30);
      filtroFecha = "WHERE fecha_venta >= ?";
      paramsFecha.push(desde.toISOString());
    }

    bdVentas.all(`SELECT * FROM ventas ${filtroFecha}`, paramsFecha, (err, ventas) => {
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
