import express from "express";
import pkg from "sqlite3";
const { Database } = pkg;
import cors from "cors";
import { WebSocketServer } from "ws";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

// Importar utilidades
import { inicializarWss } from "./utils/transmitir.js";
import { inicializarBds } from "./utils/db-init.js";

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
app.use(express.json());

// Inicializar bases de datos
const bdInventario = new Database("./inventario.db");
const bdRecetas = new Database("./recetas.db");
const bdProduccion = new Database("./produccion.db");
const bdVentas = new Database("./ventas.db");

inicializarBds(bdInventario, bdRecetas, bdProduccion, bdVentas);

// Registrar rutas
registrarRutasInventario(app, bdInventario);
registrarRutasUtensilios(app, bdInventario);
registrarRutasCategorias(app, bdRecetas);
registrarRutasRecetas(app, bdRecetas, bdInventario);
registrarRutasProduccion(app, bdProduccion, bdRecetas, bdInventario);
registrarRutasCortesias(app, bdVentas, bdProduccion);
registrarRutasVentas(app, bdVentas, bdProduccion, bdInventario, bdRecetas);

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
  } else {
    console.log(`📱 Acceso local: http://localhost:${PUERTO}`);
    console.log(`🌐 Acceso remoto: http://${ipLocal}:${PUERTO}`);
    console.log(`\nPara conectarte desde otro dispositivo en la red, usa la IP: ${ipLocal}\n`);
  }
});
