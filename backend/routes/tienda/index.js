import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { convertirCantidad } from "../../utils/index.js";
import { transmitir } from "../../utils/index.js";

const TIENDA_JWT_SECRET = process.env.TIENDA_JWT_SECRET || process.env.JWT_SECRET || "chipactli_tienda_jwt_secret";

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this?.lastID, changes: this?.changes || 0 });
    });
  });
}

function slugify(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

function parseJSON(value, fallback) {
  try {
    if (!value) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function tieneClave(obj, clave) {
  return Object.prototype.hasOwnProperty.call(obj || {}, clave);
}

function boolToInt(valor) {
  return valor === true || Number(valor) === 1 ? 1 : 0;
}

function lineasTexto(valor = "") {
  return String(valor || "")
    .split(/\r?\n|,/)
    .map((linea) => String(linea || "").trim())
    .filter(Boolean);
}

function etiquetaGramaje(gramaje, nombreReceta = "") {
  const gram = Number(gramaje);
  if (Number.isFinite(gram) && gram > 0) return `${gram}g`;
  const texto = String(nombreReceta || "").trim();
  const match = texto.match(/\(([^)]+)\)\s*$/);
  return match ? String(match[1] || "").trim() : "Presentación";
}

function nombreBaseProducto(nombreReceta = "", gramaje = 0) {
  const texto = String(nombreReceta || "").trim();
  if (!texto) return "";
  const finalParentesis = texto.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (finalParentesis) {
    return String(finalParentesis[1] || "").trim() || texto;
  }
  return texto;
}

function crearTokenCliente(cliente) {
  return jwt.sign(
    {
      tipo: "tienda_cliente",
      id: cliente.id,
      nombre: cliente.nombre,
      email: cliente.email
    },
    TIENDA_JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function authCliente(req, res, next) {
  const auth = req.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({ exito: false, mensaje: "No autenticado" });
  }
  const token = auth.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, TIENDA_JWT_SECRET);
    if (decoded?.tipo !== "tienda_cliente") {
      return res.status(401).json({ exito: false, mensaje: "Token inválido" });
    }
    req.cliente = decoded;
    next();
  } catch {
    return res.status(401).json({ exito: false, mensaje: "Token inválido" });
  }
}

function authInterno(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ exito: false, mensaje: "No autenticado" });
  }
  next();
}

const CONFIG_DEFAULT = {
  promo_texto: '💖 ¡Últimas horas! Llévate productos favoritos con promoción especial.',
  footer_marca_titulo: 'CHIPACTLI',
  footer_marca_texto: 'Formulamos productos artesanales para el cuidado personal de forma segura y consciente.',
  atencion_horario_lunes_viernes: '09:00 a.m. - 06:00 p.m.',
  atencion_horario_sabado: '09:00 a.m. - 02:00 p.m.',
  atencion_horario_lunes_sabado: '09:00 a.m. - 09:00 p.m.',
  atencion_horario_domingo: '08:00 a.m. - 12:00 p.m.',
  atencion_correo: 'atc@chipactli.mx',
  whatsapp_numero: '',
  social_facebook_url: '',
  social_facebook_activo: '0',
  social_instagram_url: '',
  social_instagram_activo: '0',
  social_tiktok_url: '',
  social_tiktok_activo: '0',
  social_youtube_url: '',
  social_youtube_activo: '0',
  social_x_url: '',
  social_x_activo: '0',
  social_linkedin_url: '',
  social_linkedin_activo: '0',
  footer_pagos_texto: 'VISA · MasterCard · PayPal · AMEX · OXXO'
};

async function obtenerResumenResenas(bdVentas) {
  const rows = await dbAll(
    bdVentas,
    `SELECT receta_nombre,
            COUNT(*) AS total,
            ROUND(AVG(COALESCE(calificacion, 0)), 2) AS promedio
     FROM tienda_resenas
     GROUP BY receta_nombre`
  );

  const mapa = new Map();
  for (const row of rows || []) {
    const receta = String(row?.receta_nombre || '').trim();
    if (!receta) continue;
    mapa.set(receta, {
      total: Number(row?.total) || 0,
      promedio: Number(row?.promedio) || 0
    });
  }
  return mapa;
}

async function obtenerConfigTienda(bdVentas) {
  const rows = await dbAll(bdVentas, 'SELECT clave, valor FROM tienda_config');
  const out = { ...CONFIG_DEFAULT };
  for (const row of rows || []) {
    const clave = String(row?.clave || '').trim();
    if (!clave) continue;
    out[clave] = String(row?.valor || '');
  }
  return out;
}

