import express from "express";
import pkg from "sqlite3";
const { Database } = pkg;
import cors from "cors";
import { WebSocketServer } from "ws";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import { promises as fs } from "fs";
import { existsSync, readFileSync } from "fs";
import multer from "multer";
import jwt from "jsonwebtoken";
import { Client } from "pg";
import { crearPgSqliteCompat } from "./utils/pg-sqlite-compat/index.js";

function cargarDotEnvLocal() {
  try {
    const rutaEnv = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
    if (!existsSync(rutaEnv)) return;
    const contenido = readFileSync(rutaEnv, 'utf8');
    const lineas = String(contenido || '').split(/\r?\n/);
    for (const lineaRaw of lineas) {
      const linea = String(lineaRaw || '').trim();
      if (!linea || linea.startsWith('#')) continue;
      const idx = linea.indexOf('=');
      if (idx <= 0) continue;
      const clave = linea.slice(0, idx).trim();
      if (!clave) continue;
      let valor = linea.slice(idx + 1).trim();
      if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
        valor = valor.slice(1, -1);
      }
      if (process.env[clave] === undefined) {
        process.env[clave] = valor;
      }
    }
  } catch {
    // Ignorar errores de lectura para no bloquear el arranque.
  }
}

cargarDotEnvLocal();

// Importar utilidades centralizadas
import { inicializarWss, inicializarBds, inicializarBdAdmin, programarBackupsAutomaticos, crearBackup, listarBackups, restaurarBackup, configurarBackup, tienePermisoAccion } from "./utils/index.js";

// Importar rutas centralizadas
import {
  registrarRutasInventario,
  registrarRutasCategorias,
  registrarRutasRecetas,
  registrarRutasProduccion,
  registrarRutasCortesias,
  registrarRutasVentas,
  registrarRutasUtensilios,
  registrarRutasAuth,
  registrarRutasUsuarios,
  registrarRutasTienda
} from "./routes/index.js";

// Configuración básica
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Preferir el build de React en production si existe
const reactDist = path.join(__dirname, "../frontend/dist");
let frontendPath = null;
let hasReactBuild = false;
try {
  // Si el build de React existe, usarlo como carpeta frontend
  await fs.access(reactDist);
  frontendPath = reactDist;
  hasReactBuild = true;
  console.log('Usando build de React en:', reactDist);
} catch (e) {
  // No hay build de React. No serviremos el frontend legacy.
  console.log('No se encontró build de React. El servidor no servirá el frontend estático.');
}
const forzarBuildReact = process.env.SERVE_REACT_BUILD === '1';
const enRender = Boolean(process.env.RENDER) || Boolean(process.env.RENDER_EXTERNAL_URL);
const esProduccion = process.env.NODE_ENV === 'production';
const usarBuildReact = hasReactBuild && (forzarBuildReact || enRender || esProduccion);

const app = express();
const servidor = http.createServer(app);
const wss = new WebSocketServer({ server: servidor });
const BODY_JSON_LIMIT = String(process.env.BODY_JSON_LIMIT || '300mb').trim();

// Inicializar WebSocket
inicializarWss(wss);

// Middleware
app.use(cors());
app.use(express.json({ limit: BODY_JSON_LIMIT }));

// Configurar multer para uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB por archivo
});

// Configuración de directorios para las bases de datos.
// Prioridad: DB_DIR (si se define) > ruta persistente por defecto en Render > directorio local.
const ejecutandoEnRender = Boolean(
  process.env.RENDER
  || process.env.RENDER_EXTERNAL_URL
  || process.env.RENDER_INSTANCE_ID
);

const rutaBaseDiscoRender = '/opt/render/data';
const discoRenderDisponible = existsSync(rutaBaseDiscoRender);
const dbDirLocalPorDefecto = path.join(__dirname, 'data');

const dbDir = process.env.DB_DIR
  ? path.resolve(process.env.DB_DIR)
  : ((ejecutandoEnRender || discoRenderDisponible) ? '/opt/render/data/backend' : dbDirLocalPorDefecto);
const uploadsDir = path.join(dbDir, 'uploads');
const uploadsTiendaDir = path.join(uploadsDir, 'tienda');
const uploadsDirLegacy = path.join(__dirname, 'uploads');
const uploadsTiendaDirLegacy = path.join(uploadsDirLegacy, 'tienda');
const backupDir = path.join(dbDir, 'backups');
const DB_FILES = ['inventario.db', 'recetas.db', 'produccion.db', 'ventas.db', 'admin.db'];

async function migrarDbLegacyDesdeRaizLocal() {
  if (path.resolve(dbDir) === path.resolve(__dirname)) return;

  for (const nombreDb of DB_FILES) {
    const origenPrincipal = path.join(__dirname, nombreDb);
    const destinoPrincipal = path.join(dbDir, nombreDb);

    try {
      const existeDestino = await fs.stat(destinoPrincipal).then(() => true).catch(() => false);
      if (!existeDestino) {
        const existeOrigen = await fs.stat(origenPrincipal).then((s) => s.size > 0).catch(() => false);
        if (existeOrigen) {
          await fs.copyFile(origenPrincipal, destinoPrincipal);
          console.warn(`[DB] Migrada base legacy a carpeta data: ${nombreDb}`);
        }
      }
    } catch (error) {
      console.error(`[DB] No se pudo migrar ${nombreDb} desde raíz local:`, error?.message || error);
    }

    for (const sufijo of ['-wal', '-shm']) {
      const origenTemp = path.join(__dirname, `${nombreDb}${sufijo}`);
      const destinoTemp = path.join(dbDir, `${nombreDb}${sufijo}`);
      try {
        const existeTempOrigen = await fs.stat(origenTemp).then(() => true).catch(() => false);
        const existeTempDestino = await fs.stat(destinoTemp).then(() => true).catch(() => false);
        if (existeTempOrigen && !existeTempDestino) {
          await fs.copyFile(origenTemp, destinoTemp);
        }
      } catch {
        // Ignorar: son temporales y SQLite los regenera cuando aplica.
      }
    }
  }
}

async function migrarUploadsLegacyDesdeRaizLocal() {
  if (path.resolve(uploadsTiendaDir) === path.resolve(uploadsTiendaDirLegacy)) return;

  try {
    const nombres = await fs.readdir(uploadsTiendaDirLegacy);
    for (const nombre of nombres) {
      const limpio = path.basename(String(nombre || '').trim());
      if (!limpio) continue;
      const origen = path.join(uploadsTiendaDirLegacy, limpio);
      const destino = path.join(uploadsTiendaDir, limpio);

      const esArchivoOrigen = await fs.stat(origen).then((s) => s.isFile()).catch(() => false);
      if (!esArchivoOrigen) continue;

      const existeDestino = await fs.stat(destino).then((s) => s.isFile()).catch(() => false);
      if (!existeDestino) {
        await fs.copyFile(origen, destino);
      }
    }
  } catch {
    // Si no existe carpeta legacy, no hay nada que migrar.
  }
}

async function buscarBackupMasReciente(nombreDb) {
  try {
    const archivos = await fs.readdir(backupDir);
    const candidatos = (archivos || [])
      .filter((f) => f.startsWith(`${nombreDb}.`) && f.endsWith('.backup'))
      .sort()
      .reverse();
    return candidatos.length ? path.join(backupDir, candidatos[0]) : null;
  } catch {
    return null;
  }
}

async function restaurarDbSiFalta(nombreDb) {
  const destino = path.join(dbDir, nombreDb);
  try {
    const stat = await fs.stat(destino);
    if (stat.size > 0) return false;
  } catch {
    // No existe o no es legible: intentar restaurar desde backup.
  }

  const backupReciente = await buscarBackupMasReciente(nombreDb);
  if (!backupReciente) return false;

  await fs.copyFile(backupReciente, destino);
  return true;
}

async function reforzarPersistenciaDb() {
  const enProduccion = esProduccion || enRender || ejecutandoEnRender;
  const rutaPersistenteRender = path.resolve('/opt/render/data');
  const rutaDbActual = path.resolve(dbDir);
  const usandoRutaPersistenteRender = rutaDbActual.startsWith(rutaPersistenteRender);

  if (enProduccion && ejecutandoEnRender && !usandoRutaPersistenteRender && process.env.ALLOW_EPHEMERAL_DB !== '1') {
    throw new Error(
      `[DB] Configuración insegura: DB_DIR=${rutaDbActual}. En Render debe usar /opt/render/data. `
      + 'Define DB_DIR persistente o ALLOW_EPHEMERAL_DB=1 bajo tu propio riesgo.'
    );
  }

  await fs.mkdir(dbDir, { recursive: true });
  await fs.mkdir(backupDir, { recursive: true });

  // Verifica que realmente se puede escribir en disco antes de abrir SQLite.
  const marcaPrueba = path.join(dbDir, '.db-write-test');
  await fs.writeFile(marcaPrueba, `${Date.now()}`, 'utf8');
  await fs.unlink(marcaPrueba);

  const restauradas = [];
  for (const nombreDb of DB_FILES) {
    try {
      const restaurada = await restaurarDbSiFalta(nombreDb);
      if (restaurada) restauradas.push(nombreDb);
    } catch (error) {
      console.error(`[DB] Error restaurando ${nombreDb}:`, error?.message || error);
    }
  }

  if (restauradas.length) {
    console.warn('[DB] Bases restauradas automáticamente desde backup:', restauradas.join(', '));
  }
}

console.log('[DB] NODE_ENV=', process.env.NODE_ENV || '(vacío)');
console.log('[DB] Render detectado=', ejecutandoEnRender ? 'sí' : 'no');
console.log('[DB] Disco Render detectado=', discoRenderDisponible ? 'sí' : 'no');
console.log('[DB] DB_DIR efectivo=', dbDir);

configurarBackup({
  dbDir,
  backupDir,
  maxBackups: 5,
});

// Endurecer almacenamiento y recuperar DBs faltantes desde backups locales.
await reforzarPersistenciaDb();
await migrarDbLegacyDesdeRaizLocal();
await fs.mkdir(uploadsTiendaDir, { recursive: true });
await migrarUploadsLegacyDesdeRaizLocal();

app.use('/uploads', express.static(uploadsDir));
app.use('/uploads', express.static(uploadsDirLegacy));

// Inicializar bases de datos
const bdInventario = new Database(path.join(dbDir, "inventario.db"));
const bdRecetas = new Database(path.join(dbDir, "recetas.db"));
const bdProduccion = new Database(path.join(dbDir, "produccion.db"));
const bdVentas = new Database(path.join(dbDir, "ventas.db"));
const bdAdmin = new Database(path.join(dbDir, "admin.db"));

// Log DB state for debugging
try {
  const recetasCount = bdRecetas.prepare('SELECT COUNT(*) AS total FROM recetas WHERE COALESCE(archivada,0)=0').get().total;
  console.log(`[DB] Recetas activas en bdRecetas: ${recetasCount}`);
  if (recetasCount === 0) {
    console.warn('[DB] Recetas DB está vacía, intentando restaurar desde backup...');
    const backupReciente = path.join(backupDir, 'recetas.db.' + (await fs.readdir(backupDir)).filter(f => f.startsWith('recetas.db.') && f.endsWith('.backup')).sort().reverse()[0]);
    if (backupReciente) {
      await fs.copyFile(backupReciente, path.join(dbDir, 'recetas.db'));
      console.log('[DB] Recetas restauradas desde backup:', backupReciente);
    } else {
      console.warn('[DB] No se encontró backup reciente para recetas.db');
    }
  }
} catch (err) {
  console.error('[DB] Error al verificar/restaurar recetas:', err);
}

async function crearConexionAdminAuth() {
  const usarPgAdminAuth = String(process.env.PG_ADMIN_AUTH || "0").trim() === "1";
  if (!usarPgAdminAuth) {
    return { db: bdAdmin, usandoPg: false };
  }

  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    console.warn("[DB] PG_ADMIN_AUTH=1, pero falta DATABASE_URL. Se usara SQLite para auth/admin.");
    return { db: bdAdmin, usandoPg: false };
  }

  const useSsl = String(process.env.PG_SSL || "1").trim() !== "0";
  const schemaDefault = `${String(process.env.PG_SCHEMA_PREFIX || "chipactli").trim().toLowerCase()}_admin`;
  const schema = String(process.env.PG_ADMIN_SCHEMA || schemaDefault).trim().toLowerCase();

  const clientePg = new Client({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : false
  });

  try {
    await clientePg.connect();
    await clientePg.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await clientePg.query(`SET search_path TO "${schema}", public`);
    await clientePg.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id BIGSERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        nombre TEXT,
        correo TEXT,
        rol TEXT DEFAULT 'usuario',
        permisos TEXT,
        debe_cambiar_password INTEGER DEFAULT 1,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await clientePg.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS correo TEXT`);
    await clientePg.query(`
      CREATE TABLE IF NOT EXISTS auditoria_admin (
        id BIGSERIAL PRIMARY KEY,
        accion TEXT NOT NULL,
        detalle TEXT,
        usuario TEXT,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log(`[DB] Auth/Admin usando PostgreSQL (schema: ${schema})`);
    return { db: clientePg, usandoPg: true };
  } catch (error) {
    console.warn("[DB] No se pudo activar PostgreSQL en auth/admin. Se usara SQLite:", error?.message || error);
    try {
      await clientePg.end();
    } catch {
      // Ignorar cierre fallido.
    }
    return { db: bdAdmin, usandoPg: false };
  }
}

async function crearConexionInventarioRutas() {
  const usarPgInventario = String(process.env.PG_INVENTARIO || "0").trim() === "1";
  if (!usarPgInventario) {
    return { db: bdInventario, usandoPg: false };
  }

  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    console.warn("[DB] PG_INVENTARIO=1, pero falta DATABASE_URL. Se usara SQLite para inventario.");
    return { db: bdInventario, usandoPg: false };
  }

  const useSsl = String(process.env.PG_SSL || "1").trim() !== "0";
  const schemaDefault = `${String(process.env.PG_SCHEMA_PREFIX || "chipactli").trim().toLowerCase()}_inventario`;
  const schema = String(process.env.PG_INVENTARIO_SCHEMA || schemaDefault).trim().toLowerCase();

  try {
    const { db } = await crearPgSqliteCompat({
      databaseUrl,
      schema,
      useSsl
    });

    console.log(`[DB] Inventario/Utensilios usando PostgreSQL (schema: ${schema})`);
    return { db, usandoPg: true };
  } catch (error) {
    console.warn("[DB] No se pudo activar PostgreSQL en inventario/utensilios. Se usara SQLite:", error?.message || error);
    return { db: bdInventario, usandoPg: false };
  }
}

async function crearConexionRecetasRutas() {
  const usarPgRecetas = String(process.env.PG_RECETAS || "0").trim() === "1";
  if (!usarPgRecetas) {
    return { db: bdRecetas, usandoPg: false };
  }

  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    console.warn("[DB] PG_RECETAS=1, pero falta DATABASE_URL. Se usara SQLite para recetas.");
    return { db: bdRecetas, usandoPg: false };
  }

  const useSsl = String(process.env.PG_SSL || "1").trim() !== "0";
  const schemaDefault = `${String(process.env.PG_SCHEMA_PREFIX || "chipactli").trim().toLowerCase()}_recetas`;
  const schema = String(process.env.PG_RECETAS_SCHEMA || schemaDefault).trim().toLowerCase();

  try {
    const { db } = await crearPgSqliteCompat({
      databaseUrl,
      schema,
      useSsl
    });

    console.log(`[DB] Recetas usando PostgreSQL (schema: ${schema})`);
    return { db, usandoPg: true };
  } catch (error) {
    console.warn("[DB] No se pudo activar PostgreSQL en recetas. Se usara SQLite:", error?.message || error);
    return { db: bdRecetas, usandoPg: false };
  }
}

