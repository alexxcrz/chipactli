const API = "http://localhost:3001";
let categoriaActual = null;
let ingredientesTemporales = [];
let conteoAlertas = 0;
let ws = null;
const alertas = [];
const alertasPorClave = new Map();
const historialAlertas = [];
const MAX_HISTORIAL_ALERTAS = 200;
let pestanaAlertasActual = 'activas';
let audioCtx = null;
let audioAlertaPreparado = false;

// ===== SISTEMA DE ROUTING =====
const rutasNombres = {
  'produccion': 'Inventario de Producción',
  'insumos': 'Inventario de Insumos',
  'recetas': 'Recetas',
  'ventas': 'Ventas Realizadas'
};

const rutasUrls = {
  'produccion': '#/inventario-produccion',
  'insumos': '#/inventario-insumos',
  'recetas': '#/recetas',
  'ventas': '#/ventas'
};

function actualizarTitulo(pesanaId) {
  const nombre = rutasNombres[pesanaId] || 'Chipactli';
  document.title = `Chipactli - ${nombre}`;
}

function obtenerPestanaDeUrl() {
  const hash = window.location.hash || '#/inventario-produccion';
  if (hash === '#/inventario-produccion') return 'produccion';
  if (hash === '#/inventario-insumos') return 'insumos';
  if (hash === '#/recetas') return 'recetas';
  if (hash === '#/ventas') return 'ventas';
  return 'produccion';
}

// activarPestana y activarPestanaLink están definidas en main.js como módulos ES6
// y exportadas a window para uso global

// Toggle para contraer/expandir estadísticas
function toggleEstadisticas() {
  const grid = document.getElementById('gridEstadisticasInsumos');
  const boton = document.querySelector('.botonToggleEstadisticas');
  if (grid && boton) {
    grid.classList.toggle('contraido');
    boton.classList.toggle('contraido');
  }
}

// hashchange manejado por main.js

// Funciones de notificaciones - delegadas a módulo (main.js)
// Wrappers para compatibilidad con código existente en HTML

function mostrarNotificacion(mensaje, tipo = 'exito') {
  return window.mostrarNotificacion?.(mensaje, tipo);
}

function cerrarNotificacion() {
  return window.cerrarNotificacion?.();
}

function agregarAlerta(clave, mensaje, tipo = '') {
  return window.agregarAlerta?.(clave, mensaje, tipo);
}

function removerAlertaPorClave(clave) {
  // Esta función no está en window pero se usa internamente
  // Debe ser llamada desde el módulo de notificaciones si es necesaria
  if (window.notificaciones?.removerAlertaPorClave) {
    return window.notificaciones.removerAlertaPorClave(clave);
  }
}

function actualizarUIAlertas() {
  return window.actualizarUIAlertas?.();
}

// Variables de alertas ya declaradas al inicio del archivo (líneas 6-10)

function moverAlertaAHistorial(clave) {
  // Esta función necesita acceso local a alertas y historialAlertas
  // Por ahora mantenerla funcionando con las variables locales
  const alerta = alertasPorClave.get(clave);
  if (!alerta) return;
  
  const idx = alertas.indexOf(alerta);
  if (idx >= 0) alertas.splice(idx, 1);
  alertasPorClave.delete(clave);
  historialAlertas.unshift({
    mensaje: alerta.mensaje,
    fecha: new Date().toISOString()
  });
  const MAX_HISTORIAL_ALERTAS = 200;
  if (historialAlertas.length > MAX_HISTORIAL_ALERTAS) {
    historialAlertas.pop();
  }
  actualizarUIAlertas();
  cambiarPestanaAlertas('historial');
}

function cambiarPestanaAlertas(pestana) {
  pestanaAlertasActual = pestana;
  const tabActivas = document.getElementById('tabAlertasActivas');
  const tabHistorial = document.getElementById('tabAlertasHistorial');
  const listaActivas = document.getElementById('listaAlertas');
  const listaHistorial = document.getElementById('listaAlertasHistorial');
  if (!tabActivas || !tabHistorial || !listaActivas || !listaHistorial) return;

  if (pestana === 'historial') {
    tabHistorial.classList.add('activa');
    tabActivas.classList.remove('activa');
    listaHistorial.classList.remove('oculto');
    listaActivas.classList.add('oculto');
  } else {
    tabActivas.classList.add('activa');
    tabHistorial.classList.remove('activa');
    listaActivas.classList.remove('oculto');
    listaHistorial.classList.add('oculto');
  }
}

function formatearFechaAlerta(fechaISO) {
  if (!fechaISO) return '';
  return new Date(fechaISO).toLocaleString();
}

function prepararAudioAlerta() {
  if (audioAlertaPreparado) return;
  audioAlertaPreparado = true;
  document.addEventListener(
    'click',
    () => {
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    },
    { once: true }
  );
}

function reproducirSonidoAlerta() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const ahora = audioCtx.currentTime;
    const ganancia = audioCtx.createGain();
    ganancia.gain.setValueAtTime(0.0001, ahora);
    ganancia.gain.exponentialRampToValueAtTime(0.18, ahora + 0.02);
    ganancia.gain.exponentialRampToValueAtTime(0.001, ahora + 0.6);
    ganancia.connect(audioCtx.destination);

    const osc1 = audioCtx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(440, ahora);
    osc1.frequency.exponentialRampToValueAtTime(330, ahora + 0.3);
    osc1.connect(ganancia);
    osc1.start(ahora);
    osc1.stop(ahora + 0.35);

    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(660, ahora + 0.12);
    osc2.frequency.exponentialRampToValueAtTime(520, ahora + 0.45);
    osc2.connect(ganancia);
    osc2.start(ahora + 0.1);
    osc2.stop(ahora + 0.55);
  } catch (e) {
    // Silenciar errores de audio en navegadores con restricciones
  }
}

// Alternar barra lateral
function alternarBarraLateral() {
  const barra = document.querySelector('.barraLateral');
  const boton = document.querySelector('.botonToggleMenu');
  if (barra) barra.classList.toggle('mostrada');
  if (boton) boton.classList.toggle('oculto');
}

