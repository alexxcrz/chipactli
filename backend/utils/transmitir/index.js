let wss = null;

export function inicializarWss(webSocketServer) {
  wss = webSocketServer;
  wss.on("connection", (ws) => {
    ws.on("close", () => {});
  });
}

export function transmitir(datos) {
  if (!wss) return;
  wss.clients.forEach(cliente => {
    if (cliente.readyState === 1) {
      cliente.send(JSON.stringify(datos));
    }
  });
}