async function crearConexionProduccionRutas() {
  const usarPgProduccion = String(process.env.PG_PRODUCCION || "0").trim() === "1";
  if (!usarPgProduccion) {
    return { db: bdProduccion, usandoPg: false };
  }

  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    console.warn("[DB] PG_PRODUCCION=1, pero falta DATABASE_URL. Se usara SQLite para produccion.");
    return { db: bdProduccion, usandoPg: false };
  }

  const useSsl = String(process.env.PG_SSL || "1").trim() !== "0";
  const schemaDefault = `${String(process.env.PG_SCHEMA_PREFIX || "chipactli").trim().toLowerCase()}_produccion`;
  const schema = String(process.env.PG_PRODUCCION_SCHEMA || schemaDefault).trim().toLowerCase();

  try {
    const { db } = await crearPgSqliteCompat({ databaseUrl, schema, useSsl });
    console.log(`[DB] Produccion usando PostgreSQL (schema: ${schema})`);
    return { db, usandoPg: true };
  } catch (error) {
    console.warn("[DB] No se pudo activar PostgreSQL en produccion. Se usara SQLite:", error?.message || error);
    return { db: bdProduccion, usandoPg: false };
  }
}

async function crearConexionVentasRutas() {
  const usarPgVentas = String(process.env.PG_VENTAS || "0").trim() === "1";
  if (!usarPgVentas) {
    return { db: bdVentas, usandoPg: false };
  }

  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    console.warn("[DB] PG_VENTAS=1, pero falta DATABASE_URL. Se usara SQLite para ventas/tienda.");
    return { db: bdVentas, usandoPg: false };
  }

  const useSsl = String(process.env.PG_SSL || "1").trim() !== "0";
  const schemaDefault = `${String(process.env.PG_SCHEMA_PREFIX || "chipactli").trim().toLowerCase()}_ventas`;
  const schema = String(process.env.PG_VENTAS_SCHEMA || schemaDefault).trim().toLowerCase();

  try {
    const { db } = await crearPgSqliteCompat({ databaseUrl, schema, useSsl });
    console.log(`[DB] Ventas/Tienda usando PostgreSQL (schema: ${schema})`);
    return { db, usandoPg: true };
  } catch (error) {
    console.warn("[DB] No se pudo activar PostgreSQL en ventas/tienda. Se usara SQLite:", error?.message || error);
    return { db: bdVentas, usandoPg: false };
  }
}

function aplicarPragmasDurabilidad(db, nombreDb) {
  return new Promise((resolve) => {
    db.exec(
      [
        'PRAGMA journal_mode = WAL',
        'PRAGMA synchronous = FULL',
        'PRAGMA foreign_keys = ON',
        'PRAGMA temp_store = MEMORY',
        'PRAGMA busy_timeout = 10000'
      ].join('; '),
      (err) => {
        if (err) {
          console.warn(`[DB] No se pudieron aplicar PRAGMA en ${nombreDb}:`, err?.message || err);
        }
        resolve();
      }
    );
  });
}

await Promise.all([
  aplicarPragmasDurabilidad(bdInventario, 'inventario'),
  aplicarPragmasDurabilidad(bdRecetas, 'recetas'),
  aplicarPragmasDurabilidad(bdProduccion, 'produccion'),
  aplicarPragmasDurabilidad(bdVentas, 'ventas'),
  aplicarPragmasDurabilidad(bdAdmin, 'admin')
]);

inicializarBds(bdInventario, bdRecetas, bdProduccion, bdVentas);
inicializarBdAdmin(bdAdmin, bdInventario);

const conexionAdminAuth = await crearConexionAdminAuth();
const conexionInventarioRutas = await crearConexionInventarioRutas();
const conexionRecetasRutas = await crearConexionRecetasRutas();
const conexionProduccionRutas = await crearConexionProduccionRutas();
const conexionVentasRutas = await crearConexionVentasRutas();

const { db: bdAdminAuth, usandoPg: usandoPgAdminAuth } = conexionAdminAuth;
const { db: bdInventarioRutas, usandoPg: usandoPgInventario } = conexionInventarioRutas;
const { db: bdRecetasRutas, usandoPg: usandoPgRecetas } = conexionRecetasRutas;
const { db: bdProduccionRutas, usandoPg: usandoPgProduccion } = conexionProduccionRutas;
const { db: bdVentasRutas, usandoPg: usandoPgVentas } = conexionVentasRutas;

// Registrar rutas de autenticación
registrarRutasAuth(app, bdAdminAuth);

const VISITAS_TIMEOUT_MS = Math.max(30_000, Number(process.env.VISITAS_TIMEOUT_MS) || 2 * 60 * 1000);
const visitantesActivos = new Map();
const estadisticasVisitasPorDia = new Map();
const DIAS_RETENCION_VISITAS = Math.max(3, Number(process.env.VISITAS_DIAS_RETENCION) || 30);
const DIAS_HISTORICO_VISITAS_MAX = Math.max(7, Number(process.env.VISITAS_HISTORICO_MAX_DIAS) || 120);

const visitasDbReady = (async () => {
  try {
    await dbRunAsync(
      bdVentas,
      `CREATE TABLE IF NOT EXISTS tienda_visitas_diarias (
        dia_clave TEXT PRIMARY KEY,
        total_eventos INTEGER DEFAULT 0,
        sesiones_unicas INTEGER DEFAULT 0,
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
        actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    );

    await dbRunAsync(
      bdVentas,
      `CREATE TABLE IF NOT EXISTS tienda_visitas_diarias_horas (
        dia_clave TEXT,
        hora TEXT,
        total INTEGER DEFAULT 0,
        PRIMARY KEY (dia_clave, hora)
      )`
    );

    await dbRunAsync(
      bdVentas,
      `CREATE TABLE IF NOT EXISTS tienda_visitas_diarias_paises (
        dia_clave TEXT,
        pais TEXT,
        total INTEGER DEFAULT 0,
        PRIMARY KEY (dia_clave, pais)
      )`
    );

    await dbRunAsync(
      bdVentas,
      `CREATE TABLE IF NOT EXISTS tienda_visitas_sesiones_diarias (
        dia_clave TEXT,
        session_id TEXT,
        pais TEXT,
        primera_actividad_en TEXT DEFAULT CURRENT_TIMESTAMP,
        ultima_actividad_en TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (dia_clave, session_id)
      )`
    );

    await dbRunAsync(
      bdVentas,
      `CREATE TABLE IF NOT EXISTS tienda_visitas_eventos (
        id INTEGER PRIMARY KEY,
        dia_clave TEXT,
        session_id TEXT,
        accion TEXT,
        producto TEXT,
        seccion TEXT,
        ruta TEXT,
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    );

    await dbRunAsync(
      bdVentas,
      `CREATE INDEX IF NOT EXISTS idx_tienda_visitas_diarias_actualizado
       ON tienda_visitas_diarias (dia_clave DESC)`
    );
    await dbRunAsync(
      bdVentas,
      `CREATE INDEX IF NOT EXISTS idx_tienda_visitas_diarias_horas
       ON tienda_visitas_diarias_horas (dia_clave, hora)`
    );
    await dbRunAsync(
      bdVentas,
      `CREATE INDEX IF NOT EXISTS idx_tienda_visitas_diarias_paises
       ON tienda_visitas_diarias_paises (dia_clave, total DESC)`
    );
    await dbRunAsync(
      bdVentas,
      `CREATE INDEX IF NOT EXISTS idx_tienda_visitas_eventos_dia
       ON tienda_visitas_eventos (dia_clave, accion)`
    );
  } catch (error) {
    console.warn('[VISITAS] No se pudo inicializar persistencia:', error?.message || error);
  }
})();

function limpiarVisitantesInactivos(ahora = Date.now()) {
  for (const [clave, visita] of visitantesActivos.entries()) {
    if (!visita || (ahora - Number(visita.ultimaActividad || 0)) > VISITAS_TIMEOUT_MS) {
      visitantesActivos.delete(clave);
    }
  }
}

function limpiarTextoCorto(valor, max = 64) {
  const limpio = String(valor || '').trim().slice(0, max);
  return limpio.replace(/[\r\n\t]/g, ' ');
}

function obtenerIpsCliente(req) {
  const lista = [];
  const xff = String(req.headers['x-forwarded-for'] || '').trim();
  if (xff) {
    xff.split(',').forEach((ip) => {
      const limpia = normalizarIpEntrada(ip);
      if (limpia) lista.push(limpia);
    });
  }

  const candidatas = [
    req.headers['cf-connecting-ip'],
    req.headers['x-real-ip'],
    req.socket?.remoteAddress
  ];
  candidatas.forEach((ip) => {
    const limpia = normalizarIpEntrada(ip);
    if (limpia) lista.push(limpia);
  });

  return Array.from(new Set(lista));
}

function obtenerIpCliente(req) {
  const ips = obtenerIpsCliente(req);
  return ips[0] || '';
}

const geoIpCache = new Map();
const GEOIP_CACHE_TTL_MS = Math.max(10 * 60 * 1000, Number(process.env.GEOIP_CACHE_TTL_MS) || (12 * 60 * 60 * 1000));

function normalizarIpEntrada(ip = '') {
  const valor = String(ip || '').trim();
  if (!valor) return '';
  if (valor === '::1' || valor === 'localhost') return '';

  let salida = valor;
  if (salida.startsWith('::ffff:')) salida = salida.slice(7);
  if (salida.startsWith('[') && salida.includes(']')) {
    salida = salida.slice(1, salida.indexOf(']'));
  }
  const esIpv4ConPuerto = /^\d+\.\d+\.\d+\.\d+:\d+$/.test(salida);
  if (esIpv4ConPuerto) {
    salida = salida.split(':')[0];
  }
  return salida;
}

function esIpPrivadaOInvalida(ip = '') {
  const limpia = normalizarIpEntrada(ip);
  if (!limpia) return true;
  if (limpia.includes(':')) {
    const prefijo = limpia.toLowerCase();
    return prefijo.startsWith('fe80:') || prefijo.startsWith('fc') || prefijo.startsWith('fd');
  }
  const partes = limpia.split('.').map((x) => Number(x));
  if (partes.length !== 4 || partes.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  if (partes[0] === 10) return true;
  if (partes[0] === 127) return true;
  if (partes[0] === 192 && partes[1] === 168) return true;
  if (partes[0] === 172 && partes[1] >= 16 && partes[1] <= 31) return true;
  if (partes[0] === 169 && partes[1] === 254) return true;
  return false;
}

async function consultarGeoIpPublico(ip) {
  const ipLimpia = normalizarIpEntrada(ip);
  if (!ipLimpia || esIpPrivadaOInvalida(ipLimpia)) return null;

  const cacheKey = ipLimpia;
  const cacheItem = geoIpCache.get(cacheKey);
  if (cacheItem && (Date.now() - cacheItem.ts) < GEOIP_CACHE_TTL_MS) {
    return cacheItem.valor;
  }

  async function consultarProveedor(url, transformar) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2200);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) return null;
      const data = await resp.json();
      return transformar(data);
    } catch {
      return null;
    } finally {
      clearTimeout(id);
    }
  }

  try {
    const valorIpWho = await consultarProveedor(
      `https://ipwho.is/${encodeURIComponent(ipLimpia)}?fields=success,country,country_code,region,city`,
      (data) => {
        if (!data?.success) return null;
        return {
          pais: limpiarTextoCorto(data?.country || '', 48),
          paisCodigo: limpiarTextoCorto(data?.country_code || '', 8).toUpperCase(),
          region: limpiarTextoCorto(data?.region || '', 64),
          ciudad: limpiarTextoCorto(data?.city || '', 64)
        };
      }
    );

    const valorIpApi = await consultarProveedor(
      `https://ipapi.co/${encodeURIComponent(ipLimpia)}/json/`,
      (data) => {
        if (!data || data?.error) return null;
        return {
          pais: limpiarTextoCorto(data?.country_name || '', 48),
          paisCodigo: limpiarTextoCorto(data?.country || '', 8).toUpperCase(),
          region: limpiarTextoCorto(data?.region || data?.region_code || '', 64),
          ciudad: limpiarTextoCorto(data?.city || '', 64)
        };
      }
    );

    const valor = {
      pais: valorIpWho?.pais || valorIpApi?.pais || '',
      paisCodigo: valorIpWho?.paisCodigo || valorIpApi?.paisCodigo || '',
      region: valorIpWho?.region || valorIpApi?.region || '',
      ciudad: valorIpWho?.ciudad || valorIpApi?.ciudad || ''
    };
    if (!valor.pais && !valor.region && !valor.ciudad) return null;

    geoIpCache.set(cacheKey, { ts: Date.now(), valor });
    return valor;
  } catch {
    return null;
  }
}

const CODIGOS_ESTADOS_MX = {
  AGU: 'Aguascalientes', BCN: 'Baja California', BCS: 'Baja California Sur', CAM: 'Campeche',
  CHP: 'Chiapas', CHH: 'Chihuahua', COA: 'Coahuila', COL: 'Colima', CMX: 'CDMX', DUR: 'Durango',
  GUA: 'Guanajuato', GRO: 'Guerrero', HID: 'Hidalgo', JAL: 'Jalisco', MEX: 'Estado de Mexico',
  MIC: 'Michoacan', MOR: 'Morelos', NAY: 'Nayarit', NLE: 'Nuevo Leon', OAX: 'Oaxaca',
  PUE: 'Puebla', QUE: 'Queretaro', ROO: 'Quintana Roo', SLP: 'San Luis Potosi',
  SIN: 'Sinaloa', SON: 'Sonora', TAB: 'Tabasco', TAM: 'Tamaulipas', TLA: 'Tlaxcala',
  VER: 'Veracruz', YUC: 'Yucatan', ZAC: 'Zacatecas'
};

function normalizarPais(valor = '') {
  const limpio = limpiarTextoCorto(valor, 48);
  if (!limpio) return { codigo: '', nombre: 'Desconocido' };
  const mayus = limpio.toUpperCase();
  const mapa = {
    MX: 'Mexico', MEX: 'Mexico',
    US: 'Estados Unidos', USA: 'Estados Unidos',
    CA: 'Canada',
    ES: 'Espana',
    AR: 'Argentina',
    CO: 'Colombia',
    CL: 'Chile',
    PE: 'Peru'
  };
  if (mapa[mayus]) {
    return { codigo: mayus.slice(0, 3), nombre: mapa[mayus] };
  }
  return { codigo: mayus.length <= 3 ? mayus : '', nombre: limpio };
}

function normalizarRegion(region = '', paisCodigo = '') {
  const limpia = limpiarTextoCorto(region, 64);
  if (!limpia) return '';
  const clavePais = String(paisCodigo || '').toUpperCase();
  const regionMayus = limpia.toUpperCase();
  if (['MX', 'MEX'].includes(clavePais) && CODIGOS_ESTADOS_MX[regionMayus]) {
    return CODIGOS_ESTADOS_MX[regionMayus];
  }
  return limpia;
}

function construirEtiquetaUbicacion({ ciudad = '', region = '', pais = '' } = {}) {
  const ciudadLimpia = limpiarTextoCorto(ciudad, 64);
  const regionLimpia = limpiarTextoCorto(region, 64);
  const paisLimpio = limpiarTextoCorto(pais, 48) || 'Desconocido';

  const partes = [];
  if (ciudadLimpia) partes.push(ciudadLimpia);
  if (regionLimpia && (!ciudadLimpia || regionLimpia.toLowerCase() !== ciudadLimpia.toLowerCase())) {
    partes.push(regionLimpia);
  }
  if (paisLimpio && (!regionLimpia || paisLimpio.toLowerCase() !== regionLimpia.toLowerCase())) {
    partes.push(paisLimpio);
  }
  return partes.length ? partes.join(', ') : 'Desconocido';
}

