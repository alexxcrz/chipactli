import { transmitir, convertirCantidad } from "../../utils/index.js";

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
  });
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function registrarRutasProduccion(app, bdProduccion, bdRecetas, bdInventario, bdVentas = null) {
  app.post("/produccion", async (req, res) => {
    const { nombre_receta, cantidad, costo_produccion, precio_venta, id_receta } = req.body || {};
    const cantidadProduccion = Number(cantidad) || 0;
    const fechaNow = new Date().toISOString();
    const nombreReceta = String(nombre_receta || "").trim();

    if (!nombreReceta || cantidadProduccion <= 0) {
      return res.status(400).json({ error: "Nombre de receta y cantidad son obligatorios" });
    }

    try {
      const idReceta = Number.isFinite(Number(id_receta)) ? Number(id_receta) : null;
      const receta = await dbGet(
        bdRecetas,
        idReceta ? "SELECT id FROM recetas WHERE id=?" : "SELECT id FROM recetas WHERE nombre=?",
        idReceta ? [idReceta] : [nombreReceta]
      );

      const planDescuentos = [];
      if (receta?.id) {
        const ingredientes = await dbAll(
          bdRecetas,
          "SELECT id_insumo, cantidad, unidad FROM ingredientes_receta WHERE id_receta=?",
          [receta.id]
        );

        for (const ing of ingredientes || []) {
          const idInsumo = Number(ing?.id_insumo);
          if (!Number.isFinite(idInsumo) || idInsumo <= 0) continue;

          const insumo = await dbGet(bdInventario, "SELECT * FROM inventario WHERE id=?", [idInsumo]);
          if (!insumo) continue;

          const requerido = convertirCantidad((Number(ing?.cantidad) || 0) * cantidadProduccion, ing?.unidad, insumo?.unidad);
          if (!Number.isFinite(requerido) || requerido <= 0) continue;

          const disponible = Number(insumo?.cantidad_disponible) || 0;
          const faltante = requerido > disponible ? (requerido - disponible) : 0;

          planDescuentos.push({
            id_insumo: idInsumo,
            nombre_insumo: String(insumo?.nombre || "").trim() || `Insumo #${idInsumo}`,
            unidad_insumo: String(insumo?.unidad || "").trim(),
            costo_por_unidad: Number(insumo?.costo_por_unidad) || 0,
            requerido,
            disponible,
            faltante
          });
        }
      }

      const faltantes = planDescuentos.filter((item) => item.faltante > 0);
      if (faltantes.length) {
        return res.status(400).json({
          error: "Inventario insuficiente para registrar la producción",
          faltantes: faltantes.map((f) => ({
            id_insumo: f.id_insumo,
            nombre_insumo: f.nombre_insumo,
            faltante: f.faltante,
            unidad: f.unidad_insumo,
            disponible: f.disponible,
            requerido: f.requerido
          }))
        });
      }

      const insertProd = await dbRun(
        bdProduccion,
        `INSERT INTO produccion (nombre_receta, cantidad, fecha_produccion, costo_produccion, precio_venta)
         VALUES (?,?,?,?,?)`,
        [nombreReceta, cantidadProduccion, fechaNow, costo_produccion, precio_venta]
      );

      if (receta?.id) {
        const precioVentaNumero = Number(precio_venta) || 0;
        await dbRun(bdRecetas, "UPDATE recetas SET tienda_precio_publico=? WHERE id=?", [precioVentaNumero, receta.id]).catch(() => {});
      }

      const descuentosAplicados = [];
      for (const item of planDescuentos) {
        await dbRun(
          bdInventario,
          "UPDATE inventario SET cantidad_disponible = cantidad_disponible - ? WHERE id = ?",
          [item.requerido, item.id_insumo]
        );

        const cambioCosto = -1 * (Number(item.costo_por_unidad) || 0) * item.requerido;
        await dbRun(
          bdInventario,
          "INSERT INTO historial_inventario (id_inventario, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)",
          [item.id_insumo, fechaNow, -item.requerido, cambioCosto]
        );

        await dbRun(
          bdProduccion,
          `INSERT INTO produccion_descuentos
             (id_produccion, id_insumo, cantidad_descuento, unidad_insumo, costo_por_unidad, fecha_descuento)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [insertProd.lastID, item.id_insumo, item.requerido, item.unidad_insumo, item.costo_por_unidad, fechaNow]
        );

        descuentosAplicados.push({
          insumo: item.nombre_insumo,
          cantidad: item.requerido,
          unidad: item.unidad_insumo
        });
      }

      if (descuentosAplicados.length > 0) {
        transmitir({ tipo: "inventario_actualizado" });
      }
      transmitir({ tipo: "produccion_actualizado" });
      if (descuentosAplicados.length > 0) {
        transmitir({ tipo: "produccion_descuento", receta: nombreReceta, cantidad: cantidadProduccion, descuentos: descuentosAplicados });
      }

      return res.json({ ok: true, descuentos: descuentosAplicados });
    } catch {
      return res.status(500).json({ error: "Error en produccion" });
    }
  });

  app.post("/produccion/paquete", async (req, res) => {
    const idPaquete = Number(req.body?.id_paquete) || 0;
    const cantidadPaquetes = Math.max(1, Number(req.body?.cantidad_paquetes) || 1);
    const nombrePaquete = String(req.body?.nombre_paquete || "").trim();
    let items = Array.isArray(req.body?.items) ? req.body.items : [];

    try {
      if ((!items.length || !nombrePaquete) && bdVentas && idPaquete > 0) {
        const paqueteDb = await dbGet(bdVentas, "SELECT id, nombre FROM tienda_paquetes WHERE id=?", [idPaquete]);
        const nombreBase = String(paqueteDb?.nombre || nombrePaquete || "").trim();
        if (!nombrePaquete && nombreBase) {
          req.body.nombre_paquete = nombreBase;
        }
        const itemsDb = await dbAll(
          bdVentas,
          "SELECT receta_nombre, cantidad FROM tienda_paquetes_items WHERE id_paquete=?",
          [idPaquete]
        );
        if (itemsDb.length) items = itemsDb;
      }

      if (!items.length) {
        return res.status(400).json({ error: "El paquete no tiene recetas configuradas" });
      }

      const fechaNow = new Date().toISOString();
      const produccionesPlan = [];
      const requeridosMap = new Map();

      for (const item of items) {
        const recetaNombre = String(item?.receta_nombre || "").trim();
        const cantidadReceta = Math.max(1, Number(item?.cantidad) || 1);
        const cantidadTotalReceta = cantidadReceta * cantidadPaquetes;
        if (!recetaNombre) continue;

        const receta = await dbGet(bdRecetas, "SELECT id FROM recetas WHERE nombre=?", [recetaNombre]);
        if (!receta?.id) continue;

        const ingredientes = await dbAll(
          bdRecetas,
          "SELECT id_insumo, cantidad, unidad FROM ingredientes_receta WHERE id_receta=?",
          [receta.id]
        );

        const descuentosReceta = [];
        for (const ing of ingredientes || []) {
          const idInsumo = Number(ing?.id_insumo);
          if (!Number.isFinite(idInsumo) || idInsumo <= 0) continue;

          const insumo = await dbGet(bdInventario, "SELECT * FROM inventario WHERE id=?", [idInsumo]);
          if (!insumo) continue;

          const requerido = convertirCantidad((Number(ing?.cantidad) || 0) * cantidadTotalReceta, ing?.unidad, insumo?.unidad);
          if (!Number.isFinite(requerido) || requerido <= 0) continue;

          const existente = requeridosMap.get(idInsumo);
          if (existente) {
            existente.requerido += requerido;
          } else {
            requeridosMap.set(idInsumo, {
              id_insumo: idInsumo,
              nombre_insumo: String(insumo?.nombre || "").trim() || `Insumo #${idInsumo}`,
              unidad_insumo: String(insumo?.unidad || "").trim(),
              costo_por_unidad: Number(insumo?.costo_por_unidad) || 0,
              requerido,
              disponible: Number(insumo?.cantidad_disponible) || 0
            });
          }

          descuentosReceta.push({
            id_insumo: idInsumo,
            unidad_insumo: String(insumo?.unidad || "").trim(),
            costo_por_unidad: Number(insumo?.costo_por_unidad) || 0,
            requerido
          });
        }

        produccionesPlan.push({
          id_receta: receta.id,
          nombre_receta: recetaNombre,
          cantidad: cantidadTotalReceta,
          costo_produccion: Number(item?.costo_produccion) || 0,
          precio_venta: Number(item?.precio_venta) || 0,
          descuentos: descuentosReceta
        });
      }

      if (!produccionesPlan.length) {
        return res.status(400).json({ error: "No se encontraron recetas válidas para producir" });
      }

      const faltantes = [];
      for (const reqInsumo of requeridosMap.values()) {
        const faltante = reqInsumo.requerido > reqInsumo.disponible
          ? (reqInsumo.requerido - reqInsumo.disponible)
          : 0;
        if (faltante > 0) {
          faltantes.push({
            id_insumo: reqInsumo.id_insumo,
            nombre_insumo: reqInsumo.nombre_insumo,
            faltante,
            unidad: reqInsumo.unidad_insumo,
            disponible: reqInsumo.disponible,
            requerido: reqInsumo.requerido
          });
        }
      }

      if (faltantes.length) {
        return res.status(400).json({
          error: "Inventario insuficiente para registrar la producción del paquete",
          faltantes
        });
      }

      let totalPiezas = 0;
      for (const prod of produccionesPlan) {
        const insertProd = await dbRun(
          bdProduccion,
          `INSERT INTO produccion (nombre_receta, cantidad, fecha_produccion, costo_produccion, precio_venta)
           VALUES (?,?,?,?,?)`,
          [prod.nombre_receta, prod.cantidad, fechaNow, prod.costo_produccion, prod.precio_venta]
        );

        totalPiezas += Number(prod.cantidad) || 0;
        await dbRun(bdRecetas, "UPDATE recetas SET tienda_precio_publico=? WHERE id=?", [Number(prod.precio_venta) || 0, prod.id_receta]).catch(() => {});

        for (const item of prod.descuentos || []) {
          await dbRun(
            bdProduccion,
            `INSERT INTO produccion_descuentos
               (id_produccion, id_insumo, cantidad_descuento, unidad_insumo, costo_por_unidad, fecha_descuento)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [insertProd.lastID, item.id_insumo, item.requerido, item.unidad_insumo, item.costo_por_unidad, fechaNow]
          );
        }
      }

      for (const reqInsumo of requeridosMap.values()) {
        await dbRun(
          bdInventario,
          "UPDATE inventario SET cantidad_disponible = cantidad_disponible - ? WHERE id = ?",
          [reqInsumo.requerido, reqInsumo.id_insumo]
        );

        const cambioCosto = -1 * (Number(reqInsumo.costo_por_unidad) || 0) * reqInsumo.requerido;
        await dbRun(
          bdInventario,
          "INSERT INTO historial_inventario (id_inventario, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)",
          [reqInsumo.id_insumo, fechaNow, -reqInsumo.requerido, cambioCosto]
        );
      }

      transmitir({ tipo: "inventario_actualizado" });
      transmitir({ tipo: "produccion_actualizado" });
      transmitir({
        tipo: "produccion_descuento",
        paquete: String(req.body?.nombre_paquete || nombrePaquete || "").trim() || `Paquete #${idPaquete}`,
        cantidad_paquetes: cantidadPaquetes
      });

      return res.json({
        ok: true,
        total_producciones: produccionesPlan.length,
        total_piezas: totalPiezas
      });
    } catch {
      return res.status(500).json({ error: "Error en produccion de paquete" });
    }
  });

  app.get("/produccion", (req, res) => {
    bdProduccion.all(
      "SELECT * FROM produccion ORDER BY fecha_produccion DESC",
      (e, r) => res.json(r || [])
    );
  });

  app.delete("/produccion/:id", async (req, res) => {
    const idProduccion = req.params.id;
    const fechaNow = new Date().toISOString();

    try {
      const produccion = await dbGet(bdProduccion, "SELECT * FROM produccion WHERE id=?", [idProduccion]);
      if (!produccion) return res.json({ ok: true });

      const descuentosRegistrados = await dbAll(
        bdProduccion,
        `SELECT id_insumo, cantidad_descuento, unidad_insumo, costo_por_unidad
         FROM produccion_descuentos
         WHERE id_produccion = ?`,
        [idProduccion]
      );

      const devoluciones = [];

      if (descuentosRegistrados.length > 0) {
        for (const desc of descuentosRegistrados) {
          const idInsumo = Number(desc?.id_insumo);
          const cantidadDevolver = Number(desc?.cantidad_descuento) || 0;
          if (!Number.isFinite(idInsumo) || idInsumo <= 0 || cantidadDevolver <= 0) continue;

          const insumo = await dbGet(bdInventario, "SELECT * FROM inventario WHERE id=?", [idInsumo]);
          if (!insumo) continue;

          const disponibleActual = Number(insumo?.cantidad_disponible) || 0;
          const totalActual = Number(insumo?.cantidad_total) || 0;
          const nuevaDisponible = totalActual > 0
            ? Math.min(totalActual, disponibleActual + cantidadDevolver)
            : (disponibleActual + cantidadDevolver);

          await dbRun(
            bdInventario,
            "UPDATE inventario SET cantidad_disponible = ? WHERE id = ?",
            [nuevaDisponible, idInsumo]
          );

          const costoUnidad = Number(desc?.costo_por_unidad) || Number(insumo?.costo_por_unidad) || 0;
          const cambioCosto = costoUnidad * cantidadDevolver;
          await dbRun(
            bdInventario,
            "INSERT INTO historial_inventario (id_inventario, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)",
            [idInsumo, fechaNow, cantidadDevolver, cambioCosto]
          );

          devoluciones.push({
            insumo: String(insumo?.nombre || "").trim() || `Insumo #${idInsumo}`,
            cantidad: cantidadDevolver,
            unidad: String(desc?.unidad_insumo || insumo?.unidad || "").trim()
          });
        }
      } else {
        const nombreReceta = String(produccion?.nombre_receta || "").trim();
        const cantidadProduccion = Number(produccion?.cantidad) || 0;
        const receta = await dbGet(bdRecetas, "SELECT id FROM recetas WHERE nombre=?", [nombreReceta]);

        if (receta?.id) {
          const ingredientes = await dbAll(bdRecetas, "SELECT * FROM ingredientes_receta WHERE id_receta=?", [receta.id]);
          for (const ing of ingredientes || []) {
            const idInsumo = Number(ing?.id_insumo);
            if (!Number.isFinite(idInsumo) || idInsumo <= 0) continue;

            const insumo = await dbGet(bdInventario, "SELECT * FROM inventario WHERE id=?", [idInsumo]);
            if (!insumo) continue;

            const devolver = convertirCantidad((Number(ing?.cantidad) || 0) * cantidadProduccion, ing?.unidad, insumo?.unidad);
            if (!Number.isFinite(devolver) || devolver <= 0) continue;

            const disponibleActual = Number(insumo?.cantidad_disponible) || 0;
            const totalActual = Number(insumo?.cantidad_total) || 0;
            const nuevaDisponible = totalActual > 0
              ? Math.min(totalActual, disponibleActual + devolver)
              : (disponibleActual + devolver);

            await dbRun(
              bdInventario,
              "UPDATE inventario SET cantidad_disponible = ? WHERE id = ?",
              [nuevaDisponible, idInsumo]
            );

            const costoUnidad = Number(insumo?.costo_por_unidad) || 0;
            const cambioCosto = costoUnidad * devolver;
            await dbRun(
              bdInventario,
              "INSERT INTO historial_inventario (id_inventario, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)",
              [idInsumo, fechaNow, devolver, cambioCosto]
            );

            devoluciones.push({
              insumo: String(insumo?.nombre || "").trim() || `Insumo #${idInsumo}`,
              cantidad: devolver,
              unidad: String(insumo?.unidad || "").trim()
            });
          }
        }
      }

      await dbRun(bdProduccion, "DELETE FROM produccion_descuentos WHERE id_produccion=?", [idProduccion]);
      await dbRun(bdProduccion, "DELETE FROM produccion WHERE id=?", [idProduccion]);

      transmitir({ tipo: "inventario_actualizado" });
      transmitir({ tipo: "produccion_actualizado" });
      return res.json({ ok: true, devoluciones });
    } catch {
      return res.status(500).json({ error: "No se pudo eliminar la producción" });
    }
  });
}
