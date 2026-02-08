// config.js - Configuración dinámica de la API

/**
 * Determina la URL base de la API automáticamente
 * Si se accede desde localhost, usa localhost:3001
 * Si se accede desde otra IP, usa esa misma IP con puerto 3001
 */
export function obtenerURLAPI() {
  const host = window.location.hostname;
  const puerto = 3001;
  
  // Si es localhost o 127.0.0.1, usa localhost
  if (host === 'localhost' || host === '127.0.0.1') {
    return `http://localhost:${puerto}`;
  }
  
  // Si es una IP, usa esa misma IP
  if (host.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return `http://${host}:${puerto}`;
  }
  
  // Fallback: intenta con el hostname actual
  return `http://${host}:${puerto}`;
}

// Exportar la URL de la API
export const API = obtenerURLAPI();

// Mostrar en consola para debugging
console.log('🔗 API URL:', API);
