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

function descargarJson(datos, tipo) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  const fecha = new Date().toISOString().split('T')[0];
  a.download = `chipactli-${tipo}-${fecha}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function limpiarPayloadImportacionTodo(datos) {
  const payload = (datos && typeof datos === 'object' && !Array.isArray(datos)) ? { ...datos } : datos;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  if (Object.prototype.hasOwnProperty.call(payload, 'archivos_uploads_tienda')) {
    delete payload.archivos_uploads_tienda;
  }
  payload.incluye_uploads_tienda = false;
  return payload;
}

/**
 * Exportar respaldo global
 * @param {string} tipo - Solo se admite 'todo'
 */
export async function exportarDatos(tipo) {
  try {
    if (tipo !== 'todo') {
      throw new Error('Solo está habilitado exportar TODO');
    }

    const endpointTodo = `${obtenerURLAPI()}/api/exportar/todo?include_uploads=0`;
    const datosTodo = await fetchAPIJSON(endpointTodo);
    descargarJson(datosTodo, tipo);
    mostrarNotificacion('✅ Respaldo TOTAL exportado correctamente', 'exito');
  } catch (error) {
    console.error('Error al exportar:', error);
    mostrarNotificacion(`❌ Error al exportar ${tipo}: ${error.message}`, 'error');
  }
}

/**
 * Importar respaldo global
 * @param {string} tipo - Solo se admite 'todo'
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
    
    if (tipo !== 'todo') {
      throw new Error('Solo está habilitado importar TODO');
    }

    const payload = limpiarPayloadImportacionTodo(datos);

    await fetchAPIJSON(`${obtenerURLAPI()}/api/importar/todo`, {
      method: 'POST',
      body: payload
    });
    
    mostrarNotificacion('✅ Respaldo TOTAL importado correctamente', 'exito');
    
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
  if (tipo === 'todo') {
    [
      'inventario_actualizado',
      'recetas_actualizado',
      'produccion_actualizado',
      'ventas_actualizado',
      'categorias_actualizado',
      'tienda_catalogo_actualizado'
    ].forEach((eventoTipo) => {
      window.dispatchEvent(new CustomEvent('chipactli:realtime', { detail: { tipo: eventoTipo } }));
    });
  }
}

// Exponer funciones globalmente para uso en onclick handlers
window.exportarDatos = exportarDatos;
window.importarDatos = importarDatos;
