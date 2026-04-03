import React, { useEffect, useRef, useState } from 'react';
import './AdminUsuarios.css';
import { fetchAPIJSON } from "../../utils/api.jsx";
import { mostrarNotificacion } from "../../utils/notificaciones.jsx";
import { normalizarTextoBusqueda } from "../../utils/texto.jsx";
import { importarDatos, exportarDatos } from '../../utils/importar-exportar.jsx';
import { mostrarConfirmacion, solicitarTextoModal } from '../../utils/modales.jsx';
import PasswordInput from '../../components/PasswordInput.jsx';

const DEFINICION_PERMISOS = {
  inventario: {
    label: 'Inventario',
    acciones: [
      { key: 'ver', label: 'Ver inventario' },
      { key: 'crear', label: 'Crear insumos' },
      { key: 'aumentar', label: 'Aumentar stock' },
      { key: 'editar', label: 'Editar insumos' },
      { key: 'eliminar', label: 'Eliminar insumos' },
      { key: 'ver_estadisticas', label: 'Ver estadísticas' },
      { key: 'exportar', label: 'Exportar inventario' },
      { key: 'importar', label: 'Importar inventario' }
    ]
  },
  recetas: {
    label: 'Recetas',
    acciones: [
      { key: 'ver', label: 'Ver recetas' },
      { key: 'crear', label: 'Crear recetas' },
      { key: 'editar', label: 'Editar recetas' },
      { key: 'eliminar', label: 'Eliminar recetas' },
      { key: 'calcular', label: 'Calcular recetas' },
      { key: 'categorias_ver', label: 'Ver categorías' },
      { key: 'categorias_gestionar', label: 'Gestionar categorías' },
      { key: 'exportar', label: 'Exportar recetas' },
      { key: 'importar', label: 'Importar recetas' }
    ]
  },
  produccion: {
    label: 'Producción',
    acciones: [
      { key: 'ver', label: 'Ver producción' },
      { key: 'crear', label: 'Registrar producción' },
      { key: 'eliminar', label: 'Eliminar producción' },
      { key: 'exportar', label: 'Exportar producción' },
      { key: 'importar', label: 'Importar producción' }
    ]
  },
  ventas: {
    label: 'Ventas',
    acciones: [
      { key: 'ver', label: 'Ver ventas' },
      { key: 'crear', label: 'Registrar ventas' },
      { key: 'eliminar', label: 'Eliminar ventas' },
      { key: 'ver_estadisticas', label: 'Ver estadísticas de ventas' },
      { key: 'cortesia_ver', label: 'Ver cortesías' },
      { key: 'cortesia_crear', label: 'Crear cortesías' },
      { key: 'cortesia_eliminar', label: 'Eliminar cortesías' },
      { key: 'cortesia_limpiar', label: 'Limpiar cortesías de prueba' },
      { key: 'exportar', label: 'Exportar ventas' },
      { key: 'importar', label: 'Importar ventas' }
    ]
  },
  tienda: {
    label: 'Tienda (cliente)',
    acciones: [
      { key: 'ver', label: 'Ver tienda cliente' }
    ]
  },
  trastienda: {
    label: 'Trastienda',
    acciones: [
      { key: 'ver', label: 'Entrar a trastienda' },
      { key: 'editar', label: 'Editar datos en trastienda' },
      { key: 'pedidos', label: 'Ver pestaña Pedidos' },
      { key: 'clientes', label: 'Ver pestaña Clientes' },
      { key: 'puntos', label: 'Ver pestaña Puntos de entrega' },
      { key: 'catalogo', label: 'Ver pestaña Catálogo' },
      { key: 'descuentos', label: 'Ver pestaña Descuentos' },
      { key: 'cupones', label: 'Ver pestaña Cupones' },
      { key: 'config', label: 'Ver pestaña Configuración' },
      { key: 'metricas', label: 'Ver pestaña Métricas' }
    ]
  },
  utensilios: {
    label: 'Utensilios',
    acciones: [
      { key: 'ver', label: 'Ver utensilios' },
      { key: 'crear', label: 'Crear utensilios' },
      { key: 'editar', label: 'Editar utensilios' },
      { key: 'eliminar', label: 'Eliminar utensilios' },
      { key: 'recuperar', label: 'Registrar recuperado' },
      { key: 'ver_historial', label: 'Ver historial' },
      { key: 'ver_estadisticas', label: 'Ver estadísticas' },
      { key: 'exportar', label: 'Exportar utensilios' },
      { key: 'importar', label: 'Importar utensilios' }
    ]
  },
  admin_usuarios: {
    label: 'Admin Usuarios',
    acciones: [
      { key: 'ver', label: 'Ver usuarios' },
      { key: 'crear', label: 'Crear usuarios' },
      { key: 'editar_usuario', label: 'Editar nombre/usuario' },
      { key: 'editar_permisos', label: 'Editar permisos' },
      { key: 'eliminar', label: 'Eliminar usuarios' },
      { key: 'reset_password', label: 'Restablecer contraseña' },
      { key: 'seguridad', label: 'Operar tablero de seguridad' }
    ]
  }
};