// Cerrar sidebar cuando se hace clic fuera de él
document.addEventListener('click', function(event) {
  const barra = document.querySelector('.barraLateral');
  const boton = document.querySelector('.botonToggleMenu');
  if (!barra || !boton) return;
  // Si el sidebar está abierto y se hace clic fuera de él
  if (barra.classList.contains('mostrada') && 
      !barra.contains(event.target) && 
      !boton.contains(event.target)) {
    barra.classList.remove('mostrada');
    boton.classList.remove('oculto');
  }
});

// Alternar alertas
function alternarAlertas() {
  const desplegable = document.getElementById('desplegableAlertas');
  desplegable.classList.toggle('mostrado');
  cambiarPestanaAlertas(pestanaAlertasActual);
}

// Abrir modal
function abrirModal(id) {
  document.getElementById(id).style.display = 'block';
  
  // Si es el modal de recetas, asegurarse de que el campo de unidad esté deshabilitado inicialmente
  if (id === 'modalReceta') {
    document.getElementById('unidadIngrediente').disabled = true;
    document.getElementById('unidadIngrediente').value = '';
  } else if (id === 'modalEditarReceta') {
    document.getElementById('editUnidadIngrediente').disabled = true;
    document.getElementById('editUnidadIngrediente').value = '';
  }
}

// Cerrar modal
function cerrarModal(id) {
  document.getElementById(id).style.display = 'none';
}

// Cerrar modal al hacer clic fuera
document.addEventListener('click', (evento) => {
  if (evento.target.classList.contains('modal')) {
    evento.target.style.display = 'none';
  }
});

// Mostrar logo si existe
function mostrarLogoSiExiste() {
  const img = new Image();
  img.onload = function() {
    const logoEnc = document.getElementById('logoEncabezado');
    const logoBarra = document.getElementById('logoBarraLateral');
    if (logoEnc) logoEnc.style.display = 'block';
    if (logoBarra) logoBarra.style.display = 'block';
  };
  img.onerror = function() {
    // Logo no existe, mantenerlo oculto
  };
  img.src = 'images/logo.png';
}

// Conectar WebSocket para actualizaciones en tiempo real

// Inicializar conexión WebSocket (manejado por main.js)
// Se carga automáticamente desde main.js al iniciar
// Variable ws ya declarada al inicio del archivo (línea 5)

// Funciones de filtrado en tiempo real
function filtrarProduccion(termBusqueda) {
  const filas = document.querySelectorAll('#cuerpoProduccion tr');
  const termino = termBusqueda.toLowerCase();
  
  filas.forEach(fila => {
    const nombreReceta = fila.cells[0]?.textContent.toLowerCase() || '';
    if (nombreReceta.includes(termino)) {
      fila.style.display = '';
    } else {
      fila.style.display = 'none';
    }
  });
}

function filtrarInventario(termBusqueda) {
  const filas = document.querySelectorAll('#cuerpoInventario tr');
  const termino = termBusqueda.toLowerCase();
  
  filas.forEach(fila => {
    if (fila.cells.length < 2) return; // Saltar fila vacía
    const codigo = fila.cells[0]?.textContent.toLowerCase() || '';
    const nombre = fila.cells[1]?.textContent.toLowerCase() || '';
    
    if (codigo.includes(termino) || nombre.includes(termino)) {
      fila.style.display = '';
    } else {
      fila.style.display = 'none';
    }
  });
}

function filtrarRecetas(termBusqueda) {
  const tarjetas = document.querySelectorAll('#cuerpoRecetas .tarjetaReceta');
  const termino = termBusqueda.toLowerCase();
  
  tarjetas.forEach(tarjeta => {
    const nombre = tarjeta.querySelector('h3')?.textContent.toLowerCase() || '';
    if (nombre.includes(termino)) {
      tarjeta.style.display = '';
    } else {
      tarjeta.style.display = 'none';
    }
  });
}

function filtrarVentas(termBusqueda) {
  const filas = document.querySelectorAll('#cuerpoVentas tr');
  const termino = termBusqueda.toLowerCase();
  
  filas.forEach(fila => {
    if (fila.cells.length < 2) return;
    const nombre = fila.cells[0]?.textContent.toLowerCase() || '';
    if (nombre.includes(termino)) {
      fila.style.display = '';
    } else {
      fila.style.display = 'none';
    }
  });
}

// ===== INVENTARIO =====
// Las funciones de carga están en window.inventario (exportadas por main.js)

async function agregarInsumo(event) {
  if (event) {
    event.preventDefault();
  }
  const codigo = document.getElementById('codigoInsumo').value;
  const nombre = document.getElementById('nombreInsumo').value;
  const unidad = document.getElementById('unidadInsumo').value;
  const cantidad = parseFloat(document.getElementById('cantidadInsumo').value);
  const costo = parseFloat(document.getElementById('costoInsumo').value);
  
  if (!codigo || !nombre || !unidad || isNaN(cantidad) || isNaN(costo)) {
    mostrarNotificacion('Por favor completa todos los campos', 'error');
    return;
  }
  
  try {
    const respuesta = await fetch(`${API}/inventario/agregar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, nombre, unidad, cantidad, costo })
    });
    
    if (respuesta.ok) {
      document.getElementById('formularioInsumo').reset();
      cerrarModal('modalInsumo');
      mostrarNotificacion('Insumo agregado correctamente', 'exito');
      // Hacer las llamadas en paralelo en lugar de una después de otra
      if (window.inventario) {
        await Promise.all([window.inventario.cargarInventario(), window.inventario.cargarEstadisticasInventario()]);
      }
    } else {
      const error = await respuesta.json();
      mostrarNotificacion('Error: ' + error.error, 'error');
    }
  } catch (error) {
    console.error('Error agregando insumo:', error);
  }
}

async function editarInsumo(id) {
  try {
    const respuesta = await fetch(`${API}/inventario/${id}`);
    const insumo = await respuesta.json();
    
    document.getElementById('editCodigoInsumo').value = insumo.codigo;
    document.getElementById('editNombreInsumo').value = insumo.nombre;
    document.getElementById('editUnidadInsumo').value = insumo.unidad;
    document.getElementById('editCantidadInsumo').value = insumo.cantidad_total;
    document.getElementById('editCostoInsumo').value = insumo.costo_total;
    document.getElementById('idEditInsumo').value = insumo.id;
    
    abrirModal('modalEditarInsumo');
  } catch (error) {
    console.error('Error cargando insumo:', error);
    mostrarNotificacion('Error al cargar el insumo', 'error');
  }
}

async function guardarEditarInsumo(event) {
  if (event) event.preventDefault();
  
  const id = document.getElementById('idEditInsumo').value;
  const nombre = document.getElementById('editNombreInsumo').value;
  const unidad = document.getElementById('editUnidadInsumo').value;
  const cantidad_total = parseFloat(document.getElementById('editCantidadInsumo').value);
  const costo_total = parseFloat(document.getElementById('editCostoInsumo').value);
  
  if (!nombre || !unidad || isNaN(cantidad_total) || isNaN(costo_total)) {
    mostrarNotificacion('Por favor completa todos los campos', 'error');
    return;
  }
  
  try {
    const respuesta = await fetch(`${API}/inventario/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, unidad, cantidad_total, costo_total })
    });
    
    if (respuesta.ok) {
      cerrarModal('modalEditarInsumo');
      if (window.inventario) {
        window.inventario.cargarInventario();
        window.inventario.cargarEstadisticasInventario();
      }
      mostrarNotificacion('Insumo actualizado correctamente', 'exito');
    }
  } catch (error) {
    console.error('Error actualizando insumo:', error);
    mostrarNotificacion('Error al actualizar el insumo', 'error');
  }
}

