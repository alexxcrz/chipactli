// Sistema de Notificaciones y Alertas

export const alertas = [];
export const alertasPorClave = new Map();
export const historialAlertas = [];
const CLAVE_TAB_ALERTAS = 'chipactli:alertas:tab';
let pestanaAlertasActual = 'activas';
let audioCtx = null;
let audioAlertaPreparado = false;

let conteoAlertas = 0;
let onEnterCerrarNotificacion = null;
const CLAVE_SONIDO_NOTIFICACION = 'chipactli_notif_sound';
let sonidoSeleccionado = 'clasico';

function obtenerTituloNotificacionPorTipo(tipo) {
  if (tipo === 'error') return 'Error';
  if (tipo === 'advertencia') return 'Advertencia';
  return 'Aviso';
}

async function copiarTextoNotificacion(texto) {
  const contenido = String(texto || '');
  if (!contenido.trim()) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(contenido);
      return true;
    }
  } catch {
    // Intentar fallback debajo.
  }

  const area = document.createElement('textarea');
  area.value = contenido;
  area.setAttribute('readonly', 'readonly');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  area.style.pointerEvents = 'none';
  document.body.appendChild(area);
  area.focus();
  area.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}

export const OPCIONES_SONIDO_NOTIFICACION = [
  { value: 'clasico', label: 'Clásico' },
  { value: 'suave', label: 'Suave' },
  { value: 'campana', label: 'Campana' },
  { value: 'digital', label: 'Digital' },
  { value: 'silencio', label: 'Sin sonido' }
];

function cargarSonidoSeleccionado() {
  if (typeof window === 'undefined') return;
  try {
    const guardado = String(localStorage.getItem(CLAVE_SONIDO_NOTIFICACION) || '').trim().toLowerCase();
    if (OPCIONES_SONIDO_NOTIFICACION.some((item) => item.value === guardado)) {
      sonidoSeleccionado = guardado;
    }
  } catch {
    // Ignorar errores de storage.
  }
}

function presetSonidoValido(preset) {
  const clave = String(preset || '').trim().toLowerCase();
  return OPCIONES_SONIDO_NOTIFICACION.some((item) => item.value === clave) ? clave : 'clasico';
}

export function obtenerSonidoNotificacion() {
  return sonidoSeleccionado;
}

export function configurarSonidoNotificacion(preset) {
  const clave = presetSonidoValido(preset);
  sonidoSeleccionado = clave;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CLAVE_SONIDO_NOTIFICACION, clave);
    } catch {
      // Ignorar errores de storage.
    }
  }
  return clave;
}

cargarSonidoSeleccionado();

function cargarPestanaAlertasGuardada() {
  if (typeof window === 'undefined') return;
  try {
    const guardada = String(localStorage.getItem(CLAVE_TAB_ALERTAS) || '').trim();
    if (guardada === 'activas' || guardada === 'historial') {
      pestanaAlertasActual = guardada;
    }
  } catch {
    // Ignorar errores de storage.
  }
}

function guardarPestanaAlertasActual() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLAVE_TAB_ALERTAS, pestanaAlertasActual);
  } catch {
    // Ignorar errores de storage.
  }
}

cargarPestanaAlertasGuardada();

export function obtenerPestanaAlertasActual() {
  return pestanaAlertasActual === 'historial' ? 'historial' : 'activas';
}

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
      if (alerta?.destino?.hash || alerta?.destino?.page) {
        item.title = 'Abrir detalle';
      }
      item.addEventListener('click', () => {
        if (alerta?.destino) {
          try {
            window.dispatchEvent(new CustomEvent('chipactli:alerta-click', {
              detail: {
                clave: alerta.clave,
                mensaje: alerta.mensaje,
                destino: alerta.destino,
                meta: alerta.meta || null
              }
            }));
          } catch {
            // Ignorar errores de dispatch.
          }

          const hashDestino = String(alerta?.destino?.hash || '').trim();
          if (hashDestino) {
            window.location.hash = hashDestino;
          }
        }
        moverAlertaAHistorial(alerta.clave);
      });
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

