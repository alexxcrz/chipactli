import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("\n=== SISTEMA DE IMPORTACIÓN CHIPACTLI ===\n");

// ============================================
// PASO 1: GIT PUSH
// ============================================
console.log("PASO 1: Enviando cambios a GitHub...\n");

try {
  process.chdir(path.join(__dirname));
  
  // Verificar estado
  const status = execSync('git status --porcelain', { encoding: 'utf-8' });
  console.log("Estado actual:");
  console.log(status || "  (Repositorio limpio)");
  
  // Agregar cambios
  console.log("Agregando archivos...");
  execSync('git add -A', { stdio: 'inherit' });
  
  // Commit
  console.log("Haciendo commit...");
  try {
    execSync('git commit -m "Fix: Multipart DB import con multer"', { stdio: 'inherit' });
  } catch (e) {
    console.log("  (Sin cambios nuevos para commitear)");
  }
  
  // Push
  console.log("Subiendo a GitHub...");
  execSync('git push origin main', { stdio: 'inherit' });
  
  console.log("\n✅ GitHub push completado\n");
} catch (error) {
  console.log("\n⚠️  Advertencia en git: " + error.message);
  console.log("    Continuo con la importación...\n");
}

// ============================================
// PASO 2: ESPERAR A RENDER
// ============================================
console.log("PASO 2: Esperando 5 minutos para que Render redepliegue...\n");

const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let tiempoRestante = 300; // 5 minutos
const tiempoInicio = Date.now();

const mostrarProgreso = async () => {
  while (tiempoRestante > 0) {
    const minutos = Math.floor(tiempoRestante / 60);
    const segundos = tiempoRestante % 60;
    const tiempoStr = `${minutos}:${segundos.toString().padStart(2, '0')}`;
    
    process.stdout.write(`\r⏳ Tiempo restante: ${tiempoStr}     `);
    
    await esperar(1000);
    tiempoRestante--;
  }
};

await mostrarProgreso();
console.log("\n\n✅ Tiempo de espera completado\n");

// ============================================
// PASO 3: IMPORTAR BASES DE DATOS
// ============================================
console.log("PASO 3: Importando bases de datos...\n");

const token = "chipactli-admin-2026-seguro";
const baseUrl = "https://chipactli.onrender.com";
const backendPath = path.join(__dirname, "backend");

// Validar archivos
const archivos = ["inventario.db", "recetas.db", "produccion.db", "ventas.db"];
console.log("Validando archivos locales:");
for (const archivo of archivos) {
  const ruta = path.join(backendPath, archivo);
  if (!fs.existsSync(ruta)) {
    console.error(`❌ ERROR: Archivo no encontrado: ${ruta}`);
    process.exit(1);
  }
  console.log(`  ✓ ${archivo}`);
}
console.log("");

// Crear multipart
const boundary = `----${Math.random().toString(36).substr(2, 9)}`;
let bodyParts = [];

console.log("Preparando carga de archivos...");
for (const archivo of archivos) {
  const ruta = path.join(backendPath, archivo);
  const nombreCampo = archivo.replace('.db', '');
  const data = fs.readFileSync(ruta);
  
  bodyParts.push(`--${boundary}`);
  bodyParts.push(`Content-Disposition: form-data; name="${nombreCampo}"; filename="${archivo}"`);
  bodyParts.push("Content-Type: application/octet-stream");
  bodyParts.push("");
  bodyParts.push(data.toString('latin1'));
}

bodyParts.push(`--${boundary}--`);
bodyParts.push("");

const body = bodyParts.join('\r\n');
const bodyBuffer = Buffer.from(body, 'latin1');

console.log(`Total: ${(bodyBuffer.length / 1024 / 1024).toFixed(2)} MB\n`);
console.log("Enviando al servidor...\n");

// Request
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

await new Promise((resolve, reject) => {
  const req = https.request(url, options, (res) => {
    let responseData = '';
    
    res.on('data', chunk => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log("\n=== RESULTADO ===\n");
      
      try {
        // Intenta parsear como JSON
        const result = JSON.parse(responseData);
        if (result.exito) {
          console.log("✅ ÉXITO: Bases de datos importadas");
          console.log(`📌 ${result.mensaje}`);
          console.log("\n🔄 El servidor se está reiniciando...");
          console.log("⏳ Espera 1-2 minutos");
          console.log("🌐 Luego accede a: https://chipactli.onrender.com");
          console.log("\n✨ Tu aplicación está lista con todos tus datos!\n");
          resolve();
        } else {
          console.log("❌ ERROR del servidor: " + result.mensaje);
          reject(new Error(result.mensaje));
        }
      } catch (e) {
        // Si no es JSON, probablemente sea HTML = servidor viejo
        if (responseData.includes('<!DOCTYPE')) {
          console.log("❌ El servidor aún tiene la versión vieja");
          console.log("   Render aún está redepliegando...");
          console.log("   Intenta de nuevo en 2-3 minutos");
        } else {
          console.log("❌ Respuesta inesperada: " + responseData.substring(0, 200));
        }
        reject(e);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error("❌ Error de conexión: " + error.message);
    if (error.code === 'ENOTFOUND') {
      console.error("   No se puede conectar al servidor");
    } else if (error.code === 'ETIMEDOUT') {
      console.error("   El servidor tardó demasiado");
    }
    reject(error);
  });
  
  req.write(bodyBuffer);
  req.end();
});

console.log("Presiona Enter para cerrar...");
