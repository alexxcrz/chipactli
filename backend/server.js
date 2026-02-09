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
