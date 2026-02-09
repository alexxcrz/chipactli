import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const token = "chipactli-admin-2026-seguro";
const baseUrl = "https://chipactli.onrender.com";
const backendPath = path.join(__dirname, "backend");

console.log("=== Importación de Bases de Datos a Chipactli ===\n");
console.log("Validando archivos...");

// Validar archivos
const archivos = ["inventario.db", "recetas.db", "produccion.db", "ventas.db"];
for (const archivo of archivos) {
  const ruta = path.join(backendPath, archivo);
  if (!fs.existsSync(ruta)) {
    console.error(`❌ ERROR: Archivo no encontrado: ${ruta}`);
    process.exit(1);
  }
}

console.log("✓ Archivos localizados correctamente:");
archivos.forEach(a => console.log(`  - ${a}`));
console.log("");

// Crear multipart boundary
const boundary = `----${Math.random().toString(36).substr(2, 9)}`;
let bodyParts = [];

// Agregar cada archivo
console.log("Preparando carga de archivos...");
for (const archivo of archivos) {
  const ruta = path.join(backendPath, archivo);
  const nombreCampo = archivo.replace('.db', '');
  const data = fs.readFileSync(ruta);
  
  // Header del archivo
  bodyParts.push(`--${boundary}`);
  bodyParts.push(`Content-Disposition: form-data; name="${nombreCampo}"; filename="${archivo}"`);
  bodyParts.push("Content-Type: application/octet-stream");
  bodyParts.push("");
  
  // Datos binarios como string latin1
  bodyParts.push(data.toString('latin1'));
}

// Cierre
bodyParts.push(`--${boundary}--`);
bodyParts.push("");

const body = bodyParts.join('\r\n');
const bodyBuffer = Buffer.from(body, 'latin1');

console.log("Enviando datos al servidor...");
console.log("(Esto puede tardar 15-30 segundos)\n");

// Hacer request
const url = new URL(`${baseUrl}/api/backup/importar`);
const options = {
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': bodyBuffer.length,
    'x-admin-token': token
  },
  timeout: 120000
};

const req = https.request(url, options, (res) => {
  let responseData = '';
  
  res.on('data', chunk => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log("\n=== RESULTADO ===\n");
    
    try {
      const result = JSON.parse(responseData);
      if (result.exito) {
        console.log("✅ ÉXITO: Bases de datos importadas correctamente");
        console.log(`   ${result.mensaje}`);
        console.log("\n📱 El servidor se reiniciará automáticamente.");
        console.log("⏳ Espera 1-2 minutos y accede a: https://chipactli.onrender.com");
      } else {
        console.log("❌ ERROR: " + result.mensaje);
      }
    } catch (e) {
      console.log("❌ ERROR al parsear respuesta: " + responseData);
    }
    
    process.exit(result?.exito ? 0 : 1);
  });
});

req.on('error', (error) => {
  console.error("\n=== ERROR DE CONEXIÓN ===\n");
  console.error("Error: " + error.message);
  if (error.code === 'ENOTFOUND') {
    console.error("No se pudo conectar al servidor. Verifica la URL.");
  } else if (error.code === 'ETIMEDOUT') {
    console.error("Conexión agotada. El servidor tardó demasiado en responder.");
  }
  process.exit(1);
});

req.write(bodyBuffer);
req.end();