function normalizarEtiquetaUbicacion(valor = '') {
  const texto = limpiarTextoCorto(valor, 96);
  if (!texto) return 'Desconocido';

  const partes = texto
    .split(',')
    .map((item) => limpiarTextoCorto(item, 64))
    .filter(Boolean);

  if (!partes.length) return 'Desconocido';

  const ultima = String(partes[partes.length - 1] || '').trim();
  const pais = normalizarPais(ultima);
  if (pais.nombre !== 'Desconocido') {
    partes[partes.length - 1] = pais.nombre;
  }
  return partes.join(', ');
}

function obtenerOrigenAproximado(req, body) {
  const paisHeader = limpiarTextoCorto(
    req.headers['cf-ipcountry']
    || req.headers['x-vercel-ip-country']
    || req.headers['x-country-code']
    || ''
  );
  const ciudadHeader = limpiarTextoCorto(
    req.headers['x-vercel-ip-city']
    || req.headers['cf-ipcity']
    || req.headers['x-city']
    || ''
  );
  const regionHeader = limpiarTextoCorto(
    req.headers['x-vercel-ip-country-region']
    || req.headers['cf-region-code']
    || req.headers['cf-region']
    || req.headers['x-region-code']
    || req.headers['x-region']
    || ''
  );
  const paisBody = limpiarTextoCorto(body?.pais || '', 48);
  const ciudadBody = limpiarTextoCorto(body?.ciudad || '', 64);
  const regionBody = limpiarTextoCorto(body?.region || '', 64);
  const paisNormalizado = normalizarPais(paisHeader || paisBody || '');
  const regionNormalizada = normalizarRegion(regionHeader || regionBody || '', paisNormalizado.codigo);
  const ciudad = ciudadHeader || ciudadBody || '';
  const ubicacion = construirEtiquetaUbicacion({
    ciudad,
    region: regionNormalizada,
    pais: paisNormalizado.nombre
  });

  return {
    pais: paisNormalizado.nombre,
    paisCodigo: paisNormalizado.codigo,
    ciudad,
    region: regionNormalizada,
    ubicacion,
    zonaHoraria: limpiarTextoCorto(body?.zonaHoraria || '', 64),
    idioma: limpiarTextoCorto(body?.idioma || '', 32)
  };
}

async function enriquecerOrigenPorIp(req, origenBase) {
  const origen = (origenBase && typeof origenBase === 'object') ? { ...origenBase } : {};
  if (origen.ciudad && origen.region) return origen;

  const ips = obtenerIpsCliente(req).slice(0, 4);
  let geo = null;
  let mejorPuntaje = -1;

  for (const ip of ips) {
    const candidato = await consultarGeoIpPublico(ip);
    if (!candidato) continue;
    const puntaje =
      (candidato.ciudad ? 3 : 0)
      + (candidato.region ? 2 : 0)
      + (candidato.pais ? 1 : 0);
    if (puntaje > mejorPuntaje) {
      geo = candidato;
      mejorPuntaje = puntaje;
      if (puntaje >= 6) break;
    }
  }

  if (!geo) return origen;

  const paisNormalizado = normalizarPais(origen.pais || geo.pais || geo.paisCodigo || '');
  const regionNormalizada = normalizarRegion(origen.region || geo.region || '', paisNormalizado.codigo || geo.paisCodigo || '');
  const ciudad = limpiarTextoCorto(origen.ciudad || geo.ciudad || '', 64);

  return {
    ...origen,
    pais: paisNormalizado.nombre,
    paisCodigo: paisNormalizado.codigo || limpiarTextoCorto(geo.paisCodigo || '', 8).toUpperCase(),
    region: regionNormalizada,
    ciudad,
    ubicacion: construirEtiquetaUbicacion({ ciudad, region: regionNormalizada, pais: paisNormalizado.nombre })
  };
}

function esUserAgentBot(req) {
  const ua = String(req.headers['user-agent'] || '').toLowerCase();
  if (!ua) return false;
  return /(bot|spider|crawler|lighthouse|headless|preview|facebookexternalhit|whatsapp|telegrambot|slackbot|discordbot)/i.test(ua);
}

function claveDiaLocal(fecha = new Date()) {
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function obtenerDiaHoraPorZona(fecha = new Date(), zonaHoraria = '') {
  const tz = String(zonaHoraria || '').trim();
  if (!tz) {
    return {
      diaClave: claveDiaLocal(fecha),
      horaClave: String(fecha.getHours()).padStart(2, '0')
    };
  }

  try {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false
    }).formatToParts(fecha);

    const extraer = (tipo) => String(partes.find((p) => p.type === tipo)?.value || '').trim();
    const yyyy = extraer('year');
    const mm = extraer('month');
    const dd = extraer('day');
    const hh = extraer('hour');
    if (!yyyy || !mm || !dd || !hh) {
      throw new Error('Formato de zona horaria incompleto');
    }

    return {
      diaClave: `${yyyy}-${mm}-${dd}`,
      horaClave: String(hh).padStart(2, '0').slice(0, 2)
    };
  } catch {
    return {
      diaClave: claveDiaLocal(fecha),
      horaClave: String(fecha.getHours()).padStart(2, '0')
    };
  }
}

function obtenerStatsDia(diaClave) {
  const actual = estadisticasVisitasPorDia.get(diaClave);
  if (actual) return actual;

  const nuevo = {
    diaClave,
    totalEventos: 0,
    sesionesUnicas: new Set(),
    porHora: new Map(),
    porUbicacion: new Map()
  };
  estadisticasVisitasPorDia.set(diaClave, nuevo);
  return nuevo;
}

function limpiarEstadisticasAntiguas(fechaRef = new Date()) {
  const limite = new Date(fechaRef);
  limite.setDate(limite.getDate() - DIAS_RETENCION_VISITAS);
  const claveLimite = claveDiaLocal(limite);
  for (const clave of estadisticasVisitasPorDia.keys()) {
    if (String(clave) < claveLimite) {
      estadisticasVisitasPorDia.delete(clave);
    }
  }
}

function contarActivosReales() {
  let total = 0;
  for (const visita of visitantesActivos.values()) {
    if (visita?.esBot) continue;
    total += 1;
  }
  return total;
}

function construirHorasDia(statsDia) {
  const salida = [];
  for (let h = 0; h < 24; h += 1) {
    const hora = String(h).padStart(2, '0');
    salida.push({ hora: `${hora}:00`, total: Number(statsDia?.porHora?.get?.(hora) || 0) });
  }
  return salida;
}

function obtenerHoraPico(statsDia) {
  const horas = construirHorasDia(statsDia);
  return horas.reduce((max, cur) => (cur.total > max.total ? cur : max), { hora: '00:00', total: 0 });
}

function resumenUbicacionesActivas() {
  const conteo = new Map();
  for (const visita of visitantesActivos.values()) {
    if (visita?.esBot) continue;
    const clave = normalizarEtiquetaUbicacion(visita?.ubicacion || visita?.pais || 'Desconocido');
    conteo.set(clave, (conteo.get(clave) || 0) + 1);
  }
  return Array.from(conteo.entries())
    .map(([ubicacion, total]) => ({ ubicacion, pais: ubicacion, total }))
    .sort((a, b) => {
      const specA = String(a?.ubicacion || '').includes(',') ? 1 : 0;
      const specB = String(b?.ubicacion || '').includes(',') ? 1 : 0;
      if (specA !== specB) return specB - specA;
      return (Number(b?.total) || 0) - (Number(a?.total) || 0);
    })
    .slice(0, 10);
}

function resumenUbicacionesDia(statsDia) {
  const pares = Array.from(statsDia?.porUbicacion?.entries?.() || []);
  return pares
    .map(([ubicacion, total]) => ({ ubicacion, pais: ubicacion, total: Number(total) || 0 }))
    .sort((a, b) => {
      const specA = String(a?.ubicacion || '').includes(',') ? 1 : 0;
      const specB = String(b?.ubicacion || '').includes(',') ? 1 : 0;
      if (specA !== specB) return specB - specA;
      return (Number(b?.total) || 0) - (Number(a?.total) || 0);
    })
    .slice(0, 10);
}

async function registrarVisitaPersistente({ diaClave, horaClave, ubicacion, sessionId, ahoraIso }) {
  await visitasDbReady;
  const ubicacionSegura = normalizarEtiquetaUbicacion(ubicacion || 'Desconocido');

  await dbRunAsync(
    bdVentas,
    `INSERT INTO tienda_visitas_diarias (dia_clave, total_eventos, sesiones_unicas, actualizado_en)
     VALUES (?, 1, 0, ?)
     ON CONFLICT(dia_clave) DO UPDATE SET
       total_eventos = total_eventos + 1,
       actualizado_en = excluded.actualizado_en`,
    [diaClave, ahoraIso]
  );

  await dbRunAsync(
    bdVentas,
    `INSERT INTO tienda_visitas_diarias_horas (dia_clave, hora, total)
     VALUES (?, ?, 1)
     ON CONFLICT(dia_clave, hora) DO UPDATE SET total = total + 1`,
    [diaClave, horaClave]
  );

  await dbRunAsync(
    bdVentas,
    `INSERT INTO tienda_visitas_diarias_paises (dia_clave, pais, total)
     VALUES (?, ?, 1)
     ON CONFLICT(dia_clave, pais) DO UPDATE SET total = total + 1`,
    [diaClave, ubicacionSegura]
  );

  if (!sessionId) return;

  const sessionInsert = await dbRunAsync(
    bdVentas,
    `INSERT OR IGNORE INTO tienda_visitas_sesiones_diarias
      (dia_clave, session_id, pais, primera_actividad_en, ultima_actividad_en)
     VALUES (?, ?, ?, ?, ?)`,
    [diaClave, sessionId, ubicacionSegura, ahoraIso, ahoraIso]
  );

  await dbRunAsync(
    bdVentas,
    `UPDATE tienda_visitas_sesiones_diarias
     SET pais = ?, ultima_actividad_en = ?
     WHERE dia_clave = ? AND session_id = ?`,
    [ubicacionSegura, ahoraIso, diaClave, sessionId]
  );

  if (sessionInsert.changes > 0) {
    await dbRunAsync(
      bdVentas,
      `UPDATE tienda_visitas_diarias
       SET sesiones_unicas = sesiones_unicas + 1,
           actualizado_en = ?
       WHERE dia_clave = ?`,
      [ahoraIso, diaClave]
    );
  }
}

function construirHorasDesdeFilas(filas = []) {
  const mapa = new Map();
  (filas || []).forEach((item) => {
    const horaRaw = String(item?.hora || '').trim();
    const horaClave = horaRaw.includes(':') ? horaRaw.slice(0, 2) : horaRaw.padStart(2, '0').slice(0, 2);
    mapa.set(horaClave, Number(item?.total) || 0);
  });
  const salida = [];
  for (let h = 0; h < 24; h += 1) {
    const horaClave = String(h).padStart(2, '0');
    salida.push({ hora: `${horaClave}:00`, total: Number(mapa.get(horaClave) || 0) });
  }
  return salida;
}

function obtenerHoraPicoDesdeHoras(horas = []) {
  return (horas || []).reduce((max, cur) => (Number(cur?.total) > Number(max?.total) ? cur : max), { hora: '00:00', total: 0 });
}

async function obtenerResumenPersistenteDia(diaClave) {
  await visitasDbReady;
  const diario = await dbGetAsync(
    bdVentas,
    `SELECT dia_clave, total_eventos, sesiones_unicas, actualizado_en
     FROM tienda_visitas_diarias
     WHERE dia_clave = ?`,
    [diaClave]
  );
  const filasHoras = await dbAllAsync(
    bdVentas,
    `SELECT hora, total
     FROM tienda_visitas_diarias_horas
     WHERE dia_clave = ?`,
    [diaClave]
  );
  const ubicacionesTop = await dbAllAsync(
    bdVentas,
    `SELECT pais, total
     FROM tienda_visitas_diarias_paises
     WHERE dia_clave = ?
     ORDER BY CASE WHEN INSTR(pais, ',') > 0 THEN 1 ELSE 0 END DESC,
              total DESC
     LIMIT 10`,
    [diaClave]
  );
  const porHora = construirHorasDesdeFilas(filasHoras);

  return {
    fecha: diaClave,
    visitasDia: Number(diario?.sesiones_unicas) || 0,
    eventosDia: Number(diario?.total_eventos) || 0,
    horaPico: obtenerHoraPicoDesdeHoras(porHora),
    ubicacionesTop: (ubicacionesTop || []).map((item) => ({
      ubicacion: normalizarEtiquetaUbicacion(item?.pais || 'Desconocido'),
      pais: normalizarEtiquetaUbicacion(item?.pais || 'Desconocido'),
      total: Number(item?.total) || 0
    })),
    porHora,
    actualizadoEn: String(diario?.actualizado_en || '').trim()
  };
}

function restarDiasClave(clave, dias) {
  const fecha = new Date(`${String(clave || '').trim()}T00:00:00`);
  if (!Number.isFinite(fecha.getTime())) {
    return claveDiaLocal(new Date());
  }
  fecha.setDate(fecha.getDate() - Math.max(0, Number(dias) || 0));
  return claveDiaLocal(fecha);
}

function sumarDiasClave(clave, dias) {
  const fecha = new Date(`${String(clave || '').trim()}T00:00:00`);
  if (!Number.isFinite(fecha.getTime())) {
    return claveDiaLocal(new Date());
  }
  fecha.setDate(fecha.getDate() + (Number(dias) || 0));
  return claveDiaLocal(fecha);
}

function esClaveFechaValida(clave) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(clave || '').trim());
}

app.post(['/api/visitas/ping', '/visitas/ping'], async (req, res) => {
  const ahora = Date.now();
  const ahoraDate = new Date(ahora);
  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const tiempoLocalVisita = obtenerDiaHoraPorZona(ahoraDate, body?.zonaHoraria || '');
  const diaClave = tiempoLocalVisita.diaClave;
  const horaClave = tiempoLocalVisita.horaClave;
  const sessionId = limpiarTextoCorto(body.sessionId || '', 80);
  let origen = obtenerOrigenAproximado(req, body);
  try {
    origen = await enriquecerOrigenPorIp(req, origen);
  } catch {
    // Si el proveedor GeoIP no responde, mantener origen por headers/body.
  }
  const esBot = esUserAgentBot(req);
  const statsDia = obtenerStatsDia(diaClave);

  statsDia.totalEventos += 1;
  statsDia.porHora.set(horaClave, (statsDia.porHora.get(horaClave) || 0) + 1);
  statsDia.porUbicacion.set(origen.ubicacion, (statsDia.porUbicacion.get(origen.ubicacion) || 0) + 1);

  if (sessionId) {
    statsDia.sesionesUnicas.add(sessionId);
    visitantesActivos.set(sessionId, {
      sessionId,
      ip: obtenerIpCliente(req),
      ultimaActividad: ahora,
      ruta: limpiarTextoCorto(body.ruta || '', 120),
      visible: body?.visible === false ? false : true,
      esBot,
      ...origen
    });
  }

  limpiarVisitantesInactivos(ahora);
  limpiarEstadisticasAntiguas(ahoraDate);

  registrarVisitaPersistente({
    diaClave,
    horaClave,
    ubicacion: origen.ubicacion,
    sessionId,
    ahoraIso: new Date(ahora).toISOString()
  }).catch(() => {
    // La respuesta al usuario no debe bloquearse por telemetría.
  });

  const totalActivos = contarActivosReales();
  const horaPico = obtenerHoraPico(statsDia);

  return res.json({
    ok: true,
    totalActivos,
    visitasDia: statsDia.sesionesUnicas.size,
    eventosDia: statsDia.totalEventos,
    horaPico,
    ubicaciones: resumenUbicacionesActivas(),
    actualizadoEn: new Date(ahora).toISOString(),
    timeoutSegundos: Math.round(VISITAS_TIMEOUT_MS / 1000)
  });
});