async function obtenerProductosDisponibles(bdProduccion, bdRecetas, bdVentas, opciones = {}) {
  const incluirOcultos = Boolean(opciones?.incluirOcultos);
  const agruparVariantes = opciones?.agruparVariantes !== false;
  const bdInventario = opciones?.bdInventario || null;
  const recetas = await dbAll(
    bdRecetas,
     `SELECT r.id, r.nombre, r.gramaje, r.id_categoria,
           r.tienda_descripcion, r.tienda_modo_uso, r.tienda_cuidados, r.tienda_ingredientes, r.tienda_precio_publico, r.tienda_image_url, r.tienda_galeria,
             c.nombre AS categoria_nombre
      FROM recetas r
      LEFT JOIN categorias c ON c.id = r.id_categoria
     WHERE COALESCE(archivada, 0) = 0
      ORDER BY r.nombre ASC`
  );

  const ingredientesRecetas = await dbAll(
    bdRecetas,
    `SELECT id_receta, nombre_insumo
     FROM ingredientes_receta
     ORDER BY id_receta ASC, id ASC`
  );

  const ingredientesCostoReceta = await dbAll(
    bdRecetas,
    `SELECT id_receta, id_insumo, cantidad, unidad
     FROM ingredientes_receta
     ORDER BY id_receta ASC, id ASC`
  );

  const inventarioCostos = bdInventario
    ? await dbAll(
      bdInventario,
      `SELECT id, unidad, costo_por_unidad
       FROM inventario`
    )
    : [];

  const mapaInsumoCosto = new Map(
    (inventarioCostos || []).map((row) => [Number(row?.id), {
      unidad: String(row?.unidad || '').trim(),
      costo_por_unidad: Number(row?.costo_por_unidad) || 0
    }])
  );

  const mapaPrecioSugeridoReceta = new Map();
  for (const ing of (ingredientesCostoReceta || [])) {
    const idReceta = Number(ing?.id_receta);
    const idInsumo = Number(ing?.id_insumo);
    if (!Number.isFinite(idReceta) || idReceta <= 0) continue;
    if (!Number.isFinite(idInsumo) || idInsumo <= 0) continue;

    const infoInsumo = mapaInsumoCosto.get(idInsumo);
    if (!infoInsumo) continue;

    const cantidad = Number(ing?.cantidad) || 0;
    const unidadReceta = String(ing?.unidad || '').trim();
    const unidadInsumo = String(infoInsumo?.unidad || '').trim();
    const costoUnidad = Number(infoInsumo?.costo_por_unidad) || 0;
    if (cantidad <= 0 || !unidadReceta || !unidadInsumo || costoUnidad <= 0) continue;

    const cantidadConvertida = convertirCantidad(cantidad, unidadReceta, unidadInsumo);
    if (!Number.isFinite(cantidadConvertida) || cantidadConvertida <= 0) continue;

    const costoIngrediente = cantidadConvertida * costoUnidad;
    mapaPrecioSugeridoReceta.set(idReceta, (mapaPrecioSugeridoReceta.get(idReceta) || 0) + costoIngrediente);
  }

  const mapaIngredientesReceta = new Map();
  for (const ing of ingredientesRecetas || []) {
    const idReceta = Number(ing?.id_receta);
    if (!Number.isFinite(idReceta) || idReceta <= 0) continue;
    const nombreInsumo = String(ing?.nombre_insumo || '').trim();
    if (!nombreInsumo) continue;
    if (!mapaIngredientesReceta.has(idReceta)) {
      mapaIngredientesReceta.set(idReceta, []);
    }
    mapaIngredientesReceta.get(idReceta).push(nombreInsumo);
  }

  const producidos = await dbAll(
    bdProduccion,
    `SELECT nombre_receta,
            SUM(COALESCE(cantidad,0)) AS stock,
            MAX(fecha_produccion) AS ultima_produccion,
            COALESCE((
              SELECT p2.precio_venta
              FROM produccion p2
              WHERE p2.nombre_receta = p.nombre_receta
              ORDER BY datetime(COALESCE(p2.fecha_produccion, '1970-01-01T00:00:00Z')) DESC, p2.id DESC
              LIMIT 1
            ), 0) AS precio_venta
     FROM produccion
     AS p
     GROUP BY nombre_receta
     ORDER BY ultima_produccion DESC`
  );

  const mapaProduccion = new Map(
    (producidos || []).map((item) => [String(item?.nombre_receta || '').trim(), item])
  );

  const mapaProduccionBase = new Map();
  for (const item of (producidos || [])) {
    const nombre = String(item?.nombre_receta || '').trim();
    if (!nombre) continue;
    const base = nombreBaseProducto(nombre, 0);
    if (!base) continue;

    const existente = mapaProduccionBase.get(base) || { stock: 0, precio_venta: 0, ultima_produccion: null };
    existente.stock += Number(item?.stock) || 0;
    const fechaItem = String(item?.ultima_produccion || '');
    const fechaExistente = String(existente?.ultima_produccion || '');
    if (!fechaExistente || fechaItem >= fechaExistente) {
      existente.precio_venta = Number(item?.precio_venta) || 0;
      existente.ultima_produccion = item?.ultima_produccion || null;
    }
    mapaProduccionBase.set(base, existente);
  }

  const catalogoRows = await dbAll(
    bdVentas,
    `SELECT receta_nombre, slug, descripcion, image_url, ingredientes, variantes, activo,
            es_lanzamiento, es_favorito, es_oferta, es_accesorio
     FROM tienda_catalogo`
  );

  const mapaCatalogo = new Map(
    (catalogoRows || []).map((row) => [String(row?.receta_nombre || '').trim(), row])
  );

  const mapaResenas = await obtenerResumenResenas(bdVentas);

  const salidaFlat = [];
  for (const receta of recetas) {
    const nombreReceta = String(receta?.nombre || "").trim();
    if (!nombreReceta) continue;

    const prod = mapaProduccion.get(nombreReceta) || null;
    const prodBase = mapaProduccionBase.get(nombreBaseProducto(nombreReceta, receta?.gramaje)) || null;
    const catalogo = mapaCatalogo.get(nombreReceta) || null;
    const visibleCatalogo = catalogo ? Number(catalogo.activo) !== 0 : true;
    if (!visibleCatalogo && !incluirOcultos) continue;

    const stock = Number(prod?.stock) || 0;
    const ingredientesAuto = Array.from(new Set(mapaIngredientesReceta.get(Number(receta?.id)) || []));
    const ingredientesTienda = lineasTexto(receta?.tienda_ingredientes);
    const galeriaTienda = parseJSON(receta?.tienda_galeria, []);
    const galeria = Array.isArray(galeriaTienda) ? galeriaTienda.map((item) => String(item || '').trim()).filter(Boolean) : [];
    const imagenPrincipal = String(receta?.tienda_image_url || catalogo?.image_url || galeria[0] || "");

    salidaFlat.push({
      receta_id: receta?.id || null,
      categoria_id: receta?.id_categoria || null,
      categoria_nombre: String(receta?.categoria_nombre || '').trim(),
      nombre_receta: nombreReceta,
      nombre_base: nombreBaseProducto(nombreReceta, receta?.gramaje),
      slug: String(catalogo?.slug || slugify(nombreReceta)),
      visible_publico: visibleCatalogo,
      stock,
      disponible: stock > 0,
      activo: stock > 0,
      precio_venta: (
        Number(prod?.precio_venta)
        || Number(prodBase?.precio_venta)
        || Number(Math.ceil(((Number(mapaPrecioSugeridoReceta.get(Number(receta?.id)) || 0) * 1.15 * 2.5) / 5)) * 5)
        || Number(receta?.tienda_precio_publico)
        || 0
      ),
      gramaje: Number(receta?.gramaje) || 0,
      descripcion: String(receta?.tienda_descripcion || catalogo?.descripcion || ""),
      modo_uso: String(receta?.tienda_modo_uso || ""),
      cuidados: String(receta?.tienda_cuidados || ""),
      image_url: imagenPrincipal,
      galeria,
      ingredientes: ingredientesTienda.length ? ingredientesTienda : parseJSON(catalogo?.ingredientes, ingredientesAuto),
      variantes: parseJSON(catalogo?.variantes, []),
      es_lanzamiento: Number(catalogo?.es_lanzamiento) === 1,
      es_favorito: Number(catalogo?.es_favorito) === 1,
      es_oferta: Number(catalogo?.es_oferta) === 1,
      es_accesorio: Number(catalogo?.es_accesorio) === 1,
      resenas_total: Number(mapaResenas.get(nombreReceta)?.total) || 0,
      resenas_promedio: Number(mapaResenas.get(nombreReceta)?.promedio) || 0,
      ultima_produccion: prod?.ultima_produccion || null
    });
  }

  if (!agruparVariantes) {
    return salidaFlat;
  }

  const grupos = new Map();
  for (const item of salidaFlat) {
    const base = String(item?.nombre_base || item?.nombre_receta || '').trim();
    if (!base) continue;

    if (!grupos.has(base)) {
      const catalogoBase = mapaCatalogo.get(base) || null;
      grupos.set(base, {
        receta_id: item.receta_id,
        categoria_id: item.categoria_id,
        categoria_nombre: item.categoria_nombre,
        nombre_receta: base,
        slug: String(catalogoBase?.slug || slugify(base)),
        visible_publico: catalogoBase ? Number(catalogoBase.activo) !== 0 : true,
        stock: 0,
        disponible: false,
        activo: false,
        precio_venta: 0,
        gramaje: 0,
        descripcion: '',
        modo_uso: '',
        cuidados: '',
        image_url: '',
        galeria: [],
        ingredientes: [],
        variantes: [],
        es_lanzamiento: catalogoBase ? Number(catalogoBase?.es_lanzamiento) === 1 : Boolean(item.es_lanzamiento),
        es_favorito: catalogoBase ? Number(catalogoBase?.es_favorito) === 1 : Boolean(item.es_favorito),
        es_oferta: catalogoBase ? Number(catalogoBase?.es_oferta) === 1 : Boolean(item.es_oferta),
        es_accesorio: catalogoBase ? Number(catalogoBase?.es_accesorio) === 1 : Boolean(item.es_accesorio),
        resenas_total: Number(mapaResenas.get(base)?.total) || 0,
        resenas_promedio: Number(mapaResenas.get(base)?.promedio) || 0,
        ultima_produccion: item.ultima_produccion || null
      });
    }

    const grupo = grupos.get(base);
    grupo.stock += Number(item.stock) || 0;
    if (!grupo.ultima_produccion || String(item.ultima_produccion || '') > String(grupo.ultima_produccion || '')) {
      grupo.ultima_produccion = item.ultima_produccion || grupo.ultima_produccion;
    }

    if (!grupo.descripcion && String(item.descripcion || '').trim()) grupo.descripcion = item.descripcion;
    if (!grupo.modo_uso && String(item.modo_uso || '').trim()) grupo.modo_uso = item.modo_uso;
    if (!grupo.cuidados && String(item.cuidados || '').trim()) grupo.cuidados = item.cuidados;
    if (!grupo.image_url && String(item.image_url || '').trim()) grupo.image_url = item.image_url;
    if ((!Array.isArray(grupo.galeria) || !grupo.galeria.length) && Array.isArray(item.galeria) && item.galeria.length) {
      grupo.galeria = item.galeria;
    }
    if ((!Array.isArray(grupo.ingredientes) || !grupo.ingredientes.length) && Array.isArray(item.ingredientes) && item.ingredientes.length) {
      grupo.ingredientes = item.ingredientes;
    }

    grupo.variantes.push({
      nombre: etiquetaGramaje(item.gramaje, item.nombre_receta),
      receta_nombre: item.nombre_receta,
      gramaje: Number(item.gramaje) || 0,
      precio_venta: Number(item.precio_venta) || 0,
      stock: Number(item.stock) || 0,
      disponible: (Number(item.stock) || 0) > 0,
      visible_publico: Boolean(item.visible_publico)
    });
  }

  const salida = Array.from(grupos.values()).map((grupo) => {
    const variantes = (grupo.variantes || [])
      .filter((v) => incluirOcultos || v.visible_publico)
      .sort((a, b) => (Number(a.gramaje) || 0) - (Number(b.gramaje) || 0));

    const varianteActiva = variantes.find((v) => Number(v.stock) > 0) || variantes[0] || null;
    const stock = variantes.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    return {
      ...grupo,
      variantes,
      stock,
      disponible: stock > 0,
      activo: stock > 0,
      precio_venta: Number(varianteActiva?.precio_venta) || 0,
      gramaje: Number(varianteActiva?.gramaje) || 0,
      visible_publico: incluirOcultos ? Boolean(grupo.visible_publico) : (variantes.length > 0)
    };
  });

  return incluirOcultos ? salida : salida.filter((item) => item.visible_publico);
}