function crearPermisosBase(accesoTotal = false) {
  const out = {};
  for (const [pestana, meta] of Object.entries(DEFINICION_PERMISOS)) {
    out[pestana] = {
      ver: accesoTotal,
      acciones: {}
    };
    for (const accion of meta.acciones) {
      out[pestana].acciones[accion.key] = accesoTotal;
    }
  }

  if (!accesoTotal) {
    out.inventario.ver = true;
    out.inventario.acciones.ver = true;
  }

  return out;
}

function normalizarPermisos(permisos, rol = 'usuario') {
  const base = crearPermisosBase(rol === 'ceo' || rol === 'admin');
  if (rol === 'ceo' || rol === 'admin') return base;

  if (!permisos || typeof permisos !== 'object') return base;

  for (const [pestana, meta] of Object.entries(DEFINICION_PERMISOS)) {
    const valor = permisos[pestana];

    if (typeof valor === 'boolean') {
      base[pestana].ver = valor;
      for (const accion of meta.acciones) {
        base[pestana].acciones[accion.key] = valor;
      }
      continue;
    }

    if (valor && typeof valor === 'object') {
      base[pestana].ver = Boolean(valor.ver);
      for (const accion of meta.acciones) {
        if (typeof valor?.acciones?.[accion.key] !== 'undefined') {
          base[pestana].acciones[accion.key] = Boolean(valor.acciones[accion.key]);
        }
      }
    }
  }

  return base;
}

function renderTextoResaltado(texto, filtro) {
  const q = (filtro || '').trim();
  if (!q) return texto;

  const original = String(texto || '');
  const lower = original.toLowerCase();
  const needle = q.toLowerCase();
  if (!lower.includes(needle)) return original;

  const partes = [];
  let inicio = 0;
  let idx = lower.indexOf(needle, inicio);
  let key = 0;

  while (idx !== -1) {
    if (idx > inicio) {
      partes.push(<React.Fragment key={`txt-${key++}`}>{original.slice(inicio, idx)}</React.Fragment>);
    }
    partes.push(
      <mark className="resaltadoBusquedaPermisos" key={`mark-${key++}`}>
        {original.slice(idx, idx + needle.length)}
      </mark>
    );
    inicio = idx + needle.length;
    idx = lower.indexOf(needle, inicio);
  }

  if (inicio < original.length) {
    partes.push(<React.Fragment key={`txt-${key++}`}>{original.slice(inicio)}</React.Fragment>);
  }

  return partes;
}

