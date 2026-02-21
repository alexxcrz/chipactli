// WebSocket Management

import { API } from '../config.js';

let ws = null;

export function conectarWebSocket(onMensaje) {
  // Convertir HTTP a WS (localhost:3001 -> ws://localhost:3001)
  const wsUrl = API.replace('http://', 'ws://').replace('https://', 'wss://');
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
  };
  
  ws.onmessage = (evento) => {
    const datos = JSON.parse(evento.data);
    
    // Llamar el callback con los datos
    if (onMensaje && typeof onMensaje === 'function') {
      onMensaje(datos);
    }
  };
  
  ws.onerror = (error) => {
    console.error('❌ Error WebSocket:', error);
  };
  
  ws.onclose = () => {
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
