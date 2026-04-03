import { dbAll, dbRun } from '../db-adapter/index.js';

function truncarTexto(valor = '', max = 1200) {
  return String(valor || '').trim().slice(0, max);
}

function sanitizarDetalle(detalle = {}) {
  const base = detalle && typeof detalle === 'object' ? detalle : { valor: detalle };
  return Object.fromEntries(
    Object.entries(base)
      .filter(([clave]) => typeof clave === 'string' && clave.trim())
      .map(([clave, valor]) => {
        if (Array.isArray(valor)) {
          return [clave, valor.map((item) => truncarTexto(item, 180)).slice(0, 20)];
        }
        if (valor && typeof valor === 'object') {
          return [clave, truncarTexto(JSON.stringify(valor), 500)];
        }
        return [clave, truncarTexto(valor, 240)];
      })
  );
}

export async function registrarAuditoriaAdmin(bdAdmin, accion = '', detalle = {}, usuario = '') {
  const accionNormalizada = truncarTexto(accion, 80);
  if (!accionNormalizada) return;
  const detalleSeguro = sanitizarDetalle(detalle);
  await dbRun(
    bdAdmin,
    'INSERT INTO auditoria_admin (accion, detalle, usuario) VALUES (?, ?, ?)',
    [accionNormalizada, JSON.stringify(detalleSeguro), truncarTexto(usuario, 80)]
  );
}

export async function listarAuditoriaAdmin(bdAdmin, limit = 100) {
  const max = Math.max(1, Math.min(500, Number(limit) || 100));
  const rows = await dbAll(
    bdAdmin,
    'SELECT id, accion, detalle, usuario, fecha FROM auditoria_admin ORDER BY id DESC LIMIT ?',
    [max]
  );

  return (rows || []).map((row) => {
    let detalle = {};
    try {
      detalle = row?.detalle ? JSON.parse(row.detalle) : {};
    } catch {
      detalle = { raw: truncarTexto(row?.detalle || '', 500) };
    }
    return {
      id: row?.id,
      accion: String(row?.accion || '').trim(),
      detalle,
      usuario: String(row?.usuario || '').trim(),
      fecha: String(row?.fecha || '').trim()
    };
  });
}
