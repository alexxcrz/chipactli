import { transmitir, normalizarTextoBusqueda } from "../../utils/index.js";

function normalizarUnidadInsumo(unidad) {
  const u = String(unidad || '').toLowerCase().trim();
  if (!u) return '';
  if (u === 'go' || u === 'gota' || u === 'gotas') return 'gotas';
  return u;
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ changes: this?.changes || 0, lastID: this?.lastID || 0 });
    });
  });
}

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

export function registrarRutasInventario(app, bdInventario, bdRecetas = null) {
  const sincronizarIngredienteReceta = (idInsumo, nombre, proveedor, callback = () => {}) => {
    if (!bdRecetas) {
      callback(0);
      return;
    }

    const id = Number(idInsumo || 0);
    if (!Number.isFinite(id) || id <= 0) {
      callback(0);
      return;
    }

    bdRecetas.run(
      "UPDATE ingredientes_receta SET nombre_insumo=?, proveedor=? WHERE id_insumo=?",
      [String(nombre || '').trim(), String(proveedor || '').trim(), id],
      function onSync() {
        callback(Number(this?.changes || 0));
      }
    );
  };

  app.get('/inventario', (req, res) => {
    const termino = (req.query.busqueda || '').trim();
    const select = 'id, codigo, nombre, proveedor, unidad, cantidad_total, cantidad_disponible, costo_total, costo_por_unidad, pendiente';
    const consulta = `SELECT ${select} FROM inventario ORDER BY COALESCE(NULLIF(TRIM(proveedor), ''), 'ZZZ'), nombre`;

    bdInventario.all(consulta, (e, r) => {
      const lista = (Array.isArray(r) ? r : []).map((item) => ({ ...item, unidad: normalizarUnidadInsumo(item?.unidad) }));
      if (!termino) {
        res.json(lista);
        return;
      }
      const terminoNormalizado = normalizarTextoBusqueda(termino);
      const filtrada = lista.filter((item) => {
        const nombre = normalizarTextoBusqueda(item?.nombre);
        const codigo = normalizarTextoBusqueda(item?.codigo);
        const proveedor = normalizarTextoBusqueda(item?.proveedor);
        return nombre.includes(terminoNormalizado) || codigo.includes(terminoNormalizado) || proveedor.includes(terminoNormalizado);
      });
      res.json(filtrada);
    });
  });

  app.get('/inventario/estadisticas', (req, res) => {
    bdInventario.get(
      'SELECT COUNT(*) as total_insumos, COALESCE(SUM(costo_total),0) as inversion_total FROM inventario',
      (err, inv) => {
        bdInventario.get(
          'SELECT COALESCE(SUM(costo_recuperado),0) as inversion_recuperada FROM inversion_recuperada',
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

  app.get('/inventario/lista-insumos-ordenes', (req, res) => {
    const responderLista = () => {
      bdInventario.all(
        `SELECT
           id,
           tipo_item,
           id_referencia,
           codigo,
           nombre,
           proveedor,
           unidad,
           cantidad_referencia,
           precio_unitario,
           costo_total_referencia,
           vigente_desde,
           vigente_hasta,
           ultima_compra_en,
           creado_en
         FROM lista_precios_ordenes
         WHERE COALESCE(activo, 1) = 1
         ORDER BY
           COALESCE(NULLIF(vigente_desde, ''), NULLIF(ultima_compra_en, ''), NULLIF(creado_en, ''), '9999-12-31T23:59:59.999Z') ASC,
           id ASC`,
        (errOut, rowsOut) => {
          if (errOut) return res.status(500).json({ error: 'Error al cargar lista de precios de insumos' });
          const mapaPrimerRegistro = new Map();
          for (const row of (rowsOut || [])) {
            const tipo = String(row?.tipo_item || 'insumo').toLowerCase() === 'utensilio' ? 'utensilio' : 'insumo';
            const idRef = Number(row?.id_referencia || 0);
            const codigo = String(row?.codigo || '').trim().toLowerCase();
            const nombre = String(row?.nombre || '').trim().toLowerCase();
            const claveBase = idRef > 0 ? `ref:${idRef}` : `txt:${codigo}|${nombre}`;
            const clave = `${tipo}:${claveBase}`;
            if (!mapaPrimerRegistro.has(clave)) {
              mapaPrimerRegistro.set(clave, row);
            }
          }

          const rowsUnicas = Array.from(mapaPrimerRegistro.values()).sort((a, b) => {
            const proveedorA = String(a?.proveedor || '').trim().toLowerCase();
            const proveedorB = String(b?.proveedor || '').trim().toLowerCase();
            if (proveedorA !== proveedorB) return proveedorA.localeCompare(proveedorB, 'es');
            const nombreA = String(a?.nombre || '').trim().toLowerCase();
            const nombreB = String(b?.nombre || '').trim().toLowerCase();
            if (nombreA !== nombreB) return nombreA.localeCompare(nombreB, 'es');
            return Number(a?.id || 0) - Number(b?.id || 0);
          });

          const items = rowsUnicas.map((row) => ({
            id: Number(row?.id || 0),
            tipo_item: String(row?.tipo_item || 'insumo').toLowerCase() === 'utensilio' ? 'utensilio' : 'insumo',
            id_referencia: Number(row?.id_referencia || 0),
            codigo: String(row?.codigo || '').trim(),
            nombre: String(row?.nombre || '').trim(),
            proveedor: String(row?.proveedor || '').trim(),
            unidad: normalizarUnidadInsumo(row?.unidad),
            cantidad: Number(row?.cantidad_referencia || 0),
            precio_unitario: Number(row?.precio_unitario || 0),
            costo: Number(row?.costo_total_referencia || 0),
            fecha_cambio: row?.vigente_desde || row?.ultima_compra_en || row?.creado_en || null,
            vigente_hasta: row?.vigente_hasta || null,
            fuente: 'lista_precios'
          }));
          res.json({ items });
        }
      );
    };

    bdInventario.get(
      `SELECT COUNT(*) AS total FROM lista_precios_ordenes`,
      async (errCount, rowCount) => {
        if (errCount) return res.status(500).json({ error: 'Error al validar lista de precios' });
        if (Number(rowCount?.total || 0) > 0) return responderLista();

        try {
          const surtidos = await dbAll(
            bdInventario,
            `SELECT
               oci.id,
               oci.tipo_item,
               oci.id_inventario,
               oci.id_utensilio,
               oci.codigo,
               oci.nombre,
               COALESCE(oc.proveedor, '') AS proveedor,
               COALESCE(oci.cantidad_surtida, 0) AS cantidad_surtida,
               COALESCE(oci.precio_unitario, 0) AS precio_unitario,
               COALESCE(oci.costo_total_surtido, 0) AS costo_total_surtido,
               COALESCE(oc.fecha_surtida, oc.fecha_creacion) AS fecha,
               CASE WHEN LOWER(COALESCE(oci.tipo_item, 'insumo')) = 'utensilio' THEN COALESCE(u.unidad, '') ELSE COALESCE(i.unidad, '') END AS unidad
             FROM ordenes_compra_items oci
             INNER JOIN ordenes_compra oc ON oc.id = oci.id_orden
             LEFT JOIN inventario i ON i.id = oci.id_inventario
             LEFT JOIN utensilios u ON u.id = oci.id_utensilio
             WHERE (COALESCE(oci.cantidad_surtida, 0) > 0 OR COALESCE(oci.surtido, 0)=1)
               AND COALESCE(oci.precio_unitario, 0) > 0
             ORDER BY COALESCE(oc.fecha_surtida, oc.fecha_creacion) ASC, oci.id ASC`
          );

          const mapa = new Map();
          for (const row of surtidos) {
            const tipo = String(row?.tipo_item || 'insumo').toLowerCase() === 'utensilio' ? 'utensilio' : 'insumo';
            const idRef = tipo === 'utensilio' ? Number(row?.id_utensilio || 0) : Number(row?.id_inventario || 0);
            const cantidad = Number(row?.cantidad_surtida || 0);
            if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
            const codigo = String(row?.codigo || '').trim().toLowerCase();
            const nombre = String(row?.nombre || '').trim().toLowerCase();
            const clave = idRef > 0
              ? `${tipo}:ref:${idRef}`
              : `${tipo}:txt:${codigo}|${nombre}`;
            if (!mapa.has(clave)) mapa.set(clave, row);
          }

          for (const row of mapa.values()) {
            const tipo = String(row?.tipo_item || 'insumo').toLowerCase() === 'utensilio' ? 'utensilio' : 'insumo';
            const idRef = tipo === 'utensilio' ? Number(row?.id_utensilio || 0) : Number(row?.id_inventario || 0);
            const fecha = String(row?.fecha || new Date().toISOString());
            const cantidad = Number(row?.cantidad_surtida || 0);
            const precio = Number(row?.precio_unitario || 0);
            const costo = Number(row?.costo_total_surtido || (cantidad * precio));

            const inserted = await dbRun(
              bdInventario,
              `INSERT INTO lista_precios_ordenes
               (tipo_item, id_referencia, codigo, nombre, proveedor, unidad, cantidad_referencia, precio_unitario, costo_total_referencia, vigente_desde, vigente_hasta, ultima_compra_en, activo, creado_en, actualizado_en)
               VALUES (?,?,?,?,?,?,?,?,?,?,NULL,?,1,?,?)`,
              [
                tipo,
                idRef > 0 ? idRef : null,
                String(row?.codigo || '').trim(),
                String(row?.nombre || '').trim(),
                String(row?.proveedor || '').trim(),
                normalizarUnidadInsumo(row?.unidad),
                cantidad,
                precio,
                costo,
                fecha,
                fecha,
                fecha,
                fecha
              ]
            );

            await dbRun(
              bdInventario,
              `INSERT INTO historial_lista_precios_ordenes
               (id_lista_precio, precio_unitario, costo_total_referencia, vigente_desde, vigente_hasta, motivo, registrado_en)
               VALUES (?,?,?,?,NULL,?,?)`,
              [inserted.lastID, precio, costo, fecha, 'migracion_desde_ordenes_previas', fecha]
            );
          }
        } catch {
          // Si falla la migración inicial, respondemos con lo que exista.
        }

        responderLista();
      }
    );
  });

  app.get('/inventario/lista-insumos-ordenes/:id/historial', async (req, res) => {
    const id = Number(req.params.id || 0);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });

    try {
      const item = await dbGet(
        bdInventario,
        `SELECT id, codigo, nombre, proveedor, unidad, cantidad_referencia, precio_unitario, costo_total_referencia, vigente_desde, vigente_hasta
         FROM lista_precios_ordenes WHERE id=?`,
        [id]
      );
      if (!item) return res.status(404).json({ error: 'Insumo no encontrado en lista' });

      const historial = await dbAll(
        bdInventario,
        `SELECT id, precio_unitario, costo_total_referencia, vigente_desde, vigente_hasta, motivo, registrado_en
         FROM historial_lista_precios_ordenes
         WHERE id_lista_precio=?
         ORDER BY COALESCE(vigente_desde, registrado_en) DESC, id DESC`,
        [id]
      );

      res.json({
        item,
        historial: historial || []
      });
    } catch {
      res.status(500).json({ error: 'Error al cargar historial de precios del insumo' });
    }
  });

  app.patch('/inventario/lista-insumos-ordenes/:id', async (req, res) => {
    const id = Number(req.params.id || 0);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });

    const codigo = String(req.body?.codigo || '').trim();
    const nombre = String(req.body?.nombre || '').trim();
    const proveedor = String(req.body?.proveedor || '').trim();
    const unidad = normalizarUnidadInsumo(req.body?.unidad);
    const cantidad = Number(req.body?.cantidad_referencia ?? req.body?.cantidad ?? 0);
    const precioUnitario = Number(req.body?.precio_unitario ?? 0);
    const costoTotal = Number(req.body?.costo_total_referencia ?? req.body?.costo ?? 0);

    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    if (!Number.isFinite(cantidad) || cantidad <= 0) return res.status(400).json({ error: 'Cantidad de referencia inválida' });
    if (!Number.isFinite(precioUnitario) || precioUnitario < 0) return res.status(400).json({ error: 'Precio unitario inválido' });

    try {
      const actual = await dbGet(
        bdInventario,
        `SELECT id, precio_unitario, costo_total_referencia
         FROM lista_precios_ordenes
         WHERE id=? AND COALESCE(activo, 1)=1`,
        [id]
      );
      if (!actual) return res.status(404).json({ error: 'Registro no encontrado' });

      const ahora = new Date().toISOString();
      await dbRun(
        bdInventario,
        `UPDATE lista_precios_ordenes
         SET codigo=?, nombre=?, proveedor=?, unidad=?, cantidad_referencia=?, precio_unitario=?, costo_total_referencia=?, actualizado_en=?
         WHERE id=?`,
        [codigo, nombre, proveedor, unidad, cantidad, precioUnitario, costoTotal, ahora, id]
      );

      const precioCambio = Math.abs(Number(actual?.precio_unitario || 0) - precioUnitario) > 0.000001
        || Math.abs(Number(actual?.costo_total_referencia || 0) - costoTotal) > 0.000001;

      if (precioCambio) {
        await dbRun(
          bdInventario,
          `UPDATE historial_lista_precios_ordenes
           SET vigente_hasta=?
           WHERE id_lista_precio=? AND vigente_hasta IS NULL`,
          [ahora, id]
        );
        await dbRun(
          bdInventario,
          `INSERT INTO historial_lista_precios_ordenes
           (id_lista_precio, precio_unitario, costo_total_referencia, vigente_desde, vigente_hasta, motivo, registrado_en)
           VALUES (?,?,?,?,NULL,?,?)`,
          [id, precioUnitario, costoTotal, ahora, 'edicion_manual', ahora]
        );
      }

      transmitir({ tipo: 'inventario_actualizado' });
      res.json({ ok: true, precio_actualizado: precioCambio });
    } catch {
      res.status(500).json({ error: 'No se pudo actualizar el insumo de la lista de precios' });
    }
  });

  app.delete('/inventario/lista-insumos-ordenes/:id', async (req, res) => {
    const id = Number(req.params.id || 0);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });

    try {
      const actual = await dbGet(
        bdInventario,
        `SELECT id, tipo_item, id_referencia, codigo, nombre
         FROM lista_precios_ordenes
         WHERE id=?`,
        [id]
      );
      if (!actual) return res.status(404).json({ error: 'Registro no encontrado' });

      const tipo = String(actual?.tipo_item || 'insumo').toLowerCase() === 'utensilio' ? 'utensilio' : 'insumo';
      const idRef = Number(actual?.id_referencia || 0);
      const codigo = String(actual?.codigo || '').trim();
      const nombre = String(actual?.nombre || '').trim();
      const ahora = new Date().toISOString();

      const idsRelacionados = await dbAll(
        bdInventario,
        `SELECT id
         FROM lista_precios_ordenes
         WHERE COALESCE(activo, 1)=1
           AND LOWER(COALESCE(tipo_item, 'insumo')) = ?
           AND (
             (? > 0 AND COALESCE(id_referencia, 0) = ?)
             OR
             (? <= 0 AND LOWER(TRIM(COALESCE(codigo, ''))) = LOWER(TRIM(?)) AND LOWER(TRIM(COALESCE(nombre, ''))) = LOWER(TRIM(?)))
           )`,
        [tipo, idRef, idRef, idRef, codigo, nombre]
      );
      const ids = idsRelacionados.map((row) => Number(row?.id || 0)).filter((n) => Number.isFinite(n) && n > 0);
      if (!ids.length) return res.status(404).json({ error: 'Registro no encontrado' });

      const placeholders = ids.map(() => '?').join(',');
      await dbRun(
        bdInventario,
        `UPDATE historial_lista_precios_ordenes
         SET vigente_hasta=COALESCE(vigente_hasta, ?)
         WHERE id_lista_precio IN (${placeholders}) AND vigente_hasta IS NULL`,
        [ahora, ...ids]
      );

      const out = await dbRun(
        bdInventario,
        `UPDATE lista_precios_ordenes
         SET activo=0, vigente_hasta=COALESCE(vigente_hasta, ?), actualizado_en=?
         WHERE id IN (${placeholders}) AND COALESCE(activo,1)=1`,
        [ahora, ahora, ...ids]
      );

      if (!out.changes) return res.status(404).json({ error: 'Registro no encontrado' });

      transmitir({ tipo: 'inventario_actualizado' });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'No se pudo eliminar el registro de la lista de precios' });
    }
  });

  app.get('/inventario/lista-precios/archivos', async (req, res) => {
    try {
      const q = String(req.query?.q || '').trim().toLowerCase();
      const params = [];
      let where = '';
      if (q) {
        where = `WHERE LOWER(COALESCE(nombre, '')) LIKE ?
                  OR LOWER(COALESCE(proveedor, '')) LIKE ?
                  OR LOWER(COALESCE(contenido_texto, '')) LIKE ?`;
        const like = `%${q}%`;
        params.push(like, like, like);
      }

      const archivos = await dbAll(
        bdInventario,
        `SELECT id, nombre, proveedor, url, tipo, creado_en
         FROM lista_precios_archivos
         ${where}
         ORDER BY datetime(COALESCE(creado_en, '1970-01-01T00:00:00Z')) DESC, id DESC`,
        params
      );
      res.json({ archivos: archivos || [] });
    } catch {
      res.status(500).json({ error: 'No se pudieron cargar archivos de lista de precios' });
    }
  });

  app.post('/inventario/lista-precios/archivos', async (req, res) => {
    try {
      const nombre = String(req.body?.nombre || '').trim();
      const proveedor = String(req.body?.proveedor || '').trim();
      const url = String(req.body?.url || '').trim();
      const tipo = String(req.body?.tipo || '').trim();
      const contenidoTexto = String(req.body?.contenido_texto || '').slice(0, 200000);
      if (!nombre || !url) return res.status(400).json({ error: 'Nombre y URL son obligatorios' });

      const out = await dbRun(
        bdInventario,
        `INSERT INTO lista_precios_archivos (nombre, proveedor, url, tipo, contenido_texto, creado_en)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [nombre, proveedor, url, tipo, contenidoTexto]
      );
      res.json({ ok: true, id: out.lastID });
    } catch {
      res.status(500).json({ error: 'No se pudo guardar el archivo de lista de precios' });
    }
  });

  app.delete('/inventario/lista-precios/archivos/:id', async (req, res) => {
    const id = Number(req.params.id || 0);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
    try {
      const out = await dbRun(
        bdInventario,
        `DELETE FROM lista_precios_archivos WHERE id=?`,
        [id]
      );
      if (!out.changes) return res.status(404).json({ error: 'Archivo no encontrado' });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'No se pudo eliminar el archivo de lista de precios' });
    }
  });

  app.post('/inventario/agregar', (req, res) => {
    const { codigo, nombre, proveedor, unidad, cantidad, costo, pendiente } = req.body;
    if (pendiente === true || pendiente === 1) {
      if (!nombre) return res.status(400).json({ error: 'Falta el nombre' });
      const codigoPendiente = codigo || (`PEND-${Date.now()}`);
      bdInventario.run(
        `INSERT INTO inventario (codigo, nombre, proveedor, unidad, cantidad_total, cantidad_disponible, costo_total, costo_por_unidad, pendiente)
         VALUES (?,?,?,?,?,?,?,?,1)`,
        [codigoPendiente, nombre, String(proveedor || '').trim(), unidad || '', 0, 0, 0, 0],
        function () {
          transmitir({ tipo: 'inventario_actualizado' });
          res.json({ ok: true, id: this.lastID });
        }
      );
      return;
    }

    const unidadNormalizada = normalizarUnidadInsumo(unidad);
    if (!codigo || !nombre || !unidadNormalizada || !Number.isFinite(cantidad) || !Number.isFinite(costo)) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    bdInventario.get('SELECT * FROM inventario WHERE codigo=?', [codigo], (e, insumo) => {
      if (!insumo) {
        const costoPorUnidad = cantidad > 0 ? costo / cantidad : 0;
        bdInventario.run(
          `INSERT INTO inventario (codigo, nombre, proveedor, unidad, cantidad_total, cantidad_disponible, costo_total, costo_por_unidad, pendiente)
           VALUES (?,?,?,?,?,?,?,?,0)`,
          [codigo, nombre, String(proveedor || '').trim(), unidadNormalizada, cantidad, cantidad, costo, costoPorUnidad],
          function () {
            const idInv = this.lastID;
            bdInventario.run(
              'INSERT INTO historial_inventario (id_inventario, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)',
              [idInv, new Date().toISOString(), cantidad, costo],
              () => {
                transmitir({ tipo: 'inventario_actualizado' });
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
          'UPDATE inventario SET nombre=?, proveedor=?, unidad=?, cantidad_total=?, cantidad_disponible=?, costo_total=?, costo_por_unidad=? WHERE id=?',
          [nombre, String(proveedor || insumo.proveedor || '').trim(), unidadNormalizada, nuevaCantidadTotal, nuevaCantidadDisponible, nuevoCostoTotal, costoPorUnidad, insumo.id],
          () => {
            bdInventario.run(
              'INSERT INTO historial_inventario (id_inventario, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)',
              [insumo.id, new Date().toISOString(), cantidad, costo],
              () => {
                transmitir({ tipo: 'inventario_actualizado' });
                res.json({ ok: true });
              }
            );
          }
        );
      }
    });
  });

  app.post('/inventario/aumentar', (req, res) => {
    const { id, cantidad, costo } = req.body;
    if (!id || !Number.isFinite(cantidad) || !Number.isFinite(costo) || cantidad <= 0 || costo < 0) {
      return res.status(400).json({ error: 'Datos incompletos o inválidos' });
    }

    bdInventario.get('SELECT * FROM inventario WHERE id=?', [id], (e, insumo) => {
      if (!insumo) return res.status(404).json({ error: 'Insumo no encontrado' });
      const nuevaCantidadTotal = (insumo.cantidad_total || 0) + cantidad;
      const nuevaCantidadDisponible = (insumo.cantidad_disponible || 0) + cantidad;
      const nuevoCostoTotal = (insumo.costo_total || 0) + costo;
      const costoPorUnidad = nuevaCantidadTotal > 0 ? nuevoCostoTotal / nuevaCantidadTotal : 0;

      bdInventario.run(
        'UPDATE inventario SET cantidad_total=?, cantidad_disponible=?, costo_total=?, costo_por_unidad=? WHERE id=?',
        [nuevaCantidadTotal, nuevaCantidadDisponible, nuevoCostoTotal, costoPorUnidad, id],
        () => {
          bdInventario.run(
            'INSERT INTO historial_inventario (id_inventario, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)',
            [id, new Date().toISOString(), cantidad, costo],
            () => {
              transmitir({ tipo: 'inventario_actualizado' });
              res.json({ ok: true });
            }
          );
        }
      );
    });
  });

  app.get('/inventario/:id/historial', (req, res) => {
    bdInventario.all(
      'SELECT fecha_cambio, cambio_cantidad, cambio_costo FROM historial_inventario WHERE id_inventario=? ORDER BY fecha_cambio DESC',
      [req.params.id],
      (e, r) => {
        if (e) return res.status(500).json({ error: 'Error al cargar historial' });
        res.json(r || []);
      }
    );
  });

  app.get('/inventario/historial/agrupar/fechas', (req, res) => {
    bdInventario.all(
      `SELECT substr(fecha_cambio, 1, 10) as fecha, COUNT(*) as total_insumos, COALESCE(SUM(cambio_costo), 0) as total_costo
       FROM historial_inventario GROUP BY substr(fecha_cambio, 1, 10) ORDER BY fecha DESC`,
      (err, dias) => {
        if (err) return res.status(500).json({ error: 'Error al agrupar historial' });
        if (!dias || dias.length === 0) return res.json([]);

        let pendientes = dias.length;
        const resultado = [];
        dias.forEach((dia) => {
          bdInventario.all(
            `SELECT h.id_inventario, h.fecha_cambio, time(h.fecha_cambio, 'localtime') as hora, h.cambio_cantidad, h.cambio_costo,
                    COALESCE(i.codigo, '') as codigo, COALESCE(i.nombre, 'Insumo eliminado') as nombre, COALESCE(i.unidad, '') as unidad
             FROM historial_inventario h
             LEFT JOIN inventario i ON i.id = h.id_inventario
             WHERE substr(h.fecha_cambio, 1, 10) = ?
             ORDER BY h.fecha_cambio DESC`,
            [dia.fecha],
            (errItems, items) => {
              resultado.push({ fecha: dia.fecha, total_insumos: dia.total_insumos || 0, total_costo: dia.total_costo || 0, insumos: errItems ? [] : (items || []) });
              pendientes -= 1;
              if (pendientes === 0) {
                resultado.sort((a, b) => b.fecha.localeCompare(a.fecha));
                res.json(resultado);
              }
            }
          );
        });
      }
    );
  });

  app.delete('/inventario/historial/fecha/:fecha', (req, res) => {
    const { fecha } = req.params;

    bdInventario.all(
      `SELECT id_inventario, COALESCE(SUM(cambio_cantidad), 0) as total_cantidad, COALESCE(SUM(cambio_costo), 0) as total_costo
       FROM historial_inventario
       WHERE substr(fecha_cambio, 1, 10) = ?
       GROUP BY id_inventario`,
      [fecha],
      (err, ajustes) => {
        if (err) return res.status(500).json({ error: 'Error al consultar historial' });

        const aplicarEliminacionHistorial = () => {
          bdInventario.run('DELETE FROM historial_inventario WHERE substr(fecha_cambio, 1, 10) = ?', [fecha], function (errDelete) {
            if (errDelete) return res.status(500).json({ error: 'Error al eliminar historial' });
            transmitir({ tipo: 'inventario_actualizado' });
            res.json({ ok: true, eliminados: this.changes || 0 });
          });
        };

        if (!ajustes || ajustes.length === 0) {
          aplicarEliminacionHistorial();
          return;
        }

        let pendientes = ajustes.length;
        ajustes.forEach((ajuste) => {
          bdInventario.get(
            'SELECT id, cantidad_total, cantidad_disponible, costo_total FROM inventario WHERE id = ?',
            [ajuste.id_inventario],
            (errInsumo, insumo) => {
              if (errInsumo || !insumo) {
                pendientes -= 1;
                if (pendientes === 0) aplicarEliminacionHistorial();
                return;
              }

              const nuevaCantidadTotal = Math.max(0, (Number(insumo.cantidad_total) || 0) - (Number(ajuste.total_cantidad) || 0));
              const nuevaCantidadDisponible = Math.max(0, (Number(insumo.cantidad_disponible) || 0) - (Number(ajuste.total_cantidad) || 0));
              const nuevoCostoTotal = Math.max(0, (Number(insumo.costo_total) || 0) - (Number(ajuste.total_costo) || 0));
              const costoPorUnidad = nuevaCantidadTotal > 0 ? (nuevoCostoTotal / nuevaCantidadTotal) : 0;

              bdInventario.run(
                'UPDATE inventario SET cantidad_total=?, cantidad_disponible=?, costo_total=?, costo_por_unidad=? WHERE id=?',
                [nuevaCantidadTotal, nuevaCantidadDisponible, nuevoCostoTotal, costoPorUnidad, insumo.id],
                () => {
                  pendientes -= 1;
                  if (pendientes === 0) aplicarEliminacionHistorial();
                }
              );
            }
          );
        });
      }
    );
  });

  app.get('/inventario/proveedores/pendientes', (req, res) => {
    bdInventario.all(
      "SELECT id, codigo, nombre, proveedor, unidad FROM inventario WHERE TRIM(COALESCE(proveedor, '')) = '' ORDER BY nombre",
      (errInsumos, insumos) => {
        if (errInsumos) return res.status(500).json({ error: 'Error cargando insumos pendientes' });
        bdInventario.all(
          "SELECT id, codigo, nombre, proveedor, unidad FROM utensilios WHERE TRIM(COALESCE(proveedor, '')) = '' ORDER BY nombre",
          (errUtensilios, utensilios) => {
            if (errUtensilios) return res.status(500).json({ error: 'Error cargando utensilios pendientes' });
            res.json({ insumos: insumos || [], utensilios: utensilios || [] });
          }
        );
      }
    );
  });

  app.get('/inventario/proveedores/fichas-pendientes', (req, res) => {
    bdInventario.all(
      `SELECT DISTINCT TRIM(proveedor) as nombre
       FROM (
         SELECT proveedor FROM inventario
         UNION ALL
         SELECT proveedor FROM utensilios
       ) src
       WHERE TRIM(COALESCE(proveedor, '')) <> ''
       ORDER BY nombre`,
      (errNombres, rowsNombres) => {
        if (errNombres) return res.status(500).json({ error: 'Error al cargar proveedores base' });

        bdInventario.all(
          `SELECT id, nombre, direccion, telefono, forma_pago, numero_cuenta, correo, notas
           FROM proveedores`,
          (errProv, rowsProv) => {
            if (errProv) return res.status(500).json({ error: 'Error al cargar proveedores registrados' });

            const mapa = new Map();
            (rowsProv || []).forEach((p) => {
              const clave = String(p?.nombre || '').trim().toLowerCase();
              if (clave) mapa.set(clave, p);
            });

            const pendientes = [];
            (rowsNombres || []).forEach((r) => {
              const nombre = String(r?.nombre || '').trim();
              if (!nombre) return;
              const existente = mapa.get(nombre.toLowerCase());
              const direccion = String(existente?.direccion || '').trim();
              const telefono = String(existente?.telefono || '').trim();
              const formaPagoRaw = String(existente?.forma_pago || '').trim();
              const numeroCuenta = String(existente?.numero_cuenta || '').trim();
              const correo = String(existente?.correo || '').trim();
              const notas = String(existente?.notas || '').trim();
              const formaPagoDerivada = formaPagoRaw || (['transferencia', 'tarjeta', 'efectivo', 'tarjeta/efectivo', 'interna'].includes(numeroCuenta.toLowerCase()) ? numeroCuenta : '');
              const requiereCuenta = formaPagoDerivada.toLowerCase() === 'transferencia';

              const incompleto = !existente || !direccion || !telefono || !correo || !formaPagoDerivada || (requiereCuenta && !numeroCuenta);
              if (!incompleto) return;

              pendientes.push({
                id: Number(existente?.id || 0) || null,
                nombre,
                direccion,
                telefono,
                forma_pago: formaPagoDerivada,
                numero_cuenta: numeroCuenta,
                correo,
                notas
              });
            });

            res.json({ pendientes });
          }
        );
      }
    );
  });

  app.patch('/inventario/:id/proveedor', (req, res) => {
    const id = Number(req.params.id);
    const proveedor = String(req.body?.proveedor || '').trim();
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
    if (!proveedor) return res.status(400).json({ error: 'Proveedor requerido' });
    bdInventario.run('UPDATE inventario SET proveedor=? WHERE id=?', [proveedor, id], function () {
      if (!this.changes) return res.status(404).json({ error: 'No encontrado' });
      transmitir({ tipo: 'inventario_actualizado' });
      res.json({ ok: true });
    });
  });

  app.get('/inventario/proveedores', (req, res) => {
    bdInventario.all(
      'SELECT id, nombre, direccion, telefono, forma_pago, numero_cuenta, correo, notas, creado_en, actualizado_en FROM proveedores ORDER BY nombre',
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error al cargar proveedores' });
        res.json(rows || []);
      }
    );
  });

  app.post('/inventario/proveedores', (req, res) => {
    const nombre = String(req.body?.nombre || '').trim();
    const direccion = String(req.body?.direccion || '').trim();
    const telefono = String(req.body?.telefono || '').trim();
    const formaPago = String(req.body?.forma_pago || '').trim();
    const numeroCuenta = String(req.body?.numero_cuenta || '').trim();
    const correo = String(req.body?.correo || '').trim();
    const notas = String(req.body?.notas || '').trim();
    if (!nombre) return res.status(400).json({ error: 'Nombre de proveedor requerido' });
    if (!formaPago) return res.status(400).json({ error: 'Forma de pago requerida' });
    const requiereCuenta = formaPago.toLowerCase() === 'transferencia';
    if (requiereCuenta && !numeroCuenta) return res.status(400).json({ error: 'Número de cuenta requerido para transferencia' });
    const numeroCuentaFinal = requiereCuenta ? numeroCuenta : '';

    bdInventario.run(
      `INSERT INTO proveedores (nombre, direccion, telefono, forma_pago, numero_cuenta, correo, notas, creado_en, actualizado_en)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [nombre, direccion, telefono, formaPago, numeroCuentaFinal, correo, notas, new Date().toISOString(), new Date().toISOString()],
      function (err) {
        if (err) return res.status(400).json({ error: 'No se pudo guardar proveedor' });
        res.json({ ok: true, id: this.lastID });
      }
    );
  });

  app.post('/inventario/proveedores/completar', (req, res) => {
    const nombre = String(req.body?.nombre || '').trim();
    const direccion = String(req.body?.direccion || '').trim();
    const telefono = String(req.body?.telefono || '').trim();
    const formaPago = String(req.body?.forma_pago || '').trim();
    const numeroCuenta = String(req.body?.numero_cuenta || '').trim();
    const correo = String(req.body?.correo || '').trim();
    const notas = String(req.body?.notas || '').trim();

    if (!nombre || !direccion || !telefono || !formaPago || !correo) {
      return res.status(400).json({ error: 'Debes completar nombre, dirección, teléfono, forma de pago y correo' });
    }
    const requiereCuenta = formaPago.toLowerCase() === 'transferencia';
    if (requiereCuenta && !numeroCuenta) {
      return res.status(400).json({ error: 'Debes capturar el número de cuenta para transferencia' });
    }
    const numeroCuentaFinal = requiereCuenta ? numeroCuenta : '';

    bdInventario.get('SELECT id FROM proveedores WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?))', [nombre], (errGet, row) => {
      if (errGet) return res.status(500).json({ error: 'No se pudo consultar proveedor' });

      if (row?.id) {
        bdInventario.run(
          `UPDATE proveedores
           SET nombre=?, direccion=?, telefono=?, forma_pago=?, numero_cuenta=?, correo=?, notas=?, actualizado_en=?
           WHERE id=?`,
          [nombre, direccion, telefono, formaPago, numeroCuentaFinal, correo, notas, new Date().toISOString(), row.id],
          function (errUpd) {
            if (errUpd) return res.status(400).json({ error: 'No se pudo actualizar proveedor' });
            res.json({ ok: true, id: row.id, actualizado: true });
          }
        );
        return;
      }

      bdInventario.run(
        `INSERT INTO proveedores (nombre, direccion, telefono, forma_pago, numero_cuenta, correo, notas, creado_en, actualizado_en)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [nombre, direccion, telefono, formaPago, numeroCuentaFinal, correo, notas, new Date().toISOString(), new Date().toISOString()],
        function (errIns) {
          if (errIns) return res.status(400).json({ error: 'No se pudo guardar proveedor' });
          res.json({ ok: true, id: this.lastID, actualizado: false });
        }
      );
    });
  });

  app.patch('/inventario/proveedores/:id', (req, res) => {
    const id = Number(req.params.id);
    const nombre = String(req.body?.nombre || '').trim();
    const direccion = String(req.body?.direccion || '').trim();
    const telefono = String(req.body?.telefono || '').trim();
    const formaPago = String(req.body?.forma_pago || '').trim();
    const numeroCuenta = String(req.body?.numero_cuenta || '').trim();
    const correo = String(req.body?.correo || '').trim();
    const notas = String(req.body?.notas || '').trim();
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
    if (!nombre) return res.status(400).json({ error: 'Nombre de proveedor requerido' });
    if (!formaPago) return res.status(400).json({ error: 'Forma de pago requerida' });
    const requiereCuenta = formaPago.toLowerCase() === 'transferencia';
    if (requiereCuenta && !numeroCuenta) return res.status(400).json({ error: 'Número de cuenta requerido para transferencia' });
    const numeroCuentaFinal = requiereCuenta ? numeroCuenta : '';

    bdInventario.get('SELECT id, nombre FROM proveedores WHERE id=?', [id], (errGet, actual) => {
      if (errGet) return res.status(500).json({ error: 'No se pudo consultar proveedor' });
      if (!actual) return res.status(404).json({ error: 'Proveedor no encontrado' });

      const nombreActual = String(actual?.nombre || '').trim();
      bdInventario.run(
        `UPDATE proveedores
         SET nombre=?, direccion=?, telefono=?, forma_pago=?, numero_cuenta=?, correo=?, notas=?, actualizado_en=?
         WHERE id=?`,
        [nombre, direccion, telefono, formaPago, numeroCuentaFinal, correo, notas, new Date().toISOString(), id],
        function (errUpd) {
          if (errUpd) return res.status(400).json({ error: 'No se pudo actualizar proveedor' });
          if (!this.changes) return res.status(404).json({ error: 'Proveedor no encontrado' });

          const nombreCambio = nombreActual && nombre && nombreActual.toLowerCase() !== nombre.toLowerCase();
          if (!nombreCambio) {
            transmitir({ tipo: 'inventario_actualizado' });
            return res.json({ ok: true });
          }

          bdInventario.run(
            "UPDATE inventario SET proveedor=? WHERE LOWER(TRIM(COALESCE(proveedor, ''))) = LOWER(TRIM(?))",
            [nombre, nombreActual],
            function () {
              const afectadosInventario = Number(this?.changes || 0);
              bdInventario.run(
                "UPDATE utensilios SET proveedor=? WHERE LOWER(TRIM(COALESCE(proveedor, ''))) = LOWER(TRIM(?))",
                [nombre, nombreActual],
                function () {
                  transmitir({ tipo: 'inventario_actualizado' });
                  res.json({ ok: true, actualizados: afectadosInventario + Number(this?.changes || 0) });
                }
              );
            }
          );
        }
      );
    });
  });

  app.get('/inventario/proveedores/:id/uso', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });

    bdInventario.get('SELECT id, nombre FROM proveedores WHERE id=?', [id], (errProv, proveedor) => {
      if (errProv) return res.status(500).json({ error: 'No se pudo consultar proveedor' });
      if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });

      const nombre = String(proveedor?.nombre || '').trim();
      bdInventario.get(
        "SELECT COUNT(*) AS total FROM inventario WHERE LOWER(TRIM(COALESCE(proveedor, ''))) = LOWER(TRIM(?))",
        [nombre],
        (errInv, rowInv) => {
          if (errInv) return res.status(500).json({ error: 'No se pudo validar uso en inventario' });

          bdInventario.get(
            "SELECT COUNT(*) AS total FROM utensilios WHERE LOWER(TRIM(COALESCE(proveedor, ''))) = LOWER(TRIM(?))",
            [nombre],
            (errUt, rowUt) => {
              if (errUt) return res.status(500).json({ error: 'No se pudo validar uso en utensilios' });
              const inventario = Number(rowInv?.total || 0);
              const utensilios = Number(rowUt?.total || 0);
              res.json({
                proveedor: { id: proveedor.id, nombre },
                uso: {
                  inventario,
                  utensilios,
                  total: inventario + utensilios
                }
              });
            }
          );
        }
      );
    });
  });

  app.delete('/inventario/proveedores/:id', (req, res) => {
    const id = Number(req.params.id);
    const reemplazoProveedor = String(req.body?.reemplazo_proveedor || '').trim();
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });

    bdInventario.get('SELECT id, nombre FROM proveedores WHERE id=?', [id], (errProv, proveedor) => {
      if (errProv) return res.status(500).json({ error: 'No se pudo consultar proveedor' });
      if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });

      const nombreProveedor = String(proveedor?.nombre || '').trim();
      bdInventario.get(
        "SELECT COUNT(*) AS total FROM inventario WHERE LOWER(TRIM(COALESCE(proveedor, ''))) = LOWER(TRIM(?))",
        [nombreProveedor],
        (errInv, rowInv) => {
          if (errInv) return res.status(500).json({ error: 'No se pudo validar uso en inventario' });

          bdInventario.get(
            "SELECT COUNT(*) AS total FROM utensilios WHERE LOWER(TRIM(COALESCE(proveedor, ''))) = LOWER(TRIM(?))",
            [nombreProveedor],
            (errUt, rowUt) => {
              if (errUt) return res.status(500).json({ error: 'No se pudo validar uso en utensilios' });

              const usoInventario = Number(rowInv?.total || 0);
              const usoUtensilios = Number(rowUt?.total || 0);
              const totalUso = usoInventario + usoUtensilios;

              if (totalUso > 0 && !reemplazoProveedor) {
                return res.status(409).json({
                  error: 'Este proveedor tiene insumos o utensilios asociados y requiere reasignación',
                  requiere_reasignacion: true,
                  proveedor: { id: proveedor.id, nombre: nombreProveedor },
                  uso: { inventario: usoInventario, utensilios: usoUtensilios, total: totalUso }
                });
              }

              if (reemplazoProveedor && reemplazoProveedor.toLowerCase() === nombreProveedor.toLowerCase()) {
                return res.status(400).json({ error: 'Selecciona un proveedor distinto para reasignar' });
              }

              const eliminarProveedor = () => {
                bdInventario.run('DELETE FROM proveedores WHERE id=?', [id], function (errDel) {
                  if (errDel) return res.status(400).json({ error: 'No se pudo eliminar proveedor' });
                  if (!this.changes) return res.status(404).json({ error: 'Proveedor no encontrado' });
                  transmitir({ tipo: 'inventario_actualizado' });
                  res.json({ ok: true, reasignados: totalUso });
                });
              };

              if (!totalUso) {
                eliminarProveedor();
                return;
              }

              bdInventario.get(
                'SELECT id, nombre FROM proveedores WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?))',
                [reemplazoProveedor],
                (errDestino, proveedorDestino) => {
                  if (errDestino) return res.status(500).json({ error: 'No se pudo validar proveedor destino' });
                  if (!proveedorDestino) return res.status(400).json({ error: 'Proveedor destino no encontrado' });

                  const nombreDestino = String(proveedorDestino?.nombre || '').trim();
                  bdInventario.run(
                    "UPDATE inventario SET proveedor=? WHERE LOWER(TRIM(COALESCE(proveedor, ''))) = LOWER(TRIM(?))",
                    [nombreDestino, nombreProveedor],
                    () => {
                      bdInventario.run(
                        "UPDATE utensilios SET proveedor=? WHERE LOWER(TRIM(COALESCE(proveedor, ''))) = LOWER(TRIM(?))",
                        [nombreDestino, nombreProveedor],
                        () => eliminarProveedor()
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });

  app.get('/inventario/proveedores/catalogo', (req, res) => {
    const nombres = new Set();
    bdInventario.all('SELECT nombre FROM proveedores', (errProv, rowsProv) => {
      if (!errProv && Array.isArray(rowsProv)) {
        rowsProv.forEach((row) => {
          const nombre = String(row?.nombre || '').trim();
          if (nombre) nombres.add(nombre);
        });
      }
      bdInventario.all("SELECT DISTINCT proveedor FROM inventario WHERE TRIM(COALESCE(proveedor, '')) <> ''", (errInv, rowsInv) => {
        if (!errInv && Array.isArray(rowsInv)) {
          rowsInv.forEach((row) => {
            const nombre = String(row?.proveedor || '').trim();
            if (nombre) nombres.add(nombre);
          });
        }
        bdInventario.all("SELECT DISTINCT proveedor FROM utensilios WHERE TRIM(COALESCE(proveedor, '')) <> ''", (errUt, rowsUt) => {
          if (!errUt && Array.isArray(rowsUt)) {
            rowsUt.forEach((row) => {
              const nombre = String(row?.proveedor || '').trim();
              if (nombre) nombres.add(nombre);
            });
          }
          const lista = Array.from(nombres).sort((a, b) => String(a).localeCompare(String(b), 'es', { sensitivity: 'base' }));
          res.json({ proveedores: lista });
        });
      });
    });
  });

  app.get('/inventario/:id', (req, res) => {
    bdInventario.get(
      'SELECT id, codigo, nombre, proveedor, unidad, cantidad_total, cantidad_disponible, costo_total, costo_por_unidad, pendiente FROM inventario WHERE id=?',
      [req.params.id],
      (e, r) => {
        if (!r) return res.status(404).json({ error: 'No encontrado' });
        res.json({ ...r, unidad: normalizarUnidadInsumo(r.unidad) });
      }
    );
  });

  app.patch('/inventario/:id', (req, res) => {
    const { nombre, proveedor, unidad, cantidad_total, costo_total, codigo } = req.body;
    const id = req.params.id;
    const unidadNormalizada = normalizarUnidadInsumo(unidad);

    bdInventario.get('SELECT * FROM inventario WHERE id=?', [id], (e, insumo) => {
      if (!insumo) return res.status(404).json({ error: 'No encontrado' });

      const nuevaCantidadTotal = Number(cantidad_total) || 0;
      const nuevoCostoTotal = Number(costo_total) || 0;
      const deltaCantidad = nuevaCantidadTotal - (insumo.cantidad_total || 0);
      const deltaCosto = nuevoCostoTotal - (insumo.costo_total || 0);
      const nuevaDisponible = Math.max(0, (insumo.cantidad_disponible || 0) + deltaCantidad);
      const costoPorUnidad = nuevaCantidadTotal > 0 ? nuevoCostoTotal / nuevaCantidadTotal : 0;

      let updateQuery;
      let updateParams;
      if (insumo.pendiente && codigo && codigo !== insumo.codigo) {
        updateQuery = 'UPDATE inventario SET codigo=?, nombre=?, proveedor=?, unidad=?, cantidad_total=?, cantidad_disponible=?, costo_total=?, costo_por_unidad=?, pendiente=0 WHERE id=?';
        updateParams = [codigo, nombre, String(proveedor || '').trim(), unidadNormalizada, nuevaCantidadTotal, nuevaDisponible, nuevoCostoTotal, costoPorUnidad, id];
      } else {
        updateQuery = 'UPDATE inventario SET nombre=?, proveedor=?, unidad=?, cantidad_total=?, cantidad_disponible=?, costo_total=?, costo_por_unidad=? WHERE id=?';
        updateParams = [nombre, String(proveedor || '').trim(), unidadNormalizada, nuevaCantidadTotal, nuevaDisponible, nuevoCostoTotal, costoPorUnidad, id];
      }

      bdInventario.run(updateQuery, updateParams, () => {
        const nombreFinal = String(nombre || '').trim();
        const proveedorFinal = String(proveedor || '').trim();

        const finalizar = () => {
          transmitir({ tipo: 'inventario_actualizado' });
          res.json({ ok: true });
        };

        const sincronizar = () => sincronizarIngredienteReceta(id, nombreFinal, proveedorFinal, () => finalizar());

        if (deltaCantidad !== 0 || deltaCosto !== 0) {
          bdInventario.run(
            'INSERT INTO historial_inventario (id_inventario, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)',
            [id, new Date().toISOString(), deltaCantidad, deltaCosto],
            () => sincronizar()
          );
        } else {
          sincronizar();
        }
      });
    });
  });

  app.delete('/inventario/:id', (req, res) => {
    const id = req.params.id;
    bdInventario.get('SELECT id, codigo, nombre, unidad FROM inventario WHERE id=?', [id], (errGet, insumo) => {
      const continuarEliminacion = () => {
        bdInventario.run('DELETE FROM inventario WHERE id=?', [id], () => {
          bdInventario.run('DELETE FROM historial_inventario WHERE id_inventario=?', [id], () => {
            transmitir({ tipo: 'inventario_actualizado' });
            res.json({ ok: true });
          });
        });
      };

      if (errGet || !insumo) {
        continuarEliminacion();
        return;
      }

      bdInventario.run('DELETE FROM insumos_eliminados WHERE id_inventario=?', [id], () => {
        bdInventario.run(
          'INSERT INTO insumos_eliminados (id_inventario, codigo, nombre, unidad, eliminado_en) VALUES (?,?,?,?,?)',
          [insumo.id, insumo.codigo || '', insumo.nombre || '', insumo.unidad || '', new Date().toISOString()],
          () => continuarEliminacion()
        );
      });
    });
  });
}