async function eliminarInsumo(id) {
  if (!confirm('¿Eliminar este insumo?')) return;
  
  try {
    const respuesta = await fetch(`${API}/inventario/${id}`, {
      method: 'DELETE'
    });
    
    if (respuesta.ok) {
      if (window.inventario) {
        window.inventario.cargarInventario();
        window.inventario.cargarEstadisticasInventario();
      }
    }
  } catch (error) {
    console.error('Error eliminando insumo:', error);
  }
}

async function mostrarHistorialInsumo(id, nombre) {
  try {
    const respuesta = await fetch(`${API}/inventario/${id}/historial`);
    const historial = await respuesta.json();
    const cuerpo = document.getElementById('cuerpoHistorialInsumo');
    const titulo = document.getElementById('tituloHistorialInsumo');

    titulo.textContent = `Historial de: ${nombre}`;
    cuerpo.innerHTML = '';

    if (!historial.length) {
      cuerpo.innerHTML = '<tr><td colspan="3" style="text-align:center">Sin movimientos</td></tr>';
    } else {
      historial.forEach(item => {
        const fecha = new Date(item.fecha_cambio).toLocaleString();
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${fecha}</td>
          <td>${item.cambio_cantidad.toFixed(2)}</td>
          <td>$${item.cambio_costo.toFixed(2)}</td>
        `;
        cuerpo.appendChild(fila);
      });
    }

    abrirModal('modalHistorialInsumo');
  } catch (error) {
    console.error('Error cargando historial de insumo:', error);
  }
}

// ===== RECETAS =====
// Las funciones de carga están en window.recetas (exportadas por main.js)

// Funcion original en app.js - mantener por compatibilidad
async function agregarCategoria(event) {
  if (event) {
    event.preventDefault();
  }
  const nombre = document.getElementById('nombreCategoria').value;
  
  if (!nombre.trim()) {
    mostrarNotificacion('Por favor ingresa un nombre de categoría', 'error');
    return;
  }
  
  try {
    const respuesta = await fetch(`${API}/categorias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre })
    });
    
    if (respuesta.ok) {
      document.getElementById('nombreCategoria').value = '';
      cerrarModal('modalCategoria');
      if (window.recetas) {
        await window.recetas.cargarCategorias();
        await window.recetas.cargarPestanasCategorias();
      }
      mostrarNotificacion('Categoría agregada correctamente', 'exito');
    } else {
      mostrarNotificacion('Error al guardar la categoría', 'error');
    }
  } catch (error) {
    console.error('Error agregando categoría:', error);
    mostrarNotificacion('Error al agregar la categoría', 'error');
  }
}

async function eliminarCategoria(id, nombre) {
  const confirmacion = confirm(`¿Estás seguro de eliminar la categoría "${nombre}"?\n\nEsta acción no se puede deshacer.`);
  
  if (!confirmacion) return;
  
  try {
    const respuesta = await fetch(`${API}/categorias/${id}`, {
      method: 'DELETE'
    });
    
    if (respuesta.ok) {
      mostrarNotificacion('✅ Categoría eliminada correctamente', 'exito');
      if (window.recetas) {
        await window.recetas.cargarCategorias();
        await window.recetas.cargarPestanasCategorias();
        window.recetas.cargarListadoRecetas();
      }
      categoriaRecetaActual = null;
      categoriaVentaActual = null;
      if (window.ventas) {
        window.ventas.cargarVentas();
      }
    } else {
      const error = await respuesta.json();
      mostrarNotificacion(`❌ ${error.error || 'Error al eliminar categoría'}`, 'error');
    }
  } catch (error) {
    console.error('Error eliminando categoría:', error);
    mostrarNotificacion('❌ Error de conexión', 'error');
  }
}

let categoriaRecetaActual = null;
let categoriaVentaActual = null;
let periodoVentaActual = 'mes';

