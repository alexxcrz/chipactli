// WebSocket Management

import { API } from './config.jsx';

let ws = null;
let reconectar = true;
let timerReconexion = null;
let ultimoHandler = null;
let cierreSolicitado = false;
let timerConexion = null;

function construirWsUrl() {
  const api = String(API || '').trim();

  if (/^https?:\/\//i.test(api)) {
    return api.replace('http://', 'ws://').replace('https://', 'wss://');
  }

  if (typeof window !== 'undefined') {
    const protocolo = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const host = window.location.hostname;
    const puerto = window.location.port;

    // En dev con Vite (3000), el backend y WebSocket viven en 3001.
    if (!api && (puerto === '3000' || window.location.host === 'localhost:3000' || window.location.host === '127.0.0.1:3000')) {
      return `${protocolo}${host}:3001`;
    }

    return `${protocolo}${window.location.host}`;
  }

  return 'ws://localhost:3001';
}

export function conectarWebSocket(onMensaje) {
  ultimoHandler = onMensaje;
  reconectar = true;
  cierreSolicitado = false;

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  if (timerReconexion) {
    clearTimeout(timerReconexion);
    timerReconexion = null;
  }

  if (timerConexion) {
    clearTimeout(timerConexion);
    timerConexion = null;
  }

  // Retrasar ligeramente la conexión evita el falso error en React StrictMode
  // cuando el componente se monta/desmonta inmediatamente en desarrollo.
  timerConexion = setTimeout(() => {
    timerConexion = null;
    if (!reconectar || cierreSolicitado) return;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    const wsUrl = construirWsUrl();
    const socket = new WebSocket(wsUrl);
    ws = socket;

    socket.onopen = () => {
    };

    socket.onmessage = (evento) => {
      let datos = null;
      try {
        datos = JSON.parse(evento.data);
      } catch {
        return;
      }

      if (onMensaje && typeof onMensaje === 'function') {
        onMensaje(datos);
      }
    };

    socket.onerror = (error) => {
      if (cierreSolicitado || !reconectar) return;
      console.error('❌ Error WebSocket:', error);
    };

    socket.onclose = () => {
      if (ws === socket) {
        ws = null;
      }
      if (!reconectar || cierreSolicitado) return;
      timerReconexion = setTimeout(() => conectarWebSocket(ultimoHandler), 3000);
    };
  }, 120);
}

export function obtenerWebSocket() {
  return ws;
}

export function cerrarWebSocket() {
  reconectar = false;
  cierreSolicitado = true;

  if (timerConexion) {
    clearTimeout(timerConexion);
    timerConexion = null;
  }

  if (timerReconexion) {
    clearTimeout(timerReconexion);
    timerReconexion = null;
  }

  if (ws) {
    const socket = ws;
    ws = null;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try {
      socket.close();
    } catch {
      // Ignorar errores de cierre de socket en transición de desmontaje.
    }
  }
}