async function confirmarAccionCriticaAdminUsuarios({ titulo = 'Confirmar acción', mensaje = '', frase = '' } = {}) {
  const confirmado = await mostrarConfirmacion(mensaje || 'Confirma esta acción para continuar.', titulo);
  if (!confirmado) return false;
  if (!frase) return true;

  const entrada = await solicitarTextoModal({
    titulo,
    mensaje,
    descripcion: `Escribe exactamente ${frase} para continuar.`,
    etiqueta: 'Frase de confirmación',
    placeholder: frase,
    aceptarLabel: 'Continuar'
  });
  if (entrada === null) return false;
  if (String(entrada || '').trim().toUpperCase() !== String(frase || '').trim().toUpperCase()) {
    mostrarNotificacion('Acción cancelada: la frase de confirmación no coincide.', 'advertencia');
    return false;
  }

  return true;
}

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ username: '', nombre: '', correo: '', rol: 'usuario' });
  const [modalEditar, setModalEditar] = useState(null);
  const [tabModal, setTabModal] = useState('general');
  const [expandirPermisos, setExpandirPermisos] = useState({});
  const [filtroPermisos, setFiltroPermisos] = useState('');
  const buscadorPermisosRef = useRef(null);
  const token = localStorage.getItem('token');
  const adminActual = JSON.parse(localStorage.getItem('usuario') || 'null');

  useEffect(() => { cargarUsuarios(); }, []);

  async function cargarUsuarios() {
    try {
      const data = await fetchAPIJSON('/api/privado/usuarios', { headers: { Authorization: 'Bearer ' + token } });
      if (data.exito) {
        const lista = (data.usuarios || []).map((u) => ({
          ...u,
          permisos: normalizarPermisos(u.permisos, u.rol)
        }));
        setUsuarios(lista);
      }
    } catch (err) {
      console.error(err);
      mostrarNotificacion('Error cargando usuarios', 'error');
    }
  }

  function abrirModalModificar(usuario) {
    setTabModal('general');
    setExpandirPermisos({});
    setFiltroPermisos('');
    setModalEditar({
      originalUsername: usuario.username,
      username: usuario.username,
      nombre: usuario.nombre || '',
      correo: usuario.correo || '',
      rol: usuario.rol,
      permisos: normalizarPermisos(usuario.permisos, usuario.rol),
      passwordTemporal: ''
    });
  }

  function cerrarModalModificar() {
    setModalEditar(null);
    setExpandirPermisos({});
    setFiltroPermisos('');
  }

  function actualizarCampoModal(campo, valor) {
    setModalEditar((prev) => ({ ...prev, [campo]: valor }));
  }

  function cambiarPermisoPestana(pestana, activo) {
    setModalEditar((prev) => ({
      ...prev,
      permisos: {
        ...prev.permisos,
        [pestana]: {
          ...prev.permisos[pestana],
          ver: activo
        }
      }
    }));
  }

  function cambiarPermisoAccion(pestana, accion, activo) {
    setModalEditar((prev) => ({
      ...prev,
      permisos: {
        ...prev.permisos,
        [pestana]: {
          ...prev.permisos[pestana],
          acciones: {
            ...prev.permisos[pestana].acciones,
            [accion]: activo
          }
        }
      }
    }));
  }

  function toggleExpandir(pestana) {
    setExpandirPermisos((prev) => ({ ...prev, [pestana]: !prev[pestana] }));
  }

  function coincideFiltroPermisos(meta, filtro) {
      const q = normalizarTextoBusqueda(filtro);
    if (!q) return true;
      if (normalizarTextoBusqueda(meta.label).includes(q)) return true;
    return meta.acciones.some((accion) => (
        normalizarTextoBusqueda(accion.label).includes(q) || normalizarTextoBusqueda(accion.key).includes(q)
    ));
  }

  async function guardarDatosUsuario() {
    if (!modalEditar) return;
    try {
      const res = await fetchAPIJSON(`/api/privado/usuarios/${encodeURIComponent(modalEditar.originalUsername)}`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token },
        body: {
          username: modalEditar.username,
          nombre: modalEditar.nombre,
          correo: modalEditar.correo
        }
      });

      if (res.exito) {
        mostrarNotificacion('Datos del usuario actualizados', 'exito');
        setModalEditar((prev) => ({ ...prev, originalUsername: prev.username }));
        cargarUsuarios();
      }
    } catch (err) {
      mostrarNotificacion(err.message || 'No se pudo actualizar el usuario', 'error');
    }
  }

  async function guardarPermisosUsuario() {
    if (!modalEditar) return;
    try {
      const res = await fetchAPIJSON(`/api/privado/usuarios/${encodeURIComponent(modalEditar.originalUsername)}/permisos`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token },
        body: { permisos: modalEditar.permisos }
      });

      if (res.exito) {
        mostrarNotificacion('Permisos actualizados', 'exito');
        cargarUsuarios();
      }
    } catch (err) {
      mostrarNotificacion(err.message || 'No se pudieron actualizar permisos', 'error');
    }
  }

  async function restablecerPasswordUsuario() {
    if (!modalEditar) return;
    const esOtroAdmin = String(modalEditar?.rol || '').toLowerCase() === 'admin';
    const confirmado = await confirmarAccionCriticaAdminUsuarios({
      titulo: 'Restablecer contraseña',
      mensaje: `Vas a establecer una contraseña temporal para ${String(modalEditar?.originalUsername || '').trim()}. Todas sus sesiones activas quedarán invalidadas.`,
      frase: esOtroAdmin ? 'RESETEAR ADMIN' : 'RESETEAR PASSWORD'
    });
    if (!confirmado) return;

    try {
      const res = await fetchAPIJSON('/api/privado/usuarios/reset-password', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: {
          username: modalEditar.originalUsername,
          passwordTemporal: modalEditar.passwordTemporal
        }
      });

      if (res.exito) {
        const passwordTemporalAplicada = String(res.passwordTemporal || modalEditar.passwordTemporal || '').trim() || 'N/D';
        mostrarNotificacion('Contraseña temporal aplicada. Al iniciar sesión deberá cambiarla.', 'exito', {
          titulo: 'Contraseña restablecida',
          detalle: `Usuario: ${modalEditar.originalUsername}`,
          copyText: passwordTemporalAplicada,
          copyLabel: 'Copiar contraseña'
        });
        setModalEditar((prev) => ({ ...prev, passwordTemporal: '' }));
      }
    } catch (err) {
      mostrarNotificacion(err.message || 'No se pudo restablecer contraseña', 'error');
    }
  }

  async function revocarSesionesUsuario(usuarioObjetivo = modalEditar ? { username: modalEditar.originalUsername, rol: modalEditar.rol } : null) {
    const objetivo = typeof usuarioObjetivo === 'string'
      ? { username: usuarioObjetivo, rol: usuarios.find((item) => item.username === usuarioObjetivo)?.rol || '' }
      : (usuarioObjetivo || {});
    const usernameObjetivo = String(objetivo?.username || '').trim();
    if (!usernameObjetivo) return;

    const esSesionActual = usernameObjetivo.toLowerCase() === String(adminActual?.username || '').toLowerCase();
    const esOtroAdmin = !esSesionActual && String(objetivo?.rol || '').toLowerCase() === 'admin';

    if (esOtroAdmin) {
      const confirmado = await confirmarAccionCriticaAdminUsuarios({
        titulo: 'Revocar sesiones de otro admin',
        mensaje: `Vas a revocar todas las sesiones activas del administrador ${usernameObjetivo}. Tendrá que iniciar sesión nuevamente en todos sus dispositivos.`,
        frase: 'REVOCAR ADMIN'
      });
      if (!confirmado) return;
    }

    try {
      const res = await fetchAPIJSON('/api/privado/usuarios/revocar-sesiones', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: { username: usernameObjetivo }
      });

      if (res.exito) {
        mostrarNotificacion('Sesiones revocadas. Los tokens emitidos antes de este momento dejaron de ser válidos.', 'exito');
        await cargarUsuarios();
        if (esSesionActual) {
          localStorage.removeItem('token');
          localStorage.removeItem('usuario');
          window.location.reload();
        }
      }
    } catch (err) {
      mostrarNotificacion(err.message || 'No se pudieron revocar las sesiones', 'error');
    }
  }

  async function submit(e) {
    e.preventDefault();
    try {
      const res = await fetchAPIJSON('/api/privado/usuarios', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: {
          username: form.username,
          nombre: form.nombre,
          correo: form.correo,
          rol: form.rol,
          permisos: normalizarPermisos(null, form.rol)
        }
      });
      if (res.exito) {
        mostrarNotificacion('Usuario creado correctamente.', 'exito', {
          titulo: 'Usuario creado',
          detalle: `Usuario: ${res.username || form.username}`,
          copyText: String(res.passwordTemporal || 'N/D'),
          copyLabel: 'Copiar contraseña'
        });
        setForm({ username: '', nombre: '', correo: '', rol: 'usuario' });
        cargarUsuarios();
      }
    } catch (err) {
      console.error(err);
      mostrarNotificacion('Error creando usuario', 'error');
    }
  }

  async function resetearUsuario(username) {
    const objetivo = usuarios.find((item) => item.username === username);
    const esOtroAdmin = String(objetivo?.rol || '').toLowerCase() === 'admin';
    const confirmado = await confirmarAccionCriticaAdminUsuarios({
      titulo: 'Restablecer contraseña',
      mensaje: `Vas a generar una contraseña temporal para ${String(username || '').trim()}. La sesión actual de ese usuario dejará de ser válida.`,
      frase: esOtroAdmin ? 'RESETEAR ADMIN' : 'RESETEAR PASSWORD'
    });
    if (!confirmado) return;

    try {
      const res = await fetchAPIJSON('/api/privado/usuarios/reset-password', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: { username }
      });
      if (res.exito) {
        mostrarNotificacion('Se generó una contraseña temporal para el usuario.', 'exito', {
          titulo: 'Contraseña temporal generada',
          detalle: `Usuario: ${username}`,
          copyText: String(res.passwordTemporal || 'N/D'),
          copyLabel: 'Copiar contraseña'
        });
      } else {
        mostrarNotificacion(res.mensaje || 'No se pudo resetear', 'error');
      }
    } catch (err) {
      console.error(err);
      mostrarNotificacion('Error al resetear contraseña', 'error');
    }
  }

  async function eliminarUsuario(username) {
    const objetivo = usuarios.find((item) => item.username === username);
    const esOtroAdmin = String(objetivo?.rol || '').toLowerCase() === 'admin';
    const confirmado = await confirmarAccionCriticaAdminUsuarios({
      titulo: 'Eliminar usuario',
      mensaje: `Vas a eliminar al usuario ${String(username || '').trim()}. Esta acción borra su acceso administrativo y no se puede deshacer.`,
      frase: esOtroAdmin ? 'ELIMINAR ADMIN' : 'ELIMINAR USUARIO'
    });
    if (!confirmado) return;

    try {
      const res = await fetchAPIJSON(`/api/privado/usuarios/${username}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token }
      });
      if (res.exito) {
        mostrarNotificacion('Usuario eliminado', 'exito');
        cargarUsuarios();
      } else {
        mostrarNotificacion(res.mensaje || 'No se pudo eliminar', 'error');
      }
    } catch (err) {
      console.error(err);
      mostrarNotificacion('Error al eliminar usuario', 'error');
    }
  }

  useEffect(() => {
    if (!modalEditar) return;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cerrarModalModificar();
        return;
      }

      const isFindShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f';
      if (!isFindShortcut) return;
      if (tabModal !== 'permisos') return;

      event.preventDefault();
      buscadorPermisosRef.current?.focus();
      buscadorPermisosRef.current?.select?.();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalEditar, tabModal]);

  return (
    <div className="contenidoAdmin adminUsuariosCard">
      <h2>Administración de Usuarios</h2>
      <div className="adminActualInfo">Administrador: {adminActual?.nombre || adminActual?.username || 'N/D'}</div>
      <div className="respaldoTotalAdminUsuarios">
        <span className="respaldoTotalLeyenda">Respaldo total (incluye trastienda/configuración tienda y archivos multimedia)</span>
        <div className="respaldoTotalAcciones">
          <button className="botonImportar" onClick={() => document.getElementById('importarTodoAdminUsuarios')?.click()}>Importar TODO</button>
          <input
            type="file"
            id="importarTodoAdminUsuarios"
            className="inputArchivoOculto"
            accept=".json"
            onChange={(e) => importarDatos('todo', e.target)}
          />
          <button className="botonExportar" onClick={() => exportarDatos('todo')}>Exportar TODO</button>
        </div>
      </div>
      <form onSubmit={submit} style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:18 }}>
        <input placeholder="Usuario" required value={form.username} onChange={e=>setForm({...form,username:e.target.value})} style={{flex:'1 1 120px'}} />
        <input placeholder="Nombre" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} style={{flex:'2 1 180px'}} />
        <input placeholder="Correo" type="email" value={form.correo} onChange={e=>setForm({...form,correo:e.target.value})} style={{flex:'2 1 220px'}} />
        <select value={form.rol} onChange={e=>setForm({...form,rol:e.target.value})} style={{flex:'1 1 100px'}}>
          <option value="usuario">Usuario</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="boton">Agregar</button>
      </form>
      <div>
        <table className="tablaUsuariosAdmin" style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr><th>Usuario</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Acciones</th></tr></thead>
          <tbody>
            {usuarios.map(u=>(
              <tr key={u.username}>
                <td>{u.username}</td>
                <td>{u.nombre}</td>
                <td>{u.correo || '—'}</td>
                <td>{u.rol}</td>
                <td>
                  <button className="botonPequeno" onClick={() => abrirModalModificar(u)}>Modificar</button>
                  {u.rol !== 'ceo' && (
                    <>
                      <button className="botonPequeno botonWarning" onClick={() => revocarSesionesUsuario(u)}>Revocar sesiones</button>
                      <button className="botonPequeno" onClick={() => resetearUsuario(u.username)}>Reset</button>
                      <button className="botonPequeno botonDanger" onClick={() => eliminarUsuario(u.username)}>Eliminar</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalEditar && (
        <div className="modalAdminUsuarios" onClick={cerrarModalModificar}>
          <div className="contenidoModalAdminUsuarios" onClick={(e) => e.stopPropagation()}>
            <div className="encabezadoModalAdminUsuarios">
              <h3>Modificar usuario: {modalEditar.originalUsername}</h3>
              <button className="cerrarModal" onClick={cerrarModalModificar}>&times;</button>
            </div>

            <div className="tabsModalAdminUsuarios">
              <button className={tabModal === 'general' ? 'tabActiva' : ''} onClick={() => setTabModal('general')}>General</button>
              <button className={tabModal === 'permisos' ? 'tabActiva' : ''} onClick={() => setTabModal('permisos')}>Permisos</button>
              <button className={tabModal === 'password' ? 'tabActiva' : ''} onClick={() => setTabModal('password')}>Restablecer contraseña</button>
            </div>

            {tabModal === 'general' && (
              <div className="tabPanelAdminUsuarios">
                <label htmlFor="adminUsuarioUsername">Nombre de usuario</label>
                <input
                  id="adminUsuarioUsername"
                  value={modalEditar.username}
                  onChange={(e) => actualizarCampoModal('username', e.target.value)}
                  disabled={modalEditar.rol === 'ceo'}
                />
                <label htmlFor="adminUsuarioNombre">Nombre</label>
                <input
                  id="adminUsuarioNombre"
                  value={modalEditar.nombre}
                  onChange={(e) => actualizarCampoModal('nombre', e.target.value)}
                  disabled={modalEditar.rol === 'ceo'}
                />
                <label htmlFor="adminUsuarioCorreo">Correo de recuperación</label>
                <input
                  id="adminUsuarioCorreo"
                  type="email"
                  value={modalEditar.correo}
                  onChange={(e) => actualizarCampoModal('correo', e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
                <label htmlFor="adminUsuarioRol">Rol</label>
                <input id="adminUsuarioRol" value={modalEditar.rol} disabled />
                <button className="boton" onClick={guardarDatosUsuario}>Guardar datos</button>
              </div>
            )}

            {tabModal === 'permisos' && (
              <div className="tabPanelAdminUsuarios">
                <input
                  className="buscadorPermisosInput"
                  type="text"
                  placeholder="Buscar permiso o acción..."
                  value={filtroPermisos}
                  ref={buscadorPermisosRef}
                  onChange={(e) => setFiltroPermisos(e.target.value)}
                />
                {Object.entries(DEFINICION_PERMISOS).map(([pestana, meta]) => (
                  <div key={pestana} className="cardPermisoPestana">
                    {(() => {
                      const q = normalizarTextoBusqueda(filtroPermisos);
                      const autoExpandir = Boolean(q) && coincideFiltroPermisos(meta, q);
                      const estaExpandida = autoExpandir || Boolean(expandirPermisos[pestana]);
                      return (
                        <>
                    <div
                      className="filaPestanaPermiso filaPestanaPermisoClickable"
                      onClick={() => toggleExpandir(pestana)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          toggleExpandir(pestana);
                        }
                      }}
                    >
                      <strong className="tituloPestanaPermiso">{renderTextoResaltado(meta.label, filtroPermisos)}</strong>
                      <label className="switchPermiso switchPermisoFila" onClick={(event) => event.stopPropagation()}>
                        <span className="switchEtiqueta">Acceso pestaña</span>
                        <span className="switchControl">
                          <input
                            type="checkbox"
                            checked={Boolean(modalEditar.permisos?.[pestana]?.ver)}
                            onChange={(e) => cambiarPermisoPestana(pestana, e.target.checked)}
                          />
                          <span className="switchSlider"></span>
                        </span>
                      </label>
                    </div>

                    {estaExpandida && (
                      <div className="listaAccionesPermiso">
                        {meta.acciones
                          .filter((accion) => {
                            if (!q) return true;
                            return (
                              normalizarTextoBusqueda(meta.label).includes(q) ||
                              normalizarTextoBusqueda(accion.label).includes(q) ||
                              normalizarTextoBusqueda(accion.key).includes(q)
                            );
                          })
                          .map((accion) => (
                          <label key={`${pestana}-${accion.key}`} className="switchPermiso accionPermiso">
                            <span>{renderTextoResaltado(accion.label, filtroPermisos)}</span>
                            <span className="switchControl">
                              <input
                                type="checkbox"
                                checked={Boolean(modalEditar.permisos?.[pestana]?.acciones?.[accion.key])}
                                onChange={(e) => cambiarPermisoAccion(pestana, accion.key, e.target.checked)}
                              />
                              <span className="switchSlider"></span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                        </>
                      );
                    })()}
                  </div>
                ))}
                <button className="boton" onClick={guardarPermisosUsuario}>
                  Guardar permisos
                </button>
              </div>
            )}

            {tabModal === 'password' && (
              <div className="tabPanelAdminUsuarios">
                <label htmlFor="adminUsuarioPasswordTemporal">Contraseña temporal</label>
                <PasswordInput
                  id="adminUsuarioPasswordTemporal"
                  placeholder="Escribe una contraseña temporal"
                  value={modalEditar.passwordTemporal}
                  onChange={(e) => actualizarCampoModal('passwordTemporal', e.target.value)}
                  disabled={modalEditar.rol === 'ceo'}
                />
                <div className="textoAyudaReset">
                  Al iniciar sesión con esta contraseña temporal, el usuario verá el modal para cambiar contraseña.
                </div>
                <div className="textoAyudaReset textoAyudaRevocacion">
                  Si solo quieres sacar todas sus sesiones activas sin tocar la contraseña, usa la revocación manual.
                </div>
                <button className="botonSecundario" onClick={() => revocarSesionesUsuario({ username: modalEditar.originalUsername, rol: modalEditar.rol })} disabled={modalEditar.rol === 'ceo'}>
                  Revocar sesiones activas
                </button>
                <button className="boton" onClick={restablecerPasswordUsuario} disabled={modalEditar.rol === 'ceo'}>
                  Restablecer contraseña
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