app.post(['/api/visitas/evento', '/visitas/evento'], async (req, res) => {
  const ahora = Date.now();
  const ahoraDate = new Date(ahora);
  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const tiempoLocalEvento = obtenerDiaHoraPorZona(ahoraDate, body?.zonaHoraria || '');
  const diaClave = tiempoLocalEvento.diaClave;
  const sessionId = limpiarTextoCorto(body.sessionId || '', 80);
  const accion = limpiarTextoCorto(body.accion || '', 64);
  const producto = limpiarTextoCorto(body.producto || '', 140);
  const seccion = limpiarTextoCorto(body.seccion || '', 64);
  const ruta = limpiarTextoCorto(body.ruta || '', 120);

  if (!accion || esUserAgentBot(req)) {
    return res.json({ ok: true, ignorado: true });
  }

  try {
    await visitasDbReady;
    await dbRunAsync(
      bdVentas,
      `INSERT INTO tienda_visitas_eventos (dia_clave, session_id, accion, producto, seccion, ruta, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        diaClave,
        sessionId || null,
        accion,
        producto || null,
        seccion || null,
        ruta || null,
        ahoraDate.toISOString()
      ]
    );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, error: 'No se pudo registrar evento' });
  }
});

app.get(['/api/visitas/estado', '/visitas/estado'], (req, res) => {
  const ahora = Date.now();
  const hoyClave = claveDiaLocal(new Date(ahora));
  const statsDia = obtenerStatsDia(hoyClave);
  limpiarVisitantesInactivos(ahora);

  return res.json({
    ok: true,
    totalActivos: contarActivosReales(),
    visitasDia: statsDia.sesionesUnicas.size,
    eventosDia: statsDia.totalEventos,
    horaPico: obtenerHoraPico(statsDia),
    ubicaciones: resumenUbicacionesActivas(),
    actualizadoEn: new Date(ahora).toISOString(),
    timeoutSegundos: Math.round(VISITAS_TIMEOUT_MS / 1000)
  });
});

app.get(['/api/visitas/resumen', '/visitas/resumen'], async (req, res) => {
  const ahora = Date.now();
  const ahoraDate = new Date(ahora);
  const hoyClave = claveDiaLocal(ahoraDate);
  const fechaSolicitada = String(req.query?.fecha || '').trim();
  const fechaObjetivo = esClaveFechaValida(fechaSolicitada) ? fechaSolicitada : hoyClave;
  const esDiaActual = fechaObjetivo === hoyClave;
  limpiarVisitantesInactivos(ahora);
  limpiarEstadisticasAntiguas(ahoraDate);

  try {
    const resumenPersistente = await obtenerResumenPersistenteDia(fechaObjetivo);
    return res.json({
      ok: true,
      fecha: fechaObjetivo,
      activosAhora: esDiaActual ? contarActivosReales() : 0,
      visitasDia: Number(resumenPersistente?.visitasDia) || 0,
      eventosDia: Number(resumenPersistente?.eventosDia) || 0,
      horaPico: resumenPersistente?.horaPico || { hora: '00:00', total: 0 },
      ubicacionesTop: Array.isArray(resumenPersistente?.ubicacionesTop) ? resumenPersistente.ubicacionesTop : [],
      porHora: Array.isArray(resumenPersistente?.porHora) ? resumenPersistente.porHora : [],
      actualizadoEn: resumenPersistente?.actualizadoEn || ahoraDate.toISOString(),
      timeoutSegundos: Math.round(VISITAS_TIMEOUT_MS / 1000)
    });
  } catch {
    const statsDia = obtenerStatsDia(fechaObjetivo);
    const porHora = construirHorasDia(statsDia);
    return res.json({
      ok: true,
      fecha: fechaObjetivo,
      activosAhora: esDiaActual ? contarActivosReales() : 0,
      visitasDia: statsDia.sesionesUnicas.size,
      eventosDia: statsDia.totalEventos,
      horaPico: obtenerHoraPico(statsDia),
      ubicacionesTop: resumenUbicacionesDia(statsDia),
      porHora,
      actualizadoEn: ahoraDate.toISOString(),
      timeoutSegundos: Math.round(VISITAS_TIMEOUT_MS / 1000)
    });
  }
});

app.get(['/api/visitas/historial', '/visitas/historial'], async (req, res) => {
  const diasSolicitados = Number(req.query?.dias) || 15;
  const dias = Math.max(7, Math.min(DIAS_HISTORICO_VISITAS_MAX, diasSolicitados));
  const hoyClave = claveDiaLocal(new Date());
  const desdeClave = restarDiasClave(hoyClave, dias - 1);

  try {
    await visitasDbReady;
    const filas = await dbAllAsync(
      bdVentas,
      `SELECT dia_clave, total_eventos, sesiones_unicas
       FROM tienda_visitas_diarias
       WHERE dia_clave >= ?
       ORDER BY dia_clave ASC`,
      [desdeClave]
    );
    const paises = await dbAllAsync(
      bdVentas,
      `SELECT pais, SUM(total) AS total
       FROM tienda_visitas_diarias_paises
       WHERE dia_clave >= ?
       GROUP BY pais
       ORDER BY CASE WHEN INSTR(pais, ',') > 0 THEN 1 ELSE 0 END DESC,
                total DESC
       LIMIT 10`,
      [desdeClave]
    );

    const mapaPorDia = new Map(
      (filas || []).map((item) => [
        String(item?.dia_clave || '').trim(),
        {
          visitas: Number(item?.sesiones_unicas) || 0,
          eventos: Number(item?.total_eventos) || 0
        }
      ])
    );

    const porDia = [];
    for (let i = 0; i < dias; i += 1) {
      const fecha = sumarDiasClave(desdeClave, i);
      const stats = mapaPorDia.get(fecha) || { visitas: 0, eventos: 0 };
      porDia.push({ fecha, visitas: Number(stats.visitas) || 0, eventos: Number(stats.eventos) || 0 });
    }
    const totalVisitas = porDia.reduce((acc, item) => acc + (Number(item?.visitas) || 0), 0);
    const totalEventos = porDia.reduce((acc, item) => acc + (Number(item?.eventos) || 0), 0);
    const maxDia = porDia.reduce((max, item) => (Number(item?.visitas) > Number(max?.visitas) ? item : max), { fecha: '', visitas: 0, eventos: 0 });

    return res.json({
      ok: true,
      rangoDias: dias,
      desde: desdeClave,
      hasta: hoyClave,
      porDia,
      topUbicaciones: (paises || []).map((item) => ({
        ubicacion: normalizarEtiquetaUbicacion(item?.pais || 'Desconocido'),
        pais: normalizarEtiquetaUbicacion(item?.pais || 'Desconocido'),
        total: Number(item?.total) || 0
      })),
      totalVisitas,
      totalEventos,
      promedioVisitasDia: porDia.length ? Number((totalVisitas / porDia.length).toFixed(2)) : 0,
      diaConMasVisitas: maxDia
    });
  } catch {
    return res.status(500).json({ ok: false, error: 'No se pudo cargar historial de visitas' });
  }
});

app.get(['/api/visitas/comportamiento', '/visitas/comportamiento'], async (req, res) => {
  const diasSolicitados = Number(req.query?.dias) || 15;
  const dias = Math.max(7, Math.min(DIAS_HISTORICO_VISITAS_MAX, diasSolicitados));
  const hoyClave = claveDiaLocal(new Date());
  const desdeClave = restarDiasClave(hoyClave, dias - 1);

  try {
    await visitasDbReady;
    const total = await dbGetAsync(
      bdVentas,
      `SELECT COUNT(*) AS total
       FROM tienda_visitas_eventos
       WHERE dia_clave >= ?`,
      [desdeClave]
    );

    const topAcciones = await dbAllAsync(
      bdVentas,
      `SELECT accion, COUNT(*) AS total
       FROM tienda_visitas_eventos
       WHERE dia_clave >= ?
       GROUP BY accion
       ORDER BY total DESC
       LIMIT 12`,
      [desdeClave]
    );

    const topProductos = await dbAllAsync(
      bdVentas,
      `SELECT producto, COUNT(*) AS total
       FROM tienda_visitas_eventos
       WHERE dia_clave >= ?
         AND COALESCE(TRIM(producto), '') <> ''
       GROUP BY producto
       ORDER BY total DESC
       LIMIT 12`,
      [desdeClave]
    );

    const totalEventos = Number(total?.total) || 0;
    if (totalEventos <= 0) {
      const fallbackVisitas = await dbGetAsync(
        bdVentas,
        `SELECT COALESCE(SUM(total_eventos), 0) AS total
         FROM tienda_visitas_diarias
         WHERE dia_clave >= ?`,
        [desdeClave]
      );
      const totalFallback = Number(fallbackVisitas?.total) || 0;
      return res.json({
        ok: true,
        rangoDias: dias,
        desde: desdeClave,
        hasta: hoyClave,
        totalEventos: totalFallback,
        topAcciones: totalFallback > 0 ? [{ accion: 'visita_pagina', total: totalFallback }] : [],
        topProductos: []
      });
    }

    return res.json({
      ok: true,
      rangoDias: dias,
      desde: desdeClave,
      hasta: hoyClave,
      totalEventos,
      topAcciones: (topAcciones || []).map((item) => ({
        accion: limpiarTextoCorto(item?.accion || 'accion', 64) || 'accion',
        total: Number(item?.total) || 0
      })),
      topProductos: (topProductos || []).map((item) => ({
        producto: limpiarTextoCorto(item?.producto || 'Producto', 140) || 'Producto',
        total: Number(item?.total) || 0
      }))
    });
  } catch (error) {
    const msg = String(error?.message || '').toLowerCase();
    const faltaTablaEventos =
      msg.includes('tienda_visitas_eventos')
      && (msg.includes('no such table') || msg.includes('does not exist') || msg.includes('relation'));

    if (faltaTablaEventos) {
      const fallbackVisitas = await dbGetAsync(
        bdVentas,
        `SELECT COALESCE(SUM(total_eventos), 0) AS total
         FROM tienda_visitas_diarias
         WHERE dia_clave >= ?`,
        [desdeClave]
      ).catch(() => ({ total: 0 }));

      const totalFallback = Number(fallbackVisitas?.total) || 0;
      return res.json({
        ok: true,
        rangoDias: dias,
        desde: desdeClave,
        hasta: hoyClave,
        totalEventos: totalFallback,
        topAcciones: totalFallback > 0 ? [{ accion: 'visita_pagina', total: totalFallback }] : [],
        topProductos: []
      });
    }

    return res.status(500).json({ ok: false, error: 'No se pudo cargar comportamiento de visitas' });
  }
});

setInterval(() => {
  const ahora = new Date();
  limpiarVisitantesInactivos(ahora.getTime());
  limpiarEstadisticasAntiguas(ahora);
}, 30_000).unref?.();

const reglasPermisos = [
  { metodos: ['GET'], exacto: '/inventario/estadisticas', pestana: 'inventario', accion: 'ver_estadisticas' },
  { metodos: ['GET'], prefijo: '/inventario', pestana: 'inventario', accion: 'ver' },
  { metodos: ['POST'], exacto: '/inventario/agregar', pestana: 'inventario', accion: 'crear' },
  { metodos: ['POST'], exacto: '/inventario/aumentar', pestana: 'inventario', accion: 'aumentar' },
  { metodos: ['POST'], prefijo: '/inventario/proveedores', pestana: 'inventario', accion: 'editar' },
  { metodos: ['PATCH'], prefijo: '/inventario/proveedores', pestana: 'inventario', accion: 'editar' },
  { metodos: ['PATCH'], prefijo: '/inventario', pestana: 'inventario', accion: 'editar' },
  { metodos: ['DELETE'], prefijo: '/inventario', pestana: 'inventario', accion: 'eliminar' },

  { metodos: ['GET'], exacto: '/categorias', pestana: 'recetas', accion: 'categorias_ver' },
  { metodos: ['POST', 'PATCH', 'DELETE'], prefijo: '/categorias', pestana: 'recetas', accion: 'categorias_gestionar' },
  { metodos: ['POST'], exacto: '/recetas/calcular', pestana: 'recetas', accion: 'calcular' },
  { metodos: ['GET'], prefijo: '/recetas', pestana: 'recetas', accion: 'ver' },
  { metodos: ['POST'], exacto: '/recetas', pestana: 'recetas', accion: 'crear' },
  { metodos: ['POST'], exacto: '/recetas/ordenes-compra', pestana: 'recetas', accion: 'crear' },
  { metodos: ['POST'], prefijo: '/recetas/ordenes-compra/items', pestana: 'recetas', accion: 'editar' },
  { metodos: ['PATCH'], prefijo: '/recetas/ordenes-compra/items', pestana: 'recetas', accion: 'editar' },
  { metodos: ['POST'], exacto: '/recetas/archivar', pestana: 'recetas', accion: 'editar' },
  { metodos: ['POST'], exacto: '/recetas/desarchivar', pestana: 'recetas', accion: 'editar' },
  { metodos: ['POST'], exacto: '/api/uploads/tienda-imagen', pestana: 'recetas', accion: 'editar' },
  { metodos: ['POST'], exacto: '/api/uploads/lista-precios-archivo', pestana: 'inventario', accion: 'editar' },
  { metodos: ['PATCH'], prefijo: '/recetas', pestana: 'recetas', accion: 'editar' },
  { metodos: ['DELETE'], prefijo: '/recetas', pestana: 'recetas', accion: 'eliminar' },

  { metodos: ['GET'], prefijo: '/produccion', pestana: 'produccion', accion: 'ver' },
  { metodos: ['POST'], exacto: '/produccion', pestana: 'produccion', accion: 'crear' },
  { metodos: ['DELETE'], prefijo: '/produccion', pestana: 'produccion', accion: 'eliminar' },

  { metodos: ['GET'], prefijo: '/ventas/estadisticas', pestana: 'ventas', accion: 'ver_estadisticas' },
  { metodos: ['GET'], exacto: '/ventas', pestana: 'ventas', accion: 'ver' },
  { metodos: ['POST'], exacto: '/ventas', pestana: 'ventas', accion: 'crear' },
  { metodos: ['DELETE'], prefijo: '/ventas', pestana: 'ventas', accion: 'eliminar' },
  { metodos: ['POST'], prefijo: '/cortesia', pestana: 'ventas', accion: 'cortesia_crear' },
  { metodos: ['GET'], exacto: '/cortesias', pestana: 'ventas', accion: 'cortesia_ver' },
  { metodos: ['POST'], exacto: '/cortesias/limpiar-pruebas', pestana: 'ventas', accion: 'cortesia_limpiar' },
  { metodos: ['DELETE'], prefijo: '/cortesias', pestana: 'ventas', accion: 'cortesia_eliminar' },

  { metodos: ['GET'], exacto: '/utensilios/estadisticas', pestana: 'utensilios', accion: 'ver_estadisticas' },
  { metodos: ['GET'], exacto: '/utensilios/historial/agrupar/fechas', pestana: 'utensilios', accion: 'ver_historial' },
  { metodos: ['GET'], prefijo: '/utensilios', pestana: 'utensilios', accion: 'ver' },
  { metodos: ['POST'], exacto: '/utensilios/agregar', pestana: 'utensilios', accion: 'crear' },
  { metodos: ['POST'], exacto: '/utensilios/recuperado', pestana: 'utensilios', accion: 'recuperar' },
  { metodos: ['PATCH'], prefijo: '/utensilios', pestana: 'utensilios', accion: 'editar' },
  { metodos: ['DELETE'], prefijo: '/utensilios', pestana: 'utensilios', accion: 'eliminar' },

  { metodos: ['GET'], exacto: '/api/privado/usuarios', pestana: 'admin_usuarios', accion: 'ver' },
  { metodos: ['POST'], exacto: '/api/privado/usuarios', pestana: 'admin_usuarios', accion: 'crear' },
  { metodos: ['PATCH'], prefijo: '/api/privado/usuarios', contiene: '/permisos', pestana: 'admin_usuarios', accion: 'editar_permisos' },
  { metodos: ['PATCH'], prefijo: '/api/privado/usuarios', pestana: 'admin_usuarios', accion: 'editar_usuario' },
  { metodos: ['POST'], exacto: '/api/privado/usuarios/reset-password', pestana: 'admin_usuarios', accion: 'reset_password' },
  { metodos: ['DELETE'], prefijo: '/api/privado/usuarios', pestana: 'admin_usuarios', accion: 'eliminar' },

  { metodos: ['GET'], exacto: '/api/exportar/inventario', pestana: 'inventario', accion: 'exportar' },
  { metodos: ['POST'], exacto: '/api/importar/inventario', pestana: 'inventario', accion: 'importar' },
  { metodos: ['GET'], exacto: '/api/exportar/utensilios', pestana: 'utensilios', accion: 'exportar' },
  { metodos: ['POST'], exacto: '/api/importar/utensilios', pestana: 'utensilios', accion: 'importar' },
  { metodos: ['GET'], exacto: '/api/exportar/recetas', pestana: 'recetas', accion: 'exportar' },
  { metodos: ['POST'], exacto: '/api/importar/recetas', pestana: 'recetas', accion: 'importar' },
  { metodos: ['GET'], exacto: '/api/exportar/produccion', pestana: 'produccion', accion: 'exportar' },
  { metodos: ['POST'], exacto: '/api/importar/produccion', pestana: 'produccion', accion: 'importar' },
  { metodos: ['GET'], exacto: '/api/exportar/ventas', pestana: 'ventas', accion: 'exportar' },
  { metodos: ['POST'], exacto: '/api/importar/ventas', pestana: 'ventas', accion: 'importar' },
  { metodos: ['GET'], exacto: '/api/exportar/cortesias', pestana: 'ventas', accion: 'exportar' },
  { metodos: ['POST'], exacto: '/api/importar/cortesias', pestana: 'ventas', accion: 'importar' },
  { metodos: ['GET'], exacto: '/api/exportar/todo', pestana: 'admin_usuarios', accion: 'ver' },
  { metodos: ['POST'], exacto: '/api/importar/todo', pestana: 'admin_usuarios', accion: 'editar_usuario' },
  { metodos: ['POST'], exacto: '/tienda/catalogo/upsert', pestana: 'trastienda', accion: 'editar' },
  { metodos: ['GET'], prefijo: '/tienda/admin', pestana: 'trastienda', accion: 'ver' },
  { metodos: ['POST', 'PATCH', 'DELETE'], prefijo: '/tienda/admin', pestana: 'trastienda', accion: 'editar' }
];

function rutaCoincide(pathname, regla) {
  const matchMetodo = !regla.metodos || regla.metodos.includes('*') || regla.metodos.includes(pathname.metodo);
  if (!matchMetodo) return false;

  if (regla.exacto && pathname.ruta !== regla.exacto) return false;
  if (regla.prefijo && !(pathname.ruta === regla.prefijo || pathname.ruta.startsWith(`${regla.prefijo}/`))) return false;
  if (regla.contiene && !pathname.ruta.includes(regla.contiene)) return false;

  return true;
}

app.use((req, res, next) => {
  const ruta = req.path || req.originalUrl || '';
  // Permitir importar TODO sin autenticación
  if (req.method === 'POST' && ruta === '/api/importar/todo') return next();

  const match = reglasPermisos.find((regla) => rutaCoincide({ ruta, metodo: req.method }, regla));

  if (!match) return next();

  const auth = req.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ exito: false, mensaje: 'No autenticado' });
  }

  const token = auth.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'chipactli_jwt_secret');
    req.usuario = decoded;
  } catch {
    return res.status(401).json({ exito: false, mensaje: 'Token inválido' });
  }

  if (!tienePermisoAccion(req.usuario, match.pestana, match.accion)) {
    return res.status(403).json({ exito: false, mensaje: 'Sin permiso para esta acción' });
  }

  next();
});

app.post('/api/uploads/tienda-imagen', upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ exito: false, mensaje: 'Debes seleccionar una imagen' });
    }

    const mime = String(req.file.mimetype || '').toLowerCase();
    if (!mime.startsWith('image/')) {
      return res.status(400).json({ exito: false, mensaje: 'El archivo debe ser una imagen' });
    }

    const extOriginal = path.extname(String(req.file.originalname || '')).toLowerCase();
    const ext = extOriginal || (mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg');
    const nombre = `tienda-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const destino = path.join(uploadsDir, 'tienda', nombre);

    await fs.writeFile(destino, req.file.buffer);

    return res.json({ ok: true, url: `/uploads/tienda/${nombre}` });
  } catch {
    return res.status(500).json({ exito: false, mensaje: 'No se pudo subir la imagen' });
  }
});

async function extraerTextoArchivoListaPrecios(file) {
  if (!file || !file.buffer) return '';
  const mime = String(file.mimetype || '').toLowerCase();
  const nombre = String(file.originalname || '').toLowerCase();

  try {
    if (mime === 'application/pdf' || nombre.endsWith('.pdf')) {
      const mod = await import('pdf-parse');
      const pdfParse = mod.default || mod;
      const salida = await pdfParse(file.buffer);
      return String(salida?.text || '').replace(/\s+/g, ' ').slice(0, 200000);
    }

    if (
      mime.includes('excel')
      || mime.includes('spreadsheet')
      || nombre.endsWith('.xlsx')
      || nombre.endsWith('.xls')
    ) {
      const mod = await import('xlsx');
      const XLSX = mod.default || mod;
      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      const bloques = [];
      for (const sheetName of wb.SheetNames || []) {
        const hoja = wb.Sheets[sheetName];
        if (!hoja) continue;
        const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' });
        const texto = (filas || [])
          .map((fila) => Array.isArray(fila) ? fila.join(' ') : String(fila || ''))
          .join('\n');
        bloques.push(`Hoja ${sheetName}: ${texto}`);
      }
      return bloques.join('\n').replace(/\s+/g, ' ').slice(0, 200000);
    }

    if (mime.includes('csv') || nombre.endsWith('.csv') || mime.startsWith('text/')) {
      return String(file.buffer.toString('utf8') || '').replace(/\s+/g, ' ').slice(0, 200000);
    }
  } catch {
    // Fallback a texto simple.
  }

  return String(file.buffer.toString('utf8') || '')
    .replace(/\u0000/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 200000);
}

app.post('/api/uploads/lista-precios-archivo', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ exito: false, mensaje: 'Debes seleccionar un archivo' });
    }

    const mime = String(req.file.mimetype || '').toLowerCase();
    const permitidos = new Set([
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ]);
    if (!permitidos.has(mime)) {
      return res.status(400).json({ exito: false, mensaje: 'Solo se permite PDF o Excel (XLS/XLSX/CSV)' });
    }

    const extOriginal = path.extname(String(req.file.originalname || '')).toLowerCase();
    const ext = extOriginal || (mime === 'application/pdf' ? '.pdf' : (mime.includes('sheet') ? '.xlsx' : (mime.includes('excel') ? '.xls' : '.csv')));
    const nombre = `lista-precios-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const destino = path.join(uploadsDir, 'tienda', nombre);

    await fs.writeFile(destino, req.file.buffer);

    const textoExtraido = await extraerTextoArchivoListaPrecios(req.file);

    return res.json({
      ok: true,
      url: `/uploads/tienda/${nombre}`,
      nombre_original: String(req.file.originalname || nombre),
      tipo: mime,
      texto_extraido: textoExtraido
    });
  } catch {
    return res.status(500).json({ exito: false, mensaje: 'No se pudo subir el archivo de lista de precios' });
  }
});

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

function validarAdmin(req, res) {
  const token = req.get("x-admin-token");
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    res.status(401).json({ exito: false, mensaje: "No autorizado" });
    return false;
  }
  return true;
}

function cerrarBase(db) {
  return new Promise((resolve) => {
    db.close(() => resolve());
  });
}

// Registrar rutas
registrarRutasUsuarios(app, bdAdminAuth);
registrarRutasInventario(app, bdInventarioRutas, bdRecetasRutas, bdVentasRutas);
registrarRutasUtensilios(app, bdInventarioRutas);
registrarRutasCategorias(app, bdRecetasRutas);
registrarRutasRecetas(app, bdRecetasRutas, bdInventarioRutas);
registrarRutasProduccion(app, bdProduccionRutas, bdRecetasRutas, bdInventarioRutas, bdVentasRutas);
registrarRutasCortesias(app, bdVentasRutas, bdProduccionRutas);
registrarRutasVentas(app, bdVentasRutas, bdProduccionRutas, bdInventarioRutas, bdRecetasRutas);
registrarRutasTienda(app, bdProduccionRutas, bdRecetasRutas, bdVentasRutas, bdInventarioRutas, bdAdminAuth);

// Rutas de backup
app.post("/api/backup/crear", async (req, res) => {
  if (!validarAdmin(req, res)) return;
  const resultado = await crearBackup();
  res.json({ exito: resultado, mensaje: resultado ? "Backup creado exitosamente" : "Error al crear backup" });
});

app.get("/api/backup/listar", async (req, res) => {
  if (!validarAdmin(req, res)) return;
  const backups = await listarBackups();
  res.json({ backups });
});

app.get("/api/backup/estado", async (req, res) => {
  if (!validarAdmin(req, res)) return;

  const dbOne = (db, sql) => new Promise((resolve, reject) => {
    db.get(sql, [], (err, row) => (err ? reject(err) : resolve(row || {})));
  });

  const archivos = {
    inventario: path.join(dbDir, "inventario.db"),
    recetas: path.join(dbDir, "recetas.db"),
    produccion: path.join(dbDir, "produccion.db"),
    ventas: path.join(dbDir, "ventas.db"),
    admin: path.join(dbDir, "admin.db")
  };

  try {
    const [inv, rec, prod, tc, tp, users] = await Promise.all([
      dbOne(bdInventario, "SELECT COUNT(*) AS c FROM inventario"),
      dbOne(bdRecetas, "SELECT COUNT(*) AS c FROM recetas"),
      dbOne(bdProduccion, "SELECT COUNT(*) AS c FROM produccion"),
      dbOne(bdVentas, "SELECT COUNT(*) AS c FROM tienda_catalogo"),
      dbOne(bdVentas, "SELECT COUNT(*) AS c FROM tienda_puntos_entrega"),
      dbOne(bdAdmin, "SELECT COUNT(*) AS c FROM usuarios")
    ]);

    const estadoArchivos = {};
    for (const [clave, rutaArchivo] of Object.entries(archivos)) {
      try {
        const stat = await fs.stat(rutaArchivo);
        estadoArchivos[clave] = {
          existe: true,
          bytes: stat.size,
          modificado_en: stat.mtime.toISOString(),
          ruta: rutaArchivo
        };
      } catch {
        estadoArchivos[clave] = {
          existe: false,
          bytes: 0,
          ruta: rutaArchivo
        };
      }
    }

    const backupsDisponibles = await listarBackups();
    const rutaDbActual = path.resolve(dbDir);
    const rutaPersistenteRender = path.resolve('/opt/render/data');

    return res.json({
      exito: true,
      db_dir: dbDir,
      backup_dir: backupDir,
      runtime_db: {
        auth_admin: usandoPgAdminAuth ? 'postgres' : 'sqlite',
        inventario_utensilios: usandoPgInventario ? 'postgres' : 'sqlite',
        recetas: usandoPgRecetas ? 'postgres' : 'sqlite',
        produccion: usandoPgProduccion ? 'postgres' : 'sqlite',
        ventas_tienda_cortesias: usandoPgVentas ? 'postgres' : 'sqlite'
      },
      diagnostico_storage: {
        ejecutando_en_render: ejecutandoEnRender,
        disco_render_detectado: discoRenderDisponible,
        usando_ruta_persistente_render: rutaDbActual.startsWith(rutaPersistenteRender),
        backups_disponibles_total: backupsDisponibles.length,
        ultimo_backup: backupsDisponibles[0] || null
      },
      archivos: estadoArchivos,
      conteos: {
        inventario: Number(inv?.c || 0),
        recetas: Number(rec?.c || 0),
        produccion: Number(prod?.c || 0),
        tienda_catalogo: Number(tc?.c || 0),
        tienda_puntos_entrega: Number(tp?.c || 0),
        usuarios: Number(users?.c || 0)
      }
    });
  } catch {
    return res.status(500).json({ exito: false, mensaje: "No se pudo obtener estado de bases de datos" });
  }
});

app.post("/api/backup/restaurar", async (req, res) => {
  if (!validarAdmin(req, res)) return;
  const { timestamp } = req.body;
  const resultado = await restaurarBackup(timestamp);
  res.json({ exito: resultado, mensaje: resultado ? "Backup restaurado exitosamente" : "Error al restaurar backup" });
});

// Descargar base de datos actual
app.get("/api/backup/descargar/:nombre", async (req, res) => {
  if (!validarAdmin(req, res)) return;
  
  const { nombre } = req.params;
  const archivosPermitidos = ['inventario', 'recetas', 'produccion', 'ventas', 'admin'];
  
  if (!archivosPermitidos.includes(nombre)) {
    return res.status(400).json({ exito: false, mensaje: "Base de datos no válida" });
  }
  
  const rutaArchivo = path.join(dbDir, `${nombre}.db`);
  
  if (!await fs.access(rutaArchivo).then(() => true).catch(() => false)) {
    return res.status(404).json({ exito: false, mensaje: "Archivo no encontrado" });
  }
  
  res.download(rutaArchivo, `${nombre}.db`);
});

app.post("/api/backup/importar", upload.fields([
  { name: 'inventario', maxCount: 1 },
  { name: 'recetas', maxCount: 1 },
  { name: 'produccion', maxCount: 1 },
  { name: 'ventas', maxCount: 1 },
  { name: 'admin', maxCount: 1 }
]), async (req, res) => {
  if (!validarAdmin(req, res)) return;

  const mapaArchivos = {
    inventario: path.join(dbDir, "inventario.db"),
    recetas: path.join(dbDir, "recetas.db"),
    produccion: path.join(dbDir, "produccion.db"),
    ventas: path.join(dbDir, "ventas.db"),
    admin: path.join(dbDir, "admin.db")
  };

  if (!req.files || Object.keys(req.files).length === 0) {
    res.status(400).json({ exito: false, mensaje: "No se enviaron archivos" });
    return;
  }

  try {
    await cerrarBase(bdInventario);
    await cerrarBase(bdRecetas);
    await cerrarBase(bdProduccion);
    await cerrarBase(bdVentas);
    await cerrarBase(bdAdmin);

    for (const [clave, rutaArchivo] of Object.entries(mapaArchivos)) {
      if (!req.files[clave]) continue;
      const archivo = req.files[clave][0];
      await fs.writeFile(rutaArchivo, archivo.buffer);
    }

    res.json({ exito: true, mensaje: "Importacion completada. Reiniciando servicio..." });
    setTimeout(() => process.exit(0), 1000);
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: "Error al importar bases de datos" });
  }
});

// ============================================
// RUTAS DE EXPORTAR/IMPORTAR DATOS
// ============================================

function dbAllAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function dbRunAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ changes: this?.changes || 0, lastID: this?.lastID || 0 });
    });
  });
}

function toArrayMaybe(valor) {
  return Array.isArray(valor) ? valor : [];
}

function normalizarUrlMediaPersistida(valor) {
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
    // No-op: dejar el valor original si no es URL válida.
  }

  return txt;
}

function normalizarCamposMediaEnFila(tabla, row = {}) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  const salida = { ...row };
  const t = String(tabla || '').trim().toLowerCase();

  const columnasUrlDirecta = new Set(['image_url', 'tienda_image_url']);
  for (const col of Object.keys(salida)) {
    if (!columnasUrlDirecta.has(String(col || '').trim().toLowerCase())) continue;
    salida[col] = normalizarUrlMediaPersistida(salida[col]);
  }

  if (t === 'recetas') {
    const rawGaleria = String(salida.tienda_galeria || '').trim();
    if (rawGaleria) {
      try {
        const parsed = JSON.parse(rawGaleria);
        if (Array.isArray(parsed)) {
          salida.tienda_galeria = JSON.stringify(parsed.map((item) => normalizarUrlMediaPersistida(item)).filter(Boolean));
        }
      } catch {
        // Ignorar si no es JSON válido.
      }
    }
  }

  return salida;
}

async function exportarUploadsTienda() {
  try {
    await fs.mkdir(uploadsTiendaDir, { recursive: true });
    const nombres = await fs.readdir(uploadsTiendaDir);
    const archivos = [];
    for (const nombre of (nombres || [])) {
      const limpio = String(nombre || '').trim();
      if (!limpio) continue;
      const ruta = path.join(uploadsTiendaDir, limpio);
      const stat = await fs.stat(ruta).catch(() => null);
      if (!stat || !stat.isFile()) continue;
      const contenido = await fs.readFile(ruta);
      archivos.push({
        nombre: limpio,
        size: Number(stat.size) || 0,
        mtime: stat.mtime ? new Date(stat.mtime).toISOString() : null,
        base64: contenido.toString('base64')
      });
    }
    return archivos;
  } catch {
    return [];
  }
}

async function importarUploadsTienda(archivos = []) {
  const lista = Array.isArray(archivos) ? archivos : [];
  if (!lista.length) return 0;
  await fs.mkdir(uploadsTiendaDir, { recursive: true });

  let restaurados = 0;
  for (const item of lista) {
    const nombre = String(item?.nombre || '').trim();
    const base64 = String(item?.base64 || '').trim();
    if (!nombre || !base64) continue;
    if (nombre.includes('/') || nombre.includes('\\')) continue;

    const destino = path.join(uploadsTiendaDir, nombre);
    const buffer = Buffer.from(base64, 'base64');
    await fs.writeFile(destino, buffer);
    restaurados += 1;
  }
  return restaurados;
}

function normalizarEntradaImportacionTodo(payload) {
  const base = payload?.dbs || payload?.datos?.dbs || payload?.datos || payload;
  if (!base || typeof base !== 'object' || Array.isArray(base)) return null;

  const normalizado = { ...base };
  const ventasBase = (normalizado.ventas && typeof normalizado.ventas === 'object') ? { ...normalizado.ventas } : {};
  const tablasVentas = (ventasBase.tablas && typeof ventasBase.tablas === 'object') ? { ...ventasBase.tablas } : {};

  const posiblesTrastiendaConfig = [
    payload?.trastienda_config,
    payload?.tienda_config,
    payload?.datos?.trastienda_config,
    payload?.datos?.tienda_config
  ];
  const trastiendaArray = posiblesTrastiendaConfig
    .map((valor) => toArrayMaybe(valor))
    .find((arr) => Array.isArray(arr) && arr.length) || [];

  if (!Array.isArray(tablasVentas.tienda_config) || !tablasVentas.tienda_config.length) {
    if (Array.isArray(trastiendaArray) && trastiendaArray.length) {
      tablasVentas.tienda_config = trastiendaArray;
    } else {
      const configObjeto = payload?.config_tienda || payload?.trastienda?.config || payload?.tienda?.config;
      if (configObjeto && typeof configObjeto === 'object' && !Array.isArray(configObjeto)) {
        tablasVentas.tienda_config = Object.entries(configObjeto).map(([clave, valor]) => ({
          clave: String(clave || '').trim(),
          valor: valor == null ? '' : String(valor)
        })).filter((row) => row.clave);
      }
    }
  }

  const leerLista = (...candidatos) => candidatos
    .map((valor) => toArrayMaybe(valor))
    .find((arr) => Array.isArray(arr) && arr.length) || [];

  // Compatibilidad: importar backups antiguos o personalizados que traen bloques
  // de tienda fuera de dbs.ventas.tablas.
  if (!Array.isArray(tablasVentas.tienda_descuentos) || !tablasVentas.tienda_descuentos.length) {
    const descuentos = leerLista(
      payload?.tienda_descuentos,
      payload?.descuentos_tienda,
      payload?.descuentos,
      payload?.datos?.tienda_descuentos,
      payload?.datos?.descuentos_tienda,
      payload?.datos?.descuentos
    );
    if (descuentos.length) tablasVentas.tienda_descuentos = descuentos;
  }

  if (!Array.isArray(tablasVentas.tienda_paquetes) || !tablasVentas.tienda_paquetes.length) {
    const paquetes = leerLista(
      payload?.tienda_paquetes,
      payload?.paquetes_tienda,
      payload?.paquetes,
      payload?.datos?.tienda_paquetes,
      payload?.datos?.paquetes_tienda,
      payload?.datos?.paquetes
    );
    if (paquetes.length) tablasVentas.tienda_paquetes = paquetes;
  }

  if (!Array.isArray(tablasVentas.tienda_paquetes_items) || !tablasVentas.tienda_paquetes_items.length) {
    const paquetesItems = leerLista(
      payload?.tienda_paquetes_items,
      payload?.paquetes_items_tienda,
      payload?.paquetes_items,
      payload?.datos?.tienda_paquetes_items,
      payload?.datos?.paquetes_items_tienda,
      payload?.datos?.paquetes_items
    );
    if (paquetesItems.length) tablasVentas.tienda_paquetes_items = paquetesItems;
  }

  if (!Array.isArray(tablasVentas.tienda_catalogo) || !tablasVentas.tienda_catalogo.length) {
    const catalogo = leerLista(
      payload?.tienda_catalogo,
      payload?.catalogo_tienda,
      payload?.datos?.tienda_catalogo,
      payload?.datos?.catalogo_tienda
    );
    if (catalogo.length) tablasVentas.tienda_catalogo = catalogo;
  }

  normalizado.ventas = {
    ...ventasBase,
    tablas: tablasVentas
  };

  return normalizado;
}

function buscarListaLegacyPorTabla(payload, tabla) {
  const nombre = String(tabla || '').trim();
  if (!nombre) return [];

  const candidatos = [
    payload?.[nombre],
    payload?.datos?.[nombre],
    payload?.backup?.[nombre],
    payload?.contenido?.[nombre],
    payload?.datos?.backup?.[nombre]
  ];

  for (const candidato of candidatos) {
    if (Array.isArray(candidato)) return candidato;
  }

  return [];
}

function escaparIdentificadorSql(nombre) {
  return `"${String(nombre || '').replaceAll('"', '""')}"`;
}