async function agregarReceta(event) {
  if (event) {
    event.preventDefault();
  }
  const nombre = document.getElementById('nombreReceta').value;
  const idCategoria = document.getElementById('categoriaReceta').value;
  const gramaje = parseFloat(document.getElementById('gramajeReceta').value);
  
  if (!nombre || !idCategoria || isNaN(gramaje)) {
    mostrarNotificacion('Por favor completa los campos necesarios', 'error');
    return;
  }
  
  // Preparar ingredientes
  const ingredientes = ingredientesTemporales.map(ing => ({
    id_insumo: ing.id_insumo,
    cantidad: ing.cantidad,
    unidad: ing.unidad
  }));
  
  console.log('📝 Creando receta con ingredientes:', JSON.stringify(ingredientes, null, 2));
  
  try {
    const respuesta = await fetch(`${API}/recetas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        id_categoria: parseInt(idCategoria),
        gramaje,
        ingredientes
      })
    });
    
    if (respuesta.ok) {
      const resultado = await respuesta.json();
      console.log('✅ Receta creada:', resultado);
      
      document.getElementById('formularioReceta').reset();
      ingredientesTemporales = [];
      actualizarTablaIngredientes();
      cerrarModal('modalReceta');
      // WebSocket cargará automáticamente las recetas
      mostrarNotificacion('Receta creada correctamente', 'exito');
    } else {
      const error = await respuesta.json();
      mostrarNotificacion('Error: ' + error.error, 'error');
    }
  } catch (error) {
    console.error('Error creando receta:', error);
  }
}

async function buscarInsumoParaReceta(termino) {
  // Detectar si es edición revisando qué campo está visible
  const crearModal = document.getElementById('modalReceta');
  const editarModal = document.getElementById('modalEditarReceta');
  
  const esEdicion = editarModal && editarModal.style.display === 'block';
  
  const idListaBusqueda = esEdicion ? 'editListaBusquedaInsumos' : 'listaBusquedaInsumos';
  const idInsumoInput = esEdicion ? 'editInsumoSeleccionado' : 'insumoSeleccionado';
  const idInsumoId = esEdicion ? 'editIdInsumoSeleccionado' : 'idInsumoSeleccionado';
  
  const listaBusqueda = document.getElementById(idListaBusqueda);
  if (termino.length < 1) {
    listaBusqueda.innerHTML = '';
    listaBusqueda.style.display = 'none';
    return;
  }
  
  try {
    const respuesta = await fetch(`${API}/inventario?busqueda=${encodeURIComponent(termino)}`);
    const insumos = await respuesta.json();
    listaBusqueda.innerHTML = '';
    listaBusqueda.style.display = 'block';
    
    insumos.forEach(insumo => {
      const opcion = document.createElement('div');
      opcion.className = 'elementoSugerencia';
      opcion.textContent = `${insumo.nombre} (${insumo.codigo})`;
      opcion.onclick = () => {
        document.getElementById(idInsumoInput).value = insumo.nombre;
        document.getElementById(idInsumoId).value = insumo.id;
        
        // Llenar automáticamente la unidad
        const idUnidadField = esEdicion ? 'editUnidadIngrediente' : 'unidadIngrediente';
        const unidadSelect = document.getElementById(idUnidadField);
        unidadSelect.value = insumo.unidad || '';
        unidadSelect.disabled = true; // Deshabilitar para que no se pueda cambiar
        
        listaBusqueda.innerHTML = '';
        listaBusqueda.style.display = 'none';
      };
      listaBusqueda.appendChild(opcion);
    });

    if (!insumos.length) {
      listaBusqueda.style.display = 'none';
    }
  } catch (error) {
    console.error('Error buscando insumo:', error);
  }
}

function agregarIngrediente(esEdicion = false) {
  const prefijo = esEdicion ? 'edit' : '';
  const idFieldId = prefijo ? 'editIdInsumoSeleccionado' : 'idInsumoSeleccionado';
  const nombreFieldId = prefijo ? 'editInsumoSeleccionado' : 'insumoSeleccionado';
  const cantidadFieldId = prefijo ? 'editCantidadIngrediente' : 'cantidadIngrediente';
  const unidadFieldId = prefijo ? 'editUnidadIngrediente' : 'unidadIngrediente';
  
  const idInsumo = parseInt(document.getElementById(idFieldId).value);
  const nombreInsumo = document.getElementById(nombreFieldId).value;
  const cantidad = parseFloat(document.getElementById(cantidadFieldId).value);
  const unidad = document.getElementById(unidadFieldId).value;
  
  if (!idInsumo || !nombreInsumo || isNaN(cantidad) || !unidad) {
    mostrarNotificacion('Por favor completa todos los campos', 'error');
    return;
  }
  
  // Verificar que no exista duplicado
  if (ingredientesTemporales.some(ing => ing.id_insumo === idInsumo)) {
    mostrarNotificacion('Este insumo ya está en la receta', 'error');
    return;
  }
  
  ingredientesTemporales.push({
    id_insumo: idInsumo,
    nombre: nombreInsumo,
    cantidad,
    unidad
  });
  
  console.log('✅ Ingrediente agregado:', { id_insumo: idInsumo, cantidad, unidad });
  console.log('📋 Total ingredientes:', ingredientesTemporales);
  
  document.getElementById(idFieldId).value = '';
  document.getElementById(nombreFieldId).value = '';
  document.getElementById(cantidadFieldId).value = '';
  document.getElementById(unidadFieldId).value = '';
  document.getElementById(unidadFieldId).disabled = true; // Volver a deshabilitar
  
  actualizarTablaIngredientes();
}

function eliminarIngrediente(indice) {
  ingredientesTemporales.splice(indice, 1);
  actualizarTablaIngredientes();
}

function actualizarTablaIngredientes() {
  const tabla = document.getElementById('tablaIngredientesTemporales');
  tabla.innerHTML = '';
  
  ingredientesTemporales.forEach((ing, idx) => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${ing.nombre}</td>
      <td>${parseFloat(ing.cantidad).toFixed(2)} ${ing.unidad}</td>
      <td><button onclick="eliminarIngrediente(${idx})" class="botonPequeno botonDanger">×</button></td>
    `;
    tabla.appendChild(fila);
  });
}

async function mostrarIngredientes(idReceta) {
  try {
    const respuesta = await fetch(`${API}/recetas/${idReceta}`);
    if (!respuesta.ok) {
      mostrarNotificacion('Error al cargar la receta', 'error');
      return;
    }
    const receta = await respuesta.json();
    
    let html = `<h3 style="margin-bottom:12px;color:#1a1a1a;font-size:16px">${receta.nombre}</h3><ul style="list-style:none;padding:0" id="listaIngredientesModal">`;
    
    if (!receta.ingredientes || receta.ingredientes.length === 0) {
      html += '<li style="padding:10px;color:#999">Sin ingredientes agregados</li>';
    } else {
      receta.ingredientes.forEach((ing, idx) => {
        html += `<li style="padding:8px;background:#f5f5f5;margin-bottom:6px;border-radius:6px;border-left:4px solid #4a9b5e;display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span style="flex:1;font-size:13px">${ing.nombre}</span>
          <input type="number" id="cantidad_${ing.id}" value="${parseFloat(ing.cantidad).toFixed(2)}" step="0.01" style="width:70px;padding:4px;border:1px solid #ddd;border-radius:4px;text-align:center;font-size:12px">
          <span style="min-width:35px;font-size:12px">${ing.unidad}</span>
          <div style="display:flex;gap:4px">
            <button onclick="guardarCantidadIngrediente(${idReceta}, ${ing.id})" class="botonPequeno" style="background:#4a9b5e;padding:4px 10px">💾</button>
            <button onclick="eliminarIngredienteDeReceta(${idReceta}, ${ing.id}, '${ing.nombre.replace(/'/g, "\\'")}')" class="botonPequeno botonDanger" style="padding:4px 10px">×</button>
          </div>
        </li>`;
      });
    }
    html += '</ul>';
    
    const detalles = document.getElementById('detallesIngredientes');
    detalles.innerHTML = html;
    abrirModal('modalIngredientes');
  } catch (error) {
    console.error('Error cargando ingredientes:', error);
    mostrarNotificacion('Error al cargar los ingredientes', 'error');
  }
}

