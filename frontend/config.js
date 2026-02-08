// config.js - Configuración dinámica de la API

/**
 * Determina la URL base de la API automáticamente
 * En producción (dominio): usa el mismo origen
 * En desarrollo local: usa localhost:3001 o IP local con puerto 3001
 */
export function obtenerURLAPI() {
  const host = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;
  
  // Si es localhost o 127.0.0.1 en desarrollo, usa puerto 3001
  if (host === 'localhost' || host === '127.0.0.1') {
    return `http://localhost:3001`;
  }
  
  // Si es una IP local (192.168.x.x, 10.x.x.x, etc.), usa puerto 3001
  if (host.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return `http://${host}:3001`;
  }
  
  // Si tiene un dominio (producción), usa el mismo origen
  // Esto funciona porque el backend sirve el frontend
  return `${protocol}//${host}${port ? ':' + port : ''}`;
}

// Exportar la URL de la API
export const API = obtenerURLAPI();

// Mostrar en consola para debugging
console.log('🔗 API URL:', API);
console.log('🌍 Hostname:', window.location.hostname);