async function listarTablasUsuario(db) {
  const rows = await dbAllAsync(
    db,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  return rows.map((r) => String(r.name || '')).filter(Boolean);
}

async function obtenerColumnasTabla(db, tabla) {
  const pragma = await dbAllAsync(db, `PRAGMA table_info(${escaparIdentificadorSql(tabla)})`);
  return pragma.map((col) => String(col.name || '')).filter(Boolean);
}

const MAPA_DATABASES = {
  inventario: bdInventario,
  recetas: bdRecetas,
  produccion: bdProduccion,
  ventas: bdVentas,
  admin: bdAdmin
};

// Exportar respaldo completo de todas las tablas de todas las DBs.
app.get('/api/exportar/todo', async (req, res) => {
  try {
    const incluirUploads = true;
    const salida = {
      tipo: 'todo',
      version: 1,
      generado_en: new Date().toISOString(),
      dbs: {}
    };

    const total = {};

    for (const [nombreDb, db] of Object.entries(MAPA_DATABASES)) {
      const tablas = await listarTablasUsuario(db);
      const dbPayload = { tablas: {} };
      const totalDb = {};

      for (const tabla of tablas) {
        const rows = await dbAllAsync(db, `SELECT * FROM ${escaparIdentificadorSql(tabla)}`);
        dbPayload.tablas[tabla] = rows;
        totalDb[tabla] = rows.length;
      }

      salida.dbs[nombreDb] = dbPayload;
      total[nombreDb] = totalDb;
    }

    const trastiendaConfig = toArrayMaybe(salida?.dbs?.ventas?.tablas?.tienda_config);
    const tiendaDescuentos = toArrayMaybe(salida?.dbs?.ventas?.tablas?.tienda_descuentos);
    const tiendaPaquetes = toArrayMaybe(salida?.dbs?.ventas?.tablas?.tienda_paquetes);
    const tiendaPaquetesItems = toArrayMaybe(salida?.dbs?.ventas?.tablas?.tienda_paquetes_items);
    const tiendaCatalogo = toArrayMaybe(salida?.dbs?.ventas?.tablas?.tienda_catalogo);
    const archivosUploadsTienda = incluirUploads ? await exportarUploadsTienda() : [];

    res.json({
      ...salida,
      total,
      trastienda_config: trastiendaConfig,
      incluye_trastienda_config: true,
      tienda_descuentos: tiendaDescuentos,
      tienda_paquetes: tiendaPaquetes,
      tienda_paquetes_items: tiendaPaquetesItems,
      tienda_catalogo: tiendaCatalogo,
      archivos_uploads_tienda: archivosUploadsTienda,
      incluye_uploads_tienda: incluirUploads
    });
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: 'Error al exportar TODO', detalle: error.message });
  }
});

