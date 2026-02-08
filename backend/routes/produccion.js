import { transmitir } from "../utils/transmitir.js";
import { convertirCantidad } from "../utils/convertir-cantidad.js";

export function registrarRutasProduccion(app, bdProduccion, bdRecetas, bdInventario) {
  app.post("/produccion", (req, res) => {
    const { nombre_receta, cantidad, costo_produccion, precio_venta, id_receta } = req.body;
    const cantidadProduccion = Number(cantidad) || 0;
    const fechaNow = new Date().toISOString();

    bdProduccion.run(
      `INSERT INTO produccion (nombre_receta, cantidad, fecha_produccion, costo_produccion, precio_venta)
       VALUES (?,?,?,?,?)`,
      [nombre_receta, cantidadProduccion, fechaNow, costo_produccion, precio_venta],
      (err) => {
        if (err) return res.status(500).json({ error: "Error en produccion" });

        const idReceta = Number.isFinite(Number(id_receta)) ? Number(id_receta) : null;
        const consulta = idReceta ? "SELECT id FROM recetas WHERE id=?" : "SELECT id FROM recetas WHERE nombre=?";
        const params = idReceta ? [idReceta] : [nombre_receta];

        bdRecetas.get(consulta, params, (e, receta) => {
          if (!receta) {
            transmitir({ tipo: "produccion_actualizado" });
            return res.json({ ok: true });
          }

          bdRecetas.all("SELECT * FROM ingredientes_receta WHERE id_receta=?", [receta.id], (errIng, ingredientes) => {
            if (!ingredientes || ingredientes.length === 0) {
              transmitir({ tipo: "produccion_actualizado" });
              return res.json({ ok: true });
            }

            const descuentos = [];
            let idx = 0;

            const procesar = () => {
              if (idx >= ingredientes.length) {
                transmitir({ tipo: "inventario_actualizado" });
                transmitir({ tipo: "produccion_actualizado" });
                if (descuentos.length > 0) {
                  transmitir({ tipo: "produccion_descuento", receta: nombre_receta, cantidad: cantidadProduccion, descuentos });
                }
                return res.json({ ok: true, descuentos });
              }

              const ing = ingredientes[idx];
              idx++;

              if (!ing.id_insumo) return procesar();

              bdInventario.get("SELECT * FROM inventario WHERE id=?", [ing.id_insumo], (errInv, insumo) => {
                if (!insumo) return procesar();

                const requerido = convertirCantidad((Number(ing.cantidad) || 0) * cantidadProduccion, ing.unidad, insumo.unidad);
                if (!Number.isFinite(requerido) || requerido <= 0) return procesar();

                const disponible = Number(insumo.cantidad_disponible) || 0;
                const cantidadDescontar = Math.min(requerido, disponible);
                if (cantidadDescontar <= 0) return procesar();

                bdInventario.run(
                  "UPDATE inventario SET cantidad_disponible = cantidad_disponible - ? WHERE id = ?",
                  [cantidadDescontar, ing.id_insumo],
                  (errUpd) => {
                    if (errUpd) return procesar();

                    const cambioCosto = -1 * (Number(insumo.costo_por_unidad) || 0) * cantidadDescontar;
                    bdInventario.run(
                      "INSERT INTO historial_inventario (id_inventario, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)",
                      [ing.id_insumo, fechaNow, -cantidadDescontar, cambioCosto],
                      () => {
                        descuentos.push({
                          insumo: insumo.nombre,
                          cantidad: cantidadDescontar,
                          unidad: insumo.unidad
                        });
                        procesar();
                      }
                    );
                  }
                );
              });
            };

            procesar();
          });
        });
      }
    );
  });

  app.get("/produccion", (req, res) => {
    bdProduccion.all(
      "SELECT * FROM produccion ORDER BY fecha_produccion DESC",
      (e, r) => res.json(r || [])
    );
  });

  app.delete("/produccion/:id", (req, res) => {
    const idProduccion = req.params.id;
    const fechaNow = new Date().toISOString();

    bdProduccion.get("SELECT * FROM produccion WHERE id=?", [idProduccion], (errProd, produccion) => {
      if (!produccion) {
        return res.json({ ok: true });
      }

      const nombreReceta = produccion.nombre_receta;
      const cantidadProduccion = Number(produccion.cantidad) || 0;

      const finalizar = () => {
        bdProduccion.run("DELETE FROM produccion WHERE id=?", [idProduccion], () => {
          transmitir({ tipo: "inventario_actualizado" });
          transmitir({ tipo: "produccion_actualizado" });
          res.json({ ok: true });
        });
      };

      bdRecetas.get("SELECT id FROM recetas WHERE nombre=?", [nombreReceta], (errRec, receta) => {
        if (!receta) return finalizar();

        bdRecetas.all("SELECT * FROM ingredientes_receta WHERE id_receta=?", [receta.id], (errIng, ingredientes) => {
          if (!ingredientes || ingredientes.length === 0) return finalizar();

          let idx = 0;
          const procesar = () => {
            if (idx >= ingredientes.length) return finalizar();

            const ing = ingredientes[idx];
            idx += 1;

            if (!ing.id_insumo) return procesar();

            bdInventario.get("SELECT * FROM inventario WHERE id=?", [ing.id_insumo], (errInv, insumo) => {
              if (!insumo) return procesar();

              const devolver = convertirCantidad((Number(ing.cantidad) || 0) * cantidadProduccion, ing.unidad, insumo.unidad);
              if (!Number.isFinite(devolver) || devolver <= 0) return procesar();

              const disponibleActual = Number(insumo.cantidad_disponible) || 0;
              const totalActual = Number(insumo.cantidad_total) || 0;
              const nuevaDisponible = totalActual > 0 ? Math.min(totalActual, disponibleActual + devolver) : (disponibleActual + devolver);

              bdInventario.run(
                "UPDATE inventario SET cantidad_disponible = ? WHERE id = ?",
                [nuevaDisponible, ing.id_insumo],
                () => {
                  // NO registrar en historial_inventario - solo devolvemos lo que ya existía
                  procesar();
                }
              );
            });
          };

          procesar();
        });
      });
    });
  });
}
