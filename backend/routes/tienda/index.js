import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { convertirCantidadDetallada } from "../../utils/index.js";
import { transmitir } from "../../utils/index.js";

const TIENDA_JWT_SECRET = process.env.TIENDA_JWT_SECRET || process.env.JWT_SECRET || "chipactli_tienda_jwt_secret";
const PREFIJO_FOLIO_TIENDA_WEB = 'CHIVT';
const PREFIJO_FOLIO_TIENDA_APP = 'CHIAPP';
const LONGITUD_CONSECUTIVO_TIENDA = 6;
const ESTADOS_PAGO_PERMITIDOS = new Set(['pendiente', 'pendiente_manual', 'pagado', 'rechazado', 'reembolsado']);

let mailTransporter = null;

function obtenerConfigCorreo() {
  const mailEnabled = String(process.env.MAIL_ENABLED || '1').trim() !== '0';
  const host = String(process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || (port === 465 ? '1' : '0')).trim() !== '0';
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const from = String(process.env.SMTP_FROM || user || '').trim();

  return {
    MAIL_ENABLED: mailEnabled,
    SMTP_HOST: host,
    SMTP_PORT: port,
    SMTP_SECURE: secure,
    SMTP_USER: user,
    SMTP_PASS: pass,
    SMTP_FROM: from
  };
}

function correoConfigurado() {
  const cfg = obtenerConfigCorreo();
  return Boolean(cfg.MAIL_ENABLED && cfg.SMTP_USER && cfg.SMTP_PASS && cfg.SMTP_FROM);
}

function obtenerMailTransporter() {
  const cfg = obtenerConfigCorreo();
  if (mailTransporter) return mailTransporter;
  mailTransporter = nodemailer.createTransport({
    host: cfg.SMTP_HOST,
    port: cfg.SMTP_PORT,
    secure: cfg.SMTP_SECURE,
    auth: {
      user: cfg.SMTP_USER,
      pass: cfg.SMTP_PASS
    }
  });
  return mailTransporter;
}