async function guardarCantidadIngrediente(idReceta, idIngrediente) {
  const nuevaCantidad = parseFloat(document.getElementById(`cantidad_${idIngrediente}`).value);
  
  if (isNaN(nuevaCantidad) || nuevaCantidad <= 0) {
    mostrarNotificacion('Por favor ingresa una cantidad válida', 'error');
    return;
  }
  
  try {
    // Obtener la receta actual
    const respuesta = await fetch(`${API}/recetas/${idReceta}`);
    const receta = await respuesta.json();
    
    // Actualizar la cantidad del ingrediente específico
    const ingredientesActualizados = (receta.ingredientes || []).map(ing => {
      if (ing.id === idIngrediente) {
        return {
          id_insumo: ing.id_insumo,
          cantidad: nuevaCantidad,
          unidad: ing.unidad
        };
      }
      return {
        id_insumo: ing.id_insumo,
        cantidad: ing.cantidad,
        unidad: ing.unidad
      };
    });
    
    // Actualizar la receta
    const respuestaActualizar = await fetch(`${API}/recetas/${idReceta}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: receta.nombre,
        id_categoria: receta.id_categoria,
        gramaje: receta.gramaje,
        ingredientes: ingredientesActualizados
      })
    });
    
    if (respuestaActualizar.ok) {
      mostrarNotificacion('Cantidad actualizada correctamente', 'exito');
      // Recargar el modal con los nuevos datos
      mostrarIngredientes(idReceta);
    }
  } catch (error) {
    console.error('Error actualizando cantidad:', error);
    mostrarNotificacion('Error al actualizar la cantidad', 'error');
  }
}

async function eliminarIngredienteDeReceta(idReceta, idIngrediente, nombreIngrediente) {
  if (!confirm(`¿Eliminar "${nombreIngrediente}" de esta receta?`)) return;
  
  try {
    // Obtener la receta actual
    const respuesta = await fetch(`${API}/recetas/${idReceta}`);
    const receta = await respuesta.json();
    
    // Filtrar el ingrediente a eliminar
    const ingredientesFiltrados = (receta.ingredientes || []).filter(ing => ing.id !== idIngrediente);
    
    // Actualizar la receta sin ese ingrediente
    const respuestaActualizar = await fetch(`${API}/recetas/${idReceta}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: receta.nombre,
        id_categoria: receta.id_categoria,
        gramaje: receta.gramaje,
        ingredientes: ingredientesFiltrados.map(ing => ({
          id_insumo: ing.id_insumo,
          cantidad: ing.cantidad,
          unidad: ing.unidad
        }))
      })
    });
    
    if (respuestaActualizar.ok) {
      // Recargar el modal con los nuevos ingredientes
      mostrarIngredientes(idReceta);
      mostrarNotificacion('Ingrediente eliminado correctamente', 'exito');
    }
  } catch (error) {
    console.error('Error eliminando ingrediente:', error);
    mostrarNotificacion('Error al eliminar el ingrediente', 'error');
  }
}

async function calcularCapacidadProduccion(idReceta) {
  try {
    const respuesta = await fetch(`${API}/recetas/calcular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_receta: idReceta })
    });
    
    const resultado = await respuesta.json();
    
    mostrarNotificacion(`Piezas máximas: ${resultado.piezas_maximas} | Costo/pieza: $${resultado.costo_por_pieza.toFixed(2)}`, 'exito');
  } catch (error) {
    console.error('Error calculando:', error);
  }
}

async function editarReceta(id) {
  try {
    const respuesta = await fetch(`${API}/recetas/${id}`);
    const receta = await respuesta.json();
    
    document.getElementById('editNombreReceta').value = receta.nombre;
    document.getElementById('editCategoriaReceta').value = receta.id_categoria || '';
    document.getElementById('editGramajeReceta').value = receta.gramaje || 0;
    document.getElementById('idEditReceta').value = receta.id;
    
    // Cargar ingredientes temporales
    ingredientesTemporales = (receta.ingredientes || []).map(ing => ({
      id_insumo: ing.id_insumo,
      nombre: ing.nombre,
      cantidad: ing.cantidad,
      unidad: ing.unidad
    }));
    actualizarTablaIngredientes();
    
    abrirModal('modalEditarReceta');
  } catch (error) {
    console.error('Error cargando receta:', error);
    mostrarNotificacion('Error al cargar la receta', 'error');
  }
}

async function guardarEditarReceta(event) {
  if (event) event.preventDefault();
  
  const id = document.getElementById('idEditReceta').value;
  const nombre = document.getElementById('editNombreReceta').value;
  const id_categoria = document.getElementById('editCategoriaReceta').value;
  const gramaje = parseFloat(document.getElementById('editGramajeReceta').value);
  
  if (!nombre || !id_categoria || isNaN(gramaje)) {
    mostrarNotificacion('Por favor completa los campos necesarios', 'error');
    return;
  }
  
  const ingredientes = ingredientesTemporales.map(ing => ({
    id_insumo: ing.id_insumo,
    cantidad: ing.cantidad,
    unidad: ing.unidad
  }));
  
  try {
    const respuesta = await fetch(`${API}/recetas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        id_categoria: parseInt(id_categoria),
        gramaje,
        ingredientes
      })
    });
    
    if (respuesta.ok) {
      document.getElementById('editNombreReceta').value = '';
      document.getElementById('editCategoriaReceta').value = '';
      ingredientesTemporales = [];
      actualizarTablaIngredientes();
      cerrarModal('modalEditarReceta');
      // WebSocket cargará automáticamente las recetas
      mostrarNotificacion('Receta actualizada correctamente', 'exito');
    }
  } catch (error) {
    console.error('Error actualizando receta:', error);
    mostrarNotificacion('Error al actualizar la receta', 'error');
  }
}

