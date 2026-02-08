// Sistema de Notificaciones y Alertas

export const alertas = [];
export const alertasPorClave = new Map();
export const historialAlertas = [];
export const MAX_HISTORIAL_ALERTAS = 200;
let pestanaAlertasActual = 'activas';
let audioCtx = null;
let audioAlertaPreparado = false;

let conteoAlertas = 0;

export function actualizarUIAlertas() {
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

export function agregarAlerta(clave, mensaje, tipo = '') {
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

export function removerAlertaPorClave(clave) {
  if (!alertasPorClave.has(clave)) return;
  const alerta = alertasPorClave.get(clave);
  const idx = alertas.indexOf(alerta);
  if (idx >= 0) alertas.splice(idx, 1);
  alertasPorClave.delete(clave);
  actualizarUIAlertas();
}

export function moverAlertaAHistorial(clave) {
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

export function cambiarPestanaAlertas(pestana) {
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

export function formatearFechaAlerta(fechaISO) {
  if (!fechaISO) return '';
  return new Date(fechaISO).toLocaleString();
}

export function prepararAudioAlerta() {
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

export function reproducirSonidoAlerta() {
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

export function mostrarNotificacion(mensaje, tipo = 'exito') {
  const modal = document.getElementById('modalNotificacion');
  const fondo = document.getElementById('fondoNotificacion');
  const titulo = document.getElementById('tituloNotificacion');
  const textoMensaje = document.getElementById('mensajeNotificacion');
  
  if (!modal || !fondo || !titulo || !textoMensaje) return;
  
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

export function cerrarNotificacion() {
  const modal = document.getElementById('modalNotificacion');
  const fondo = document.getElementById('fondoNotificacion');
  if (modal) modal.style.display = 'none';
  if (fondo) fondo.style.display = 'none';
}
