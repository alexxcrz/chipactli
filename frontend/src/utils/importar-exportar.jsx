// ========================================
// FUNCIONES DE IMPORTAR/EXPORTAR DATOS
// ========================================

import { API } from './config.jsx';
import { mostrarNotificacion } from './notificaciones.jsx';
import { fetchAPIJSON } from './api.jsx';

/**
 * Obtener la URL base de la API
 */
function obtenerURLAPI() {
  // Si ya está definida globalmente, usarla
  if (window.API_URL) return window.API_URL;
  if (typeof API !== 'undefined') return API;

  // Usar rutas relativas para que localhost e IP consuman exactamente el mismo backend.
  return '';
}

/**
 * Exportar datos de una sección específica
 * @param {string} tipo - 'inventario', 'utensilios', 'recetas', 'produccion', 'ventas'
 */
export async function exportarDatos(tipo) {
  try {
    const endpoint = `${obtenerURLAPI()}/api/exportar/${tipo}`;
    const datos = await fetchAPIJSON(endpoint);
    
    // Crear archivo JSON
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Descargar archivo
    const a = document.createElement('a');
    a.href = url;
    const fecha = new Date().toISOString().split('T')[0];
    a.download = `chipactli-${tipo}-${fecha}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    mostrarNotificacion(`✅ ${tipo} exportado correctamente`, 'exito');
  } catch (error) {
    console.error('Error al exportar:', error);
    mostrarNotificacion(`❌ Error al exportar ${tipo}: ${error.message}`, 'error');
  }
}

/**
 * Importar datos de un archivo JSON
 * @param {string} tipo - 'inventario', 'utensilios', 'recetas', 'produccion', 'ventas'
 * @param {HTMLInputElement} input - Input file element
 */
export async function importarDatos(tipo, input) {
  const archivo = input.files[0];
  
  if (!archivo) {
    mostrarNotificacion('❌ No se seleccionó ningún archivo', 'error');
    return;
  }
  
  if (!archivo.name.endsWith('.json')) {
    mostrarNotificacion('❌ El archivo debe ser JSON', 'error');
    input.value = '';
    return;
  }
  
  try {
    const contenido = await archivo.text();
    const datos = JSON.parse(contenido);
    
    // Validar que tenga datos
    if (!datos || (Array.isArray(datos) && datos.length === 0)) {
      throw new Error('El archivo está vacío');
    }
    
    // Enviar al servidor
    const endpoint = `${obtenerURLAPI()}/api/importar/${tipo}`;
    const resultado = await fetchAPIJSON(endpoint, {
      method: 'POST',
      body: datos
    });
    
    const importados = resultado?.importados;
    const totalImportados = (typeof importados === 'number')
      ? importados
      : (importados && typeof importados === 'object')
        ? Object.values(importados).reduce((acc, v) => acc + (Number(v) || 0), 0)
        : 0;

    mostrarNotificacion(
      `✅ ${totalImportados} registros importados correctamente`,
      'exito'
    );
    
    // Recargar la sección correspondiente
    recargarSeccion(tipo);
    
  } catch (error) {
    console.error('Error al importar:', error);
    mostrarNotificacion(`❌ Error al importar: ${error.message}`, 'error');
  } finally {
    // Limpiar input
    input.value = '';
  }
}

/**
 * Recargar la sección después de importar
 * @param {string} tipo - Tipo de sección a recargar
 */
export function recargarSeccion(tipo) {
  switch (tipo) {
    case 'inventario':
      if (window.inventario?.cargarInventario) window.inventario.cargarInventario();
      if (window.inventario?.cargarEstadisticasInventario) window.inventario.cargarEstadisticasInventario();
      break;
    case 'utensilios':
      if (typeof window.utensilios?.cargarUtensilios === 'function') {
        window.utensilios.cargarUtensilios();
      }
      break;
    case 'recetas':
      if (window.recetas?.cargarListadoRecetas) window.recetas.cargarListadoRecetas();
      if (window.recetas?.cargarCategorias) window.recetas.cargarCategorias();
      break;
    case 'produccion':
      if (window.produccion?.cargarProduccion) window.produccion.cargarProduccion();
      break;
    case 'ventas':
      if (window.ventas?.cargarVentas) window.ventas.cargarVentas();
      if (window.ventas?.cargarEstadisticasVentas) {
        window.ventas.cargarEstadisticasVentas('mes');
      }
      break;
  }
}

// Exponer funciones globalmente para uso en onclick handlers
window.exportarDatos = exportarDatos;
window.importarDatos = importarDatos;