async function eliminarReceta(id) {
  if (!confirm('¿Eliminar esta receta?')) return;
  
  try {
    const respuesta = await fetch(`${API}/recetas/${id}`, {
      method: 'DELETE'
    });
    
    if (respuesta.ok) {
      // WebSocket cargará automáticamente las recetas
      mostrarNotificacion('Receta eliminada correctamente', 'exito');
    }
  } catch (error) {
    console.error('Error eliminando receta:', error);
  }
}

// ===== PRODUCCIÓN =====
let ventaPendiente = null;
let cortesiaPendiente = null;

async function agregarProduccion() {
  const nombreReceta = document.getElementById('nombreRecetaProduccion').value;
  const cantidad = parseInt(document.getElementById('cantidadProduccion').value);
  const costoProduccion = parseFloat(document.getElementById('costoProduccion').value);
  const precioVenta = parseFloat(document.getElementById('precioVenta').value);
  
  if (!nombreReceta || isNaN(cantidad) || isNaN(costoProduccion) || isNaN(precioVenta)) {
    mostrarNotificacion('Por favor completa todos los campos', 'error');
    return;
  }
  
  try {
    const respuesta = await fetch(`${API}/produccion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre_receta: nombreReceta,
        cantidad,
        costo_produccion: costoProduccion,
        precio_venta: precioVenta
      })
    });
    
    if (respuesta.ok) {
      document.getElementById('formularioProduccion').reset();
      if (window.produccion) {
        window.produccion.cargarProduccion();
      }
      mostrarNotificacion('Producción registrada correctamente', 'exito');
    }
  } catch (error) {
    console.error('Error registrando producción:', error);
  }
}

async function eliminarProduccion(id) {
  if (!confirm('¿Eliminar este registro?')) return;
  
  try {
    const respuesta = await fetch(`${API}/produccion/${id}`, {
      method: 'DELETE'
    });
    
    if (respuesta.ok) {
      if (window.produccion) {
        window.produccion.cargarProduccion();
      }
    }
  } catch (error) {
    console.error('Error eliminando producción:', error);
  }
}

// ===== VENTAS =====


function abrirModalVenta(idProduccion, nombreReceta, cantidad, costoProduccion, precioVenta) {
  ventaPendiente = { idProduccion, nombreReceta, cantidad, costoProduccion, precioVenta };
  const input = document.getElementById('numeroPedidoVenta');
  if (input) input.value = '';
  abrirModal('modalVentaPedido');
}

async function confirmarVentaPedido(event) {
  if (event) event.preventDefault();
  if (!ventaPendiente) return;
  const numeroPedido = document.getElementById('numeroPedidoVenta').value.trim();
  if (!numeroPedido) {
    mostrarNotificacion('Por favor ingresa el numero de pedido', 'error');
    return;
  }
  cerrarModal('modalVentaPedido');
  const { idProduccion, nombreReceta, cantidad, costoProduccion, precioVenta } = ventaPendiente;
  ventaPendiente = null;
  await registrarVenta(idProduccion, nombreReceta, cantidad, costoProduccion, precioVenta, numeroPedido);
}

async function registrarVenta(idProduccion, nombreReceta, cantidad, costoProduccion, precioVenta, numeroPedido) {
  try {
    const respuesta = await fetch(`${API}/ventas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre_receta: nombreReceta,
        cantidad: cantidad,
        fecha_produccion: new Date().toISOString(),
        costo_produccion: costoProduccion,
        precio_venta: precioVenta,
        id_produccion: idProduccion,
        numero_pedido: numeroPedido
      })
    });
    
    if (respuesta.ok) {
      if (window.produccion) window.produccion.cargarProduccion();
      if (window.ventas) window.ventas.cargarVentas();
      if (window.ventas) window.ventas.cargarEstadisticasVentas('mes');
      mostrarNotificacion('Venta registrada correctamente', 'exito');
    }
  } catch (error) {
    console.error('Error registrando venta:', error);
  }
}

function abrirModalCortesia(idProduccion, nombreReceta, cantidad) {
  cortesiaPendiente = { idProduccion, nombreReceta, cantidad };
  const inputPedido = document.getElementById('numeroPedidoCortesia');
  const inputMotivo = document.getElementById('motivoCortesia');
  const inputPara = document.getElementById('paraQuienCortesia');
  if (inputPedido) inputPedido.value = '';
  if (inputMotivo) inputMotivo.value = '';
  if (inputPara) inputPara.value = '';
  abrirModal('modalCortesia');
}

async function confirmarCortesia(event) {
  if (event) event.preventDefault();
  if (!cortesiaPendiente) return;
  const numeroPedido = document.getElementById('numeroPedidoCortesia').value.trim();
  const motivo = document.getElementById('motivoCortesia').value.trim();
  const paraQuien = document.getElementById('paraQuienCortesia').value.trim();
  if (!numeroPedido || !motivo) {
    mostrarNotificacion('Por favor completa numero de pedido y motivo', 'error');
    return;
  }
  cerrarModal('modalCortesia');
  const { idProduccion, nombreReceta, cantidad } = cortesiaPendiente;
  cortesiaPendiente = null;
  await registrarCortesia(idProduccion, nombreReceta, cantidad, numeroPedido, motivo, paraQuien);
}

