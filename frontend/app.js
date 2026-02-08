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

function activarPestanaLink(event, id) {
  event.preventDefault();
  activarPestana(id);
  return false;
}

function activarPestana(id, opciones = {}) {
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
    cargarInventario();
    cargarEstadisticasInventario();
  } else if (id === 'recetas') {
    cargarCategorias();
    cargarPestanasCategorias();
    cargarListadoRecetas();
  } else if (id === 'produccion') {
    cargarProduccion();
  } else if (id === 'ventas') {
    cargarPestanasCategorias();
    cargarEstadisticasVentas('mes');
    cargarVentas();
    cargarCortesias();
  }
}

window.addEventListener('hashchange', () => {
  const pestana = obtenerPestanaDeUrl();
  activarPestana(pestana, { skipHash: true });
});

function mostrarNotificacion(mensaje, tipo = 'exito') {
  const modal = document.getElementById('modalNotificacion');
  const fondo = document.getElementById('fondoNotificacion');
  const titulo = document.getElementById('tituloNotificacion');
  const textoMensaje = document.getElementById('mensajeNotificacion');
  
  modal.className = `modalNotificacion ${tipo}`;
  
  if (tipo === 'exito') {
    titulo.textContent = '✅ Éxito';
  } else if (tipo === 'error') {
    titulo.textContent = '❌ Error';
  } else if (tipo === 'advertencia') {
    titulo.textContent = '⚠️ Advertencia';
  }
  
  textoMensaje.textContent = mensaje;
  modal.style.display = 'block';
  fondo.style.display = 'block';
}

function cerrarNotificacion() {
  const modal = document.getElementById('modalNotificacion');
  const fondo = document.getElementById('fondoNotificacion');
  modal.style.display = 'none';
  fondo.style.display = 'none';
}

function actualizarUIAlertas() {
  const lista = document.getElementById('listaAlertas');
  const listaHistorial = document.getElementById('listaAlertasHistorial');
  const distintivo = document.getElementById('conteoAlertas');
  if (!lista || !listaHistorial || !distintivo) return;

  lista.innerHTML = '';
  listaHistorial.innerHTML = '';
  if (alertas.length === 0) {
    const item = document.createElement('div');
    item.className = 'elementoAlerta';
    item.textContent = 'Sin alertas';
    item.style.cursor = 'default';
    lista.appendChild(item);
  } else {
    alertas.forEach(alerta => {
      const item = document.createElement('div');
      item.className = `elementoAlerta${alerta.tipo ? ' ' + alerta.tipo : ''}`;
      item.innerHTML = `
        <div>${alerta.mensaje}</div>
        <div class="fechaAlerta">${formatearFechaAlerta(alerta.fecha)}</div>
      `;
      item.addEventListener('click', () => moverAlertaAHistorial(alerta.clave));
      lista.appendChild(item);
    });
  }

  if (historialAlertas.length === 0) {
    const item = document.createElement('div');
    item.className = 'elementoAlerta';
    item.textContent = 'Historial vacio';
    item.style.cursor = 'default';
    listaHistorial.appendChild(item);
  } else {
    historialAlertas.forEach(alerta => {
      const item = document.createElement('div');
      item.className = 'elementoAlerta';
      item.innerHTML = `
        <div>${alerta.mensaje}</div>
        <div class="fechaAlerta">${formatearFechaAlerta(alerta.fecha)}</div>
      `;
      item.style.cursor = 'default';
      listaHistorial.appendChild(item);
    });
  }

  conteoAlertas = alertas.length;
  if (conteoAlertas > 0) {
    distintivo.textContent = String(conteoAlertas);
    distintivo.classList.remove('oculto');
  } else {
    distintivo.textContent = '';
    distintivo.classList.add('oculto');
  }
}

function agregarAlerta(clave, mensaje, tipo = '') {
  if (alertasPorClave.has(clave)) {
    const alertaExistente = alertasPorClave.get(clave);
    alertaExistente.mensaje = mensaje;
    alertaExistente.tipo = tipo;
    if (!alertaExistente.fecha) {
      alertaExistente.fecha = new Date().toISOString();
    }
  } else {
    const nueva = { clave, mensaje, tipo, fecha: new Date().toISOString() };
    alertas.unshift(nueva);
    alertasPorClave.set(clave, nueva);
    prepararAudioAlerta();
    reproducirSonidoAlerta();
  }
  actualizarUIAlertas();
}

