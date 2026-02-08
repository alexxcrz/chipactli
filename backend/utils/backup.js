import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupDir = path.join(__dirname, '../backups');

/**
 * Crea un backup de todas las bases de datos
 */
export async function crearBackup() {
  try {
    // Crear directorio de backups si no existe
    await fs.mkdir(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const databases = ['inventario.db', 'recetas.db', 'produccion.db', 'ventas.db'];
    
    for (const db of databases) {
      const sourcePath = path.join(__dirname, '..', db);
      const backupPath = path.join(backupDir, `${db}.${timestamp}.backup`);
      
      try {
        await fs.copyFile(sourcePath, backupPath);
        console.log(`✅ Backup creado: ${db}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error(`❌ Error al hacer backup de ${db}:`, error.message);
        }
      }
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
    const databases = ['inventario.db', 'recetas.db', 'produccion.db', 'ventas.db'];
    
    for (const db of databases) {
      const backupPath = path.join(backupDir, `${db}.${timestamp}.backup`);
      const targetPath = path.join(__dirname, '..', db);
      
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
    const files = await fs.readdir(backupDir);
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
    
    if (backups.length > 5) {
      const paraEliminar = backups.slice(5);
      
      for (const timestamp of paraEliminar) {
        const databases = ['inventario.db', 'recetas.db', 'produccion.db', 'ventas.db'];
        for (const db of databases) {
          const backupPath = path.join(backupDir, `${db}.${timestamp}.backup`);
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