// Importar respaldo completo (todas las tablas de todas las DBs).
app.post('/api/importar/todo', async (req, res) => {
  const payload = req.body;

  const dbsEntrada = normalizarEntradaImportacionTodo(payload);
  if (!dbsEntrada || typeof dbsEntrada !== 'object' || Array.isArray(dbsEntrada)) {
    return res.status(400).json({ exito: false, mensaje: 'Formato de datos inválido para importación total' });
  }

  const resultado = {};
  const incluirUploads = true;
  const archivosUploadsEntrada = toArrayMaybe(payload?.archivos_uploads_tienda);

  try {
    for (const [nombreDb, db] of Object.entries(MAPA_DATABASES)) {
      const origenDb = dbsEntrada[nombreDb];
      const tablasEntrada = (origenDb?.tablas && typeof origenDb.tablas === 'object') ? origenDb.tablas : {};

      const tablasExistentes = await listarTablasUsuario(db);
      const tablasObjetivo = tablasExistentes.filter((tabla) => {
        if (Object.prototype.hasOwnProperty.call(tablasEntrada, tabla)) return true;
        const legacy = buscarListaLegacyPorTabla(payload, tabla);
        return Array.isArray(legacy) && legacy.length > 0;
      });

      if (!tablasObjetivo.length) continue;

      resultado[nombreDb] = {};

      await dbRunAsync(db, 'PRAGMA foreign_keys = OFF');
      await dbRunAsync(db, 'BEGIN TRANSACTION');

      try {
        for (const tabla of tablasObjetivo) {
          const rows = Object.prototype.hasOwnProperty.call(tablasEntrada, tabla)
            ? toArrayMaybe(tablasEntrada[tabla])
            : toArrayMaybe(buscarListaLegacyPorTabla(payload, tabla));
          const columnasExistentes = await obtenerColumnasTabla(db, tabla);
          const setColumnas = new Set(columnasExistentes);

          await dbRunAsync(db, `DELETE FROM ${escaparIdentificadorSql(tabla)}`);

          let importados = 0;
          for (const rowRaw of rows) {
            if (!rowRaw || typeof rowRaw !== 'object' || Array.isArray(rowRaw)) continue;
            const row = normalizarCamposMediaEnFila(tabla, rowRaw);

            const columnasRow = Object.keys(row).filter((c) => setColumnas.has(c));
            if (!columnasRow.length) continue;

            const columnasSql = columnasRow.map(escaparIdentificadorSql).join(', ');
            const placeholders = columnasRow.map(() => '?').join(', ');
            const valores = columnasRow.map((c) => (row[c] === undefined ? null : row[c]));

            await dbRunAsync(
              db,
              `INSERT INTO ${escaparIdentificadorSql(tabla)} (${columnasSql}) VALUES (${placeholders})`,
              valores
            );
            importados += 1;
          }

          resultado[nombreDb][tabla] = importados;
        }

        await dbRunAsync(db, 'COMMIT');
      } catch (errorTabla) {
        await dbRunAsync(db, 'ROLLBACK');
        throw errorTabla;
      } finally {
        await dbRunAsync(db, 'PRAGMA foreign_keys = ON');
      }
    }

    const archivosRestaurados = await importarUploadsTienda(archivosUploadsEntrada);
    res.json({
      exito: true,
      mensaje: 'Respaldo total importado',
      importados: resultado,
      incluye_uploads_tienda: incluirUploads,
      archivos_uploads_tienda_restaurados: archivosRestaurados
    });
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: 'Error al importar TODO: ' + error.message });
  }
});

// Exportar datos de inventario
app.get("/api/exportar/inventario", async (req, res) => {
  try {
    const [
      inventario,
      historial_inventario,
      insumos_eliminados,
      inversion_recuperada,
      utensilios,
      historial_utensilios,
      recuperado_utensilios,
      ordenes_compra,
      ordenes_compra_items,
      proveedores,
      lista_precios_ordenes,
      historial_lista_precios_ordenes
    ] = await Promise.all([
      dbAllAsync(bdInventario, "SELECT * FROM inventario ORDER BY id"),
      dbAllAsync(bdInventario, "SELECT * FROM historial_inventario ORDER BY id"),
      dbAllAsync(bdInventario, "SELECT * FROM insumos_eliminados ORDER BY id_inventario"),
      dbAllAsync(bdInventario, "SELECT * FROM inversion_recuperada ORDER BY id"),
      dbAllAsync(bdInventario, "SELECT * FROM utensilios ORDER BY id"),
      dbAllAsync(bdInventario, "SELECT * FROM historial_utensilios ORDER BY id"),
      dbAllAsync(bdInventario, "SELECT * FROM recuperado_utensilios ORDER BY id"),
      dbAllAsync(bdInventario, "SELECT * FROM ordenes_compra ORDER BY id"),
      dbAllAsync(bdInventario, "SELECT * FROM ordenes_compra_items ORDER BY id"),
      dbAllAsync(bdInventario, "SELECT * FROM proveedores ORDER BY id"),
      dbAllAsync(bdInventario, "SELECT * FROM lista_precios_ordenes ORDER BY id"),
      dbAllAsync(bdInventario, "SELECT * FROM historial_lista_precios_ordenes ORDER BY id")
    ]);

    const datos = {
      inventario,
      historial_inventario,
      insumos_eliminados,
      inversion_recuperada,
      utensilios,
      historial_utensilios,
      recuperado_utensilios,
      ordenes_compra,
      ordenes_compra_items,
      proveedores,
      lista_precios_ordenes,
      historial_lista_precios_ordenes
    };

    res.json({
      tipo: "inventario",
      datos,
      total: {
        inventario: inventario.length,
        historial_inventario: historial_inventario.length,
        insumos_eliminados: insumos_eliminados.length,
        inversion_recuperada: inversion_recuperada.length,
        utensilios: utensilios.length,
        historial_utensilios: historial_utensilios.length,
        recuperado_utensilios: recuperado_utensilios.length,
        ordenes_compra: ordenes_compra.length,
        ordenes_compra_items: ordenes_compra_items.length,
        proveedores: proveedores.length,
        lista_precios_ordenes: lista_precios_ordenes.length,
        historial_lista_precios_ordenes: historial_lista_precios_ordenes.length
      }
    });
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: "Error al exportar inventario", detalle: error.message });
  }
});

