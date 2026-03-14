export function normalizarUnidad(unidad) {
  const u = String(unidad || '').toLowerCase().trim();
  if (!u) return '';
  if (['go', 'gota', 'gotas'].includes(u)) return 'gotas';
  if (['gr', 'gm', 'gramo', 'gramos'].includes(u)) return 'g';
  if (['kilogramo', 'kilogramos', 'kilo', 'kilos'].includes(u)) return 'kg';
  if (['mililitro', 'mililitros', 'cc'].includes(u)) return 'ml';
  if (['litro', 'litros', 'lt', 'lts'].includes(u)) return 'l';
  if (['unidad', 'unidades', 'pza', 'pz', 'pieza', 'piezas', 'ud', 'uds'].includes(u)) return 'pza';
  return u;
}

function aBase(valor, unidad) {
  if (unidad === 'kg') return { base: 'masa', value: valor * 1000 };
  if (unidad === 'g') return { base: 'masa', value: valor };
  if (unidad === 'l') return { base: 'volumen', value: valor * 1000 };
  if (unidad === 'ml') return { base: 'volumen', value: valor };
  if (unidad === 'gotas') {
    // Convencion usada en el sistema: 20 gotas = 1 ml.
    return { base: 'volumen', value: valor / 20 };
  }
  if (unidad === 'pza') return { base: 'pieza', value: valor };
  return { base: 'otro', value: valor };
}

function desdeBase(valorBase, unidadDestino) {
  if (unidadDestino === 'kg') return valorBase / 1000;
  if (unidadDestino === 'g') return valorBase;
  if (unidadDestino === 'l') return valorBase / 1000;
  if (unidadDestino === 'ml') return valorBase;
  if (unidadDestino === 'gotas') return valorBase * 20;
  if (unidadDestino === 'pza') return valorBase;
  return valorBase;
}

export function convertirCantidadDetallada(cantidad, unidadOrigen, unidadDestino) {
  const valor = Number(cantidad);
  if (!Number.isFinite(valor)) {
    return {
      valor: 0,
      compatible: false,
      razon: 'cantidad_invalida',
      origen: normalizarUnidad(unidadOrigen),
      destino: normalizarUnidad(unidadDestino)
    };
  }

  const origen = normalizarUnidad(unidadOrigen);
  const destino = normalizarUnidad(unidadDestino);
  if (!origen || !destino) {
    return {
      valor,
      compatible: false,
      razon: 'unidad_vacia',
      origen,
      destino
    };
  }

  if (origen === destino) {
    return {
      valor,
      compatible: true,
      razon: 'misma_unidad',
      origen,
      destino
    };
  }

  const from = aBase(valor, origen);
  const to = aBase(1, destino);
  if (from.base === 'otro' || to.base === 'otro') {
    return {
      valor,
      compatible: false,
      razon: 'unidad_no_soportada',
      origen,
      destino,
      baseOrigen: from.base,
      baseDestino: to.base
    };
  }

  if (from.base !== to.base) {
    return {
      valor,
      compatible: false,
      razon: 'base_incompatible',
      origen,
      destino,
      baseOrigen: from.base,
      baseDestino: to.base
    };
  }

  return {
    valor: desdeBase(from.value, destino),
    compatible: true,
    razon: 'convertida',
    origen,
    destino,
    baseOrigen: from.base,
    baseDestino: to.base
  };
}

export function convertirCantidad(cantidad, unidadOrigen, unidadDestino) {
  const out = convertirCantidadDetallada(cantidad, unidadOrigen, unidadDestino);
  return Number.isFinite(out?.valor) ? out.valor : 0;
}