async function crearPreferenciaMercadoPago({ orden, items }) {
  const accessToken = String(process.env.MP_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    return { ok: false, mensaje: "Mercado Pago no configurado (falta MP_ACCESS_TOKEN)" };
  }

  const normalizarUrl = (valor, fallback) => {
    const raw = String(valor || '').trim();
    const url = raw || fallback;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fallback;
      return parsed.toString();
    } catch {
      return fallback;
    }
  };

  const successUrl = normalizarUrl(process.env.MP_SUCCESS_URL, 'https://www.mercadopago.com.mx');
  const pendingUrl = normalizarUrl(process.env.MP_PENDING_URL, 'https://www.mercadopago.com.mx');
  const failureUrl = normalizarUrl(process.env.MP_FAILURE_URL, 'https://www.mercadopago.com.mx');

  const puedeAutoReturn = (() => {
    try {
      const parsed = new URL(successUrl);
      const host = String(parsed.hostname || '').toLowerCase();
      const esLocal = host === 'localhost' || host === '127.0.0.1';
      return parsed.protocol === 'https:' && !esLocal;
    } catch {
      return false;
    }
  })();

  const body = {
    items: items.map((item) => ({
      title: String(item.descripcion_mp || `${String(item.categoria_nombre || '').trim()} - ${String(item.nombre_receta || 'Producto').trim()}`).replace(/^\s*-\s*/, '').trim() || String(item.nombre_receta || "Producto"),
      quantity: Number(item.cantidad) || 1,
      unit_price: Number(item.precio_unitario) || 0,
      currency_id: "MXN"
    })),
    external_reference: orden.folio,
    statement_descriptor: "CHIPACTLI",
    back_urls: {
      success: successUrl,
      pending: pendingUrl,
      failure: failureUrl
    }
  };

  if (puedeAutoReturn) {
    body.auto_return = "approved";
  }

  const respuesta = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!respuesta.ok) {
    const texto = await respuesta.text();
    return { ok: false, mensaje: texto || "No se pudo crear la preferencia de pago" };
  }

  const data = await respuesta.json();
  return {
    ok: true,
    id: data?.id || "",
    init_point: data?.init_point || "",
    sandbox_init_point: data?.sandbox_init_point || ""
  };
}