async function registrarCortesia(idProduccion, nombreReceta, cantidad, numeroPedido, motivo, paraQuien) {
  try {
    const respuesta = await fetch(`${API}/cortesia/${idProduccion}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre_receta: nombreReceta,
        cantidad: cantidad,
        numero_pedido: numeroPedido,
        motivo: motivo,
        para_quien: paraQuien
      })
    });
    
    if (respuesta.ok) {
      if (window.produccion) {
        window.produccion.cargarProduccion();
      }
      if (window.ventas) {
        window.ventas.cargarCortesias();
      }
      mostrarNotificacion('Cortesía registrada - ingredientes descontados, sin ganancia', 'exito');
    }
  } catch (error) {
    console.error('Error registrando cortesía:', error);
    mostrarNotificacion('Error al registrar cortesía', 'error');
  }
}

async function cargarEstadisticasVentas(periodo) {
  periodoVentaActual = periodo;
  try {
    let url = `${API}/ventas/estadisticas/${periodo}`;
    if (categoriaVentaActual !== null) {
      url += `?categoria=${categoriaVentaActual}`;
    }
    
    const respuesta = await fetch(url);
    if (!respuesta.ok) return;
    const estadisticas = await respuesta.json();
    
    const el = (id) => document.getElementById(id);
    if (el('totalVentas')) el('totalVentas').textContent = estadisticas.total_sales || 0;
    if (el('unidadesVendidas')) el('unidadesVendidas').textContent = estadisticas.total_units || 0;
    if (el('inversionTotal')) el('inversionTotal').textContent = `$${(estadisticas.total_cost || 0).toFixed(2)}`;
    if (el('ingresosTotal')) el('ingresosTotal').textContent = `$${(estadisticas.total_revenue || 0).toFixed(2)}`;
    if (el('gananciaTotal')) el('gananciaTotal').textContent = `$${(estadisticas.total_profit || 0).toFixed(2)}`;
    if (el('costosTotal')) el('costosTotal').textContent = `$${(estadisticas.total_cost || 0).toFixed(2)}`;
  } catch (error) {
    console.error('Error cargando estadísticas:', error);
  }
}

// Cerrar modales
document.addEventListener('click', (evento) => {
  if (evento.target.classList.contains('modal')) {
    evento.target.style.display = 'none';
  }
});

// Expandir/contraer historial por fecha
function toggleHistorialFecha(fecha) {
  const detalles = document.getElementById(`detalles-${fecha}`);
  const boton = document.getElementById(`boton-${fecha}`);
  
  if (detalles.style.display === 'none' || detalles.style.display === '') {
    detalles.style.display = 'block';
    boton.textContent = '▼';
  } else {
    detalles.style.display = 'none';
    boton.textContent = '▶';
  }
}

async function mostrarHistorialInversion() {
  try {
    const respuesta = await fetch(`${API}/inventario/historial/agrupar/fechas`);
    const historialPorFecha = await respuesta.json();
    
    const modal = document.getElementById('modalHistorialInv');
    const listaDiv = modal.querySelector('#listaHistorialPorFecha');
    
    if (!historialPorFecha || historialPorFecha.length === 0) {
      listaDiv.innerHTML = '<p style="text-align:center;color:#999">No hay registros de inversión</p>';
      abrirModal('modalHistorialInv');
      return;
    }
    
    let html = '';
    
    historialPorFecha.forEach(dia => {
      const fechaObj = new Date(dia.fecha);
      const fechaFormato = fechaObj.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      html += `
        <div style="border:2px solid #ddd;border-radius:8px;margin-bottom:15px;overflow:hidden">
          <div onclick="toggleHistorialFecha('${dia.fecha}')" 
               style="background:#f5f5f5;padding:15px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none">
            <div style="flex:1">
              <h4 style="margin:0;color:#333;font-size:16px;text-transform:capitalize">${fechaFormato}</h4>
              <p style="margin:5px 0 0 0;font-size:12px;color:#666">${dia.total_insumos} insumo(s) agregado(s) · Total: $${dia.total_costo.toFixed(2)}</p>
            </div>
            <div style="display:flex;gap:10px;align-items:center">
              <button onclick="event.stopPropagation();eliminarHistorialFecha('${dia.fecha}')" 
                      style="background:#f44336;color:white;border:none;padding:8px 12px;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600"
                      onmouseover="this.style.background='#d32f2f'" 
                      onmouseout="this.style.background='#f44336'">🗑️ Eliminar</button>
              <button id="boton-${dia.fecha}" style="background:none;border:none;font-size:18px;cursor:pointer;padding:0 10px">▶</button>
            </div>
          </div>
          
          <div id="detalles-${dia.fecha}" style="display:none;padding:0">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f0f0f0">
                  <th style="padding:12px;text-align:left;border-bottom:1px solid #ddd;font-weight:600;font-size:13px">Hora</th>
                  <th style="padding:12px;text-align:left;border-bottom:1px solid #ddd;font-weight:600;font-size:13px">Código</th>
                  <th style="padding:12px;text-align:left;border-bottom:1px solid #ddd;font-weight:600;font-size:13px">Insumo</th>
                  <th style="padding:12px;text-align:center;border-bottom:1px solid #ddd;font-weight:600;font-size:13px">Cantidad</th>
                  <th style="padding:12px;text-align:right;border-bottom:1px solid #ddd;font-weight:600;font-size:13px">Costo</th>
                </tr>
              </thead>
              <tbody>
      `;
      
      dia.insumos.forEach(insumo => {
        html += `
                <tr style="border-bottom:1px solid #eee">
                  <td style="padding:12px;font-size:12px;color:#666">${insumo.hora}</td>
                  <td style="padding:12px;font-size:12px;color:#1a1a1a;font-weight:600">${insumo.codigo}</td>
                  <td style="padding:12px;font-size:13px;color:#333">${insumo.nombre}</td>
                  <td style="padding:12px;text-align:center;color:#666">${insumo.cambio_cantidad} ${insumo.unidad}</td>
                  <td style="padding:12px;text-align:right;color:#4a9b5e;font-weight:600">$${insumo.cambio_costo.toFixed(2)}</td>
                </tr>
        `;
      });
      
      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    });
    
    listaDiv.innerHTML = html;
    abrirModal('modalHistorialInv');
  } catch (error) {
    console.error('Error cargando historial de inversión:', error);
    mostrarNotificacion('Error', 'No se pudo cargar el historial de inversiones', 'error');
  }
}

async function eliminarHistorialFecha(fecha) {
  const fechaFormato = new Date(fecha).toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const confirmar = await abrirModalConfirmacion(
    '¿Eliminar historial de este día?',
    `Se eliminará todo el historial de inversión del ${fechaFormato}. Esta acción ajustará las cantidades y costos en el inventario.`,
    'Eliminar'
  );

  if (!confirmar) return;

  try {
    const respuesta = await fetch(`${API}/inventario/historial/fecha/${fecha}`, {
      method: 'DELETE'
    });

    if (respuesta.ok) {
      mostrarNotificacion('✅ Historial eliminado exitosamente', 'exito');
      // Recargar el historial y las estadísticas
      await mostrarHistorialInversion();
      if (window.inventario?.cargarInventario) window.inventario.cargarInventario();
      if (window.inventario?.cargarEstadisticasInventario) window.inventario.cargarEstadisticasInventario();
    } else {
      mostrarNotificacion('❌ Error al eliminar historial', 'error');
    }
  } catch (error) {
    console.error('Error eliminando historial:', error);
    mostrarNotificacion('❌ Error de conexión', 'error');
  }
}

// ===== ESCALADO DE RECETA =====

function abrirProduccionRapida(idReceta, nombreReceta, costoPorPieza = 0) {
  document.getElementById('idRecetaProducir').value = idReceta;
  document.getElementById('nombreRecetaProducir').value = nombreReceta;
  document.getElementById('cantidadProducir').value = 1;
  document.getElementById('costoPorPiezaProducir').value = costoPorPieza;
  actualizarCostoProduccion();
  document.getElementById('precioVentaProducir').value = '';
  abrirModal('modalProduccionRapida');
}

function actualizarCostoProduccion() {
  const costoPorPieza = parseFloat(document.getElementById('costoPorPiezaProducir').value) || 0;
  const cantidad = parseFloat(document.getElementById('cantidadProducir').value) || 0;
  const total = costoPorPieza * cantidad;
  document.getElementById('costoProducir').value = total.toFixed(2);
}

async function producirDesdeReceta() {
  const nombreReceta = document.getElementById('nombreRecetaProducir').value;
  const idReceta = parseInt(document.getElementById('idRecetaProducir').value, 10);
  const cantidad = parseInt(document.getElementById('cantidadProducir').value);
  const costoProduccion = parseFloat(document.getElementById('costoProducir').value);
  const precioVenta = parseFloat(document.getElementById('precioVentaProducir').value);
  
  if (!nombreReceta || isNaN(cantidad) || cantidad <= 0 || isNaN(costoProduccion) || isNaN(precioVenta)) {
    mostrarNotificacion('Por favor completa todos los campos correctamente', 'error');
    return;
  }
  
  try {
    const respuesta = await fetch(`${API}/produccion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_receta: Number.isFinite(idReceta) ? idReceta : null,
        nombre_receta: nombreReceta,
        cantidad,
        costo_produccion: costoProduccion,
        precio_venta: precioVenta
      })
    });
    
    if (respuesta.ok) {
      cerrarModal('modalProduccionRapida');
      mostrarNotificacion('Producción registrada correctamente', 'exito');
      // Cambiar a la pestaña de producción si no está activa
      activarPestana('produccion');
    }
  } catch (error) {
    console.error('Error registrando producción:', error);
    mostrarNotificacion('Error al registrar la producción', 'error');
  }
}

