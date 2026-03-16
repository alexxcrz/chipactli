import { transmitir, convertirCantidadDetallada } from "../../utils/index.js";

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

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function nombreBaseReceta(nombre = '') {
  const txt = String(nombre || '').trim();
  const m = txt.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? String(m[1] || '').trim() : txt;
}

function claveReceta(nombre = '') {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function mejorMatchReceta(actual, candidato) {
  if (!actual) return candidato;
  const actArchivada = Number(actual?.archivada || 0);
  const candArchivada = Number(candidato?.archivada || 0);
  if (candArchivada !== actArchivada) return candArchivada < actArchivada ? candidato : actual;
  return Number(candidato?.id || 0) > Number(actual?.id || 0) ? candidato : actual;
}

async function enriquecerVentasConCategoria(ventas = [], bdRecetas) {
  const recetas = await dbAll(
    bdRecetas,
    `SELECT r.id, r.nombre, r.id_categoria, COALESCE(c.nombre, '') AS categoria, COALESCE(r.archivada, 0) AS archivada
     FROM recetas r
     LEFT JOIN categorias c ON r.id_categoria = c.id`
  );

  const mapaExacto = new Map();
  const mapaBase = new Map();

  for (const receta of recetas || []) {
    const exacta = claveReceta(receta?.nombre);
    if (exacta) {
      mapaExacto.set(exacta, mejorMatchReceta(mapaExacto.get(exacta), receta));
    }

    const base = claveReceta(nombreBaseReceta(receta?.nombre));
    if (base) {
      mapaBase.set(base, mejorMatchReceta(mapaBase.get(base), receta));
    }
  }

  return (Array.isArray(ventas) ? ventas : []).map((venta) => {
    const nombreVenta = String(venta?.nombre_receta || '').trim();
    const exacta = mapaExacto.get(claveReceta(nombreVenta));
    const base = mapaBase.get(claveReceta(nombreBaseReceta(nombreVenta)));
    const receta = exacta || base || null;

    return {
      ...venta,
      id_categoria: receta?.id_categoria ?? null,
      categoria: String(receta?.categoria || '').trim() || 'Sin categoría'
    };
  });
}

async function obtenerFactorCostoProduccion(bdRecetas) {
  const row = await dbGet(
    bdRecetas,
    "SELECT valor FROM recetas_ajustes WHERE clave='factor_costo_produccion'"
  ).catch(() => null);
  const factor = Number(row?.valor);
  return Number.isFinite(factor) && factor > 0 ? factor : 1.15;
}

async function construirMapaRecetasActivas(bdRecetas) {
  const recetas = await dbAll(
    bdRecetas,
    "SELECT id, nombre, COALESCE(archivada,0) AS archivada FROM recetas"
  );

  const mapaExacto = new Map();
  const mapaBase = new Map();
  for (const receta of recetas || []) {
    const exacta = claveReceta(receta?.nombre);
    if (exacta) mapaExacto.set(exacta, mejorMatchReceta(mapaExacto.get(exacta), receta));
    const base = claveReceta(nombreBaseReceta(receta?.nombre));
    if (base) mapaBase.set(base, mejorMatchReceta(mapaBase.get(base), receta));
  }

  return { mapaExacto, mapaBase };
}

function resolverRecetaDesdeNombre(nombreVenta, mapasRecetas) {
  const nombre = String(nombreVenta || '').trim();
  if (!nombre) return null;
  const exacta = mapasRecetas?.mapaExacto?.get(claveReceta(nombre));
  const base = mapasRecetas?.mapaBase?.get(claveReceta(nombreBaseReceta(nombre)));
  return exacta || base || null;
}

function redondearPrecioVenta(valor) {
  const base = Number(valor) || 0;
  if (base <= 0) return 0;
  return Math.ceil(base / 5) * 5;
}

async function registrarAjusteRecuperacion(bdInventario, { fechaVenta, deltaRecuperado }) {
  const delta = Number(deltaRecuperado || 0);
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.000001) return;
  await dbRun(
    bdInventario,
    "INSERT INTO inversion_recuperada (fecha_venta, costo_recuperado) VALUES (?,?)",
    [fechaVenta || new Date().toISOString(), delta]
  );
}

async function calcularCostoUnitarioReceta({ idReceta, bdRecetas, bdInventario, factorCosto }) {
  const ingredientes = await dbAll(
    bdRecetas,
    "SELECT id_insumo, cantidad, unidad FROM ingredientes_receta WHERE id_receta=?",
    [idReceta]
  );
  if (!ingredientes.length) return null;

  let costoBase = 0;
  let hayIncompatibilidad = false;
  for (const ing of ingredientes) {
    const idInsumo = Number(ing?.id_insumo || 0);
    if (!idInsumo) continue;

    const insumo = await dbGet(bdInventario, "SELECT unidad, costo_por_unidad FROM inventario WHERE id=?", [idInsumo]);
    if (!insumo) continue;

    const cantidad = Number(ing?.cantidad || 0);
    const unidadReceta = String(ing?.unidad || '').trim();
    const unidadInsumo = String(insumo?.unidad || '').trim();
    const costoUnidad = Number(insumo?.costo_por_unidad || 0);
    if (!Number.isFinite(cantidad) || cantidad <= 0 || !unidadReceta || !unidadInsumo || costoUnidad <= 0) continue;

    const conversion = convertirCantidadDetallada(cantidad, unidadReceta, unidadInsumo);
    const cantidadConvertida = Number(conversion?.valor);
    if (!conversion?.compatible || !Number.isFinite(cantidadConvertida) || cantidadConvertida <= 0) {
      hayIncompatibilidad = true;
      continue;
    }
    costoBase += (cantidadConvertida * costoUnidad);
  }

  if (hayIncompatibilidad) return null;
  if (!Number.isFinite(costoBase) || costoBase <= 0) return null;
  return costoBase * factorCosto;
}