async function registrarRecuperacionVenta(bdInventario, { fechaVenta, costoProduccion, ganancia }) {
  await dbRun(
    bdInventario,
    "INSERT INTO inversion_recuperada (fecha_venta, costo_recuperado) VALUES (?,?)",
    [fechaVenta, Number(costoProduccion) || 0]
  );

  const inv = await dbGet(
    bdInventario,
    "SELECT COALESCE(SUM(costo_total),0) as inversion_total FROM inventario"
  );
  const rec = await dbGet(
    bdInventario,
    "SELECT COALESCE(SUM(costo_recuperado),0) as inversion_recuperada FROM inversion_recuperada"
  );

  const inversionTotal = Number(inv?.inversion_total) || 0;
  const inversionRecuperada = Number(rec?.inversion_recuperada) || 0;
  if (inversionRecuperada >= inversionTotal && (Number(ganancia) || 0) > 0) {
    await dbRun(
      bdInventario,
      "INSERT INTO recuperado_utensilios (fecha_recuperado, monto_recuperado) VALUES (?,?)",
      [fechaVenta, Number(ganancia) || 0]
    );
    transmitir({ tipo: "utensilios_actualizado" });
  }
}

async function pasarProduccionAVentasPorPedido(bdProduccion, bdVentas, bdInventario, { nombreReceta, cantidadSolicitada, numeroPedido }) {
  let restante = Number(cantidadSolicitada) || 0;
  if (restante <= 0) return { cantidadVendida: 0, cantidadPendiente: 0 };

  const lotes = await dbAll(
    bdProduccion,
    `SELECT id, cantidad, fecha_produccion, costo_produccion, precio_venta
     FROM produccion
     WHERE nombre_receta = ? AND COALESCE(cantidad, 0) > 0
     ORDER BY datetime(COALESCE(fecha_produccion, '1970-01-01T00:00:00Z')) ASC, id ASC`,
    [nombreReceta]
  );

  let cantidadVendida = 0;
  const fechaVenta = new Date().toISOString();

  for (const lote of lotes) {
    if (restante <= 0) break;

    const loteCantidad = Number(lote?.cantidad) || 0;
    if (loteCantidad <= 0) continue;

    const aVender = Math.min(restante, loteCantidad);
    if (aVender <= 0) continue;

    const costoTotalLote = Number(lote?.costo_produccion) || 0;
    const costoUnitario = loteCantidad > 0 ? (costoTotalLote / loteCantidad) : 0;
    const costoVenta = costoUnitario * aVender;
    const precioVenta = Number(lote?.precio_venta) || 0;
    const ganancia = (precioVenta * aVender) - costoVenta;

    await dbRun(
      bdVentas,
      `INSERT INTO ventas (nombre_receta, cantidad, fecha_produccion, fecha_venta, costo_produccion, precio_venta, ganancia, numero_pedido)
       VALUES (?,?,?,?,?,?,?,?)`,
      [nombreReceta, aVender, lote?.fecha_produccion || fechaVenta, fechaVenta, costoVenta, precioVenta, ganancia, numeroPedido || ""]
    );

    await registrarRecuperacionVenta(bdInventario, { fechaVenta, costoProduccion: costoVenta, ganancia });

    const restanteLote = loteCantidad - aVender;
    if (restanteLote <= 0) {
      await dbRun(bdProduccion, "DELETE FROM produccion_descuentos WHERE id_produccion = ?", [lote.id]);
      await dbRun(bdProduccion, "DELETE FROM produccion WHERE id = ?", [lote.id]);
    } else {
      const factorRestante = restanteLote / loteCantidad;
      await dbRun(
        bdProduccion,
        "UPDATE produccion SET cantidad = ?, costo_produccion = ? WHERE id = ?",
        [restanteLote, costoUnitario * restanteLote, lote.id]
      );
      await dbRun(
        bdProduccion,
        "UPDATE produccion_descuentos SET cantidad_descuento = cantidad_descuento * ? WHERE id_produccion = ?",
        [factorRestante, lote.id]
      );
    }

    restante -= aVender;
    cantidadVendida += aVender;
  }

  return {
    cantidadVendida,
    cantidadPendiente: Math.max(0, restante)
  };
}

