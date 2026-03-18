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

async function obtenerContextoLotesInsumo(bdInventario, idInsumo) {
  const base = await dbGet(bdInventario, 'SELECT * FROM inventario WHERE id=?', [idInsumo]);
  if (!base) return null;

  const codigo = String(base?.codigo || '').trim();
  const nombre = String(base?.nombre || '').trim();
  const unidad = String(base?.unidad || '').trim();

  let lotes = [];
  if (codigo) {
    lotes = await dbAll(
      bdInventario,
      `SELECT *
       FROM inventario
       WHERE LOWER(TRIM(COALESCE(codigo, ''))) = LOWER(TRIM(?))
         AND LOWER(TRIM(COALESCE(unidad, ''))) = LOWER(TRIM(?))
       ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END, id ASC`,
      [codigo, unidad, Number(base?.id || 0)]
    );
  } else {
    lotes = await dbAll(
      bdInventario,
      `SELECT *
       FROM inventario
       WHERE LOWER(TRIM(COALESCE(nombre, ''))) = LOWER(TRIM(?))
         AND LOWER(TRIM(COALESCE(unidad, ''))) = LOWER(TRIM(?))
       ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END, id ASC`,
      [nombre, unidad, Number(base?.id || 0)]
    );
  }

  return {
    base,
    lotes: Array.isArray(lotes) ? lotes : []
  };
}

function planearConsumoPorLotes(contexto, requerido, consumoPlaneadoPorLote = new Map()) {
  const lotes = Array.isArray(contexto?.lotes) ? contexto.lotes : [];
  const base = contexto?.base || null;
  const activos = lotes.filter((l) => Number(l?.activo_consumo ?? 1) === 1);
  const inactivos = lotes.filter((l) => Number(l?.activo_consumo ?? 1) !== 1);

  const disponibleActivo = activos.reduce((acc, lote) => {
    const id = Number(lote?.id || 0);
    const planeado = Number(consumoPlaneadoPorLote.get(id) || 0);
    const disponibleRaw = Number(lote?.cantidad_disponible) || 0;
    const disponibleReal = Math.max(0, disponibleRaw - planeado);
    return acc + disponibleReal;
  }, 0);

  const disponibleInactivo = inactivos.reduce((acc, lote) => {
    const disponibleRaw = Number(lote?.cantidad_disponible) || 0;
    return acc + Math.max(0, disponibleRaw);
  }, 0);

  let restante = Number(requerido || 0);
  const consumos = [];

  for (const lote of activos) {
    if (restante <= 1e-9) break;
    const id = Number(lote?.id || 0);
    const planeado = Number(consumoPlaneadoPorLote.get(id) || 0);
    const disponibleRaw = Number(lote?.cantidad_disponible) || 0;
    const disponibleReal = Math.max(0, disponibleRaw - planeado);
    if (disponibleReal <= 0) continue;

    const usar = Math.min(restante, disponibleReal);
    if (usar <= 0) continue;

    consumoPlaneadoPorLote.set(id, planeado + usar);
    consumos.push({
      id_insumo: id,
      nombre_insumo: String(lote?.nombre || '').trim() || `Insumo #${id}`,
      unidad_insumo: String(lote?.unidad || '').trim(),
      costo_por_unidad: Number(lote?.costo_por_unidad) || 0,
      requerido: usar
    });
    restante -= usar;
  }

  const consumoPrincipal = base
    ? consumos.find((item) => Number(item?.id_insumo || 0) === Number(base?.id || 0))
    : null;
  const principalDisponible = Number(base?.cantidad_disponible) || 0;
  const principalTotal = Number(base?.cantidad_total) || 0;
  const principalUsado = Number(consumoPrincipal?.requerido || 0);
  const principalRestante = Math.max(0, principalDisponible - principalUsado);
  const principalPorcentaje = principalTotal > 0 ? ((principalRestante / principalTotal) * 100) : 0;

  return {
    consumos,
    faltante: Math.max(0, restante),
    disponible_activo: disponibleActivo,
    disponible_inactivo: disponibleInactivo,
    tiene_lotes_inactivos: disponibleInactivo > 0,
    aviso_lote_alterno: principalPorcentaje <= 20 && disponibleInactivo > 0
  };
}

