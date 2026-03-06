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

// Inicializar WebSocket
inicializarWss(wss);

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));

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

const dbDir = process.env.DB_DIR
  ? path.resolve(process.env.DB_DIR)
  : ((ejecutandoEnRender || discoRenderDisponible) ? '/opt/render/data/backend' : __dirname);
const uploadsDir = path.join(dbDir, 'uploads');

console.log('[DB] NODE_ENV=', process.env.NODE_ENV || '(vacío)');
console.log('[DB] Render detectado=', ejecutandoEnRender ? 'sí' : 'no');
console.log('[DB] Disco Render detectado=', discoRenderDisponible ? 'sí' : 'no');
console.log('[DB] DB_DIR efectivo=', dbDir);

configurarBackup({
  dbDir,
  backupDir: path.join(dbDir, 'backups'),
  maxBackups: 5,
});

// Crear directorio de bases de datos si no existe
// ...existing code...
await fs.mkdir(dbDir, { recursive: true });
await fs.mkdir(path.join(uploadsDir, 'tienda'), { recursive: true });

app.use('/uploads', express.static(uploadsDir));

// Inicializar bases de datos
const bdInventario = new Database(path.join(dbDir, "inventario.db"));
const bdRecetas = new Database(path.join(dbDir, "recetas.db"));
const bdProduccion = new Database(path.join(dbDir, "produccion.db"));
const bdVentas = new Database(path.join(dbDir, "ventas.db"));
const bdAdmin = new Database(path.join(dbDir, "admin.db"));

inicializarBds(bdInventario, bdRecetas, bdProduccion, bdVentas);
inicializarBdAdmin(bdAdmin, bdInventario);

// Registrar rutas de autenticación
registrarRutasAuth(app, bdAdmin);

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
  { metodos: ['POST'], exacto: '/tienda/catalogo/upsert', pestana: 'ventas', accion: 'editar' },
  { metodos: ['GET'], prefijo: '/tienda/admin', pestana: 'ventas', accion: 'ver' },
  { metodos: ['POST', 'PATCH', 'DELETE'], prefijo: '/tienda/admin', pestana: 'ventas', accion: 'editar' }
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

    const base = `${req.protocol}://${req.get('host')}`;
    return res.json({ ok: true, url: `${base}/uploads/tienda/${nombre}` });
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

    const base = `${req.protocol}://${req.get('host')}`;
    return res.json({
      ok: true,
      url: `${base}/uploads/tienda/${nombre}`,
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
registrarRutasUsuarios(app, bdAdmin);
registrarRutasInventario(app, bdInventario);
registrarRutasUtensilios(app, bdInventario);
registrarRutasCategorias(app, bdRecetas);
registrarRutasRecetas(app, bdRecetas, bdInventario);
registrarRutasProduccion(app, bdProduccion, bdRecetas, bdInventario);
registrarRutasCortesias(app, bdVentas, bdProduccion);
registrarRutasVentas(app, bdVentas, bdProduccion, bdInventario, bdRecetas);
registrarRutasTienda(app, bdProduccion, bdRecetas, bdVentas, bdInventario);

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

    return res.json({
      exito: true,
      db_dir: dbDir,
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

  function proxyToVite(req, res) {
    // No proxyar rutas de API
    if (req.path && req.path.startsWith('/api')) {
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
    if (req.path && req.path.startsWith('/api')) return next();
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
