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
import multer from "multer";

// Importar utilidades
import { inicializarWss } from "./utils/transmitir.js";
import { inicializarBds } from "./utils/db-init.js";
import { programarBackupsAutomaticos, crearBackup, listarBackups, restaurarBackup } from "./utils/backup.js";

// Importar rutas
import { registrarRutasInventario } from "./routes/inventario.js";
import { registrarRutasCategorias } from "./routes/categorias.js";
import { registrarRutasRecetas } from "./routes/recetas.js";
import { registrarRutasProduccion } from "./routes/produccion.js";
import { registrarRutasCortesias } from "./routes/cortesias.js";
import { registrarRutasVentas } from "./routes/ventas.js";
import { registrarRutasUtensilios } from "./routes/utensilios.js";

// Configuración básica
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendPath = path.join(__dirname, "../frontend");

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

// Inicializar bases de datos
const bdInventario = new Database("./inventario.db");
const bdRecetas = new Database("./recetas.db");
const bdProduccion = new Database("./produccion.db");
const bdVentas = new Database("./ventas.db");

inicializarBds(bdInventario, bdRecetas, bdProduccion, bdVentas);

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
registrarRutasInventario(app, bdInventario);
registrarRutasUtensilios(app, bdInventario);
registrarRutasCategorias(app, bdRecetas);
registrarRutasRecetas(app, bdRecetas, bdInventario);
registrarRutasProduccion(app, bdProduccion, bdRecetas, bdInventario);
registrarRutasCortesias(app, bdVentas, bdProduccion);
registrarRutasVentas(app, bdVentas, bdProduccion, bdInventario, bdRecetas);

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
  const archivosPermitidos = ['inventario', 'recetas', 'produccion', 'ventas'];
  
  if (!archivosPermitidos.includes(nombre)) {
    return res.status(400).json({ exito: false, mensaje: "Base de datos no válida" });
  }
  
  const rutaArchivo = path.join(__dirname, `${nombre}.db`);
  
  if (!await fs.access(rutaArchivo).then(() => true).catch(() => false)) {
    return res.status(404).json({ exito: false, mensaje: "Archivo no encontrado" });
  }
  
  res.download(rutaArchivo, `${nombre}.db`);
});

app.post("/api/backup/importar", upload.fields([
  { name: 'inventario', maxCount: 1 },
  { name: 'recetas', maxCount: 1 },
  { name: 'produccion', maxCount: 1 },
  { name: 'ventas', maxCount: 1 }
]), async (req, res) => {
  if (!validarAdmin(req, res)) return;

  const mapaArchivos = {
    inventario: "inventario.db",
    recetas: "recetas.db",
    produccion: "produccion.db",
    ventas: "ventas.db"
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

    for (const [clave, nombreArchivo] of Object.entries(mapaArchivos)) {
      if (!req.files[clave]) continue;
      const archivo = req.files[clave][0];
      const destino = path.join(__dirname, nombreArchivo);
      await fs.writeFile(destino, archivo.buffer);
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
      
      bdRecetas.all("SELECT * FROM ingredientes", [], (err, ingredientes) => {
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
  bdProduccion.all("SELECT * FROM ordenes_produccion", [], (err, rows) => {
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
          `INSERT INTO recetas (id, nombre, precio_venta, id_categoria) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, precio_venta=excluded.precio_venta, id_categoria=excluded.id_categoria`,
          [rec.id, rec.nombre, rec.precio_venta, rec.id_categoria],
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
            `INSERT INTO ingredientes (id, id_receta, codigo_insumo, cantidad_requerida) VALUES (?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET id_receta=excluded.id_receta, codigo_insumo=excluded.codigo_insumo, cantidad_requerida=excluded.cantidad_requerida`,
            [ing.id, ing.id_receta, ing.codigo_insumo, ing.cantidad_requerida],
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
          `INSERT INTO ordenes_produccion (id, id_receta, cantidad, costo_total, precio_venta, ganancia, fecha_produccion)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
           id_receta=excluded.id_receta, cantidad=excluded.cantidad, costo_total=excluded.costo_total,
           precio_venta=excluded.precio_venta, ganancia=excluded.ganancia, fecha_produccion=excluded.fecha_produccion`,
          [item.id, item.id_receta, item.cantidad, item.costo_total, item.precio_venta, item.ganancia, item.fecha_produccion],
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
app.use(express.static(frontendPath));

app.use((req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

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