export function registrarRutasVentas(app, bdVentas, bdProduccion, bdInventario, bdRecetas) {
  // Endpoint para estadísticas de empresa
  app.get('/ventas/estadisticas/empresa', async (req, res) => {
    try {
      const [
        ventas,
        invInventario,
        invUtensilios,
        recuperacionVentas,
        recuperacionUtensilios,
        movimientosRecuperacionVentas,
        movimientosRecuperacionUtensilios,
        resumenRecuperacionVentas,
        resumenRecuperacionUtensilios,
        ordenesSurtidas,
        ordenesPendientes,
        historialCompras
      ] = await Promise.all([
        dbAll(bdVentas, 'SELECT * FROM ventas').catch(() => []),
        dbGet(bdInventario, 'SELECT COALESCE(SUM(costo_total),0) AS total FROM inventario').catch(() => ({ total: 0 })),
        dbGet(bdInventario, 'SELECT COALESCE(SUM(costo_total),0) AS total FROM utensilios').catch(() => ({ total: 0 })),
        dbGet(bdInventario, 'SELECT COALESCE(SUM(costo_recuperado),0) AS total FROM inversion_recuperada').catch(() => ({ total: 0 })),
        dbGet(bdInventario, 'SELECT COALESCE(SUM(monto_recuperado),0) AS total FROM recuperado_utensilios').catch(() => ({ total: 0 })),
        dbAll(
          bdInventario,
          `SELECT id, fecha_venta AS fecha, costo_recuperado AS monto
           FROM inversion_recuperada
           ORDER BY fecha_venta DESC, id DESC
           LIMIT 25`
        ).catch(() => []),
        dbAll(
          bdInventario,
          `SELECT id, fecha_recuperado AS fecha, monto_recuperado AS monto
           FROM recuperado_utensilios
           ORDER BY fecha_recuperado DESC, id DESC
           LIMIT 25`
        ).catch(() => []),
        dbGet(
          bdInventario,
          `SELECT
             COALESCE(SUM(CASE WHEN COALESCE(costo_recuperado,0) < 0 THEN costo_recuperado ELSE 0 END), 0) AS negativos_total,
             COALESCE(SUM(CASE WHEN COALESCE(costo_recuperado,0) > 0 THEN costo_recuperado ELSE 0 END), 0) AS positivos_total,
             COALESCE(SUM(CASE WHEN COALESCE(costo_recuperado,0) < 0 THEN 1 ELSE 0 END), 0) AS negativos_count,
             COALESCE(SUM(CASE WHEN COALESCE(costo_recuperado,0) > 0 THEN 1 ELSE 0 END), 0) AS positivos_count
           FROM inversion_recuperada`
        ).catch(() => ({ negativos_total: 0, positivos_total: 0, negativos_count: 0, positivos_count: 0 })),
        dbGet(
          bdInventario,
          `SELECT
             COALESCE(SUM(CASE WHEN COALESCE(monto_recuperado,0) < 0 THEN monto_recuperado ELSE 0 END), 0) AS negativos_total,
             COALESCE(SUM(CASE WHEN COALESCE(monto_recuperado,0) > 0 THEN monto_recuperado ELSE 0 END), 0) AS positivos_total,
             COALESCE(SUM(CASE WHEN COALESCE(monto_recuperado,0) < 0 THEN 1 ELSE 0 END), 0) AS negativos_count,
             COALESCE(SUM(CASE WHEN COALESCE(monto_recuperado,0) > 0 THEN 1 ELSE 0 END), 0) AS positivos_count
           FROM recuperado_utensilios`
        ).catch(() => ({ negativos_total: 0, positivos_total: 0, negativos_count: 0, positivos_count: 0 })),
        dbAll(
          bdInventario,
          `SELECT oc.id, oc.numero_orden, oc.proveedor, COALESCE(oc.fecha_surtida, oc.fecha_creacion) AS fecha,
                  COALESCE(SUM(CASE
                    WHEN COALESCE(oci.costo_total_surtido, 0) > 0 THEN oci.costo_total_surtido
                    ELSE COALESCE(oci.cantidad_surtida, 0) * COALESCE(oci.precio_unitario, 0)
                  END), 0) AS total
           FROM ordenes_compra oc
           LEFT JOIN ordenes_compra_items oci ON oci.id_orden = oc.id
           WHERE (LOWER(COALESCE(oc.estado, '')) = 'surtida' OR COALESCE(oci.surtido, 0) = 1 OR COALESCE(oci.cantidad_surtida, 0) > 0)
           GROUP BY oc.id, oc.numero_orden, oc.proveedor, fecha
           ORDER BY fecha DESC, oc.id DESC`
        ).catch(() => []),
        dbGet(
          bdInventario,
          `SELECT COALESCE(SUM(CASE
             WHEN COALESCE(oci.costo_total_surtido, 0) > 0 THEN oci.costo_total_surtido
             ELSE COALESCE(oci.cantidad_requerida, 0) * COALESCE(oci.precio_unitario, 0)
           END), 0) AS total
           FROM ordenes_compra_items oci
           INNER JOIN ordenes_compra oc ON oc.id = oci.id_orden
           WHERE COALESCE(oci.surtido, 0) = 0 AND LOWER(COALESCE(oc.estado, 'pendiente')) <> 'surtida'`
        ).catch(() => ({ total: 0 })),
        dbAll(
          bdInventario,
          `SELECT COALESCE(oc.fecha_surtida, oc.fecha_creacion) AS fecha,
                  COALESCE(oc.numero_orden, '') AS numero_orden,
                  COALESCE(oc.proveedor, '') AS proveedor,
                  COALESCE(SUM(CASE
                    WHEN COALESCE(oci.costo_total_surtido, 0) > 0 THEN oci.costo_total_surtido
                    ELSE COALESCE(oci.cantidad_surtida, 0) * COALESCE(oci.precio_unitario, 0)
                  END), 0) AS monto
           FROM ordenes_compra oc
           LEFT JOIN ordenes_compra_items oci ON oci.id_orden = oc.id
           WHERE (LOWER(COALESCE(oc.estado, '')) = 'surtida' OR COALESCE(oci.surtido, 0) = 1 OR COALESCE(oci.cantidad_surtida, 0) > 0)
           GROUP BY oc.id, fecha, numero_orden, proveedor
           ORDER BY fecha DESC, oc.id DESC
           LIMIT 20`
        ).catch(() => [])
      ]);

      const ventasReales = (ventas || []).reduce((sum, v) => sum + ((Number(v?.precio_venta) || 0) * (Number(v?.cantidad) || 0)), 0);
      const costosTotales = (ventas || []).reduce((sum, v) => sum + (Number(v?.costo_produccion) || 0), 0);
      const gananciaNeta = (ventas || []).reduce((sum, v) => sum + (Number(v?.ganancia) || 0), 0);

      const inversionInventarioActual = Number(invInventario?.total || 0);
      const inversionUtensiliosActual = Number(invUtensilios?.total || 0);
      const inversionActualTotal = inversionInventarioActual + inversionUtensiliosActual;

      const comprasOrdenesTotal = (ordenesSurtidas || []).reduce((sum, row) => sum + (Number(row?.total) || 0), 0);
      const comprasPendientes = Number(ordenesPendientes?.total || 0);

      const recuperacionTotal = Number(recuperacionVentas?.total || 0) + Number(recuperacionUtensilios?.total || 0);
      const inversionNeta = inversionActualTotal - recuperacionTotal;

      const movimientosRecuperacion = [
        ...(Array.isArray(movimientosRecuperacionVentas) ? movimientosRecuperacionVentas : []).map((row) => ({
          fuente: 'inversion_recuperada',
          id: Number(row?.id || 0),
          fecha: row?.fecha || null,
          monto: Number(row?.monto || 0)
        })),
        ...(Array.isArray(movimientosRecuperacionUtensilios) ? movimientosRecuperacionUtensilios : []).map((row) => ({
          fuente: 'recuperado_utensilios',
          id: Number(row?.id || 0),
          fecha: row?.fecha || null,
          monto: Number(row?.monto || 0)
        }))
      ]
        .sort((a, b) => String(b?.fecha || '').localeCompare(String(a?.fecha || '')))
        .slice(0, 30);

      const resumenMovimientosRecuperacion = {
        total_movimientos: movimientosRecuperacion.length,
        negativos: movimientosRecuperacion.filter((m) => Number(m?.monto || 0) < 0),
        positivos: movimientosRecuperacion.filter((m) => Number(m?.monto || 0) > 0)
      };

      const negativosHistoricoTotal = Number(resumenRecuperacionVentas?.negativos_total || 0) + Number(resumenRecuperacionUtensilios?.negativos_total || 0);
      const positivosHistoricoTotal = Number(resumenRecuperacionVentas?.positivos_total || 0) + Number(resumenRecuperacionUtensilios?.positivos_total || 0);
      const negativosHistoricoCount = Number(resumenRecuperacionVentas?.negativos_count || 0) + Number(resumenRecuperacionUtensilios?.negativos_count || 0);
      const positivosHistoricoCount = Number(resumenRecuperacionVentas?.positivos_count || 0) + Number(resumenRecuperacionUtensilios?.positivos_count || 0);

      const totalNegativosRecuperacion = resumenMovimientosRecuperacion.negativos.reduce((acc, m) => acc + (Number(m?.monto || 0)), 0);
      const totalPositivosRecuperacion = resumenMovimientosRecuperacion.positivos.reduce((acc, m) => acc + (Number(m?.monto || 0)), 0);

      const rentabilidad = ventasReales > 0 ? (gananciaNeta / ventasReales) * 100 : 0;

      let tiempoPromedio = 0;
      if ((ventas || []).length > 1) {
        const fechas = ventas
          .map((v) => new Date(v?.fecha_venta))
          .filter((d) => !Number.isNaN(d.getTime()))
          .sort((a, b) => a - b);
        const difs = [];
        for (let i = 1; i < fechas.length; i += 1) {
          difs.push((fechas[i] - fechas[i - 1]) / (1000 * 60 * 60 * 24));
        }
        tiempoPromedio = difs.length ? (difs.reduce((a, b) => a + b, 0) / difs.length) : 0;
      }

      const mapaProd = {};
      for (const v of ventas || []) {
        const nombre = String(v?.nombre_receta || '').trim();
        if (!nombre) continue;
        mapaProd[nombre] = (mapaProd[nombre] || 0) + (Number(v?.cantidad) || 0);
      }
      const productosMasVendidos = Object.entries(mapaProd)
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 10);

      const ahora = new Date();
      const serieMesesBase = [];
      const mapaMes = new Map();
      for (let i = 11; i >= 0; i -= 1) {
        const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
        const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
        const item = { clave, label, ingresos: 0, costos: 0, ganancia: 0, unidades: 0, compras: 0 };
        serieMesesBase.push(item);
        mapaMes.set(clave, item);
      }

      const inicioSemana = (fecha) => {
        const d = new Date(fecha);
        d.setHours(0, 0, 0, 0);
        const dia = d.getDay();
        const desplazamiento = (dia + 6) % 7;
        d.setDate(d.getDate() - desplazamiento);
        return d;
      };

      const serieSemanasBase = [];
      const mapaSemana = new Map();
      const semanaActual = inicioSemana(ahora);
      for (let i = 7; i >= 0; i -= 1) {
        const d = new Date(semanaActual);
        d.setDate(d.getDate() - (i * 7));
        const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const hasta = new Date(d);
        hasta.setDate(hasta.getDate() + 6);
        const label = `${d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} - ${hasta.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}`;
        const item = { clave, label, ingresos: 0, costos: 0, ganancia: 0, unidades: 0, compras: 0 };
        serieSemanasBase.push(item);
        mapaSemana.set(clave, item);
      }

      for (const venta of ventas || []) {
        const cantidad = Number(venta?.cantidad) || 0;
        const precio = Number(venta?.precio_venta) || 0;
        const costo = Number(venta?.costo_produccion) || 0;
        const ingreso = precio * cantidad;
        const ganancia = Number(venta?.ganancia) || 0;
        const fechaVenta = new Date(venta?.fecha_venta || '');
        if (Number.isNaN(fechaVenta.getTime())) continue;

        const claveMes = `${fechaVenta.getFullYear()}-${String(fechaVenta.getMonth() + 1).padStart(2, '0')}`;
        const mes = mapaMes.get(claveMes);
        if (mes) {
          mes.ingresos += ingreso;
          mes.costos += costo;
          mes.ganancia += ganancia;
          mes.unidades += cantidad;
        }

        const semana = inicioSemana(fechaVenta);
        const claveSemana = `${semana.getFullYear()}-${String(semana.getMonth() + 1).padStart(2, '0')}-${String(semana.getDate()).padStart(2, '0')}`;
        const semanaItem = mapaSemana.get(claveSemana);
        if (semanaItem) {
          semanaItem.ingresos += ingreso;
          semanaItem.costos += costo;
          semanaItem.ganancia += ganancia;
          semanaItem.unidades += cantidad;
        }
      }

      for (const compra of ordenesSurtidas || []) {
        const fecha = new Date(compra?.fecha || '');
        if (Number.isNaN(fecha.getTime())) continue;
        const monto = Number(compra?.total || 0);

        const claveMes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        const mes = mapaMes.get(claveMes);
        if (mes) mes.compras += monto;

        const semana = inicioSemana(fecha);
        const claveSemana = `${semana.getFullYear()}-${String(semana.getMonth() + 1).padStart(2, '0')}-${String(semana.getDate()).padStart(2, '0')}`;
        const semanaItem = mapaSemana.get(claveSemana);
        if (semanaItem) semanaItem.compras += monto;
      }

      const serie_mensual = serieMesesBase.map((item) => ({
        ...item,
        ingresos: Number(item.ingresos.toFixed(2)),
        costos: Number(item.costos.toFixed(2)),
        ganancia: Number(item.ganancia.toFixed(2)),
        unidades: Number(item.unidades.toFixed(2)),
        compras: Number(item.compras.toFixed(2))
      }));

      const serie_semanal = serieSemanasBase.map((item) => ({
        ...item,
        ingresos: Number(item.ingresos.toFixed(2)),
        costos: Number(item.costos.toFixed(2)),
        ganancia: Number(item.ganancia.toFixed(2)),
        unidades: Number(item.unidades.toFixed(2)),
        compras: Number(item.compras.toFixed(2))
      }));

      res.json({
        ventas_reales: ventasReales,
        costos_totales: costosTotales,
        inversiones: inversionActualTotal,
        inversion_actual_total: inversionActualTotal,
        inversion_actual_inventario: inversionInventarioActual,
        inversion_actual_utensilios: inversionUtensiliosActual,
        compras_ordenes_total: Number(comprasOrdenesTotal.toFixed(2)),
        compras_ordenes_pendientes: Number(comprasPendientes.toFixed(2)),
        recuperacion_total: Number(recuperacionTotal.toFixed(2)),
        recuperacion_ventas_total: Number((Number(recuperacionVentas?.total || 0)).toFixed(2)),
        recuperacion_utensilios_total: Number((Number(recuperacionUtensilios?.total || 0)).toFixed(2)),
        movimientos_recuperacion: movimientosRecuperacion,
        movimientos_recuperacion_negativos: resumenMovimientosRecuperacion.negativos,
        movimientos_recuperacion_positivos: resumenMovimientosRecuperacion.positivos,
        recuperacion_negativos_historico_total: Number(negativosHistoricoTotal.toFixed(2)),
        recuperacion_positivos_historico_total: Number(positivosHistoricoTotal.toFixed(2)),
        recuperacion_negativos_historico_count: negativosHistoricoCount,
        recuperacion_positivos_historico_count: positivosHistoricoCount,
        recuperacion_total_negativos: Number(totalNegativosRecuperacion.toFixed(2)),
        recuperacion_total_positivos: Number(totalPositivosRecuperacion.toFixed(2)),
        inversion_neta: Number(inversionNeta.toFixed(2)),
        ganancia_neta: gananciaNeta,
        rentabilidad,
        tiempo_promedio: Math.round(tiempoPromedio),
        productos_mas_vendidos: productosMasVendidos,
        historial_inversiones: historialCompras || [],
        historial_compras_ordenes: historialCompras || [],
        serie_mensual,
        serie_semanal
      });
    } catch (error) {
      res.status(500).json({ error: 'Error obteniendo estadísticas de empresa', detalle: error?.message || String(error) });
    }
  });
  const PREFIJO_VENTA_GENERAL = 'CHIVT'; // Venta por tienda
  const LONGITUD_CONSECUTIVO_VENTA_GENERAL = 6;
  const PREFIJO_VENTA_DIRECTA = 'CHIVI'; // Venta desde trastienda
  const LONGITUD_CONSECUTIVO_VENTA_DIRECTA = 5;
  const PREFIJO_VENTA_APP = 'CHIAPP'; // Venta desde la app
  const LONGITUD_CONSECUTIVO_VENTA_APP = 6;

  async function generarNumeroVenta({ prefijo, longitud }) {
    try {
      const rows = await dbAll(
        bdVentas,
        `SELECT numero_pedido
         FROM ventas
         WHERE numero_pedido LIKE ?`,
        [`${prefijo}%`]
      );

      const regex = new RegExp(`${prefijo}(\\d+)`, 'i');
      let maximo = 0;
      for (const row of rows || []) {
        const actual = String(row?.numero_pedido || '').trim();
        const match = actual.match(regex);
        if (!match) continue;
        const numero = Number(match[1] || 0);
        if (Number.isFinite(numero) && numero > maximo) maximo = numero;
      }

      const consecutivo = Number.isFinite(maximo) && maximo > 0 ? (maximo + 1) : 1;
      return `${prefijo}${String(consecutivo).padStart(longitud, '0')}`;
    } catch {
      return `${prefijo}${String(1).padStart(longitud, '0')}`;
    }
  }

  app.get('/ventas/siguiente-codigo', async (req, res) => {
    const tipo = String(req.query?.tipo || '').trim().toLowerCase();
    let prefijo = PREFIJO_VENTA_GENERAL;
    let longitud = LONGITUD_CONSECUTIVO_VENTA_GENERAL;
    if (tipo === 'directa' || tipo === 'produccion' || tipo === 'chvi' || tipo === 'chivi' || tipo === 'tienda') {
      prefijo = PREFIJO_VENTA_DIRECTA;
      longitud = LONGITUD_CONSECUTIVO_VENTA_DIRECTA;
    } else if (tipo === 'app' || tipo === 'chiapp') {
      prefijo = PREFIJO_VENTA_APP;
      longitud = LONGITUD_CONSECUTIVO_VENTA_APP;
    }
    const codigo = await generarNumeroVenta({ prefijo, longitud });
    res.json({ codigo });
  });

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
      const observaciones = String(body.observaciones || '').trim();

      let precioPublicoReceta = 0;
      try {
        const mapasRecetas = await construirMapaRecetasActivas(bdRecetas);
        const recetaMatch = resolverRecetaDesdeNombre(nombreRecetaBody, mapasRecetas);
        if (recetaMatch?.id) {
          const rowPrecio = await dbGet(bdRecetas, "SELECT tienda_precio_publico FROM recetas WHERE id=?", [Number(recetaMatch.id)]);
          precioPublicoReceta = Number(rowPrecio?.tienda_precio_publico || 0);
        }
      } catch {
        precioPublicoReceta = 0;
      }

      if (idProduccion > 0) {
        const lote = await dbGet(bdProduccion, "SELECT * FROM produccion WHERE id=?", [idProduccion]);
        if (!lote) return res.status(404).json({ error: "Lote de producción no encontrado" });

        const cantidadLote = Number(lote?.cantidad || 0);
        if (cantidadLote <= 0) return res.status(400).json({ error: "El lote ya no tiene piezas disponibles" });

        const cantidadSolicitada = Number.isFinite(cantidadBody) && cantidadBody > 0 ? cantidadBody : cantidadLote;
        if (cantidadSolicitada > cantidadLote) {
          return res.status(400).json({ error: "La cantidad a vender supera las piezas del lote" });
        }

        nombreReceta = String(nombreRecetaBody || lote?.nombre_receta || '').trim();
        cantidad = cantidadSolicitada;
        fechaProduccion = String(lote?.fecha_produccion || fechaProduccion || fechaNow).trim();
        precioVenta = precioPublicoReceta > 0
          ? precioPublicoReceta
          : Number(body.precio_venta || lote?.precio_venta || 0);
        costoProduccion = Number(body.costo_produccion || 0);

        const restante = cantidadLote - cantidad;
        if (restante <= 1e-9) {
          await dbRun(bdProduccion, "DELETE FROM produccion_descuentos WHERE id_produccion=?", [idProduccion]);
          await dbRun(bdProduccion, "DELETE FROM produccion WHERE id=?", [idProduccion]);
        } else {
          const costoLote = Number(lote?.costo_produccion || 0);
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

      if (!Number.isFinite(costoProduccion) || costoProduccion < 0) {
        costoProduccion = 0;
      }

      const numeroPedidoBody = String(body.numero_pedido || '').trim();
      let numeroPedido = numeroPedidoBody;
      if (!numeroPedido) {
        if (body.origen === 'app') {
          numeroPedido = await generarNumeroVenta({ prefijo: PREFIJO_VENTA_APP, longitud: LONGITUD_CONSECUTIVO_VENTA_APP });
        } else if (idProduccion > 0 || body.origen === 'tienda') {
          numeroPedido = await generarNumeroVenta({ prefijo: PREFIJO_VENTA_DIRECTA, longitud: LONGITUD_CONSECUTIVO_VENTA_DIRECTA });
        } else {
          numeroPedido = await generarNumeroVenta({ prefijo: PREFIJO_VENTA_GENERAL, longitud: LONGITUD_CONSECUTIVO_VENTA_GENERAL });
        }
      }

      const precioVentaFinal = redondearPrecioVenta(precioVenta);
      const importeCobrado = precioVentaFinal * cantidad;
      const ganancia = (precioVentaFinal * cantidad) - costoProduccion;

      try {
        await dbRun(
          bdVentas,
          `INSERT INTO ventas (nombre_receta, cantidad, fecha_produccion, fecha_venta, costo_produccion, precio_venta, ganancia, numero_pedido, observaciones)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [nombreReceta, cantidad, fechaProduccion, fechaNow, costoProduccion, precioVentaFinal, ganancia, numeroPedido, observaciones]
        );
      } catch (errorInsert) {
        const detalle = String(errorInsert?.message || '').toLowerCase();
        if (!detalle.includes('observaciones')) throw errorInsert;
        await dbRun(
          bdVentas,
          `INSERT INTO ventas (nombre_receta, cantidad, fecha_produccion, fecha_venta, costo_produccion, precio_venta, ganancia, numero_pedido)
           VALUES (?,?,?,?,?,?,?,?)`,
          [nombreReceta, cantidad, fechaProduccion, fechaNow, costoProduccion, precioVentaFinal, ganancia, numeroPedido]
        );
      }

      await registrarAjusteRecuperacion(bdInventario, {
        fechaVenta: fechaNow,
        deltaRecuperado: importeCobrado
      });

      bdInventario.get(
        "SELECT COALESCE(SUM(costo_total),0) as inversion_total FROM inventario",
        (errInv, inv) => {
          if (errInv) {
            return res.status(500).json({ error: "Error calculando inversión total", detalle: errInv.message });
          }
          bdInventario.get(
            "SELECT COALESCE(SUM(costo_recuperado),0) as inversion_recuperada FROM inversion_recuperada",
            (errRec, rec) => {
              if (errRec) {
                return res.status(500).json({ error: "Error calculando inversión recuperada", detalle: errRec.message });
              }
              const inversionTotal = inv ? inv.inversion_total : 0;
              const inversionRecuperada = rec ? rec.inversion_recuperada : 0;
              if (inversionRecuperada >= inversionTotal && ganancia > 0) {
                bdInventario.run(
                  "INSERT INTO recuperado_utensilios (fecha_recuperado, monto_recuperado) VALUES (?,?)",
                  [fechaNow, ganancia],
                  (errRecUten) => {
                    if (errRecUten) {
                      return res.status(500).json({ error: "Error registrando recuperación de utensilios", detalle: errRecUten.message });
                    }
                    transmitir({ tipo: "utensilios_actualizado" });
                    transmitir({ tipo: "ventas_actualizado", accion: "registrada", nombre_receta: nombreReceta, cantidad });
                    res.json({ ok: true });
                  }
                );
              } else {
                transmitir({ tipo: "ventas_actualizado", accion: "registrada", nombre_receta: nombreReceta, cantidad });
                res.json({ ok: true });
              }
            }
          );
        }
      );
    } catch (error) {
      return res.status(500).json({ error: "Error venta", detalle: error?.message || String(error) });
    }
  });

  app.get("/ventas", async (req, res) => {
    const idCategoria = req.query.categoria || "";

    try {
      const ventas = await dbAll(bdVentas, "SELECT * FROM ventas ORDER BY fecha_venta DESC");
      if (!ventas.length) return res.json([]);

      const enriquecidas = await enriquecerVentasConCategoria(ventas, bdRecetas);
      if (idCategoria) {
        return res.json(enriquecidas.filter((v) => String(v?.id_categoria ?? '') === String(idCategoria)));
      }
      return res.json(enriquecidas);
    } catch {
      return res.status(500).json({ error: "Error obteniendo ventas" });
    }
  });

  app.get('/devoluciones', async (req, res) => {
    try {
      const devoluciones = await dbAll(bdVentas, "SELECT * FROM devoluciones ORDER BY fecha_devolucion DESC, id DESC");
      return res.json(devoluciones || []);
    } catch {
      return res.status(500).json({ error: 'Error obteniendo devoluciones' });
    }
  });

  app.get("/ventas/estadisticas/:periodo", async (req, res) => {
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

    try {
      const ventasRaw = await dbAll(bdVentas, `SELECT * FROM ventas ${filtroFecha}`, paramsFecha);
      if (!ventasRaw.length) {
        return res.json({ total_sales: 0, total_units: 0, total_cost: 0, total_revenue: 0, total_profit: 0 });
      }

      const ventas = idCategoria
        ? (await enriquecerVentasConCategoria(ventasRaw, bdRecetas)).filter((v) => String(v?.id_categoria ?? '') === String(idCategoria))
        : ventasRaw;

      const stats = {
        total_sales: ventas.length,
        total_units: ventas.reduce((sum, v) => sum + (Number(v?.cantidad) || 0), 0),
        total_cost: ventas.reduce((sum, v) => sum + (Number(v?.costo_produccion) || 0), 0),
        total_revenue: ventas.reduce((sum, v) => sum + ((Number(v?.precio_venta) || 0) * (Number(v?.cantidad) || 0)), 0),
        total_profit: ventas.reduce((sum, v) => sum + (Number(v?.ganancia) || 0), 0)
      };
      return res.json(stats);
    } catch {
      return res.status(500).json({ error: "Error obteniendo estadísticas de ventas" });
    }
  });

  app.post('/ventas/:id/devolucion', async (req, res) => {
    const idVenta = Number(req.params.id || 0);
    const motivo = String(req.body?.motivo || '').trim();
    const tipoDevolucion = String(req.body?.tipo_devolucion || 'merma').trim() || 'merma';
    const observaciones = String(req.body?.observaciones || '').trim();
    const fechaNow = new Date().toISOString();

    if (!idVenta) return res.status(400).json({ error: 'Venta inválida' });
    if (!motivo) return res.status(400).json({ error: 'Motivo de devolución requerido' });

    try {
      const venta = await dbGet(bdVentas, 'SELECT * FROM ventas WHERE id=?', [idVenta]);
      if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

      const ventasConCategoria = await enriquecerVentasConCategoria([venta], bdRecetas);
      const categoria = String(ventasConCategoria?.[0]?.categoria || '').trim();

      await dbRun(
        bdVentas,
        `INSERT INTO devoluciones (id_venta_original, nombre_receta, cantidad, fecha_produccion, fecha_venta_original, fecha_devolucion,
          costo_produccion, precio_venta, ganancia_original, numero_pedido, categoria, motivo, tipo_devolucion, observaciones)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          Number(venta.id || 0),
          String(venta.nombre_receta || '').trim(),
          Number(venta.cantidad || 0),
          String(venta.fecha_produccion || '').trim(),
          String(venta.fecha_venta || '').trim(),
          fechaNow,
          Number(venta.costo_produccion || 0),
          Number(venta.precio_venta || 0),
          Number(venta.ganancia || 0),
          String(venta.numero_pedido || '').trim(),
          categoria,
          motivo,
          tipoDevolucion,
          observaciones
        ]
      );

      await dbRun(bdVentas, 'DELETE FROM ventas WHERE id=?', [idVenta]);
      await registrarAjusteRecuperacion(bdInventario, {
        fechaVenta: fechaNow,
        deltaRecuperado: -1 * ((Number(venta.precio_venta || 0) * Number(venta.cantidad || 0)))
      });

      transmitir({ tipo: 'ventas_actualizado', accion: 'devolucion', nombre_receta: String(venta?.nombre_receta || '').trim(), cantidad: Number(venta?.cantidad || 0) });
      transmitir({ tipo: 'devoluciones_actualizado' });
      return res.json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: 'Error registrando devolución', detalle: error?.message || String(error) });
    }
  });

  app.post('/ventas/:id/regresar-produccion', async (req, res) => {
    const idVenta = Number(req.params.id || 0);
    const motivo = String(req.body?.motivo || '').trim();
    const observaciones = String(req.body?.observaciones || '').trim();
    const fechaNow = new Date().toISOString();

    if (!idVenta) return res.status(400).json({ error: 'Venta inválida' });
    if (!motivo) return res.status(400).json({ error: 'Motivo requerido para regresar a producción' });

    try {
      const venta = await dbGet(bdVentas, 'SELECT * FROM ventas WHERE id=?', [idVenta]);
      if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

      const nombreReceta = String(venta.nombre_receta || '').trim();
      const cantidad = Number(venta.cantidad || 0);
      const costoProduccion = Number(venta.costo_produccion || 0);
      const precioVenta = Number(venta.precio_venta || 0);
      if (!nombreReceta || cantidad <= 0) {
        return res.status(400).json({ error: 'Datos inválidos para regresar a producción' });
      }

      await dbRun(
        bdProduccion,
        `INSERT INTO produccion (nombre_receta, cantidad, fecha_produccion, costo_produccion, precio_venta)
         VALUES (?,?,?,?,?)`,
        [nombreReceta, cantidad, fechaNow, costoProduccion, precioVenta]
      );

      await dbRun(
        bdVentas,
        `INSERT INTO devoluciones (id_venta_original, nombre_receta, cantidad, fecha_produccion, fecha_venta_original, fecha_devolucion,
          costo_produccion, precio_venta, ganancia_original, numero_pedido, categoria, motivo, tipo_devolucion, observaciones)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          Number(venta.id || 0),
          nombreReceta,
          cantidad,
          String(venta.fecha_produccion || '').trim(),
          String(venta.fecha_venta || '').trim(),
          fechaNow,
          costoProduccion,
          precioVenta,
          Number(venta.ganancia || 0),
          String(venta.numero_pedido || '').trim(),
          '',
          motivo,
          'regreso_produccion',
          observaciones
        ]
      );

      await dbRun(bdVentas, 'DELETE FROM ventas WHERE id=?', [idVenta]);
      await registrarAjusteRecuperacion(bdInventario, {
        fechaVenta: fechaNow,
        deltaRecuperado: -1 * ((Number(precioVenta || 0) * Number(cantidad || 0)))
      });

      transmitir({ tipo: 'ventas_actualizado', accion: 'regresada_produccion', nombre_receta: nombreReceta, cantidad });
      transmitir({ tipo: 'produccion_actualizado' });
      transmitir({ tipo: 'devoluciones_actualizado' });
      return res.json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: 'Error regresando venta a producción', detalle: error?.message || String(error) });
    }
  });

  app.delete("/ventas/:id", async (req, res) => {
    const idVenta = Number(req.params.id || 0);
    if (!idVenta) return res.status(400).json({ error: 'Venta inválida' });

    try {
      const venta = await dbGet(bdVentas, 'SELECT * FROM ventas WHERE id=?', [idVenta]);
      if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

      await dbRun(bdVentas, 'DELETE FROM ventas WHERE id=?', [idVenta]);
      await registrarAjusteRecuperacion(bdInventario, {
        fechaVenta: new Date().toISOString(),
        deltaRecuperado: -1 * ((Number(venta?.precio_venta || 0) * Number(venta?.cantidad || 0)))
      });

      transmitir({ tipo: 'ventas_actualizado', accion: 'eliminada', nombre_receta: String(venta?.nombre_receta || '').trim(), cantidad: Number(venta?.cantidad || 0) });
      return res.json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: 'Error eliminando venta', detalle: error?.message || String(error) });
    }
  });

  app.post("/ventas/recalcular-historico-costos", async (req, res) => {
    try {
      const confirmar = String(req.body?.confirmar || '').trim().toUpperCase();
      if (confirmar !== 'SI') {
        return res.status(400).json({
          error: "Recalculo histórico bloqueado",
          detalle: "Para ejecutarlo envía { confirmar: 'SI' }"
        });
      }

      const soloIds = Array.isArray(req.body?.ids) ? req.body.ids.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0) : [];
      const dryRun = Boolean(req.body?.dry_run);

      const ventas = soloIds.length
        ? await dbAll(
          bdVentas,
          `SELECT id, nombre_receta, cantidad, precio_venta, costo_produccion, ganancia
           FROM ventas
           WHERE id IN (${soloIds.map(() => '?').join(',')})
           ORDER BY fecha_venta DESC, id DESC`,
          soloIds
        )
        : await dbAll(
          bdVentas,
          `SELECT id, nombre_receta, cantidad, precio_venta, costo_produccion, ganancia
           FROM ventas
           ORDER BY fecha_venta DESC, id DESC`
        );

      if (!ventas.length) {
        return res.json({ ok: true, total: 0, actualizadas: 0, dry_run: dryRun, muestras: [] });
      }

      const factorCosto = await obtenerFactorCostoProduccion(bdRecetas);
      const mapasRecetas = await construirMapaRecetasActivas(bdRecetas);

      const muestras = [];
      let actualizadas = 0;

      for (const venta of ventas) {
        const receta = resolverRecetaDesdeNombre(venta?.nombre_receta, mapasRecetas);
        if (!receta?.id) continue;

        const costoUnitario = await calcularCostoUnitarioReceta({
          idReceta: Number(receta.id),
          bdRecetas,
          bdInventario,
          factorCosto
        });
        if (!Number.isFinite(costoUnitario) || costoUnitario <= 0) continue;

        const cantidad = Number(venta?.cantidad || 0);
        if (!Number.isFinite(cantidad) || cantidad <= 0) continue;

        const costoNuevo = costoUnitario * cantidad;
        const precio = Number(venta?.precio_venta || 0);
        const gananciaNueva = (precio * cantidad) - costoNuevo;

        const costoActual = Number(venta?.costo_produccion || 0);
        const gananciaActual = Number(venta?.ganancia || 0);
        const deltaCosto = Math.abs(costoNuevo - costoActual);
        const deltaGanancia = Math.abs(gananciaNueva - gananciaActual);
        if (deltaCosto < 0.01 && deltaGanancia < 0.01) continue;

        if (!dryRun) {
          await dbRun(
            bdVentas,
            "UPDATE ventas SET costo_produccion=?, ganancia=? WHERE id=?",
            [costoNuevo, gananciaNueva, venta.id]
          );
        }

        actualizadas += 1;
        if (muestras.length < 25) {
          muestras.push({
            id: Number(venta.id),
            receta: String(venta?.nombre_receta || '').trim(),
            cantidad,
            costo_actual: Number(costoActual.toFixed(2)),
            costo_nuevo: Number(costoNuevo.toFixed(2)),
            ganancia_actual: Number(gananciaActual.toFixed(2)),
            ganancia_nueva: Number(gananciaNueva.toFixed(2))
          });
        }
      }

      if (!dryRun && actualizadas > 0) {
        transmitir({ tipo: "ventas_actualizado", accion: "recalculada" });
      }

      return res.json({
        ok: true,
        dry_run: dryRun,
        total: ventas.length,
        actualizadas,
        factor_costo_usado: factorCosto,
        muestras
      });
    } catch (error) {
      return res.status(500).json({ error: "Error recalculando histórico de ventas", detalle: error?.message || String(error) });
    }
  });
}
