import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(__dirname, '../..');
const DEFAULT_DB_DIR = backendDir;
const DEFAULT_BACKUP_DIR = path.join(DEFAULT_DB_DIR, 'backups');
const databases = ['inventario.db', 'recetas.db', 'produccion.db', 'ventas.db', 'admin.db'];

const backupConfig = {
  dbDir: DEFAULT_DB_DIR,
  backupDir: DEFAULT_BACKUP_DIR,
  maxBackups: 5,
};

export function configurarBackup({ dbDir, backupDir, maxBackups } = {}) {
  if (dbDir) {
    backupConfig.dbDir = dbDir;
    if (!backupDir) {
      backupConfig.backupDir = path.join(dbDir, 'backups');
    }
  }

  if (backupDir) {
    backupConfig.backupDir = backupDir;
  }

  if (Number.isInteger(maxBackups) && maxBackups > 0) {
    backupConfig.maxBackups = maxBackups;
  }
}

/**
 * Crea un backup de todas las bases de datos
 */
export async function crearBackup() {
  try {
    // Crear directorio de backups si no existe
    await fs.mkdir(backupConfig.backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let copiasExitosas = 0;
    for (const db of databases) {
      const sourcePath = path.join(backupConfig.dbDir, db);
      const backupPath = path.join(backupConfig.backupDir, `${db}.${timestamp}.backup`);
      
      try {
        await fs.copyFile(sourcePath, backupPath);
        copiasExitosas += 1;
        console.log(`✅ Backup creado: ${db}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error(`❌ Error al hacer backup de ${db}:`, error.message);
        }
      }
    }

    if (copiasExitosas === 0) {
      console.error('❌ No se creó ningún backup: no se encontraron bases de datos para respaldar');
      return false;
    }

    // Limpiar backups antiguos (mantener solo los últimos 5)
    await limpiarBackupsAntiguos();
    
    return true;
  } catch (error) {
    console.error('❌ Error en crearBackup:', error);
    return false;
  }
}

/**
 * Restaura un backup específico
 */
export async function restaurarBackup(timestamp) {
  try {
    if (!timestamp || typeof timestamp !== 'string') {
      console.error('❌ Timestamp inválido para restaurar backup');
      return false;
    }

    for (const db of databases) {
      const backupPath = path.join(backupConfig.backupDir, `${db}.${timestamp}.backup`);
      const targetPath = path.join(backupConfig.dbDir, db);
      
      await fs.copyFile(backupPath, targetPath);
      console.log(`✅ Restaurado: ${db}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error en restaurarBackup:', error);
    return false;
  }
}

/**
 * Lista todos los backups disponibles
 */
export async function listarBackups() {
  try {
    const files = await fs.readdir(backupConfig.backupDir);
    const backups = new Set();
    
    files.forEach(file => {
      const match = file.match(/\.(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*?)\.backup$/);
      if (match) {
        backups.add(match[1]);
      }
    });
    
    return Array.from(backups).sort().reverse();
  } catch (error) {
    return [];
  }
}

/**
 * Limpia backups antiguos, mantiene solo los últimos 5
 */
async function limpiarBackupsAntiguos() {
  try {
    const backups = await listarBackups();
    
    if (backups.length > backupConfig.maxBackups) {
      const paraEliminar = backups.slice(backupConfig.maxBackups);
      
      for (const timestamp of paraEliminar) {
        for (const db of databases) {
          const backupPath = path.join(backupConfig.backupDir, `${db}.${timestamp}.backup`);
          try {
            await fs.unlink(backupPath);
          } catch (error) {
            // Ignorar si no existe
          }
        }
      }
      
      console.log(`🗑️ Backups antiguos eliminados (${paraEliminar.length})`);
    }
  } catch (error) {
    console.error('Error al limpiar backups:', error);
  }
}

/**
 * Programa backups automáticos cada 6 horas
 */
export function programarBackupsAutomaticos() {
  // Backup inicial
  setTimeout(() => {
    crearBackup();
  }, 60000); // Primer backup después de 1 minuto

  // Backups cada 6 horas
  setInterval(() => {
    crearBackup();
  }, 6 * 60 * 60 * 1000);
  
  console.log('📦 Sistema de backups automáticos activado');
}
