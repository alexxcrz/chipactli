export function convertirCantidad(cantidad, unidadOrigen, unidadDestino) {
  if (!unidadOrigen || !unidadDestino) return cantidad;
  const origen = unidadOrigen.toLowerCase();
  const destino = unidadDestino.toLowerCase();
  if (origen === destino) return cantidad;
  if (origen === "kg" && destino === "g") return cantidad * 1000;
  if (origen === "g" && destino === "kg") return cantidad / 1000;
  if (origen === "l" && destino === "ml") return cantidad * 1000;
  if (origen === "ml" && destino === "l") return cantidad / 1000;
  return cantidad;
}
