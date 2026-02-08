// main.js - Módulo principal de routing e inicialización

// Importar utilidades
import { abrirModal, cerrarModal, inicializarCierreModalPorFondo } from './utils/modales.js';
import { mostrarNotificacion, cerrarNotificacion, actualizarUIAlertas, prepararAudioAlerta, cambiarPestanaAlertas, agregarAlerta } from './utils/notificaciones.js';
import { alternarAlertas } from './modules/alertas.js';
import { conectarWebSocket } from './utils/websocket.js';

// Importar módulos de funcionalidad
import * as inventario from './modules/inventario.js';
import * as recetas from './modules/recetas.js';
import * as produccion from './modules/produccion.js';
import * as ventas from './modules/ventas.js';
import * as utensilios from './modules/utensilios.js';

// Exportar módulos a window para acceso desde HTML inline event handlers
window.inventario = inventario;
window.recetas = recetas;
window.produccion = produccion;
window.ventas = ventas;
window.utensilios = utensilios;
window.abrirModal = abrirModal;
window.cerrarModal = cerrarModal;
window.mostrarNotificacion = mostrarNotificacion;
window.cerrarNotificacion = cerrarNotificacion;
window.alternarAlertas = alternarAlertas;
window.alternarBarraLateral = alternarBarraLateral;
window.cambiarPestanaAlertas = cambiarPestanaAlertas;
window.activarPestanaLink = activarPestanaLink;
window.activarPestana = activarPestana;
window.agregarAlerta = agregarAlerta;
window.mostrarHistorialInversion = ventas.mostrarHistorialInversion;
window.cargarEstadisticasVentas = ventas.cargarEstadisticasVentas;
// Funciones de filtrado
window.filtrarInventario = inventario.filtrarInventario;
window.filtrarRecetas = recetas.filtrarRecetas;
window.filtrarProduccion = produccion.filtrarProduccion;
window.filtrarVentas = ventas.filtrarVentas;
window.filtrarUtensilios = utensilios.filtrarUtensilios;
// Funciones de agregar
window.agregarInsumo = inventario.agregarInsumo;
window.guardarEditarInsumo = inventario.guardarEditarInsumo;
window.agregarCategoria = recetas.agregarCategoria;
window.eliminarCategoria = recetas.eliminarCategoria;
window.agregarReceta = recetas.agregarReceta;
window.guardarEditarReceta = recetas.guardarEditarReceta;
window.buscarInsumoParaReceta = recetas.buscarInsumoParaReceta;
window.agregarIngrediente = recetas.agregarIngrediente;
window.eliminarIngrediente = recetas.eliminarIngrediente;
window.mostrarIngredientes = recetas.mostrarIngredientes;
window.guardarCantidadIngrediente = recetas.guardarCantidadIngrediente;
window.eliminarIngredienteDeReceta = recetas.eliminarIngredienteDeReceta;
window.copiarRecetaEscalada = recetas.copiarRecetaEscalada;
window.producirDesdeReceta = recetas.producirDesdeReceta;
window.actualizarCostoProduccion = recetas.actualizarCostoProduccion;
window.agregarUtensilio = utensilios.agregarUtensilio;
window.guardarEditarUtensilio = utensilios.guardarEditarUtensilio;
window.mostrarHistorialUtensilio = utensilios.mostrarHistorialUtensilio;
// Funciones de confirmación
window.confirmarVentaPedido = produccion.confirmarVentaPedido;
window.confirmarCortesia = produccion.confirmarCortesia;
// Funciones de historial
window.toggleHistorialFecha = ventas.toggleHistorialFecha;

// ===== SISTEMA DE ROUTING =====
const rutasNombres = {
  'produccion': 'Inventario de Producción',
  'insumos': 'Inventario de Insumos',
  'utensilios': 'Inventario de Utensilios',
  'recetas': 'Recetas',
  'ventas': 'Ventas Realizadas'
};

const rutasUrls = {
  'produccion': '#/inventario-produccion',
  'insumos': '#/inventario-insumos',
  'utensilios': '#/inventario-utensilios',
  'recetas': '#/recetas',
  'ventas': '#/ventas'
};

export function actualizarTitulo(pestanaId) {
  const nombre = rutasNombres[pestanaId] || 'Chipactli';
  document.title = `Chipactli - ${nombre}`;
}

export function obtenerPestanaDeUrl() {
  const hash = window.location.hash || '#/inventario-produccion';
  if (hash === '#/inventario-produccion') return 'produccion';
  if (hash === '#/inventario-insumos') return 'insumos';
  if (hash === '#/inventario-utensilios') return 'utensilios';
  if (hash === '#/recetas') return 'recetas';
  if (hash === '#/ventas') return 'ventas';
  return 'produccion';
}

export function activarPestanaLink(event, id) {
  event.preventDefault();
  activarPestana(id);
  return false;
}

