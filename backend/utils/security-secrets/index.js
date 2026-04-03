import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..', '..');
const enRender = Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL || process.env.RENDER_INSTANCE_ID);
const esProduccion = String(process.env.NODE_ENV || '').trim() === 'production';
const entornoSeguro = enRender || esProduccion;

function resolverDbDir() {
  if (process.env.DB_DIR) return path.resolve(process.env.DB_DIR);
  const rutaBaseDiscoRender = '/opt/render/data';
  if (entornoSeguro || fs.existsSync(rutaBaseDiscoRender)) {
    return path.join(rutaBaseDiscoRender, 'backend');
  }
  return path.join(backendRoot, 'data');
}

function tokenSeguro(bytes = 48) {
  return crypto.randomBytes(Math.max(16, Number(bytes) || 48)).toString('base64url');
}

function rutaSecretosLocales() {
  return path.join(resolverDbDir(), 'security', 'local-secrets.json');
}

function cargarOGenerarSecretosLocales() {
  const ruta = rutaSecretosLocales();
  const defaults = {
    generado_en: new Date().toISOString(),
    JWT_SECRET: tokenSeguro(48),
    TIENDA_JWT_SECRET: tokenSeguro(48),
    ADMIN_TOKEN: tokenSeguro(36)
  };

  try {
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    if (fs.existsSync(ruta)) {
      const actual = JSON.parse(fs.readFileSync(ruta, 'utf8'));
      const payload = {
        ...defaults,
        ...(actual && typeof actual === 'object' ? actual : {})
      };
      if (!actual?.JWT_SECRET || !actual?.TIENDA_JWT_SECRET || !actual?.ADMIN_TOKEN) {
        fs.writeFileSync(ruta, JSON.stringify(payload, null, 2), 'utf8');
      }
      return payload;
    }
    fs.writeFileSync(ruta, JSON.stringify(defaults, null, 2), 'utf8');
    return defaults;
  } catch {
    return defaults;
  }
}

function obtenerSecretosLocales() {
  if (entornoSeguro) return null;
  return cargarOGenerarSecretosLocales();
}

export function resolveJwtSecret() {
  const env = String(process.env.JWT_SECRET || '').trim();
  if (env) return env;
  const local = obtenerSecretosLocales();
  return String(local?.JWT_SECRET || '').trim();
}

export function resolveTiendaJwtSecret() {
  const env = String(process.env.TIENDA_JWT_SECRET || '').trim();
  if (env) return env;
  const principal = resolveJwtSecret();
  if (principal) return principal;
  const local = obtenerSecretosLocales();
  return String(local?.TIENDA_JWT_SECRET || '').trim();
}

export function resolveAdminToken() {
  const env = String(process.env.ADMIN_TOKEN || '').trim();
  if (env) return env;
  const local = obtenerSecretosLocales();
  return String(local?.ADMIN_TOKEN || '').trim();
}

export function describeSecretSource() {
  if (String(process.env.JWT_SECRET || '').trim() || String(process.env.ADMIN_TOKEN || '').trim() || String(process.env.TIENDA_JWT_SECRET || '').trim()) {
    return 'env';
  }
  return entornoSeguro ? 'missing' : 'local-generated';
}