function formatearMonedaMXN(valor) {
  const numero = Number(valor) || 0;
  return numero.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function escaparHtml(valor = '') {
  return String(valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function resolverUrlLogoCorreo() {
  const logoConfigRaw = String(process.env.MAIL_LOGO_URL || '').trim();
  const basePublica = String(
    process.env.APP_BASE_URL
    || process.env.FRONTEND_BASE_URL
    || process.env.WEB_BASE_URL
    || process.env.RENDER_EXTERNAL_URL
    || ''
  ).trim().replace(/\/+$/, '');

  if (logoConfigRaw) {
    if (/^https?:\/\//i.test(logoConfigRaw)) return logoConfigRaw;
    if (/^cid:/i.test(logoConfigRaw) || /^data:/i.test(logoConfigRaw)) return logoConfigRaw;
    if (logoConfigRaw.startsWith('/')) {
      return basePublica ? `${basePublica}${logoConfigRaw}` : '';
    }
    return '';
  }

  if (basePublica) return `${basePublica}/images/logo.png`;
  return '';
}

function layoutCorreoChipactli({ titulo = '', saludo = '', intro = '', bloquesHtml = '', cierre = '' }) {
  const logoUrl = resolverUrlLogoCorreo();
  const anio = new Date().getFullYear();
  return `
    <div style="margin:0;padding:0;background:#f5f7f2;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7f2;padding:18px 8px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e7eadf;border-radius:14px;overflow:hidden;">
              <tr>
                <td style="padding:18px 22px;background:linear-gradient(135deg,#24593f,#3d7a56);color:#ffffff;font-family:Arial,sans-serif;">
                  ${logoUrl ? `<div style="margin:0 0 10px 0;"><img src="${escaparHtml(logoUrl)}" alt="CHIPACTLI" style="display:block;width:72px;height:72px;object-fit:cover;border-radius:999px;border:2px solid rgba(255,255,255,0.55);background:#ffffff;" /></div>` : ''}
                  <div style="font-size:12px;letter-spacing:1.1px;opacity:.9;text-transform:uppercase;">CHIPACTLI</div>
                  <div style="font-size:22px;font-weight:800;line-height:1.2;margin-top:4px;">${escaparHtml(titulo)}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:22px;font-family:Arial,sans-serif;color:#1f2937;line-height:1.58;">
                  <p style="margin:0 0 10px 0;">${escaparHtml(saludo)}</p>
                  <p style="margin:0 0 14px 0;">${escaparHtml(intro)}</p>
                  ${bloquesHtml || ''}
                  <p style="margin:16px 0 0 0;">${escaparHtml(cierre || 'Gracias por comprar en CHIPACTLI.')}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 22px;background:#f3f6ef;border-top:1px solid #e7eadf;color:#5b6675;font-family:Arial,sans-serif;font-size:12px;">
                  Este es un correo automatico de CHIPACTLI. ${anio}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function renderTemplate(textoPlantilla = '', variables = {}) {
  const base = String(textoPlantilla || '');
  return base.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const valor = variables?.[key];
    return valor === undefined || valor === null ? '' : String(valor);
  });
}

function textoPlanoAHtmlLineas(texto = '') {
  return escaparHtml(String(texto || '')).replace(/\r?\n/g, '<br/>');
}

function obtenerPlantillasCorreoDesdeConfig(config = {}) {
  return {
    bienvenida_asunto: String(config?.correo_bienvenida_asunto || CONFIG_DEFAULT.correo_bienvenida_asunto),
    bienvenida_cuerpo: String(config?.correo_bienvenida_cuerpo || CONFIG_DEFAULT.correo_bienvenida_cuerpo),
    confirmacion_asunto: String(config?.correo_confirmacion_asunto || CONFIG_DEFAULT.correo_confirmacion_asunto),
    confirmacion_cuerpo: String(config?.correo_confirmacion_cuerpo || CONFIG_DEFAULT.correo_confirmacion_cuerpo),
    confirmacion_cuerpo_contraentrega: String(config?.correo_confirmacion_cuerpo_contraentrega || CONFIG_DEFAULT.correo_confirmacion_cuerpo_contraentrega),
    estado_asunto: String(config?.correo_estado_asunto || CONFIG_DEFAULT.correo_estado_asunto),
    estado_cuerpo: String(config?.correo_estado_cuerpo || CONFIG_DEFAULT.correo_estado_cuerpo),
    diagnostico_asunto: String(config?.correo_diagnostico_asunto || CONFIG_DEFAULT.correo_diagnostico_asunto),
    diagnostico_cuerpo: String(config?.correo_diagnostico_cuerpo || CONFIG_DEFAULT.correo_diagnostico_cuerpo),
    campana_asunto: String(config?.correo_campana_asunto || CONFIG_DEFAULT.correo_campana_asunto),
    campana_cuerpo: String(config?.correo_campana_cuerpo || CONFIG_DEFAULT.correo_campana_cuerpo),
    transferencia_clabe: String(config?.transferencia_clabe || CONFIG_DEFAULT.transferencia_clabe)
  };
}

function construirCorreoBienvenida({ nombreCliente, emailCliente, urlTienda, plantillas = {} }) {
  const nombre = String(nombreCliente || 'cliente').trim() || 'cliente';
  const correo = String(emailCliente || '').trim();
  const url = String(urlTienda || '').trim() || 'https://chipactli.onrender.com/';

  const vars = {
    nombre_cliente: nombre,
    email_cliente: correo,
    url_tienda: url
  };

  const subject = renderTemplate(plantillas?.bienvenida_asunto || CONFIG_DEFAULT.correo_bienvenida_asunto, vars).trim() || 'Bienvenido a CHIPACTLI';
  const text = renderTemplate(plantillas?.bienvenida_cuerpo || CONFIG_DEFAULT.correo_bienvenida_cuerpo, vars).trim();

  const bloquesHtml = `
    <div style="background:#f3f7f2;border:1px solid #dce8dc;border-radius:10px;padding:12px 14px;margin:0 0 12px 0;">
      <div><strong>Cuenta creada con éxito</strong></div>
      <div>Ya puedes iniciar sesión y comenzar a comprar en nuestra tienda.</div>
      <div style="margin-top:8px;"><a href="${escaparHtml(url)}" target="_blank" rel="noreferrer" style="display:inline-block;background:#24593f;color:#ffffff;text-decoration:none;padding:8px 12px;border-radius:8px;">Ir a la tienda</a></div>
    </div>
  `;

  const html = layoutCorreoChipactli({
    titulo: 'Bienvenido a CHIPACTLI',
    saludo: `Hola ${nombre},`,
    intro: 'Gracias por registrarte con nosotros.',
    bloquesHtml: `${bloquesHtml}<div style="margin-top:12px;padding:10px 12px;border:1px dashed #dce8dc;border-radius:10px;background:#fcfefb;">${textoPlanoAHtmlLineas(text)}</div>`,
    cierre: 'Nos dará mucho gusto atenderte.'
  });

  return { subject, text, html };
}

function construirCorreoConfirmacionPedido({ cliente, folio, total, metodoPago, puntoEntrega, direccionEntrega, items, plantillas = {} }) {
  const nombreCliente = String(cliente || 'cliente').trim();
  const folioTxt = String(folio || '').trim();
  const resumenItemsTexto = (Array.isArray(items) ? items : [])
    .map((item) => {
      const nombre = String(item?.nombre_receta || 'Producto');
      const varianteTxt = String(item?.variante || '').trim();
      const cantidadTxt = Number(item?.cantidad || 0);
      const subtotalTxt = formatearMonedaMXN(item?.subtotal || 0);
      return `- ${nombre}${varianteTxt ? ` (${varianteTxt})` : ''} x${cantidadTxt} · ${subtotalTxt}`;
    })
    .join('\n');

  const vars = {
    nombre_cliente: nombreCliente,
    folio: folioTxt || 'Generado',
    total: formatearMonedaMXN(total),
    metodo_pago: String(metodoPago || 'No especificado'),
    clabe_transferencia: '',
    clabe_transferencia_linea: '',
    estado_preparacion_linea: '',
    punto_entrega: String(puntoEntrega || '').trim() || 'No especificado',
    direccion_entrega: direccionEntrega ? `Direccion/horario: ${String(direccionEntrega || '').trim()}` : '',
    detalle_items: resumenItemsTexto || '- Sin productos'
  };

  const metodoPagoNormalizado = String(metodoPago || '').trim().toLowerCase();
  const clabeTransferencia = String(plantillas?.transferencia_clabe || '').trim();
  const esTransferencia = metodoPagoNormalizado.includes('transfer') || metodoPagoNormalizado.includes('spei');
  if (esTransferencia && clabeTransferencia) {
    vars.clabe_transferencia = clabeTransferencia;
    vars.clabe_transferencia_linea = `CLABE para transferencia: ${clabeTransferencia}`;
  } else {
    vars.estado_preparacion_linea = 'Tu pedido ya se está poniendo en preparación.';
  }

  const asunto = renderTemplate(plantillas?.confirmacion_asunto || CONFIG_DEFAULT.correo_confirmacion_asunto, vars).trim() || 'Confirmacion de pedido';
  const plantillaConfirmacion = esTransferencia
    ? (plantillas?.confirmacion_cuerpo || CONFIG_DEFAULT.correo_confirmacion_cuerpo)
    : (plantillas?.confirmacion_cuerpo_contraentrega || CONFIG_DEFAULT.correo_confirmacion_cuerpo_contraentrega);
  const texto = renderTemplate(plantillaConfirmacion, vars).trim();

  const resumenItemsHtml = (Array.isArray(items) ? items : [])
    .map((item) => {
      const nombre = escaparHtml(item?.nombre_receta || 'Producto');
      const varianteTxt = String(item?.variante || '').trim();
      const cantidadTxt = Number(item?.cantidad || 0);
      const subtotalTxt = escaparHtml(formatearMonedaMXN(item?.subtotal || 0));
      return `<li style="margin:0 0 6px 0;">${nombre}${varianteTxt ? ` (${escaparHtml(varianteTxt)})` : ''} x${cantidadTxt} - ${subtotalTxt}</li>`;
    })
    .join('');

  const bloquesHtml = `
    <div style="background:#f3f7f2;border:1px solid #dce8dc;border-radius:10px;padding:12px 14px;margin:0 0 12px 0;">
      <div><strong>Pedido:</strong> ${escaparHtml(folioTxt || 'Generado')}</div>
      <div><strong>Total:</strong> ${escaparHtml(formatearMonedaMXN(total))}</div>
      <div><strong>Metodo de pago:</strong> ${escaparHtml(String(metodoPago || 'No especificado'))}</div>
      ${esTransferencia && clabeTransferencia ? `<div><strong>CLABE transferencia:</strong> ${escaparHtml(clabeTransferencia)}</div>` : ''}
      <div><strong>Punto de entrega:</strong> ${escaparHtml(String(puntoEntrega || '').trim() || 'No especificado')}</div>
      ${direccionEntrega ? `<div><strong>Direccion/horario:</strong> ${escaparHtml(String(direccionEntrega || '').trim())}</div>` : ''}
    </div>
    <div style="margin:0 0 4px 0;"><strong>Detalle del pedido</strong></div>
    <ul style="padding-left:18px;margin:6px 0 0 0;">${resumenItemsHtml || '<li>Sin productos</li>'}</ul>
  `;

  const html = layoutCorreoChipactli({
    titulo: 'Pedido confirmado',
    saludo: `Hola ${nombreCliente},`,
    intro: esTransferencia
      ? (folioTxt ? `Recibimos tu pedido ${folioTxt}.` : 'Recibimos tu pedido correctamente.')
      : (folioTxt ? `Tu pedido ${folioTxt} ya se está poniendo en preparación.` : 'Tu pedido ya se está poniendo en preparación.'),
    bloquesHtml,
    cierre: 'Gracias por tu compra en CHIPACTLI.'
  });

  return { subject: asunto, text: texto, html };
}

function construirCorreoEstadoPedido({ nombreCliente, folio, estado, mensajeEstado, total, metodoPago, puntoEntrega, paqueteria, numeroGuia, plantillas = {} }) {
  const folioTxt = String(folio || '').trim();
  const nombre = String(nombreCliente || 'cliente').trim();
  const tituloEstado = tituloEstadoPedidoCliente(estado);

  const lineasExtra = [];
  if (paqueteria) lineasExtra.push(`Paqueteria: ${paqueteria}`);
  if (numeroGuia) lineasExtra.push(`Numero de guia: ${numeroGuia}`);

  const vars = {
    nombre_cliente: nombre,
    folio: folioTxt || 'Generado',
    estado_titulo: tituloEstado,
    mensaje_estado: String(mensajeEstado || '').trim() || mensajeEstadoPedidoCliente(estado),
    total: formatearMonedaMXN(total || 0),
    metodo_pago: String(metodoPago || 'No especificado'),
    punto_entrega: String(puntoEntrega || 'No especificado'),
    paqueteria_linea: paqueteria ? `Paqueteria: ${paqueteria}` : '',
    guia_linea: numeroGuia ? `Numero de guia: ${numeroGuia}` : ''
  };

  const asunto = renderTemplate(plantillas?.estado_asunto || CONFIG_DEFAULT.correo_estado_asunto, vars).trim() || 'Actualizacion de pedido';
  const text = renderTemplate(plantillas?.estado_cuerpo || CONFIG_DEFAULT.correo_estado_cuerpo, vars).trim();

  const bloquesHtml = `
    <div style="background:#f3f7f2;border:1px solid #dce8dc;border-radius:10px;padding:12px 14px;margin:0 0 12px 0;">
      <div><strong>Pedido:</strong> ${escaparHtml(folioTxt || 'Generado')}</div>
      <div><strong>Estado actual:</strong> ${escaparHtml(tituloEstado)}</div>
      <div>${escaparHtml(String(mensajeEstado || '').trim() || mensajeEstadoPedidoCliente(estado))}</div>
    </div>
    <div style="background:#f8faf7;border:1px solid #e4ebdf;border-radius:10px;padding:10px 14px;margin:0 0 12px 0;">
      <div><strong>Total:</strong> ${escaparHtml(formatearMonedaMXN(total || 0))}</div>
      <div><strong>Metodo de pago:</strong> ${escaparHtml(String(metodoPago || 'No especificado'))}</div>
      <div><strong>Punto de entrega:</strong> ${escaparHtml(String(puntoEntrega || 'No especificado'))}</div>
      ${paqueteria ? `<div><strong>Paqueteria:</strong> ${escaparHtml(paqueteria)}</div>` : ''}
      ${numeroGuia ? `<div><strong>Numero de guia:</strong> ${escaparHtml(numeroGuia)}</div>` : ''}
    </div>
  `;

  const html = layoutCorreoChipactli({
    titulo: tituloEstado,
    saludo: `Hola ${nombre},`,
    intro: folioTxt ? `Tu pedido ${folioTxt} cambio de estado.` : 'Tu pedido cambio de estado.',
    bloquesHtml: `${bloquesHtml}<div style="margin-top:12px;padding:10px 12px;border:1px dashed #dce8dc;border-radius:10px;background:#fcfefb;">${textoPlanoAHtmlLineas(text)}</div>`,
    cierre: 'Gracias por comprar en CHIPACTLI.'
  });

  return { subject: asunto, text, html };
}

function construirCorreoDiagnostico({ nombre = 'Administrador', etiqueta = '', plantillas = {} }) {
  const cfg = obtenerConfigCorreo();
  const fecha = new Date().toLocaleString('es-MX');
  const tag = String(etiqueta || '').trim();
  const vars = {
    nombre_admin: String(nombre || 'Administrador').trim(),
    fecha,
    smtp_host: `${cfg.SMTP_HOST}:${cfg.SMTP_PORT}`,
    smtp_user: cfg.SMTP_USER || 'no configurado',
    etiqueta_sufijo: tag ? ` - ${tag}` : ''
  };
  const subject = renderTemplate(plantillas?.diagnostico_asunto || CONFIG_DEFAULT.correo_diagnostico_asunto, vars).trim() || 'Diagnostico correo CHIPACTLI';
  const text = renderTemplate(plantillas?.diagnostico_cuerpo || CONFIG_DEFAULT.correo_diagnostico_cuerpo, vars).trim();

  const bloquesHtml = `
    <div style="background:#f3f7f2;border:1px solid #dce8dc;border-radius:10px;padding:12px 14px;">
      <div><strong>Fecha:</strong> ${escaparHtml(fecha)}</div>
      <div><strong>SMTP host:</strong> ${escaparHtml(`${cfg.SMTP_HOST}:${cfg.SMTP_PORT}`)}</div>
      <div><strong>Usuario SMTP:</strong> ${escaparHtml(cfg.SMTP_USER || 'no configurado')}</div>
      ${tag ? `<div><strong>Etiqueta:</strong> ${escaparHtml(tag)}</div>` : ''}
    </div>
  `;
  const html = layoutCorreoChipactli({
    titulo: 'Diagnostico de correo',
    saludo: `Hola ${String(nombre || 'Administrador').trim()},`,
    intro: 'Este es un correo de diagnostico del modulo de pedidos de CHIPACTLI.',
    bloquesHtml: `${bloquesHtml}<div style="margin-top:12px;padding:10px 12px;border:1px dashed #dce8dc;border-radius:10px;background:#fcfefb;">${textoPlanoAHtmlLineas(text)}</div>`,
    cierre: 'Si recibiste este correo, el envio SMTP esta funcionando.'
  });

  return { subject, text, html };
}

function construirCorreoCampana({ nombreCliente, emailCliente, tituloCampana, contenidoCampana, imagenCampanaUrl, urlTienda, plantillas = {} }) {
  const imagenUrl = String(imagenCampanaUrl || '').trim();
  const vars = {
    nombre_cliente: String(nombreCliente || 'cliente').trim() || 'cliente',
    email_cliente: String(emailCliente || '').trim(),
    titulo_campana: String(tituloCampana || 'Novedades').trim() || 'Novedades',
    contenido_campana: String(contenidoCampana || '').trim(),
    imagen_campana_url: imagenUrl,
    url_tienda: String(urlTienda || '').trim() || 'https://chipactli.onrender.com/'
  };

  const subject = renderTemplate(plantillas?.campana_asunto || CONFIG_DEFAULT.correo_campana_asunto, vars).trim() || 'Novedades CHIPACTLI';
  const text = renderTemplate(plantillas?.campana_cuerpo || CONFIG_DEFAULT.correo_campana_cuerpo, vars).trim();

  const html = layoutCorreoChipactli({
    titulo: String(vars.titulo_campana || 'Novedades CHIPACTLI'),
    saludo: `Hola ${vars.nombre_cliente},`,
    intro: 'Tenemos noticias para ti.',
    bloquesHtml: `${imagenUrl ? `<div style="margin:0 0 12px 0;"><img src="${escaparHtml(imagenUrl)}" alt="Promocion CHIPACTLI" style="display:block;max-width:100%;height:auto;border-radius:12px;border:1px solid #dce8dc;" /></div>` : ''}<div style="padding:10px 12px;border:1px dashed #dce8dc;border-radius:10px;background:#fcfefb;">${textoPlanoAHtmlLineas(text)}</div>`,
    cierre: 'Gracias por seguir a CHIPACTLI.'
  });

  return { subject, text, html };
}

async function enviarCorreoCliente({ to, subject, text, html }) {
  const cfg = obtenerConfigCorreo();
  const correoDestino = String(to || '').trim();
  if (!correoDestino) return { ok: false, skipped: true, motivo: 'sin_destino' };
  if (!correoConfigurado()) return { ok: false, skipped: true, motivo: 'correo_no_configurado' };

  try {
    const transporter = obtenerMailTransporter();
    await transporter.sendMail({
      from: cfg.SMTP_FROM,
      to: correoDestino,
      subject: String(subject || '').trim() || 'Actualización de pedido',
      text: String(text || '').trim(),
      html: String(html || '').trim() || undefined
    });
    return { ok: true };
  } catch (error) {
    console.error('[mail] Error enviando correo:', error?.message || error);
    return { ok: false, error: error?.message || String(error) };
  }
}

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

function normalizarMediaUrl(valor) {
  const txt = String(valor || '').trim();
  if (!txt) return '';
  if (txt.startsWith('/uploads/')) return txt;
  if (txt.startsWith('uploads/')) return `/${txt}`;

  try {
    const parsed = new URL(txt);
    const pathName = String(parsed.pathname || '').trim();
    if (pathName.startsWith('/uploads/')) return pathName;
    if (pathName.startsWith('uploads/')) return `/${pathName}`;
  } catch {
    // Conservar el valor original cuando no sea URL válida.
  }

  return txt;
}

function normalizarMediaLista(lista = []) {
  return Array.from(new Set((Array.isArray(lista) ? lista : [])
    .map((item) => normalizarMediaUrl(item))
    .filter(Boolean)));
}

function tieneClave(obj, clave) {
  return Object.prototype.hasOwnProperty.call(obj || {}, clave);
}

async function resolverSlugCatalogoUnico(bdVentas, slugDeseado, recetaNombreActual) {
  const nombreActualNorm = String(recetaNombreActual || '').trim().toLowerCase();
  let base = slugify(slugDeseado || recetaNombreActual || '');
  if (!base) {
    base = `receta-${Date.now()}`;
  }

  let intento = 1;
  while (intento <= 200) {
    const candidato = intento === 1 ? base : `${base}-${intento}`;
    const existente = await dbGet(
      bdVentas,
      `SELECT receta_nombre
       FROM tienda_catalogo
       WHERE LOWER(TRIM(slug)) = LOWER(TRIM(?))
       LIMIT 1`,
      [candidato]
    );

    const nombreExistenteNorm = String(existente?.receta_nombre || '').trim().toLowerCase();
    if (!existente || (nombreExistenteNorm && nombreExistenteNorm === nombreActualNorm)) {
      return candidato;
    }

    intento += 1;
  }

  return `${base}-${Date.now()}`;
}

function boolToInt(valor) {
  return valor === true || Number(valor) === 1 ? 1 : 0;
}

function valorActivoAInt(valor) {
  if (valor === false || valor === 0 || valor === '0') return 0;
  const txt = String(valor ?? '').trim().toLowerCase();
  if (txt === 'false' || txt === 'off' || txt === 'no') return 0;
  return 1;
}

function lineasTexto(valor = "") {
  return String(valor || "")
    .split(/\r?\n|,/)
    .map((linea) => String(linea || "").trim())
    .filter(Boolean);
}

function claveIngrediente(texto = "") {
  return String(texto || "").trim().toLowerCase();
}

function ordenarIngredientesPorCantidad(lista = [], mapaCantidad = new Map()) {
  const items = Array.isArray(lista) ? lista.map((v) => String(v || "").trim()).filter(Boolean) : [];
  return items.sort((a, b) => {
    const ca = Number(mapaCantidad.get(claveIngrediente(a)) || 0);
    const cb = Number(mapaCantidad.get(claveIngrediente(b)) || 0);
    if (cb !== ca) return cb - ca;
    return a.localeCompare(b, 'es', { sensitivity: 'base' });
  });
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

function claveRecetaNombre(valor = "") {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function claveRecetaBase(valor = "") {
  return claveRecetaNombre(nombreBaseProducto(valor));
}

function mensajeEstadoPedidoCliente(estado = '') {
  const clave = String(estado || '').trim().toLowerCase();
  if (clave === 'confirmado') return 'Tu pedido fue confirmado por nuestro equipo.';
  if (clave === 'enviado_por_paqueteria') return 'Tu pedido ya fue enviado por paquetería.';
  if (clave === 'en_transito') return 'Tu pedido va en camino.';
  if (clave === 'entregado') return 'Tu pedido fue entregado.';
  if (clave === 'cancelado') return 'Tu pedido fue cancelado.';
  return `Tu pedido cambió a ${clave || 'actualizado'}.`;
}

function tituloEstadoPedidoCliente(estado = '') {
  const clave = String(estado || '').trim().toLowerCase();
  if (clave === 'confirmado') return 'Pedido confirmado';
  if (clave === 'enviado_por_paqueteria') return 'Pedido enviado';
  if (clave === 'en_transito') return 'Pedido en tránsito';
  if (clave === 'entregado') return 'Pedido entregado';
  if (clave === 'cancelado') return 'Pedido cancelado';
  return 'Pedido actualizado';
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
  transferencia_clabe: '',
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
  footer_pagos_texto: 'VISA · MasterCard · PayPal · AMEX · OXXO',
  footer_pagos_logo_url: '/images/visa-logo.svg',
  footer_pagos_logos: '/images/visa-logo.svg\n/images/mastercard.svg\n/images/amex-logo.svg\n/images/mercado-pago-badge.svg',
  footer_pagos_metodos: '[{"id":"visa","label":"Visa","activo":"1","logo_url":"/images/visa-logo.svg"},{"id":"mastercard","label":"MasterCard","activo":"1","logo_url":"/images/mastercard.svg"},{"id":"amex","label":"AMEX","activo":"1","logo_url":"/images/amex-logo.svg"},{"id":"mercado_pago","label":"Mercado Pago","activo":"1","logo_url":"/images/mercado-pago-badge.svg"},{"id":"paypal","label":"PayPal","activo":"0","logo_url":""},{"id":"oxxo","label":"OXXO","activo":"0","logo_url":""},{"id":"spei","label":"SPEI / Transferencia","activo":"1","logo_url":""},{"id":"debito_credito","label":"Tarjeta Débito/Crédito","activo":"1","logo_url":""},{"id":"apple_pay","label":"Apple Pay","activo":"0","logo_url":""},{"id":"google_pay","label":"Google Pay","activo":"0","logo_url":""},{"id":"kueski_pay","label":"Kueski Pay","activo":"0","logo_url":""},{"id":"a_plazos","label":"Pago a plazos","activo":"0","logo_url":""}]',
  footer_pagos_remover_fondo_png: '1',
  menu_tabs_personalizadas: '[]',
  menu_tabs_base_eliminadas: '[]',
  correo_bienvenida_asunto: 'Bienvenido a CHIPACTLI, {{nombre_cliente}}',
  correo_bienvenida_cuerpo: 'Hola {{nombre_cliente}},\n\nTu cuenta fue creada con éxito.\nYa puedes iniciar sesión y comprar en nuestra tienda.\n\nIr a la tienda: {{url_tienda}}\n\nGracias por unirte a CHIPACTLI.',
  correo_confirmacion_asunto: 'Confirmacion de pedido {{folio}}',
  correo_confirmacion_cuerpo: 'Hola {{nombre_cliente}},\n\nRecibimos tu pedido {{folio}} correctamente.\n\nResumen:\nTotal: {{total}}\nMetodo de pago: {{metodo_pago}}\n{{clabe_transferencia_linea}}\nPunto de entrega: {{punto_entrega}}\n{{direccion_entrega}}\n\nDetalle del pedido:\n{{detalle_items}}\n\nImportante:\nRealiza tu transferencia usando la CLABE indicada y guarda tu comprobante.\nEn cuanto se confirme el pago, te notificaremos el siguiente avance de tu pedido.\n\nGracias por tu compra en CHIPACTLI.',
  correo_confirmacion_cuerpo_contraentrega: 'Hola {{nombre_cliente}},\n\nRecibimos tu pedido {{folio}}.\n{{estado_preparacion_linea}}\n\nResumen:\nTotal: {{total}}\nMetodo de pago: {{metodo_pago}}\nPunto de entrega: {{punto_entrega}}\n{{direccion_entrega}}\n\nDetalle del pedido:\n{{detalle_items}}\n\nGracias por tu compra en CHIPACTLI.',
  correo_estado_asunto: 'Actualizacion de pedido {{folio}}: {{estado_titulo}}',
  correo_estado_cuerpo: 'Hola {{nombre_cliente}},\n\nTu pedido {{folio}} cambio de estado.\nEstado actual: {{estado_titulo}}\n{{mensaje_estado}}\nTotal: {{total}}\nMetodo de pago: {{metodo_pago}}\nPunto de entrega: {{punto_entrega}}\n{{paqueteria_linea}}\n{{guia_linea}}\n\nGracias por comprar en CHIPACTLI.',
  correo_diagnostico_asunto: 'Diagnostico correo CHIPACTLI{{etiqueta_sufijo}}',
  correo_diagnostico_cuerpo: 'Hola {{nombre_admin}},\n\nEste es un correo de diagnostico del modulo de pedidos de CHIPACTLI.\nFecha: {{fecha}}\nSMTP host: {{smtp_host}}\nUsuario SMTP: {{smtp_user}}\n\nSi recibiste este correo, el envio SMTP esta funcionando.',
  correo_campana_asunto: 'Novedades CHIPACTLI: {{titulo_campana}}',
  correo_campana_cuerpo: 'Hola {{nombre_cliente}},\n\n{{contenido_campana}}\n\nVisita nuestra tienda: {{url_tienda}}\n\nGracias por seguir a CHIPACTLI.',
  servicio_domicilio_habilitado: '0'
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

async function obtenerAjustesProduccion(bdRecetas) {
  const rows = await dbAll(
    bdRecetas,
    "SELECT clave, valor FROM recetas_ajustes WHERE clave IN ('factor_costo_produccion','factor_precio_venta','redondeo_precio')"
  );
  const mapa = new Map((rows || []).map((r) => [String(r?.clave || '').trim(), Number(r?.valor)]));
  return {
    factorCostoProduccion: Number(mapa.get('factor_costo_produccion')) || 1.15,
    factorPrecioVenta: Number(mapa.get('factor_precio_venta')) || 2.5,
    redondeoPrecio: Number(mapa.get('redondeo_precio')) || 5
  };
}

function calcularPrecioSugerido(costoBase, ajustes) {
  const costo = Number(costoBase) || 0;
  if (costo <= 0) return 0;
  const precioBruto = costo * (Number(ajustes?.factorPrecioVenta) || 2.5);
  const redondeo = Number(ajustes?.redondeoPrecio) || 5;
  if (redondeo <= 0) return precioBruto;
  return Math.ceil(precioBruto / redondeo) * redondeo;
}

function aplicarDescuentoRedondeado(precio, porcentaje) {
  const base = Number(precio) || 0;
  const pct = Math.max(0, Number(porcentaje) || 0);
  if (base <= 0 || pct <= 0) return base;
  return Math.max(0, Math.floor(base * (1 - (pct / 100))));
}

async function aplicarDescuentosProductos(productos = [], bdVentas) {
  const rows = await dbAll(
    bdVentas,
    `SELECT scope, clave, activo, porcentaje
     FROM tienda_descuentos`
  );

  const porCategoria = new Map();
  const porProducto = new Map();
  const excluidosGlobal = new Set();
  let descuentoGlobal = 0;
  for (const row of (rows || [])) {
    const scope = String(row?.scope || '').trim().toLowerCase();
    const clave = String(row?.clave || '').trim().toLowerCase();
    const activo = Number(row?.activo) === 1;
    const porcentaje = Math.max(0, Number(row?.porcentaje) || 0);
    if (!clave) continue;

    if (scope === 'global_exclusion') {
      if (activo) excluidosGlobal.add(clave);
      else excluidosGlobal.delete(clave);
      continue;
    }

    if (!activo || porcentaje <= 0) continue;
    if (scope === 'global') descuentoGlobal = porcentaje;
    if (scope === 'categoria') porCategoria.set(clave, porcentaje);
    if (scope === 'producto') porProducto.set(clave, porcentaje);
  }

  return (Array.isArray(productos) ? productos : []).map((item) => {
    const nombre = String(item?.nombre_receta || '').trim().toLowerCase();
    const categoria = String(item?.categoria_nombre || '').trim().toLowerCase();
    let pct = 0;
    if (porProducto.has(nombre)) pct = Number(porProducto.get(nombre) || 0);
    else if (porCategoria.has(categoria)) pct = Number(porCategoria.get(categoria) || 0);
    else if (descuentoGlobal > 0 && !excluidosGlobal.has(nombre)) pct = Number(descuentoGlobal || 0);

    const precioOriginal = Number(item?.precio_venta) || 0;
    const precioConDescuento = aplicarDescuentoRedondeado(precioOriginal, pct);

    const variantes = Array.isArray(item?.variantes)
      ? item.variantes.map((v) => {
        const pvOriginal = Number(v?.precio_venta) || 0;
        return {
          ...v,
          precio_original: pvOriginal,
          precio_venta: pct > 0 ? aplicarDescuentoRedondeado(pvOriginal, pct) : pvOriginal,
          descuento_porcentaje: pct,
          descuento_activo: pct > 0
        };
      })
      : item?.variantes;

    return {
      ...item,
      variantes,
      precio_original: precioOriginal,
      precio_venta: pct > 0 ? precioConDescuento : precioOriginal,
      descuento_porcentaje: pct,
      descuento_activo: pct > 0
    };
  });
}

async function construirPaquetesProductos({ bdVentas, mapaProductosPorNombre, incluirOcultos, agruparVariantes }) {
  const paquetes = await dbAll(
    bdVentas,
    `SELECT id, nombre, slug, descripcion, image_url, activo
     FROM tienda_paquetes
     ORDER BY nombre ASC`
  );
  if (!paquetes.length) return [];

  const items = await dbAll(
    bdVentas,
    `SELECT id_paquete, receta_nombre, cantidad, orden
     FROM tienda_paquetes_items
     ORDER BY id_paquete ASC, orden ASC, id ASC`
  );

  const itemsPorPaquete = new Map();
  for (const item of (items || [])) {
    const id = Number(item?.id_paquete);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (!itemsPorPaquete.has(id)) itemsPorPaquete.set(id, []);
    itemsPorPaquete.get(id).push(item);
  }

  const salida = [];
  for (const paquete of paquetes) {
    const activo = Number(paquete?.activo) === 1;
    if (!activo && !incluirOcultos) continue;

    const lista = itemsPorPaquete.get(Number(paquete?.id)) || [];
    if (!lista.length) continue;

    let precioRealTotal = 0;
    let costoTotal = 0;
    const detalles = [];
    const ingredientes = [];
    const galeria = [];

    for (const item of lista) {
      const recetaNombre = String(item?.receta_nombre || '').trim();
      if (!recetaNombre) continue;
      const cantidad = Math.max(1, Number(item?.cantidad) || 1);
      const prod = mapaProductosPorNombre.get(recetaNombre) || null;
      if (!prod) continue;

      const precioUnit = Number(prod?.precio_venta) || 0;
      const costoUnit = Number(prod?.costo_estimado) || 0;
      precioRealTotal += (precioUnit * cantidad);
      costoTotal += (costoUnit * cantidad);

      if (prod?.image_url) galeria.push(normalizarMediaUrl(prod.image_url));
      (Array.isArray(prod?.ingredientes) ? prod.ingredientes : []).forEach((ing) => ingredientes.push(String(ing || '').trim()));

      detalles.push({
        receta_nombre: recetaNombre,
        cantidad,
        image_url: normalizarMediaUrl(prod?.image_url),
        descripcion: String(prod?.descripcion || ''),
        modo_uso: String(prod?.modo_uso || ''),
        cuidados: String(prod?.cuidados || ''),
        ingredientes: Array.isArray(prod?.ingredientes) ? prod.ingredientes : [],
        precio_unitario: precioUnit,
        costo_unitario: costoUnit,
        subtotal: precioUnit * cantidad
      });
    }

    const nombre = String(paquete?.nombre || '').trim();
    if (!nombre) continue;
    const descripcion = String(paquete?.descripcion || '').trim() || `Paquete con ${detalles.length} producto(s)`;
    const imageUrl = normalizarMediaUrl(paquete?.image_url || galeria[0] || '');

    const productoPaquete = {
      paquete_id: Number(paquete?.id),
      tipo_producto: 'paquete',
      categoria_nombre: 'Paquetes',
      nombre_receta: nombre,
      nombre_base: nombre,
      slug: String(paquete?.slug || slugify(nombre)),
      visible_publico: activo,
      stock: 0,
      disponible: false,
      activo: false,
      precio_venta: precioRealTotal,
      precio_real_total: precioRealTotal,
      costo_estimado: costoTotal,
      gramaje: 0,
      descripcion,
      modo_uso: '',
      cuidados: '',
      image_url: imageUrl,
      galeria: normalizarMediaLista(galeria),
      ingredientes: Array.from(new Set(ingredientes.filter(Boolean))),
      paquete_detalle: detalles,
      variantes: agruparVariantes
        ? [{ nombre: 'Paquete', receta_nombre: nombre, gramaje: 0, precio_venta: precioRealTotal, stock: 0, disponible: false, visible_publico: activo }]
        : [],
      es_lanzamiento: false,
      es_favorito: false,
      es_oferta: false,
      es_accesorio: false,
      resenas_total: 0,
      resenas_promedio: 0,
      ultima_produccion: null
    };

    salida.push(productoPaquete);
  }

  return salida;
}

async function obtenerProductosDisponibles(bdProduccion, bdRecetas, bdVentas, opciones = {}) {
  const incluirOcultos = Boolean(opciones?.incluirOcultos);
  const agruparVariantes = opciones?.agruparVariantes !== false;
  const bdInventario = opciones?.bdInventario || null;
  const ajustesProduccion = await obtenerAjustesProduccion(bdRecetas);
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

    const conversion = convertirCantidadDetallada(cantidad, unidadReceta, unidadInsumo);
    const cantidadConvertida = Number(conversion?.valor);
    if (!conversion?.compatible || !Number.isFinite(cantidadConvertida) || cantidadConvertida <= 0) continue;

    const costoIngrediente = cantidadConvertida * costoUnidad;
    mapaPrecioSugeridoReceta.set(idReceta, (mapaPrecioSugeridoReceta.get(idReceta) || 0) + costoIngrediente);
  }

  const mapaIngredientesReceta = new Map();
  for (const ing of ingredientesRecetas || []) {
    const idReceta = Number(ing?.id_receta);
    if (!Number.isFinite(idReceta) || idReceta <= 0) continue;
    const nombreInsumo = String(ing?.nombre_insumo || '').trim();
    if (!nombreInsumo) continue;
    const cantidadInsumo = Number(ing?.cantidad) || 0;
    if (!mapaIngredientesReceta.has(idReceta)) {
      mapaIngredientesReceta.set(idReceta, []);
    }
    mapaIngredientesReceta.get(idReceta).push({
      nombre: nombreInsumo,
      cantidad: cantidadInsumo
    });
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
              ORDER BY COALESCE(p2.fecha_produccion, '1970-01-01T00:00:00Z') DESC, p2.id DESC
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
            actualizado_en,
            es_lanzamiento, es_favorito, es_oferta, es_accesorio
     FROM tienda_catalogo`
  );

  const mapaCatalogo = new Map();
  const mapaCatalogoBase = new Map();
  for (const row of (catalogoRows || [])) {
    const clave = claveRecetaNombre(row?.receta_nombre);
    if (!clave) continue;
    const previo = mapaCatalogo.get(clave);
    const fechaActual = String(row?.actualizado_en || '');
    const fechaPrevia = String(previo?.actualizado_en || '');
    if (!previo || fechaActual >= fechaPrevia) {
      mapaCatalogo.set(clave, row);
    }

    const claveBase = claveRecetaBase(row?.receta_nombre);
    if (!claveBase) continue;
    const previoBase = mapaCatalogoBase.get(claveBase);
    const fechaPreviaBase = String(previoBase?.actualizado_en || '');
    if (!previoBase || fechaActual >= fechaPreviaBase) {
      mapaCatalogoBase.set(claveBase, row);
    }
  }

  const mapaResenas = await obtenerResumenResenas(bdVentas);

  const salidaFlat = [];
  for (const receta of recetas) {
    const nombreReceta = String(receta?.nombre || "").trim();
    if (!nombreReceta) continue;

    const prod = mapaProduccion.get(nombreReceta) || null;
    const prodBase = mapaProduccionBase.get(nombreBaseProducto(nombreReceta, receta?.gramaje)) || null;
    const catalogo = mapaCatalogo.get(claveRecetaNombre(nombreReceta))
      || mapaCatalogoBase.get(claveRecetaBase(nombreReceta))
      || null;
    // By default, a recipe variant is hidden until explicitly enabled in tienda_catalogo.
    const visibleCatalogo = catalogo ? Number(catalogo.activo) !== 0 : false;
    if (!visibleCatalogo && !incluirOcultos) continue;

    const stock = Number(prod?.stock) || Number(prodBase?.stock) || 0;
    const ingredientesRecetaLista = mapaIngredientesReceta.get(Number(receta?.id)) || [];
    const mapaCantidadIngredientes = new Map();
    ingredientesRecetaLista.forEach((ing) => {
      const nombre = String(ing?.nombre || '').trim();
      if (!nombre) return;
      const clave = claveIngrediente(nombre);
      const cantidad = Number(ing?.cantidad) || 0;
      const anterior = Number(mapaCantidadIngredientes.get(clave) || 0);
      if (!mapaCantidadIngredientes.has(clave) || cantidad > anterior) {
        mapaCantidadIngredientes.set(clave, cantidad);
      }
    });

    const ingredientesAuto = ordenarIngredientesPorCantidad(
      Array.from(new Set(ingredientesRecetaLista.map((ing) => String(ing?.nombre || '').trim()).filter(Boolean))),
      mapaCantidadIngredientes
    );
    const ingredientesTienda = ordenarIngredientesPorCantidad(lineasTexto(receta?.tienda_ingredientes), mapaCantidadIngredientes);
    const galeriaTienda = parseJSON(receta?.tienda_galeria, []);
    const galeria = normalizarMediaLista(Array.isArray(galeriaTienda) ? galeriaTienda : []);
    const imagenPrincipal = normalizarMediaUrl(receta?.tienda_image_url || catalogo?.image_url || galeria[0] || "");

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
      tienda_precio_publico: Number(receta?.tienda_precio_publico) || 0,
      costo_estimado: Number(mapaPrecioSugeridoReceta.get(Number(receta?.id)) || 0),
      precio_venta: (
        Number(receta?.tienda_precio_publico)
        || Number(prod?.precio_venta)
        || Number(prodBase?.precio_venta)
        || Number(calcularPrecioSugerido(Number(mapaPrecioSugeridoReceta.get(Number(receta?.id)) || 0), ajustesProduccion))
        || 0
      ),
      gramaje: Number(receta?.gramaje) || 0,
      descripcion: String(receta?.tienda_descripcion || catalogo?.descripcion || ""),
      modo_uso: String(receta?.tienda_modo_uso || ""),
      cuidados: String(receta?.tienda_cuidados || ""),
      image_url: imagenPrincipal,
      galeria: normalizarMediaLista(galeria),
      ingredientes: ingredientesTienda.length
        ? ingredientesTienda
        : ordenarIngredientesPorCantidad(parseJSON(catalogo?.ingredientes, ingredientesAuto), mapaCantidadIngredientes),
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
    const mapaProductosPorNombreFlat = new Map(
      salidaFlat.map((p) => [String(p?.nombre_receta || '').trim(), p])
    );
    const paquetesFlat = await construirPaquetesProductos({
      bdVentas,
      mapaProductosPorNombre: mapaProductosPorNombreFlat,
      incluirOcultos,
      agruparVariantes: false
    });
    const todoFlat = [...salidaFlat, ...paquetesFlat];
    return aplicarDescuentosProductos(todoFlat, bdVentas);
  }

  const grupos = new Map();
  for (const item of salidaFlat) {
    const base = String(item?.nombre_base || item?.nombre_receta || '').trim();
    if (!base) continue;

    if (!grupos.has(base)) {
      const catalogoBase = mapaCatalogo.get(claveRecetaNombre(base))
        || mapaCatalogoBase.get(claveRecetaBase(base))
        || null;
      grupos.set(base, {
        receta_id: item.receta_id,
        categoria_id: item.categoria_id,
        categoria_nombre: item.categoria_nombre,
        nombre_receta: base,
        slug: String(catalogoBase?.slug || slugify(base)),
        visible_publico: catalogoBase ? Number(catalogoBase.activo) !== 0 : false,
        stock: 0,
        disponible: false,
        activo: false,
        precio_venta: 0,
        tienda_precio_publico: 0,
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
      tienda_precio_publico: Number(item?.tienda_precio_publico) || 0,
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
      // Mostrar el nombre completo tal como existe en recetas (incluye sufijos entre parentesis)
      // sin romper la agrupacion interna por nombre base.
      nombre_receta: String(varianteActiva?.receta_nombre || grupo.nombre_receta || '').trim(),
      variantes,
      stock,
      disponible: stock > 0,
      activo: stock > 0,
      costo_estimado: (grupo.variantes || []).reduce((sum, v) => {
        const nombreVar = String(v?.receta_nombre || '').trim();
        const detalle = salidaFlat.find((it) => String(it?.nombre_receta || '').trim() === nombreVar);
        return sum + (Number(detalle?.costo_estimado) || 0);
      }, 0),
      tienda_precio_publico: Number(varianteActiva?.tienda_precio_publico) || 0,
      precio_venta: Number(varianteActiva?.precio_venta) || 0,
      gramaje: Number(varianteActiva?.gramaje) || 0,
      visible_publico: incluirOcultos ? Boolean(grupo.visible_publico) : (variantes.length > 0)
    };
  });

  const baseSalida = incluirOcultos ? salida : salida.filter((item) => item.visible_publico);
  const mapaProductosPorNombre = new Map(
    salidaFlat.map((p) => [String(p?.nombre_receta || '').trim(), p])
  );
  const paquetes = await construirPaquetesProductos({
    bdVentas,
    mapaProductosPorNombre,
    incluirOcultos,
    agruparVariantes: true
  });
  const todo = [...baseSalida, ...paquetes];
  return aplicarDescuentosProductos(todo, bdVentas);
}

async function crearPreferenciaMercadoPago({ orden, items, returnUrls = {} }) {
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

  const successUrl = normalizarUrl(returnUrls?.success, normalizarUrl(process.env.MP_SUCCESS_URL, 'https://www.mercadopago.com.mx'));
  const pendingUrl = normalizarUrl(returnUrls?.pending, normalizarUrl(process.env.MP_PENDING_URL, 'https://www.mercadopago.com.mx'));
  const failureUrl = normalizarUrl(returnUrls?.failure, normalizarUrl(process.env.MP_FAILURE_URL, 'https://www.mercadopago.com.mx'));

  const puedeAutoReturn = (() => {
    try {
      const parsed = new URL(successUrl);
      const host = String(parsed.hostname || '').toLowerCase();
      const esLocal = host === 'localhost' || host === '127.0.0.1';
      const tieneHash = String(parsed.hash || '').trim().length > 0;
      return parsed.protocol === 'https:' && !esLocal && !tieneHash;
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

async function consultarPagoMercadoPagoPorId(paymentId = '') {
  const accessToken = String(process.env.MP_ACCESS_TOKEN || '').trim();
  const pagoId = String(paymentId || '').trim();
  if (!accessToken || !pagoId) return null;

  const endpoint = `https://api.mercadopago.com/v1/payments/${encodeURIComponent(pagoId)}`;
  const respuesta = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  if (!respuesta.ok) return null;

  const pago = await respuesta.json();
  return {
    estado_pago: mapearEstadoPagoDesdeMercadoPago(pago?.status),
    mp_status: String(pago?.status || '').trim(),
    mp_status_detail: String(pago?.status_detail || '').trim(),
    mp_payment_id: String(pago?.id || '').trim(),
    mp_preference_id: String(pago?.order?.id || pago?.metadata?.preference_id || '').trim(),
    mp_external_reference: String(pago?.external_reference || '').trim(),
    mp_date_approved: String(pago?.date_approved || '').trim()
  };
}

function normalizarEstadoPago(valor, fallback = 'pendiente') {
  const clave = String(valor || '').trim().toLowerCase();
  return ESTADOS_PAGO_PERMITIDOS.has(clave) ? clave : fallback;
}

function normalizarOrigenPedido(valor, fallback = 'web') {
  const origen = String(valor || '').trim().toLowerCase();
  return (origen === 'app' || origen === 'web') ? origen : fallback;
}

function mapearEstadoPagoDesdeMercadoPago(statusRaw = '') {
  const status = String(statusRaw || '').trim().toLowerCase();
  if (status === 'approved' || status === 'authorized') return 'pagado';
  if (status === 'rejected' || status === 'cancelled' || status === 'charged_back') return 'rechazado';
  if (status === 'refunded') return 'reembolsado';
  return 'pendiente';
}

async function consultarPagoMercadoPagoPorFolio(folio = '') {
  const accessToken = String(process.env.MP_ACCESS_TOKEN || '').trim();
  const folioTxt = String(folio || '').trim();
  if (!accessToken || !folioTxt) return null;

  const endpoint = `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=1&external_reference=${encodeURIComponent(folioTxt)}`;
  const respuesta = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  if (!respuesta.ok) return null;

  const data = await respuesta.json();
  const pago = Array.isArray(data?.results) ? data.results[0] : null;
  if (!pago) return null;

  return {
    estado_pago: mapearEstadoPagoDesdeMercadoPago(pago?.status),
    mp_status: String(pago?.status || '').trim(),
    mp_status_detail: String(pago?.status_detail || '').trim(),
    mp_payment_id: String(pago?.id || '').trim(),
    mp_date_approved: String(pago?.date_approved || '').trim()
  };
}

async function refrescarEstadoPagoOrdenSiAplica(bdVentas, orden = {}) {
  const metodoPago = String(orden?.metodo_pago || '').trim().toLowerCase();
  if (metodoPago !== 'mercado_pago') {
    return orden;
  }

  try {
    const pagoMp = await consultarPagoMercadoPagoPorFolio(orden?.folio);
    if (!pagoMp?.estado_pago) return orden;

    const estadoPagoActual = normalizarEstadoPago(orden?.estado_pago, 'pendiente');
    const estadoPagoNuevo = normalizarEstadoPago(pagoMp.estado_pago, estadoPagoActual);
    if (estadoPagoNuevo === estadoPagoActual) return { ...orden, estado_pago: estadoPagoActual };

    let detallePago = {};
    try {
      detallePago = JSON.parse(String(orden?.detalle_pago || '{}')) || {};
    } catch {
      detallePago = {};
    }

    detallePago = {
      ...detallePago,
      proveedor: 'mercado_pago',
      estado_pago: estadoPagoNuevo,
      mp_status: pagoMp.mp_status,
      mp_status_detail: pagoMp.mp_status_detail,
      mp_payment_id: pagoMp.mp_payment_id,
      mp_date_approved: pagoMp.mp_date_approved,
      actualizado_en: new Date().toISOString()
    };

    const estadoOrdenActual = String(orden?.estado || 'pendiente').trim().toLowerCase();
    const estadoOrdenNuevo = (estadoPagoNuevo === 'pagado' && (estadoOrdenActual === 'pendiente' || !estadoOrdenActual))
      ? 'confirmado'
      : estadoOrdenActual;

    await dbRun(
      bdVentas,
      `UPDATE tienda_ordenes
       SET estado_pago = ?, detalle_pago = ?, estado = ?, estado_pago_actualizado_en = CURRENT_TIMESTAMP, actualizado_en = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [estadoPagoNuevo, JSON.stringify(detallePago), estadoOrdenNuevo, Number(orden?.id) || 0]
    );

    return {
      ...orden,
      estado_pago: estadoPagoNuevo,
      estado: estadoOrdenNuevo,
      detalle_pago: JSON.stringify(detallePago)
    };
  } catch {
    return orden;
  }
}

async function registrarRecuperacionVenta(bdInventario, { fechaVenta, importeCobrado, ganancia }) {
  await dbRun(
    bdInventario,
    "INSERT INTO inversion_recuperada (fecha_venta, costo_recuperado) VALUES (?,?)",
    [fechaVenta, Number(importeCobrado) || 0]
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

async function pasarProduccionAVentasPorPedido(bdProduccion, bdVentas, bdInventario, { nombreReceta, cantidadSolicitada, numeroPedido, precioVentaPreferente }) {
  let restante = Number(cantidadSolicitada) || 0;
  if (restante <= 0) return { cantidadVendida: 0, cantidadPendiente: 0 };

  const lotes = await dbAll(
    bdProduccion,
    `SELECT id, cantidad, fecha_produccion, costo_produccion, precio_venta
     FROM produccion
     WHERE nombre_receta = ? AND COALESCE(cantidad, 0) > 0
     ORDER BY COALESCE(fecha_produccion, '1970-01-01T00:00:00Z') ASC, id ASC`,
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
    const precioVenta = Number(precioVentaPreferente) > 0
      ? Number(precioVentaPreferente)
      : (Number(lote?.precio_venta) || 0);
    const ganancia = (precioVenta * aVender) - costoVenta;

    await dbRun(
      bdVentas,
      `INSERT INTO ventas (nombre_receta, cantidad, fecha_produccion, fecha_venta, costo_produccion, precio_venta, ganancia, numero_pedido)
       VALUES (?,?,?,?,?,?,?,?)`,
      [nombreReceta, aVender, lote?.fecha_produccion || fechaVenta, fechaVenta, costoVenta, precioVenta, ganancia, numeroPedido || ""]
    );

    await registrarRecuperacionVenta(bdInventario, {
      fechaVenta,
      importeCobrado: (Number(precioVenta) || 0) * (Number(aVender) || 0),
      ganancia
    });

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

async function generarFolioOrdenTienda(bdVentas, origenPedido = 'web') {
  const origen = normalizarOrigenPedido(origenPedido, 'web');
  const prefijo = origen === 'app' ? PREFIJO_FOLIO_TIENDA_APP : PREFIJO_FOLIO_TIENDA_WEB;
  const row = await dbGet(
    bdVentas,
    `SELECT folio
     FROM (
       SELECT folio, id FROM tienda_ordenes WHERE folio LIKE ?
       UNION ALL
       SELECT folio, id FROM tienda_checkout_intentos WHERE folio LIKE ?
     ) AS folios
     ORDER BY folio DESC, id DESC
     LIMIT 1`,
    [`${prefijo}%`, `${prefijo}%`]
  );
  const actual = String(row?.folio || '').trim();
  const match = actual.match(new RegExp(`^${prefijo}(\\d+)$`));
  const consecutivo = match ? (Number(match[1]) || 0) + 1 : 1;
  return `${prefijo}${String(consecutivo).padStart(LONGITUD_CONSECUTIVO_TIENDA, '0')}`;
}

async function crearOrdenTiendaDesdeItems({
  bdProduccion,
  bdVentas,
  bdInventario,
  cliente,
  itemsFinales,
  metodoPago,
  origenPedido,
  puntoEntrega,
  direccionEntrega,
  notas,
  folio,
  checkout = null
}) {
  const total = (itemsFinales || []).reduce((sum, item) => sum + (Number(item?.subtotal) || 0), 0);
  const estadoPagoInicial = metodoPago.toLowerCase() === 'mercado_pago' ? 'pendiente' : 'pendiente_manual';

  const insertOrden = await dbRun(
    bdVentas,
    `INSERT INTO tienda_ordenes
     (folio, origen_pedido, id_cliente, nombre_cliente, email_cliente, telefono_cliente, metodo_pago, estado, estado_pago, total, moneda, referencia_externa, detalle_pago, id_punto_entrega, nombre_punto_entrega, direccion_entrega, notas, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, 'MXN', '', '', ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      folio,
      origenPedido,
      cliente.id,
      cliente.nombre,
      cliente.email,
      cliente.telefono || '',
      metodoPago,
      estadoPagoInicial,
      total,
      puntoEntrega.id,
      String(puntoEntrega.nombre || ''),
      direccionEntrega,
      notas
    ]
  );

  for (const item of (itemsFinales || [])) {
    await dbRun(
      bdVentas,
      `INSERT INTO tienda_orden_items (id_orden, receta_nombre, cantidad, precio_unitario, subtotal, variante)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [insertOrden.lastID, item.nombre_receta, item.cantidad, item.precio_unitario, item.subtotal, item.variante]
    );
  }

  let cantidadAutoVendida = 0;
  for (const item of (itemsFinales || [])) {
    const cantidadSolicitada = Number(item?.cantidad_auto_venta) || 0;
    if (cantidadSolicitada <= 0) continue;

    const mov = await pasarProduccionAVentasPorPedido(
      bdProduccion,
      bdVentas,
      bdInventario,
      {
        nombreReceta: item.nombre_receta,
        cantidadSolicitada,
        numeroPedido: folio,
        precioVentaPreferente: Number(item?.precio_unitario || 0)
      }
    );
    cantidadAutoVendida += Number(mov?.cantidadVendida) || 0;
  }

  if (checkout?.preference_id) {
    await dbRun(
      bdVentas,
      "UPDATE tienda_ordenes SET referencia_externa = ?, detalle_pago = ? WHERE id = ?",
      [checkout.preference_id || '', JSON.stringify(checkout), insertOrden.lastID]
    );
  }

  transmitir({
    tipo: 'tienda_orden_nueva',
    id_orden: insertOrden.lastID,
    id_cliente: Number(cliente.id) || 0,
    folio,
    total,
    cliente: cliente.nombre,
    metodo_pago: metodoPago
  });

  const mensajePedidoNuevo = folio
    ? `Tu pedido ${folio} fue realizado correctamente.`
    : 'Tu pedido fue realizado correctamente.';
  await dbRun(
    bdVentas,
    `INSERT INTO tienda_notificaciones_cliente
     (id_cliente, id_orden, tipo, titulo, mensaje, leida, creado_en)
     VALUES (?, ?, 'pedido_nuevo', 'Pedido realizado', ?, 0, CURRENT_TIMESTAMP)`,
    [Number(cliente.id) || 0, insertOrden.lastID, mensajePedidoNuevo]
  );

  const correoCliente = String(cliente?.email || '').trim();
  if (correoCliente) {
    const configTienda = await obtenerConfigTienda(bdVentas);
    const plantillas = obtenerPlantillasCorreoDesdeConfig(configTienda);
    const correo = construirCorreoConfirmacionPedido({
      cliente: String(cliente?.nombre || 'cliente').trim(),
      folio,
      total,
      metodoPago,
      puntoEntrega: String(puntoEntrega?.nombre || '').trim(),
      direccionEntrega,
      items: itemsFinales,
      plantillas
    });
    await enviarCorreoCliente({
      to: correoCliente,
      subject: correo.subject,
      text: correo.text,
      html: correo.html
    });
  }

  if (cantidadAutoVendida > 0) {
    transmitir({ tipo: 'produccion_actualizado' });
  }
  transmitir({ tipo: 'ventas_actualizado' });

  return {
    id: insertOrden.lastID,
    folio,
    origen_pedido: origenPedido,
    total,
    metodo_pago: metodoPago,
    estado_pago: estadoPagoInicial,
    estado: 'pendiente'
  };
}

export function registrarRutasTienda(app, bdProduccion, bdRecetas, bdVentas, bdInventario, bdAdmin = null) {
  async function validarContrasenaAdminActual(passwordPlano = '', usuarioActual = null) {
    if (!bdAdmin) {
      return { ok: false, status: 500, error: 'Base administrativa no disponible' };
    }

    const password = String(passwordPlano || '');
    if (!password) {
      return { ok: false, status: 400, error: 'Debes capturar la contraseña del admin' };
    }

    const usernameActual = String(usuarioActual?.username || '').trim().toLowerCase();
    const idActual = Number(usuarioActual?.id || 0);

    let admin = null;
    if (idActual > 0) {
      admin = await dbGet(
        bdAdmin,
        'SELECT id, username, password_hash, rol FROM usuarios WHERE id = ? LIMIT 1',
        [idActual]
      );
    }

    if (!admin && usernameActual) {
      admin = await dbGet(
        bdAdmin,
        'SELECT id, username, password_hash, rol FROM usuarios WHERE LOWER(TRIM(username)) = LOWER(TRIM(?)) LIMIT 1',
        [usernameActual]
      );
    }

    if (!admin) {
      return { ok: false, status: 404, error: 'Usuario admin no encontrado' };
    }

    const passOk = await bcrypt.compare(password, String(admin.password_hash || ''));
    if (!passOk) {
      return { ok: false, status: 401, error: 'Contraseña admin inválida' };
    }

    return { ok: true, admin };
  }

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

  app.post('/tienda/admin/servicio-domicilio/habilitar', authInterno, async (req, res) => {
    try {
      if (!bdAdmin) return res.status(500).json({ error: 'Base administrativa no disponible' });

      const rolUsuario = String(req.usuario?.rol || '').trim().toLowerCase();
      if (rolUsuario !== 'ceo') {
        return res.status(403).json({ error: 'Solo el CEO puede activar esta opción' });
      }

      const passwordCeo = String(req.body?.password_ceo || '');
      if (!passwordCeo) {
        return res.status(400).json({ error: 'Debes capturar la contraseña del CEO' });
      }

      const usernameActual = String(req.usuario?.username || '').trim().toLowerCase();
      let ceo = null;
      if (usernameActual) {
        ceo = await dbGet(
          bdAdmin,
          "SELECT username, password_hash, rol FROM usuarios WHERE LOWER(TRIM(username)) = LOWER(TRIM(?)) LIMIT 1",
          [usernameActual]
        );
      }
      if (!ceo || String(ceo?.rol || '').trim().toLowerCase() !== 'ceo') {
        ceo = await dbGet(
          bdAdmin,
          "SELECT username, password_hash, rol FROM usuarios WHERE rol = 'ceo' ORDER BY id ASC LIMIT 1"
        );
      }
      if (!ceo) return res.status(404).json({ error: 'No se encontró usuario CEO' });

      const passOk = await bcrypt.compare(passwordCeo, String(ceo.password_hash || ''));
      if (!passOk) return res.status(401).json({ error: 'Contraseña CEO inválida' });

      const yaActivo = await dbGet(
        bdVentas,
        "SELECT valor FROM tienda_config WHERE clave = 'servicio_domicilio_habilitado' LIMIT 1"
      );
      if (String(yaActivo?.valor || '').trim() === '1') {
        return res.json({ ok: true, activo: true, ya_estaba_activo: true });
      }

      await dbRun(
        bdVentas,
        `INSERT INTO tienda_config (clave, valor, actualizado_en)
         VALUES ('servicio_domicilio_habilitado', '1', CURRENT_TIMESTAMP)
         ON CONFLICT(clave) DO UPDATE SET valor = '1', actualizado_en = CURRENT_TIMESTAMP`
      );

      const mensajeDomicilio = 'Ya contamos con servicio a domicilio. ¡Gracias por tu preferencia!';
      await dbRun(
        bdVentas,
        `INSERT INTO tienda_notificaciones_cliente (id_cliente, id_orden, tipo, titulo, mensaje, leida, creado_en)
         SELECT id, NULL, 'servicio_domicilio', 'Servicio a domicilio activo', ?, 0, CURRENT_TIMESTAMP
         FROM tienda_clientes`
        ,
        [mensajeDomicilio]
      );

      const totalClientesNotificados = await dbGet(
        bdVentas,
        `SELECT COUNT(*) AS total
         FROM tienda_clientes`
      );

      transmitir({
        tipo: 'tienda_servicio_domicilio_habilitado',
        mensaje: mensajeDomicilio
      });

      return res.json({ ok: true, activo: true, total_clientes_notificados: Number(totalClientesNotificados?.total) || 0 });
    } catch {
      return res.status(500).json({ error: 'No se pudo activar servicio a domicilio' });
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
      const activo = valorActivoAInt(req.body?.activo);
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
      const activo = valorActivoAInt(req.body?.activo);

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
        "SELECT id, nombre, email, telefono, direccion_default, forma_pago_preferida, recibe_promociones, creado_en, actualizado_en FROM tienda_clientes ORDER BY id DESC"
      );
      res.json(clientes || []);
    } catch {
      res.status(500).json({ error: "No se pudieron cargar clientes" });
    }
  });

  app.delete('/tienda/admin/clientes/:id', authInterno, async (req, res) => {
    try {
      const id = Number(req.params.id || 0);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Cliente inválido' });

      const existe = await dbGet(bdVentas, 'SELECT id FROM tienda_clientes WHERE id = ? LIMIT 1', [id]);
      if (!existe) return res.status(404).json({ error: 'Cliente no encontrado' });

      await dbRun(bdVentas, 'DELETE FROM tienda_notificaciones_cliente WHERE id_cliente = ?', [id]);
      await dbRun(bdVentas, 'DELETE FROM tienda_clientes_direcciones WHERE id_cliente = ?', [id]);
      await dbRun(bdVentas, 'DELETE FROM tienda_atencion_clientes WHERE id_cliente = ?', [id]);
      await dbRun(bdVentas, 'DELETE FROM tienda_resenas WHERE id_cliente = ?', [id]);
      await dbRun(bdVentas, 'DELETE FROM tienda_clientes WHERE id = ?', [id]);

      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'No se pudo eliminar el cliente' });
    }
  });

  app.get("/tienda/admin/ordenes", authInterno, async (req, res) => {
    try {
      const ordenesRaw = await dbAll(
        bdVentas,
        `SELECT id, folio, origen_pedido, nombre_cliente, email_cliente, telefono_cliente, metodo_pago, estado, estado_pago, total, moneda,
                id_punto_entrega, nombre_punto_entrega, direccion_entrega, notas,
                paqueteria, numero_guia, creado_en
         FROM tienda_ordenes
         ORDER BY id DESC`
      );
      const ordenes = [];
      for (const orden of (ordenesRaw || [])) {
        ordenes.push(await refrescarEstadoPagoOrdenSiAplica(bdVentas, orden));
      }
      res.json(ordenes);
    } catch {
      res.status(500).json({ error: "No se pudieron cargar órdenes" });
    }
  });

  async function eliminarOrdenesAdminPorIds(ids = []) {
    const idsValidos = Array.from(new Set((Array.isArray(ids) ? ids : [])
      .map((id) => Number(id || 0))
      .filter((id) => Number.isFinite(id) && id > 0)));

    if (!idsValidos.length) {
      return { eliminadas: 0 };
    }

    const placeholders = idsValidos.map(() => '?').join(', ');

    await dbRun(
      bdVentas,
      `DELETE FROM tienda_notificaciones_cliente WHERE id_orden IN (${placeholders})`,
      idsValidos
    );
    await dbRun(
      bdVentas,
      `DELETE FROM tienda_orden_items WHERE id_orden IN (${placeholders})`,
      idsValidos
    );
    const resultado = await dbRun(
      bdVentas,
      `DELETE FROM tienda_ordenes WHERE id IN (${placeholders})`,
      idsValidos
    );

    return { eliminadas: Number(resultado?.changes || 0) };
  }

  app.delete('/tienda/admin/ordenes/:id', authInterno, async (req, res) => {
    try {
      const id = Number(req.params.id || 0);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Orden inválida' });

      const resultado = await eliminarOrdenesAdminPorIds([id]);
      if (!resultado.eliminadas) return res.status(404).json({ error: 'Orden no encontrada' });

      transmitir({ tipo: 'ventas_actualizado' });
      res.json({ ok: true, eliminadas: resultado.eliminadas });
    } catch {
      res.status(500).json({ error: 'No se pudo eliminar la orden' });
    }
  });

  app.post('/tienda/admin/ordenes/bulk-delete', authInterno, async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const resultado = await eliminarOrdenesAdminPorIds(ids);
      transmitir({ tipo: 'ventas_actualizado' });
      res.json({ ok: true, eliminadas: resultado.eliminadas });
    } catch {
      res.status(500).json({ error: 'No se pudieron eliminar las órdenes' });
    }
  });

  app.post('/tienda/admin/ordenes/reset-contadores', authInterno, async (req, res) => {
    try {
      const passwordAdmin = String(
        req.body?.password_admin
        || req.body?.password_ceo
        || req.body?.password
        || ''
      ).trim();
      const validacion = await validarContrasenaAdminActual(passwordAdmin, req.usuario);
      if (!validacion.ok) {
        return res.status(validacion.status || 401).json({ error: validacion.error || 'No autorizado' });
      }

      await dbRun(bdVentas, 'BEGIN');
      try {
        const totalAntes = await dbGet(bdVentas, 'SELECT COUNT(*) AS total FROM tienda_ordenes');
        const eliminadas = Number(totalAntes?.total || 0);

        await dbRun(bdVentas, 'DELETE FROM tienda_notificaciones_cliente WHERE id_orden IS NOT NULL');
        await dbRun(bdVentas, 'DELETE FROM tienda_orden_items');
        await dbRun(bdVentas, 'DELETE FROM tienda_ordenes');
        await dbRun(bdVentas, 'DELETE FROM tienda_checkout_intentos');

        // SQLite: limpia contadores AUTOINCREMENT si existen.
        try {
          await dbRun(
            bdVentas,
            "DELETE FROM sqlite_sequence WHERE name IN ('tienda_ordenes', 'tienda_orden_items', 'tienda_checkout_intentos')"
          );
        } catch {
          // En Postgres no existe sqlite_sequence.
        }

        await dbRun(bdVentas, 'COMMIT');
        transmitir({ tipo: 'ventas_actualizado' });
        return res.json({ ok: true, eliminadas });
      } catch (errorInterno) {
        try {
          await dbRun(bdVentas, 'ROLLBACK');
        } catch {
          // Ignorado.
        }
        throw errorInterno;
      }
    } catch {
      res.status(500).json({ error: 'No se pudieron reiniciar los contadores de pedidos' });
    }
  });

  app.post('/tienda/admin/mail/diagnostico', authInterno, async (req, res) => {
    try {
      const cfg = obtenerConfigCorreo();
      const configTienda = await obtenerConfigTienda(bdVentas);
      const plantillas = obtenerPlantillasCorreoDesdeConfig(configTienda);
      const to = String(req.body?.to || cfg.SMTP_USER || '').trim();
      const nombre = String(req.body?.nombre || req.user?.nombre || 'Administrador').trim();
      const etiqueta = String(req.body?.etiqueta || '').trim();
      if (!to) return res.status(400).json({ error: 'Correo destino requerido' });

      const correo = construirCorreoDiagnostico({ nombre, etiqueta, plantillas });
      const resultado = await enviarCorreoCliente({
        to,
        subject: correo.subject,
        text: correo.text,
        html: correo.html
      });

      if (resultado?.ok) {
        return res.json({ ok: true, to, configurado: correoConfigurado() });
      }
      if (resultado?.skipped) {
        return res.status(400).json({
          ok: false,
          error: 'No se pudo enviar correo de diagnostico',
          motivo: resultado?.motivo || 'desconocido',
          configurado: correoConfigurado()
        });
      }

      return res.status(500).json({
        ok: false,
        error: 'Fallo al enviar correo de diagnostico',
        detalle: resultado?.error || 'error_desconocido'
      });
    } catch {
      return res.status(500).json({ error: 'No se pudo ejecutar diagnostico de correo' });
    }
  });

  app.post('/tienda/admin/mail/preview', authInterno, async (req, res) => {
    try {
      const configTienda = await obtenerConfigTienda(bdVentas);
      const plantillasBase = obtenerPlantillasCorreoDesdeConfig(configTienda);
      const tipoPreview = String(req.body?.tipo || 'campana').trim().toLowerCase();

      const tituloCampana = String(req.body?.titulo || '').trim() || 'Novedades CHIPACTLI';
      const contenidoCampana = String(req.body?.contenido || '').trim();
      const imagenCampanaUrl = String(req.body?.imagen_url || '').trim();
      const asuntoManual = String(req.body?.asunto || '').trim();
      const cuerpoManual = String(req.body?.cuerpo || '').trim();

      const basePublica = String(process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || 'https://chipactli.onrender.com/').trim().replace(/\/+$/, '');
      const urlTienda = basePublica || 'https://chipactli.onrender.com/';

      let correo = null;
      if (tipoPreview === 'bienvenida') {
        correo = construirCorreoBienvenida({
          nombreCliente: 'Cliente CHIPACTLI',
          emailCliente: 'cliente@chipactli.mx',
          urlTienda,
          plantillas: {
            ...plantillasBase,
            bienvenida_asunto: String(req.body?.asunto || '').trim() || plantillasBase.bienvenida_asunto,
            bienvenida_cuerpo: String(req.body?.cuerpo || '').trim() || plantillasBase.bienvenida_cuerpo
          }
        });
      } else if (tipoPreview === 'confirmacion') {
        correo = construirCorreoConfirmacionPedido({
          cliente: 'Cliente CHIPACTLI',
          folio: 'CHV0000123',
          total: 589,
          metodoPago: 'Transferencia',
          puntoEntrega: 'Sucursal Centro',
          direccionEntrega: 'Recoger hoy de 13:00 a 14:00',
          items: [
            { nombre_receta: 'Jabon de Cempasuchil', variante: '120 g', cantidad: 2, subtotal: 298 },
            { nombre_receta: 'Shampoo Herbal', variante: '250 ml', cantidad: 1, subtotal: 291 }
          ],
          plantillas: {
            ...plantillasBase,
            confirmacion_asunto: String(req.body?.asunto || '').trim() || plantillasBase.confirmacion_asunto,
            confirmacion_cuerpo: String(req.body?.cuerpo || '').trim() || plantillasBase.confirmacion_cuerpo
          }
        });
      } else if (tipoPreview === 'estado') {
        correo = construirCorreoEstadoPedido({
          nombreCliente: 'Cliente CHIPACTLI',
          folio: 'CHV0000123',
          estado: 'enviado',
          mensajeEstado: 'Tu pedido ya va en camino.',
          total: 589,
          metodoPago: 'Transferencia',
          puntoEntrega: 'Domicilio',
          paqueteria: 'DHL',
          numeroGuia: 'DH123456789MX',
          plantillas: {
            ...plantillasBase,
            estado_asunto: String(req.body?.asunto || '').trim() || plantillasBase.estado_asunto,
            estado_cuerpo: String(req.body?.cuerpo || '').trim() || plantillasBase.estado_cuerpo
          }
        });
      } else if (tipoPreview === 'diagnostico') {
        correo = construirCorreoDiagnostico({
          nombre: String(req.user?.nombre || 'Administracion CHIPACTLI').trim(),
          etiqueta: 'Vista previa',
          plantillas: {
            ...plantillasBase,
            diagnostico_asunto: String(req.body?.asunto || '').trim() || plantillasBase.diagnostico_asunto,
            diagnostico_cuerpo: String(req.body?.cuerpo || '').trim() || plantillasBase.diagnostico_cuerpo
          }
        });
      } else {
        correo = construirCorreoCampana({
          nombreCliente: 'Cliente CHIPACTLI',
          emailCliente: 'cliente@chipactli.mx',
          tituloCampana,
          contenidoCampana,
          imagenCampanaUrl,
          urlTienda,
          plantillas: {
            ...plantillasBase,
            campana_asunto: asuntoManual || plantillasBase.campana_asunto,
            campana_cuerpo: cuerpoManual || plantillasBase.campana_cuerpo
          }
        });
      }

      return res.json({
        ok: true,
        tipo: tipoPreview,
        subject: correo.subject,
        text: correo.text,
        html: correo.html
      });
    } catch {
      return res.status(500).json({ error: 'No se pudo generar la vista previa del correo' });
    }
  });

  app.post('/tienda/admin/mail/masivo', authInterno, async (req, res) => {
    try {
      const configTienda = await obtenerConfigTienda(bdVentas);
      const plantillas = obtenerPlantillasCorreoDesdeConfig(configTienda);

      const tituloCampana = String(req.body?.titulo || '').trim() || 'Novedades CHIPACTLI';
      const contenidoCampana = String(req.body?.contenido || '').trim();
      const imagenCampanaUrl = String(req.body?.imagen_url || '').trim();
      const asuntoManual = String(req.body?.asunto || '').trim();
      const cuerpoManual = String(req.body?.cuerpo || '').trim();
      const maxDestinatarios = Math.max(1, Math.min(5000, Number(req.body?.max_destinatarios || 1000) || 1000));

      if (!contenidoCampana && !cuerpoManual) {
        return res.status(400).json({ error: 'Debes capturar contenido para la campana' });
      }

      const basePublica = String(process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || 'https://chipactli.onrender.com/').trim().replace(/\/+$/, '');
      const urlTienda = basePublica || 'https://chipactli.onrender.com/';

      const clientes = await dbAll(
        bdVentas,
        `SELECT id, nombre, email
         FROM tienda_clientes
         WHERE TRIM(COALESCE(email, '')) <> ''
           AND COALESCE(recibe_promociones, 0) = 1
         ORDER BY id DESC
         LIMIT ?`,
        [maxDestinatarios]
      );

      if (!Array.isArray(clientes) || !clientes.length) {
        return res.status(400).json({ error: 'No hay clientes con correo para enviar campana' });
      }

      let enviados = 0;
      let fallidos = 0;
      const errores = [];

      for (const cliente of clientes) {
        const to = String(cliente?.email || '').trim();
        if (!to) continue;

        const correo = construirCorreoCampana({
          nombreCliente: String(cliente?.nombre || 'cliente').trim(),
          emailCliente: to,
          tituloCampana,
          contenidoCampana: contenidoCampana || cuerpoManual,
          imagenCampanaUrl,
          urlTienda,
          plantillas: {
            ...plantillas,
            campana_asunto: asuntoManual || plantillas.campana_asunto,
            campana_cuerpo: cuerpoManual || plantillas.campana_cuerpo
          }
        });

        const resultado = await enviarCorreoCliente({
          to,
          subject: correo.subject,
          text: correo.text,
          html: correo.html
        });

        if (resultado?.ok) {
          enviados += 1;
        } else {
          fallidos += 1;
          if (errores.length < 20) {
            errores.push({ email: to, error: resultado?.error || resultado?.motivo || 'fallo_envio' });
          }
        }
      }

      return res.json({
        ok: true,
        enviados,
        fallidos,
        total: enviados + fallidos,
        errores
      });
    } catch {
      return res.status(500).json({ error: 'No se pudo enviar correo masivo' });
    }
  });

  app.patch("/tienda/admin/ordenes/:id/estado", authInterno, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const estado = String(req.body?.estado || "").trim().toLowerCase();
      const estadoPagoBody = String(req.body?.estado_pago || '').trim().toLowerCase();
      const paqueteria = String(req.body?.paqueteria || "").trim();
      const numeroGuia = String(req.body?.numero_guia || "").trim();
      const permitidos = new Set([
        "pendiente",
        "confirmado",
        "procesando",
        "listo_para_envio",
        "enviado_por_paqueteria",
        "en_transito",
        "en_reparto_local",
        "entregado",
        "no_entregado",
        "cancelado",
        "devuelto"
      ]);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Orden inválida" });
      if (!permitidos.has(estado)) return res.status(400).json({ error: "Estado inválido" });
      if (estado === "enviado_por_paqueteria" && (!paqueteria || !numeroGuia)) {
        return res.status(400).json({ error: "Para envío por paquetería debes capturar paquetería y número de guía" });
      }

      const ordenPrev = await dbGet(bdVentas, 'SELECT estado_pago FROM tienda_ordenes WHERE id = ? LIMIT 1', [id]);
      const estadoPagoFinal = estadoPagoBody
        ? normalizarEstadoPago(estadoPagoBody, normalizarEstadoPago(ordenPrev?.estado_pago, 'pendiente_manual'))
        : normalizarEstadoPago(ordenPrev?.estado_pago, 'pendiente_manual');

      const resultado = await dbRun(
        bdVentas,
        "UPDATE tienda_ordenes SET estado = ?, estado_pago = ?, paqueteria = ?, numero_guia = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?",
        [estado, estadoPagoFinal, paqueteria, numeroGuia, id]
      );

      if (!resultado.changes) return res.status(404).json({ error: "Orden no encontrada" });
      const ordenActualizada = await dbGet(
        bdVentas,
        `SELECT id, id_cliente, folio, nombre_cliente, email_cliente, total, metodo_pago, nombre_punto_entrega
         FROM tienda_ordenes
         WHERE id = ?`,
        [id]
      );

      transmitir({
        tipo: 'tienda_orden_actualizada',
        id_orden: id,
        id_cliente: Number(ordenActualizada?.id_cliente) || 0,
        folio: String(ordenActualizada?.folio || ''),
        estado,
        paqueteria,
        numero_guia: numeroGuia
      });

      const idClienteNotificacion = Number(ordenActualizada?.id_cliente) || 0;
      if (idClienteNotificacion > 0) {
        const folioNot = String(ordenActualizada?.folio || '').trim();
        const mensajeBase = mensajeEstadoPedidoCliente(estado);
        const mensajeFinal = folioNot ? `${mensajeBase} (${folioNot})` : mensajeBase;
        await dbRun(
          bdVentas,
          `INSERT INTO tienda_notificaciones_cliente
           (id_cliente, id_orden, tipo, titulo, mensaje, leida, creado_en)
           VALUES (?, ?, 'pedido_estado', ?, ?, 0, CURRENT_TIMESTAMP)`,
          [
            idClienteNotificacion,
            id,
            tituloEstadoPedidoCliente(estado),
            mensajeFinal
          ]
        );
      }

      const correoCliente = String(ordenActualizada?.email_cliente || '').trim();
      if (correoCliente) {
        const configTienda = await obtenerConfigTienda(bdVentas);
        const plantillas = obtenerPlantillasCorreoDesdeConfig(configTienda);
        const correo = construirCorreoEstadoPedido({
          nombreCliente: String(ordenActualizada?.nombre_cliente || 'cliente').trim(),
          folio: String(ordenActualizada?.folio || '').trim(),
          estado,
          mensajeEstado: mensajeEstadoPedidoCliente(estado),
          total: Number(ordenActualizada?.total || 0),
          metodoPago: String(ordenActualizada?.metodo_pago || 'No especificado'),
          puntoEntrega: String(ordenActualizada?.nombre_punto_entrega || 'No especificado'),
          paqueteria,
          numeroGuia,
          plantillas
        });
        await enviarCorreoCliente({
          to: correoCliente,
          subject: correo.subject,
          text: correo.text,
          html: correo.html
        });
      }

      transmitir({ tipo: 'ventas_actualizado' });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "No se pudo actualizar estado" });
    }
  });

  app.patch('/tienda/admin/ordenes/:id/pago', authInterno, async (req, res) => {
    try {
      const id = Number(req.params.id || 0);
      const estadoPago = normalizarEstadoPago(req.body?.estado_pago, 'pendiente_manual');
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Orden inválida' });

      const orden = await dbGet(
        bdVentas,
        `SELECT id, id_cliente, folio, estado, estado_pago
         FROM tienda_ordenes
         WHERE id = ?
         LIMIT 1`,
        [id]
      );
      if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });

      const estadoOrdenNuevo = (estadoPago === 'pagado' && String(orden.estado || '').trim().toLowerCase() === 'pendiente')
        ? 'confirmado'
        : String(orden.estado || 'pendiente').trim().toLowerCase();

      await dbRun(
        bdVentas,
        `UPDATE tienda_ordenes
         SET estado_pago = ?, estado = ?, estado_pago_actualizado_en = CURRENT_TIMESTAMP, actualizado_en = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [estadoPago, estadoOrdenNuevo, id]
      );

      transmitir({
        tipo: 'tienda_orden_actualizada',
        id_orden: id,
        id_cliente: Number(orden?.id_cliente) || 0,
        folio: String(orden?.folio || ''),
        estado: estadoOrdenNuevo,
        estado_pago: estadoPago
      });

      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'No se pudo actualizar estado de pago' });
    }
  });

  app.get('/tienda/admin/descuentos', authInterno, async (req, res) => {
    try {
      const rows = await dbAll(
        bdVentas,
        `SELECT id, scope, clave, activo, porcentaje, actualizado_en
         FROM tienda_descuentos
         ORDER BY scope ASC, clave ASC`
      );
      res.json(rows || []);
    } catch {
      res.status(500).json({ error: 'No se pudieron cargar descuentos' });
    }
  });

  app.post('/tienda/admin/descuentos/upsert', authInterno, async (req, res) => {
    try {
      const scope = String(req.body?.scope || '').trim().toLowerCase();
      const clave = String(req.body?.clave || '').trim();
      const activo = boolToInt(req.body?.activo);
      const porcentaje = Math.max(0, Number(req.body?.porcentaje) || 0);
      const claveNormalizada = scope === 'global' ? '__all__' : clave;

      if (!['global', 'global_exclusion', 'categoria', 'producto'].includes(scope)) {
        return res.status(400).json({ error: 'scope inválido (global|global_exclusion|categoria|producto)' });
      }
      if (scope !== 'global' && !claveNormalizada) {
        return res.status(400).json({ error: 'clave obligatoria' });
      }

      const porcentajeFinal = scope === 'global_exclusion' ? 0 : porcentaje;

      await dbRun(
        bdVentas,
        `INSERT INTO tienda_descuentos (scope, clave, activo, porcentaje, actualizado_en)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(scope, clave) DO UPDATE SET
           activo = excluded.activo,
           porcentaje = excluded.porcentaje,
           actualizado_en = CURRENT_TIMESTAMP`,
        [scope, claveNormalizada, activo, porcentajeFinal]
      );

      transmitir({ tipo: 'tienda_descuentos_actualizados', scope, clave: claveNormalizada, activo: Number(activo) === 1, porcentaje: porcentajeFinal });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'No se pudo guardar descuento' });
    }
  });

  app.get('/tienda/admin/paquetes', authInterno, async (req, res) => {
    try {
      const paquetes = await dbAll(
        bdVentas,
        `SELECT id, nombre, slug, descripcion, image_url, activo, actualizado_en
         FROM tienda_paquetes
         ORDER BY nombre ASC`
      );
      const items = await dbAll(
        bdVentas,
        `SELECT id_paquete, receta_nombre, cantidad, orden
         FROM tienda_paquetes_items
         ORDER BY id_paquete ASC, orden ASC, id ASC`
      );

      const porPaquete = new Map();
      (items || []).forEach((item) => {
        const id = Number(item?.id_paquete);
        if (!porPaquete.has(id)) porPaquete.set(id, []);
        porPaquete.get(id).push({
          receta_nombre: String(item?.receta_nombre || '').trim(),
          cantidad: Math.max(1, Number(item?.cantidad) || 1)
        });
      });

      res.json((paquetes || []).map((p) => ({ ...p, image_url: normalizarMediaUrl(p?.image_url), items: porPaquete.get(Number(p?.id)) || [] })));
    } catch {
      res.status(500).json({ error: 'No se pudieron cargar paquetes' });
    }
  });

  app.post('/tienda/admin/paquetes', authInterno, async (req, res) => {
    try {
      const nombre = String(req.body?.nombre || '').trim();
      const descripcion = String(req.body?.descripcion || '').trim();
      const imageUrl = normalizarMediaUrl(req.body?.image_url);
      const activo = boolToInt(req.body?.activo);
      const items = Array.isArray(req.body?.items) ? req.body.items : [];

      if (!nombre) return res.status(400).json({ error: 'Nombre de paquete obligatorio' });
      if (!items.length) return res.status(400).json({ error: 'Agrega al menos una receta al paquete' });

      const slug = slugify(nombre);
      const creado = await dbRun(
        bdVentas,
        `INSERT INTO tienda_paquetes (nombre, slug, descripcion, image_url, activo, actualizado_en)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [nombre, slug, descripcion, imageUrl, activo]
      );

      const idPaquete = Number(creado?.lastID) || 0;
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i] || {};
        const recetaNombre = String(item?.receta_nombre || '').trim();
        const cantidad = Math.max(1, Number(item?.cantidad) || 1);
        if (!recetaNombre) continue;
        await dbRun(
          bdVentas,
          `INSERT INTO tienda_paquetes_items (id_paquete, receta_nombre, cantidad, orden)
           VALUES (?, ?, ?, ?)`,
          [idPaquete, recetaNombre, cantidad, i]
        );
      }

      transmitir({ tipo: 'tienda_catalogo_actualizado', receta_nombre: nombre, activo: Number(activo) === 1 });
      res.json({ ok: true, id: idPaquete });
    } catch {
      res.status(500).json({ error: 'No se pudo crear el paquete' });
    }
  });

  app.patch('/tienda/admin/paquetes/:id', authInterno, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Paquete inválido' });

      const previo = await dbGet(bdVentas, 'SELECT id, nombre FROM tienda_paquetes WHERE id = ?', [id]);
      if (!previo) return res.status(404).json({ error: 'Paquete no encontrado' });

      const nombre = String(req.body?.nombre || previo.nombre || '').trim();
      const descripcion = String(req.body?.descripcion || '').trim();
      const imageUrl = normalizarMediaUrl(req.body?.image_url);
      const activo = boolToInt(req.body?.activo);
      const items = Array.isArray(req.body?.items) ? req.body.items : null;

      await dbRun(
        bdVentas,
        `UPDATE tienda_paquetes
         SET nombre = ?, slug = ?, descripcion = ?, image_url = ?, activo = ?, actualizado_en = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nombre, slugify(nombre), descripcion, imageUrl, activo, id]
      );

      if (items) {
        await dbRun(bdVentas, 'DELETE FROM tienda_paquetes_items WHERE id_paquete = ?', [id]);
        for (let i = 0; i < items.length; i += 1) {
          const item = items[i] || {};
          const recetaNombre = String(item?.receta_nombre || '').trim();
          const cantidad = Math.max(1, Number(item?.cantidad) || 1);
          if (!recetaNombre) continue;
          await dbRun(
            bdVentas,
            `INSERT INTO tienda_paquetes_items (id_paquete, receta_nombre, cantidad, orden)
             VALUES (?, ?, ?, ?)`,
            [id, recetaNombre, cantidad, i]
          );
        }
      }

      transmitir({ tipo: 'tienda_catalogo_actualizado', receta_nombre: nombre, activo: Number(activo) === 1 });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'No se pudo actualizar el paquete' });
    }
  });

  app.delete('/tienda/admin/paquetes/:id', authInterno, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Paquete inválido' });
      await dbRun(bdVentas, 'DELETE FROM tienda_paquetes_items WHERE id_paquete = ?', [id]);
      await dbRun(bdVentas, 'DELETE FROM tienda_paquetes WHERE id = ?', [id]);
      transmitir({ tipo: 'tienda_catalogo_actualizado' });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'No se pudo eliminar el paquete' });
    }
  });

  app.post("/tienda/auth/register", async (req, res) => {
    try {
      const nombre = String(req.body?.nombre || "").trim();
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      const telefono = String(req.body?.telefono || "").trim();
      const recibePromociones = boolToInt(req.body?.recibe_promociones);

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
        `INSERT INTO tienda_clientes (nombre, apellido_paterno, apellido_materno, email, password_hash, telefono, fecha_nacimiento, direccion_default, forma_pago_preferida, recibe_promociones, creado_en, actualizado_en)
         VALUES (?, '', '', ?, ?, ?, '', '', '', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [nombre, email, hash, telefono, recibePromociones]
      );

      try {
        const configTienda = await obtenerConfigTienda(bdVentas);
        const plantillas = obtenerPlantillasCorreoDesdeConfig(configTienda);
        const basePublica = String(process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || 'https://chipactli.onrender.com/').trim().replace(/\/+$/, '');
        const urlTienda = basePublica || 'https://chipactli.onrender.com/';
        const correoBienvenida = construirCorreoBienvenida({
          nombreCliente: nombre,
          emailCliente: email,
          urlTienda,
          plantillas
        });
        await enviarCorreoCliente({
          to: email,
          subject: correoBienvenida.subject,
          text: correoBienvenida.text,
          html: correoBienvenida.html
        });
      } catch {
        // El registro no debe fallar si el correo de bienvenida no se envía.
      }

      const cliente = { id: creado.lastID, nombre, email, recibe_promociones: recibePromociones };
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
          apellido_paterno: cliente.apellido_paterno || "",
          apellido_materno: cliente.apellido_materno || "",
          email: cliente.email,
          telefono: cliente.telefono || "",
          fecha_nacimiento: cliente.fecha_nacimiento || "",
          direccion_default: cliente.direccion_default || "",
          forma_pago_preferida: cliente.forma_pago_preferida || "",
          recibe_promociones: Number(cliente?.recibe_promociones) === 1
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
        "SELECT id, nombre, apellido_paterno, apellido_materno, email, telefono, fecha_nacimiento, direccion_default, forma_pago_preferida, recibe_promociones FROM tienda_clientes WHERE id = ?",
        [req.cliente.id]
      );
      if (!cliente) return res.status(404).json({ exito: false, mensaje: "Cliente no encontrado" });
      cliente.recibe_promociones = Number(cliente?.recibe_promociones) === 1;
      return res.json({ exito: true, cliente });
    } catch {
      return res.status(500).json({ exito: false, mensaje: "No se pudo cargar el perfil" });
    }
  });

  app.patch("/tienda/auth/perfil", authCliente, async (req, res) => {
    try {
      const nombre = String(req.body?.nombre || "").trim();
      const apellidoPaterno = String(req.body?.apellido_paterno || "").trim();
      const apellidoMaterno = String(req.body?.apellido_materno || "").trim();
      const email = String(req.body?.email || "").trim().toLowerCase();
      const telefono = String(req.body?.telefono || "").trim();
      const fechaNacimiento = String(req.body?.fecha_nacimiento || "").trim();
      const direccionDefault = String(req.body?.direccion_default || "").trim();
      const formaPago = String(req.body?.forma_pago_preferida || "").trim();
      const recibePromociones = tieneClave(req.body || {}, 'recibe_promociones')
        ? boolToInt(req.body?.recibe_promociones)
        : null;

      if (email) {
        const existeCorreo = await dbGet(
          bdVentas,
          "SELECT id FROM tienda_clientes WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) AND id <> ? LIMIT 1",
          [email, req.cliente.id]
        );
        if (existeCorreo) {
          return res.status(409).json({ exito: false, mensaje: "Ese correo ya está registrado en otra cuenta" });
        }
      }

      await dbRun(
        bdVentas,
        `UPDATE tienda_clientes
         SET nombre = COALESCE(NULLIF(?, ''), nombre),
             apellido_paterno = ?,
             apellido_materno = ?,
             email = COALESCE(NULLIF(?, ''), email),
             telefono = ?,
             fecha_nacimiento = ?,
             direccion_default = ?,
             forma_pago_preferida = ?,
             recibe_promociones = COALESCE(?, recibe_promociones),
             actualizado_en = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nombre, apellidoPaterno, apellidoMaterno, email, telefono, fechaNacimiento, direccionDefault, formaPago, recibePromociones, req.cliente.id]
      );

      const cliente = await dbGet(
        bdVentas,
        "SELECT id, nombre, apellido_paterno, apellido_materno, email, telefono, fecha_nacimiento, direccion_default, forma_pago_preferida, recibe_promociones FROM tienda_clientes WHERE id = ?",
        [req.cliente.id]
      );
      if (cliente) {
        cliente.recibe_promociones = Number(cliente?.recibe_promociones) === 1;
      }
      return res.json({ exito: true, cliente });
    } catch {
      return res.status(500).json({ exito: false, mensaje: "No se pudo actualizar el perfil" });
    }
  });

  app.get('/tienda/auth/direcciones', authCliente, async (req, res) => {
    try {
      const rows = await dbAll(
        bdVentas,
        `SELECT id, alias, direccion, referencias, es_preferida, activo, creado_en, actualizado_en
         FROM tienda_clientes_direcciones
         WHERE id_cliente = ? AND activo = 1
         ORDER BY es_preferida DESC, actualizado_en DESC, id DESC`,
        [req.cliente.id]
      );
      res.json({ exito: true, direcciones: rows || [] });
    } catch {
      res.status(500).json({ exito: false, mensaje: 'No se pudieron cargar direcciones' });
    }
  });

  app.post('/tienda/auth/direcciones', authCliente, async (req, res) => {
    try {
      const alias = String(req.body?.alias || '').trim();
      const direccion = String(req.body?.direccion || '').trim();
      const referencias = String(req.body?.referencias || '').trim();
      const esPreferida = boolToInt(req.body?.es_preferida);

      if (!direccion) {
        return res.status(400).json({ exito: false, mensaje: 'La dirección es obligatoria' });
      }

      if (esPreferida === 1) {
        await dbRun(
          bdVentas,
          `UPDATE tienda_clientes_direcciones
           SET es_preferida = 0, actualizado_en = CURRENT_TIMESTAMP
           WHERE id_cliente = ? AND activo = 1`,
          [req.cliente.id]
        );
      }

      const insert = await dbRun(
        bdVentas,
        `INSERT INTO tienda_clientes_direcciones (id_cliente, alias, direccion, referencias, es_preferida, activo, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [req.cliente.id, alias, direccion, referencias, esPreferida]
      );

      if (esPreferida === 1) {
        await dbRun(
          bdVentas,
          `UPDATE tienda_clientes
           SET direccion_default = ?, actualizado_en = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [direccion, req.cliente.id]
        );
      }

      const creada = await dbGet(
        bdVentas,
        `SELECT id, alias, direccion, referencias, es_preferida, activo, creado_en, actualizado_en
         FROM tienda_clientes_direcciones WHERE id = ? LIMIT 1`,
        [insert.lastID]
      );
      return res.json({ exito: true, direccion: creada });
    } catch {
      return res.status(500).json({ exito: false, mensaje: 'No se pudo guardar la dirección' });
    }
  });

  app.patch('/tienda/auth/direcciones/:id', authCliente, async (req, res) => {
    try {
      const idDireccion = Number(req.params.id);
      if (!Number.isFinite(idDireccion) || idDireccion <= 0) {
        return res.status(400).json({ exito: false, mensaje: 'Dirección inválida' });
      }

      const actual = await dbGet(
        bdVentas,
        `SELECT id, id_cliente, alias, direccion, referencias, es_preferida, activo
         FROM tienda_clientes_direcciones WHERE id = ? LIMIT 1`,
        [idDireccion]
      );
      if (!actual || Number(actual.id_cliente) !== Number(req.cliente.id) || Number(actual.activo) !== 1) {
        return res.status(404).json({ exito: false, mensaje: 'Dirección no encontrada' });
      }

      const alias = String(req.body?.alias ?? actual.alias ?? '').trim();
      const direccion = String(req.body?.direccion ?? actual.direccion ?? '').trim();
      const referencias = String(req.body?.referencias ?? actual.referencias ?? '').trim();
      const esPreferida = boolToInt(tieneClave(req.body || {}, 'es_preferida') ? req.body?.es_preferida : actual.es_preferida);

      if (!direccion) {
        return res.status(400).json({ exito: false, mensaje: 'La dirección es obligatoria' });
      }

      if (esPreferida === 1) {
        await dbRun(
          bdVentas,
          `UPDATE tienda_clientes_direcciones
           SET es_preferida = 0, actualizado_en = CURRENT_TIMESTAMP
           WHERE id_cliente = ? AND activo = 1`,
          [req.cliente.id]
        );
      }

      await dbRun(
        bdVentas,
        `UPDATE tienda_clientes_direcciones
         SET alias = ?, direccion = ?, referencias = ?, es_preferida = ?, actualizado_en = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [alias, direccion, referencias, esPreferida, idDireccion]
      );

      if (esPreferida === 1) {
        await dbRun(
          bdVentas,
          `UPDATE tienda_clientes
           SET direccion_default = ?, actualizado_en = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [direccion, req.cliente.id]
        );
      }

      const actualizada = await dbGet(
        bdVentas,
        `SELECT id, alias, direccion, referencias, es_preferida, activo, creado_en, actualizado_en
         FROM tienda_clientes_direcciones WHERE id = ? LIMIT 1`,
        [idDireccion]
      );
      return res.json({ exito: true, direccion: actualizada });
    } catch {
      return res.status(500).json({ exito: false, mensaje: 'No se pudo actualizar la dirección' });
    }
  });

  app.delete('/tienda/auth/direcciones/:id', authCliente, async (req, res) => {
    try {
      const idDireccion = Number(req.params.id);
      if (!Number.isFinite(idDireccion) || idDireccion <= 0) {
        return res.status(400).json({ exito: false, mensaje: 'Dirección inválida' });
      }

      const actual = await dbGet(
        bdVentas,
        `SELECT id, id_cliente, direccion, es_preferida, activo
         FROM tienda_clientes_direcciones WHERE id = ? LIMIT 1`,
        [idDireccion]
      );
      if (!actual || Number(actual.id_cliente) !== Number(req.cliente.id) || Number(actual.activo) !== 1) {
        return res.status(404).json({ exito: false, mensaje: 'Dirección no encontrada' });
      }

      await dbRun(
        bdVentas,
        `UPDATE tienda_clientes_direcciones
         SET activo = 0, es_preferida = 0, actualizado_en = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [idDireccion]
      );

      if (Number(actual.es_preferida) === 1) {
        const otraPreferida = await dbGet(
          bdVentas,
          `SELECT id, direccion
           FROM tienda_clientes_direcciones
           WHERE id_cliente = ? AND activo = 1
           ORDER BY actualizado_en DESC, id DESC
           LIMIT 1`,
          [req.cliente.id]
        );

        if (otraPreferida) {
          await dbRun(
            bdVentas,
            `UPDATE tienda_clientes_direcciones
             SET es_preferida = 1, actualizado_en = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [otraPreferida.id]
          );
          await dbRun(
            bdVentas,
            `UPDATE tienda_clientes
             SET direccion_default = ?, actualizado_en = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [String(otraPreferida.direccion || ''), req.cliente.id]
          );
        } else {
          await dbRun(
            bdVentas,
            `UPDATE tienda_clientes
             SET direccion_default = '', actualizado_en = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [req.cliente.id]
          );
        }
      }

      return res.json({ exito: true });
    } catch {
      return res.status(500).json({ exito: false, mensaje: 'No se pudo eliminar la dirección' });
    }
  });

  app.post('/tienda/auth/atencion', authCliente, async (req, res) => {
    try {
      const asunto = String(req.body?.asunto || '').trim();
      const mensaje = String(req.body?.mensaje || '').trim();
      const nombre = String(req.body?.nombre || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const telefono = String(req.body?.telefono || '').trim();

      if (!asunto || !mensaje) {
        return res.status(400).json({ exito: false, mensaje: 'Asunto y mensaje son obligatorios' });
      }

      const perfilCliente = await dbGet(
        bdVentas,
        `SELECT id, nombre, email, telefono
         FROM tienda_clientes
         WHERE id = ? LIMIT 1`,
        [req.cliente.id]
      );
      if (!perfilCliente) {
        return res.status(404).json({ exito: false, mensaje: 'Cliente no encontrado' });
      }

      await dbRun(
        bdVentas,
        `INSERT INTO tienda_atencion_clientes (id_cliente, nombre_cliente, email_cliente, telefono_cliente, asunto, mensaje, estado, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, ?, ?, 'abierto', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          req.cliente.id,
          nombre || String(perfilCliente.nombre || ''),
          email || String(perfilCliente.email || ''),
          telefono || String(perfilCliente.telefono || ''),
          asunto,
          mensaje
        ]
      );

      return res.json({ exito: true, mensaje: 'Mensaje enviado correctamente' });
    } catch {
      return res.status(500).json({ exito: false, mensaje: 'No se pudo enviar tu mensaje' });
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
          image_url: normalizarMediaUrl(row?.image_url),
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
        `SELECT receta_nombre, slug, descripcion, image_url, ingredientes, variantes,
                es_lanzamiento, es_favorito, es_oferta, es_accesorio, activo
         FROM tienda_catalogo
         WHERE LOWER(TRIM(receta_nombre)) = LOWER(TRIM(?))
         LIMIT 1`,
        [recetaNombre]
      );

      const recetaNombreGuardar = String(previo?.receta_nombre || recetaNombre).trim();

      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const slugSolicitado = tieneClave(body, 'slug')
        ? slugify(body.slug || recetaNombre)
        : slugify(previo?.slug || recetaNombre);
      const slug = await resolverSlugCatalogoUnico(bdVentas, slugSolicitado, recetaNombreGuardar);
      const descripcion = tieneClave(body, 'descripcion')
        ? String(body.descripcion || '').trim()
        : String(previo?.descripcion || '').trim();
      const imageUrl = tieneClave(body, 'image_url')
        ? normalizarMediaUrl(body.image_url)
        : normalizarMediaUrl(previo?.image_url);
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
      const activo = tieneClave(body, 'activo') ? (body.activo === false ? 0 : 1) : (previo ? (Number(previo?.activo) === 0 ? 0 : 1) : 0);

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
        [recetaNombreGuardar, slug, descripcion, imageUrl, ingredientes, variantes, esLanzamiento, esFavorito, esOferta, esAccesorio, activo]
      );

      transmitir({
        tipo: 'tienda_catalogo_actualizado',
        receta_nombre: recetaNombreGuardar,
        activo: Number(activo) === 1
      });

      res.json({ ok: true, slug, receta_nombre: recetaNombreGuardar });
    } catch (error) {
      res.status(500).json({
        error: "No se pudo guardar el catálogo",
        detalle: String(error?.message || '').trim() || 'error_desconocido'
      });
    }
  });

  app.post('/tienda/checkout/mercado-pago/preferencia', authCliente, async (req, res) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      const origenPedido = normalizarOrigenPedido(req.body?.origen_pedido, 'web');
      const idPuntoEntrega = Number(req.body?.id_punto_entrega);
      const notas = String(req.body?.notas || "").trim();
      const urlRetornoBase = String(req.body?.url_retorno_base || '').trim();

      if (!items.length) return res.status(400).json({ error: 'El carrito está vacío' });

      const normalizarRetorno = (base, estado) => {
        try {
          const parsed = new URL(base);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
          parsed.searchParams.set('mp_status', estado);
          return parsed.toString();
        } catch {
          return '';
        }
      };

      const successUrl = normalizarRetorno(urlRetornoBase, 'success');
      const pendingUrl = normalizarRetorno(urlRetornoBase, 'pending');
      const failureUrl = normalizarRetorno(urlRetornoBase, 'failure');

      const disponibles = await obtenerProductosDisponibles(
        bdProduccion,
        bdRecetas,
        bdVentas,
        { agruparVariantes: false, incluirOcultos: true, bdInventario }
      );
      const mapa = new Map(disponibles.map((p) => [String(p?.nombre_receta || '').trim().toLowerCase(), p]));

      const itemsFinales = [];
      let total = 0;
      const mapaStockTemporal = new Map();

      for (const item of items) {
        const nombreReceta = String(item?.nombre_receta || '').trim();
        const nombreRecetaKey = nombreReceta.toLowerCase();
        const cantidad = Math.max(1, Number(item?.cantidad) || 1);
        const variante = String(item?.variante || '').trim();
        let producto = mapa.get(nombreRecetaKey);
        if (!producto) {
          const baseBuscada = nombreBaseProducto(nombreReceta, 0);
          producto = (disponibles || []).find((p) => nombreBaseProducto(String(p?.nombre_receta || '').trim(), 0) === baseBuscada) || null;
        }

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
        'SELECT id, nombre, email, telefono FROM tienda_clientes WHERE id = ?',
        [req.cliente.id]
      );
      if (!cliente) return res.status(401).json({ error: 'Cliente inválido' });

      const puntoEntrega = await dbGet(
        bdVentas,
        'SELECT id, nombre, direccion, horario, activo FROM tienda_puntos_entrega WHERE id = ?',
        [idPuntoEntrega]
      );
      if (!puntoEntrega || Number(puntoEntrega.activo) !== 1) {
        return res.status(400).json({ error: 'Selecciona un punto de entrega válido' });
      }

      const direccionEntrega = [
        String(puntoEntrega.nombre || '').trim(),
        String(puntoEntrega.direccion || '').trim(),
        String(puntoEntrega.horario || '').trim()
      ].filter(Boolean).join(' · ');

      const folio = await generarFolioOrdenTienda(bdVentas, origenPedido);
      const preferenciaMercadoPago = await crearPreferenciaMercadoPago({
        orden: { folio, id: 0 },
        items: itemsFinales,
        returnUrls: {
          success: successUrl,
          pending: pendingUrl,
          failure: failureUrl
        }
      });
      if (!preferenciaMercadoPago?.ok || !String(preferenciaMercadoPago?.init_point || '').trim()) {
        return res.status(400).json({ error: preferenciaMercadoPago?.mensaje || 'No se pudo iniciar pago con Mercado Pago' });
      }

      const checkout = {
        proveedor: 'mercado_pago',
        preference_id: preferenciaMercadoPago.id,
        init_point: preferenciaMercadoPago.init_point,
        sandbox_init_point: preferenciaMercadoPago.sandbox_init_point
      };

      await dbRun(
        bdVentas,
        `INSERT INTO tienda_checkout_intentos
         (folio, id_cliente, origen_pedido, metodo_pago, id_punto_entrega, nombre_punto_entrega, direccion_entrega, notas, total, items_json, preference_id, payment_status, detalle_pago, creado_en, actualizado_en)
         VALUES (?, ?, ?, 'mercado_pago', ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          folio,
          Number(cliente.id) || 0,
          origenPedido,
          Number(puntoEntrega.id) || 0,
          String(puntoEntrega.nombre || ''),
          direccionEntrega,
          notas,
          total,
          JSON.stringify(itemsFinales),
          String(preferenciaMercadoPago.id || ''),
          JSON.stringify(checkout)
        ]
      );

      res.json({
        ok: true,
        folio,
        checkout
      });
    } catch {
      res.status(500).json({ error: 'No se pudo preparar checkout con Mercado Pago' });
    }
  });

  async function confirmarCheckoutMercadoPagoCliente({ idCliente, paymentId = '', preferenceId = '', intentoInicial = null, modoSilencioso = false }) {
    let intento = intentoInicial || null;
    const paymentIdTxt = String(paymentId || '').trim();
    const preferenceIdTxt = String(preferenceId || '').trim();

    if (!intento && preferenceIdTxt) {
      intento = await dbGet(
        bdVentas,
        `SELECT *
         FROM tienda_checkout_intentos
         WHERE id_cliente = ? AND preference_id = ?
         ORDER BY id DESC
         LIMIT 1`,
        [idCliente, preferenceIdTxt]
      );
    }

    let pagoMp = null;
    if (paymentIdTxt) {
      pagoMp = await consultarPagoMercadoPagoPorId(paymentIdTxt);
    }

    if (!intento && pagoMp?.mp_preference_id) {
      intento = await dbGet(
        bdVentas,
        `SELECT *
         FROM tienda_checkout_intentos
         WHERE id_cliente = ? AND preference_id = ?
         ORDER BY id DESC
         LIMIT 1`,
        [idCliente, pagoMp.mp_preference_id]
      );
    }

    if (!intento) {
      return { status: 404, payload: { error: 'No se encontró el checkout pendiente de Mercado Pago' } };
    }

    if (Number(intento.id_orden_generada) > 0) {
      const ordenExistente = await dbGet(
        bdVentas,
        `SELECT id, folio, origen_pedido, total, metodo_pago, estado_pago, estado
         FROM tienda_ordenes
         WHERE id = ?
         LIMIT 1`,
        [Number(intento.id_orden_generada) || 0]
      );
      if (ordenExistente) {
        return { status: 200, payload: { ok: true, orden: ordenExistente, ya_existia: true } };
      }
    }

    if (!pagoMp && String(intento?.payment_id || '').trim()) {
      pagoMp = await consultarPagoMercadoPagoPorId(String(intento.payment_id || '').trim());
    }

    if (!pagoMp && String(intento?.folio || '').trim()) {
      pagoMp = await consultarPagoMercadoPagoPorFolio(intento.folio);
    }

    const estadoPago = normalizarEstadoPago(pagoMp?.estado_pago, 'pendiente');
    if (estadoPago !== 'pagado') {
      await dbRun(
        bdVentas,
        `UPDATE tienda_checkout_intentos
         SET payment_id = ?, payment_status = ?, payment_status_detail = ?, detalle_pago = ?, actualizado_en = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          String(pagoMp?.mp_payment_id || paymentIdTxt || ''),
          String(pagoMp?.mp_status || estadoPago || 'pendiente'),
          String(pagoMp?.mp_status_detail || ''),
          JSON.stringify(pagoMp || {}),
          Number(intento.id) || 0
        ]
      );
      if (modoSilencioso) {
        return { status: 200, payload: { ok: false, pendiente: estadoPago !== 'rechazado', estado_pago: estadoPago } };
      }
      return {
        status: 400,
        payload: {
          error: estadoPago === 'rechazado'
            ? 'Mercado Pago rechazó el pago. Intenta con otro método.'
            : 'El pago aún no está confirmado por Mercado Pago.',
          estado_pago: estadoPago
        }
      };
    }

    const cliente = await dbGet(
      bdVentas,
      'SELECT id, nombre, email, telefono FROM tienda_clientes WHERE id = ?',
      [idCliente]
    );
    if (!cliente) return { status: 401, payload: { error: 'Cliente inválido' } };

    const puntoEntrega = {
      id: Number(intento.id_punto_entrega) || 0,
      nombre: String(intento.nombre_punto_entrega || ''),
      direccion: '',
      horario: ''
    };
    const direccionEntrega = String(intento.direccion_entrega || '').trim();

    let itemsFinales = [];
    try {
      itemsFinales = JSON.parse(String(intento.items_json || '[]')) || [];
    } catch {
      itemsFinales = [];
    }
    if (!Array.isArray(itemsFinales) || !itemsFinales.length) {
      return { status: 400, payload: { error: 'No se pudo reconstruir el carrito pagado' } };
    }

    const checkout = {
      proveedor: 'mercado_pago',
      preference_id: String(intento.preference_id || pagoMp?.mp_preference_id || preferenceIdTxt || ''),
      payment_id: String(pagoMp?.mp_payment_id || paymentIdTxt || ''),
      mp_status: String(pagoMp?.mp_status || 'approved'),
      mp_status_detail: String(pagoMp?.mp_status_detail || ''),
      estado_pago: 'pagado',
      confirmado_en: new Date().toISOString()
    };

    const orden = await crearOrdenTiendaDesdeItems({
      bdProduccion,
      bdVentas,
      bdInventario,
      cliente,
      itemsFinales,
      metodoPago: 'mercado_pago',
      origenPedido: normalizarOrigenPedido(intento.origen_pedido, 'web'),
      puntoEntrega,
      direccionEntrega,
      notas: String(intento.notas || '').trim(),
      folio: String(intento.folio || '').trim(),
      checkout
    });

    await dbRun(
      bdVentas,
      `UPDATE tienda_ordenes
       SET estado_pago = 'pagado', estado_pago_actualizado_en = CURRENT_TIMESTAMP, estado = CASE WHEN COALESCE(TRIM(estado), '') = '' OR LOWER(estado) = 'pendiente' THEN 'confirmado' ELSE estado END,
           detalle_pago = ?, actualizado_en = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [JSON.stringify(checkout), Number(orden.id) || 0]
    );

    await dbRun(
      bdVentas,
      `UPDATE tienda_checkout_intentos
       SET id_orden_generada = ?, payment_id = ?, payment_status = ?, payment_status_detail = ?, detalle_pago = ?, actualizado_en = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        Number(orden.id) || 0,
        String(checkout.payment_id || ''),
        String(checkout.mp_status || 'approved'),
        String(checkout.mp_status_detail || ''),
        JSON.stringify(checkout),
        Number(intento.id) || 0
      ]
    );

    return {
      status: 200,
      payload: {
        ok: true,
        orden: {
          ...orden,
          estado_pago: 'pagado',
          estado: 'confirmado'
        }
      }
    };
  }

  app.post('/tienda/checkout/mercado-pago/reconciliar', authCliente, async (req, res) => {
    try {
      const preferenceId = String(req.body?.preference_id || '').trim();
      const intentos = [];

      if (preferenceId) {
        const intentoPreferencia = await dbGet(
          bdVentas,
          `SELECT *
           FROM tienda_checkout_intentos
           WHERE id_cliente = ? AND preference_id = ?
           ORDER BY id DESC
           LIMIT 1`,
          [req.cliente.id, preferenceId]
        );
        if (intentoPreferencia) intentos.push(intentoPreferencia);
      }

      const pendientes = await dbAll(
        bdVentas,
        `SELECT *
         FROM tienda_checkout_intentos
         WHERE id_cliente = ?
           AND metodo_pago = 'mercado_pago'
           AND COALESCE(id_orden_generada, 0) = 0
         ORDER BY id DESC
         LIMIT 10`,
        [req.cliente.id]
      );

      for (const intento of (pendientes || [])) {
        const existe = intentos.some((it) => Number(it?.id || 0) === Number(intento?.id || 0));
        if (!existe) intentos.push(intento);
      }

      if (!intentos.length) return res.json({ ok: false, pendiente: false });

      let hayPendientes = false;
      for (const intento of intentos) {
        const resultado = await confirmarCheckoutMercadoPagoCliente({
          idCliente: req.cliente.id,
          preferenceId: String(intento.preference_id || preferenceId || ''),
          intentoInicial: intento,
          modoSilencioso: true
        });

        if (resultado?.status === 200 && resultado?.payload?.ok && resultado?.payload?.orden) {
          return res.status(200).json(resultado.payload);
        }

        if (resultado?.payload?.pendiente || resultado?.payload?.estado_pago === 'pendiente') {
          hayPendientes = true;
        }
      }

      return res.json({ ok: false, pendiente: hayPendientes });
    } catch {
      return res.status(500).json({ error: 'No se pudo reconciliar checkout de Mercado Pago' });
    }
  });

  app.post('/tienda/checkout/mercado-pago/confirmar', authCliente, async (req, res) => {
    try {
      const resultado = await confirmarCheckoutMercadoPagoCliente({
        idCliente: req.cliente.id,
        paymentId: String(req.body?.payment_id || req.body?.collection_id || '').trim(),
        preferenceId: String(req.body?.preference_id || '').trim(),
        modoSilencioso: false
      });
      return res.status(resultado.status).json(resultado.payload);
    } catch {
      return res.status(500).json({ error: 'No se pudo confirmar el pago de Mercado Pago' });
    }
  });

  app.post("/tienda/ordenes", authCliente, async (req, res) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      const metodoPago = String(req.body?.metodo_pago || "").trim() || "efectivo";
      const origenPedido = normalizarOrigenPedido(req.body?.origen_pedido, 'web');
      const idPuntoEntrega = Number(req.body?.id_punto_entrega);
      const notas = String(req.body?.notas || "").trim();

      if (!items.length) return res.status(400).json({ error: "El carrito está vacío" });

      if (metodoPago.toLowerCase() === 'mercado_pago') {
        return res.status(400).json({ error: 'Para Mercado Pago primero inicia checkout y confirma el pago', code: 'mp_preconfirm_required' });
      }

      const disponibles = await obtenerProductosDisponibles(
        bdProduccion,
        bdRecetas,
        bdVentas,
        { agruparVariantes: false, incluirOcultos: true, bdInventario }
      );
      const mapa = new Map(disponibles.map((p) => [String(p?.nombre_receta || '').trim().toLowerCase(), p]));

      const itemsFinales = [];
      let total = 0;
      const mapaStockTemporal = new Map();

      for (const item of items) {
        const nombreReceta = String(item?.nombre_receta || "").trim();
        const nombreRecetaKey = nombreReceta.toLowerCase();
        const cantidad = Math.max(1, Number(item?.cantidad) || 1);
        const variante = String(item?.variante || "").trim();
        let producto = mapa.get(nombreRecetaKey);
        if (!producto) {
          const baseBuscada = nombreBaseProducto(nombreReceta, 0);
          producto = (disponibles || []).find((p) => nombreBaseProducto(String(p?.nombre_receta || '').trim(), 0) === baseBuscada) || null;
        }

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

      const folio = await generarFolioOrdenTienda(bdVentas, origenPedido);
      const orden = await crearOrdenTiendaDesdeItems({
        bdProduccion,
        bdVentas,
        bdInventario,
        cliente,
        itemsFinales,
        metodoPago,
        origenPedido,
        puntoEntrega,
        direccionEntrega,
        notas,
        folio,
        checkout: null
      });

      res.json({
        ok: true,
        orden
      });
    } catch {
      res.status(500).json({ error: "No se pudo crear la orden" });
    }
  });

  app.get("/tienda/ordenes/mis", authCliente, async (req, res) => {
    try {
      const ordenesRaw = await dbAll(
        bdVentas,
        `SELECT id, folio, origen_pedido, metodo_pago, estado, estado_pago, total, moneda, referencia_externa, detalle_pago,
          paqueteria, numero_guia, creado_en, actualizado_en
         FROM tienda_ordenes
         WHERE id_cliente = ?
         ORDER BY id DESC`,
        [req.cliente.id]
      );
      const ordenes = [];
      for (const orden of (ordenesRaw || [])) {
        ordenes.push(await refrescarEstadoPagoOrdenSiAplica(bdVentas, orden));
      }
      res.json(ordenes);
    } catch {
      res.status(500).json({ error: "No se pudieron cargar las órdenes" });
    }
  });

  app.get('/tienda/auth/notificaciones', authCliente, async (req, res) => {
    try {
      const rows = await dbAll(
        bdVentas,
        `SELECT id, id_orden, tipo, titulo, mensaje, leida, creado_en
         FROM tienda_notificaciones_cliente
         WHERE id_cliente = ?
         ORDER BY id DESC
         LIMIT 100`,
        [req.cliente.id]
      );
      res.json({ exito: true, notificaciones: rows || [] });
    } catch {
      res.status(500).json({ exito: false, mensaje: 'No se pudieron cargar notificaciones' });
    }
  });

  app.post('/tienda/auth/notificaciones/marcar-leidas', authCliente, async (req, res) => {
    try {
      await dbRun(
        bdVentas,
        `UPDATE tienda_notificaciones_cliente
         SET leida = 1
         WHERE id_cliente = ? AND leida = 0`,
        [req.cliente.id]
      );
      res.json({ exito: true });
    } catch {
      res.status(500).json({ exito: false, mensaje: 'No se pudieron actualizar notificaciones' });
    }
  });

  app.post('/tienda/auth/notificaciones/:id/marcar-leida', authCliente, async (req, res) => {
    try {
      const idNotificacion = Number(req.params.id);
      if (!Number.isFinite(idNotificacion) || idNotificacion <= 0) {
        return res.status(400).json({ exito: false, mensaje: 'Notificación inválida' });
      }

      const resultado = await dbRun(
        bdVentas,
        `UPDATE tienda_notificaciones_cliente
         SET leida = 1
         WHERE id = ? AND id_cliente = ?`,
        [idNotificacion, req.cliente.id]
      );

      if (!resultado?.changes) {
        return res.status(404).json({ exito: false, mensaje: 'Notificación no encontrada' });
      }

      return res.json({ exito: true });
    } catch {
      return res.status(500).json({ exito: false, mensaje: 'No se pudo actualizar la notificación' });
    }
  });

  app.delete('/tienda/auth/notificaciones', authCliente, async (req, res) => {
    try {
      await dbRun(
        bdVentas,
        `DELETE FROM tienda_notificaciones_cliente
         WHERE id_cliente = ?`,
        [req.cliente.id]
      );
      res.json({ exito: true });
    } catch {
      res.status(500).json({ exito: false, mensaje: 'No se pudo limpiar historial' });
    }
  });
}
