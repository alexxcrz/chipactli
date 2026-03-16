import React, { useCallback, useRef, useState } from 'react';
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
import PasswordInput from '../../components/PasswordInput.jsx';
import { fetchAPIJSON } from '../../utils/api.jsx';
import { mostrarModalCambiarPassword } from '../modal-cambiar-password.jsx';
import { inicializarCierreModalConEsc } from '../../utils/modales.jsx';
import { conectarWebSocket, cerrarWebSocket } from '../../utils/websocket.jsx';

let secuenciaCampoAuto = 0;

function asegurarAtributosFormulario(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  const campos = root.querySelectorAll('input, select, textarea');
  campos.forEach((campo) => {
    if (!campo) return;
    if (!campo.id) {
      secuenciaCampoAuto += 1;
      campo.id = `chipactli-campo-${secuenciaCampoAuto}`;
    }
    if (!campo.getAttribute('name')) {
      campo.setAttribute('name', campo.id);
    }

    const dentroDeLabel = Boolean(campo.closest('label'));
    const labelAsociado = campo.id
      ? document.querySelector(`label[for="${campo.id}"]`)
      : null;
    const tieneEtiquetaSemantica = dentroDeLabel || Boolean(labelAsociado);

    if (!tieneEtiquetaSemantica && !campo.getAttribute('aria-label')) {
      const sugerido = String(
        campo.getAttribute('placeholder')
        || campo.getAttribute('name')
        || campo.id
        || 'campo'
      ).trim();
      if (sugerido) {
        campo.setAttribute('aria-label', sugerido);
      }
    }
  });
}

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

