export function convertirCantidad(cantidad, unidadOrigen, unidadDestino) {
  if (!unidadOrigen || !unidadDestino) return cantidad;
  const normalizarUnidad = (unidad) => {
    const u = String(unidad || '').toLowerCase().trim();
    if (u === 'go' || u === 'gota' || u === 'gotas') return 'gotas';
    return u;
  };
  const origen = normalizarUnidad(unidadOrigen);
  const destino = normalizarUnidad(unidadDestino);
  if (origen === destino) return cantidad;
  if (origen === "kg" && destino === "g") return cantidad * 1000;
  if (origen === "g" && destino === "kg") return cantidad / 1000;
  if (origen === "l" && destino === "ml") return cantidad * 1000;
  if (origen === "ml" && destino === "l") return cantidad / 1000;
  return cantidad;
}
