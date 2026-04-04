import React, { useEffect, useMemo, useState } from 'react';
import './AdminSeguridad.css';
import { fetchAPIJSON } from '../../utils/api.jsx';
import { mostrarNotificacion } from '../../utils/notificaciones.jsx';
import { mostrarConfirmacion, solicitarTextoModal } from '../../utils/modales.jsx';

function normalizarTexto(valor) {
  return String(valor || '').trim().toLowerCase();
}

function formatFecha(valor) {
  if (!valor) return 'N/D';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(fecha);
}

function formatDuracion(segundos = 0) {
  const total = Math.max(0, Number(segundos) || 0);
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  if (horas > 0) return `${horas}h ${minutos}m`;
  return `${minutos}m`;
}

function formatBytes(bytes = 0) {
  const valor = Math.max(0, Number(bytes) || 0);
  if (valor < 1024) return `${valor} B`;
  if (valor < 1024 * 1024) return `${(valor / 1024).toFixed(1)} KB`;
  return `${(valor / (1024 * 1024)).toFixed(2)} MB`;
}

function badgeNivelClase(nivel = '') {
  const normalizado = String(nivel || '').toLowerCase();
  if (normalizado === 'critical') return 'critico';
  if (normalizado === 'error') return 'error';
  if (normalizado === 'warning') return 'warning';
  return 'info';
}

function esAuthInvalidoRuidoLocal(evento = {}) {
  const tipo = normalizarTexto(evento?.tipo);
  if (tipo !== 'auth_invalid_token') return false;

  const ip = String(evento?.ip || '').trim();
  const ruta = String(evento?.ruta || '').trim();
  const usuario = String(evento?.detalle?.usuario || '').trim();
  const esLocal = ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.');
  const esRutaInterna = ruta.startsWith('/tienda/admin/') || ruta.startsWith('/inventario/') || ruta.startsWith('/api/privado/security/') || ruta.startsWith('/produccion/');

  return esLocal && esRutaInterna && !usuario;
}

function obtenerUsuarioActual() {
  try {
    return JSON.parse(localStorage.getItem('usuario') || 'null');
  } catch {
    return null;
  }
}

