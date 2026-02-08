// WebSocket Management

import { API } from '../config.js';

let ws = null;

export function conectarWebSocket(onMensaje) {
  // Convertir HTTP a WS (localhost:3001 -> ws://localhost:3001)
  const wsUrl = API.replace('http://', 'ws://').replace('https://', 'wss://');
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('✅ Conectado al servidor en tiempo real:', wsUrl);
  };
  
  ws.onmessage = (evento) => {
    const datos = JSON.parse(evento.data);
    console.log('Actualización en tiempo real:', datos.tipo);
    
    // Llamar el callback con los datos
    if (onMensaje && typeof onMensaje === 'function') {
      onMensaje(datos);
    }
  };
  
  ws.onerror = (error) => {
    console.error('❌ Error WebSocket:', error);
  };
  
  ws.onclose = () => {
    console.log('🔌 Desconectado del servidor. Reconectando en 3s...');
    setTimeout(() => conectarWebSocket(onMensaje), 3000);
  };
}

export function obtenerWebSocket() {
  return ws;
}

export function cerrarWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
  }
}
