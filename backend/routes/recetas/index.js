import { transmitir, convertirCantidad } from "../../utils/index.js";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "sqlite3";

const { Database, OPEN_READONLY } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupDir = process.env.NODE_ENV === 'production'
  ? '/opt/render/data/backend/backups'
  : path.join(__dirname, '../../backups');

function buscarNombreEnBackup(idInsumo, callback) {
  fs.readdir(backupDir)
    .then((files) => {
      const candidatos = (files || [])
        .filter((f) => /^inventario\.db\..+\.backup$/i.test(f))
        .sort()
        .reverse();

      if (!candidatos.length) {
        callback('');
        return;
      }

      const rutaBackup = path.join(backupDir, candidatos[0]);
      const dbBackup = new Database(rutaBackup, OPEN_READONLY, (errOpen) => {
        if (errOpen) {
          callback('');
          return;
        }

        dbBackup.get("SELECT nombre FROM inventario WHERE id=?", [idInsumo], (errGet, row) => {
          const nombre = !errGet && row && row.nombre ? String(row.nombre).trim() : '';
          dbBackup.close(() => callback(nombre));
        });
      });
    })
    .catch(() => callback(''));
}

function resolverNombreInsumoEliminado(bdInventario, idInsumo, callback) {
  bdInventario.get("SELECT nombre FROM insumos_eliminados WHERE id_inventario=?", [idInsumo], (err, row) => {
    const nombre = !err && row && row.nombre ? String(row.nombre).trim() : '';
    if (nombre) {
      callback(nombre);
      return;
    }

    buscarNombreEnBackup(idInsumo, (nombreBackup) => {
      const limpio = String(nombreBackup || '').trim();
      if (limpio) {
        bdInventario.run(
          `INSERT INTO insumos_eliminados (id_inventario, codigo, nombre, unidad, eliminado_en)
           VALUES (?,?,?,?,?)
           ON CONFLICT(id_inventario) DO UPDATE SET
             codigo=excluded.codigo,
             nombre=excluded.nombre,
             unidad=excluded.unidad,
             eliminado_en=excluded.eliminado_en`,
          [idInsumo, '', limpio, '', new Date().toISOString()],
          () => callback(limpio)
        );
        return;
      }
      callback('');
    });
  });
}