// Exportar datos de utensilios
app.get("/api/exportar/utensilios", async (req, res) => {
  try {
    const [utensilios, historial_utensilios, recuperado_utensilios] = await Promise.all([
      dbAllAsync(bdInventario, "SELECT * FROM utensilios ORDER BY id"),
      dbAllAsync(bdInventario, "SELECT * FROM historial_utensilios ORDER BY id"),
      dbAllAsync(bdInventario, "SELECT * FROM recuperado_utensilios ORDER BY id")
    ]);

    res.json({
      tipo: "utensilios",
      datos: { utensilios, historial_utensilios, recuperado_utensilios },
      total: {
        utensilios: utensilios.length,
        historial_utensilios: historial_utensilios.length,
        recuperado_utensilios: recuperado_utensilios.length
      }
    });
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: "Error al exportar utensilios", detalle: error.message });
  }
});

// Exportar datos de recetas (incluye categorías e ingredientes)
app.get("/api/exportar/recetas", (req, res) => {
  const exportData = {};
  
  bdRecetas.all("SELECT * FROM categorias", [], (err, categorias) => {
    if (err) {
      return res.status(500).json({ exito: false, mensaje: "Error al exportar categorías" });
    }
    exportData.categorias = categorias;
    
    bdRecetas.all("SELECT * FROM recetas", [], (err, recetas) => {
      if (err) {
        return res.status(500).json({ exito: false, mensaje: "Error al exportar recetas" });
      }
      exportData.recetas = recetas;
      
      bdRecetas.all("SELECT * FROM ingredientes_receta", [], (err, ingredientes) => {
        if (err) {
          return res.status(500).json({ exito: false, mensaje: "Error al exportar ingredientes" });
        }
        exportData.ingredientes = ingredientes;
        
        res.json({
          tipo: "recetas",
          datos: exportData,
          total: {
            categorias: categorias.length,
            recetas: recetas.length,
            ingredientes: ingredientes.length
          }
        });
      });
    });
  });
});

// Exportar datos de producción
app.get("/api/exportar/produccion", (req, res) => {
  bdProduccion.all("SELECT * FROM produccion", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ exito: false, mensaje: "Error al exportar producción" });
    }
    res.json({ tipo: "produccion", datos: rows, total: rows.length });
  });
});

// Exportar datos de ventas (incluye cortesias para respaldo completo)
app.get("/api/exportar/ventas", async (req, res) => {
  try {
    const ventas = await dbAllAsync(bdVentas, "SELECT * FROM ventas");
    const cortesias = await dbAllAsync(bdVentas, "SELECT * FROM cortesias");
    res.json({
      tipo: "ventas",
      datos: ventas,
      ventas,
      cortesias,
      total: ventas.length,
      totales: {
        ventas: ventas.length,
        cortesias: cortesias.length
      }
    });
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: "Error al exportar ventas", detalle: error.message });
  }
});

// Exportar datos de cortesias
app.get("/api/exportar/cortesias", async (req, res) => {
  try {
    const cortesias = await dbAllAsync(bdVentas, "SELECT * FROM cortesias");
    res.json({ tipo: "cortesias", datos: cortesias, total: cortesias.length });
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: "Error al exportar cortesias", detalle: error.message });
  }
});

// Importar datos de inventario
app.post("/api/importar/inventario", async (req, res) => {
  const { datos } = req.body;

  try {
    // Compatibilidad hacia atrás: formato antiguo (solo arreglo de inventario)
    if (Array.isArray(datos)) {
      let importados = 0;
      for (const item of datos) {
        await dbRunAsync(
          bdInventario,
          `INSERT INTO inventario (codigo, nombre, proveedor, unidad, cantidad_total, cantidad_disponible, costo_total, costo_por_unidad, pendiente)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(codigo) DO UPDATE SET
             nombre=excluded.nombre,
             proveedor=excluded.proveedor,
             unidad=excluded.unidad,
             cantidad_total=excluded.cantidad_total,
             cantidad_disponible=excluded.cantidad_disponible,
             costo_total=excluded.costo_total,
             costo_por_unidad=excluded.costo_por_unidad,
             pendiente=excluded.pendiente`,
          [
            item.codigo,
            item.nombre,
            item.proveedor || '',
            item.unidad,
            item.cantidad_total,
            item.cantidad_disponible,
            item.costo_total,
            item.costo_por_unidad,
            Number(item.pendiente || 0) ? 1 : 0
          ]
        );
        importados += 1;
      }
      return res.json({ exito: true, mensaje: "Inventario importado", importados });
    }

    const bloque = (datos && typeof datos === 'object') ? datos : null;
    if (!bloque) {
      return res.status(400).json({ exito: false, mensaje: "Formato de datos inválido" });
    }

    const inventario = toArrayMaybe(bloque.inventario);
    const historialInventario = toArrayMaybe(bloque.historial_inventario);
    const insumosEliminados = toArrayMaybe(bloque.insumos_eliminados);
    const inversionRecuperada = toArrayMaybe(bloque.inversion_recuperada);
    const utensilios = toArrayMaybe(bloque.utensilios);
    const historialUtensilios = toArrayMaybe(bloque.historial_utensilios);
    const recuperadoUtensilios = toArrayMaybe(bloque.recuperado_utensilios);
    const ordenesCompra = toArrayMaybe(bloque.ordenes_compra);
    const ordenesCompraItems = toArrayMaybe(bloque.ordenes_compra_items);
    const proveedores = toArrayMaybe(bloque.proveedores);
    const listaPreciosOrdenes = toArrayMaybe(bloque.lista_precios_ordenes);
    const historialListaPreciosOrdenes = toArrayMaybe(bloque.historial_lista_precios_ordenes);

    await dbRunAsync(bdInventario, "DELETE FROM historial_lista_precios_ordenes");
    await dbRunAsync(bdInventario, "DELETE FROM lista_precios_ordenes");
    await dbRunAsync(bdInventario, "DELETE FROM ordenes_compra_items");
    await dbRunAsync(bdInventario, "DELETE FROM ordenes_compra");
    await dbRunAsync(bdInventario, "DELETE FROM historial_inventario");
    await dbRunAsync(bdInventario, "DELETE FROM historial_utensilios");
    await dbRunAsync(bdInventario, "DELETE FROM inversion_recuperada");
    await dbRunAsync(bdInventario, "DELETE FROM recuperado_utensilios");
    await dbRunAsync(bdInventario, "DELETE FROM insumos_eliminados");
    await dbRunAsync(bdInventario, "DELETE FROM inventario");
    await dbRunAsync(bdInventario, "DELETE FROM utensilios");
    await dbRunAsync(bdInventario, "DELETE FROM proveedores");

    for (const row of proveedores) {
      await dbRunAsync(
        bdInventario,
        `INSERT INTO proveedores (id, nombre, direccion, telefono, forma_pago, numero_cuenta, correo, notas, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.nombre || '',
          row.direccion || '',
          row.telefono || '',
          row.forma_pago || '',
          row.numero_cuenta || '',
          row.correo || '',
          row.notas || '',
          row.creado_en || new Date().toISOString(),
          row.actualizado_en || new Date().toISOString()
        ]
      );
    }

    for (const row of inventario) {
      await dbRunAsync(
        bdInventario,
        `INSERT INTO inventario (id, codigo, nombre, proveedor, unidad, cantidad_total, cantidad_disponible, costo_total, costo_por_unidad, pendiente)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.codigo || '',
          row.nombre || '',
          row.proveedor || '',
          row.unidad || '',
          Number(row.cantidad_total || 0),
          Number(row.cantidad_disponible || 0),
          Number(row.costo_total || 0),
          Number(row.costo_por_unidad || 0),
          Number(row.pendiente || 0) ? 1 : 0
        ]
      );
    }

    for (const row of utensilios) {
      await dbRunAsync(
        bdInventario,
        `INSERT INTO utensilios (id, codigo, nombre, proveedor, unidad, cantidad_total, costo_total, costo_por_unidad)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.codigo || '',
          row.nombre || '',
          row.proveedor || '',
          row.unidad || '',
          Number(row.cantidad_total || 0),
          Number(row.costo_total || 0),
          Number(row.costo_por_unidad || 0)
        ]
      );
    }

    for (const row of historialInventario) {
      await dbRunAsync(
        bdInventario,
        `INSERT INTO historial_inventario (id, id_inventario, fecha_cambio, cambio_cantidad, cambio_costo)
         VALUES (?, ?, ?, ?, ?)`,
        [row.id, row.id_inventario, row.fecha_cambio, Number(row.cambio_cantidad || 0), Number(row.cambio_costo || 0)]
      );
    }

    for (const row of historialUtensilios) {
      await dbRunAsync(
        bdInventario,
        `INSERT INTO historial_utensilios (id, id_utensilio, fecha_cambio, cambio_cantidad, cambio_costo)
         VALUES (?, ?, ?, ?, ?)`,
        [row.id, row.id_utensilio, row.fecha_cambio, Number(row.cambio_cantidad || 0), Number(row.cambio_costo || 0)]
      );
    }

    for (const row of inversionRecuperada) {
      await dbRunAsync(
        bdInventario,
        `INSERT INTO inversion_recuperada (id, fecha_venta, costo_recuperado)
         VALUES (?, ?, ?)`,
        [row.id, row.fecha_venta, Number(row.costo_recuperado || 0)]
      );
    }

    for (const row of recuperadoUtensilios) {
      await dbRunAsync(
        bdInventario,
        `INSERT INTO recuperado_utensilios (id, fecha_recuperado, monto_recuperado)
         VALUES (?, ?, ?)`,
        [row.id, row.fecha_recuperado, Number(row.monto_recuperado || 0)]
      );
    }

    for (const row of insumosEliminados) {
      await dbRunAsync(
        bdInventario,
        `INSERT INTO insumos_eliminados (id_inventario, codigo, nombre, unidad, eliminado_en)
         VALUES (?, ?, ?, ?, ?)`,
        [row.id_inventario, row.codigo || '', row.nombre || '', row.unidad || '', row.eliminado_en || new Date().toISOString()]
      );
    }

    for (const row of ordenesCompra) {
      await dbRunAsync(
        bdInventario,
        `INSERT INTO ordenes_compra (id, numero_orden, proveedor, fecha_creacion, estado, fecha_surtida)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.numero_orden || '',
          row.proveedor || '',
          row.fecha_creacion || new Date().toISOString(),
          row.estado || 'pendiente',
          row.fecha_surtida || null
        ]
      );
    }

    for (const row of ordenesCompraItems) {
      await dbRunAsync(
        bdInventario,
        `INSERT INTO ordenes_compra_items
         (id, id_orden, tipo_item, id_inventario, id_utensilio, codigo, nombre, cantidad_requerida, cantidad_surtida, precio_unitario, costo_total_surtido, surtido)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.id_orden,
          row.tipo_item || 'insumo',
          row.id_inventario ?? null,
          row.id_utensilio ?? null,
          row.codigo || '',
          row.nombre || '',
          Number(row.cantidad_requerida || 0),
          Number(row.cantidad_surtida || 0),
          Number(row.precio_unitario || 0),
          Number(row.costo_total_surtido || 0),
          Number(row.surtido || 0) ? 1 : 0
        ]
      );
    }

    for (const row of listaPreciosOrdenes) {
      await dbRunAsync(
        bdInventario,
        `INSERT INTO lista_precios_ordenes
         (id, tipo_item, id_referencia, codigo, nombre, proveedor, unidad, cantidad_referencia, precio_unitario, costo_total_referencia, vigente_desde, vigente_hasta, ultima_compra_en, activo, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.tipo_item || 'insumo',
          row.id_referencia ?? null,
          row.codigo || '',
          row.nombre || '',
          row.proveedor || '',
          row.unidad || '',
          Number(row.cantidad_referencia || 0),
          Number(row.precio_unitario || 0),
          Number(row.costo_total_referencia || 0),
          row.vigente_desde || null,
          row.vigente_hasta || null,
          row.ultima_compra_en || null,
          Number(row.activo || 0) ? 1 : 0,
          row.creado_en || new Date().toISOString(),
          row.actualizado_en || new Date().toISOString()
        ]
      );
    }

    for (const row of historialListaPreciosOrdenes) {
      await dbRunAsync(
        bdInventario,
        `INSERT INTO historial_lista_precios_ordenes
         (id, id_lista_precio, precio_unitario, costo_total_referencia, vigente_desde, vigente_hasta, motivo, registrado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.id_lista_precio,
          Number(row.precio_unitario || 0),
          Number(row.costo_total_referencia || 0),
          row.vigente_desde || null,
          row.vigente_hasta || null,
          row.motivo || '',
          row.registrado_en || new Date().toISOString()
        ]
      );
    }

    res.json({
      exito: true,
      mensaje: "Inventario completo importado",
      importados: {
        inventario: inventario.length,
        historial_inventario: historialInventario.length,
        insumos_eliminados: insumosEliminados.length,
        inversion_recuperada: inversionRecuperada.length,
        utensilios: utensilios.length,
        historial_utensilios: historialUtensilios.length,
        recuperado_utensilios: recuperadoUtensilios.length,
        ordenes_compra: ordenesCompra.length,
        ordenes_compra_items: ordenesCompraItems.length,
        proveedores: proveedores.length,
        lista_precios_ordenes: listaPreciosOrdenes.length,
        historial_lista_precios_ordenes: historialListaPreciosOrdenes.length
      }
    });
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: "Error al importar inventario: " + error.message });
  }
});

// Importar datos de utensilios
app.post("/api/importar/utensilios", async (req, res) => {
  const { datos } = req.body;

  try {
    // Compatibilidad hacia atrás: arreglo simple de utensilios
    if (Array.isArray(datos)) {
      let importados = 0;
      for (const item of datos) {
        await dbRunAsync(
          bdInventario,
          `INSERT INTO utensilios (codigo, nombre, proveedor, unidad, cantidad_total, costo_total, costo_por_unidad)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(codigo) DO UPDATE SET
             nombre=excluded.nombre,
             proveedor=excluded.proveedor,
             unidad=excluded.unidad,
             cantidad_total=excluded.cantidad_total,
             costo_total=excluded.costo_total,
             costo_por_unidad=excluded.costo_por_unidad`,
          [
            item.codigo,
            item.nombre,
            item.proveedor || '',
            item.unidad,
            item.cantidad_total,
            item.costo_total,
            item.costo_por_unidad
          ]
        );
        importados += 1;
      }
      return res.json({ exito: true, mensaje: "Utensilios importados", importados });
    }

    const bloque = (datos && typeof datos === 'object') ? datos : null;
    if (!bloque) {
      return res.status(400).json({ exito: false, mensaje: "Formato de datos inválido" });
    }

    const utensilios = toArrayMaybe(bloque.utensilios);
    const historialUtensilios = toArrayMaybe(bloque.historial_utensilios);
    const recuperadoUtensilios = toArrayMaybe(bloque.recuperado_utensilios);

    await dbRunAsync(bdInventario, "DELETE FROM historial_utensilios");
    await dbRunAsync(bdInventario, "DELETE FROM recuperado_utensilios");
    await dbRunAsync(bdInventario, "DELETE FROM utensilios");

    for (const row of utensilios) {
      await dbRunAsync(
        bdInventario,
        `INSERT INTO utensilios (id, codigo, nombre, proveedor, unidad, cantidad_total, costo_total, costo_por_unidad)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.codigo || '',
          row.nombre || '',
          row.proveedor || '',
          row.unidad || '',
          Number(row.cantidad_total || 0),
          Number(row.costo_total || 0),
          Number(row.costo_por_unidad || 0)
        ]
      );
    }

    for (const row of historialUtensilios) {
      await dbRunAsync(
        bdInventario,
        `INSERT INTO historial_utensilios (id, id_utensilio, fecha_cambio, cambio_cantidad, cambio_costo)
         VALUES (?, ?, ?, ?, ?)`,
        [row.id, row.id_utensilio, row.fecha_cambio, Number(row.cambio_cantidad || 0), Number(row.cambio_costo || 0)]
      );
    }

    for (const row of recuperadoUtensilios) {
      await dbRunAsync(
        bdInventario,
        `INSERT INTO recuperado_utensilios (id, fecha_recuperado, monto_recuperado)
         VALUES (?, ?, ?)`,
        [row.id, row.fecha_recuperado, Number(row.monto_recuperado || 0)]
      );
    }

    res.json({
      exito: true,
      mensaje: "Utensilios importados",
      importados: {
        utensilios: utensilios.length,
        historial_utensilios: historialUtensilios.length,
        recuperado_utensilios: recuperadoUtensilios.length
      }
    });
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: "Error al importar utensilios: " + error.message });
  }
});