async function abrirEscalarReceta(idReceta, nombreReceta, gramajeOriginal) {
  document.getElementById('idRecetaEscalar').value = idReceta;
  document.getElementById('gramajeOriginal').value = `${gramajeOriginal}g (${nombreReceta})`;
  document.getElementById('nuevoGramaje').value = '';
  abrirModal('modalEscalarReceta');
}

async function copiarRecetaEscalada() {
  const idRecetaOriginal = document.getElementById('idRecetaEscalar').value;
  const nuevoGramaje = parseFloat(document.getElementById('nuevoGramaje').value);
  
  if (isNaN(nuevoGramaje) || nuevoGramaje <= 0) {
    mostrarNotificacion('Por favor ingresa un gramaje válido', 'error');
    return;
  }
  
  try {
    // Obtener la receta original
    const respuesta = await fetch(`${API}/recetas/${idRecetaOriginal}`);
    const recetaOriginal = await respuesta.json();
    
    const gramajeOriginal = recetaOriginal.gramaje || 0;
    
    if (gramajeOriginal === 0) {
      mostrarNotificacion('La receta original no tiene gramaje definido', 'error');
      return;
    }
    
    // Calcular factor de escalado
    const factor = nuevoGramaje / gramajeOriginal;
    
    // Escalar ingredientes
    const ingredientesEscalados = (recetaOriginal.ingredientes || []).map(ing => ({
      id_insumo: ing.id_insumo,
      cantidad: ing.cantidad * factor,
      unidad: ing.unidad
    }));
    
    // Crear nueva receta con el escalado
    const respuestaCrear = await fetch(`${API}/recetas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: `${recetaOriginal.nombre} (${nuevoGramaje}g)`,
        id_categoria: recetaOriginal.id_categoria,
        gramaje: nuevoGramaje,
        ingredientes: ingredientesEscalados
      })
    });
    
    if (respuestaCrear.ok) {
      cerrarModal('modalEscalarReceta');
      // WebSocket cargará automáticamente las recetas
      mostrarNotificacion(`Receta escalada creada correctamente (factor: ${factor.toFixed(2)}x)`, 'exito');
    }
  } catch (error) {
    console.error('Error escalando receta:', error);
    mostrarNotificacion('Error al escalar la receta', 'error');
  }
}

// Sistema de cambio automático de día a las 00:00
let diaActual = new Date().toDateString();

function verificarCambioDia() {
  const ahora = new Date().toDateString();
  if (ahora !== diaActual) {
    diaActual = ahora;
    console.log('📅 Nuevo día detectado. Iniciando corte automático...');
    // Aquí puedes agregar lógica adicional si es necesaria para el corte automático
  }
}

// Verificar cada minuto si cambió el día
setInterval(verificarCambioDia, 60000);
// Verificar también al cargar la página
document.addEventListener('DOMContentLoaded', verificarCambioDia);

// Cargar datos al iniciar
window.addEventListener('load', () => {
  mostrarLogoSiExiste();
  
  const pestanaActual = obtenerPestanaDeUrl();
  actualizarTitulo(pestanaActual);
  
  // Esperar a que los módulos ES6 (main.js) se carguen antes de activar la pestaña
  const activarConModulos = () => {
    if (window.recetas && window.inventario && window.produccion && window.ventas && window.activarPestana) {
      window.activarPestana(pestanaActual, { skipHash: true });
    } else {
      // Si los módulos aún no están listos, esperar 50ms y reintentar
      setTimeout(activarConModulos, 50);
    }
  };
  
  activarConModulos();
});