const TITULOS_PAGINA = {
  inventario: 'Chipactli - inventario',
  recetas: 'Chipactli - recetas',
  produccion: 'Chipactli - produccion',
  ventas: 'Chipactli - ventas',
  tienda: 'Chipactli - tienda',
  trastienda: 'Chipactli - tienda',
  utensilios: 'Chipactli - utensilios',
  'admin-usuarios': 'Chipactli - admin usuarios'
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

function limpiarPayloadImportacionTodo(datos) {
  const payload = (datos && typeof datos === 'object' && !Array.isArray(datos)) ? { ...datos } : datos;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  if (Object.prototype.hasOwnProperty.call(payload, 'archivos_uploads_tienda')) {
    delete payload.archivos_uploads_tienda;
  }
  payload.incluye_uploads_tienda = false;
  return payload;
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
  const [page, setPage] = useState('tienda');
  const [showAccesoSistema, setShowAccesoSistema] = useState(false);
  const [toquesLogoAcceso, setToquesLogoAcceso] = useState(0);
  const [trastiendaDesbloqueada, setTrastiendaDesbloqueada] = useState(false);
  const [menuContextoTrastienda, setMenuContextoTrastienda] = useState({ visible: false, x: 0, y: 0 });
  const [importacionTodoPendiente, setImportacionTodoPendiente] = useState(null);
  const inputImportarTodoMenuRef = useRef(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showPendientes, setShowPendientes] = useState(false);
  const [showAlertas, setShowAlertas] = useState(false);
  const [mostrarBotonInicio, setMostrarBotonInicio] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [currentUser, setCurrentUser] = useState(obtenerUsuarioGuardado());
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [eventoInstalacionPwa, setEventoInstalacionPwa] = useState(null);
  const [mostrarInstalarPwa, setMostrarInstalarPwa] = useState(false);
  const [configInicial, setConfigInicial] = useState({
    visible: false,
    tokenConfiguracion: '',
    maestroUsername: '',
    loading: false,
    error: '',
    crearAdmin: false,
    form: {
      ceo_username: '',
      ceo_nombre: 'Director General',
      ceo_password: '',
      admin_username: '',
      admin_nombre: 'Administrador',
      admin_password: ''
    }
  });
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

  const irAlInicio = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const refrescarDatosSinRecargar = useCallback(() => {
    const tipos = [
      'inventario_actualizado',
      'recetas_actualizado',
      'produccion_actualizado',
      'ventas_actualizado',
      'categorias_actualizado',
      'tienda_catalogo_actualizado'
    ];
    tipos.forEach((tipo) => {
      window.dispatchEvent(new CustomEvent('chipactli:realtime', { detail: { tipo } }));
    });
    window.dispatchEvent(new CustomEvent('chipactli:app-soft-refresh'));
  }, []);

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
    const h = window.location.hash || '#/tienda';
    if (h.startsWith('#/trastienda')) return 'trastienda';
    if (h.startsWith('#/tienda')) return 'tienda';
    const entry = Object.entries(hashMap).find(([key, hash]) => hash === h);
    return entry ? entry[0] : 'tienda';
  };

  // synchronise page state with URL hash
  React.useEffect(() => {
    const actualizarVisibilidadBotonInicio = () => {
      const top = window.scrollY || window.pageYOffset || 0;
      setMostrarBotonInicio(top > 260);
    };

    actualizarVisibilidadBotonInicio();
    window.addEventListener('scroll', actualizarVisibilidadBotonInicio, { passive: true });
    return () => window.removeEventListener('scroll', actualizarVisibilidadBotonInicio);
  }, []);

  React.useEffect(() => {
    const onHashChange = () => {
      if (!isAuthenticated) {
        setPage('tienda');
        if (window.location.hash !== '#/tienda') {
          window.location.hash = '#/tienda';
        }
        return;
      }
      setPage(getPageFromHash());
    };
    window.addEventListener('hashchange', onHashChange);
    onHashChange();
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [isAuthenticated]);

  React.useEffect(() => {
    if (!isAuthenticated) {
      document.title = 'Chipactli';
      return;
    }
    document.title = TITULOS_PAGINA[page] || 'Chipactli';
  }, [page, isAuthenticated]);

  React.useEffect(() => {
    asegurarAtributosFormulario(document);

    const observer = new MutationObserver((mutaciones) => {
      for (const mutacion of mutaciones) {
        if (!mutacion?.addedNodes?.length) continue;
        mutacion.addedNodes.forEach((nodo) => {
          if (!(nodo instanceof Element)) return;
          if (nodo.matches?.('input, select, textarea')) {
            asegurarAtributosFormulario(nodo.parentElement || nodo);
          } else {
            asegurarAtributosFormulario(nodo);
          }
        });
      }
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => observer.disconnect();
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

  const completarConfiguracionInicial = async (event) => {
    event.preventDefault();
    if (!configInicial.tokenConfiguracion) {
      setConfigInicial((prev) => ({ ...prev, error: 'Token de configuracion inicial no disponible' }));
      return;
    }

    setConfigInicial((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await fetchAPIJSON('/api/auth/configuracion-inicial', {
        method: 'POST',
        body: {
          token_configuracion: configInicial.tokenConfiguracion,
          ceo_username: configInicial.form.ceo_username,
          ceo_nombre: configInicial.form.ceo_nombre,
          ceo_password: configInicial.form.ceo_password,
          admin_username: configInicial.crearAdmin ? configInicial.form.admin_username : '',
          admin_nombre: configInicial.crearAdmin ? configInicial.form.admin_nombre : '',
          admin_password: configInicial.crearAdmin ? configInicial.form.admin_password : ''
        }
      });

      const loginRes = await fetchAPIJSON('/api/auth/login', {
        method: 'POST',
        body: {
          username: String(configInicial.form.ceo_username || '').trim().toLowerCase(),
          password: configInicial.form.ceo_password
        }
      });

      if (!loginRes?.exito || !loginRes?.token) {
        throw new Error('Configuracion guardada, pero no se pudo iniciar sesion automaticamente');
      }

      const usuario = {
        username: String(configInicial.form.ceo_username || '').trim().toLowerCase(),
        nombre: loginRes.nombre || configInicial.form.ceo_nombre || 'CEO',
        rol: loginRes.rol || 'ceo',
        permisos: normalizarPermisos(loginRes.permisos, loginRes.rol || 'ceo')
      };

      localStorage.setItem('token', loginRes.token);
      localStorage.setItem('usuario', JSON.stringify(usuario));
      setToken(loginRes.token);
      setCurrentUser(usuario);
      setShowAccesoSistema(false);
      setPage(getPageFromHash());

      setConfigInicial((prev) => ({
        ...prev,
        visible: false,
        loading: false,
        tokenConfiguracion: '',
        maestroUsername: '',
        error: '',
        crearAdmin: false,
        form: {
          ceo_username: '',
          ceo_nombre: 'Director General',
          ceo_password: '',
          admin_username: '',
          admin_nombre: 'Administrador',
          admin_password: ''
        }
      }));
      setLoginForm({ username: '', password: '' });
      setLoginError('');
      mostrarNotificacion(res?.mensaje || 'Configuracion inicial completada', 'exito');
    } catch (error) {
      setConfigInicial((prev) => ({ ...prev, loading: false, error: error.message || 'No se pudo completar la configuracion inicial' }));
    }
  };

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
      if (res?.requiere_configuracion_inicial && res?.token_configuracion) {
        setConfigInicial((prev) => ({
          ...prev,
          visible: true,
          tokenConfiguracion: res.token_configuracion,
          maestroUsername: res.usuario_maestro || loginForm.username,
          loading: false,
          error: ''
        }));
        return;
      }

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

      if (importacionTodoPendiente?.datos) {
        try {
          const payloadImportacion = limpiarPayloadImportacionTodo(importacionTodoPendiente.datos);
          await fetchAPIJSON('/api/importar/todo', {
            method: 'POST',
            body: payloadImportacion
          });
          setImportacionTodoPendiente(null);
          mostrarNotificacion('✅ Respaldo TOTAL importado correctamente', 'exito');
          refrescarDatosSinRecargar();
          return;
        } catch (errorImportar) {
          setImportacionTodoPendiente(null);
          mostrarNotificacion(`❌ Error al importar respaldo: ${errorImportar?.message || 'Error desconocido'}`, 'error');
        }
      }

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
    const enModoStandalone = () => {
      if (typeof window === 'undefined') return false;
      const porDisplayMode = window.matchMedia?.('(display-mode: standalone)')?.matches;
      const porIos = window.navigator?.standalone === true;
      return Boolean(porDisplayMode || porIos);
    };

    if (enModoStandalone()) {
      setMostrarInstalarPwa(false);
      setEventoInstalacionPwa(null);
      return undefined;
    }

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setEventoInstalacionPwa(event);
      setMostrarInstalarPwa(true);
    };

    const onAppInstalled = () => {
      setEventoInstalacionPwa(null);
      setMostrarInstalarPwa(false);
      mostrarNotificacion('App instalada correctamente', 'exito');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const instalarAppPwa = async () => {
    const evento = eventoInstalacionPwa;
    if (!evento) {
      mostrarNotificacion('Tu navegador no permite instalacion directa en este momento', 'advertencia');
      return;
    }

    evento.prompt();
    try {
      const resultado = await evento.userChoice;
      if (resultado?.outcome === 'accepted') {
        mostrarNotificacion('Instalacion iniciada', 'exito');
      }
    } catch {
      // Ignorar errores de browsers sin userChoice estable.
    }

    setEventoInstalacionPwa(null);
    setMostrarInstalarPwa(false);
  };

  React.useEffect(() => {
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

    const textoEntidad = (...opciones) => {
      for (const opcion of opciones) {
        const txt = String(opcion || '').trim();
        if (txt) return txt;
      }
      return '';
    };

    const claveEventoUnica = (tipo, evento) => {
      const idRef = textoEntidad(
        evento?.id,
        evento?.id_orden,
        evento?.id_receta,
        evento?.id_insumo,
        evento?.numero_orden,
        evento?.folio,
        evento?.nombre_receta,
        evento?.receta,
        evento?.nombre_insumo,
        evento?.insumo,
        Date.now()
      );
      return `${String(tipo || 'evento').trim()}:${idRef}:${Date.now()}`;
    };

    conectarWebSocket((evento) => {
      const tipo = String(evento?.tipo || '');
      if (!tipo) return;

      window.dispatchEvent(new CustomEvent('chipactli:realtime', { detail: evento }));

      // Keep realtime updates available for public views (e.g. tienda),
      // but only show internal alert feed to authenticated users.
      if (!isAuthenticated) return;

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
        const hashPedidos = folio
          ? `#/trastienda/pedidos?folio=${encodeURIComponent(folio)}`
          : (evento?.id_orden ? `#/trastienda/pedidos?id_orden=${encodeURIComponent(String(evento.id_orden))}` : '#/trastienda/pedidos');
        agregarAlerta(
          `tienda:nueva:${evento?.id_orden || Date.now()}`,
          partes.join(' · '),
          'advertencia',
          {
            destino: { page: 'trastienda', section: 'pedidos', hash: hashPedidos },
            meta: { id_orden: evento?.id_orden || null, folio: folio || '' }
          }
        );
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
        const folio = String(evento?.folio || '').trim();
        const refOrden = folio || (evento?.id_orden ? `#${evento.id_orden}` : '');
        const hashPedidos = folio
          ? `#/trastienda/pedidos?folio=${encodeURIComponent(folio)}`
          : (evento?.id_orden ? `#/trastienda/pedidos?id_orden=${encodeURIComponent(String(evento.id_orden))}` : '#/trastienda/pedidos');
        agregarAlerta(
          claveEventoUnica('tienda:estado', evento),
          `Orden ${refOrden} marcada como ${estadoLegible(evento?.estado)}`.trim(),
          'exito',
          {
            destino: { page: 'trastienda', section: 'pedidos', hash: hashPedidos },
            meta: { id_orden: evento?.id_orden || null, folio: folio || '' }
          }
        );
        return;
      }

      if (tipo === 'produccion_descuento') {
        const receta = textoEntidad(evento?.receta, evento?.nombre_receta, evento?.receta_nombre);
        const paquete = textoEntidad(evento?.paquete, evento?.nombre_paquete);
        const cantidad = Number(evento?.cantidad || evento?.cantidad_paquetes || 0);
        const titulo = receta
          ? `Producción aplicada en receta ${receta}`
          : (paquete ? `Producción aplicada en paquete ${paquete}` : 'Producción aplicada');
        const detalleCantidad = cantidad > 0
          ? (evento?.cantidad_paquetes ? ` · Paquetes: ${cantidad}` : ` · Piezas: ${cantidad}`)
          : '';
        agregarAlerta(
          claveEventoUnica('produccion:descuento', evento),
          `${titulo}${detalleCantidad}`,
          'advertencia'
        );
        return;
      }

      if (tipo === 'inventario_actualizado') {
        const insumo = textoEntidad(evento?.nombre_insumo, evento?.insumo, evento?.nombre, evento?.codigo);
        const accion = textoEntidad(evento?.accion, evento?.operacion, 'actualizado');
        const mensaje = insumo
          ? `Inventario: se ${accion} el insumo ${insumo}`
          : 'Inventario actualizado';
        agregarAlerta(claveEventoUnica('sistema:inventario', evento), mensaje, 'advertencia');
        return;
      }

      if (tipo === 'ventas_actualizado') {
        const receta = textoEntidad(evento?.nombre_receta, evento?.receta, evento?.receta_nombre);
        const cantidad = Number(evento?.cantidad || 0);
        const mensaje = receta
          ? `Ventas: se registró movimiento en ${receta}${cantidad > 0 ? ` · Cantidad: ${cantidad}` : ''}`
          : 'Ventas actualizadas';
        agregarAlerta(
          claveEventoUnica('sistema:ventas', evento),
          mensaje,
          '',
          { destino: { page: 'trastienda', section: 'pedidos', hash: '#/trastienda/pedidos' } }
        );
        return;
      }

      if (tipo === 'produccion_actualizado') {
        const receta = textoEntidad(evento?.nombre_receta, evento?.receta, evento?.receta_nombre);
        const cantidad = Number(evento?.cantidad || 0);
        const mensaje = receta
          ? `Producción: se actualizó ${receta}${cantidad > 0 ? ` · Cantidad: ${cantidad}` : ''}`
          : 'Producción actualizada';
        agregarAlerta(claveEventoUnica('sistema:produccion', evento), mensaje, '');
        return;
      }

      if (tipo === 'cortesias_actualizado') {
        const receta = textoEntidad(evento?.nombre_receta, evento?.receta, evento?.receta_nombre);
        const cantidad = Number(evento?.cantidad || 0);
        const mensaje = receta
          ? `Cortesías: se actualizó ${receta}${cantidad > 0 ? ` · Cantidad: ${cantidad}` : ''}`
          : 'Cortesías actualizadas';
        agregarAlerta(claveEventoUnica('sistema:cortesias', evento), mensaje, '');
        return;
      }

      if (tipo === 'recetas_actualizado') {
        const receta = textoEntidad(evento?.nombre_receta, evento?.receta, evento?.receta_nombre, evento?.nombre);
        const accion = textoEntidad(evento?.accion, evento?.operacion, 'actualizada');
        const mensaje = receta
          ? `Recetas: se ${accion} ${receta}`
          : 'Recetas actualizadas';
        agregarAlerta(claveEventoUnica('sistema:recetas', evento), mensaje, '');
        return;
      }

      if (tipo === 'categorias_actualizado') {
        const categoria = textoEntidad(evento?.nombre_categoria, evento?.categoria, evento?.nombre);
        const mensaje = categoria ? `Categorías: se actualizó ${categoria}` : 'Categorías actualizadas';
        agregarAlerta(claveEventoUnica('sistema:categorias', evento), mensaje, '');
        return;
      }

      if (tipo === 'utensilios_actualizado') {
        const utensilio = textoEntidad(evento?.nombre_utensilio, evento?.utensilio, evento?.nombre);
        const mensaje = utensilio ? `Utensilios: se actualizó ${utensilio}` : 'Utensilios actualizados';
        agregarAlerta(claveEventoUnica('sistema:utensilios', evento), mensaje, '');
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
    const nativeAlert = window.alert;
    window.alert = (mensaje) => {
      mostrarNotificacion(String(mensaje ?? ''), 'advertencia');
    };
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

    return () => {
      window.alert = nativeAlert;
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
    tienda: () => (
      <Tienda
        modo="tienda"
        mostrarAccesoRapidoPwa={mostrarInstalarPwa}
        onActivarAccesoRapidoPwa={instalarAppPwa}
      />
    ),
    trastienda: () => <Tienda modo="trastienda" />,
    utensilios: Utensilios,
    'admin-usuarios': AdminUsuarios
  };
  const PageComponent = pageComponents[page] || (() => null);

  if (!isAuthenticated) {
    const onArchivoImportarTodoMenu = async (event) => {
      const input = event.target;
      const archivo = input?.files?.[0];
      if (!archivo) return;

      try {
        if (!String(archivo?.name || '').toLowerCase().endsWith('.json')) {
          throw new Error('El archivo debe ser JSON');
        }

        const contenido = await archivo.text();
        const datos = JSON.parse(contenido);
        if (!datos || (Array.isArray(datos) && !datos.length)) {
          throw new Error('El archivo está vacío');
        }

        const payloadImportacion = limpiarPayloadImportacionTodo(datos);

        setMenuContextoTrastienda({ visible: false, x: 0, y: 0 });

        await fetchAPIJSON('/api/importar/todo', {
          method: 'POST',
          body: payloadImportacion
        });
        mostrarNotificacion('✅ Respaldo TOTAL importado correctamente', 'exito');
        refrescarDatosSinRecargar();
      } catch (error) {
        mostrarNotificacion(`❌ Error al importar: ${error?.message || 'Error desconocido'}`, 'error');
      } finally {
        if (input) input.value = '';
      }
    };

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
          key="tienda-publica"
          modo="tienda"
          mostrarLogoAccesoSistema
          onClickLogoAccesoSistema={registrarToqueLogo}
          mostrarAccesoRapidoPwa={mostrarInstalarPwa}
          onActivarAccesoRapidoPwa={instalarAppPwa}
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
            <button
              type="button"
              className="menuContextoTrastiendaItem"
              onClick={() => inputImportarTodoMenuRef.current?.click()}
            >
              Importar TODO
            </button>
          </div>
        )}

        <input
          ref={inputImportarTodoMenuRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={onArchivoImportarTodoMenu}
        />

        {showAccesoSistema && (
          <div className="accesoSistemaOverlay" onClick={() => { if (!configInicial.visible) setShowAccesoSistema(false); }}>
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
                <PasswordInput
                  className="loginInput"
                  placeholder="Contraseña"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  required
                />
                {loginError && <div className="loginError">{loginError}</div>}
                <button className="loginBoton" type="submit" disabled={loginLoading}>
                  {loginLoading ? 'Ingresando...' : 'Entrar'}
                </button>
                <button type="button" className="boton" disabled={configInicial.visible} onClick={() => setShowAccesoSistema(false)}>
                  Cerrar
                </button>
              </form>

              {configInicial.visible && (
                <div className="configInicialBloque">
                  <h3 className="configInicialTitulo">Configuracion Inicial</h3>
                  <p className="configInicialTexto">
                    Usuario maestro: <strong>{configInicial.maestroUsername || 'maestro'}</strong>. Este acceso se desactiva despues de crear el CEO.
                  </p>
                  <form onSubmit={completarConfiguracionInicial} className="loginFormulario">
                    <input
                      className="loginInput"
                      type="text"
                      placeholder="Usuario CEO"
                      value={configInicial.form.ceo_username}
                      onChange={(e) => {
                        const value = e.target.value;
                        setConfigInicial((prev) => ({
                          ...prev,
                          form: { ...prev.form, ceo_username: value }
                        }));
                      }}
                      required
                    />
                    <input
                      className="loginInput"
                      type="text"
                      placeholder="Nombre CEO"
                      value={configInicial.form.ceo_nombre}
                      onChange={(e) => {
                        const value = e.target.value;
                        setConfigInicial((prev) => ({
                          ...prev,
                          form: { ...prev.form, ceo_nombre: value }
                        }));
                      }}
                      required
                    />
                    <PasswordInput
                      className="loginInput"
                      placeholder="Contrasena CEO"
                      value={configInicial.form.ceo_password}
                      onChange={(e) => {
                        const value = e.target.value;
                        setConfigInicial((prev) => ({
                          ...prev,
                          form: { ...prev.form, ceo_password: value }
                        }));
                      }}
                      minLength={8}
                      required
                    />
                    <label className="configInicialToggle">
                      <input
                        type="checkbox"
                        checked={configInicial.crearAdmin}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setConfigInicial((prev) => ({
                            ...prev,
                            crearAdmin: checked,
                            form: {
                              ...prev.form,
                              admin_username: checked ? prev.form.admin_username : '',
                              admin_nombre: checked ? prev.form.admin_nombre : 'Administrador',
                              admin_password: checked ? prev.form.admin_password : ''
                            }
                          }));
                        }}
                      />
                      Crear usuario administrador tambien (opcional)
                    </label>

                    {configInicial.crearAdmin && (
                      <>
                        <input
                          className="loginInput"
                          type="text"
                          placeholder="Usuario Administrador"
                          value={configInicial.form.admin_username}
                          onChange={(e) => {
                            const value = e.target.value;
                            setConfigInicial((prev) => ({
                              ...prev,
                              form: { ...prev.form, admin_username: value }
                            }));
                          }}
                          required
                        />
                        <input
                          className="loginInput"
                          type="text"
                          placeholder="Nombre Administrador"
                          value={configInicial.form.admin_nombre}
                          onChange={(e) => {
                            const value = e.target.value;
                            setConfigInicial((prev) => ({
                              ...prev,
                              form: { ...prev.form, admin_nombre: value }
                            }));
                          }}
                          required
                        />
                        <PasswordInput
                          className="loginInput"
                          placeholder="Contrasena Administrador"
                          value={configInicial.form.admin_password}
                          onChange={(e) => {
                            const value = e.target.value;
                            setConfigInicial((prev) => ({
                              ...prev,
                              form: { ...prev.form, admin_password: value }
                            }));
                          }}
                          minLength={8}
                          required
                        />
                      </>
                    )}
                    {configInicial.error && <div className="loginError">{configInicial.error}</div>}
                    <button className="loginBoton" type="submit" disabled={configInicial.loading}>
                      {configInicial.loading ? 'Guardando...' : (configInicial.crearAdmin ? 'Crear CEO y Administrador' : 'Crear CEO y Entrar')}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {mostrarBotonInicio && (
          <button
            type="button"
            className="botonSubirInicio"
            onClick={irAlInicio}
            title="Volver al inicio"
            aria-label="Volver al inicio"
          >
            ↑
          </button>
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
          {mostrarInstalarPwa && (
            <button
              type="button"
              className="botonInstalarAccesoRapidoMenu"
              onClick={instalarAppPwa}
              title="Guarda un acceso rápido de esta página en tu dispositivo"
            >
              Activar acceso rápido
            </button>
          )}
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

      {mostrarBotonInicio && (
        <button
          type="button"
          className="botonSubirInicio"
          onClick={irAlInicio}
          title="Volver al inicio"
          aria-label="Volver al inicio"
        >
          ↑
        </button>
      )}
    </div>
  );
}