export function registrarRutasTienda(app, bdProduccion, bdRecetas, bdVentas, bdInventario) {
  app.get('/tienda/config', async (req, res) => {
    try {
      const config = await obtenerConfigTienda(bdVentas);
      res.json(config);
    } catch {
      res.status(500).json({ error: 'No se pudo cargar configuración de tienda' });
    }
  });

  app.get('/tienda/admin/config', authInterno, async (req, res) => {
    try {
      const config = await obtenerConfigTienda(bdVentas);
      res.json(config);
    } catch {
      res.status(500).json({ error: 'No se pudo cargar configuración' });
    }
  });

  app.post('/tienda/admin/config', authInterno, async (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const entries = Object.entries(body);
      for (const [claveRaw, valorRaw] of entries) {
        const clave = String(claveRaw || '').trim();
        if (!clave) continue;
        const valor = String(valorRaw ?? '').trim();
        await dbRun(
          bdVentas,
          `INSERT INTO tienda_config (clave, valor, actualizado_en)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = CURRENT_TIMESTAMP`,
          [clave, valor]
        );
      }
      const config = await obtenerConfigTienda(bdVentas);
      res.json({ ok: true, config });
    } catch {
      res.status(500).json({ error: 'No se pudo guardar configuración' });
    }
  });

  app.get("/tienda/puntos-entrega", async (req, res) => {
    try {
      const puntos = await dbAll(
        bdVentas,
        "SELECT id, nombre, direccion, horario, activo FROM tienda_puntos_entrega WHERE activo = 1 ORDER BY nombre"
      );
      res.json(puntos || []);
    } catch {
      res.status(500).json({ error: "No se pudieron cargar puntos de entrega" });
    }
  });

  app.get("/tienda/admin/puntos-entrega", authInterno, async (req, res) => {
    try {
      const puntos = await dbAll(
        bdVentas,
        "SELECT id, nombre, direccion, horario, activo, actualizado_en FROM tienda_puntos_entrega ORDER BY nombre"
      );
      res.json(puntos || []);
    } catch {
      res.status(500).json({ error: "No se pudieron cargar los puntos" });
    }
  });

  app.post("/tienda/admin/puntos-entrega", authInterno, async (req, res) => {
    try {
      const nombre = String(req.body?.nombre || "").trim();
      const direccion = String(req.body?.direccion || "").trim();
      const horario = String(req.body?.horario || "").trim();
      const activo = req.body?.activo === false ? 0 : 1;
      if (!nombre) return res.status(400).json({ error: "Nombre obligatorio" });

      const creado = await dbRun(
        bdVentas,
        `INSERT INTO tienda_puntos_entrega (nombre, direccion, horario, activo, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [nombre, direccion, horario, activo]
      );
      res.json({ ok: true, id: creado.lastID });
    } catch {
      res.status(500).json({ error: "No se pudo crear el punto" });
    }
  });

  app.patch("/tienda/admin/puntos-entrega/:id", authInterno, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Punto inválido" });

      const nombre = String(req.body?.nombre || "").trim();
      const direccion = String(req.body?.direccion || "").trim();
      const horario = String(req.body?.horario || "").trim();
      const activo = req.body?.activo === false ? 0 : 1;

      await dbRun(
        bdVentas,
        `UPDATE tienda_puntos_entrega
         SET nombre = ?, direccion = ?, horario = ?, activo = ?, actualizado_en = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nombre, direccion, horario, activo, id]
      );

      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "No se pudo actualizar el punto" });
    }
  });

  app.delete("/tienda/admin/puntos-entrega/:id", authInterno, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Punto inválido" });
      await dbRun(bdVentas, "DELETE FROM tienda_puntos_entrega WHERE id = ?", [id]);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "No se pudo eliminar el punto" });
    }
  });

  app.get("/tienda/admin/clientes", authInterno, async (req, res) => {
    try {
      const clientes = await dbAll(
        bdVentas,
        "SELECT id, nombre, email, telefono, direccion_default, forma_pago_preferida, creado_en, actualizado_en FROM tienda_clientes ORDER BY id DESC"
      );
      res.json(clientes || []);
    } catch {
      res.status(500).json({ error: "No se pudieron cargar clientes" });
    }
  });

  app.get("/tienda/admin/ordenes", authInterno, async (req, res) => {
    try {
      const ordenes = await dbAll(
        bdVentas,
        `SELECT id, folio, nombre_cliente, email_cliente, telefono_cliente, metodo_pago, estado, total, moneda,
                id_punto_entrega, nombre_punto_entrega, direccion_entrega, notas, creado_en
         FROM tienda_ordenes
         ORDER BY id DESC`
      );
      res.json(ordenes || []);
    } catch {
      res.status(500).json({ error: "No se pudieron cargar órdenes" });
    }
  });

  app.patch("/tienda/admin/ordenes/:id/estado", authInterno, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const estado = String(req.body?.estado || "").trim().toLowerCase();
      const permitidos = new Set(["pendiente", "procesando", "entregado", "cancelado"]);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Orden inválida" });
      if (!permitidos.has(estado)) return res.status(400).json({ error: "Estado inválido" });

      const resultado = await dbRun(
        bdVentas,
        "UPDATE tienda_ordenes SET estado = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?",
        [estado, id]
      );

      if (!resultado.changes) return res.status(404).json({ error: "Orden no encontrada" });
      transmitir({ tipo: 'tienda_orden_actualizada', id_orden: id, estado });
      transmitir({ tipo: 'ventas_actualizado' });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "No se pudo actualizar estado" });
    }
  });

  app.post("/tienda/auth/register", async (req, res) => {
    try {
      const nombre = String(req.body?.nombre || "").trim();
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      const telefono = String(req.body?.telefono || "").trim();

      if (!nombre || !email || !password) {
        return res.status(400).json({ exito: false, mensaje: "Nombre, email y contraseña son obligatorios" });
      }

      const existente = await dbGet(bdVentas, "SELECT id FROM tienda_clientes WHERE email = ?", [email]);
      if (existente) {
        return res.status(409).json({ exito: false, mensaje: "Ese correo ya está registrado" });
      }

      const hash = await bcrypt.hash(password, 10);
      const creado = await dbRun(
        bdVentas,
        `INSERT INTO tienda_clientes (nombre, email, password_hash, telefono, direccion_default, forma_pago_preferida, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, '', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [nombre, email, hash, telefono]
      );

      const cliente = { id: creado.lastID, nombre, email };
      const token = crearTokenCliente(cliente);
      return res.json({ exito: true, token, cliente });
    } catch (error) {
      return res.status(500).json({ exito: false, mensaje: "No se pudo registrar el cliente" });
    }
  });

  app.post("/tienda/auth/login", async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      if (!email || !password) {
        return res.status(400).json({ exito: false, mensaje: "Email y contraseña son obligatorios" });
      }

      const cliente = await dbGet(bdVentas, "SELECT * FROM tienda_clientes WHERE email = ?", [email]);
      if (!cliente) {
        return res.status(401).json({ exito: false, mensaje: "Credenciales inválidas" });
      }

      const match = await bcrypt.compare(password, cliente.password_hash || "");
      if (!match) {
        return res.status(401).json({ exito: false, mensaje: "Credenciales inválidas" });
      }

      const token = crearTokenCliente(cliente);
      return res.json({
        exito: true,
        token,
        cliente: {
          id: cliente.id,
          nombre: cliente.nombre,
          email: cliente.email,
          telefono: cliente.telefono || "",
          direccion_default: cliente.direccion_default || "",
          forma_pago_preferida: cliente.forma_pago_preferida || ""
        }
      });
    } catch {
      return res.status(500).json({ exito: false, mensaje: "No se pudo iniciar sesión" });
    }
  });

  app.get("/tienda/auth/perfil", authCliente, async (req, res) => {
    try {
      const cliente = await dbGet(
        bdVentas,
        "SELECT id, nombre, email, telefono, direccion_default, forma_pago_preferida FROM tienda_clientes WHERE id = ?",
        [req.cliente.id]
      );
      if (!cliente) return res.status(404).json({ exito: false, mensaje: "Cliente no encontrado" });
      return res.json({ exito: true, cliente });
    } catch {
      return res.status(500).json({ exito: false, mensaje: "No se pudo cargar el perfil" });
    }
  });

  app.patch("/tienda/auth/perfil", authCliente, async (req, res) => {
    try {
      const nombre = String(req.body?.nombre || "").trim();
      const telefono = String(req.body?.telefono || "").trim();
      const direccionDefault = String(req.body?.direccion_default || "").trim();
      const formaPago = String(req.body?.forma_pago_preferida || "").trim();

      await dbRun(
        bdVentas,
        `UPDATE tienda_clientes
         SET nombre = COALESCE(NULLIF(?, ''), nombre),
             telefono = ?,
             direccion_default = ?,
             forma_pago_preferida = ?,
             actualizado_en = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nombre, telefono, direccionDefault, formaPago, req.cliente.id]
      );

      const cliente = await dbGet(
        bdVentas,
        "SELECT id, nombre, email, telefono, direccion_default, forma_pago_preferida FROM tienda_clientes WHERE id = ?",
        [req.cliente.id]
      );
      return res.json({ exito: true, cliente });
    } catch {
      return res.status(500).json({ exito: false, mensaje: "No se pudo actualizar el perfil" });
    }
  });

  app.get("/tienda/productos", async (req, res) => {
    try {
      const productos = await obtenerProductosDisponibles(bdProduccion, bdRecetas, bdVentas, { bdInventario });
      res.json(productos);
    } catch {
      res.status(500).json({ error: "Error al cargar productos" });
    }
  });

  app.get("/tienda/admin/productos", authInterno, async (req, res) => {
    try {
      const productos = await obtenerProductosDisponibles(bdProduccion, bdRecetas, bdVentas, { incluirOcultos: true, bdInventario });
      res.json(productos);
    } catch {
      res.status(500).json({ error: "Error al cargar productos admin" });
    }
  });

  app.get("/tienda/productos/:slug", async (req, res) => {
    try {
      const slug = String(req.params.slug || "").trim().toLowerCase();
      const productos = await obtenerProductosDisponibles(bdProduccion, bdRecetas, bdVentas, { bdInventario });
      const producto = productos.find((p) => String(p.slug || "").toLowerCase() === slug);
      if (!producto) return res.status(404).json({ error: "Producto no encontrado" });
      res.json(producto);
    } catch {
      res.status(500).json({ error: "Error al cargar producto" });
    }
  });

  app.get('/tienda/resenas', async (req, res) => {
    try {
      const recetaNombre = String(req.query?.receta_nombre || '').trim();
      if (!recetaNombre) {
        return res.status(400).json({ error: 'receta_nombre es obligatorio' });
      }

      const resenas = await dbAll(
        bdVentas,
        `SELECT id, receta_nombre, nombre_cliente, calificacion, comentario, creado_en
         FROM tienda_resenas
         WHERE receta_nombre = ?
         ORDER BY id DESC
         LIMIT 100`,
        [recetaNombre]
      );

      const resumen = await dbGet(
        bdVentas,
        `SELECT COUNT(*) AS total, ROUND(AVG(COALESCE(calificacion, 0)), 2) AS promedio
         FROM tienda_resenas
         WHERE receta_nombre = ?`,
        [recetaNombre]
      );

      return res.json({
        receta_nombre: recetaNombre,
        resumen: {
          total: Number(resumen?.total) || 0,
          promedio: Number(resumen?.promedio) || 0
        },
        resenas: resenas || []
      });
    } catch {
      return res.status(500).json({ error: 'No se pudieron cargar las reseñas' });
    }
  });

  app.post('/tienda/resenas', authCliente, async (req, res) => {
    try {
      const recetaNombre = String(req.body?.receta_nombre || '').trim();
      const comentario = String(req.body?.comentario || '').trim();
      const calificacion = Math.round(Number(req.body?.calificacion) || 0);

      if (!recetaNombre) return res.status(400).json({ error: 'receta_nombre es obligatorio' });
      if (calificacion < 1 || calificacion > 5) return res.status(400).json({ error: 'La calificación debe ser entre 1 y 5' });
      if (comentario.length < 3) return res.status(400).json({ error: 'Comentario demasiado corto' });

      const cliente = await dbGet(
        bdVentas,
        'SELECT id, nombre FROM tienda_clientes WHERE id = ?',
        [req.cliente.id]
      );
      if (!cliente) return res.status(401).json({ error: 'Cliente inválido' });

      const insert = await dbRun(
        bdVentas,
        `INSERT INTO tienda_resenas (receta_nombre, id_cliente, nombre_cliente, calificacion, comentario, creado_en)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [recetaNombre, cliente.id, String(cliente?.nombre || '').trim() || 'Cliente', calificacion, comentario]
      );

      const resumen = await dbGet(
        bdVentas,
        `SELECT COUNT(*) AS total, ROUND(AVG(COALESCE(calificacion, 0)), 2) AS promedio
         FROM tienda_resenas
         WHERE receta_nombre = ?`,
        [recetaNombre]
      );

      return res.json({
        ok: true,
        id: insert.lastID,
        resumen: {
          total: Number(resumen?.total) || 0,
          promedio: Number(resumen?.promedio) || 0
        }
      });
    } catch {
      return res.status(500).json({ error: 'No se pudo guardar la reseña' });
    }
  });

  app.get("/tienda/catalogo", async (req, res) => {
    try {
      const rows = await dbAll(
        bdVentas,
        `SELECT receta_nombre, slug, descripcion, image_url, ingredientes, variantes,
          es_lanzamiento, es_favorito, es_oferta, es_accesorio, activo
         FROM tienda_catalogo
         ORDER BY receta_nombre`
      );
      res.json(
        rows.map((row) => ({
          ...row,
          ingredientes: parseJSON(row.ingredientes, []),
          variantes: parseJSON(row.variantes, []),
          es_lanzamiento: Number(row?.es_lanzamiento) === 1,
          es_favorito: Number(row?.es_favorito) === 1,
          es_oferta: Number(row?.es_oferta) === 1,
          es_accesorio: Number(row?.es_accesorio) === 1
        }))
      );
    } catch {
      res.status(500).json({ error: "Error al cargar catálogo" });
    }
  });

  app.post("/tienda/catalogo/upsert", async (req, res) => {
    try {
      const recetaNombre = String(req.body?.receta_nombre || "").trim();
      if (!recetaNombre) return res.status(400).json({ error: "receta_nombre es obligatorio" });

      const previo = await dbGet(
        bdVentas,
        `SELECT slug, descripcion, image_url, ingredientes, variantes,
                es_lanzamiento, es_favorito, es_oferta, es_accesorio, activo
         FROM tienda_catalogo WHERE receta_nombre = ? LIMIT 1`,
        [recetaNombre]
      );

      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const slug = tieneClave(body, 'slug')
        ? slugify(body.slug || recetaNombre)
        : slugify(previo?.slug || recetaNombre);
      const descripcion = tieneClave(body, 'descripcion')
        ? String(body.descripcion || '').trim()
        : String(previo?.descripcion || '').trim();
      const imageUrl = tieneClave(body, 'image_url')
        ? String(body.image_url || '').trim()
        : String(previo?.image_url || '').trim();
      const ingredientes = JSON.stringify(
        tieneClave(body, 'ingredientes')
          ? (Array.isArray(body.ingredientes) ? body.ingredientes : [])
          : parseJSON(previo?.ingredientes, [])
      );
      const variantes = JSON.stringify(
        tieneClave(body, 'variantes')
          ? (Array.isArray(body.variantes) ? body.variantes : [])
          : parseJSON(previo?.variantes, [])
      );
      const esLanzamiento = tieneClave(body, 'es_lanzamiento') ? boolToInt(body.es_lanzamiento) : boolToInt(previo?.es_lanzamiento);
      const esFavorito = tieneClave(body, 'es_favorito') ? boolToInt(body.es_favorito) : boolToInt(previo?.es_favorito);
      const esOferta = tieneClave(body, 'es_oferta') ? boolToInt(body.es_oferta) : boolToInt(previo?.es_oferta);
      const esAccesorio = tieneClave(body, 'es_accesorio') ? boolToInt(body.es_accesorio) : boolToInt(previo?.es_accesorio);
      const activo = tieneClave(body, 'activo') ? (body.activo === false ? 0 : 1) : (Number(previo?.activo) === 0 ? 0 : 1);

      await dbRun(
        bdVentas,
        `INSERT INTO tienda_catalogo (receta_nombre, slug, descripcion, image_url, ingredientes, variantes, es_lanzamiento, es_favorito, es_oferta, es_accesorio, activo, actualizado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(receta_nombre) DO UPDATE SET
           slug = excluded.slug,
           descripcion = excluded.descripcion,
           image_url = excluded.image_url,
           ingredientes = excluded.ingredientes,
           variantes = excluded.variantes,
           es_lanzamiento = excluded.es_lanzamiento,
           es_favorito = excluded.es_favorito,
           es_oferta = excluded.es_oferta,
           es_accesorio = excluded.es_accesorio,
           activo = excluded.activo,
           actualizado_en = CURRENT_TIMESTAMP`,
        [recetaNombre, slug, descripcion, imageUrl, ingredientes, variantes, esLanzamiento, esFavorito, esOferta, esAccesorio, activo]
      );

      res.json({ ok: true, slug });
    } catch {
      res.status(500).json({ error: "No se pudo guardar el catálogo" });
    }
  });

  app.post("/tienda/ordenes", authCliente, async (req, res) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      const metodoPago = String(req.body?.metodo_pago || "").trim() || "efectivo";
      const idPuntoEntrega = Number(req.body?.id_punto_entrega);
      const notas = String(req.body?.notas || "").trim();

      if (!items.length) return res.status(400).json({ error: "El carrito está vacío" });

      const disponibles = await obtenerProductosDisponibles(bdProduccion, bdRecetas, bdVentas, { agruparVariantes: false, bdInventario });
      const mapa = new Map(disponibles.map((p) => [String(p.nombre_receta), p]));

      const itemsFinales = [];
      let total = 0;
      const mapaStockTemporal = new Map();

      for (const item of items) {
        const nombreReceta = String(item?.nombre_receta || "").trim();
        const cantidad = Math.max(1, Number(item?.cantidad) || 1);
        const variante = String(item?.variante || "").trim();
        const producto = mapa.get(nombreReceta);

        if (!producto) {
          return res.status(400).json({ error: `Producto no disponible: ${nombreReceta}` });
        }

        const stockDisponibleInicial = Number(producto.stock) || 0;
        const stockDisponibleTemporal = mapaStockTemporal.has(nombreReceta)
          ? Number(mapaStockTemporal.get(nombreReceta)) || 0
          : stockDisponibleInicial;
        const cantidadAutoVenta = Math.max(0, Math.min(stockDisponibleTemporal, cantidad));
        mapaStockTemporal.set(nombreReceta, Math.max(0, stockDisponibleTemporal - cantidadAutoVenta));

        const precioUnitario = Number(producto.precio_venta) || 0;
        const subtotal = precioUnitario * cantidad;
        total += subtotal;

        itemsFinales.push({
          nombre_receta: nombreReceta,
          categoria_nombre: String(producto?.categoria_nombre || item?.categoria_nombre || '').trim(),
          descripcion_mp: String(item?.descripcion_mp || '').trim(),
          cantidad,
          cantidad_auto_venta: cantidadAutoVenta,
          precio_unitario: precioUnitario,
          subtotal,
          variante
        });
      }

      const cliente = await dbGet(
        bdVentas,
        "SELECT id, nombre, email, telefono FROM tienda_clientes WHERE id = ?",
        [req.cliente.id]
      );
      if (!cliente) return res.status(401).json({ error: "Cliente inválido" });

      const puntoEntrega = await dbGet(
        bdVentas,
        "SELECT id, nombre, direccion, horario, activo FROM tienda_puntos_entrega WHERE id = ?",
        [idPuntoEntrega]
      );
      if (!puntoEntrega || Number(puntoEntrega.activo) !== 1) {
        return res.status(400).json({ error: "Selecciona un punto de entrega válido" });
      }

      const direccionEntrega = [
        String(puntoEntrega.nombre || '').trim(),
        String(puntoEntrega.direccion || '').trim(),
        String(puntoEntrega.horario || '').trim()
      ].filter(Boolean).join(' · ');

      const folio = `ORD-${Date.now()}`;
      const insertOrden = await dbRun(
        bdVentas,
        `INSERT INTO tienda_ordenes
         (folio, id_cliente, nombre_cliente, email_cliente, telefono_cliente, metodo_pago, estado, total, moneda, referencia_externa, detalle_pago, id_punto_entrega, nombre_punto_entrega, direccion_entrega, notas, creado_en)
         VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?, 'MXN', '', '', ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          folio,
          cliente.id,
          cliente.nombre,
          cliente.email,
          cliente.telefono || '',
          metodoPago,
          total,
          puntoEntrega.id,
          String(puntoEntrega.nombre || ''),
          direccionEntrega,
          notas
        ]
      );

      for (const item of itemsFinales) {
        await dbRun(
          bdVentas,
          `INSERT INTO tienda_orden_items (id_orden, receta_nombre, cantidad, precio_unitario, subtotal, variante)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [insertOrden.lastID, item.nombre_receta, item.cantidad, item.precio_unitario, item.subtotal, item.variante]
        );
      }

      let cantidadAutoVendida = 0;
      for (const item of itemsFinales) {
        const cantidadSolicitada = Number(item?.cantidad_auto_venta) || 0;
        if (cantidadSolicitada <= 0) continue;

        const mov = await pasarProduccionAVentasPorPedido(
          bdProduccion,
          bdVentas,
          bdInventario,
          {
            nombreReceta: item.nombre_receta,
            cantidadSolicitada,
            numeroPedido: folio
          }
        );

        cantidadAutoVendida += Number(mov?.cantidadVendida) || 0;
      }

      let checkout = null;
      if (metodoPago.toLowerCase() === "mercado_pago") {
        const preferencia = await crearPreferenciaMercadoPago({ orden: { folio, id: insertOrden.lastID }, items: itemsFinales });
        if (preferencia.ok) {
          checkout = {
            proveedor: "mercado_pago",
            preference_id: preferencia.id,
            init_point: preferencia.init_point,
            sandbox_init_point: preferencia.sandbox_init_point
          };
          await dbRun(
            bdVentas,
            "UPDATE tienda_ordenes SET referencia_externa = ?, detalle_pago = ? WHERE id = ?",
            [preferencia.id || '', JSON.stringify(checkout), insertOrden.lastID]
          );
        } else {
          checkout = { proveedor: "mercado_pago", error: preferencia.mensaje || "No disponible" };
        }
      }

      transmitir({
        tipo: 'tienda_orden_nueva',
        id_orden: insertOrden.lastID,
        folio,
        total,
        cliente: cliente.nombre,
        metodo_pago: metodoPago
      });
      if (cantidadAutoVendida > 0) {
        transmitir({ tipo: 'produccion_actualizado' });
      }
      transmitir({ tipo: 'ventas_actualizado' });

      res.json({
        ok: true,
        orden: {
          id: insertOrden.lastID,
          folio,
          total,
          metodo_pago: metodoPago,
          estado: "pendiente"
        },
        checkout
      });
    } catch {
      res.status(500).json({ error: "No se pudo crear la orden" });
    }
  });

  app.get("/tienda/ordenes/mis", authCliente, async (req, res) => {
    try {
      const ordenes = await dbAll(
        bdVentas,
        "SELECT id, folio, metodo_pago, estado, total, moneda, referencia_externa, detalle_pago, creado_en FROM tienda_ordenes WHERE id_cliente = ? ORDER BY id DESC",
        [req.cliente.id]
      );
      res.json(ordenes);
    } catch {
      res.status(500).json({ error: "No se pudieron cargar las órdenes" });
    }
  });
}
