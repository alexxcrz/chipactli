export const PERMISOS_DEFINICION = {
  inventario: ['ver', 'crear', 'aumentar', 'editar', 'eliminar', 'ver_estadisticas', 'exportar', 'importar'],
  recetas: ['ver', 'crear', 'editar', 'eliminar', 'calcular', 'categorias_ver', 'categorias_gestionar', 'exportar', 'importar'],
  produccion: ['ver', 'crear', 'eliminar', 'exportar', 'importar'],
  ventas: ['ver', 'crear', 'eliminar', 'ver_estadisticas', 'cortesia_ver', 'cortesia_crear', 'cortesia_eliminar', 'cortesia_limpiar', 'exportar', 'importar'],
  tienda: ['ver'],
  trastienda: ['ver', 'editar', 'pedidos', 'clientes', 'puntos', 'catalogo', 'descuentos', 'cupones', 'config', 'metricas'],
  utensilios: ['ver', 'crear', 'editar', 'eliminar', 'recuperar', 'ver_historial', 'ver_estadisticas', 'exportar', 'importar'],
  admin_usuarios: ['ver', 'crear', 'editar_usuario', 'editar_permisos', 'eliminar', 'reset_password']
};

export const PERMISOS_PESTANAS = Object.keys(PERMISOS_DEFINICION);

function crearNodoPestana(acciones, valor = false) {
  return {
    ver: Boolean(valor),
    acciones: acciones.reduce((acc, accion) => {
      acc[accion] = Boolean(valor);
      return acc;
    }, {})
  };
}

function clonarNodoPestana(nodo = {}, acciones = []) {
  const out = {
    ver: Boolean(nodo?.ver),
    acciones: {}
  };

  for (const accion of acciones) {
    out.acciones[accion] = Boolean(nodo?.acciones?.[accion]);
  }

  return out;
}

export function crearPermisosPorRol(rol = 'usuario') {
  const permisos = {};
  const accesoTotal = rol === 'ceo' || rol === 'admin';

  for (const [pestana, acciones] of Object.entries(PERMISOS_DEFINICION)) {
    permisos[pestana] = crearNodoPestana(acciones, accesoTotal);
  }

  if (!accesoTotal) {
    permisos.inventario.ver = true;
    permisos.inventario.acciones.ver = true;
  }

  return permisos;
}

export function normalizarPermisosUsuario(permisos, rol = 'usuario') {
  if (rol === 'ceo' || rol === 'admin') {
    return crearPermisosPorRol(rol);
  }

  let parsed = permisos;
  if (typeof permisos === 'string') {
    try {
      parsed = JSON.parse(permisos);
    } catch {
      parsed = null;
    }
  }

  const base = crearPermisosPorRol('usuario');

  for (const [pestana, acciones] of Object.entries(PERMISOS_DEFINICION)) {
    const valor = parsed?.[pestana];

    if (typeof valor === 'boolean') {
      base[pestana] = crearNodoPestana(acciones, valor);
      continue;
    }

    if (valor && typeof valor === 'object') {
      const normalizado = clonarNodoPestana(valor, acciones);
      if (typeof valor.ver !== 'undefined') {
        normalizado.ver = Boolean(valor.ver);
      }

      for (const accion of acciones) {
        if (typeof valor[accion] !== 'undefined') {
          normalizado.acciones[accion] = Boolean(valor[accion]);
        }
      }

      base[pestana] = normalizado;
    }
  }

  return base;
}

export function serializarPermisos(permisos, rol = 'usuario') {
  return JSON.stringify(normalizarPermisosUsuario(permisos, rol));
}

export function tienePermisoPestana(usuario, pestana) {
  if (!usuario) return false;
  if (usuario.rol === 'ceo' || usuario.rol === 'admin') return true;

  const permisos = normalizarPermisosUsuario(usuario.permisos, usuario.rol);
  return Boolean(permisos[pestana]?.ver);
}

export function tienePermisoAccion(usuario, pestana, accion) {
  if (!usuario) return false;
  if (usuario.rol === 'ceo' || usuario.rol === 'admin') return true;

  const permisos = normalizarPermisosUsuario(usuario.permisos, usuario.rol);
  return Boolean(permisos[pestana]?.acciones?.[accion]);
}
