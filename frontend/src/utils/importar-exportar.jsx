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

function extraerCortesiasDesdeArchivo(datos) {
  if (Array.isArray(datos)) return datos;
  if (!datos || typeof datos !== 'object') return [];

  if (Array.isArray(datos.cortesias)) return datos.cortesias;
  if (Array.isArray(datos.datos)) return datos.datos;
  if (datos.datos && typeof datos.datos === 'object' && Array.isArray(datos.datos.cortesias)) {
    return datos.datos.cortesias;
  }
  if (datos.contenido && typeof datos.contenido === 'object' && Array.isArray(datos.contenido.cortesias)) {
    return datos.contenido.cortesias;
  }
  if (datos.backup && typeof datos.backup === 'object' && Array.isArray(datos.backup.cortesias)) {
    return datos.backup.cortesias;
  }

  return [];
}

function extraerVentasDesdeArchivo(datos) {
  if (Array.isArray(datos)) return datos;
  if (!datos || typeof datos !== 'object') return [];

  if (Array.isArray(datos.ventas)) return datos.ventas;
  if (Array.isArray(datos.datos)) return datos.datos;
  if (datos.datos && typeof datos.datos === 'object' && Array.isArray(datos.datos.ventas)) {
    return datos.datos.ventas;
  }
  if (datos.contenido && typeof datos.contenido === 'object' && Array.isArray(datos.contenido.ventas)) {
    return datos.contenido.ventas;
  }
  if (datos.backup && typeof datos.backup === 'object' && Array.isArray(datos.backup.ventas)) {
    return datos.backup.ventas;
  }

  return [];
}

/**
 * Exportar datos de una sección específica
 * @param {string} tipo - 'inventario', 'utensilios', 'recetas', 'produccion', 'ventas', 'cortesias'
 */
export async function exportarDatos(tipo) {
  try {
    if (tipo === 'cortesias') {
      try {
        const endpointCortesias = `${obtenerURLAPI()}/api/exportar/cortesias`;
        const datosCortesias = await fetchAPIJSON(endpointCortesias);
        descargarJson(datosCortesias, tipo);
        mostrarNotificacion(`✅ ${tipo} exportado correctamente`, 'exito');
        return;
      } catch (errorCortesias) {
        const es404 = /404/.test(String(errorCortesias?.message || ''));
        if (!es404) throw errorCortesias;

        // Compatibilidad con backend viejo: usar exportar ventas y extraer cortesias.
        const endpointVentas = `${obtenerURLAPI()}/api/exportar/ventas`;
        const datosVentas = await fetchAPIJSON(endpointVentas);
        const lista = extraerCortesiasDesdeArchivo(datosVentas);
        if (!lista.length) {
          throw new Error('Tu backend no soporta /api/exportar/cortesias todavia. Reinicia o despliega la version nueva.');
        }

        descargarJson({ tipo: 'cortesias', datos: lista, total: lista.length }, tipo);
        mostrarNotificacion('✅ cortesias exportadas desde respaldo de ventas', 'exito');
        return;
      }
    }

    const endpoint = `${obtenerURLAPI()}/api/exportar/${tipo}`;
    const datos = await fetchAPIJSON(endpoint);
    descargarJson(datos, tipo);
    
    mostrarNotificacion(`✅ ${tipo} exportado correctamente`, 'exito');
  } catch (error) {
    console.error('Error al exportar:', error);
    mostrarNotificacion(`❌ Error al exportar ${tipo}: ${error.message}`, 'error');
  }
}

/**
 * Importar datos de un archivo JSON
 * @param {string} tipo - 'inventario', 'utensilios', 'recetas', 'produccion', 'ventas', 'cortesias'
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
    
    let resultado = null;

    if (tipo === 'cortesias') {
      const listaCortesias = extraerCortesiasDesdeArchivo(datos);
      if (!listaCortesias.length) {
        throw new Error('El archivo no contiene cortesias para importar');
      }

      try {
        const endpointCortesias = `${obtenerURLAPI()}/api/importar/cortesias`;
        resultado = await fetchAPIJSON(endpointCortesias, {
          method: 'POST',
          body: { cortesias: listaCortesias }
        });
      } catch (errorCortesias) {
        const es404 = /404/.test(String(errorCortesias?.message || ''));
        if (!es404) throw errorCortesias;

        const endpointVentas = `${obtenerURLAPI()}/api/importar/ventas`;
        resultado = await fetchAPIJSON(endpointVentas, {
          method: 'POST',
          body: { cortesias: listaCortesias }
        });
      }
    } else if (tipo === 'ventas') {
      const listaVentas = extraerVentasDesdeArchivo(datos);
      const listaCortesias = extraerCortesiasDesdeArchivo(datos);

      if (!listaVentas.length && !listaCortesias.length) {
        throw new Error('El archivo no contiene ventas ni cortesias para importar');
      }

      // Compatibilidad con backend viejo: siempre enviar "datos" como arreglo de ventas.
      const payloadVentas = {
        datos: listaVentas,
        ventas: listaVentas,
        cortesias: listaCortesias
      };

      const endpoint = `${obtenerURLAPI()}/api/importar/ventas`;
      resultado = await fetchAPIJSON(endpoint, {
        method: 'POST',
        body: payloadVentas
      });
    } else {
      // Enviar al servidor
      const endpoint = `${obtenerURLAPI()}/api/importar/${tipo}`;
      resultado = await fetchAPIJSON(endpoint, {
        method: 'POST',
        body: datos
      });
    }
    
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
      if (window.ventas?.cargarCortesias) window.ventas.cargarCortesias();
      if (window.ventas?.cargarEstadisticasVentas) {
        window.ventas.cargarEstadisticasVentas('mes');
      }
      break;
    case 'cortesias':
      if (window.ventas?.cargarCortesias) window.ventas.cargarCortesias();
      break;
  }
}

// Exponer funciones globalmente para uso en onclick handlers
window.exportarDatos = exportarDatos;
window.importarDatos = importarDatos;