function removerAlertaPorClave(clave) {
  if (!alertasPorClave.has(clave)) return;
  const alerta = alertasPorClave.get(clave);
  const idx = alertas.indexOf(alerta);
  if (idx >= 0) alertas.splice(idx, 1);
  alertasPorClave.delete(clave);
  actualizarUIAlertas();
}

function moverAlertaAHistorial(clave) {
  if (!alertasPorClave.has(clave)) return;
  const alerta = alertasPorClave.get(clave);
  const idx = alertas.indexOf(alerta);
  if (idx >= 0) alertas.splice(idx, 1);
  alertasPorClave.delete(clave);
  historialAlertas.unshift({
    mensaje: alerta.mensaje,
    fecha: new Date().toISOString()
  });
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
  barra.classList.toggle('mostrada');
  boton.classList.toggle('oculto');
}

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
    document.getElementById('logoEncabezado').style.display = 'block';
    document.getElementById('logoBarraLateral').style.display = 'block';
  };
  img.onerror = function() {
    // Logo no existe, mantenerlo oculto
  };
  img.src = 'images/logo.png';
}

// Conectar WebSocket para actualizaciones en tiempo real
function conectarWebSocket() {
  ws = new WebSocket('ws://localhost:3001');
  
  ws.onopen = () => {
    console.log('✅ Conectado al servidor en tiempo real');
  };
  
  ws.onmessage = (evento) => {
    const datos = JSON.parse(evento.data);
    console.log('Actualización en tiempo real:', datos.tipo);
    
    // Recargar datos según el tipo de evento
    if (datos.tipo === 'inventario_actualizado') {
      if (document.getElementById('insumos').classList.contains('activo')) {
        cargarInventario();
      }
    } else if (datos.tipo === 'recetas_actualizado') {
      if (document.getElementById('recetas').classList.contains('activo')) {
        cargarCategorias();
        cargarListadoRecetas();
      }
    } else if (datos.tipo === 'produccion_actualizado') {
      if (document.getElementById('produccion').classList.contains('activo')) {
        cargarProduccion();
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
      if (document.getElementById('ventas').classList.contains('activo')) {
        cargarEstadisticasVentas('mes');
        cargarVentas();
        cargarCortesias();
      }
    } else if (datos.tipo === 'cortesias_actualizado') {
      if (document.getElementById('ventas').classList.contains('activo')) {
        cargarCortesias();
      }
    } else if (datos.tipo === 'categorias_actualizado') {
      if (document.getElementById('recetas').classList.contains('activo')) {
        cargarCategorias();
      }
    }
  };
  
  ws.onerror = (error) => {
    console.error('❌ Error WebSocket:', error);
  };
  
  ws.onclose = () => {
    console.log('🔌 Desconectado del servidor. Reconectando en 3s...');
    setTimeout(conectarWebSocket, 3000);
  };
}

// Iniciar conexión WebSocket al cargar la página
conectarWebSocket();
actualizarUIAlertas();

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

async function cargarInventario() {
  try {
    const respuesta = await fetch(`${API}/inventario`);
    const insumos = await respuesta.json();
    
    const cuerpo = document.getElementById('cuerpoInventario');
    
    if (insumos.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="9" style="text-align:center">No hay insumos</td></tr>';
      return;
    }
    
    // Usar DocumentFragment para mejorar rendimiento del DOM
    const fragment = document.createDocumentFragment();
    const bajos = new Set();
    
    insumos.forEach(insumo => {
      const porcentaje = insumo.cantidad_total > 0
        ? Math.min(100, Math.max(0, (insumo.cantidad_disponible / insumo.cantidad_total) * 100))
        : 0;
      const clasePorcentaje = porcentaje <= 25 ? 'porcentajeBajo' : porcentaje <= 50 ? 'porcentajeMedio' : 'porcentajeAlto';
      if (porcentaje <= 25) {
        bajos.add(insumo.id);
        agregarAlerta(
          `stock:${insumo.id}`,
          `Stock bajo: ${insumo.nombre} (${porcentaje.toFixed(0)}%)`,
          'advertencia'
        );
      }
      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td>${insumo.codigo}</td>
        <td>${insumo.nombre}</td>
        <td>${insumo.unidad}</td>
        <td>${insumo.cantidad_total.toFixed(2)}</td>
        <td>${insumo.cantidad_disponible.toFixed(2)}</td>
        <td>$${insumo.costo_total.toFixed(2)}</td>
        <td>$${insumo.costo_por_unidad.toFixed(2)}</td>
        <td>
          <div class="barraPorcentaje">
            <div class="barraPorcentajeRelleno ${clasePorcentaje}" style="width:${porcentaje.toFixed(0)}%"></div>
            <span class="textoPorcentaje">${porcentaje.toFixed(0)}%</span>
          </div>
        </td>
        <td>
          <button onclick="editarInsumo(${insumo.id})" class="botonPequeno">✏️</button>
          <button onclick="mostrarHistorialInsumo(${insumo.id}, '${insumo.nombre.replace(/'/g, "\\'")}')" class="botonPequeno">📜</button>
          <button onclick="eliminarInsumo(${insumo.id})" class="botonPequeno botonDanger">🗑️</button>
        </td>
      `;
      fragment.appendChild(fila);
    });

    // Limpiar y agregar todo de una sola vez
    cuerpo.innerHTML = '';
    cuerpo.appendChild(fragment);

    Array.from(alertasPorClave.keys())
      .filter(clave => clave.startsWith('stock:'))
      .forEach(clave => {
        const id = parseInt(clave.split(':')[1], 10);
        if (!bajos.has(id)) removerAlertaPorClave(clave);
      });
  } catch (error) {
    console.error('Error cargando inventario:', error);
  }
}

async function cargarEstadisticasInventario() {
  try {
    const respuesta = await fetch(`${API}/inventario/estadisticas`);
    const estadisticas = await respuesta.json();
    
    document.getElementById('totalInsumos').textContent = estadisticas.total_insumos || 0;
    document.getElementById('inversionTotal').textContent = `$${(estadisticas.inversion_total || 0).toFixed(2)}`;
    document.getElementById('inversionRecuperada').textContent = `$${(estadisticas.inversion_recuperada || 0).toFixed(2)}`;
    document.getElementById('inversionNeta').textContent = `$${(estadisticas.inversion_neta || 0).toFixed(2)}`;
  } catch (error) {
    console.error('Error cargando estadísticas:', error);
  }
}

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
      await Promise.all([cargarInventario(), cargarEstadisticasInventario()]);
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
      cargarInventario();
      cargarEstadisticasInventario();
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
      cargarInventario();
      cargarEstadisticasInventario();
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

async function cargarCategorias() {
  try {
    const respuesta = await fetch(`${API}/categorias`);
    const categorias = await respuesta.json();
    
    const selectores = ['categoriaReceta', 'editCategoriaReceta', 'filtroCategoria'];
    selectores.forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;
      const actual = select.value;
      select.innerHTML = '<option value="">-- Selecciona una categoría --</option>';
      categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        select.appendChild(option);
      });
      select.value = actual;
    });
  } catch (error) {
    console.error('Error cargando categorías:', error);
  }
}

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
      await cargarCategorias();
      await cargarPestanasCategorias();
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
      await cargarCategorias();
      await cargarPestanasCategorias();
      categoriaRecetaActual = null;
      categoriaVentaActual = null;
      if (typeof cargarListadoRecetas === 'function') cargarListadoRecetas();
      if (typeof cargarVentas === 'function') cargarVentas();
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

async function cargarPestanasCategorias() {
  try {
    const respuesta = await fetch(`${API}/categorias`);
    const categorias = await respuesta.json();
    
    // Pestañas para recetas
    const contenedorRecetas = document.getElementById('pestanasCategoriasRecetas');
    if (contenedorRecetas) {
      contenedorRecetas.innerHTML = '';
      
      const btnTodas = document.createElement('button');
      btnTodas.className = 'boton ' + (categoriaRecetaActual === null ? 'activo' : '');
      btnTodas.textContent = '📚 Todas';
      btnTodas.onclick = () => {
        categoriaRecetaActual = null;
        cargarListadoRecetas();
        cargarPestanasCategorias();
      };
      contenedorRecetas.appendChild(btnTodas);
      
      categorias.forEach(cat => {
        const wrapper = document.createElement('div');
        wrapper.className = 'btnCategoriaWrapper';
        
        const btn = document.createElement('button');
        btn.className = 'boton ' + (categoriaRecetaActual === cat.id ? 'activo' : '');
        btn.textContent = `📁 ${cat.nombre}`;
        btn.onclick = () => {
          categoriaRecetaActual = cat.id;
          cargarListadoRecetas();
          cargarPestanasCategorias();
        };
        
        const btnEliminar = document.createElement('button');
        btnEliminar.className = 'btnEliminarCategoria';
        btnEliminar.textContent = '🗑️';
        btnEliminar.onclick = (e) => {
          e.stopPropagation();
          eliminarCategoria(cat.id, cat.nombre);
        };
        
        wrapper.appendChild(btn);
        wrapper.appendChild(btnEliminar);
        contenedorRecetas.appendChild(wrapper);
      });
    }
    
    // Pestañas para ventas
    const contenedorVentas = document.getElementById('pestanasCategoriasVentas');
    if (contenedorVentas) {
      contenedorVentas.innerHTML = '';
      
      const btnTodas = document.createElement('button');
      btnTodas.className = 'boton ' + (categoriaVentaActual === null ? 'activo' : '');
      btnTodas.textContent = '📊 Todas';
      btnTodas.onclick = () => {
        categoriaVentaActual = null;
        cargarVentas();
        cargarEstadisticasVentas(periodoVentaActual);
        cargarPestanasCategorias();
      };
      contenedorVentas.appendChild(btnTodas);
      
      categorias.forEach(cat => {
        const wrapper = document.createElement('div');
        wrapper.className = 'btnCategoriaWrapper';
        
        const btn = document.createElement('button');
        btn.className = 'boton ' + (categoriaVentaActual === cat.id ? 'activo' : '');
        btn.textContent = `📁 ${cat.nombre}`;
        btn.onclick = () => {
          categoriaVentaActual = cat.id;
          cargarVentas();
          cargarEstadisticasVentas(periodoVentaActual);
          cargarPestanasCategorias();
        };
        
        const btnEliminar = document.createElement('button');
        btnEliminar.className = 'btnEliminarCategoria';
        btnEliminar.textContent = '🗑️';
        btnEliminar.onclick = (e) => {
          e.stopPropagation();
          eliminarCategoria(cat.id, cat.nombre);
        };
        
        wrapper.appendChild(btn);
        wrapper.appendChild(btnEliminar);
        contenedorVentas.appendChild(wrapper);
      });
    }
  } catch (error) {
    console.error('Error cargando pestañas de categorías:', error);
  }
}

async function cargarListadoRecetas() {
  try {
    let url = `${API}/recetas`;
    if (categoriaRecetaActual !== null) {
      url += `?categoria=${categoriaRecetaActual}`;
    }
    
    const respuesta = await fetch(url);
    const recetas = await respuesta.json();
    
    const cuerpo = document.getElementById('cuerpoRecetas');
    cuerpo.innerHTML = '';
    
    if (recetas.length === 0) {
      cuerpo.innerHTML = '<div style="text-align:center;padding:30px;color:#999">No hay recetas</div>';
      return;
    }
    
    // Para cada receta, obtener detalles de ingredientes y capacidad
    for (const receta of recetas) {
      try {
        // Obtener ingredientes
        const respIngredientes = await fetch(`${API}/recetas/${receta.id}`);
        const detalleReceta = await respIngredientes.json();
        
        // Calcular capacidad
        const respCapacidad = await fetch(`${API}/recetas/calcular`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_receta: receta.id })
        });
        const capacidad = await respCapacidad.json();
        
        const totalIngredientes = (detalleReceta.ingredientes || []).length;
        
        // Calcular total de peso (gramos/ml)
        let totalGramos = 0;
        let totalMililitros = 0;
        (detalleReceta.ingredientes || []).forEach(ing => {
          let cantidad = ing.cantidad || 0;
          const unidad = (ing.unidad || '').toLowerCase();
          
          // Convertir a gramos
          if (unidad === 'kg') {
            totalGramos += cantidad * 1000;
          } else if (unidad === 'g') {
            totalGramos += cantidad;
          }
          // Convertir a mililitros
          else if (unidad === 'l') {
            totalMililitros += cantidad * 1000;
          } else if (unidad === 'ml') {
            totalMililitros += cantidad;
          }
        });
        
        let textoTotal = '';
        if (totalGramos > 0 && totalMililitros > 0) {
          textoTotal = `${totalGramos.toFixed(0)}g + ${totalMililitros.toFixed(0)}ml`;
        } else if (totalGramos > 0) {
          textoTotal = `${totalGramos.toFixed(0)}g`;
        } else if (totalMililitros > 0) {
          textoTotal = `${totalMililitros.toFixed(0)}ml`;
        } else {
          textoTotal = 'N/A';
        }
        
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjetaReceta';
        tarjeta.innerHTML = `
          <div style="padding:18px">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
              <div style="flex:1">
                <h3 style="margin:0 0 5px 0;color:#1a1a1a;font-size:16px">${receta.nombre}</h3>
                <p style="margin:0;color:#666;font-size:11px">📁 ${receta.categoria || 'Sin categoría'} ${receta.gramaje ? `• ${receta.gramaje}g` : ''}</p>
              </div>
            </div>
            <div style="background:#f8f9fa;padding:10px;border-radius:8px;margin-bottom:12px">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px">
                <div style="display:flex;align-items:center;gap:5px">
                  <span style="font-weight:600;color:#333">🧪 Ingredientes:</span>
                  <span style="color:#666">${totalIngredientes}</span>
                </div>
                <div style="display:flex;align-items:center;gap:5px">
                  <span style="font-weight:600;color:#333">⚖️ Total:</span>
                  <span style="color:#666">${textoTotal}</span>
                </div>
                <div style="display:flex;align-items:center;gap:5px">
                  <span style="font-weight:600;color:#333">📦 Capacidad:</span>
                  <span style="color:#666">${capacidad.piezas_maximas || 0} pz</span>
                </div>
                <div style="display:flex;align-items:center;gap:5px">
                  <span style="font-weight:600;color:#333">💰 Costo/pz:</span>
                  <span style="color:#4a9b5e;font-weight:600">$${(capacidad.costo_por_pieza || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div style="display:flex;gap:5px;flex-wrap:wrap">
              <button onclick="abrirProduccionRapida(${receta.id}, '${receta.nombre.replace(/'/g, "\\'")}', ${(capacidad.costo_por_pieza || 0)})" class="botonPequeno" style="background:#ff9800" title="Producir">🎰</button>
              <button onclick="editarReceta(${receta.id})" class="botonPequeno" title="Editar receta">✏️</button>
              <button onclick="abrirEscalarReceta(${receta.id}, '${receta.nombre.replace(/'/g, "\\'")}', ${receta.gramaje || 0})" class="botonPequeno" style="background:#3498db" title="Copiar con escalado">📋</button>
              <button onclick="mostrarIngredientes(${receta.id})" class="botonPequeno" title="Ver ingredientes">👁️</button>
              <button onclick="eliminarReceta(${receta.id})" class="botonPequeno botonDanger" title="Eliminar receta">🗑️</button>
            </div>
          </div>
        `;
        cuerpo.appendChild(tarjeta);
      } catch (error) {
        console.error(`Error procesando receta ${receta.id}:`, error);
        // Si hay error, mostrar tarjeta básica
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjetaReceta';
        tarjeta.innerHTML = `
          <div style="padding:18px">
            <h3 style="margin:0 0 5px 0;color:#1a1a1a;font-size:16px">${receta.nombre}</h3>
            <p style="margin:0 0 12px 0;color:#666;font-size:11px">📁 ${receta.categoria || 'Sin categoría'} ${receta.gramaje ? `• ${receta.gramaje}g` : ''}</p>
            <div style="display:flex;gap:5px;flex-wrap:wrap">
              <button onclick="abrirProduccionRapida(${receta.id}, '${receta.nombre.replace(/'/g, "\\'")}', 0)" class="botonPequeno" style="background:#ff9800">🎰</button>
              <button onclick="editarReceta(${receta.id})" class="botonPequeno">✏️</button>
              <button onclick="abrirEscalarReceta(${receta.id}, '${receta.nombre.replace(/'/g, "\\'")}', ${receta.gramaje || 0})" class="botonPequeno" style="background:#3498db">📋</button>
              <button onclick="mostrarIngredientes(${receta.id})" class="botonPequeno">👁️</button>
              <button onclick="eliminarReceta(${receta.id})" class="botonPequeno botonDanger">🗑️</button>
            </div>
          </div>
        `;
        cuerpo.appendChild(tarjeta);
      }
    }
  } catch (error) {
    console.error('Error cargando recetas:', error);
  }
}

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

async function cargarProduccion() {
  try {
    const respuesta = await fetch(`${API}/produccion`);
    const producciones = await respuesta.json();
    
    const cuerpo = document.getElementById('cuerpoProduccion');
    cuerpo.innerHTML = '';
    
    if (producciones.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="7" style="text-align:center">No hay producción</td></tr>';
      return;
    }
    
    producciones.forEach(prod => {
      const fila = document.createElement('tr');
      const costo = Number(prod.costo_produccion) || 0;
      const precio = Number(prod.precio_venta) || 0;
      const cantidad = Number(prod.cantidad) || 0;
      const ganancia = (precio * cantidad) - costo;
      fila.innerHTML = `
        <td>${prod.nombre_receta}</td>
        <td>${cantidad}</td>
        <td>$${costo.toFixed(2)}</td>
        <td>$${precio.toFixed(2)}</td>
        <td>$${ganancia.toFixed(2)}</td>
        <td>${new Date(prod.fecha_produccion).toLocaleDateString()}</td>
        <td>
          <button onclick="abrirModalVenta(${prod.id}, '${prod.nombre_receta}', ${cantidad}, ${costo}, ${precio})" class="botonPequeno">✅ Vender</button>
          <button onclick="abrirModalCortesia(${prod.id}, '${prod.nombre_receta}', ${cantidad})" class="botonPequeno" style="background: #9b59b6;">🎁 Cortesía</button>
          <button onclick="eliminarProduccion(${prod.id})" class="botonPequeno botonDanger">🗑️</button>
        </td>
      `;
      cuerpo.appendChild(fila);
    });
  } catch (error) {
    console.error('Error cargando producción:', error);
  }
}

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
      cargarProduccion();
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
      cargarProduccion();
    }
  } catch (error) {
    console.error('Error eliminando producción:', error);
  }
}

// ===== VENTAS =====

async function cargarVentas() {
  try {
    let url = `${API}/ventas`;
    if (categoriaVentaActual !== null) {
      url += `?categoria=${categoriaVentaActual}`;
    }
    
    const respuesta = await fetch(url);
    const ventas = await respuesta.json();
    
    const cuerpo = document.getElementById('cuerpoVentas');
    cuerpo.innerHTML = '';
    
    if (ventas.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="8" style="text-align:center">No hay ventas</td></tr>';
      return;
    }
    
    ventas.forEach(venta => {
      const fila = document.createElement('tr');
      const fechaProduccion = new Date(venta.fecha_produccion).toLocaleString();
      const fechaVenta = new Date(venta.fecha_venta).toLocaleString();
      fila.innerHTML = `
        <td>${venta.nombre_receta}</td>
        <td>${venta.categoria || 'Sin categoría'}</td>
        <td>${venta.cantidad}</td>
        <td>${venta.numero_pedido || ''}</td>
        <td>${fechaProduccion}</td>
        <td>${fechaVenta}</td>
        <td>$${venta.costo_produccion.toFixed(2)}</td>
        <td>$${(venta.precio_venta * venta.cantidad).toFixed(2)}</td>
        <td>$${venta.ganancia.toFixed(2)}</td>
      `;
      cuerpo.appendChild(fila);
    });
  } catch (error) {
    console.error('Error cargando ventas:', error);
  }
}

async function cargarCortesias() {
  try {
    const respuesta = await fetch(`${API}/cortesias`);
    const cortesias = await respuesta.json();
    
    const cuerpo = document.getElementById('cuerpoCortesias');
    if (!cuerpo) return;
    
    cuerpo.innerHTML = '';
    
    if (cortesias.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="3" style="text-align:center">No hay cortesías registradas</td></tr>';
      return;
    }
    
    cortesias.forEach(cortesia => {
      const fila = document.createElement('tr');
      const fechaCortesia = new Date(cortesia.fecha_cortesia).toLocaleString();
      fila.innerHTML = `
        <td>${cortesia.nombre_receta}</td>
        <td>${cortesia.cantidad}</td>
        <td>${cortesia.numero_pedido || ''}</td>
        <td>${cortesia.motivo || ''}</td>
        <td>${cortesia.para_quien || ''}</td>
        <td>${fechaCortesia}</td>
      `;
      cuerpo.appendChild(fila);
    });
  } catch (error) {
    console.error('Error cargando cortesías:', error);
  }
}

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
      cargarProduccion();
      cargarVentas();
      cargarEstadisticasVentas('mes');
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
      cargarProduccion();
      cargarCortesias();
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
      if (typeof cargarInventario === 'function') cargarInventario();
      if (typeof cargarEstadisticasInventario === 'function') cargarEstadisticasInventario();
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
  activarPestana(pestanaActual, { skipHash: true });
  cargarCategorias();
});
