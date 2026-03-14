import { transmitir, convertirCantidadDetallada } from "../../utils/index.js";

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

function sumarMesesIso(fechaIso, meses = 10) {
  const base = new Date(String(fechaIso || '').trim() || Date.now());
  if (Number.isNaN(base.getTime())) return null;
  const out = new Date(base);
  out.setMonth(out.getMonth() + Number(meses || 0));
  return out.toISOString();
}

function claveReceta(nombre) {
  return String(nombre || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/["'\u201C\u201D\u2018\u2019]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function redondearPrecioVenta(valor) {
  const base = Number(valor) || 0;
  if (base <= 0) return 0;
  return Math.ceil(base / 5) * 5;
}

function convertirCantidadValidada(cantidad, unidadOrigen, unidadDestino) {
  const conversion = convertirCantidadDetallada(cantidad, unidadOrigen, unidadDestino);
  if (!conversion?.compatible) return null;
  const convertido = Number(conversion?.valor);
  if (!Number.isFinite(convertido) || convertido <= 0) return null;
  return convertido;
}

export function registrarRutasProduccion(app, bdProduccion, bdRecetas, bdInventario, bdVentas = null) {
  app.get("/produccion/historial/:id_receta", async (req, res) => {
    const idReceta = Number(req.params.id_receta || 0);
    if (!idReceta) return res.status(400).json({ error: "ID de receta inválido" });

    try {
      const receta = await dbGet(bdRecetas, "SELECT id, nombre FROM recetas WHERE id=?", [idReceta]);
      if (!receta) return res.status(404).json({ error: "Receta no encontrada" });

      const nombreReceta = String(receta?.nombre || "").trim();

      const produccion = await dbAll(
        bdProduccion,
        `SELECT id, nombre_receta, cantidad, fecha_produccion, costo_produccion, precio_venta
         FROM produccion
         WHERE LOWER(TRIM(COALESCE(nombre_receta, ''))) = LOWER(TRIM(?))
         ORDER BY COALESCE(fecha_produccion, '') DESC, id DESC`,
        [nombreReceta]
      );

      let ventasCortesias = [];
      if (bdVentas) {
        const ventas = await dbAll(
          bdVentas,
          `SELECT id, nombre_receta, cantidad, fecha_venta, numero_pedido, costo_produccion, precio_venta, ganancia
           FROM ventas
           WHERE LOWER(TRIM(COALESCE(nombre_receta, ''))) = LOWER(TRIM(?))
           ORDER BY COALESCE(fecha_venta, '') DESC, id DESC`,
          [nombreReceta]
        ).catch(() => []);

        const cortesias = await dbAll(
          bdVentas,
          `SELECT id, nombre_receta, cantidad, fecha_cortesia, numero_pedido, motivo, para_quien
           FROM cortesias
           WHERE LOWER(TRIM(COALESCE(nombre_receta, ''))) = LOWER(TRIM(?))
           ORDER BY COALESCE(fecha_cortesia, '') DESC, id DESC`,
          [nombreReceta]
        ).catch(() => []);

        const ventasNormalizadas = (ventas || []).map((v) => ({
          id: Number(v?.id || 0),
          nombre_receta: String(v?.nombre_receta || "").trim(),
          cantidad: Number(v?.cantidad || 0),
          fecha_venta: v?.fecha_venta || null,
          tipo_baja: "venta",
          usuario: null,
          numero_pedido: String(v?.numero_pedido || "").trim(),
          motivo: null,
          para_quien: null,
          costo_produccion: Number(v?.costo_produccion || 0),
          precio_venta: Number(v?.precio_venta || 0),
          ganancia: Number(v?.ganancia || 0)
        }));

        const cortesiasNormalizadas = (cortesias || []).map((c) => ({
          id: Number(c?.id || 0),
          nombre_receta: String(c?.nombre_receta || "").trim(),
          cantidad: Number(c?.cantidad || 0),
          fecha_venta: c?.fecha_cortesia || null,
          tipo_baja: "cortesia",
          usuario: null,
          numero_pedido: String(c?.numero_pedido || "").trim(),
          motivo: String(c?.motivo || "").trim() || null,
          para_quien: String(c?.para_quien || "").trim() || null,
          costo_produccion: 0,
          precio_venta: 0,
          ganancia: 0
        }));

        ventasCortesias = [...ventasNormalizadas, ...cortesiasNormalizadas]
          .sort((a, b) => String(b?.fecha_venta || "").localeCompare(String(a?.fecha_venta || "")) || (Number(b?.id || 0) - Number(a?.id || 0)));
      }

      res.json({
        receta: { id: Number(receta?.id || 0), nombre: nombreReceta },
        produccion,
        ventasCortesias
      });
    } catch {
      res.status(500).json({ error: "No se pudo obtener historial" });
    }
  });

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
      const incompatibilidades = [];
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

          const unidadReceta = String(ing?.unidad || '').trim();
          const unidadInsumo = String(insumo?.unidad || '').trim();
          const requerido = convertirCantidadValidada((Number(ing?.cantidad) || 0) * cantidadProduccion, unidadReceta, unidadInsumo);
          if (!Number.isFinite(requerido) || requerido <= 0) {
            incompatibilidades.push({
              id_insumo: idInsumo,
              nombre_insumo: String(insumo?.nombre || '').trim() || `Insumo #${idInsumo}`,
              unidad_receta: unidadReceta,
              unidad_inventario: unidadInsumo
            });
            continue;
          }

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

      if (incompatibilidades.length) {
        return res.status(400).json({
          error: "Unidades incompatibles entre receta e inventario",
          incompatibilidades
        });
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

      const precioVentaFinal = redondearPrecioVenta(precio_venta);

      const insertProd = await dbRun(
        bdProduccion,
        `INSERT INTO produccion (nombre_receta, cantidad, fecha_produccion, costo_produccion, precio_venta)
         VALUES (?,?,?,?,?)`,
        [nombreReceta, cantidadProduccion, fechaNow, costo_produccion, precioVentaFinal]
      );

      if (receta?.id) {
        const precioVentaNumero = Number(precioVentaFinal) || 0;
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
        transmitir({ tipo: "inventario_actualizado", accion: "descontado", nombre_receta: nombreReceta, cantidad: cantidadProduccion });
      }
      transmitir({ tipo: "produccion_actualizado", accion: "registrada", nombre_receta: nombreReceta, cantidad: cantidadProduccion });
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
      const incompatibilidades = [];

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

          const unidadReceta = String(ing?.unidad || '').trim();
          const unidadInsumo = String(insumo?.unidad || '').trim();
          const requerido = convertirCantidadValidada((Number(ing?.cantidad) || 0) * cantidadTotalReceta, unidadReceta, unidadInsumo);
          if (!Number.isFinite(requerido) || requerido <= 0) {
            incompatibilidades.push({
              receta: recetaNombre,
              id_insumo: idInsumo,
              nombre_insumo: String(insumo?.nombre || '').trim() || `Insumo #${idInsumo}`,
              unidad_receta: unidadReceta,
              unidad_inventario: unidadInsumo
            });
            continue;
          }

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

      if (incompatibilidades.length) {
        return res.status(400).json({
          error: "Unidades incompatibles entre receta e inventario",
          incompatibilidades
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

      transmitir({
        tipo: "inventario_actualizado",
        accion: "descontado",
        paquete: String(req.body?.nombre_paquete || nombrePaquete || "").trim() || `Paquete #${idPaquete}`,
        cantidad: cantidadPaquetes
      });
      transmitir({
        tipo: "produccion_actualizado",
        accion: "registrada",
        paquete: String(req.body?.nombre_paquete || nombrePaquete || "").trim() || `Paquete #${idPaquete}`,
        cantidad: totalPiezas
      });
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
    bdProduccion.all("SELECT * FROM produccion ORDER BY fecha_produccion DESC", (e, rows) => {
      const lista = (rows || []).map((item) => ({
        ...item,
        fecha_caducidad: sumarMesesIso(item?.fecha_produccion, 10)
      }));
      res.json(lista);
    });
  });

  app.get("/produccion/resumen-recetas", async (req, res) => {
    try {
      const recetas = await dbAll(
        bdRecetas,
        `SELECT r.id, r.nombre, r.gramaje, r.tienda_precio_publico,
                COALESCE(c.nombre, '') AS categoria
         FROM recetas r
         LEFT JOIN categorias c ON c.id = r.id_categoria
         WHERE COALESCE(r.archivada, 0) = 0
         ORDER BY r.nombre`
      );

      const lotes = await dbAll(
        bdProduccion,
        `SELECT id, nombre_receta, cantidad, fecha_produccion, costo_produccion, precio_venta
         FROM produccion
         ORDER BY COALESCE(fecha_produccion, '1970-01-01T00:00:00Z') ASC, id ASC`
      );

      const mapaLotesPorReceta = new Map();
      for (const lote of lotes || []) {
        const nombre = String(lote?.nombre_receta || '').trim();
        const clave = claveReceta(nombre);
        if (!clave) continue;
        if (!mapaLotesPorReceta.has(clave)) mapaLotesPorReceta.set(clave, []);
        mapaLotesPorReceta.get(clave).push({
          id: Number(lote?.id || 0),
          cantidad: Number(lote?.cantidad || 0),
          costo_produccion: Number(lote?.costo_produccion || 0),
          precio_venta: Number(lote?.precio_venta || 0),
          fecha_produccion: lote?.fecha_produccion || null,
          fecha_caducidad: sumarMesesIso(lote?.fecha_produccion, 10)
        });
      }

      const faltantesPedidos = new Map();
      if (bdVentas) {
        const pendientes = await dbAll(
          bdVentas,
          `SELECT oi.receta_nombre, o.folio, SUM(COALESCE(oi.cantidad, 0)) AS cantidad_ordenada
           FROM tienda_orden_items oi
           INNER JOIN tienda_ordenes o ON o.id = oi.id_orden
           WHERE LOWER(TRIM(COALESCE(o.estado, ''))) NOT IN ('cancelado', 'entregado')
           GROUP BY oi.receta_nombre, o.folio`
        ).catch(() => []);

        const vendidos = await dbAll(
          bdVentas,
          `SELECT nombre_receta, numero_pedido, SUM(COALESCE(cantidad, 0)) AS cantidad_vendida
           FROM ventas
           WHERE TRIM(COALESCE(numero_pedido, '')) <> ''
           GROUP BY nombre_receta, numero_pedido`
        ).catch(() => []);

        const mapaVendidos = new Map();
        (vendidos || []).forEach((v) => {
          const key = `${claveReceta(v?.nombre_receta)}::${String(v?.numero_pedido || '').trim()}`;
          mapaVendidos.set(key, Number(v?.cantidad_vendida || 0));
        });

        (pendientes || []).forEach((p) => {
          const nombreReceta = String(p?.receta_nombre || '').trim();
          const claveNombreReceta = claveReceta(nombreReceta);
          const folio = String(p?.folio || '').trim();
          if (!claveNombreReceta || !folio) return;
          const ordenada = Number(p?.cantidad_ordenada || 0);
          const vendida = Number(mapaVendidos.get(`${claveNombreReceta}::${folio}`) || 0);
          const faltante = Math.max(0, ordenada - vendida);
          if (faltante <= 0) return;
          faltantesPedidos.set(claveNombreReceta, Number(faltantesPedidos.get(claveNombreReceta) || 0) + faltante);
        });
      }

      const resumen = (recetas || []).map((receta) => {
        const nombre = String(receta?.nombre || '').trim();
        const claveNombre = claveReceta(nombre);
        const historial = [...(mapaLotesPorReceta.get(claveNombre) || [])]
          .sort((a, b) => String(b?.fecha_produccion || '').localeCompare(String(a?.fecha_produccion || '')) || (Number(b?.id || 0) - Number(a?.id || 0)));

        const stockActual = historial.reduce((acc, lote) => acc + (Number(lote?.cantidad || 0)), 0);
        const faltantePedido = Number(faltantesPedidos.get(claveNombre) || 0);
        const piezasDisponibles = stockActual - faltantePedido;
        const loteVenta = [...historial]
          .filter((l) => Number(l?.cantidad || 0) > 0)
          .sort((a, b) => String(a?.fecha_produccion || '').localeCompare(String(b?.fecha_produccion || '')) || (Number(a?.id || 0) - Number(b?.id || 0)))[0] || null;

        return {
          id_receta: Number(receta?.id || 0),
          nombre_receta: nombre,
          categoria: String(receta?.categoria || '').trim(),
          gramaje: Number(receta?.gramaje || 0),
          precio_sugerido: Number(receta?.tienda_precio_publico || 0),
          piezas_producidas: stockActual,
          piezas_faltantes_pedido: faltantePedido,
          piezas_disponibles: piezasDisponibles,
          lote_venta: loteVenta,
          historial
        };
      });

      res.json(resumen);
    } catch {
      res.status(500).json({ error: "No se pudo obtener resumen de producción" });
    }
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

            const unidadReceta = String(ing?.unidad || '').trim();
            const unidadInsumo = String(insumo?.unidad || '').trim();
            const devolver = convertirCantidadValidada((Number(ing?.cantidad) || 0) * cantidadProduccion, unidadReceta, unidadInsumo);
            if (!Number.isFinite(devolver) || devolver <= 0) {
              return res.status(400).json({
                error: "No se pudo revertir producción por unidades incompatibles",
                detalle: {
                  id_insumo: idInsumo,
                  nombre_insumo: String(insumo?.nombre || '').trim() || `Insumo #${idInsumo}`,
                  unidad_receta: unidadReceta,
                  unidad_inventario: unidadInsumo
                }
              });
            }

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

      transmitir({
        tipo: "inventario_actualizado",
        accion: "devuelto",
        nombre_receta: String(produccion?.nombre_receta || "").trim(),
        cantidad: Number(produccion?.cantidad || 0)
      });
      transmitir({
        tipo: "produccion_actualizado",
        accion: "eliminada",
        nombre_receta: String(produccion?.nombre_receta || "").trim(),
        cantidad: Number(produccion?.cantidad || 0)
      });
      return res.json({ ok: true, devoluciones });
    } catch {
      return res.status(500).json({ error: "No se pudo eliminar la producción" });
    }
  });

  app.delete("/produccion/:id/parcial", async (req, res) => {
    const idProduccion = req.params.id;
    const cantidadEliminar = Number(req.body?.cantidad || 0);
    const fechaNow = new Date().toISOString();

    if (!Number.isFinite(cantidadEliminar) || cantidadEliminar <= 0) {
      return res.status(400).json({ error: "Cantidad a eliminar inválida" });
    }

    try {
      const produccion = await dbGet(bdProduccion, "SELECT * FROM produccion WHERE id=?", [idProduccion]);
      if (!produccion) return res.status(404).json({ error: "Producción no encontrada" });

      const cantidadActual = Number(produccion?.cantidad || 0);
      if (cantidadEliminar > cantidadActual) {
        return res.status(400).json({ error: "La cantidad a eliminar supera el lote" });
      }

      const factor = cantidadEliminar / cantidadActual;
      const descuentosRegistrados = await dbAll(
        bdProduccion,
        `SELECT id, id_insumo, cantidad_descuento, unidad_insumo, costo_por_unidad
         FROM produccion_descuentos
         WHERE id_produccion = ?`,
        [idProduccion]
      );

      const devoluciones = [];
      for (const desc of descuentosRegistrados || []) {
        const idInsumo = Number(desc?.id_insumo || 0);
        const cantidadOriginal = Number(desc?.cantidad_descuento || 0);
        const devolver = cantidadOriginal * factor;
        if (!idInsumo || devolver <= 0) continue;

        const insumo = await dbGet(bdInventario, "SELECT * FROM inventario WHERE id=?", [idInsumo]);
        if (!insumo) continue;

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

        const costoUnidad = Number(desc?.costo_por_unidad) || Number(insumo?.costo_por_unidad) || 0;
        await dbRun(
          bdInventario,
          "INSERT INTO historial_inventario (id_inventario, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)",
          [idInsumo, fechaNow, devolver, costoUnidad * devolver]
        );

        const restanteDesc = cantidadOriginal - devolver;
        if (restanteDesc <= 1e-9) {
          await dbRun(bdProduccion, "DELETE FROM produccion_descuentos WHERE id=?", [Number(desc?.id || 0)]);
        } else {
          await dbRun(bdProduccion, "UPDATE produccion_descuentos SET cantidad_descuento=? WHERE id=?", [restanteDesc, Number(desc?.id || 0)]);
        }

        devoluciones.push({
          insumo: String(insumo?.nombre || "").trim() || `Insumo #${idInsumo}`,
          cantidad: devolver,
          unidad: String(desc?.unidad_insumo || insumo?.unidad || "").trim()
        });
      }

      const nuevaCantidad = cantidadActual - cantidadEliminar;
      if (nuevaCantidad <= 1e-9) {
        await dbRun(bdProduccion, "DELETE FROM produccion_descuentos WHERE id_produccion=?", [idProduccion]);
        await dbRun(bdProduccion, "DELETE FROM produccion WHERE id=?", [idProduccion]);
      } else {
        await dbRun(bdProduccion, "UPDATE produccion SET cantidad=? WHERE id=?", [nuevaCantidad, idProduccion]);
      }

      transmitir({
        tipo: "inventario_actualizado",
        accion: "devuelto",
        nombre_receta: String(produccion?.nombre_receta || "").trim(),
        cantidad: Number(cantidadEliminar || 0)
      });
      transmitir({
        tipo: "produccion_actualizado",
        accion: "eliminada_parcial",
        nombre_receta: String(produccion?.nombre_receta || "").trim(),
        cantidad: Number(cantidadEliminar || 0)
      });
      return res.json({ ok: true, parcial: true, cantidad_eliminada: cantidadEliminar, devoluciones });
    } catch {
      return res.status(500).json({ error: "No se pudo eliminar parcialmente la producción" });
    }
  });
}