export function agregarAlerta(clave, mensaje, tipo = '', opciones = {}) {
  const destino = opciones?.destino || null;
  const meta = opciones?.meta || null;
  if (alertasPorClave.has(clave)) {
    const alertaExistente = alertasPorClave.get(clave);
    alertaExistente.mensaje = mensaje;
    alertaExistente.tipo = tipo;
    alertaExistente.destino = destino;
    alertaExistente.meta = meta;
    if (!alertaExistente.fecha) {
      alertaExistente.fecha = new Date().toISOString();
    }
  } else {
    const nueva = { clave, mensaje, tipo, destino, meta, fecha: new Date().toISOString() };
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
    fecha: alerta.fecha || new Date().toISOString()
  });
  actualizarUIAlertas();
  cambiarPestanaAlertas('historial');
}

export function marcarTodasAlertasComoLeidas() {
  if (!alertas.length) return;
  while (alertas.length) {
    const alerta = alertas.shift();
    if (!alerta?.clave) continue;
    alertasPorClave.delete(alerta.clave);
    historialAlertas.unshift({
      mensaje: alerta.mensaje,
      fecha: alerta.fecha || new Date().toISOString()
    });
  }
  actualizarUIAlertas();
  cambiarPestanaAlertas('historial');
}

export function limpiarHistorialAlertas() {
  if (!historialAlertas.length) return;
  historialAlertas.splice(0, historialAlertas.length);
  actualizarUIAlertas();
}

export function cambiarPestanaAlertas(pestana) {
  pestanaAlertasActual = pestana === 'historial' ? 'historial' : 'activas';
  guardarPestanaAlertasActual();
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

export function reproducirSonidoAlerta(preset = '') {
  try {
    const tono = preset
      ? presetSonidoValido(preset)
      : presetSonidoValido(sonidoSeleccionado);
    if (tono === 'silencio') return;

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

    const tocar = (tipo, frecuenciaInicio, frecuenciaFin, inicio, fin) => {
      const osc = audioCtx.createOscillator();
      osc.type = tipo;
      osc.frequency.setValueAtTime(frecuenciaInicio, ahora + inicio);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, frecuenciaFin), ahora + fin);
      osc.connect(ganancia);
      osc.start(ahora + inicio);
      osc.stop(ahora + fin);
    };

    if (tono === 'suave') {
      tocar('sine', 520, 420, 0, 0.42);
      tocar('sine', 640, 540, 0.12, 0.52);
      return;
    }

    if (tono === 'campana') {
      tocar('triangle', 880, 660, 0, 0.28);
      tocar('triangle', 1180, 900, 0.2, 0.5);
      return;
    }

    if (tono === 'digital') {
      tocar('square', 880, 840, 0, 0.1);
      tocar('square', 660, 620, 0.14, 0.24);
      tocar('square', 980, 930, 0.28, 0.4);
      return;
    }

    tocar('triangle', 440, 330, 0, 0.35);
    tocar('sine', 660, 520, 0.1, 0.55);
  } catch (e) {
    // Silenciar errores de audio en navegadores con restricciones
  }
}

export function notificacionesNativasDisponibles() {
  return typeof window !== 'undefined' && typeof window.Notification !== 'undefined';
}

export function obtenerPermisoNotificacionesNativas() {
  if (!notificacionesNativasDisponibles()) return 'unsupported';
  return Notification.permission || 'default';
}

export async function solicitarPermisoNotificacionesNativas() {
  if (!notificacionesNativasDisponibles()) return 'unsupported';
  try {
    const permiso = await Notification.requestPermission();
    return permiso || 'default';
  } catch {
    return 'default';
  }
}

export async function mostrarNotificacionNativa({
  titulo = 'CHIPACTLI',
  mensaje = '',
  tag = '',
  datos = null,
  sonido = ''
} = {}) {
  if (obtenerPermisoNotificacionesNativas() !== 'granted') return false;

  const options = {
    body: String(mensaje || '').trim(),
    tag: String(tag || '').trim() || undefined,
    data: datos || undefined,
    icon: '/images/logo.png',
    badge: '/images/logo.png'
  };

  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registro = await navigator.serviceWorker.getRegistration();
      if (registro && typeof registro.showNotification === 'function') {
        await registro.showNotification(String(titulo || 'CHIPACTLI'), options);
      } else {
        new Notification(String(titulo || 'CHIPACTLI'), options);
      }
    } else {
      new Notification(String(titulo || 'CHIPACTLI'), options);
    }
    reproducirSonidoAlerta(sonido || sonidoSeleccionado);
    return true;
  } catch {
    return false;
  }
}

