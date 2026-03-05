import React, { useCallback, useState } from 'react';
import './App.css';

// legacy helpers that old scripts expect on window
import {
  mostrarNotificacion,
  cerrarNotificacion,
  agregarAlerta,
  removerAlertaPorClave,
  actualizarUIAlertas,
  cambiarPestanaAlertas
} from '../../utils/notificaciones.jsx';
import Inventario from '../Inventario/Inventario.jsx';
import Recetas from '../Recetas/Recetas.jsx';
import Produccion from '../Produccion/Produccion.jsx';
import Ventas from '../Ventas/Ventas.jsx';
import Tienda from '../Tienda/Tienda.jsx';
import Utensilios from '../utensilios/Utensilios.jsx';
import AdminUsuarios from '../admin-usuarios/AdminUsuarios.jsx';
import { fetchAPIJSON } from '../../utils/api.jsx';
import { mostrarModalCambiarPassword } from '../modal-cambiar-password.jsx';
import { inicializarCierreModalConEsc } from '../../utils/modales.jsx';
import { conectarWebSocket, cerrarWebSocket } from '../../utils/websocket.jsx';

const PERMISOS_POR_DEFECTO = {
  inventario: { ver: true, acciones: { ver: true } },
  recetas: { ver: false, acciones: { ver: false } },
  produccion: { ver: false, acciones: { ver: false } },
  ventas: { ver: false, acciones: { ver: false } },
  utensilios: { ver: false, acciones: { ver: false } },
  admin_usuarios: { ver: false, acciones: { ver: false } }
};

const MAPEO_PESTANA_PERMISO = {
  inventario: 'inventario',
  recetas: 'recetas',
  produccion: 'produccion',
  ventas: 'ventas',
  tienda: 'ventas',
  trastienda: 'ventas',
  utensilios: 'utensilios',
  'admin-usuarios': 'admin_usuarios'
};

function normalizarPermisos(permisos, rol) {
  if (rol === 'ceo' || rol === 'admin') {
    return {
      inventario: { ver: true, acciones: { ver: true } },
      recetas: { ver: true, acciones: { ver: true } },
      produccion: { ver: true, acciones: { ver: true } },
      ventas: { ver: true, acciones: { ver: true } },
      utensilios: { ver: true, acciones: { ver: true } },
      admin_usuarios: { ver: true, acciones: { ver: true } }
    };
  }

  const out = { ...PERMISOS_POR_DEFECTO };
  if (!permisos || typeof permisos !== 'object') return out;

  for (const key of Object.keys(out)) {
    const valor = permisos[key];
    if (typeof valor === 'boolean') {
      out[key] = { ver: valor, acciones: { ver: valor } };
      continue;
    }
    if (valor && typeof valor === 'object') {
      out[key] = {
        ver: Boolean(valor.ver),
        acciones: {
          ...(valor.acciones || {}),
          ver: typeof valor?.acciones?.ver !== 'undefined' ? Boolean(valor.acciones.ver) : Boolean(valor.ver)
        }
      };
    }
  }

  return out;
}

function normalizarUsuario(usuario) {
  if (!usuario) return null;
  return {
    ...usuario,
    permisos: normalizarPermisos(usuario.permisos, usuario.rol)
  };
}

function obtenerUsuarioGuardado() {
  try {
    return normalizarUsuario(JSON.parse(localStorage.getItem('usuario')) || null);
  } catch {
    return null;
  }
}

