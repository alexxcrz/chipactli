#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.clear();
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║   IMPORTAR BASES DE DATOS CHIPACTLI   ║");
  console.log("╚════════════════════════════════════════╝\n");

  console.log("📤 PASO 1: Enviando cambios a GitHub...\n");
  try {
    process.chdir(__dirname);
    execSync('git add -A', { stdio: 'pipe' });
    try {
      execSync('git commit -m "DB import"', { stdio: 'pipe' });
    } catch (e) {}
    execSync('git push origin main', { stdio: 'pipe' });
    console.log("✅ GitHub: OK\n");
  } catch (e) {
    console.log("⚠️  GitHub: Error (continuando...)\n");
  }

  console.log("⏳ PASO 2: Esperando a Render (5 minutos)...\n");

  let segundos = 300;
  while (segundos > 0) {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    process.stdout.write(
      `   Tiempo: ${min}:${seg.toString().padStart(2, '0')}                 \r`
    );
    await new Promise(r => setTimeout(r, 1000));
    segundos--;
  }

  console.log("   Tiempo: 0:00                                  ");
  console.log("\n✅ Render: Listo\n");

  console.log("📥 PASO 3: Importando bases de datos...\n");

  const token = "chipactli-admin-2026-seguro";
  const baseUrl = "https://chipactli.onrender.com";
  const backendPath = path.join(__dirname, "backend");

  const archivos = ["inventario.db", "recetas.db", "produccion.db", "ventas.db"];
  for (const archivo of archivos) {
    const ruta = path.join(backendPath, archivo);
    if (!fs.existsSync(ruta)) {
      console.error(`❌ Error: No encontrado: ${archivo}`);
      process.exit(1);
    }
  }

  console.log("   Archivos: OK");
  console.log("   Preparando carga...");

  const boundary = `----${Math.random().toString(36).substr(2, 9)}`;
  let bodyParts = [];

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

  console.log("   Enviando...");

  await new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}/api/backup/importar`);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length,
        'x-admin-token': token
      },
      timeout: 120000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.exito) {
            console.log("\n✅ ÉXITO: Bases de datos importadas\n");
            console.log("Accede a: https://chipactli.onrender.com");
            console.log("Tus datos estarán en 1-2 minutos.\n");
            resolve();
          } else {
            console.log(`\n❌ Error: ${result.mensaje}\n`);
            reject(new Error(result.mensaje));
          }
        } catch (e) {
          if (data.includes('DOCTYPE')) {
            console.log("\n❌ Servidor aún en versión vieja");
            console.log("   Intenta de nuevo en 3 minutos\n");
          } else {
            console.log(`\n❌ Error: ${e.message}\n`);
          }
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => {
      console.log(`\n❌ Conexión: ${e.message}\n`);
      reject(e);
    });
    
    req.write(bodyBuffer);
    req.end();
  });
}

main().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