export function mostrarNotificacion(mensaje, tipo = 'exito', opciones = {}) {
  const modal = document.getElementById('modalNotificacion');
  const fondo = document.getElementById('fondoNotificacion');
  const titulo = document.getElementById('tituloNotificacion');
  const textoMensaje = document.getElementById('mensajeNotificacion');
  const detalle = document.getElementById('detalleNotificacion');
  const valorCopiable = document.getElementById('valorCopiableNotificacion');
  const btnCopiar = document.getElementById('btnCopiarNotificacion');
  const btnCerrar = document.getElementById('btnCerrarNotificacion');

  const config = opciones && typeof opciones === 'object' ? opciones : {};
  const tituloPersonalizado = String(config.titulo || '').trim();
  const detalleTexto = String(config.detalle || '').trim();
  const textoCopiable = typeof config.copyText === 'string' ? config.copyText : '';
  const etiquetaCopiar = String(config.copyLabel || 'Copiar').trim() || 'Copiar';
  const etiquetaCerrar = String(config.closeLabel || 'Cerrar').trim() || 'Cerrar';
  
  if (!modal || !fondo || !titulo || !textoMensaje) return;
  
  modal.className = `modalNotificacion ${tipo}`;
  titulo.textContent = tituloPersonalizado || obtenerTituloNotificacionPorTipo(tipo);
  
  textoMensaje.textContent = mensaje;
  if (detalle) {
    detalle.textContent = detalleTexto;
    detalle.style.display = detalleTexto ? 'block' : 'none';
  }

  if (valorCopiable) {
    valorCopiable.value = textoCopiable;
    valorCopiable.style.display = textoCopiable ? 'block' : 'none';
  }

  if (btnCerrar) {
    btnCerrar.textContent = etiquetaCerrar;
  }

  if (btnCopiar) {
    btnCopiar.textContent = etiquetaCopiar;
    btnCopiar.dataset.originalLabel = etiquetaCopiar;
    btnCopiar.style.display = textoCopiable ? 'inline-flex' : 'none';
    btnCopiar.disabled = false;
    btnCopiar.onclick = async () => {
      btnCopiar.disabled = true;
      const copiado = await copiarTextoNotificacion(textoCopiable);
      btnCopiar.textContent = copiado ? 'Copiado' : 'No se pudo copiar';
      window.setTimeout(() => {
        btnCopiar.disabled = false;
        btnCopiar.textContent = btnCopiar.dataset.originalLabel || 'Copiar';
      }, copiado ? 1500 : 2200);
    };
  }

  modal.classList.remove('toast-hiding');
  modal.style.display = 'flex';
  if (fondo) fondo.style.display = 'block';

  if (onEnterCerrarNotificacion) {
    document.removeEventListener('keydown', onEnterCerrarNotificacion);
  }

  onEnterCerrarNotificacion = (event) => {
    if (event.key === 'Enter' && modal.style.display !== 'none') {
      event.preventDefault();
      cerrarNotificacion({ animada: true });
    }
  };

  document.addEventListener('keydown', onEnterCerrarNotificacion);
}

export function cerrarNotificacion(opciones = {}) {
  const modal = document.getElementById('modalNotificacion');
  const fondo = document.getElementById('fondoNotificacion');
  const animada = Boolean(opciones?.animada);
  const detalle = document.getElementById('detalleNotificacion');
  const valorCopiable = document.getElementById('valorCopiableNotificacion');
  const btnCopiar = document.getElementById('btnCopiarNotificacion');

  if (modal) {
    if (animada && modal.style.display !== 'none') {
      modal.classList.add('toast-hiding');
      setTimeout(() => {
        if (!modal.classList.contains('toast-hiding')) return;
        modal.style.display = 'none';
        modal.classList.remove('toast-hiding');
      }, 170);
    } else {
      modal.style.display = 'none';
      modal.classList.remove('toast-hiding');
    }
  }
  if (fondo) fondo.style.display = 'none';

  if (detalle) {
    detalle.textContent = '';
    detalle.style.display = 'none';
  }

  if (valorCopiable) {
    valorCopiable.value = '';
    valorCopiable.style.display = 'none';
  }

  if (btnCopiar) {
    btnCopiar.onclick = null;
    btnCopiar.disabled = false;
    btnCopiar.textContent = btnCopiar.dataset.originalLabel || 'Copiar';
    btnCopiar.style.display = 'none';
  }

  if (onEnterCerrarNotificacion) {
    document.removeEventListener('keydown', onEnterCerrarNotificacion);
    onEnterCerrarNotificacion = null;
  }
}
