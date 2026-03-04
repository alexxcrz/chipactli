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
const usarBuildReact = process.env.NODE_ENV === 'production' && hasReactBuild;

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

// Configuración de directorios para las bases de datos
// En Render, usar el volumen persistente. En local, usar el directorio actual
const dbDir = process.env.NODE_ENV === 'production' ? '/opt/render/data/backend' : __dirname;
const uploadsDir = path.join(dbDir, 'uploads');

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

// Exportar datos de inventario
app.get("/api/exportar/inventario", (req, res) => {
  bdInventario.all("SELECT * FROM inventario", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ exito: false, mensaje: "Error al exportar inventario" });
    }
    res.json({ tipo: "inventario", datos: rows, total: rows.length });
  });
});

// Exportar datos de utensilios
app.get("/api/exportar/utensilios", (req, res) => {
  bdInventario.all("SELECT * FROM utensilios", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ exito: false, mensaje: "Error al exportar utensilios" });
    }
    res.json({ tipo: "utensilios", datos: rows, total: rows.length });
  });
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

// Exportar datos de ventas
app.get("/api/exportar/ventas", (req, res) => {
  bdVentas.all("SELECT * FROM ventas", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ exito: false, mensaje: "Error al exportar ventas" });
    }
    res.json({ tipo: "ventas", datos: rows, total: rows.length });
  });
});

// Importar datos de inventario
app.post("/api/importar/inventario", async (req, res) => {
  const { datos } = req.body;
  
  if (!Array.isArray(datos)) {
    return res.status(400).json({ exito: false, mensaje: "Formato de datos inválido" });
  }
  
  try {
    let importados = 0;
    
    for (const item of datos) {
      await new Promise((resolve, reject) => {
        bdInventario.run(
          `INSERT INTO inventario (codigo, nombre, unidad, cantidad_total, cantidad_disponible, costo_total, costo_por_unidad)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(codigo) DO UPDATE SET
           nombre=excluded.nombre, unidad=excluded.unidad, cantidad_total=excluded.cantidad_total,
           cantidad_disponible=excluded.cantidad_disponible, costo_total=excluded.costo_total,
           costo_por_unidad=excluded.costo_por_unidad`,
          [item.codigo, item.nombre, item.unidad, item.cantidad_total, item.cantidad_disponible, item.costo_total, item.costo_por_unidad],
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
    
    res.json({ exito: true, mensaje: "Inventario importado", importados });
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: "Error al importar inventario: " + error.message });
  }
});

// Importar datos de utensilios
app.post("/api/importar/utensilios", async (req, res) => {
  const { datos } = req.body;
  
  if (!Array.isArray(datos)) {
    return res.status(400).json({ exito: false, mensaje: "Formato de datos inválido" });
  }
  
  try {
    let importados = 0;
    
    for (const item of datos) {
      await new Promise((resolve, reject) => {
        bdInventario.run(
          `INSERT INTO utensilios (codigo, nombre, unidad, cantidad_total, costo_total, costo_por_unidad)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(codigo) DO UPDATE SET
           nombre=excluded.nombre, unidad=excluded.unidad, cantidad_total=excluded.cantidad_total,
           costo_total=excluded.costo_total, costo_por_unidad=excluded.costo_por_unidad`,
          [item.codigo, item.nombre, item.unidad, item.cantidad_total, item.costo_total, item.costo_por_unidad],
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
    
    res.json({ exito: true, mensaje: "Utensilios importados", importados });
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
  const { datos } = req.body;
  
  if (!Array.isArray(datos)) {
    return res.status(400).json({ exito: false, mensaje: "Formato de datos inválido" });
  }
  
  try {
    let importados = 0;
    
    for (const item of datos) {
      await new Promise((resolve, reject) => {
        bdVentas.run(
          `INSERT INTO ventas (id, id_orden, cantidad_vendida, precio_venta_unitario, costo_unitario, ganancia_unitaria, ganancia_total, fecha_venta, es_cortesia, pedido)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
           id_orden=excluded.id_orden, cantidad_vendida=excluded.cantidad_vendida, precio_venta_unitario=excluded.precio_venta_unitario,
           costo_unitario=excluded.costo_unitario, ganancia_unitaria=excluded.ganancia_unitaria, ganancia_total=excluded.ganancia_total,
           fecha_venta=excluded.fecha_venta, es_cortesia=excluded.es_cortesia, pedido=excluded.pedido`,
          [item.id, item.id_orden, item.cantidad_vendida, item.precio_venta_unitario, item.costo_unitario, item.ganancia_unitaria, item.ganancia_total, item.fecha_venta, item.es_cortesia, item.pedido],
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
    
    res.json({ exito: true, mensaje: "Ventas importadas", importados });
  } catch (error) {
    res.status(500).json({ exito: false, mensaje: "Error al importar ventas: " + error.message });
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