async function crearOrdenCompraAutomaticaInsumo(bdInventario, insumo = {}, cantidadSugerida = 0) {
  const idInsumo = Number(insumo?.id || 0);
  if (!Number.isFinite(idInsumo) || idInsumo <= 0) return null;

  const pendienteExistente = await dbGet(
    bdInventario,
    `SELECT o.id, o.numero_orden
     FROM ordenes_compra_items i
     INNER JOIN ordenes_compra o ON o.id = i.id_orden
     WHERE i.id_inventario=?
       AND COALESCE(i.surtido, 0)=0
       AND LOWER(TRIM(COALESCE(o.estado, ''))) <> 'surtida'
     ORDER BY COALESCE(o.fecha_creacion, '') DESC, o.id DESC
     LIMIT 1`,
    [idInsumo]
  );
  if (pendienteExistente?.id) {
    return {
      ya_existia: true,
      id_orden: Number(pendienteExistente.id || 0),
      numero_orden: String(pendienteExistente.numero_orden || '').trim()
    };
  }

  const ultimo = await dbGet(
    bdInventario,
    `SELECT numero_orden
     FROM ordenes_compra
     WHERE numero_orden LIKE 'CHIOC%'
     ORDER BY numero_orden DESC
     LIMIT 1`
  );

  const actual = String(ultimo?.numero_orden || '').trim();
  const match = actual.match(/^CHIOC(\d+)$/);
  const consecutivo = match ? (Number(match[1]) || 0) + 1 : 1;
  const numeroOrden = `CHIOC${String(consecutivo).padStart(7, '0')}`;
  const fechaCreacion = new Date().toISOString();
  const cantidad = Math.max(1, Number(cantidadSugerida || 0));
  const precioUnitario = Number(insumo?.costo_por_unidad || 0);

  const nuevaOrden = await dbRun(
    bdInventario,
    `INSERT INTO ordenes_compra (numero_orden, proveedor, fecha_creacion, estado, fecha_surtida)
     VALUES (?,?,?,?,NULL)`,
    [numeroOrden, String(insumo?.proveedor || '').trim(), fechaCreacion, 'pendiente']
  );

  await dbRun(
    bdInventario,
    `INSERT INTO ordenes_compra_items
      (id_orden, tipo_item, id_inventario, id_utensilio, codigo, nombre, cantidad_requerida, cantidad_surtida, precio_unitario, costo_total_surtido, surtido)
     VALUES (?,?,?,?,?,?,?,?,?,?,0)`,
    [
      nuevaOrden.lastID,
      'insumo',
      idInsumo,
      null,
      String(insumo?.codigo || '').trim(),
      String(insumo?.nombre || '').trim(),
      cantidad,
      0,
      precioUnitario,
      0
    ]
  );

  return {
    ya_existia: false,
    id_orden: Number(nuevaOrden.lastID || 0),
    numero_orden: numeroOrden,
    cantidad_requerida: cantidad
  };
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
      const faltantes = [];
      const avisos = [];
      const consumoPlaneadoPorLote = new Map();
      const contextosIngredientes = new Map();
      if (receta?.id) {
        const ingredientes = await dbAll(
          bdRecetas,
          "SELECT id_insumo, cantidad, unidad FROM ingredientes_receta WHERE id_receta=?",
          [receta.id]
        );

        for (const ing of ingredientes || []) {
          const idInsumo = Number(ing?.id_insumo);
          if (!Number.isFinite(idInsumo) || idInsumo <= 0) continue;

          const contexto = await obtenerContextoLotesInsumo(bdInventario, idInsumo);
          if (!contexto?.base) continue;
          const insumoBase = contexto.base;

          const unidadReceta = String(ing?.unidad || '').trim();
          const unidadInsumo = String(insumoBase?.unidad || '').trim();
          const requerido = convertirCantidadValidada((Number(ing?.cantidad) || 0) * cantidadProduccion, unidadReceta, unidadInsumo);
          if (!Number.isFinite(requerido) || requerido <= 0) {
            incompatibilidades.push({
              id_insumo: idInsumo,
              nombre_insumo: String(insumoBase?.nombre || '').trim() || `Insumo #${idInsumo}`,
              unidad_receta: unidadReceta,
              unidad_inventario: unidadInsumo
            });
            continue;
          }

          const planLotes = planearConsumoPorLotes(contexto, requerido, consumoPlaneadoPorLote);
          contextosIngredientes.set(idInsumo, {
            id_insumo: idInsumo,
            base: insumoBase,
            requerido,
            disponible_activo: planLotes.disponible_activo,
            disponible_inactivo: planLotes.disponible_inactivo,
            tiene_lotes_inactivos: planLotes.tiene_lotes_inactivos,
            aviso_lote_alterno: planLotes.aviso_lote_alterno
          });

          if (planLotes.faltante > 1e-9) {
            faltantes.push({
              id_insumo: idInsumo,
              nombre_insumo: String(insumoBase?.nombre || '').trim() || `Insumo #${idInsumo}`,
              faltante: planLotes.faltante,
              unidad: String(insumoBase?.unidad || '').trim(),
              disponible: planLotes.disponible_activo,
              requerido,
              requiere_activar_lote: Boolean(planLotes.tiene_lotes_inactivos)
            });
            continue;
          }

          planDescuentos.push(...planLotes.consumos);

          if (planLotes.aviso_lote_alterno) {
            avisos.push({
              tipo: 'lote_alterno_disponible',
              id_insumo: idInsumo,
              nombre_insumo: String(insumoBase?.nombre || '').trim() || `Insumo #${idInsumo}`,
              mensaje: `El lote activo de ${String(insumoBase?.nombre || '').trim() || `Insumo #${idInsumo}`} está bajo y hay otro lote disponible para activar.`
            });
          }
        }
      }

      if (incompatibilidades.length) {
        return res.status(400).json({
          error: "Unidades incompatibles entre receta e inventario",
          incompatibilidades
        });
      }

      if (faltantes.length) {
        const requiereActivacion = faltantes.some((f) => Boolean(f?.requiere_activar_lote));
        return res.status(400).json({
          error: requiereActivacion
            ? "Hay lotes desactivados con stock. Actívalos para completar la receta"
            : "Inventario insuficiente para registrar la producción",
          requiere_activar_lote: requiereActivacion,
          faltantes
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

      const ordenesCompraAutomaticas = [];
      for (const ctx of contextosIngredientes.values()) {
        const idInsumo = Number(ctx?.id_insumo || 0);
        if (!Number.isFinite(idInsumo) || idInsumo <= 0) continue;

        const contextoActual = await obtenerContextoLotesInsumo(bdInventario, idInsumo);
        const baseActual = contextoActual?.base;
        const lotesActuales = Array.isArray(contextoActual?.lotes) ? contextoActual.lotes : [];
        if (!baseActual || !lotesActuales.length) continue;

        const principalTotal = Number(baseActual?.cantidad_total || 0);
        const principalDisponible = Number(baseActual?.cantidad_disponible || 0);
        if (principalTotal <= 0 || principalDisponible <= 0) continue;

        const principalPorcentaje = (principalDisponible / principalTotal) * 100;
        if (principalPorcentaje > 20) continue;

        const lotesAlternosConStock = lotesActuales.filter((l) => Number(l?.id || 0) !== Number(baseActual?.id || 0) && Number(l?.cantidad_disponible || 0) > 0);
        if (lotesAlternosConStock.length > 0) {
          const tieneAlternoInactivo = lotesAlternosConStock.some((l) => Number(l?.activo_consumo ?? 1) !== 1);
          if (tieneAlternoInactivo) {
            avisos.push({
              tipo: 'lote_alterno_disponible',
              id_insumo: Number(baseActual?.id || 0),
              nombre_insumo: String(baseActual?.nombre || '').trim(),
              mensaje: `Queda poco de ${String(baseActual?.nombre || '').trim()}. Hay otro lote disponible para activar.`
            });
          }
          continue;
        }

        const cantidadSugerida = Math.max(1, principalTotal - principalDisponible);
        const orden = await crearOrdenCompraAutomaticaInsumo(bdInventario, baseActual, cantidadSugerida);
        if (!orden || orden?.ya_existia) continue;

        ordenesCompraAutomaticas.push({
          id_orden: Number(orden?.id_orden || 0),
          numero_orden: String(orden?.numero_orden || '').trim(),
          id_insumo: Number(baseActual?.id || 0),
          nombre_insumo: String(baseActual?.nombre || '').trim(),
          cantidad_requerida: Number(orden?.cantidad_requerida || 0)
        });

        transmitir({
          tipo: "orden_compra_nueva",
          id_orden: Number(orden?.id_orden || 0),
          numero_orden: String(orden?.numero_orden || '').trim(),
          proveedor: String(baseActual?.proveedor || '').trim() || "Sin proveedor",
          total_items: 1
        });
      }

      if (ordenesCompraAutomaticas.length > 0) {
        transmitir({ tipo: "inventario_actualizado" });
      }
      transmitir({ tipo: "produccion_actualizado", accion: "registrada", nombre_receta: nombreReceta, cantidad: cantidadProduccion });
      if (descuentosAplicados.length > 0) {
        transmitir({ tipo: "produccion_descuento", receta: nombreReceta, cantidad: cantidadProduccion, descuentos: descuentosAplicados });
      }

      return res.json({ ok: true, descuentos: descuentosAplicados, avisos, ordenes_compra_automaticas: ordenesCompraAutomaticas });
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
      const faltantes = [];
      const avisos = [];
      const consumoPlaneadoPorLote = new Map();
      const contextosIngredientes = new Map();

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

          const contexto = await obtenerContextoLotesInsumo(bdInventario, idInsumo);
          if (!contexto?.base) continue;
          const insumo = contexto.base;

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

          const planLotes = planearConsumoPorLotes(contexto, requerido, consumoPlaneadoPorLote);
          contextosIngredientes.set(idInsumo, {
            id_insumo: idInsumo,
            base: insumo,
            requerido,
            disponible_activo: planLotes.disponible_activo,
            disponible_inactivo: planLotes.disponible_inactivo,
            tiene_lotes_inactivos: planLotes.tiene_lotes_inactivos,
            aviso_lote_alterno: planLotes.aviso_lote_alterno
          });

          if (planLotes.faltante > 1e-9) {
            faltantes.push({
              receta: recetaNombre,
              id_insumo: idInsumo,
              nombre_insumo: String(insumo?.nombre || '').trim() || `Insumo #${idInsumo}`,
              faltante: planLotes.faltante,
              unidad: String(insumo?.unidad || '').trim(),
              disponible: planLotes.disponible_activo,
              requerido,
              requiere_activar_lote: Boolean(planLotes.tiene_lotes_inactivos)
            });
            continue;
          }

          planLotes.consumos.forEach((consumo) => {
            const existente = requeridosMap.get(Number(consumo?.id_insumo || 0));
            if (existente) {
              existente.requerido += Number(consumo?.requerido || 0);
            } else {
              requeridosMap.set(Number(consumo?.id_insumo || 0), {
                id_insumo: Number(consumo?.id_insumo || 0),
                nombre_insumo: String(consumo?.nombre_insumo || '').trim(),
                unidad_insumo: String(consumo?.unidad_insumo || '').trim(),
                costo_por_unidad: Number(consumo?.costo_por_unidad) || 0,
                requerido: Number(consumo?.requerido || 0)
              });
            }
          });

          descuentosReceta.push(...planLotes.consumos);

          if (planLotes.aviso_lote_alterno) {
            avisos.push({
              tipo: 'lote_alterno_disponible',
              id_insumo: idInsumo,
              nombre_insumo: String(insumo?.nombre || '').trim() || `Insumo #${idInsumo}`,
              mensaje: `El lote activo de ${String(insumo?.nombre || '').trim() || `Insumo #${idInsumo}`} está bajo y hay otro lote disponible para activar.`
            });
          }
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

      if (faltantes.length) {
        const requiereActivacion = faltantes.some((f) => Boolean(f?.requiere_activar_lote));
        return res.status(400).json({
          error: requiereActivacion
            ? "Hay lotes desactivados con stock. Actívalos para completar la receta"
            : "Inventario insuficiente para registrar la producción del paquete",
          requiere_activar_lote: requiereActivacion,
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

      const ordenesCompraAutomaticas = [];
      for (const ctx of contextosIngredientes.values()) {
        const idInsumo = Number(ctx?.id_insumo || 0);
        if (!Number.isFinite(idInsumo) || idInsumo <= 0) continue;

        const contextoActual = await obtenerContextoLotesInsumo(bdInventario, idInsumo);
        const baseActual = contextoActual?.base;
        const lotesActuales = Array.isArray(contextoActual?.lotes) ? contextoActual.lotes : [];
        if (!baseActual || !lotesActuales.length) continue;

        const principalTotal = Number(baseActual?.cantidad_total || 0);
        const principalDisponible = Number(baseActual?.cantidad_disponible || 0);
        if (principalTotal <= 0 || principalDisponible <= 0) continue;

        const principalPorcentaje = (principalDisponible / principalTotal) * 100;
        if (principalPorcentaje > 20) continue;

        const lotesAlternosConStock = lotesActuales.filter((l) => Number(l?.id || 0) !== Number(baseActual?.id || 0) && Number(l?.cantidad_disponible || 0) > 0);
        if (lotesAlternosConStock.length > 0) {
          const tieneAlternoInactivo = lotesAlternosConStock.some((l) => Number(l?.activo_consumo ?? 1) !== 1);
          if (tieneAlternoInactivo) {
            avisos.push({
              tipo: 'lote_alterno_disponible',
              id_insumo: Number(baseActual?.id || 0),
              nombre_insumo: String(baseActual?.nombre || '').trim(),
              mensaje: `Queda poco de ${String(baseActual?.nombre || '').trim()}. Hay otro lote disponible para activar.`
            });
          }
          continue;
        }

        const cantidadSugerida = Math.max(1, principalTotal - principalDisponible);
        const orden = await crearOrdenCompraAutomaticaInsumo(bdInventario, baseActual, cantidadSugerida);
        if (!orden || orden?.ya_existia) continue;

        ordenesCompraAutomaticas.push({
          id_orden: Number(orden?.id_orden || 0),
          numero_orden: String(orden?.numero_orden || '').trim(),
          id_insumo: Number(baseActual?.id || 0),
          nombre_insumo: String(baseActual?.nombre || '').trim(),
          cantidad_requerida: Number(orden?.cantidad_requerida || 0)
        });

        transmitir({
          tipo: "orden_compra_nueva",
          id_orden: Number(orden?.id_orden || 0),
          numero_orden: String(orden?.numero_orden || '').trim(),
          proveedor: String(baseActual?.proveedor || '').trim() || "Sin proveedor",
          total_items: 1
        });
      }

      if (ordenesCompraAutomaticas.length > 0) {
        transmitir({ tipo: "inventario_actualizado" });
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
        total_piezas: totalPiezas,
        avisos,
        ordenes_compra_automaticas: ordenesCompraAutomaticas
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
