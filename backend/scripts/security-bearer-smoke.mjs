import crypto from 'node:crypto';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import { serializarPermisos } from '../utils/permisos/index.js';

const backendRoot = path.resolve(process.cwd());
const dataDir = path.join(backendRoot, 'data');
const baseUrl = String(process.env.SMOKE_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const targetUsername = String(process.env.SMOKE_USER || 'smoke.admin').trim().toLowerCase();
const targetPassword = String(process.env.SMOKE_PASSWORD || `${crypto.randomBytes(18).toString('base64url')}Aa1!`);
const targetNombre = String(process.env.SMOKE_NAME || 'Smoke Admin').trim() || 'Smoke Admin';

function abrirAdminDb() {
  return new sqlite3.Database(path.join(dataDir, 'admin.db'));
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row || null);
    });
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

async function asegurarUsuarioSmoke(db) {
  const passwordHash = await bcrypt.hash(targetPassword, 10);
  const usuarioActual = await dbGet(db, 'SELECT id, username FROM usuarios WHERE username = ? LIMIT 1', [targetUsername]);

  if (usuarioActual) {
    await dbRun(
      db,
      'UPDATE usuarios SET password_hash = ?, nombre = ?, rol = ?, permisos = ?, debe_cambiar_password = 0, token_version = 0, actualizado_en = CURRENT_TIMESTAMP WHERE username = ?',
      [passwordHash, targetNombre, 'admin', serializarPermisos(null, 'admin'), targetUsername]
    );
    return;
  }

  await dbRun(
    db,
    'INSERT INTO usuarios (username, password_hash, nombre, correo, rol, permisos, token_version, debe_cambiar_password) VALUES (?, ?, ?, ?, ?, ?, 0, 0)',
    [targetUsername, passwordHash, targetNombre, '', 'admin', serializarPermisos(null, 'admin')]
  );
}

async function fetchJson(ruta, options = {}) {
  const response = await fetch(`${baseUrl}${ruta}`, options);
  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

async function run() {
  const db = abrirAdminDb();

  try {
    await asegurarUsuarioSmoke(db);

    const login = await fetchJson('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: targetUsername, password: targetPassword })
    });

    if (login.status !== 200 || !login.data?.token) {
      throw new Error(`login real falló: esperado 200 con token, recibido ${login.status} ${JSON.stringify(login.data)}`);
    }

    const token = String(login.data.token || '');

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const checks = [
      {
        name: 'listar usuarios requiere Bearer valido',
        path: '/api/privado/usuarios',
        options: { headers },
        expectStatus: 200
      },
      {
        name: 'security estado con Bearer valido',
        path: '/api/privado/security/estado',
        options: { headers },
        expectStatus: 200
      },
      {
        name: 'security ping-alerta con Bearer valido',
        path: '/api/privado/security/ping-alerta',
        options: {
          method: 'POST',
          headers,
          body: JSON.stringify({ mensaje: 'security-bearer-smoke', severidad: 'warning' })
        },
        expectStatus: 200
      },
      {
        name: 'security logs con Bearer valido',
        path: '/api/privado/security/logs?limit=5',
        options: { headers },
        expectStatus: 200
      },
      {
        name: 'revocar sesiones invalida token anterior',
        path: '/api/privado/usuarios/revocar-sesiones',
        options: {
          method: 'POST',
          headers,
          body: JSON.stringify({ username: targetUsername })
        },
        expectStatus: 200
      }
    ];

    console.log(`[bearer-smoke] base=${baseUrl}`);
    console.log(`[bearer-smoke] user=${targetUsername} via real login`);

    for (const check of checks) {
      const result = await fetchJson(check.path, check.options);
      if (result.status !== check.expectStatus) {
        throw new Error(`${check.name}: esperado ${check.expectStatus}, recibido ${result.status} ${JSON.stringify(result.data)}`);
      }
      console.log(`PASS ${check.name}: HTTP ${result.status}`);
    }

    const stale = await fetchJson('/api/privado/usuarios', { headers });
    if (stale.status !== 401) {
      throw new Error(`token revocado siguió activo: esperado 401, recibido ${stale.status} ${JSON.stringify(stale.data)}`);
    }
    console.log('PASS token revocado queda invalido: HTTP 401');
  } finally {
    db.close();
  }
}

run().catch((error) => {
  console.error('[bearer-smoke] ERROR:', error.message);
  process.exit(1);
});