// Importar datos de recetas
app.post("/api/importar/recetas", async (req, res) => {
  const { datos } = req.body;
  
  if (!datos || !datos.categorias || !datos.recetas) {
    return res.status(400).json({ exito: false, mensaje: "Formato de datos inválido" });
  }
  
  try {
    let importados = { categorias: 0, recetas: 0, ingredientes: 0 };
    
    // Importar categorías
    for (const cat of datos.categorias) {
      await new Promise((resolve, reject) => {
        bdRecetas.run(
          `INSERT INTO categorias (id, nombre) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre`,
          [cat.id, cat.nombre],
          (err) => {
            if (err) reject(err);
            else {
              importados.categorias++;
              resolve();
            }
          }
        );
      });
    }
    
    // Importar recetas
    for (const rec of datos.recetas) {
      await new Promise((resolve, reject) => {
        bdRecetas.run(
          `INSERT INTO recetas (id, nombre, id_categoria, gramaje) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, id_categoria=excluded.id_categoria, gramaje=excluded.gramaje`,
          [rec.id, rec.nombre, rec.id_categoria, rec.gramaje || 0],
          (err) => {
            if (err) reject(err);
            else {
              importados.recetas++;
              resolve();
            }
          }
        );
      });
    }
    
    // Importar ingredientes
    if (datos.ingredientes) {
      for (const ing of datos.ingredientes) {
        await new Promise((resolve, reject) => {
          bdRecetas.run(
            `INSERT INTO ingredientes_receta (id, id_receta, id_insumo, cantidad, unidad) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET id_receta=excluded.id_receta, id_insumo=excluded.id_insumo, cantidad=excluded.cantidad, unidad=excluded.unidad`,
            [ing.id, ing.id_receta, ing.id_insumo, ing.cantidad, ing.unidad],
            (err) => {
              if (err) reject(err);
              else {
                importados.ingredientes++;
                resolve();
              }
            }
          );
        });
      }
    }
    
    res.json({ exito: true, mensaje: "Recetas importadas", importados });
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: "Error al importar recetas: " + error.message });
  }
});

// Importar datos de producción
app.post("/api/importar/produccion", async (req, res) => {
  const { datos } = req.body;
  
  if (!Array.isArray(datos)) {
    return res.status(400).json({ exito: false, mensaje: "Formato de datos inválido" });
  }
  
  try {
    let importados = 0;
    
    for (const item of datos) {
      await new Promise((resolve, reject) => {
        bdProduccion.run(
          `INSERT INTO produccion (id, nombre_receta, cantidad, fecha_produccion, costo_produccion, precio_venta)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
           nombre_receta=excluded.nombre_receta, cantidad=excluded.cantidad, fecha_produccion=excluded.fecha_produccion,
           costo_produccion=excluded.costo_produccion, precio_venta=excluded.precio_venta`,
          [item.id, item.nombre_receta, item.cantidad, item.fecha_produccion, item.costo_produccion, item.precio_venta],
          (err) => {
            if (err) reject(err);
            else {
              importados++;
              resolve();
            }
          }
        );
      });
    }
    
    res.json({ exito: true, mensaje: "Producción importada", importados });
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: "Error al importar producción: " + error.message });
  }
});

// Importar datos de ventas
app.post("/api/importar/ventas", async (req, res) => {
  const payload = req.body;

  const normalizarLista = (valor) => (Array.isArray(valor) ? valor : []);
  const idValido = (valor) => Number.isFinite(Number(valor)) && Number(valor) > 0;

  const recogerListasVentas = (origen) => {
    if (!origen || typeof origen !== 'object') return { ventas: [], cortesias: [] };

    const ventas = [
      normalizarLista(origen.ventas),
      normalizarLista(origen.datos),
      normalizarLista(origen?.datos?.ventas)
    ].find((arr) => arr.length > 0) || [];

    const cortesias = [
      normalizarLista(origen.cortesias),
      normalizarLista(origen?.datos?.cortesias)
    ].find((arr) => arr.length > 0) || [];

    return { ventas, cortesias };
  };

  let ventasDatos = [];
  let cortesiasDatos = [];

  if (Array.isArray(payload)) {
    ventasDatos = payload;
  } else if (payload && typeof payload === 'object') {
    const listas = recogerListasVentas(payload);
    ventasDatos = listas.ventas;
    cortesiasDatos = listas.cortesias;

    // Compatibilidad para archivos anidados con llaves como "contenido" o "backup".
    if (!ventasDatos.length && !cortesiasDatos.length) {
      const listasContenido = recogerListasVentas(payload.contenido);
      ventasDatos = listasContenido.ventas;
      cortesiasDatos = listasContenido.cortesias;
    }
    if (!ventasDatos.length && !cortesiasDatos.length) {
      const listasBackup = recogerListasVentas(payload.backup);
      ventasDatos = listasBackup.ventas;
      cortesiasDatos = listasBackup.cortesias;
    }
  }

  if (!ventasDatos.length && !cortesiasDatos.length) {
    return res.status(400).json({ exito: false, mensaje: "Formato de datos inválido" });
  }

  try {
    let importadosVentas = 0;
    let importadosCortesias = 0;

    for (const item of ventasDatos) {
      const cantidad = Number(item.cantidad) || Number(item.cantidad_vendida) || 0;
      const costoProduccion = Number(item.costo_produccion) || Number(item.costo_unitario) || 0;
      const precioVenta = Number(item.precio_venta) || Number(item.precio_venta_unitario) || 0;
      const ganancia = (typeof item.ganancia !== 'undefined')
        ? Number(item.ganancia) || 0
        : ((precioVenta * cantidad) - costoProduccion);

      const nombreReceta = item.nombre_receta || item.pedido || item.id_orden || 'Sin receta';
      const fechaProduccion = item.fecha_produccion || item.fecha_venta || new Date().toISOString();
      const fechaVenta = item.fecha_venta || new Date().toISOString();
      const numeroPedido = item.numero_pedido || item.pedido || '';

      if (idValido(item.id)) {
        await dbRunAsync(
          bdVentas,
          `INSERT INTO ventas (id, nombre_receta, cantidad, fecha_produccion, fecha_venta, costo_produccion, precio_venta, ganancia, numero_pedido)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             nombre_receta=excluded.nombre_receta,
             cantidad=excluded.cantidad,
             fecha_produccion=excluded.fecha_produccion,
             fecha_venta=excluded.fecha_venta,
             costo_produccion=excluded.costo_produccion,
             precio_venta=excluded.precio_venta,
             ganancia=excluded.ganancia,
             numero_pedido=excluded.numero_pedido`,
          [Number(item.id), nombreReceta, cantidad, fechaProduccion, fechaVenta, costoProduccion, precioVenta, ganancia, numeroPedido]
        );
      } else {
        await dbRunAsync(
          bdVentas,
          `INSERT INTO ventas (nombre_receta, cantidad, fecha_produccion, fecha_venta, costo_produccion, precio_venta, ganancia, numero_pedido)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [nombreReceta, cantidad, fechaProduccion, fechaVenta, costoProduccion, precioVenta, ganancia, numeroPedido]
        );
      }

      importadosVentas += 1;
    }

    for (const item of cortesiasDatos) {
      const cantidad = Number(item.cantidad) || Number(item.cantidad_vendida) || 0;
      const nombreReceta = item.nombre_receta || item.pedido || 'Sin receta';
      const fechaCortesia = item.fecha_cortesia || item.fecha_venta || new Date().toISOString();
      const numeroPedido = item.numero_pedido || item.pedido || '';
      const motivo = item.motivo || '';
      const paraQuien = item.para_quien || '';

      if (idValido(item.id)) {
        await dbRunAsync(
          bdVentas,
          `INSERT INTO cortesias (id, nombre_receta, cantidad, fecha_cortesia, numero_pedido, motivo, para_quien)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             nombre_receta=excluded.nombre_receta,
             cantidad=excluded.cantidad,
             fecha_cortesia=excluded.fecha_cortesia,
             numero_pedido=excluded.numero_pedido,
             motivo=excluded.motivo,
             para_quien=excluded.para_quien`,
          [Number(item.id), nombreReceta, cantidad, fechaCortesia, numeroPedido, motivo, paraQuien]
        );
      } else {
        await dbRunAsync(
          bdVentas,
          `INSERT INTO cortesias (nombre_receta, cantidad, fecha_cortesia, numero_pedido, motivo, para_quien)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [nombreReceta, cantidad, fechaCortesia, numeroPedido, motivo, paraQuien]
        );
      }

      importadosCortesias += 1;
    }

    res.json({
      exito: true,
      mensaje: 'Ventas y cortesias importadas',
      importados: {
        ventas: importadosVentas,
        cortesias: importadosCortesias
      }
    });
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: "Error al importar ventas: " + error.message });
  }
});

// Importar datos de cortesias
app.post('/api/importar/cortesias', async (req, res) => {
  const payload = req.body;

  const idValido = (valor) => Number.isFinite(Number(valor)) && Number(valor) > 0;

  let cortesiasDatos = [];
  if (Array.isArray(payload)) {
    cortesiasDatos = payload;
  } else if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.cortesias)) {
      cortesiasDatos = payload.cortesias;
    } else if (Array.isArray(payload.datos)) {
      cortesiasDatos = payload.datos;
    }
  }

  if (!Array.isArray(cortesiasDatos)) {
    return res.status(400).json({ exito: false, mensaje: 'Formato de datos inválido' });
  }

  try {
    let importados = 0;
    for (const item of cortesiasDatos) {
      const cantidad = Number(item.cantidad) || Number(item.cantidad_vendida) || 0;

      const nombreReceta = item.nombre_receta || item.pedido || 'Sin receta';
      const fechaCortesia = item.fecha_cortesia || item.fecha_venta || new Date().toISOString();
      const numeroPedido = item.numero_pedido || item.pedido || '';
      const motivo = item.motivo || '';
      const paraQuien = item.para_quien || '';

      if (idValido(item.id)) {
        await dbRunAsync(
          bdVentas,
          `INSERT INTO cortesias (id, nombre_receta, cantidad, fecha_cortesia, numero_pedido, motivo, para_quien)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             nombre_receta=excluded.nombre_receta,
             cantidad=excluded.cantidad,
             fecha_cortesia=excluded.fecha_cortesia,
             numero_pedido=excluded.numero_pedido,
             motivo=excluded.motivo,
             para_quien=excluded.para_quien`,
          [Number(item.id), nombreReceta, cantidad, fechaCortesia, numeroPedido, motivo, paraQuien]
        );
      } else {
        await dbRunAsync(
          bdVentas,
          `INSERT INTO cortesias (nombre_receta, cantidad, fecha_cortesia, numero_pedido, motivo, para_quien)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [nombreReceta, cantidad, fechaCortesia, numeroPedido, motivo, paraQuien]
        );
      }

      importados += 1;
    }

    res.json({ exito: true, mensaje: 'Cortesias importadas', importados });
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: 'Error al importar cortesias: ' + error.message });
  }
});

// Servir frontend
if (usarBuildReact && frontendPath) {
  // Manejar explícitamente las rutas raíz y /index.html
  app.get(['/', '/index.html'], async (req, res) => {
    const indexHtml = path.join(frontendPath, "index.html");
    try {
      await fs.access(indexHtml);
      return res.sendFile(indexHtml);
    } catch (err) {
      return res.status(500).send('Error interno: index.html no accesible en la build de React.');
    }
  });

  // Servir archivos estáticos de la build
  app.use(express.static(frontendPath));

  // Fallback SPA: cualquier otra ruta devuelve index.html de la build
  app.use((req, res) => {
    const indexHtml = path.join(frontendPath, "index.html");
    res.sendFile(indexHtml);
  });
} else {
  if (esProduccion || enRender) {
    app.get('*', (req, res) => {
      res.status(500).send('Build de React no disponible en producción. Verifique frontend/dist y configuración de Render.');
    });
  } else {
  // No hay build de React: intentar proxy a Vite dev server (http://localhost:5173)
  // Esto permite trabajar en modo desarrollo sin generar la build.
  const VITE_HOST = process.env.VITE_DEV_HOST || 'localhost';
  const VITE_PORT = Number(process.env.VITE_DEV_PORT || 3000);
  const prefijosBackend = [
    '/api',
    '/inventario',
    '/recetas',
    '/categorias',
    '/produccion',
    '/ventas',
    '/cortesias',
    '/cortesia',
    '/utensilios',
    '/backup',
    '/tienda',
    '/visitas',
    '/uploads'
  ];

  function esRutaBackend(pathname = '') {
    const ruta = String(pathname || '').toLowerCase();
    return prefijosBackend.some((prefijo) => ruta.startsWith(prefijo));
  }

  function proxyToVite(req, res) {
    // No proxyar endpoints de backend ni métodos distintos a GET/HEAD.
    const metodo = String(req.method || 'GET').toUpperCase();
    if (esRutaBackend(req.path) || (metodo !== 'GET' && metodo !== 'HEAD')) {
      res.status(404).send('Ruta API no encontrada');
      return;
    }

    const options = {
      hostname: VITE_HOST,
      port: VITE_PORT,
      path: req.originalUrl || req.url,
      method: req.method,
      headers: req.headers
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', () => {
      res.status(503).send(
        'Vite dev server no disponible. Inicie el dev server para desarrollo:\n' +
        '`cd frontend && npm install && npm run dev`'
      );
    });

    req.pipe(proxyReq, { end: true });
  }

  // Root and index: proxy to vite
  app.get(['/', '/index.html'], (req, res) => proxyToVite(req, res));

  // Proxy todas las demás rutas que no comiencen con /api
  app.use((req, res, next) => {
    if (esRutaBackend(req.path)) return next();
    proxyToVite(req, res);
  });
  }
}

// Iniciar servidor
const PUERTO = process.env.PORT || 3001;
servidor.listen(PUERTO, "0.0.0.0", () => {
  const interfaces = os.networkInterfaces();
  let ipLocal = "localhost";
  
  for (const name of Object.keys(interfaces)) {
    const ifaces = interfaces[name];
    for (const iface of ifaces) {
      if (iface.family === "IPv4" && !iface.internal) {
        ipLocal = iface.address;
        break;
      }
    }
    if (ipLocal !== "localhost") break;
  }
  
  console.log(`\n✅ Servidor ejecutándose en puerto ${PUERTO}`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`🌍 Aplicación en producción`);
    // Activar sistema de backups automáticos en producción
    programarBackupsAutomaticos();
  } else {
    console.log(`📱 Acceso local: http://localhost:${PUERTO}`);
    console.log(`🌐 Acceso remoto: http://${ipLocal}:${PUERTO}`);
    console.log(`\nPara conectarte desde otro dispositivo en la red, usa la IP: ${ipLocal}\n`);
  }
});
