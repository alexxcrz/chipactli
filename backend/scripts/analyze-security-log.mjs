import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const backendDir = process.cwd();
const dbDir = process.env.DB_DIR
  ? path.resolve(process.env.DB_DIR)
  : path.join(backendDir, 'data');
const securityLogPath = path.join(dbDir, 'logs', 'security.log');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = Math.max(1, Math.min(5000, Number(limitArg?.split('=')[1]) || 500));

function formatTable(title, rows) {
  console.log(`\n${title}`);
  if (!rows.length) {
    console.log('  sin datos');
    return;
  }
  for (const row of rows) {
    console.log(`  ${row}`);
  }
}

function sortEntries(obj) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}

try {
  const raw = await fs.readFile(securityLogPath, 'utf8');
  const eventos = raw
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-limit)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const porTipo = {};
  const porNivel = {};
  const porIp = {};

  for (const evento of eventos) {
    porTipo[evento.tipo || 'security_event'] = (porTipo[evento.tipo || 'security_event'] || 0) + 1;
    porNivel[evento.nivel || 'warning'] = (porNivel[evento.nivel || 'warning'] || 0) + 1;
    const ip = String(evento.ip || '').trim();
    if (ip) porIp[ip] = (porIp[ip] || 0) + 1;
  }

  console.log(`Archivo: ${securityLogPath}`);
  console.log(`Eventos analizados: ${eventos.length}`);

  formatTable(
    'Conteo por nivel',
    sortEntries(porNivel).map(([nivel, total]) => `${nivel}: ${total}`)
  );

  formatTable(
    'Conteo por tipo',
    sortEntries(porTipo).slice(0, 10).map(([tipo, total]) => `${tipo}: ${total}`)
  );

  formatTable(
    'IPs mas activas',
    sortEntries(porIp).slice(0, 10).map(([ip, total]) => `${ip}: ${total}`)
  );

  const criticos = eventos.filter((evento) => ['critical', 'error'].includes(String(evento.nivel || '').toLowerCase()));
  formatTable(
    'Eventos recientes de mayor severidad',
    criticos.slice(-10).map((evento) => `${evento.ts || ''} ${evento.nivel || ''} ${evento.tipo || ''} ${evento.ruta || ''} ${evento.ip || ''}`.trim())
  );
} catch (error) {
  console.error(`No se pudo leer el log de seguridad: ${error.message}`);
  process.exitCode = 1;
}