export function activarPestana(id, opciones = {}) {
  const urlObjetivo = rutasUrls[id] || '#/inventario-produccion';
  if (!opciones.skipHash) {
    if (window.location.hash !== urlObjetivo) {
      window.location.hash = urlObjetivo;
      return;
    }
  }
  
  actualizarTitulo(id);
  
  const pesanaAnterior = document.querySelector('.pestana.activo');
  if (pesanaAnterior) {
    pesanaAnterior.classList.remove('activo');
  }
  
  const pestanaActual = document.getElementById(id);
  if (pestanaActual) {
    pestanaActual.classList.add('activo');
  }
  
  const elementosMenu = document.querySelectorAll('.elementoMenu');
  elementosMenu.forEach(el => el.classList.remove('activo'));
  const elementoActivo = document.querySelector(`.elementoMenu[href="${rutasUrls[id]}"]`);
  if (elementoActivo) {
    elementoActivo.classList.add('activo');
  }
  
  const barra = document.querySelector('.barraLateral');
  const botonToggle = document.querySelector('.botonToggleMenu');
  barra.classList.remove('mostrada');
  botonToggle.classList.remove('oculto');
  
  if (id === 'insumos') {
    inventario.cargarInventario();
    inventario.cargarEstadisticasInventario();
  } else if (id === 'utensilios') {
    utensilios.cargarUtensilios();
    utensilios.cargarEstadisticasUtensilios();
  } else if (id === 'recetas') {
    recetas.cargarCategorias();
    recetas.cargarPestanasCategorias();
    recetas.cargarListadoRecetas();
  } else if (id === 'produccion') {
    produccion.cargarProduccion();
  } else if (id === 'ventas') {
    recetas.cargarCategorias();
    recetas.cargarPestanasCategorias();
    ventas.cargarEstadisticasVentas('mes');
    ventas.cargarVentas();
    ventas.cargarCortesias();
  }
}

export function alternarBarraLateral() {
  const barra = document.querySelector('.barraLateral');
  const boton = document.querySelector('.botonToggleMenu');
  barra.classList.toggle('mostrada');
  boton.classList.toggle('oculto');
}

// Manejador de cambio de URL hash
window.addEventListener('hashchange', () => {
  const pestana = obtenerPestanaDeUrl();
  activarPestana(pestana, { skipHash: true });
});

// Función para mostrar logo
export function mostrarLogoSiExiste() {
  const img = new Image();
  img.onload = function() {
    const logoEncabezado = document.getElementById('logoEncabezado');
    const logoBarraLateral = document.getElementById('logoBarraLateral');
    if (logoEncabezado) logoEncabezado.style.display = 'block';
    if (logoBarraLateral) logoBarraLateral.style.display = 'block';
  };
  img.onerror = function() {
    // Logo no existe, mantenerlo oculto
  };
  img.src = 'images/logo.png';
}

// ===== MANEJADOR DE WEBSOCKET =====
export function manejarMensajeWebSocket(datos) {
  console.log('Actualización en tiempo real:', datos.tipo);
  
  // Recargar datos según el tipo de evento
  if (datos.tipo === 'inventario_actualizado') {
    if (document.getElementById('insumos')?.classList.contains('activo')) {
      inventario.cargarInventario();
    }
  } else if (datos.tipo === 'recetas_actualizado') {
    if (document.getElementById('recetas')?.classList.contains('activo')) {
      recetas.cargarCategorias();
      recetas.cargarListadoRecetas();
    }
  } else if (datos.tipo === 'produccion_actualizado') {
    if (document.getElementById('produccion')?.classList.contains('activo')) {
      produccion.cargarProduccion();
    }
  } else if (datos.tipo === 'produccion_descuento') {
    const detalles = (datos.descuentos || [])
      .map(d => `${d.insumo}: ${d.cantidad.toFixed(2)} ${d.unidad}`)
      .join(', ');
    if (detalles) {
      agregarAlerta(
        `prod:${Date.now()}`,
        `Producción ${datos.receta}: descontado ${detalles}`,
        'advertencia'
      );
    }
  } else if (datos.tipo === 'ventas_actualizado') {
    if (document.getElementById('ventas')?.classList.contains('activo')) {
      ventas.cargarEstadisticasVentas('mes');
      ventas.cargarVentas();
      ventas.cargarCortesias();
    }
  } else if (datos.tipo === 'cortesias_actualizado') {
    if (document.getElementById('ventas')?.classList.contains('activo')) {
      ventas.cargarCortesias();
    }
  } else if (datos.tipo === 'categorias_actualizado') {
    if (document.getElementById('recetas')?.classList.contains('activo')) {
      recetas.cargarCategorias();
    }
  } else if (datos.tipo === 'utensilios_actualizado') {
    if (document.getElementById('utensilios')?.classList.contains('activo')) {
      utensilios.cargarUtensilios();
      utensilios.cargarEstadisticasUtensilios();
    }
  }
}

// ===== INICIALIZACIÓN =====
export function inicializar() {
  // Inicializar manejo de modales
  inicializarCierreModalPorFondo();
  
  // Mostrar logo si existe
  mostrarLogoSiExiste();
  
  // Intentar preparar audio
  prepararAudioAlerta();
  
  // Conectar WebSocket
  conectarWebSocket(manejarMensajeWebSocket);
  
  // Actualizar UI de alertas inicialmente
  actualizarUIAlertas();
  
  // Obtener pestaña actual de la URL
  const pestanaActual = obtenerPestanaDeUrl();
  actualizarTitulo(pestanaActual);
  activarPestana(pestanaActual, { skipHash: true });
  
  // Cargar categorías
  recetas.cargarCategorias();
  
  // Listener para eventos de actualizaciones de ventas y cortesías
  window.addEventListener('ventasActualizadas', () => {
    ventas.cargarVentas();
    ventas.cargarEstadisticasVentas(ventas.periodoVentaActual);
  });
  
  window.addEventListener('cortesiasActualizadas', () => {
    ventas.cargarCortesias();
  });
}

// Ejecutar inicialización cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializar);
} else {
  inicializar();
}

// Sistema de cambio automático de día a las 00:00
let diaActual = new Date().toDateString();

export function verificarCambioDia() {
  const ahora = new Date().toDateString();
  if (ahora !== diaActual) {
    diaActual = ahora;
    console.log('📅 Nuevo día detectado. Iniciando corte automático...');
  }
}

// Verificar cada minuto si cambió el día
setInterval(verificarCambioDia, 60000);
// Verificar también al cargar la página
document.addEventListener('DOMContentLoaded', verificarCambioDia);

// Exportar funciones públicas
export { inventario, recetas, produccion, ventas };