export function registrarRutasRecetas(app, bdRecetas, bdInventario) {
  const textoPlano = (valor) => String(valor || '').trim();
  const PREFIJO_ORDEN_COMPRA = 'ORCHI';

  const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    bdInventario.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ changes: this?.changes || 0, lastID: this?.lastID || 0 });
    });
  });

  const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    bdInventario.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
  });

  const dbGetRecetas = (sql, params = []) => new Promise((resolve, reject) => {
    bdRecetas.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
  });

  const dbRunRecetas = (sql, params = []) => new Promise((resolve, reject) => {
    bdRecetas.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ changes: this?.changes || 0, lastID: this?.lastID || 0 });
    });
  });

  async function actualizarListaPreciosOrden({
    tipoItem,
    idReferencia,
    codigo,
    nombre,
    proveedor,
    unidad,
    cantidadReferencia,
    precioUnitario,
    costoTotal,
    fechaEvento
  }) {
    const precio = Number(precioUnitario || 0);
    const cantidad = Number(cantidadReferencia || 0);
    const costo = Number(costoTotal || 0);
    if (!Number.isFinite(cantidad) || cantidad <= 0) return;
    if (!Number.isFinite(precio) || precio <= 0) return;

    const tipo = String(tipoItem || 'insumo').toLowerCase() === 'utensilio' ? 'utensilio' : 'insumo';
    const idRef = Number(idReferencia || 0);
    const codigoLimpio = String(codigo || '').trim();
    const nombreLimpio = String(nombre || '').trim();
    const unidadLimpia = String(unidad || '').trim();
    const proveedorLimpio = String(proveedor || '').trim();
    const ahora = String(fechaEvento || new Date().toISOString());

    const existente = await dbGet(
      `SELECT *
       FROM lista_precios_ordenes
       WHERE COALESCE(activo, 1)=1
         AND tipo_item=?
         AND (
           (COALESCE(id_referencia, 0) > 0 AND id_referencia = ?)
           OR (
             LOWER(COALESCE(codigo, '')) = LOWER(?)
             AND LOWER(COALESCE(nombre, '')) = LOWER(?)
           )
         )
         AND LOWER(COALESCE(unidad, '')) = LOWER(?)
         AND ABS(COALESCE(cantidad_referencia, 0) - ?) < 0.000001
       ORDER BY id DESC
       LIMIT 1`,
      [tipo, idRef, codigoLimpio, nombreLimpio, unidadLimpia, cantidad]
    );

    if (!existente) {
      const nuevo = await dbRun(
        `INSERT INTO lista_precios_ordenes
         (tipo_item, id_referencia, codigo, nombre, proveedor, unidad, cantidad_referencia, precio_unitario, costo_total_referencia, vigente_desde, vigente_hasta, ultima_compra_en, activo, creado_en, actualizado_en)
         VALUES (?,?,?,?,?,?,?,?,?,?,NULL,?,1,?,?)`,
        [
          tipo,
          idRef > 0 ? idRef : null,
          codigoLimpio,
          nombreLimpio,
          proveedorLimpio,
          unidadLimpia,
          cantidad,
          precio,
          costo,
          ahora,
          ahora,
          ahora,
          ahora
        ]
      );

      await dbRun(
        `INSERT INTO historial_lista_precios_ordenes
         (id_lista_precio, precio_unitario, costo_total_referencia, vigente_desde, vigente_hasta, motivo, registrado_en)
         VALUES (?,?,?,?,NULL,?,?)`,
        [nuevo.lastID, precio, costo, ahora, 'alta_desde_orden_compra', ahora]
      );
      return;
    }

    const precioActual = Number(existente?.precio_unitario || 0);
    const costoActual = Number(existente?.costo_total_referencia || 0);
    const cambioPrecio = Math.abs(precioActual - precio) > 0.000001 || Math.abs(costoActual - costo) > 0.000001;

    if (!cambioPrecio) {
      await dbRun(
        `UPDATE lista_precios_ordenes
         SET proveedor=?, ultima_compra_en=?, actualizado_en=?
         WHERE id=?`,
        [proveedorLimpio, ahora, ahora, existente.id]
      );
      return;
    }

    await dbRun(
      `UPDATE historial_lista_precios_ordenes
       SET vigente_hasta=?
       WHERE id_lista_precio=? AND vigente_hasta IS NULL`,
      [ahora, existente.id]
    );

    await dbRun(
      `INSERT INTO historial_lista_precios_ordenes
       (id_lista_precio, precio_unitario, costo_total_referencia, vigente_desde, vigente_hasta, motivo, registrado_en)
       VALUES (?,?,?,?,NULL,?,?)`,
      [existente.id, precio, costo, ahora, 'actualizacion_desde_orden_compra', ahora]
    );

    await dbRun(
      `UPDATE lista_precios_ordenes
       SET proveedor=?, precio_unitario=?, costo_total_referencia=?, vigente_desde=?, vigente_hasta=NULL, ultima_compra_en=?, actualizado_en=?
       WHERE id=?`,
      [proveedorLimpio, precio, costo, ahora, ahora, ahora, existente.id]
    );
  }

  const generarNumeroOrdenCompra = (callback) => {
    bdInventario.get(
      `SELECT numero_orden
       FROM ordenes_compra
       WHERE numero_orden LIKE ?
       ORDER BY numero_orden DESC
       LIMIT 1`,
      [`${PREFIJO_ORDEN_COMPRA}%`],
      (err, row) => {
        if (err) {
          callback(`${PREFIJO_ORDEN_COMPRA}000001`);
          return;
        }
        const actual = String(row?.numero_orden || '').trim();
        const match = actual.match(/^ORCHI(\d+)$/);
        const consecutivo = match ? (Number(match[1]) || 0) + 1 : 1;
        callback(`${PREFIJO_ORDEN_COMPRA}${String(consecutivo).padStart(6, '0')}`);
      }
    );
  };

  const cerrarOrdenSiCompleta = (idOrden) => {
    bdInventario.get(
      "SELECT COUNT(*) AS pendientes FROM ordenes_compra_items WHERE id_orden=? AND surtido=0",
      [idOrden],
      (err, row) => {
        if (err || !row) return;
        if (Number(row.pendientes) > 0) return;
        bdInventario.run(
          "UPDATE ordenes_compra SET estado='surtida', fecha_surtida=? WHERE id=?",
          [new Date().toISOString(), idOrden],
          () => transmitir({ tipo: "inventario_actualizado" })
        );
      }
    );
  };

  app.get("/recetas", (req, res) => {
    const idCategoria = req.query.categoria || "";
    const archivadas = req.query.archivadas === "1";
    const where = ["r.archivada = ?"];
    const params = [archivadas ? 1 : 0];
    if (idCategoria) {
      where.push("r.id_categoria = ?");
      params.push(idCategoria);
    }
    const sql = `SELECT r.*, c.nombre as categoria FROM recetas r LEFT JOIN categorias c ON r.id_categoria = c.id WHERE ${where.join(" AND ")} ORDER BY r.nombre`;
    bdRecetas.all(sql, params, (e, r) => res.json(r || []));
  });

  app.post("/recetas/ordenes-compra", (req, res) => {
    const proveedor = String(req.body?.proveedor || '').trim();
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: "Debes enviar al menos un insumo" });

    const fechaCreacion = new Date().toISOString();

    generarNumeroOrdenCompra((numeroOrden) => {
      bdInventario.run(
        "INSERT INTO ordenes_compra (numero_orden, proveedor, fecha_creacion, estado, fecha_surtida) VALUES (?,?,?,?,NULL)",
        [numeroOrden, proveedor, fechaCreacion, 'pendiente'],
        function () {
        const idOrden = this.lastID;
        let pendientes = items.length;
        if (!pendientes) return res.json({ ok: true, id: idOrden, numero_orden: numeroOrden });

        items.forEach((item) => {
          const tipoItem = String(item?.tipo_item || 'insumo').toLowerCase() === 'utensilio' ? 'utensilio' : 'insumo';
          const idInventario = tipoItem === 'insumo' ? Number(item.id_inventario) : null;
          const idUtensilio = tipoItem === 'utensilio' ? Number(item.id_utensilio || item.id_inventario) : null;
          const cantidad = Number(item.cantidad_requerida) || 0;
          const precioSolicitado = Number(item.precio_unitario) || 0;
          const codigo = String(item.codigo || '').trim();
          const nombre = String(item.nombre || '').trim();

          const resolverPrecio = (callback) => {
            if (precioSolicitado > 0) return callback(precioSolicitado);
            if (tipoItem === 'utensilio' && Number.isFinite(idUtensilio)) {
              return bdInventario.get("SELECT costo_por_unidad FROM utensilios WHERE id=?", [idUtensilio], (errU, rowU) => {
                callback(!errU && rowU ? Number(rowU.costo_por_unidad) || 0 : 0);
              });
            }
            if (tipoItem === 'insumo' && Number.isFinite(idInventario)) {
              return bdInventario.get("SELECT costo_por_unidad FROM inventario WHERE id=?", [idInventario], (errI, rowI) => {
                callback(!errI && rowI ? Number(rowI.costo_por_unidad) || 0 : 0);
              });
            }
            callback(0);
          };

          resolverPrecio((precioUnitarioFinal) => {
            bdInventario.run(
              `INSERT INTO ordenes_compra_items
               (id_orden, tipo_item, id_inventario, id_utensilio, codigo, nombre, cantidad_requerida, cantidad_surtida, precio_unitario, costo_total_surtido, surtido)
               VALUES (?,?,?,?,?,?,?,?,?,?,0)`,
              [
                idOrden,
                tipoItem,
                Number.isFinite(idInventario) ? idInventario : null,
                Number.isFinite(idUtensilio) ? idUtensilio : null,
                codigo,
                nombre,
                cantidad,
                0,
                Number(precioUnitarioFinal) || 0,
                0
              ],
              () => {
                pendientes -= 1;
                if (pendientes === 0) {
                  transmitir({
                    tipo: "orden_compra_nueva",
                    id_orden: idOrden,
                    numero_orden: numeroOrden,
                    proveedor: proveedor || "Sin proveedor",
                    total_items: items.length
                  });
                  transmitir({ tipo: "inventario_actualizado" });
                  res.json({ ok: true, id: idOrden, numero_orden: numeroOrden });
                }
              }
            );
          });
        });
        }
      );
    });
  });

  app.get("/recetas/ordenes-compra", (req, res) => {
    bdInventario.all(
      "SELECT id, numero_orden, proveedor, fecha_creacion, estado, fecha_surtida FROM ordenes_compra ORDER BY fecha_creacion DESC",
      (errOrdenes, ordenes) => {
        if (errOrdenes) return res.status(500).json({ error: "Error al cargar órdenes" });
        const lista = Array.isArray(ordenes) ? ordenes : [];
        if (!lista.length) return res.json([]);

        let pendientes = lista.length;
        const salida = [];

        lista.forEach((orden) => {
          bdInventario.all(
            "SELECT id, tipo_item, id_inventario, id_utensilio, codigo, nombre, cantidad_requerida, cantidad_surtida, precio_unitario, costo_total_surtido, surtido FROM ordenes_compra_items WHERE id_orden=? ORDER BY nombre",
            [orden.id],
            (errItems, items) => {
              salida.push({ ...orden, items: items || [] });
              pendientes -= 1;
              if (pendientes === 0) {
                salida.sort((a, b) => String(b.fecha_creacion || '').localeCompare(String(a.fecha_creacion || '')));
                res.json(salida);
              }
            }
          );
        });
      }
    );
  });

  app.delete("/recetas/ordenes-compra/:id", (req, res) => {
    const idOrden = Number(req.params.id);
    if (!Number.isFinite(idOrden) || idOrden <= 0) {
      return res.status(400).json({ error: "Orden inválida" });
    }

    bdInventario.get(
      "SELECT id, numero_orden FROM ordenes_compra WHERE id=?",
      [idOrden],
      (errOrden, orden) => {
        if (errOrden) return res.status(500).json({ error: "Error al buscar orden" });
        if (!orden) return res.status(404).json({ error: "Orden no encontrada" });

        bdInventario.get(
          `SELECT COUNT(*) AS surtidos
           FROM ordenes_compra_items
           WHERE id_orden=? AND (COALESCE(cantidad_surtida, 0) > 0 OR COALESCE(surtido, 0) = 1)`,
          [idOrden],
          (errCount, row) => {
            if (errCount) return res.status(500).json({ error: "Error al validar orden" });
            if (Number(row?.surtidos || 0) > 0) {
              return res.status(400).json({
                error: "No se puede eliminar la orden porque ya tiene insumos surtidos"
              });
            }

            bdInventario.run("DELETE FROM ordenes_compra_items WHERE id_orden=?", [idOrden], (errItems) => {
              if (errItems) return res.status(500).json({ error: "Error al eliminar items de la orden" });

              bdInventario.run("DELETE FROM ordenes_compra WHERE id=?", [idOrden], function (errDelete) {
                if (errDelete) return res.status(500).json({ error: "Error al eliminar orden" });
                if (!this.changes) return res.status(404).json({ error: "Orden no encontrada" });

                transmitir({
                  tipo: "orden_compra_eliminada",
                  id_orden: idOrden,
                  numero_orden: orden.numero_orden || ''
                });
                transmitir({ tipo: "inventario_actualizado" });
                res.json({ ok: true });
              });
            });
          }
        );
      }
    );
  });

  app.patch("/recetas/ordenes-compra/items/:id/cantidad", (req, res) => {
    const idItem = Number(req.params.id);
    const cantidadRequerida = Number(req.body?.cantidad_requerida);
    const precioUnitarioRaw = req.body?.precio_unitario;
    const actualizarPrecio = Number.isFinite(Number(precioUnitarioRaw)) && Number(precioUnitarioRaw) >= 0;
    if (!Number.isFinite(idItem) || idItem <= 0) return res.status(400).json({ error: "Item inválido" });
    if (!Number.isFinite(cantidadRequerida) || cantidadRequerida <= 0) return res.status(400).json({ error: "Cantidad inválida" });

    const sql = actualizarPrecio
      ? "UPDATE ordenes_compra_items SET cantidad_requerida=?, precio_unitario=? WHERE id=? AND surtido=0"
      : "UPDATE ordenes_compra_items SET cantidad_requerida=? WHERE id=? AND surtido=0";
    const params = actualizarPrecio
      ? [cantidadRequerida, Number(precioUnitarioRaw), idItem]
      : [cantidadRequerida, idItem];

    bdInventario.run(sql, params, function () {
      if (!this.changes) return res.status(404).json({ error: "Item no encontrado o ya surtido" });
      transmitir({ tipo: "inventario_actualizado" });
      res.json({ ok: true });
    });
  });

  app.post("/recetas/ordenes-compra/items/:id/surtir", (req, res) => {
    const idItem = Number(req.params.id);
    const cantidadSurtidaInput = Number(req.body?.cantidad_surtida);
    const costoTotalInput = Number(req.body?.costo_total);
    if (!Number.isFinite(idItem) || idItem <= 0) return res.status(400).json({ error: "Item inválido" });

    bdInventario.get(
      "SELECT * FROM ordenes_compra_items WHERE id=?",
      [idItem],
      (errItem, item) => {
        if (errItem || !item) return res.status(404).json({ error: "Item no encontrado" });
        if (Number(item.surtido) === 1) return res.status(400).json({ error: "El item ya fue surtido" });

        const cantidadSurtida = Number.isFinite(cantidadSurtidaInput) && cantidadSurtidaInput > 0
          ? cantidadSurtidaInput
          : (Number(item.cantidad_requerida) || 0);
        if (!Number.isFinite(cantidadSurtida) || cantidadSurtida <= 0) {
          return res.status(400).json({ error: "Cantidad a surtir inválida" });
        }

        const precioUnitarioBase = Number(item.precio_unitario) || 0;
        const costoTotal = Number.isFinite(costoTotalInput) && costoTotalInput > 0
          ? costoTotalInput
          : (cantidadSurtida * precioUnitarioBase);
        const precioUnitarioFinal = cantidadSurtida > 0 ? (costoTotal / cantidadSurtida) : precioUnitarioBase;

        const tipoItem = String(item.tipo_item || 'insumo').toLowerCase() === 'utensilio' ? 'utensilio' : 'insumo';
        const idReferencia = tipoItem === 'utensilio' ? Number(item.id_utensilio) : Number(item.id_inventario);
        if (!Number.isFinite(idReferencia) || idReferencia <= 0) {
          return res.status(400).json({ error: "El item no tiene referencia válida" });
        }

        const tabla = tipoItem === 'utensilio' ? 'utensilios' : 'inventario';
        const campoCantidadDisponible = tipoItem === 'utensilio' ? null : 'cantidad_disponible';
        const campoId = 'id';

        bdInventario.get(`SELECT * FROM ${tabla} WHERE ${campoId}=?`, [idReferencia], (errRef, ref) => {
          if (errRef || !ref) return res.status(404).json({ error: "Referencia no encontrada" });

          const nuevaCantidadTotal = (Number(ref.cantidad_total) || 0) + cantidadSurtida;
          const nuevoCostoTotal = (Number(ref.costo_total) || 0) + costoTotal;
          const nuevoCostoUnidad = nuevaCantidadTotal > 0 ? (nuevoCostoTotal / nuevaCantidadTotal) : 0;

          const ejecutarHistorial = () => {
            if (tipoItem === 'utensilio') {
              bdInventario.run(
                "INSERT INTO historial_utensilios (id_utensilio, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)",
                [idReferencia, new Date().toISOString(), cantidadSurtida, costoTotal]
              );
            } else {
              bdInventario.run(
                "INSERT INTO historial_inventario (id_inventario, fecha_cambio, cambio_cantidad, cambio_costo) VALUES (?,?,?,?)",
                [idReferencia, new Date().toISOString(), cantidadSurtida, costoTotal]
              );
            }
          };

          const onInventarioActualizado = () => {
            bdInventario.run(
              "UPDATE ordenes_compra_items SET cantidad_surtida=?, precio_unitario=?, costo_total_surtido=?, surtido=1 WHERE id=?",
              [cantidadSurtida, precioUnitarioFinal, costoTotal, idItem],
              async () => {
                try {
                  await actualizarListaPreciosOrden({
                    tipoItem,
                    idReferencia,
                    codigo: item?.codigo,
                    nombre: item?.nombre,
                    proveedor: item?.proveedor || ref?.proveedor || '',
                    unidad: ref?.unidad || item?.unidad || '',
                    cantidadReferencia: cantidadSurtida,
                    precioUnitario: precioUnitarioFinal,
                    costoTotal,
                    fechaEvento: new Date().toISOString()
                  });
                } catch {
                  // Si falla la actualización del catálogo de precios, no bloquea el surtido.
                }
                cerrarOrdenSiCompleta(item.id_orden);
                transmitir({ tipo: "inventario_actualizado" });
                res.json({ ok: true });
              }
            );
          };

          if (tipoItem === 'utensilio') {
            bdInventario.run(
              "UPDATE utensilios SET cantidad_total=?, costo_total=?, costo_por_unidad=? WHERE id=?",
              [nuevaCantidadTotal, nuevoCostoTotal, nuevoCostoUnidad, idReferencia],
              () => {
                ejecutarHistorial();
                onInventarioActualizado();
              }
            );
            return;
          }

          const nuevaDisponible = (Number(ref.cantidad_disponible) || 0) + cantidadSurtida;
          bdInventario.run(
            "UPDATE inventario SET cantidad_total=?, cantidad_disponible=?, costo_total=?, costo_por_unidad=? WHERE id=?",
            [nuevaCantidadTotal, nuevaDisponible, nuevoCostoTotal, nuevoCostoUnidad, idReferencia],
            () => {
              ejecutarHistorial();
              onInventarioActualizado();
            }
          );
        });
      }
    );
  });

  app.get("/recetas/:id", (req, res) => {
    const id = req.params.id;
    bdRecetas.get("SELECT * FROM recetas WHERE id=?", [id], (e, receta) => {
      if (!receta) return res.status(404).json({ error: "No encontrada" });
      bdRecetas.all(
        `SELECT ir.id, ir.id_insumo, ir.nombre_insumo, ir.proveedor, ir.cantidad, ir.unidad
         FROM ingredientes_receta ir
         WHERE ir.id_receta=?`,
        [id],
        (err, ingredientes) => {
          if (!ingredientes || ingredientes.length === 0) {
            receta.ingredientes = [];
            return res.json(receta);
          }
          // Obtener nombres y pendiente de insumos desde la otra BD
          let pendientes = ingredientes.length;
          ingredientes.forEach(ing => {
            bdInventario.get(
              "SELECT nombre, proveedor, pendiente FROM inventario WHERE id=?",
              [ing.id_insumo],
              (errInv, insumo) => {
                const finalizar = () => {
                  pendientes--;
                  if (pendientes === 0) {
                    receta.ingredientes = ingredientes;
                    res.json(receta);
                  }
                };

                const nombreGuardado = String(ing.nombre_insumo || '').trim();
                const proveedorGuardado = String(ing.proveedor || '').trim();
                if (insumo) {
                  const nombreActual = String(insumo.nombre || '').trim() || nombreGuardado || 'Insumo';
                  const proveedorActual = String(insumo.proveedor || '').trim() || proveedorGuardado;
                  ing.nombre = nombreActual;
                  ing.proveedor = proveedorActual;
                  ing.pendiente = insumo.pendiente === 1 || insumo.pendiente === true;
                  ing.eliminado = false;
                  const nombreDesactualizado = nombreActual && nombreGuardado !== nombreActual;
                  const proveedorDesactualizado = proveedorGuardado !== proveedorActual;
                  if (nombreDesactualizado || proveedorDesactualizado) {
                    bdRecetas.run(
                      "UPDATE ingredientes_receta SET nombre_insumo=?, proveedor=? WHERE id=?",
                      [nombreActual, proveedorActual, ing.id]
                    );
                  }
                  finalizar();
                  return;
                }

                const aplicarNombreEliminado = (nombreEliminado) => {
                  const etiqueta = String(nombreEliminado || nombreGuardado || '').trim();
                  ing.nombre = etiqueta ? `Insumo eliminado (${etiqueta})` : 'Insumo eliminado (sin nombre)';
                  ing.pendiente = true;
                  ing.eliminado = true;
                  if (etiqueta && !nombreGuardado) {
                    bdRecetas.run("UPDATE ingredientes_receta SET nombre_insumo=? WHERE id=?", [etiqueta, ing.id]);
                  }
                  finalizar();
                };

                if (nombreGuardado) {
                  aplicarNombreEliminado(nombreGuardado);
                  return;
                }

                resolverNombreInsumoEliminado(bdInventario, ing.id_insumo, aplicarNombreEliminado);
              }
            );
          });
        }
      );
    });
  });

  app.post("/recetas", (req, res) => {
    const {
      nombre,
      id_categoria,
      gramaje,
      ingredientes,
      tienda_descripcion,
      tienda_modo_uso,
      tienda_cuidados,
      tienda_ingredientes,
      tienda_precio_publico,
      tienda_image_url,
      tienda_galeria
    } = req.body;
    if (!nombre || !id_categoria) return res.status(400).json({ error: "Datos incompletos" });

    bdRecetas.run(
      `INSERT INTO recetas
       (nombre, id_categoria, gramaje, archivada, tienda_descripcion, tienda_modo_uso, tienda_cuidados, tienda_ingredientes, tienda_precio_publico, tienda_image_url, tienda_galeria)
       VALUES (?,?,?,0,?,?,?,?,?,?,?)`,
      [
        nombre,
        id_categoria,
        gramaje || 0,
        textoPlano(tienda_descripcion),
        textoPlano(tienda_modo_uso),
        textoPlano(tienda_cuidados),
        textoPlano(tienda_ingredientes),
        Number(tienda_precio_publico) || 0,
        textoPlano(tienda_image_url),
        JSON.stringify(Array.isArray(tienda_galeria) ? tienda_galeria.map((item) => textoPlano(item)).filter(Boolean) : [])
      ],
      function () {
        const idReceta = this.lastID;
        const lista = Array.isArray(ingredientes) ? ingredientes : [];
        if (lista.length === 0) {
          transmitir({ tipo: "recetas_actualizado" });
          return res.json({ ok: true, id: idReceta });
        }

        let pendientes = lista.length;
        lista.forEach(ing => {
          bdRecetas.run(
            "INSERT INTO ingredientes_receta (id_receta, id_insumo, nombre_insumo, proveedor, cantidad, unidad) VALUES (?,?,?,?,?,?)",
            [idReceta, ing.id_insumo, ing.nombre || '', String(ing.proveedor || '').trim(), ing.cantidad, ing.unidad],
            () => {
              pendientes--;
              if (pendientes === 0) {
                transmitir({ tipo: "recetas_actualizado" });
                res.json({ ok: true, id: idReceta });
              }
            }
          );
        });
      }
    );
  });

  app.patch("/recetas/:id", (req, res) => {
    const id = req.params.id;
    const {
      nombre,
      id_categoria,
      gramaje,
      ingredientes,
      archivada,
      tienda_descripcion,
      tienda_modo_uso,
      tienda_cuidados,
      tienda_ingredientes,
      tienda_precio_publico,
      tienda_image_url,
      tienda_galeria
    } = req.body;

    bdRecetas.run(
      `UPDATE recetas
       SET nombre=?,
           id_categoria=?,
           gramaje=?,
           archivada=COALESCE(?, archivada),
           tienda_descripcion=COALESCE(?, tienda_descripcion),
           tienda_modo_uso=COALESCE(?, tienda_modo_uso),
           tienda_cuidados=COALESCE(?, tienda_cuidados),
           tienda_ingredientes=COALESCE(?, tienda_ingredientes),
           tienda_precio_publico=COALESCE(?, tienda_precio_publico),
             tienda_image_url=COALESCE(?, tienda_image_url),
             tienda_galeria=COALESCE(?, tienda_galeria)
       WHERE id=?`,
      [
        nombre,
        id_categoria,
        gramaje || 0,
        Number.isFinite(Number(archivada)) ? Number(archivada) : null,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'tienda_descripcion') ? textoPlano(tienda_descripcion) : null,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'tienda_modo_uso') ? textoPlano(tienda_modo_uso) : null,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'tienda_cuidados') ? textoPlano(tienda_cuidados) : null,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'tienda_ingredientes') ? textoPlano(tienda_ingredientes) : null,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'tienda_precio_publico') ? (Number(tienda_precio_publico) || 0) : null,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'tienda_image_url') ? textoPlano(tienda_image_url) : null,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'tienda_galeria') ? JSON.stringify(Array.isArray(tienda_galeria) ? tienda_galeria.map((item) => textoPlano(item)).filter(Boolean) : []) : null,
        id
      ],
      () => {
        bdRecetas.run("DELETE FROM ingredientes_receta WHERE id_receta=?", [id], () => {
          const lista = Array.isArray(ingredientes) ? ingredientes : [];
          if (lista.length === 0) {
            transmitir({ tipo: "recetas_actualizado" });
            return res.json({ ok: true });
          }

          let pendientes = lista.length;
          lista.forEach(ing => {
            bdRecetas.run(
                "INSERT INTO ingredientes_receta (id_receta, id_insumo, nombre_insumo, proveedor, cantidad, unidad) VALUES (?,?,?,?,?,?)",
                [id, ing.id_insumo, ing.nombre || '', String(ing.proveedor || '').trim(), ing.cantidad, ing.unidad],
              () => {
                pendientes--;
                if (pendientes === 0) {
                  transmitir({ tipo: "recetas_actualizado" });
                  res.json({ ok: true });
                }
              }
            );
          });
        });
      }
    );
  });

  app.delete("/recetas/:id", (req, res) => {
    const id = req.params.id;
    bdRecetas.run("DELETE FROM ingredientes_receta WHERE id_receta=?", [id], () => {
      bdRecetas.run("DELETE FROM recetas WHERE id=?", [id], () => {
        transmitir({ tipo: "recetas_actualizado" });
        res.json({ ok: true });
      });
    });
  });

  app.post("/recetas/archivar", (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0) : [];
    if (!ids.length) return res.status(400).json({ error: "Debes enviar al menos una receta" });
    const placeholders = ids.map(() => "?").join(",");
    bdRecetas.run(`UPDATE recetas SET archivada = 1 WHERE id IN (${placeholders})`, ids, () => {
      transmitir({ tipo: "recetas_actualizado" });
      res.json({ ok: true, total: ids.length });
    });
  });

  app.post("/recetas/desarchivar", (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0) : [];
    if (!ids.length) return res.status(400).json({ error: "Debes enviar al menos una receta" });
    const placeholders = ids.map(() => "?").join(",");
    bdRecetas.run(`UPDATE recetas SET archivada = 0 WHERE id IN (${placeholders})`, ids, () => {
      transmitir({ tipo: "recetas_actualizado" });
      res.json({ ok: true, total: ids.length });
    });
  });

  const responderAjustesProduccion = async (req, res) => {
    try {
      const factorCosto = await dbGetRecetas(
        "SELECT valor FROM recetas_ajustes WHERE clave='factor_costo_produccion'"
      );
      const factorVenta = await dbGetRecetas(
        "SELECT valor FROM recetas_ajustes WHERE clave='factor_precio_venta'"
      );
      const redondeo = await dbGetRecetas(
        "SELECT valor FROM recetas_ajustes WHERE clave='redondeo_precio'"
      );

      res.json({
        factor_costo_produccion: Number(factorCosto?.valor) || 1.15,
        factor_precio_venta: Number(factorVenta?.valor) || 2.5,
        redondeo_precio: Number(redondeo?.valor) || 5
      });
    } catch {
      res.status(500).json({ error: 'No se pudieron cargar los ajustes de producción' });
    }
  };

  app.get('/recetas/ajustes-produccion', responderAjustesProduccion);
  app.get('/api/recetas/ajustes-produccion', responderAjustesProduccion);

  const guardarAjustesProduccionHandler = async (req, res) => {
    try {
      const factorCosto = Number(req.body?.factor_costo_produccion);
      const factorVenta = Number(req.body?.factor_precio_venta);
      const redondeo = Number(req.body?.redondeo_precio);

      if (!Number.isFinite(factorCosto) || factorCosto <= 0) {
        return res.status(400).json({ error: 'factor_costo_produccion inválido' });
      }
      if (!Number.isFinite(factorVenta) || factorVenta <= 0) {
        return res.status(400).json({ error: 'factor_precio_venta inválido' });
      }
      if (!Number.isFinite(redondeo) || redondeo <= 0) {
        return res.status(400).json({ error: 'redondeo_precio inválido' });
      }

      await dbRunRecetas(
        `INSERT INTO recetas_ajustes (clave, valor, actualizado_en)
         VALUES ('factor_costo_produccion', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor, actualizado_en=CURRENT_TIMESTAMP`,
        [factorCosto]
      );
      await dbRunRecetas(
        `INSERT INTO recetas_ajustes (clave, valor, actualizado_en)
         VALUES ('factor_precio_venta', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor, actualizado_en=CURRENT_TIMESTAMP`,
        [factorVenta]
      );
      await dbRunRecetas(
        `INSERT INTO recetas_ajustes (clave, valor, actualizado_en)
         VALUES ('redondeo_precio', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor, actualizado_en=CURRENT_TIMESTAMP`,
        [redondeo]
      );

      transmitir({ tipo: 'recetas_ajustes_actualizados' });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'No se pudieron guardar los ajustes de producción' });
    }
  };

  app.put('/recetas/ajustes-produccion', guardarAjustesProduccionHandler);
  app.put('/api/recetas/ajustes-produccion', guardarAjustesProduccionHandler);

  app.post("/recetas/calcular", (req, res) => {
    const { id_receta } = req.body;
    bdRecetas.all(
      "SELECT * FROM ingredientes_receta WHERE id_receta=?",
      [id_receta],
      (err, ingredientes) => {
        if (!ingredientes || ingredientes.length === 0) return res.json({ piezas_maximas: 0, costo_por_pieza: 0 });

        let piezasMaximas = null;
        let costoPorPieza = 0;
        let pendientes = ingredientes.length;

        ingredientes.forEach(ing => {
          bdInventario.get("SELECT * FROM inventario WHERE id=?", [ing.id_insumo], (errInv, insumo) => {
            if (insumo) {
              const requerido = convertirCantidad(Number(ing.cantidad) || 0, ing.unidad, insumo.unidad);
              if (requerido > 0) {
                const disponibles = Number(insumo.cantidad_disponible) || 0;
                const maxPorIngrediente = Math.floor(disponibles / requerido);
                piezasMaximas = piezasMaximas === null ? maxPorIngrediente : Math.min(piezasMaximas, maxPorIngrediente);
                costoPorPieza += (Number(insumo.costo_por_unidad) || 0) * requerido;
              }
            }
            pendientes--;
            if (pendientes === 0) {
              res.json({
                piezas_maximas: piezasMaximas === null ? 0 : piezasMaximas,
                costo_por_pieza: costoPorPieza
              });
            }
          });
        });
      }
    );
  });

}