export default function App() {
  const [page, setPage] = useState('inventario');
  const [showAccesoSistema, setShowAccesoSistema] = useState(false);
  const [toquesLogoAcceso, setToquesLogoAcceso] = useState(0);
  const [trastiendaDesbloqueada, setTrastiendaDesbloqueada] = useState(false);
  const [menuContextoTrastienda, setMenuContextoTrastienda] = useState({ visible: false, x: 0, y: 0 });
  const [showSidebar, setShowSidebar] = useState(false);
  const [showPendientes, setShowPendientes] = useState(false);
  const [showAlertas, setShowAlertas] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [currentUser, setCurrentUser] = useState(obtenerUsuarioGuardado());
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [proveedoresPendientes, setProveedoresPendientes] = useState({
    visible: false,
    cargando: false,
    guardandoClave: '',
    pendientes: [],
    drafts: {}
  });
  const [fichasProveedorPendientes, setFichasProveedorPendientes] = useState({
    visible: false,
    cargando: false,
    guardandoClave: '',
    pendientes: [],
    drafts: {}
  });

  const isAuthenticated = Boolean(token && currentUser?.username);

  // mapping between page keys and hash fragments
  const hashMap = {
    inventario: '#/inventario',
    recetas: '#/recetas',
    produccion: '#/produccion',
    ventas: '#/ventas',
    tienda: '#/tienda',
    trastienda: '#/trastienda',
    utensilios: '#/utensilios',
    'admin-usuarios': '#/admin-usuarios'
  };

  const getPageFromHash = () => {
    const h = window.location.hash || '#/inventario';
    const entry = Object.entries(hashMap).find(([key, hash]) => hash === h);
    return entry ? entry[0] : 'inventario';
  };

  // synchronise page state with URL hash
  React.useEffect(() => {
    const onHashChange = () => setPage(getPageFromHash());
    window.addEventListener('hashchange', onHashChange);
    setPage(getPageFromHash());
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const changePage = (key) => {
    setPage(key);
    setShowSidebar(false);
    const h = hashMap[key];
    if (h) window.location.hash = h;
  };

  const canEditSection = useCallback((permisoClave) => {
    if (!currentUser) return false;
    if (currentUser.rol === 'ceo' || currentUser.rol === 'admin') return true;
    return Boolean(currentUser.permisos?.[permisoClave]?.acciones?.editar);
  }, [currentUser]);

  const cargarProveedoresPendientes = useCallback(async () => {
    if (!isAuthenticated) {
      setProveedoresPendientes({ visible: false, cargando: false, guardandoClave: '', pendientes: [], drafts: {} });
      return;
    }

    const puedeInventario = canEditSection('inventario');
    const puedeUtensilios = canEditSection('utensilios');
    if (!puedeInventario && !puedeUtensilios) {
      setProveedoresPendientes({ visible: false, cargando: false, guardandoClave: '', pendientes: [], drafts: {} });
      return;
    }

    setProveedoresPendientes((prev) => ({ ...prev, cargando: true }));
    try {
      const res = await fetchAPIJSON('/inventario/proveedores/pendientes');
      const pendientes = [];
      if (puedeInventario) {
        (res?.insumos || []).forEach((item) => {
          pendientes.push({ tipo: 'insumo', id: item.id, codigo: item.codigo || '', nombre: item.nombre || '', unidad: item.unidad || '', proveedor: item.proveedor || '' });
        });
      }
      if (puedeUtensilios) {
        (res?.utensilios || []).forEach((item) => {
          pendientes.push({ tipo: 'utensilio', id: item.id, codigo: item.codigo || '', nombre: item.nombre || '', unidad: item.unidad || '', proveedor: item.proveedor || '' });
        });
      }
      pendientes.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' }));
      const drafts = {};
      pendientes.forEach((item) => {
        drafts[`${item.tipo}:${item.id}`] = item.proveedor || '';
      });
      setProveedoresPendientes({ visible: pendientes.length > 0, cargando: false, guardandoClave: '', pendientes, drafts });
    } catch {
      setProveedoresPendientes((prev) => ({ ...prev, cargando: false }));
    }
  }, [isAuthenticated, canEditSection]);

  const cargarFichasProveedorPendientes = useCallback(async () => {
    if (!isAuthenticated) {
      setFichasProveedorPendientes({ visible: false, cargando: false, guardandoClave: '', pendientes: [], drafts: {} });
      return;
    }

    const puedeInventario = canEditSection('inventario');
    const puedeUtensilios = canEditSection('utensilios');
    if (!puedeInventario && !puedeUtensilios) {
      setFichasProveedorPendientes({ visible: false, cargando: false, guardandoClave: '', pendientes: [], drafts: {} });
      return;
    }

    setFichasProveedorPendientes((prev) => ({ ...prev, cargando: true }));
    try {
      const res = await fetchAPIJSON('/inventario/proveedores/fichas-pendientes');
      const pendientes = Array.isArray(res?.pendientes) ? res.pendientes : [];
      const drafts = {};
      pendientes.forEach((item) => {
        const clave = String(item?.nombre || '').trim().toLowerCase();
        if (!clave) return;
        drafts[clave] = {
          nombre: item?.nombre || '',
          direccion: item?.direccion || '',
          telefono: item?.telefono || '',
          forma_pago: item?.forma_pago || '',
          numero_cuenta: item?.numero_cuenta || '',
          correo: item?.correo || ''
        };
      });

      setFichasProveedorPendientes({
        visible: pendientes.length > 0,
        cargando: false,
        guardandoClave: '',
        pendientes,
        drafts
      });
    } catch {
      setFichasProveedorPendientes((prev) => ({ ...prev, cargando: false }));
    }
  }, [isAuthenticated, canEditSection]);

  const guardarProveedorPendiente = useCallback(async (item, opciones = {}) => {
    const { silencioso = false } = opciones || {};
    const clave = `${item.tipo}:${item.id}`;
    const proveedor = String(proveedoresPendientes.drafts?.[clave] || '').trim();
    if (!proveedor) {
      if (!silencioso) setLoginError('Debes capturar el proveedor para continuar.');
      return;
    }
    if (proveedoresPendientes.guardandoClave && proveedoresPendientes.guardandoClave !== clave) return;

    setProveedoresPendientes((prev) => ({ ...prev, guardandoClave: clave }));
    try {
      const endpoint = item.tipo === 'utensilio' ? `/utensilios/${item.id}/proveedor` : `/inventario/${item.id}/proveedor`;
      await fetchAPIJSON(endpoint, { method: 'PATCH', body: { proveedor } });
      await cargarProveedoresPendientes();
    } catch (error) {
      setProveedoresPendientes((prev) => ({ ...prev, guardandoClave: '' }));
      if (!silencioso) setLoginError(error?.message || 'No se pudo actualizar proveedor');
    }
  }, [proveedoresPendientes.drafts, proveedoresPendientes.guardandoClave, cargarProveedoresPendientes]);

  const guardarFichaProveedorPendiente = useCallback(async (item, opciones = {}) => {
    const { silencioso = false } = opciones || {};
    const clave = String(item?.nombre || '').trim().toLowerCase();
    if (!clave) return;
    const draft = fichasProveedorPendientes.drafts?.[clave] || {};
    const nombre = String(draft?.nombre || '').trim();
    const direccion = String(draft?.direccion || '').trim();
    const telefono = String(draft?.telefono || '').trim();
    const forma_pago = String(draft?.forma_pago || '').trim();
    const numero_cuenta = String(draft?.numero_cuenta || '').trim();
    const correo = String(draft?.correo || '').trim();
    const requiereCuenta = forma_pago.toLowerCase() === 'transferencia';

    if (!nombre || !direccion || !telefono || !forma_pago || !correo || (requiereCuenta && !numero_cuenta)) {
      if (!silencioso) setLoginError('Completa nombre, dirección, teléfono, forma de pago y correo. Si es transferencia, agrega la cuenta.');
      return;
    }
    if (fichasProveedorPendientes.guardandoClave && fichasProveedorPendientes.guardandoClave !== clave) return;

    setFichasProveedorPendientes((prev) => ({ ...prev, guardandoClave: clave }));
    try {
      await fetchAPIJSON('/inventario/proveedores/completar', {
        method: 'POST',
        body: { nombre, direccion, telefono, forma_pago, numero_cuenta: requiereCuenta ? numero_cuenta : '', correo }
      });
      await cargarFichasProveedorPendientes();
    } catch (error) {
      setFichasProveedorPendientes((prev) => ({ ...prev, guardandoClave: '' }));
      if (!silencioso) setLoginError(error?.message || 'No se pudo guardar la ficha del proveedor');
    }
  }, [fichasProveedorPendientes.drafts, fichasProveedorPendientes.guardandoClave, cargarFichasProveedorPendientes]);

  const guardarTodasFichasProveedorPendientes = useCallback(async () => {
    const pendientes = Array.isArray(fichasProveedorPendientes.pendientes) ? fichasProveedorPendientes.pendientes : [];
    if (!pendientes.length) return;

    for (const item of pendientes) {
      const clave = String(item?.nombre || '').trim().toLowerCase();
      const draft = fichasProveedorPendientes.drafts?.[clave] || {};
      const nombre = String(draft?.nombre || '').trim();
      const direccion = String(draft?.direccion || '').trim();
      const telefono = String(draft?.telefono || '').trim();
      const forma_pago = String(draft?.forma_pago || '').trim();
      const numero_cuenta = String(draft?.numero_cuenta || '').trim();
      const correo = String(draft?.correo || '').trim();
      if (!nombre || !direccion || !telefono || !forma_pago || !correo || (forma_pago.toLowerCase() === 'transferencia' && !numero_cuenta)) {
        setLoginError(`Completa todos los campos obligatorios del proveedor ${item?.nombre || ''}.`);
        return;
      }
    }

    setFichasProveedorPendientes((prev) => ({ ...prev, guardandoClave: '__ALL__' }));
    setLoginError('');
    try {
      for (const item of pendientes) {
        const clave = String(item?.nombre || '').trim().toLowerCase();
        const draft = fichasProveedorPendientes.drafts?.[clave] || {};
        await fetchAPIJSON('/inventario/proveedores/completar', {
          method: 'POST',
          body: {
            nombre: String(draft?.nombre || '').trim(),
            direccion: String(draft?.direccion || '').trim(),
            telefono: String(draft?.telefono || '').trim(),
            forma_pago: String(draft?.forma_pago || '').trim(),
            numero_cuenta: String(draft?.forma_pago || '').trim().toLowerCase() === 'transferencia' ? String(draft?.numero_cuenta || '').trim() : '',
            correo: String(draft?.correo || '').trim()
          }
        });
      }
      await cargarFichasProveedorPendientes();
    } catch (error) {
      setFichasProveedorPendientes((prev) => ({ ...prev, guardandoClave: '' }));
      setLoginError(error?.message || 'No se pudieron guardar todas las fichas');
    }
  }, [fichasProveedorPendientes.pendientes, fichasProveedorPendientes.drafts, cargarFichasProveedorPendientes]);

  const iniciarSesion = async (event) => {
    event.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetchAPIJSON('/api/auth/login', {
        method: 'POST',
        body: {
          username: loginForm.username,
          password: loginForm.password
        }
      });
      if (!res?.exito || !res?.token) {
        throw new Error(res?.mensaje || 'No se pudo iniciar sesión');
      }
      const usuario = {
        username: loginForm.username,
        nombre: res.nombre || loginForm.username,
        rol: res.rol || 'usuario',
        permisos: normalizarPermisos(res.permisos, res.rol || 'usuario')
      };
      localStorage.setItem('token', res.token);
      localStorage.setItem('usuario', JSON.stringify(usuario));
      setToken(res.token);
      setCurrentUser(usuario);
      setShowAccesoSistema(false);
      setLoginForm({ username: '', password: '' });
      setPage(getPageFromHash());
      if (res.debe_cambiar_password) {
        setTimeout(() => mostrarModalCambiarPassword(usuario.username), 150);
      }
    } catch (error) {
      setLoginError(error.message || 'Error al iniciar sesión');
    } finally {
      setLoginLoading(false);
    }
  };

  const cerrarSesion = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setToken('');
    setCurrentUser(null);
    setShowAccesoSistema(false);
    setShowSidebar(false);
    setShowAlertas(false);
    setPage('tienda');
    window.location.hash = '#/tienda';
  }, []);

  React.useEffect(() => {
    const onAuthInvalid = (event) => {
      const mensaje = event?.detail?.mensaje || 'Tu sesión expiró. Inicia sesión nuevamente.';
      cerrarSesion();
      setLoginError(mensaje);
    };

    window.addEventListener('chipactli:auth-invalid', onAuthInvalid);
    return () => window.removeEventListener('chipactli:auth-invalid', onAuthInvalid);
  }, [cerrarSesion]);

  React.useEffect(() => {
    if (!isAuthenticated) {
      cerrarWebSocket();
      return;
    }

    const estadoLegible = (estadoRaw) => {
      const estado = String(estadoRaw || '').toLowerCase();
      if (estado === 'pendiente') return 'pendiente';
      if (estado === 'entregado') return 'entregado';
      if (estado === 'cancelado') return 'cancelado';
      return estado || 'actualizado';
    };

    const formatearMoneda = (valor) => {
      const numero = Number(valor);
      if (!Number.isFinite(numero)) return '';
      return numero.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    };

    conectarWebSocket((evento) => {
      const tipo = String(evento?.tipo || '');
      if (!tipo) return;

      if (tipo === 'tienda_orden_nueva') {
        const folio = String(evento?.folio || '').trim();
        const cliente = String(evento?.cliente || '').trim() || 'Cliente';
        const metodo = String(evento?.metodo_pago || '').trim() || 'pago no definido';
        const total = formatearMoneda(evento?.total);
        const partes = [
          folio ? `Nueva orden ${folio}` : 'Nueva orden en tienda',
          `Cliente: ${cliente}`,
          total ? `Total: ${total}` : null,
          `Pago: ${metodo}`
        ].filter(Boolean);
        agregarAlerta(`tienda:nueva:${evento?.id_orden || Date.now()}`, partes.join(' · '), 'advertencia');
        return;
      }

      if (tipo === 'orden_compra_nueva') {
        const numero = String(evento?.numero_orden || '').trim();
        const proveedor = String(evento?.proveedor || '').trim() || 'Sin proveedor';
        const totalItems = Number(evento?.total_items) || 0;
        agregarAlerta(
          `orden-compra:nueva:${evento?.id_orden || Date.now()}`,
          `${numero ? `Nueva orden de compra ${numero}` : 'Nueva orden de compra'} · Proveedor: ${proveedor} · Items: ${totalItems}`,
          'advertencia'
        );
        return;
      }

      if (tipo === 'tienda_orden_actualizada') {
        const idOrden = evento?.id_orden ? `#${evento.id_orden}` : '';
        agregarAlerta(
          `tienda:estado:${evento?.id_orden || Date.now()}`,
          `Orden ${idOrden} marcada como ${estadoLegible(evento?.estado)}`.trim(),
          'exito'
        );
        return;
      }

      if (tipo === 'inventario_actualizado') {
        agregarAlerta('sistema:inventario', 'Inventario actualizado', 'advertencia');
        return;
      }

      if (tipo === 'ventas_actualizado') {
        agregarAlerta('sistema:ventas', 'Ventas actualizadas', '');
        return;
      }

      if (tipo === 'produccion_actualizado') {
        agregarAlerta('sistema:produccion', 'Producción actualizada', '');
        return;
      }

      if (tipo === 'cortesias_actualizado') {
        agregarAlerta('sistema:cortesias', 'Cortesías actualizadas', '');
        return;
      }

      if (tipo === 'recetas_actualizado') {
        agregarAlerta('sistema:recetas', 'Recetas actualizadas', '');
        return;
      }

      if (tipo === 'categorias_actualizado') {
        agregarAlerta('sistema:categorias', 'Categorías actualizadas', '');
        return;
      }

      if (tipo === 'utensilios_actualizado') {
        agregarAlerta('sistema:utensilios', 'Utensilios actualizados', '');
      }
    });

    return () => {
      cerrarWebSocket();
    };
  }, [isAuthenticated]);

  React.useEffect(() => {
    if (!isAuthenticated) {
      setProveedoresPendientes({ visible: false, cargando: false, guardandoClave: '', pendientes: [], drafts: {} });
      setFichasProveedorPendientes({ visible: false, cargando: false, guardandoClave: '', pendientes: [], drafts: {} });
      return;
    }
    cargarProveedoresPendientes();
    cargarFichasProveedorPendientes();
  }, [isAuthenticated, cargarProveedoresPendientes, cargarFichasProveedorPendientes]);

  // expose helpers to legacy code
  React.useEffect(() => {
    inicializarCierreModalConEsc();

    window.mostrarPendientesInsumos = () => setShowPendientes(true);
    window.cerrarModal = (id) => {
      if (id === 'modalPendientesInsumos') setShowPendientes(false);
    };

    // notification/alert helpers used by legacy scripts
    window.mostrarNotificacion = mostrarNotificacion;
    window.cerrarNotificacion = cerrarNotificacion;
    window.agregarAlerta = agregarAlerta;
    window.removerAlertaPorClave = removerAlertaPorClave;
    window.actualizarUIAlertas = actualizarUIAlertas;
    window.cambiarPestanaAlertas = cambiarPestanaAlertas;
    window.alternarAlertas = () => {
      setShowAlertas(prev => {
        const next = !prev;
        if (next) {
          setTimeout(() => {
            actualizarUIAlertas();
            cambiarPestanaAlertas('activas');
          }, 0);
        }
        return next;
      });
    };

    // legacy code sometimes references window.notificaciones
    window.notificaciones = {
      agregarAlerta,
      removerAlertaPorClave,
      actualizarUIAlertas
    };
  }, []);

  React.useEffect(() => {
    const onEsc = (event) => {
      if (event.key !== 'Escape') return;

      if (showPendientes) {
        setShowPendientes(false);
        return;
      }

      if (showAlertas) {
        setShowAlertas(false);
      }
    };

    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [showPendientes, showAlertas]);

  React.useEffect(() => {
    const onDocClick = (event) => {
      const icon = document.querySelector('.iconoAlertas');
      const panel = document.getElementById('desplegableAlertas');
      const sidebar = document.querySelector('.sidebar');
      const target = event.target;

      if (showSidebar) {
        const isInsideSidebar = sidebar?.contains(target);
        const isToggleButton = target instanceof Element && !!target.closest('.botonToggleMenu, .menu-toggle');
        if (!isInsideSidebar && !isToggleButton) {
          setShowSidebar(false);
        }
      }

      if (!showAlertas) return;
      if (icon?.contains(event.target) || panel?.contains(event.target)) return;
      setShowAlertas(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [showAlertas, showSidebar]);

  React.useEffect(() => {
    if (!menuContextoTrastienda.visible) return undefined;
    const cerrar = () => setMenuContextoTrastienda({ visible: false, x: 0, y: 0 });
    window.addEventListener('click', cerrar);
    window.addEventListener('scroll', cerrar, true);
    return () => {
      window.removeEventListener('click', cerrar);
      window.removeEventListener('scroll', cerrar, true);
    };
  }, [menuContextoTrastienda.visible]);

  const menuGroups = [
    {
      key: 'operacion',
      label: 'Operación',
      items: [
        { key: 'inventario', label: 'Inventario' },
        { key: 'recetas', label: 'Recetas' },
        { key: 'produccion', label: 'Producción' },
        { key: 'ventas', label: 'Ventas' },
        { key: 'tienda', label: 'Tienda' },
        { key: 'trastienda', label: 'Trastienda' }
      ]
    },
    {
      key: 'administracion',
      label: 'Administración',
      items: [
        { key: 'admin-usuarios', label: 'Admin Usuarios' }
      ]
    }
  ];

  const canViewPage = (pageKey) => {
    if (!currentUser) return false;
    const permiso = MAPEO_PESTANA_PERMISO[pageKey];
    if (!permiso) return false;
    if (currentUser.rol === 'ceo' || currentUser.rol === 'admin') return true;
    return Boolean(currentUser.permisos?.[permiso]?.ver);
  };

  const firstAllowedPage = () => {
    const allPages = Object.keys(MAPEO_PESTANA_PERMISO);
    return allPages.find((key) => canViewPage(key)) || 'inventario';
  };

  React.useEffect(() => {
    if (!isAuthenticated) return;
    if (!canViewPage(page)) {
      changePage(firstAllowedPage());
    }
  }, [isAuthenticated, page, currentUser]);

  const pageComponents = {
    inventario: Inventario,
    recetas: Recetas,
    produccion: Produccion,
    ventas: Ventas,
    tienda: () => <Tienda modo="tienda" />,
    trastienda: () => <Tienda modo="trastienda" />,
    utensilios: Utensilios,
    'admin-usuarios': AdminUsuarios
  };
  const PageComponent = pageComponents[page] || (() => null);

  if (!isAuthenticated) {
    const registrarToqueLogo = (event) => {
      const el = event.currentTarget;
      const rect = el.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const center = rect.width / 2;
      const dx = x - center;
      const dy = y - center;
      const distance = Math.sqrt((dx * dx) + (dy * dy));
      const outerRadius = rect.width / 2;
      const innerRadius = outerRadius * 0.58;

      if (distance < innerRadius || distance > outerRadius) {
        return;
      }

      setToquesLogoAcceso((prev) => {
        const next = prev + 1;
        if (next >= 5) {
          setTrastiendaDesbloqueada(true);
          mostrarNotificacion('Acceso trastienda habilitado: click derecho para entrar', 'exito');
          return 0;
        }
        return next;
      });
    };

    const abrirMenuTrastienda = (event) => {
      if (!trastiendaDesbloqueada) return;
      event.preventDefault();
      setMenuContextoTrastienda({ visible: true, x: event.clientX, y: event.clientY });
    };

    return (
      <div className="app" style={{ minHeight: '100vh', padding: '20px' }} onContextMenu={abrirMenuTrastienda}>
        <Tienda
          modo="tienda"
          mostrarLogoAccesoSistema
          onClickLogoAccesoSistema={registrarToqueLogo}
        />

        {menuContextoTrastienda.visible && (
          <div
            className="menuContextoTrastienda"
            style={{ left: `${menuContextoTrastienda.x}px`, top: `${menuContextoTrastienda.y}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="menuContextoTrastiendaItem"
              onClick={() => {
                setMenuContextoTrastienda({ visible: false, x: 0, y: 0 });
                setShowAccesoSistema(true);
              }}
            >
              Entrar a trastienda
            </button>
          </div>
        )}

        {showAccesoSistema && (
          <div className="accesoSistemaOverlay" onClick={() => setShowAccesoSistema(false)}>
            <div className="loginCard" onClick={(e) => e.stopPropagation()}>
              <img className="loginLogo" src="/images/logo.png" alt="logo" />
              <h1 className="loginTitulo">CHIPACTLI</h1>
              <p className="loginSubtitulo">Inicia sesión para entrar al sistema</p>
              <form onSubmit={iniciarSesion} className="loginFormulario">
                <input
                  className="loginInput"
                  type="text"
                  placeholder="Usuario"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                  required
                />
                <input
                  className="loginInput"
                  type="password"
                  placeholder="Contraseña"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  required
                />
                {loginError && <div className="loginError">{loginError}</div>}
                <button className="loginBoton" type="submit" disabled={loginLoading}>
                  {loginLoading ? 'Ingresando...' : 'Entrar'}
                </button>
                <button type="button" className="boton" onClick={() => setShowAccesoSistema(false)}>
                  Cerrar
                </button>
              </form>
            </div>
          </div>
        )}
        </div>
    );
  }

  return (
    <div className="app" style={{ display: 'flex', minHeight: '100vh' }}>
      <aside className={`sidebar ${showSidebar ? 'visible' : ''}`}>
        <nav className="menuNavegacion">
          {menuGroups.map(group => {
            const visibleItems = group.items.filter(item => canViewPage(item.key));
            if (!visibleItems.length) return null;
            return (
              <div className="grupoMenu" key={group.key}>
                <div className="tituloGrupoMenu">{group.label}</div>
                <ul className="listaGrupoMenu">
                  {visibleItems.map(item => (
                    <li key={item.key} className="elementoMenuContenedor">
                      <a
                        href={hashMap[item.key] || '#/inventario'}
                        className={page === item.key ? 'activo elementoMenu enlaceMenu' : 'elementoMenu enlaceMenu'}
                        onClick={(event) => {
                          event.preventDefault();
                          changePage(item.key);
                        }}
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="menuAcciones">
          <button className="botonSalir botonSalirMenu" onClick={cerrarSesion} title="Cerrar sesión">Salir</button>
        </div>
      </aside>

      <main className="main" style={{ flex: 1, padding: 20, position: 'relative', paddingTop: 110 }}>
        {/* fixed header replicating legacy layout */}
        <div className="headerCardFijo">
          <div className="headerLeft">
            <img id="logoEncabezado" src="/images/logo.png" alt="logo" />
            <button className="botonToggleMenu botonPuntos" onClick={() => setShowSidebar(s => !s)} title="Abrir menú">⋮</button>
          </div>
          <div className="tituloEncabezado">CHIPACTLI</div>
          <div className="headerRight">
            <div className="usuarioSesion" title={currentUser?.rol || ''}>
              {currentUser?.nombre || currentUser?.username}
            </div>
            <div className="iconoAlertas" onClick={() => window.alternarAlertas?.()}>
              🔔
              <span className="distintivo oculto" id="conteoAlertas">0</span>
            </div>
            <div id="desplegableAlertas" className={`desplegableAlertas ${showAlertas ? 'mostrado' : ''}`}>
              <div className="encabezadoDesplegable">
                <button id="tabAlertasActivas" className="tabAlerta activa" onClick={() => cambiarPestanaAlertas('activas')}>Activas</button>
                <button id="tabAlertasHistorial" className="tabAlerta" onClick={() => cambiarPestanaAlertas('historial')}>Historial</button>
              </div>
              <div id="listaAlertas" className="listaAlertas"></div>
              <div id="listaAlertasHistorial" className="listaAlertas oculto"></div>
            </div>
          </div>
        </div>

        {/* legacy menu-toggle kept for smaller screens if needed */}
        <button className="menu-toggle" onClick={() => setShowSidebar(s => !s)}>☰</button>
        <div id="app-content">
          <PageComponent />
        </div>
      </main>

      {/* legacy modal for pending products */}
      {showPendientes && (
        <div id="modalPendientesInsumos" className="modal" style={{ display: 'flex' }} onClick={() => setShowPendientes(false)}>
          <div className="contenidoModal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="encabezadoModal">
              <h3>Productos pendientes o incompletos</h3>
              <button className="cerrarModal" onClick={() => setShowPendientes(false)}>&times;</button>
            </div>
            <div id="cuerpoPendientesInsumos" style={{ padding: '20px', maxHeight: '55vh', overflowY: 'auto' }}></div>
          </div>
        </div>
      )}

      {/* notification modal used by legacy scripts */}
      <div id="modalNotificacion" className="modalNotificacion" style={{ display: 'none' }}>
        <div className="contenidoModal">
          <div className="encabezadoModal">
            <h3 id="tituloNotificacion"></h3>
            <button className="cerrarModal" onClick={() => cerrarNotificacion()}>&times;</button>
          </div>
          <div id="mensajeNotificacion" className="cuerpoModal"></div>
        </div>
      </div>
      <div id="fondoNotificacion" className="fondoNotificacion" onClick={() => cerrarNotificacion()} style={{ display: 'none' }}></div>

      <div id="modalConfirmacion" className="modal" onClick={(e) => { if (e.target.id === 'modalConfirmacion') document.getElementById('btnConfirmacionCancelar')?.click(); }}>
        <div className="contenidoModal" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal">
            <h3 id="tituloConfirmacion">Confirmar</h3>
            <button className="cerrarModal" onClick={() => document.getElementById('btnConfirmacionCancelar')?.click()}>&times;</button>
          </div>
          <div className="cajaFormulario">
            <p id="textoConfirmacion" style={{ marginBottom: '16px' }}></p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button id="btnConfirmacionCancelar" type="button" className="boton">Cancelar</button>
              <button id="btnConfirmacionAceptar" type="button" className="boton botonDanger">Aceptar</button>
            </div>
          </div>
        </div>
      </div>

      {proveedoresPendientes.visible && (
        <div className="modal" style={{ display: 'flex', zIndex: 3200 }} onClick={(e) => e.stopPropagation()}>
          <div className="contenidoModal modalProveedorObligatorio" onClick={(e) => e.stopPropagation()}>
            <div className="encabezadoModal">
              <h3>Actualizar proveedores obligatorios</h3>
            </div>
            <div className="cajaFormulario">
              <p style={{ marginTop: 0, marginBottom: '10px', color: '#444' }}>
                Debes completar proveedor en todos los insumos y utensilios pendientes para continuar.
              </p>
              {proveedoresPendientes.cargando ? (
                <div style={{ padding: '12px 0' }}>Cargando pendientes...</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Código</th>
                      <th>Nombre</th>
                      <th>Unidad</th>
                      <th>Proveedor</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(proveedoresPendientes.pendientes || []).map((item, indice) => {
                      const clave = `${item.tipo}:${item.id}`;
                      const guardando = proveedoresPendientes.guardandoClave === clave;
                      return (
                        <tr key={clave}>
                          <td>{item.tipo === 'utensilio' ? 'Utensilio' : 'Insumo'}</td>
                          <td>{item.codigo || '-'}</td>
                          <td>{item.nombre || '-'}</td>
                          <td>{item.unidad || '-'}</td>
                          <td>
                            <input
                              type="text"
                              data-proveedor-clave={clave}
                              value={proveedoresPendientes.drafts?.[clave] || ''}
                              onChange={(event) => {
                                const valor = event.target.value;
                                setProveedoresPendientes((prev) => ({
                                  ...prev,
                                  drafts: { ...(prev.drafts || {}), [clave]: valor }
                                }));
                              }}
                              onBlur={() => guardarProveedorPendiente(item, { silencioso: true })}
                              onKeyDown={(event) => {
                                if (event.key !== 'Enter') return;
                                event.preventDefault();
                                guardarProveedorPendiente(item, { silencioso: true });
                                const siguiente = (proveedoresPendientes.pendientes || [])[indice + 1];
                                if (!siguiente) return;
                                const siguienteClave = `${siguiente.tipo}:${siguiente.id}`;
                                window.setTimeout(() => {
                                  const input = document.querySelector(`[data-proveedor-clave="${siguienteClave}"]`);
                                  if (input instanceof HTMLElement) {
                                    input.focus();
                                    if (typeof input.select === 'function') input.select();
                                  }
                                }, 0);
                              }}
                              placeholder="Proveedor"
                            />
                          </td>
                          <td>
                            <button className="boton botonExito" type="button" disabled={guardando} onClick={() => guardarProveedorPendiente(item)}>
                              {guardando ? 'Guardando...' : 'Guardar'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {fichasProveedorPendientes.visible && (
        <div className="modal" style={{ display: 'flex', zIndex: 3300 }} onClick={(e) => e.stopPropagation()}>
          <div className="contenidoModal modalProveedorObligatorio" style={{ maxWidth: '1100px' }} onClick={(e) => e.stopPropagation()}>
            <div className="encabezadoModal">
              <h3>Completar fichas de proveedores</h3>
            </div>
            <div className="cajaFormulario">
              <p style={{ marginTop: 0, marginBottom: '10px', color: '#444' }}>
                Debes completar dirección, teléfono, forma de pago y correo de todos los proveedores existentes para continuar.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                <button
                  className="boton botonExito"
                  type="button"
                  disabled={fichasProveedorPendientes.guardandoClave === '__ALL__' || fichasProveedorPendientes.cargando}
                  onClick={() => guardarTodasFichasProveedorPendientes()}
                >
                  {fichasProveedorPendientes.guardandoClave === '__ALL__' ? 'Guardando todo...' : 'Guardar todo'}
                </button>
              </div>
              {fichasProveedorPendientes.cargando ? (
                <div style={{ padding: '12px 0' }}>Cargando proveedores...</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th>Dirección</th>
                      <th>Teléfono</th>
                      <th>Forma de pago</th>
                      <th>Número de cuenta</th>
                      <th>Correo</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(fichasProveedorPendientes.pendientes || []).map((item) => {
                      const clave = String(item?.nombre || '').trim().toLowerCase();
                      const guardando = fichasProveedorPendientes.guardandoClave === clave || fichasProveedorPendientes.guardandoClave === '__ALL__';
                      const draft = fichasProveedorPendientes.drafts?.[clave] || {};
                      return (
                        <tr key={clave}>
                          <td>
                            <input
                              type="text"
                              value={draft?.nombre || ''}
                              onChange={(event) => {
                                const valor = event.target.value;
                                setFichasProveedorPendientes((prev) => ({
                                  ...prev,
                                  drafts: { ...(prev.drafts || {}), [clave]: { ...(prev.drafts?.[clave] || {}), nombre: valor } }
                                }));
                              }}
                              placeholder="Nombre"
                            />
                          </td>
                          <td>
                            <textarea
                              value={draft?.direccion || ''}
                              onChange={(event) => {
                                const valor = event.target.value;
                                setFichasProveedorPendientes((prev) => ({
                                  ...prev,
                                  drafts: { ...(prev.drafts || {}), [clave]: { ...(prev.drafts?.[clave] || {}), direccion: valor } }
                                }));
                              }}
                              placeholder="Dirección"
                              rows={2}
                              style={{ resize: 'vertical', minHeight: '42px', width: '100%' }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={draft?.telefono || ''}
                              onChange={(event) => {
                                const valor = event.target.value;
                                setFichasProveedorPendientes((prev) => ({
                                  ...prev,
                                  drafts: { ...(prev.drafts || {}), [clave]: { ...(prev.drafts?.[clave] || {}), telefono: valor } }
                                }));
                              }}
                              placeholder="Teléfono"
                            />
                          </td>
                          <td>
                            <select
                              value={draft?.forma_pago || ''}
                              onChange={(event) => {
                                const valor = event.target.value;
                                setFichasProveedorPendientes((prev) => ({
                                  ...prev,
                                  drafts: {
                                    ...(prev.drafts || {}),
                                    [clave]: {
                                      ...(prev.drafts?.[clave] || {}),
                                      forma_pago: valor,
                                      numero_cuenta: valor?.toLowerCase() === 'transferencia' ? (prev.drafts?.[clave]?.numero_cuenta || '') : ''
                                    }
                                  }
                                }));
                              }}
                            >
                              <option value="">Seleccionar</option>
                              <option value="Transferencia">Transferencia</option>
                              <option value="Tarjeta">Tarjeta</option>
                              <option value="Efectivo">Efectivo</option>
                              <option value="Tarjeta/Efectivo">Tarjeta/Efectivo</option>
                              <option value="Interna">Interna</option>
                            </select>
                          </td>
                          <td>
                            {String(draft?.forma_pago || '').toLowerCase() === 'transferencia' ? (
                              <input
                                type="text"
                                value={draft?.numero_cuenta || ''}
                                onChange={(event) => {
                                  const valor = event.target.value;
                                  setFichasProveedorPendientes((prev) => ({
                                    ...prev,
                                    drafts: { ...(prev.drafts || {}), [clave]: { ...(prev.drafts?.[clave] || {}), numero_cuenta: valor } }
                                  }));
                                }}
                                placeholder="Cuenta"
                              />
                            ) : (
                              <span style={{ color: '#777', fontSize: '12px' }}>No aplica</span>
                            )}
                          </td>
                          <td>
                            <input
                              type="email"
                              value={draft?.correo || ''}
                              onChange={(event) => {
                                const valor = event.target.value;
                                setFichasProveedorPendientes((prev) => ({
                                  ...prev,
                                  drafts: { ...(prev.drafts || {}), [clave]: { ...(prev.drafts?.[clave] || {}), correo: valor } }
                                }));
                              }}
                              placeholder="Correo"
                            />
                          </td>
                          <td>
                            <button className="boton botonExito" type="button" disabled={guardando} onClick={() => guardarFichaProveedorPendiente(item)}>
                              {guardando ? 'Guardando...' : 'Guardar'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
