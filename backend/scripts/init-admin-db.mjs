import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { serializarPermisos } from '../utils/permisos/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = process.env.DB_DIR
  ? path.resolve(process.env.DB_DIR)
  : path.resolve(__dirname, '..', 'data');

const inventarioDb = new sqlite3.Database(path.join(dbDir, 'inventario.db'));
const adminDb = new sqlite3.Database(path.join(dbDir, 'admin.db'));

const createUsuariosSql = `CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nombre TEXT,
  correo TEXT,
  rol TEXT DEFAULT 'usuario',
  permisos TEXT,
  token_version INTEGER DEFAULT 0,
  debe_cambiar_password INTEGER DEFAULT 1,
  creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
)`;

const createAuditoriaSql = `CREATE TABLE IF NOT EXISTS auditoria_admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  accion TEXT NOT NULL,
  detalle TEXT,
  usuario TEXT,
  fecha TEXT DEFAULT CURRENT_TIMESTAMP
)`;

function closeAll() {
  inventarioDb.close();
  adminDb.close();
}

adminDb.serialize(() => {
  adminDb.run(createUsuariosSql);
  adminDb.run(createAuditoriaSql);

  adminDb.all('PRAGMA table_info(usuarios)', [], (colsErr, cols) => {
    if (colsErr) {
      console.error('Error leyendo estructura de usuarios:', colsErr.message);
      closeAll();
      process.exit(1);
    }

    const continuar = () => {
      adminDb.run(
        "UPDATE usuarios SET permisos = ? WHERE (permisos IS NULL OR permisos = '') AND rol = 'ceo'",
        [serializarPermisos(null, 'ceo')]
      );
      adminDb.run(
        "UPDATE usuarios SET permisos = ? WHERE (permisos IS NULL OR permisos = '') AND rol = 'admin'",
        [serializarPermisos(null, 'admin')]
      );
      adminDb.run(
        "UPDATE usuarios SET permisos = ? WHERE (permisos IS NULL OR permisos = '') AND (rol IS NULL OR rol = '' OR rol = 'usuario')",
        [serializarPermisos(null, 'usuario')]
      );

      adminDb.get('SELECT COUNT(*) AS total FROM usuarios', [], (countErr, row) => {
        if (countErr) {
          console.error('Error leyendo admin.db:', countErr.message);
          closeAll();
          process.exit(1);
        }

        if (row?.total > 0) {
          console.log('admin.db ya tenía usuarios, sin cambios');
          closeAll();
          return;
        }

        inventarioDb.all(
          'SELECT username, password_hash, nombre, rol, debe_cambiar_password, creado_en, actualizado_en FROM usuarios',
          [],
          (legacyErr, users) => {
            if (legacyErr) {
              console.error('Error leyendo usuarios legacy:', legacyErr.message);
              closeAll();
              process.exit(1);
            }

            if (!users?.length) {
              console.log('No hay usuarios legacy para migrar');
              closeAll();
              return;
            }

            const stmt = adminDb.prepare(
              'INSERT OR IGNORE INTO usuarios (username, password_hash, nombre, rol, permisos, debe_cambiar_password, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );

            for (const user of users) {
              stmt.run([
                user.username,
                user.password_hash,
                user.nombre || '',
                user.rol || 'usuario',
                serializarPermisos(null, user.rol || 'usuario'),
                user.debe_cambiar_password ? 1 : 0,
                user.creado_en || new Date().toISOString(),
                user.actualizado_en || new Date().toISOString()
              ]);
            }

            stmt.finalize(() => {
              console.log(`Usuarios migrados a admin.db: ${users.length}`);
              closeAll();
            });
          }
        );
      });
    };

    if (!cols.some(col => col.name === 'permisos')) {
      adminDb.run('ALTER TABLE usuarios ADD COLUMN permisos TEXT', [], (alterErr) => {
        if (alterErr) {
          console.error('Error agregando columna permisos:', alterErr.message);
          closeAll();
          process.exit(1);
        }
        if (!cols.some(col => col.name === 'correo')) {
          adminDb.run('ALTER TABLE usuarios ADD COLUMN correo TEXT', [], (correoErr) => {
            if (correoErr) {
              console.error('Error agregando columna correo:', correoErr.message);
              closeAll();
              process.exit(1);
            }
            if (!cols.some(col => col.name === 'token_version')) {
              adminDb.run('ALTER TABLE usuarios ADD COLUMN token_version INTEGER DEFAULT 0', [], (tokenVersionErr) => {
                if (tokenVersionErr) {
                  console.error('Error agregando columna token_version:', tokenVersionErr.message);
                  closeAll();
                  process.exit(1);
                }
                continuar();
              });
              return;
            }
            continuar();
          });
          return;
        }
        if (!cols.some(col => col.name === 'token_version')) {
          adminDb.run('ALTER TABLE usuarios ADD COLUMN token_version INTEGER DEFAULT 0', [], (tokenVersionErr) => {
            if (tokenVersionErr) {
              console.error('Error agregando columna token_version:', tokenVersionErr.message);
              closeAll();
              process.exit(1);
            }
            continuar();
          });
          return;
        }
        continuar();
      });
      return;
    }

    if (!cols.some(col => col.name === 'correo')) {
      adminDb.run('ALTER TABLE usuarios ADD COLUMN correo TEXT', [], (correoErr) => {
        if (correoErr) {
          console.error('Error agregando columna correo:', correoErr.message);
          closeAll();
          process.exit(1);
        }
        if (!cols.some(col => col.name === 'token_version')) {
          adminDb.run('ALTER TABLE usuarios ADD COLUMN token_version INTEGER DEFAULT 0', [], (tokenVersionErr) => {
            if (tokenVersionErr) {
              console.error('Error agregando columna token_version:', tokenVersionErr.message);
              closeAll();
              process.exit(1);
            }
            continuar();
          });
          return;
        }
        continuar();
      });
      return;
    }

    if (!cols.some(col => col.name === 'token_version')) {
      adminDb.run('ALTER TABLE usuarios ADD COLUMN token_version INTEGER DEFAULT 0', [], (tokenVersionErr) => {
        if (tokenVersionErr) {
          console.error('Error agregando columna token_version:', tokenVersionErr.message);
          closeAll();
          process.exit(1);
        }
        continuar();
      });
      return;
    }

    continuar();
  });
});
