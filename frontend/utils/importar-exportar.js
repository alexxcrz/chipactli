// ========================================
// FUNCIONES DE IMPORTAR/EXPORTAR DATOS
// ========================================

/**
 * Exportar datos de una sección específica
 * @param {string} tipo - 'inventario', 'utensilios', 'recetas', 'produccion', 'ventas'
 */
async function exportarDatos(tipo) {
  try {
    const  response = await fetch(`${window.API_URL}/api/exportar/${tipo}`);
    
    if (!response.ok) {
      throw new Error(`Error al exportar ${tipo}: ${response.statusText}`);
    }
    
    const datos = await response.json();
    
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
async function importarDatos(tipo, input) {
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
    const response = await fetch(`${window.API_URL}/api/importar/${tipo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.mensaje || response.statusText);
    }
    
    const resultado = await response.json();
    
    mostrarNotificacion(
      `✅ ${resultado.importados || 0} registros importados correctamente`,
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
function recargarSeccion(tipo) {
  switch (tipo) {
    case 'inventario':
      if (typeof cargarInventario === 'function') cargarInventario();
      if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
      break;
    case 'utensilios':
      if (typeof window.utensilios?.cargarUtensilios === 'function') {
        window.utensilios.cargarUtensilios();
      }
      break;
    case 'recetas':
      if (typeof cargarRecetas === 'function') cargarRecetas();
      if (typeof cargarCategorias === 'function') cargarCategorias();
      break;
    case 'produccion':
      if (typeof cargarProduccion === 'function') cargarProduccion();
      break;
    case 'ventas':
      if (typeof cargarVentas === 'function') cargarVentas();
      if (typeof cargarEstadisticasVentas === 'function') {
        cargarEstadisticasVentas('mes');
      }
      break;
  }
}