function descargarArchivo(nombre, contenido, tipo = 'application/json;charset=utf-8') {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

function convertirEventosCSV(eventos = []) {
  const escapar = (valor) => {
    const texto = String(valor ?? '');
    if (!texto.includes('"') && !texto.includes(',') && !texto.includes('\n')) return texto;
    return `"${texto.replaceAll('"', '""')}"`;
  };

  const encabezados = ['ts', 'nivel', 'tipo', 'metodo', 'ruta', 'ip', 'detalle'];
  const filas = eventos.map((evento) => [
    evento?.ts || '',
    evento?.nivel || '',
    evento?.tipo || '',
    evento?.metodo || '',
    evento?.ruta || '',
    evento?.ip || '',
    JSON.stringify(evento?.detalle || {})
  ].map(escapar).join(','));

  return `${encabezados.join(',')}\n${filas.join('\n')}`;
}

function construirFiltroTrastienda24h() {
  return {
    filtroNivel: 'todos',
    filtroTipo: 'trastienda_',
    filtroIp: '',
    busquedaLibre: '',
    filtroVentanaLogs: '24h'
  };
}

async function confirmarAccionCriticaSeguridad({ titulo = 'Confirmar acción de seguridad', mensaje = '', frase = '' } = {}) {
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

export default function AdminSeguridad() {
  const [estado, setEstado] = useState(null);
  const [logs, setLogs] = useState([]);
  const [resumenLogs, setResumenLogs] = useState({ porTipo: {}, porNivel: {} });
  const [historialLogs, setHistorialLogs] = useState([]);
  const [auditoriaAdmin, setAuditoriaAdmin] = useState([]);
  const [bloqueosLogin, setBloqueosLogin] = useState({ resumen: {}, admin: [], tienda: [] });
  const [resumenHistorial, setResumenHistorial] = useState({ porTipo: {}, porNivel: {} });
  const [smoke, setSmoke] = useState(null);
  const [rotacionSecretos, setRotacionSecretos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [ejecutandoSmoke, setEjecutandoSmoke] = useState(false);
  const [enviandoPing, setEnviandoPing] = useState(false);
  const [generandoSecretos, setGenerandoSecretos] = useState(false);
  const [archivandoLogs, setArchivandoLogs] = useState(false);
  const [limpiandoRecientes, setLimpiandoRecientes] = useState(false);
  const [error, setError] = useState('');
  const [ultimoRefresco, setUltimoRefresco] = useState('');
  const [limiteLogs, setLimiteLogs] = useState(120);
  const [filtroNivel, setFiltroNivel] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroIp, setFiltroIp] = useState('');
  const [busquedaLibre, setBusquedaLibre] = useState('');
  const [filtroVentanaLogs, setFiltroVentanaLogs] = useState('todos');
  const [filtroAuditoria, setFiltroAuditoria] = useState('todos');
  const [paginaLogs, setPaginaLogs] = useState(1);
  const [tamanoPaginaLogs, setTamanoPaginaLogs] = useState(20);
  const [autoRefreshSegundos, setAutoRefreshSegundos] = useState(30);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  const usuario = useMemo(() => obtenerUsuarioActual(), []);
  const puedeOperarSeguridad = Boolean(
    usuario?.rol === 'ceo'
    || usuario?.rol === 'admin'
    || usuario?.permisos?.admin_usuarios?.acciones?.seguridad
  );
  const entornoLocal = normalizarTexto(estado?.entorno) === 'development';
  const webhookPendientePeroOpcional = entornoLocal && !estado?.webhook_alertas_configurado;
  const textoWebhookEstado = estado?.webhook_alertas_configurado
    ? 'activo'
    : (webhookPendientePeroOpcional ? 'opcional en local' : 'pendiente');
  const textoWebhookMinimo = estado?.webhook_alertas_configurado
    ? `desde ${estado?.webhook_min_level || 'N/D'}`
    : (webhookPendientePeroOpcional ? 'N/A en local' : `desde ${estado?.webhook_min_level || 'N/D'}`);

  async function cargarPanel(limit = limiteLogs, silencioso = false) {
    if (!silencioso) setCargando(true);
    setError('');
    try {
      const [estadoResp, logsResp, auditoriaResp, bloqueosResp] = await Promise.all([
        fetchAPIJSON('/api/privado/security/estado'),
        fetchAPIJSON(`/api/privado/security/logs?limit=${encodeURIComponent(limit)}`),
        fetchAPIJSON(`/api/privado/security/auditoria-admin?limit=${encodeURIComponent(Math.min(80, limit))}`),
        fetchAPIJSON(`/api/privado/security/bloqueos?limit=${encodeURIComponent(Math.min(80, limit))}`)
      ]);
      setEstado(estadoResp);
      setLogs(Array.isArray(logsResp.eventos) ? logsResp.eventos : []);
      setResumenLogs(logsResp.resumen || { porTipo: {}, porNivel: {} });
      setAuditoriaAdmin(Array.isArray(auditoriaResp.eventos) ? auditoriaResp.eventos : []);
      setBloqueosLogin({
        resumen: bloqueosResp?.resumen || {},
        admin: Array.isArray(bloqueosResp?.admin) ? bloqueosResp.admin : [],
        tienda: Array.isArray(bloqueosResp?.tienda) ? bloqueosResp.tienda : []
      });
      setUltimoRefresco(new Date().toISOString());
    } catch (err) {
      setError(err.message || 'No se pudo cargar el panel de seguridad');
    } finally {
      if (!silencioso) setCargando(false);
    }
  }

  async function cargarHistorial(limit = limiteLogs) {
    try {
      setCargandoHistorial(true);
      const respuesta = await fetchAPIJSON(`/api/privado/security/logs/historial?limit=${encodeURIComponent(limit)}`);
      setHistorialLogs(Array.isArray(respuesta.eventos) ? respuesta.eventos : []);
      setResumenHistorial(respuesta.resumen || { porTipo: {}, porNivel: {} });
    } catch (err) {
      mostrarNotificacion(err.message || 'No se pudo cargar el historial archivado', 'error');
    } finally {
      setCargandoHistorial(false);
    }
  }

  function obtenerFiltrosActuales() {
    return {
      filtroNivel,
      filtroTipo,
      filtroIp,
      busquedaLibre,
      filtroVentanaLogs
    };
  }

  function aplicarFiltroRapidoLogs(modo = 'todos') {
    if (modo === 'trastienda24h') {
      setFiltroNivel('todos');
      setFiltroTipo('trastienda_');
      setFiltroIp('');
      setBusquedaLibre('');
      setFiltroVentanaLogs('24h');
      setPaginaLogs(1);
      return;
    }
    if (modo === 'critical') {
      setFiltroNivel('critical');
      setFiltroTipo('');
      setFiltroIp('');
      setBusquedaLibre('');
      setFiltroVentanaLogs('todos');
      setPaginaLogs(1);
      return;
    }
    if (modo === 'trastiendaCritical24h') {
      setFiltroNivel('warning');
      setFiltroTipo('trastienda_');
      setFiltroIp('');
      setBusquedaLibre('');
      setFiltroVentanaLogs('24h');
      setPaginaLogs(1);
      return;
    }
    setFiltroNivel('todos');
    setFiltroTipo('');
    setFiltroIp('');
    setBusquedaLibre('');
    setFiltroVentanaLogs('todos');
    setPaginaLogs(1);
  }

  async function ejecutarSmoke() {
    try {
      setEjecutandoSmoke(true);
      const respuesta = await fetchAPIJSON('/api/privado/security/smoke', { method: 'POST' });
      setSmoke(respuesta.resultado || null);
      mostrarNotificacion('Pruebas de seguridad ejecutadas', 'exito');
      await cargarPanel(limiteLogs, true);
    } catch (err) {
      mostrarNotificacion(err.message || 'No se pudieron ejecutar las pruebas', 'error');
    } finally {
      setEjecutandoSmoke(false);
    }
  }

  async function probarAlerta() {
    try {
      setEnviandoPing(true);
      const respuesta = await fetchAPIJSON('/api/privado/security/ping-alerta', { method: 'POST' });
      mostrarNotificacion(respuesta.mensaje || 'Alerta de prueba enviada', 'exito');
      await cargarPanel(limiteLogs, true);
    } catch (err) {
      mostrarNotificacion(err.message || 'No se pudo enviar la alerta de prueba', 'error');
    } finally {
      setEnviandoPing(false);
    }
  }

  async function generarRotacionSecretos() {
    try {
      setGenerandoSecretos(true);
      const respuesta = await fetchAPIJSON('/api/privado/security/rotacion-secretos', { method: 'POST' });
      setRotacionSecretos(respuesta.propuesta || null);
      mostrarNotificacion('Propuesta de rotación generada', 'exito');
      await cargarPanel(limiteLogs, true);
    } catch (err) {
      mostrarNotificacion(err.message || 'No se pudo generar la propuesta de rotación', 'error');
    } finally {
      setGenerandoSecretos(false);
    }
  }

  async function archivarLogsFiltrados() {
    if (!logsFiltrados.length) {
      mostrarNotificacion('No hay eventos filtrados para archivar.', 'advertencia');
      return;
    }

    const confirmar = await confirmarAccionCriticaSeguridad({
      titulo: 'Archivar logs filtrados',
      mensaje: `Vas a mover ${logsFiltrados.length} evento(s) filtrados del log activo al historial archivado.`,
      frase: 'ARCHIVAR LOGS'
    });
    if (!confirmar) return;

    try {
      setArchivandoLogs(true);
      const respuesta = await fetchAPIJSON('/api/privado/security/logs/archivar', {
        method: 'POST',
        body: { filtros: obtenerFiltrosActuales() }
      });
      mostrarNotificacion(respuesta.mensaje || 'Eventos enviados a historial', 'exito');
      await Promise.all([cargarPanel(limiteLogs, true), cargarHistorial(limiteLogs)]);
      setMostrarHistorial(true);
    } catch (err) {
      mostrarNotificacion(err.message || 'No se pudieron archivar los eventos filtrados', 'error');
    } finally {
      setArchivandoLogs(false);
    }
  }

  async function limpiarRecientesFiltrados() {
    const confirmar = await confirmarAccionCriticaSeguridad({
      titulo: 'Limpiar eventos recientes filtrados',
      mensaje: `Vas a limpiar de memoria ${logsFiltrados.length} evento(s) filtrados del bloque reciente. El archivo principal no se borra, pero la vista operativa sí cambia.`,
      frase: 'LIMPIAR LOGS'
    });
    if (!confirmar) return;

    try {
      setLimpiandoRecientes(true);
      const respuesta = await fetchAPIJSON('/api/privado/security/logs/limpiar-recientes', {
        method: 'POST',
        body: { filtros: obtenerFiltrosActuales() }
      });
      mostrarNotificacion(respuesta.mensaje || 'Eventos recientes limpiados', 'exito');
      await cargarPanel(limiteLogs, true);
    } catch (err) {
      mostrarNotificacion(err.message || 'No se pudieron limpiar los eventos recientes', 'error');
    } finally {
      setLimpiandoRecientes(false);
    }
  }

  async function archivarTrastienda24hDirecto() {
    const confirmar = await confirmarAccionCriticaSeguridad({
      titulo: 'Archivar Trastienda 24 h',
      mensaje: 'Se archivarán los eventos recientes de Trastienda de las últimas 24 horas usando el filtro operativo preconfigurado.',
      frase: 'ARCHIVAR TRASTIENDA'
    });
    if (!confirmar) return;

    try {
      setArchivandoLogs(true);
      const respuesta = await fetchAPIJSON('/api/privado/security/logs/archivar', {
        method: 'POST',
        body: { filtros: construirFiltroTrastienda24h() }
      });
      mostrarNotificacion(respuesta.mensaje || 'Eventos de Trastienda archivados', 'exito');
      aplicarFiltroRapidoLogs('trastienda24h');
      await Promise.all([cargarPanel(limiteLogs, true), cargarHistorial(limiteLogs)]);
      setMostrarHistorial(true);
    } catch (err) {
      mostrarNotificacion(err.message || 'No se pudieron archivar los eventos de Trastienda', 'error');
    } finally {
      setArchivandoLogs(false);
    }
  }

  async function limpiarTrastienda24hDirecto() {
    const confirmar = await confirmarAccionCriticaSeguridad({
      titulo: 'Limpiar Trastienda 24 h',
      mensaje: 'Se limpiarán de memoria los eventos recientes de Trastienda de las últimas 24 horas usando el filtro operativo preconfigurado.',
      frase: 'LIMPIAR TRASTIENDA'
    });
    if (!confirmar) return;

    try {
      setLimpiandoRecientes(true);
      const respuesta = await fetchAPIJSON('/api/privado/security/logs/limpiar-recientes', {
        method: 'POST',
        body: { filtros: construirFiltroTrastienda24h() }
      });
      mostrarNotificacion(respuesta.mensaje || 'Eventos recientes de Trastienda limpiados', 'exito');
      aplicarFiltroRapidoLogs('trastienda24h');
      await cargarPanel(limiteLogs, true);
    } catch (err) {
      mostrarNotificacion(err.message || 'No se pudieron limpiar los eventos de Trastienda', 'error');
    } finally {
      setLimpiandoRecientes(false);
    }
  }

  useEffect(() => {
    cargarPanel(limiteLogs);
  }, [limiteLogs]);

  useEffect(() => {
    if (Number(autoRefreshSegundos) <= 0) return undefined;
    const id = window.setInterval(() => {
      cargarPanel(limiteLogs, true);
    }, Number(autoRefreshSegundos) * 1000);
    return () => window.clearInterval(id);
  }, [limiteLogs, autoRefreshSegundos]);

  const resumenTipos = Object.entries(estado?.resumen_recientes?.porTipo || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const resumenNiveles = Object.entries(estado?.resumen_recientes?.porNivel || {}).sort((a, b) => b[1] - a[1]);
  const resumenNivelesLog = Object.entries(resumenLogs?.porNivel || {}).sort((a, b) => b[1] - a[1]);
  const resumenTiposLog = Object.entries(resumenLogs?.porTipo || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const logsFiltrados = useMemo(() => {
    const nivel = normalizarTexto(filtroNivel);
    const tipo = normalizarTexto(filtroTipo);
    const ip = normalizarTexto(filtroIp);
    const libre = normalizarTexto(busquedaLibre);
    const ahora = Date.now();
    const ventana = normalizarTexto(filtroVentanaLogs);
    return logs.filter((evento) => {
      const coincideNivel = nivel === 'todos' || normalizarTexto(evento?.nivel) === nivel;
      const coincideTipo = !tipo || normalizarTexto(evento?.tipo).includes(tipo);
      const coincideIp = !ip || normalizarTexto(evento?.ip).includes(ip);
      const textoDetalle = normalizarTexto(JSON.stringify(evento?.detalle || {}));
      const ts = new Date(evento?.ts || 0).getTime();
      const coincideVentana = ventana !== '24h' || (Number.isFinite(ts) && ts > 0 && (ahora - ts) <= (24 * 60 * 60 * 1000));
      const coincideLibre = !libre
        || normalizarTexto(evento?.ruta).includes(libre)
        || normalizarTexto(evento?.tipo).includes(libre)
        || normalizarTexto(evento?.ip).includes(libre)
        || normalizarTexto(evento?.metodo).includes(libre)
        || textoDetalle.includes(libre)
        || normalizarTexto(evento?.detalle?.usuario).includes(libre);
      return coincideNivel && coincideTipo && coincideIp && coincideVentana && coincideLibre;
    });
  }, [logs, filtroNivel, filtroTipo, filtroIp, busquedaLibre, filtroVentanaLogs]);

  const totalPaginasLogs = Math.max(1, Math.ceil(logsFiltrados.length / Math.max(1, tamanoPaginaLogs)));

  const authInvalidTokenEventos = useMemo(
    () => logs.filter((evento) => normalizarTexto(evento?.tipo) === 'auth_invalid_token' && !esAuthInvalidoRuidoLocal(evento)),
    [logs]
  );
  const resumenAuthInvalidToken = useMemo(() => {
    const porRuta = {};
    for (const evento of authInvalidTokenEventos) {
      const ruta = String(evento?.ruta || 'ruta_desconocida').trim() || 'ruta_desconocida';
      porRuta[ruta] = (porRuta[ruta] || 0) + 1;
    }
    return Object.entries(porRuta).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [authInvalidTokenEventos]);

  const logsPaginados = useMemo(() => {
    const paginaSegura = Math.min(Math.max(1, paginaLogs), totalPaginasLogs);
    const inicio = (paginaSegura - 1) * Math.max(1, tamanoPaginaLogs);
    return logsFiltrados.slice().reverse().slice(inicio, inicio + Math.max(1, tamanoPaginaLogs));
  }, [logsFiltrados, paginaLogs, tamanoPaginaLogs, totalPaginasLogs]);

  const totalBloqueosActivos = Number(bloqueosLogin?.resumen?.total_bloqueados || 0);
  const revocacionesRecientes = useMemo(
    () => auditoriaAdmin.filter((evento) => normalizarTexto(evento?.accion).includes('revoc')).slice(0, 6),
    [auditoriaAdmin]
  );
  const auditoriaTrastienda = useMemo(
    () => auditoriaAdmin.filter((evento) => normalizarTexto(evento?.accion).startsWith('trastienda_')).slice(0, 8),
    [auditoriaAdmin]
  );
  const auditoriaAdminFiltrada = useMemo(() => {
    const filtro = normalizarTexto(filtroAuditoria);
    if (!filtro || filtro === 'todos') return auditoriaAdmin;
    if (filtro === 'trastienda') return auditoriaAdmin.filter((evento) => normalizarTexto(evento?.accion).startsWith('trastienda_'));
    if (filtro === 'usuarios') return auditoriaAdmin.filter((evento) => normalizarTexto(evento?.accion).startsWith('usuario_'));
    if (filtro === 'backup') return auditoriaAdmin.filter((evento) => normalizarTexto(evento?.accion).startsWith('backup_') || normalizarTexto(evento?.accion).includes('importacion_') || normalizarTexto(evento?.accion).includes('exportacion_'));
    if (filtro === 'seguridad') return auditoriaAdmin.filter((evento) => normalizarTexto(evento?.accion).startsWith('seguridad_'));
    return auditoriaAdmin;
  }, [auditoriaAdmin, filtroAuditoria]);
  const bloqueosDestacados = useMemo(() => {
    const admin = (bloqueosLogin?.admin || []).map((item) => ({ ...item, origen: 'admin' }));
    const tienda = (bloqueosLogin?.tienda || []).map((item) => ({ ...item, origen: 'tienda' }));
    return [...admin, ...tienda]
      .filter((item) => item.blocked)
      .sort((a, b) => Number(b.retryAfterSec || 0) - Number(a.retryAfterSec || 0))
      .slice(0, 8);
  }, [bloqueosLogin]);
  const bloqueosUltimos15Min = useMemo(() => {
    const ahora = Date.now();
    const ventanaMs = 15 * 60 * 1000;
    return [...(bloqueosLogin?.admin || []), ...(bloqueosLogin?.tienda || [])]
      .filter((item) => {
        const ts = new Date(item?.lastAt || 0).getTime();
        return Number.isFinite(ts) && ts > 0 && (ahora - ts) <= ventanaMs;
      })
      .length;
  }, [bloqueosLogin]);
  const revocacionesHoy = useMemo(() => {
    const hoy = new Date();
    return auditoriaAdmin.filter((evento) => {
      if (!normalizarTexto(evento?.accion).includes('revoc')) return false;
      const fecha = new Date(evento?.fecha || 0);
      return !Number.isNaN(fecha.getTime())
        && fecha.getFullYear() === hoy.getFullYear()
        && fecha.getMonth() === hoy.getMonth()
        && fecha.getDate() === hoy.getDate();
    }).length;
  }, [auditoriaAdmin]);
  const cambiosTrastiendaHoy = useMemo(() => {
    const hoy = new Date();
    return auditoriaAdmin.filter((evento) => {
      if (!normalizarTexto(evento?.accion).startsWith('trastienda_')) return false;
      const fecha = new Date(evento?.fecha || 0);
      return !Number.isNaN(fecha.getTime())
        && fecha.getFullYear() === hoy.getFullYear()
        && fecha.getMonth() === hoy.getMonth()
        && fecha.getDate() === hoy.getDate();
    }).length;
  }, [auditoriaAdmin]);
  const eventosCriticosTrastienda24h = useMemo(() => {
    const ahora = Date.now();
    const ventanaMs = 24 * 60 * 60 * 1000;
    return logs.filter((evento) => {
      if (!normalizarTexto(evento?.tipo).startsWith('trastienda_')) return false;
      const ts = new Date(evento?.ts || 0).getTime();
      return Number.isFinite(ts) && ts > 0 && (ahora - ts) <= ventanaMs;
    }).length;
  }, [logs]);
  const topEventosCriticosTrastienda24h = useMemo(() => {
    const ahora = Date.now();
    const ventanaMs = 24 * 60 * 60 * 1000;
    const porTipo = {};
    for (const evento of logs) {
      const tipo = normalizarTexto(evento?.tipo);
      if (!tipo.startsWith('trastienda_')) continue;
      const ts = new Date(evento?.ts || 0).getTime();
      if (!Number.isFinite(ts) || ts <= 0 || (ahora - ts) > ventanaMs) continue;
      porTipo[tipo] = (porTipo[tipo] || 0) + 1;
    }
    return Object.entries(porTipo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [logs]);

  const riesgosDetectados = useMemo(() => {
    const riesgos = [];
    if (!estado?.webhook_alertas_configurado && !entornoLocal) {
      riesgos.push({ nivel: 'warning', titulo: 'Webhook de alertas pendiente', detalle: 'No hay notificaciones externas para eventos críticos.' });
    }
    const archivosFaltantes = (estado?.archivos_criticos || []).filter((item) => !item.existe);
    if (archivosFaltantes.length) {
      riesgos.push({ nivel: 'critical', titulo: 'Archivos críticos faltantes', detalle: archivosFaltantes.map((item) => item.archivo).join(', ') });
    }
    if (smoke?.fallos > 0) {
      riesgos.push({ nivel: 'error', titulo: 'Smoke tests con fallos', detalle: `${smoke.fallos} validaciones fallaron en el último chequeo.` });
    }
    const criticosRecientes = (estado?.recientes || []).filter((evento) => ['critical', 'error'].includes(normalizarTexto(evento?.nivel)));
    if (criticosRecientes.length >= 5) {
      riesgos.push({ nivel: 'error', titulo: 'Alta actividad sensible', detalle: `${criticosRecientes.length} eventos de severidad alta en memoria reciente.` });
    }
    const logTamano = Number(estado?.archivo_log_seguridad?.tamano) || 0;
    if (logTamano > 2 * 1024 * 1024) {
      riesgos.push({ nivel: 'warning', titulo: 'Log de seguridad creciendo', detalle: `El log actual pesa ${formatBytes(logTamano)}.` });
    }
    if (totalBloqueosActivos > 0) {
      riesgos.push({ nivel: 'warning', titulo: 'Bloqueos de login activos', detalle: `${totalBloqueosActivos} bloqueo(s) vigentes entre auth interna y tienda.` });
    }
    return riesgos;
  }, [estado, smoke, entornoLocal, totalBloqueosActivos]);

  const nivelRiesgoGeneral = useMemo(() => {
    if (riesgosDetectados.some((item) => item.nivel === 'critical')) return 'critico';
    if (riesgosDetectados.some((item) => item.nivel === 'error')) return 'alto';
    if (riesgosDetectados.some((item) => item.nivel === 'warning')) return 'medio';
    return 'estable';
  }, [riesgosDetectados]);

  const totalEventosRecientes = Array.isArray(estado?.recientes) ? estado.recientes.length : 0;
  const totalErroresLog = Number(resumenLogs?.porNivel?.error || 0) + Number(resumenLogs?.porNivel?.critical || 0);
  const ultimoSmokeTexto = smoke?.ejecutado_en ? formatFecha(smoke.ejecutado_en) : 'Aún no ejecutado desde este panel';
  const ultimoAuthInvalidToken = authInvalidTokenEventos.length ? authInvalidTokenEventos[authInvalidTokenEventos.length - 1]?.ts : '';
  const ultimaAuditoriaTexto = auditoriaAdmin.length ? formatFecha(auditoriaAdmin[0]?.fecha) : 'Sin movimientos recientes';

  function exportarPropuestaRotacion() {
    if (!rotacionSecretos?.lineas_env?.length) return;
    descargarArchivo(`security-rotation-${Date.now()}.env`, rotacionSecretos.lineas_env.join('\n'), 'text/plain;charset=utf-8');
  }

  async function copiarPropuestaRotacion() {
    if (!rotacionSecretos?.lineas_env?.length || !navigator?.clipboard?.writeText) {
      mostrarNotificacion('Tu navegador no permite copiar automáticamente.', 'advertencia');
      return;
    }
    try {
      await navigator.clipboard.writeText(rotacionSecretos.lineas_env.join('\n'));
      mostrarNotificacion('Propuesta copiada al portapapeles', 'exito');
    } catch {
      mostrarNotificacion('No se pudo copiar la propuesta', 'error');
    }
  }

  function exportarLogsJSON() {
    const payload = {
      generado_en: new Date().toISOString(),
      filtros: { filtroNivel, filtroTipo, filtroIp, limiteLogs },
      total: logsFiltrados.length,
      eventos: logsFiltrados
    };
    descargarArchivo(`security-logs-${Date.now()}.json`, JSON.stringify(payload, null, 2));
  }

  function exportarLogsCSV() {
    descargarArchivo(`security-logs-${Date.now()}.csv`, convertirEventosCSV(logsFiltrados), 'text/csv;charset=utf-8');
  }

  function exportarReporteCompleto() {
    const payload = {
      generado_en: new Date().toISOString(),
      estado,
      smoke,
      riesgos: {
        nivel_general: nivelRiesgoGeneral,
        items: riesgosDetectados
      },
      logs: {
        filtros: {
          limiteLogs,
          filtroNivel,
          filtroTipo,
          filtroIp,
          busquedaLibre,
          paginaLogs,
          tamanoPaginaLogs
        },
        total_filtrados: logsFiltrados.length,
        eventos: logsFiltrados
      },
      bloqueos_login: bloqueosLogin,
      auditoria_admin: auditoriaAdmin
    };
    descargarArchivo(`security-report-${Date.now()}.json`, JSON.stringify(payload, null, 2));
  }

  useEffect(() => {
    setPaginaLogs(1);
  }, [filtroNivel, filtroTipo, filtroIp, busquedaLibre, tamanoPaginaLogs]);

  useEffect(() => {
    if (paginaLogs > totalPaginasLogs) {
      setPaginaLogs(totalPaginasLogs);
    }
  }, [paginaLogs, totalPaginasLogs]);

  return (
    <div className="contenidoAdmin adminSeguridadCard">
      <div className="adminSeguridadHeader">
        <div>
          <h2>Centro de Seguridad</h2>
          <p className="adminSeguridadSubtitulo">
            Monitoreo en vivo, eventos recientes, alertas, chequeos activos y guía operativa para producción.
          </p>
        </div>
        <div className="adminSeguridadAcciones">
          <button className="botonPequeno" type="button" onClick={() => cargarPanel(limiteLogs)} disabled={cargando}>
            {cargando ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button className="botonPequeno" type="button" onClick={exportarReporteCompleto}>
            Exportar reporte
          </button>
          <button className="botonPequeno" type="button" onClick={probarAlerta} disabled={!puedeOperarSeguridad || enviandoPing}>
            {enviandoPing ? 'Enviando alerta...' : 'Probar alerta'}
          </button>
          <button className="botonPequeno" type="button" onClick={ejecutarSmoke} disabled={!puedeOperarSeguridad || ejecutandoSmoke}>
            {ejecutandoSmoke ? 'Ejecutando pruebas...' : 'Ejecutar smoke'}
          </button>
        </div>
      </div>

      <div className="adminSeguridadMetaBar">
        <span className={`adminSeguridadEstadoChip ${estado?.webhook_alertas_configurado || webhookPendientePeroOpcional ? 'ok' : 'pendiente'}`}>
          Webhook: {textoWebhookEstado}
        </span>
        <span className="adminSeguridadEstadoChip neutral">Entorno: {estado?.entorno || 'N/D'}</span>
        <span className="adminSeguridadEstadoChip neutral">Uptime: {formatDuracion(estado?.uptime_segundos)}</span>
        <span className="adminSeguridadEstadoChip neutral">Último refresco: {ultimoRefresco ? formatFecha(ultimoRefresco) : 'N/D'}</span>
        <span className="adminSeguridadEstadoChip neutral">Auto-refresh: {Number(autoRefreshSegundos) > 0 ? `${autoRefreshSegundos}s` : 'apagado'}</span>
      </div>

      {error && <div className="adminSeguridadError">{error}</div>}

      <section className="adminSeguridadPanel adminSeguridadRiesgosPanel">
        <div className="adminSeguridadTituloSeccion">
          <h3>Riesgos Detectados</h3>
          <span className={`adminSeguridadSemaforo ${nivelRiesgoGeneral}`}>Semáforo: {nivelRiesgoGeneral}</span>
        </div>
        <div className="adminSeguridadListaCompacta">
          {riesgosDetectados.length ? riesgosDetectados.map((riesgo, index) => (
            <div key={`${riesgo.titulo}-${index}`} className={`adminSeguridadFilaArchivo ${badgeNivelClase(riesgo.nivel) === 'critico' || badgeNivelClase(riesgo.nivel) === 'error' ? 'error' : 'ok'}`}>
              <div>
                <strong>{riesgo.titulo}</strong>
                <span>{riesgo.detalle}</span>
              </div>
              <b>{riesgo.nivel}</b>
            </div>
          )) : <div className="adminSeguridadVacio">No se detectan riesgos activos con la información actual.</div>}
        </div>
      </section>

      {authInvalidTokenEventos.length ? (
        <section className="adminSeguridadPanel adminSeguridadDiagnosticoPanel">
          <div className="adminSeguridadTituloSeccion">
            <h3>Diagnóstico de auth_invalid_token</h3>
            <span>{authInvalidTokenEventos.length} eventos en log activo</span>
          </div>
          <div className="adminSeguridadOperacionLista">
            <span>Patrón dominante: tráfico local `127.0.0.1` con rutas administrativas, consistente con sesiones inválidas del desarrollo previo.</span>
            <span>Último registro: {ultimoAuthInvalidToken ? formatFecha(ultimoAuthInvalidToken) : 'N/D'}</span>
          </div>
          <div className="adminSeguridadTopLista adminSeguridadTopListaLogs">
            {resumenAuthInvalidToken.map(([ruta, total]) => (
              <div key={ruta} className="adminSeguridadTopItem">
                <span>{ruta}</span>
                <strong>{total}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="adminSeguridadGrid">
        <section className="adminSeguridadPanel adminSeguridadPanelDestacado">
          <h3>Estado General</h3>
          <div className="adminSeguridadStats">
            <div>
              <span>Nivel mínimo webhook</span>
              <strong>{textoWebhookMinimo}</strong>
            </div>
            <div>
              <span>Cooldown alertas</span>
              <strong>{Math.round((Number(estado?.cooldown_alerta_ms) || 0) / 1000)}s</strong>
            </div>
            <div>
              <span>Log seguridad</span>
              <strong>{formatBytes(estado?.archivo_log_seguridad?.tamano)}</strong>
            </div>
            <div>
              <span>Actualizado log</span>
              <strong>{formatFecha(estado?.archivo_log_seguridad?.actualizado_en)}</strong>
            </div>
            <div>
              <span>Retención automática</span>
              <strong>{Number(estado?.retencion_automatica?.dias || 0)} días</strong>
            </div>
            <div>
              <span>Umbral anomalías</span>
              <strong>{Number(estado?.anomalias_ruta?.umbral_por_ventana || 0)} fallos/min</strong>
            </div>
            <div>
              <span>Limpieza de resueltos</span>
              <strong>{Math.round(Number(estado?.retencion_automatica?.gracia_resueltos_ms || 0) / 60000) || 0} min</strong>
            </div>
          </div>
        </section>

        <section className="adminSeguridadPanel">
          <h3>Bases Monitoreadas</h3>
          <div className="adminSeguridadVacio adminSeguridadNotaPanel">Son activos esenciales de operación. Solo se consideran riesgo cuando faltan.</div>
          <div className="adminSeguridadListaCompacta">
            {(estado?.archivos_criticos || []).map((archivo) => (
              <div key={archivo.archivo} className={`adminSeguridadFilaArchivo ${archivo.existe ? 'ok' : 'error'}`}>
                <div>
                  <strong>{archivo.archivo}</strong>
                  <span>{archivo.existe ? `Actualizado ${formatFecha(archivo.actualizado_en)}` : 'No encontrado'}</span>
                </div>
                <b>{archivo.existe ? formatBytes(archivo.tamano) : 'Falta'}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="adminSeguridadPanel">
          <h3>Resumen Reciente</h3>
          <div className="adminSeguridadChipsWrap">
            {resumenNiveles.length ? resumenNiveles.map(([nivel, total]) => (
              <span key={nivel} className={`adminSeguridadChipNivel ${badgeNivelClase(nivel)}`}>{nivel}: {total}</span>
            )) : <span className="adminSeguridadVacio">Sin eventos recientes</span>}
          </div>
          <div className="adminSeguridadTopLista">
            {resumenTipos.length ? resumenTipos.map(([tipo, total]) => (
              <div key={tipo} className="adminSeguridadTopItem">
                <span>{tipo}</span>
                <strong>{total}</strong>
              </div>
            )) : <div className="adminSeguridadVacio">No hay tipos registrados</div>}
          </div>
        </section>

        <section className="adminSeguridadPanel">
          <h3>Bloqueos de Login</h3>
          <div className="adminSeguridadSmokeResumen">
            <span className={`adminSeguridadEstadoChip ${totalBloqueosActivos ? 'pendiente' : 'ok'}`}>Activos: {totalBloqueosActivos}</span>
            <span className="adminSeguridadEstadoChip neutral">Admin: {Number(bloqueosLogin?.resumen?.admin_bloqueados || 0)}</span>
            <span className="adminSeguridadEstadoChip neutral">Tienda: {Number(bloqueosLogin?.resumen?.tienda_bloqueados || 0)}</span>
            <span className="adminSeguridadEstadoChip neutral">Últimos 15 min: {bloqueosUltimos15Min}</span>
          </div>
          <div className="adminSeguridadListaCompacta">
            {bloqueosDestacados.length ? bloqueosDestacados.map((item, index) => (
              <div key={`${item.origen}-${item.type}-${item.subject}-${index}`} className={`adminSeguridadFilaArchivo ${item.blocked ? 'error' : 'ok'}`}>
                <div>
                  <strong>{item.origen === 'admin' ? 'Auth interna' : 'Tienda'} · {item.type === 'id' ? 'usuario' : 'ip'}</strong>
                  <span>{item.subject || 'sin dato'}</span>
                  <span>Último intento: {formatFecha(item.lastAt)}</span>
                </div>
                <b>{item.retryAfterSec ? `${Math.ceil(Number(item.retryAfterSec || 0) / 60)} min` : 'Libre'}</b>
              </div>
            )) : <div className="adminSeguridadVacio">Sin bloqueos activos en este momento.</div>}
          </div>
        </section>

        <section className="adminSeguridadPanel">
          <h3>Pruebas Activas</h3>
          {smoke ? (
            <>
              <div className="adminSeguridadSmokeResumen">
                <span className="adminSeguridadEstadoChip ok">Exitosos: {smoke.exitosos}</span>
                <span className={`adminSeguridadEstadoChip ${smoke.fallos ? 'error' : 'ok'}`}>Fallos: {smoke.fallos}</span>
                <span className="adminSeguridadEstadoChip neutral">Ejecutado: {formatFecha(smoke.ejecutado_en)}</span>
              </div>
              <div className="adminSeguridadListaCompacta">
                {(smoke.resultados || []).map((item) => (
                  <div key={item.nombre} className={`adminSeguridadFilaArchivo ${item.ok ? 'ok' : 'error'}`}>
                    <div>
                      <strong>{item.nombre}</strong>
                      <span>{item.detalle || 'Sin detalle'}</span>
                    </div>
                    <b>{item.ok ? 'OK' : 'Fallo'}</b>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="adminSeguridadVacio">Ejecuta el smoke test para validar secretos, URLs públicas, CORS, log y presencia de bases críticas.</div>
          )}
        </section>
      </div>

      <div className="adminSeguridadGrid adminSeguridadGridInferior">
        <section className="adminSeguridadPanel adminSeguridadEventosPanel">
          <div className="adminSeguridadTituloSeccion">
            <h3>Eventos Recientes</h3>
            <span>{(estado?.recientes || []).length} visibles</span>
          </div>
          <div className="adminSeguridadEventosLista">
            {(estado?.recientes || []).length ? estado.recientes.slice().reverse().map((evento, index) => (
              <article key={`${evento.ts || 'evento'}-${evento.tipo || index}`} className="adminSeguridadEventoItem">
                <div className="adminSeguridadEventoTop">
                  <span className={`adminSeguridadChipNivel ${badgeNivelClase(evento.nivel)}`}>{evento.nivel || 'info'}</span>
                  <strong>{evento.tipo || 'security_event'}</strong>
                  <span>{formatFecha(evento.ts)}</span>
                </div>
                <div className="adminSeguridadEventoMeta">
                  <span>{evento.metodo || 'N/D'} {evento.ruta || ''}</span>
                  <span>IP: {evento.ip || 'N/D'}</span>
                </div>
              </article>
            )) : <div className="adminSeguridadVacio">Sin eventos recientes en memoria.</div>}
          </div>
        </section>

        <section className="adminSeguridadPanel adminSeguridadLogsPanel">
          <div className="adminSeguridadTituloSeccion">
            <h3>Logs de Seguridad</h3>
            <div className="adminSeguridadInlineControls">
              <label htmlFor="adminSeguridadLimiteLogs">Límite</label>
              <select id="adminSeguridadLimiteLogs" value={limiteLogs} onChange={(e) => setLimiteLogs(Number(e.target.value) || 120)}>
                <option value="50">50</option>
                <option value="120">120</option>
                <option value="250">250</option>
                <option value="500">500</option>
              </select>
            </div>
          </div>

          <div className="adminSeguridadControlBarra">
            <div className="adminSeguridadInlineControls">
              <label htmlFor="adminSeguridadAutoRefresh">Auto-refresh</label>
              <select id="adminSeguridadAutoRefresh" value={autoRefreshSegundos} onChange={(e) => setAutoRefreshSegundos(Number(e.target.value) || 0)}>
                <option value="0">Apagado</option>
                <option value="15">15 s</option>
                <option value="30">30 s</option>
                <option value="60">60 s</option>
                <option value="120">120 s</option>
              </select>
            </div>
            <div className="adminSeguridadInlineControls">
              <label htmlFor="adminSeguridadTamanoPagina">Página</label>
              <select id="adminSeguridadTamanoPagina" value={tamanoPaginaLogs} onChange={(e) => setTamanoPaginaLogs(Number(e.target.value) || 20)}>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          <div className="adminSeguridadFiltrosBarra">
            <div className="adminSeguridadFiltrosRapidos">
              <button type="button" className={filtroTipo === '' && filtroVentanaLogs === 'todos' && filtroNivel === 'todos' ? 'adminSeguridadFiltroAuditoria activo' : 'adminSeguridadFiltroAuditoria'} onClick={() => aplicarFiltroRapidoLogs('todos')}>
                Todos
              </button>
              <button type="button" className={filtroTipo === 'trastienda_' && filtroVentanaLogs === '24h' && filtroNivel === 'todos' ? 'adminSeguridadFiltroAuditoria activo' : 'adminSeguridadFiltroAuditoria'} onClick={() => aplicarFiltroRapidoLogs('trastienda24h')}>
                Trastienda 24 h
              </button>
              <button type="button" className={filtroTipo === 'trastienda_' && filtroVentanaLogs === '24h' && filtroNivel === 'warning' ? 'adminSeguridadFiltroAuditoria activo' : 'adminSeguridadFiltroAuditoria'} onClick={() => aplicarFiltroRapidoLogs('trastiendaCritical24h')}>
                Trastienda operativa 24 h
              </button>
              <button type="button" className={filtroNivel === 'critical' && filtroTipo === '' && filtroVentanaLogs === 'todos' ? 'adminSeguridadFiltroAuditoria activo' : 'adminSeguridadFiltroAuditoria'} onClick={() => aplicarFiltroRapidoLogs('critical')}>
                Solo critical
              </button>
            </div>
            <select value={filtroNivel} onChange={(e) => setFiltroNivel(e.target.value)}>
              <option value="todos">Todos los niveles</option>
              <option value="critical">Critical</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            <select value={filtroVentanaLogs} onChange={(e) => setFiltroVentanaLogs(e.target.value)}>
              <option value="todos">Todo el rango cargado</option>
              <option value="24h">Últimas 24 h</option>
            </select>
            <input
              type="text"
              placeholder="Filtrar por tipo"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            />
            <input
              type="text"
              placeholder="Filtrar por IP"
              value={filtroIp}
              onChange={(e) => setFiltroIp(e.target.value)}
            />
            <input
              type="text"
              placeholder="Buscar ruta o usuario"
              value={busquedaLibre}
              onChange={(e) => setBusquedaLibre(e.target.value)}
            />
            <button type="button" className="botonPequeno" onClick={exportarLogsJSON}>
              Exportar JSON
            </button>
            <button type="button" className="botonPequeno" onClick={exportarLogsCSV}>
              Exportar CSV
            </button>
            <button type="button" className="botonPequeno" onClick={archivarLogsFiltrados} disabled={!puedeOperarSeguridad || archivandoLogs || !logsFiltrados.length}>
              {archivandoLogs ? 'Archivando...' : 'Archivar filtrados'}
            </button>
            <button type="button" className="botonPequeno" onClick={limpiarRecientesFiltrados} disabled={!puedeOperarSeguridad || limpiandoRecientes}>
              {limpiandoRecientes ? 'Limpiando...' : 'Limpiar memoria'}
            </button>
            <button type="button" className="botonPequeno" onClick={() => { const siguiente = !mostrarHistorial; setMostrarHistorial(siguiente); if (siguiente && !historialLogs.length) cargarHistorial(limiteLogs); }}>
              {mostrarHistorial ? 'Ocultar historial' : 'Ver historial'}
            </button>
          </div>

          <div className="adminSeguridadVacio adminSeguridadNotaPanel">
            Archivar filtrados mueve eventos del log activo al historial. Limpiar memoria solo vacía el bloque reciente en memoria y no borra el archivo principal. Además, el sistema archiva solo el ruido resuelto del desarrollo después de unos minutos.
          </div>

          <div className="adminSeguridadChipsWrap adminSeguridadChipsWrapLogs">
            {resumenNivelesLog.length ? resumenNivelesLog.map(([nivel, total]) => (
              <span key={nivel} className={`adminSeguridadChipNivel ${badgeNivelClase(nivel)}`}>{nivel}: {total}</span>
            )) : <span className="adminSeguridadVacio">Sin resumen de logs</span>}
          </div>

          <div className="adminSeguridadTopLista adminSeguridadTopListaLogs">
            {resumenTiposLog.length ? resumenTiposLog.map(([tipo, total]) => (
              <div key={tipo} className="adminSeguridadTopItem">
                <span>{tipo}</span>
                <strong>{total}</strong>
              </div>
            )) : <div className="adminSeguridadVacio">Sin tipos en logs</div>}
          </div>

          <div className="adminSeguridadLogsLista">
            {logsPaginados.length ? logsPaginados.map((evento, index) => (
              <article key={`${evento.ts || 'log'}-${evento.tipo || index}-${index}`} className="adminSeguridadLogItem">
                <div className="adminSeguridadEventoTop">
                  <span className={`adminSeguridadChipNivel ${badgeNivelClase(evento.nivel)}`}>{evento.nivel || 'info'}</span>
                  <strong>{evento.tipo || 'security_event'}</strong>
                </div>
                <div className="adminSeguridadEventoMeta adminSeguridadEventoMetaStack">
                  <span>{formatFecha(evento.ts)}</span>
                  <span>{evento.metodo || 'N/D'} {evento.ruta || ''}</span>
                  <span>IP: {evento.ip || 'N/D'}</span>
                  <span>Usuario: {evento?.detalle?.usuario || 'N/D'}</span>
                </div>
              </article>
            )) : <div className="adminSeguridadVacio">No hay eventos que coincidan con los filtros actuales.</div>}
          </div>

          <div className="adminSeguridadPaginacion">
            <span>Mostrando {logsPaginados.length} de {logsFiltrados.length} eventos filtrados</span>
            <div className="adminSeguridadPaginacionAcciones">
              <button type="button" className="botonPequeno" onClick={() => setPaginaLogs(1)} disabled={paginaLogs <= 1}>Inicio</button>
              <button type="button" className="botonPequeno" onClick={() => setPaginaLogs((prev) => Math.max(1, prev - 1))} disabled={paginaLogs <= 1}>Anterior</button>
              <span>Página {Math.min(paginaLogs, totalPaginasLogs)} de {totalPaginasLogs}</span>
              <button type="button" className="botonPequeno" onClick={() => setPaginaLogs((prev) => Math.min(totalPaginasLogs, prev + 1))} disabled={paginaLogs >= totalPaginasLogs}>Siguiente</button>
              <button type="button" className="botonPequeno" onClick={() => setPaginaLogs(totalPaginasLogs)} disabled={paginaLogs >= totalPaginasLogs}>Final</button>
            </div>
          </div>

          {mostrarHistorial ? (
            <div className="adminSeguridadHistorialWrap">
              <div className="adminSeguridadTituloSeccion">
                <h3>Historial Archivado</h3>
                <span>{cargandoHistorial ? 'Cargando...' : `${historialLogs.length} visibles`}</span>
              </div>
              <div className="adminSeguridadChipsWrap adminSeguridadChipsWrapLogs">
                {Object.entries(resumenHistorial?.porNivel || {}).length
                  ? Object.entries(resumenHistorial.porNivel).sort((a, b) => b[1] - a[1]).map(([nivel, total]) => (
                    <span key={nivel} className={`adminSeguridadChipNivel ${badgeNivelClase(nivel)}`}>{nivel}: {total}</span>
                  ))
                  : <span className="adminSeguridadVacio">Sin historial archivado</span>}
              </div>
              <div className="adminSeguridadLogsLista adminSeguridadHistorialLista">
                {historialLogs.length ? historialLogs.slice().reverse().slice(0, Math.max(10, tamanoPaginaLogs)).map((evento, index) => (
                  <article key={`${evento.ts || 'hist'}-${evento.tipo || index}-${index}`} className="adminSeguridadLogItem">
                    <div className="adminSeguridadEventoTop">
                      <span className={`adminSeguridadChipNivel ${badgeNivelClase(evento.nivel)}`}>{evento.nivel || 'info'}</span>
                      <strong>{evento.tipo || 'security_event'}</strong>
                    </div>
                    <div className="adminSeguridadEventoMeta adminSeguridadEventoMetaStack">
                      <span>{formatFecha(evento.ts)}</span>
                      <span>{evento.metodo || 'N/D'} {evento.ruta || ''}</span>
                      <span>Archivado: {formatFecha(evento.archivado_en)}</span>
                    </div>
                  </article>
                )) : <div className="adminSeguridadVacio">No hay eventos archivados todavía.</div>}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <section className="adminSeguridadPanel adminSeguridadOperacionesPanel">
        <h3>Operación Continua</h3>
        <div className="adminSeguridadOperacionesGrid">
          <div className="adminSeguridadOperacionCard">
            <strong>Monitoreo y revisión</strong>
            <p>La información operativa ya se muestra aquí sin ejecutar comandos manuales.</p>
            <div className="adminSeguridadOperacionLista">
              <span>Eventos recientes en memoria: {totalEventosRecientes}</span>
              <span>Errores altos en logs filtrados: {totalErroresLog}</span>
              <span>Bloqueos de login activos: {totalBloqueosActivos}</span>
              <span>Bloqueos vistos en 15 min: {bloqueosUltimos15Min}</span>
              <span>Eventos críticos Trastienda 24 h: {eventosCriticosTrastienda24h}</span>
              <span>Agrupación de ruido: {Math.round(Number(estado?.agrupacion_eventos?.ventana_ms || 0) / 1000)} s</span>
              <span>Retención automática: {Number(estado?.retencion_automatica?.dias || 0)} días</span>
              <span>Última auditoría admin: {ultimaAuditoriaTexto}</span>
              <span>Revocaciones hoy: {revocacionesHoy}</span>
              <span>Cambios Trastienda hoy: {cambiosTrastiendaHoy}</span>
              <span>Última actualización: {ultimoRefresco ? formatFecha(ultimoRefresco) : 'N/D'}</span>
            </div>
            {topEventosCriticosTrastienda24h.length ? (
              <div className="adminSeguridadTopLista">
                {topEventosCriticosTrastienda24h.map(([tipo, total]) => (
                  <div key={tipo} className="adminSeguridadTopItem">
                    <span>{tipo}</span>
                    <strong>{total}</strong>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="adminSeguridadOperacionAcciones">
              <button type="button" className="botonPequeno" onClick={() => cargarPanel(limiteLogs)} disabled={cargando}>
                {cargando ? 'Actualizando...' : 'Actualizar panel'}
              </button>
              <button type="button" className="botonPequeno" onClick={exportarLogsJSON}>
                Exportar logs JSON
              </button>
              <button type="button" className="botonPequeno" onClick={archivarTrastienda24hDirecto} disabled={!puedeOperarSeguridad || archivandoLogs}>
                {archivandoLogs ? 'Archivando...' : 'Archivar Trastienda 24 h'}
              </button>
              <button type="button" className="botonPequeno" onClick={limpiarTrastienda24hDirecto} disabled={!puedeOperarSeguridad || limpiandoRecientes}>
                {limpiandoRecientes ? 'Limpiando...' : 'Limpiar Trastienda 24 h'}
              </button>
            </div>
          </div>

          <div className="adminSeguridadOperacionCard">
            <strong>Pruebas activas</strong>
            <p>Las validaciones de seguridad pueden ejecutarse desde este panel y dejan su resultado visible.</p>
            <div className="adminSeguridadOperacionLista">
              <span>Último smoke: {ultimoSmokeTexto}</span>
              <span>Exitosos: {Number(smoke?.exitosos || 0)}</span>
              <span>Fallos: {Number(smoke?.fallos || 0)}</span>
            </div>
            <div className="adminSeguridadOperacionAcciones">
              <button type="button" className="botonPequeno" onClick={ejecutarSmoke} disabled={!puedeOperarSeguridad || ejecutandoSmoke}>
                {ejecutandoSmoke ? 'Ejecutando...' : 'Ejecutar smoke'}
              </button>
              <button type="button" className="botonPequeno" onClick={probarAlerta} disabled={!puedeOperarSeguridad || enviandoPing}>
                {enviandoPing ? 'Enviando...' : 'Probar alerta'}
              </button>
            </div>
          </div>

          <div className="adminSeguridadOperacionCard">
            <strong>Rotación de secretos</strong>
            <p>La rotación no se ejecuta desde el navegador por seguridad. Debe hacerse en Render o en variables del servidor y después reiniciar el servicio.</p>
            <div className="adminSeguridadOperacionLista">
              <span>JWT principal: {estado?.entorno === 'development' ? 'revisar antes de producción' : 'gestionar en entorno seguro'}</span>
              <span>Webhook de alertas: {textoWebhookEstado}</span>
              <span>Reporte operativo: disponible para exportación desde este panel</span>
            </div>
            <div className="adminSeguridadOperacionAcciones">
              <button type="button" className="botonPequeno" onClick={generarRotacionSecretos} disabled={!puedeOperarSeguridad || generandoSecretos}>
                {generandoSecretos ? 'Generando...' : 'Generar secretos'}
              </button>
              <button type="button" className="botonPequeno" onClick={copiarPropuestaRotacion} disabled={!rotacionSecretos?.lineas_env?.length}>
                Copiar propuesta
              </button>
              <button type="button" className="botonPequeno" onClick={exportarPropuestaRotacion} disabled={!rotacionSecretos?.lineas_env?.length}>
                Exportar .env
              </button>
              <button type="button" className="botonPequeno" onClick={exportarReporteCompleto}>
                Exportar reporte completo
              </button>
            </div>
            {rotacionSecretos?.secretos ? (
              <div className="adminSeguridadSecretosBox">
                <div className="adminSeguridadSecretosMeta">
                  <strong>Propuesta generada: {formatFecha(rotacionSecretos.generado_en)}</strong>
                </div>
                <div className="adminSeguridadOperacionLista">
                  {Object.entries(rotacionSecretos.secretos).map(([clave, valor]) => (
                    <span key={clave}><strong>{clave}:</strong> {valor}</span>
                  ))}
                </div>
                <div className="adminSeguridadOperacionLista">
                  {(rotacionSecretos.instrucciones || []).map((paso, index) => (
                    <span key={`${paso}-${index}`}>{index + 1}. {paso}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="adminSeguridadHistorialWrap">
          <div className="adminSeguridadTituloSeccion">
            <h3>Auditoría Administrativa</h3>
            <span>{auditoriaAdminFiltrada.length} visibles de {auditoriaAdmin.length}</span>
          </div>
          <div className="adminSeguridadChipsWrap adminSeguridadChipsWrapLogs">
            {[
              ['todos', 'Todo'],
              ['trastienda', 'Trastienda'],
              ['usuarios', 'Usuarios'],
              ['backup', 'Backups e import/export'],
              ['seguridad', 'Seguridad']
            ].map(([clave, label]) => (
              <button
                key={clave}
                type="button"
                className={`adminSeguridadFiltroAuditoria ${filtroAuditoria === clave ? 'activo' : ''}`}
                onClick={() => setFiltroAuditoria(clave)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="adminSeguridadLogsLista adminSeguridadHistorialLista">
            {auditoriaAdminFiltrada.length ? auditoriaAdminFiltrada.map((evento) => (
              <article key={`audit-${evento.id || evento.fecha || evento.accion}`} className="adminSeguridadLogItem">
                <div className="adminSeguridadEventoTop">
                  <span className="adminSeguridadChipNivel info">audit</span>
                  <strong>{evento.accion || 'accion_admin'}</strong>
                </div>
                <div className="adminSeguridadEventoMeta adminSeguridadEventoMetaStack">
                  <span>{formatFecha(evento.fecha)}</span>
                  <span>Operador: {evento.usuario || 'N/D'}</span>
                  <span>Detalle: {Object.entries(evento.detalle || {}).map(([clave, valor]) => `${clave}=${valor}`).join(' · ') || 'Sin detalle'}</span>
                </div>
              </article>
            )) : <div className="adminSeguridadVacio">No hay movimientos administrativos para ese filtro.</div>}
          </div>

          <div className="adminSeguridadHistorialWrap">
            <div className="adminSeguridadTituloSeccion">
              <h3>Cambios Críticos de Trastienda</h3>
              <span>{auditoriaTrastienda.length} visibles · hoy {cambiosTrastiendaHoy}</span>
            </div>
            <div className="adminSeguridadListaCompacta">
              {auditoriaTrastienda.length ? auditoriaTrastienda.map((evento, index) => (
                <div key={`trastienda-${evento.id || evento.fecha || index}`} className="adminSeguridadFilaArchivo error">
                  <div>
                    <strong>{evento.accion || 'trastienda_accion'}</strong>
                    <span>Operador: {evento.usuario || 'N/D'}</span>
                    <span>Fecha: {formatFecha(evento.fecha)}</span>
                    <span>Detalle: {Object.entries(evento.detalle || {}).map(([clave, valor]) => `${clave}=${valor}`).join(' · ') || 'Sin detalle'}</span>
                  </div>
                  <b>trastienda</b>
                </div>
              )) : <div className="adminSeguridadVacio">No hay cambios críticos de Trastienda auditados recientemente.</div>}
            </div>
          </div>

          <div className="adminSeguridadHistorialWrap">
            <div className="adminSeguridadTituloSeccion">
              <h3>Revocaciones Recientes</h3>
              <span>{revocacionesRecientes.length} visibles · hoy {revocacionesHoy}</span>
            </div>
            <div className="adminSeguridadListaCompacta">
              {revocacionesRecientes.length ? revocacionesRecientes.map((evento, index) => (
                <div key={`rev-${evento.id || evento.fecha || index}`} className="adminSeguridadFilaArchivo error">
                  <div>
                    <strong>{evento.detalle?.objetivo || 'usuario'}</strong>
                    <span>Operador: {evento.usuario || 'N/D'}</span>
                    <span>Fecha: {formatFecha(evento.fecha)}</span>
                  </div>
                  <b>revocado</b>
                </div>
              )) : <div className="adminSeguridadVacio">No hay revocaciones recientes registradas.</div>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
