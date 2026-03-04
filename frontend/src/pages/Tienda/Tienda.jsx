import React, { useEffect, useMemo, useState } from 'react';
import './Tienda.css';
import { API } from '../../utils/config.jsx';
import { mostrarNotificacion } from '../../utils/notificaciones.jsx';

const API_TIENDA = import.meta.env.DEV
  ? (import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:3001')
  : API;

const CLAVE_TOKEN_CLIENTE = 'tienda_cliente_token';
const CONFIG_DEFAULT = {
  promo_texto: '💖 ¡Últimas horas! Llévate productos favoritos con promoción especial.',
  footer_marca_titulo: 'CHIPACTLI',
  footer_marca_texto: 'Formulamos productos artesanales para el cuidado personal de forma segura y consciente.',
  atencion_horario_lunes_sabado: '09:00 a.m. - 09:00 p.m.',
  atencion_horario_domingo: '08:00 a.m. - 12:00 p.m.',
  atencion_telefono: '+52 55 2079 7407',
  atencion_correo: 'atc@chipactli.mx',
  whatsapp_numero: '',
  footer_pagos_texto: 'VISA · MasterCard · PayPal · AMEX · OXXO',
  info_link_1_label: 'Mis pedidos',
  info_link_1_url: '#',
  info_link_1_texto: 'Aquí puedes revisar el estado y detalle de tus pedidos.',
  info_link_1_activo: '1',
  info_link_2_label: 'Nosotros',
  info_link_2_url: '#',
  info_link_2_texto: 'Somos CHIPACTLI, una marca enfocada en el cuidado personal artesanal y consciente.',
  info_link_2_activo: '1',
  info_link_3_label: 'Blog',
  info_link_3_url: '#',
  info_link_3_texto: 'Próximamente compartiremos consejos, novedades y contenido de valor para ti.',
  info_link_3_activo: '1',
  info_link_4_label: 'Términos y condiciones',
  info_link_4_url: '#',
  info_link_4_texto: 'Consulta aquí nuestros términos y condiciones de compra y uso del sitio.',
  info_link_4_activo: '1',
  info_link_5_label: 'Aviso de privacidad',
  info_link_5_url: '#',
  info_link_5_texto: 'Conoce cómo recopilamos, usamos y protegemos tus datos personales en CHIPACTLI.',
  info_link_5_activo: '1'
};

function configActivo(valor, predeterminado = true) {
  if (valor === undefined || valor === null || valor === '') return predeterminado;
  const txt = String(valor).trim().toLowerCase();
  return !(txt === '0' || txt === 'false' || txt === 'no' || txt === 'off');
}

function apiUrl(path) {
  return `${API_TIENDA}${path}`;
}

async function fetchJson(path, options = {}) {
  const respuesta = await fetch(apiUrl(path), options);
  const data = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(data?.mensaje || data?.error || `Error HTTP ${respuesta.status}`);
  }
  return data;
}

function precio(num) {
  return `$${(Number(num) || 0).toFixed(2)}`;
}

function normalizarVariantes(variantes) {
  if (!Array.isArray(variantes)) return [];
  return variantes
    .map((item) => {
      if (typeof item === 'string') {
        return {
          nombre: item.trim(),
          extra: 0,
          receta_nombre: '',
          precio_venta: 0,
          stock: 0,
          disponible: false,
          gramaje: 0
        };
      }
      return {
        nombre: String(item?.nombre || '').trim(),
        extra: Number(item?.extra) || 0,
        receta_nombre: String(item?.receta_nombre || '').trim(),
        precio_venta: Number(item?.precio_venta) || 0,
        stock: Number(item?.stock) || 0,
        disponible: Boolean(item?.disponible) || (Number(item?.stock) || 0) > 0,
        gramaje: Number(item?.gramaje) || 0
      };
    })
    .filter((item) => item.nombre);
}

function precioVariante(producto, variante = null) {
  if (variante && Number(variante?.precio_venta) > 0) return Number(variante.precio_venta);
  const base = Number(producto?.precio_venta) || 0;
  return base + (Number(variante?.extra) || 0);
}

function estadoClasificacion(item) {
  return {
    es_lanzamiento: Boolean(item?.es_lanzamiento),
    es_favorito: Boolean(item?.es_favorito),
    es_oferta: Boolean(item?.es_oferta),
    es_accesorio: Boolean(item?.es_accesorio)
  };
}

function clasificacionCambio(actual, base) {
  return (
    Boolean(actual?.es_lanzamiento) !== Boolean(base?.es_lanzamiento)
    || Boolean(actual?.es_favorito) !== Boolean(base?.es_favorito)
    || Boolean(actual?.es_oferta) !== Boolean(base?.es_oferta)
    || Boolean(actual?.es_accesorio) !== Boolean(base?.es_accesorio)
  );
}

export default function Tienda() {
  const [productos, setProductos] = useState([]);
  const [vistaActiva, setVistaActiva] = useState('tienda');
  const [seccionActiva, setSeccionActiva] = useState('todos');
  const [categoriaActiva, setCategoriaActiva] = useState('todas');
  const [filtro, setFiltro] = useState('');
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [mostrarCarrito, setMostrarCarrito] = useState(false);
  const [modoAuth, setModoAuth] = useState('login');
  const [mostrarModalAuthCliente, setMostrarModalAuthCliente] = useState(false);
  const [mostrarModalPerfilCliente, setMostrarModalPerfilCliente] = useState(false);
  const [pasoRegistro, setPasoRegistro] = useState(1);
  const [credenciales, setCredenciales] = useState({ nombre: '', email: '', password: '', confirmarPassword: '', telefono: '' });
  const [clienteToken, setClienteToken] = useState(() => localStorage.getItem(CLAVE_TOKEN_CLIENTE) || '');
  const [tokenInterno] = useState(() => localStorage.getItem('token') || '');
  const [cliente, setCliente] = useState(null);
  const [perfil, setPerfil] = useState({ nombre: '', telefono: '', forma_pago_preferida: '' });
  const [checkout, setCheckout] = useState({ metodo_pago: 'efectivo', id_punto_entrega: '', notas: '' });
  const [ordenes, setOrdenes] = useState([]);
  const [puntosEntrega, setPuntosEntrega] = useState([]);
  const [adminPuntos, setAdminPuntos] = useState([]);
  const [adminClientes, setAdminClientes] = useState([]);
  const [adminOrdenes, setAdminOrdenes] = useState([]);
  const [infoSeleccionada, setInfoSeleccionada] = useState(null);
  const [configTienda, setConfigTienda] = useState(CONFIG_DEFAULT);
  const [configTiendaAdmin, setConfigTiendaAdmin] = useState(CONFIG_DEFAULT);
  const [nuevoPunto, setNuevoPunto] = useState({ nombre: '', direccion: '', horario: '', activo: true });
  const [guardandoClasificacion, setGuardandoClasificacion] = useState('');
  const [guardandoClasificacionMasiva, setGuardandoClasificacionMasiva] = useState(false);
  const [clasificacionGuardada, setClasificacionGuardada] = useState({});
  const [soloPendientesClasificacion, setSoloPendientesClasificacion] = useState(false);
  const [editorProducto, setEditorProducto] = useState(null);

  useEffect(() => {
    cargarProductos();
    cargarPuntosEntrega();
    cargarConfigTienda();
  }, []);

  useEffect(() => {
    if (!clienteToken) {
      setCliente(null);
      setOrdenes([]);
      return;
    }
    cargarPerfil(clienteToken);
    cargarMisOrdenes(clienteToken);
  }, [clienteToken]);

  const productosFiltrados = useMemo(() => {
    const termino = filtro.trim().toLowerCase();
    return productos.filter((item) => {
      const nombre = String(item?.nombre_receta || '').toLowerCase();
      const descripcion = String(item?.descripcion || '').toLowerCase();
      const categoria = String(item?.categoria_nombre || '').trim().toLowerCase();

      const matchTexto = !termino || nombre.includes(termino) || descripcion.includes(termino);
      if (!matchTexto) return false;

      if (categoriaActiva !== 'todas' && categoria !== categoriaActiva) return false;

      if (seccionActiva === 'lanzamientos') return Boolean(item?.es_lanzamiento);
      if (seccionActiva === 'favoritos') return Boolean(item?.es_favorito);
      if (seccionActiva === 'ofertas') return Boolean(item?.es_oferta);
      if (seccionActiva === 'accesorios') return Boolean(item?.es_accesorio);

      return true;
    });
  }, [productos, filtro, categoriaActiva, seccionActiva]);

  const categoriasDisponibles = useMemo(() => {
    const setCategorias = new Set();
    for (const item of productos) {
      const categoria = String(item?.categoria_nombre || '').trim();
      if (categoria) setCategorias.add(categoria);
    }
    return Array.from(setCategorias).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [productos]);

  const totalCarrito = useMemo(() => {
    return carrito.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  }, [carrito]);

  const linksInformacion = useMemo(() => {
    let linksLegacy = [];
    try {
      const parseado = JSON.parse(String(configTienda?.footer_links || '[]'));
      linksLegacy = Array.isArray(parseado) ? parseado : [];
    } catch {
      linksLegacy = [];
    }

    const lista = [1, 2, 3, 4, 5].map((idx) => {
      const legacy = linksLegacy[idx - 1] || {};
      const labelConfig = String(configTienda?.[`info_link_${idx}_label`] || '').trim();
      const labelLegacy = String(legacy?.label || '').trim();
      const label = labelConfig || labelLegacy;

      const hrefConfig = String(configTienda?.[`info_link_${idx}_url`] || '#').trim() || '#';
      const hrefLegacy = String(legacy?.url || '#').trim() || '#';
      const href = hrefConfig !== '#' ? hrefConfig : hrefLegacy;

      const textoConfig = String(configTienda?.[`info_link_${idx}_texto`] || '').trim();
      const textoLegacy = String(legacy?.texto || legacy?.contenido || '').trim();
      const texto = textoConfig || textoLegacy;

      const activo = configActivo(configTienda?.[`info_link_${idx}_activo`], true);
      return { label, href, texto, activo };
    });
    return lista.filter((item) => item.label && item.activo);
  }, [configTienda]);

  function abrirLinkInformacion(item) {
    setInfoSeleccionada({
      titulo: String(item?.label || 'Información').trim() || 'Información',
      texto: String(item?.texto || '').trim() || 'Aún no hay contenido configurado para esta sección.',
      href: String(item?.href || '').trim()
    });
    setVistaActiva('info');
  }

  const pendientesClasificacion = useMemo(() => {
    return productos.filter((producto) => {
      const recetaNombre = String(producto?.nombre_receta || '').trim();
      if (!recetaNombre) return false;
      const actual = estadoClasificacion(producto);
      const base = clasificacionGuardada[recetaNombre] || {
        es_lanzamiento: false,
        es_favorito: false,
        es_oferta: false,
        es_accesorio: false
      };
      return clasificacionCambio(actual, base);
    }).length;
  }, [productos, clasificacionGuardada]);

  const productosClasificacion = useMemo(() => {
    if (!soloPendientesClasificacion) return productos;
    return productos.filter((producto) => clasificacionCambio(
      estadoClasificacion(producto),
      clasificacionGuardada[String(producto?.nombre_receta || '').trim()] || {}
    ));
  }, [productos, clasificacionGuardada, soloPendientesClasificacion]);

  async function cargarProductos() {
    setCargando(true);
    try {
      const data = tokenInterno
        ? await fetchAdmin('/tienda/admin/productos')
        : await fetchJson('/tienda/productos');
      const lista = Array.isArray(data) ? data : [];
      setProductos(lista);
      const base = {};
      for (const item of lista) {
        const recetaNombre = String(item?.nombre_receta || '').trim();
        if (!recetaNombre) continue;
        base[recetaNombre] = estadoClasificacion(item);
      }
      setClasificacionGuardada(base);
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo cargar la tienda', 'error');
    } finally {
      setCargando(false);
    }
  }

  function abrirEditorProducto(producto) {
    const variantes = normalizarVariantes(producto?.variantes);
    setEditorProducto({
      receta_nombre: String(producto?.nombre_receta || '').trim(),
      descripcion: String(producto?.descripcion || ''),
      image_url: String(producto?.image_url || ''),
      activo: Boolean(producto?.visible_publico),
      ingredientes_texto: (Array.isArray(producto?.ingredientes) ? producto.ingredientes : []).map((item) => String(item || '')).filter(Boolean).join('\n'),
      variantes_texto: variantes.map((v) => `${v.nombre}|${Number(v.extra) || 0}`).join('\n')
    });
  }

  function parseLineas(texto = '') {
    return String(texto)
      .split('\n')
      .map((linea) => String(linea || '').trim())
      .filter(Boolean);
  }

  function parseVariantesTexto(texto = '') {
    return parseLineas(texto).map((linea) => {
      const [nombreRaw, extraRaw] = String(linea).split('|');
      return {
        nombre: String(nombreRaw || '').trim(),
        extra: Number(extraRaw) || 0
      };
    }).filter((item) => item.nombre);
  }

  async function guardarEditorProducto() {
    if (!editorProducto?.receta_nombre) return;
    try {
      await fetchAdmin('/tienda/catalogo/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receta_nombre: editorProducto.receta_nombre,
          descripcion: editorProducto.descripcion,
          image_url: editorProducto.image_url,
          activo: Boolean(editorProducto.activo),
          ingredientes: parseLineas(editorProducto.ingredientes_texto),
          variantes: parseVariantesTexto(editorProducto.variantes_texto)
        })
      });
      setEditorProducto(null);
      await cargarProductos();
      mostrarNotificacion('Ficha de producto guardada', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo guardar la ficha', 'error');
    }
  }

  async function cargarPerfil(token) {
    try {
      const data = await fetchJson('/tienda/auth/perfil', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCliente(data?.cliente || null);
      setPerfil({
        nombre: data?.cliente?.nombre || '',
        telefono: data?.cliente?.telefono || '',
        forma_pago_preferida: data?.cliente?.forma_pago_preferida || ''
      });
      setCheckout((prev) => ({
        ...prev,
        metodo_pago: data?.cliente?.forma_pago_preferida || prev.metodo_pago
      }));
    } catch {
      localStorage.removeItem(CLAVE_TOKEN_CLIENTE);
      setClienteToken('');
    }
  }

  useEffect(() => {
    if (!tokenInterno) return;
    cargarAdminPuntos();
    cargarAdminClientes();
    cargarAdminOrdenes();
    cargarConfigTiendaAdmin();
  }, [tokenInterno]);

  async function cargarConfigTienda() {
    try {
      const data = await fetchJson('/tienda/config');
      setConfigTienda({ ...CONFIG_DEFAULT, ...(data || {}) });
    } catch {
      setConfigTienda(CONFIG_DEFAULT);
    }
  }

  async function cargarConfigTiendaAdmin() {
    try {
      const data = await fetchAdmin('/tienda/admin/config');
      setConfigTiendaAdmin({ ...CONFIG_DEFAULT, ...(data || {}) });
    } catch {
      setConfigTiendaAdmin(CONFIG_DEFAULT);
    }
  }

  async function guardarConfigTiendaAdmin() {
    try {
      const data = await fetchAdmin('/tienda/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configTiendaAdmin)
      });
      const conf = { ...CONFIG_DEFAULT, ...(data?.config || configTiendaAdmin) };
      setConfigTiendaAdmin(conf);
      setConfigTienda(conf);
      mostrarNotificacion('Configuración de tienda guardada', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo guardar configuración', 'error');
    }
  }

  async function fetchAdmin(path, options = {}) {
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${tokenInterno}`
    };
    return fetchJson(path, { ...options, headers });
  }

  async function cargarPuntosEntrega() {
    try {
      const data = await fetchJson('/tienda/puntos-entrega');
      const lista = Array.isArray(data) ? data : [];
      setPuntosEntrega(lista);
      setCheckout((prev) => ({
        ...prev,
        id_punto_entrega: prev.id_punto_entrega || String(lista[0]?.id || '')
      }));
    } catch {
      setPuntosEntrega([]);
    }
  }

  async function cargarAdminPuntos() {
    try {
      const data = await fetchAdmin('/tienda/admin/puntos-entrega');
      setAdminPuntos(Array.isArray(data) ? data : []);
    } catch {
      setAdminPuntos([]);
    }
  }

  async function cargarAdminClientes() {
    try {
      const data = await fetchAdmin('/tienda/admin/clientes');
      setAdminClientes(Array.isArray(data) ? data : []);
    } catch {
      setAdminClientes([]);
    }
  }

  async function cargarAdminOrdenes() {
    try {
      const data = await fetchAdmin('/tienda/admin/ordenes');
      setAdminOrdenes(Array.isArray(data) ? data : []);
    } catch {
      setAdminOrdenes([]);
    }
  }

  async function crearPuntoEntregaAdmin(event) {
    event.preventDefault();
    try {
      await fetchAdmin('/tienda/admin/puntos-entrega', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoPunto)
      });
      setNuevoPunto({ nombre: '', direccion: '', horario: '', activo: true });
      await cargarAdminPuntos();
      await cargarPuntosEntrega();
      mostrarNotificacion('Punto de entrega creado', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo crear punto', 'error');
    }
  }

  async function cambiarEstadoPunto(id, activo) {
    const punto = adminPuntos.find((item) => item.id === id);
    if (!punto) return;
    try {
      await fetchAdmin(`/tienda/admin/puntos-entrega/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...punto, activo })
      });
      await cargarAdminPuntos();
      await cargarPuntosEntrega();
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo actualizar punto', 'error');
    }
  }

  function editarCampoPunto(id, campo, valor) {
    setAdminPuntos((prev) => prev.map((item) => (
      item.id === id ? { ...item, [campo]: valor } : item
    )));
  }

  async function guardarPuntoAdmin(id) {
    const punto = adminPuntos.find((item) => item.id === id);
    if (!punto) return;
    try {
      await fetchAdmin(`/tienda/admin/puntos-entrega/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: punto.nombre,
          direccion: punto.direccion,
          horario: punto.horario,
          activo: Number(punto.activo) === 1
        })
      });
      await cargarAdminPuntos();
      await cargarPuntosEntrega();
      mostrarNotificacion('Punto actualizado', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo guardar punto', 'error');
    }
  }

  async function eliminarPuntoAdmin(id) {
    try {
      await fetchAdmin(`/tienda/admin/puntos-entrega/${id}`, { method: 'DELETE' });
      await cargarAdminPuntos();
      await cargarPuntosEntrega();
      mostrarNotificacion('Punto eliminado', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo eliminar punto', 'error');
    }
  }

  async function actualizarEstadoOrdenAdmin(id, estado) {
    try {
      await fetchAdmin(`/tienda/admin/ordenes/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado })
      });
      await cargarAdminOrdenes();
      mostrarNotificacion('Estado de pedido actualizado', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo actualizar estado', 'error');
    }
  }

  async function guardarClasificacionProducto(producto) {
    const recetaNombre = String(producto?.nombre_receta || '').trim();
    if (!recetaNombre) return;
    setGuardandoClasificacion(recetaNombre);
    try {
      await fetchAdmin('/tienda/catalogo/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receta_nombre: recetaNombre,
          es_lanzamiento: Boolean(producto?.es_lanzamiento),
          es_favorito: Boolean(producto?.es_favorito),
          es_oferta: Boolean(producto?.es_oferta),
          es_accesorio: Boolean(producto?.es_accesorio)
        })
      });
      await cargarProductos();
      mostrarNotificacion(`Clasificación guardada para ${recetaNombre}`, 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo guardar clasificación', 'error');
    } finally {
      setGuardandoClasificacion('');
    }
  }

  async function guardarClasificacionTodos() {
    if (!productos.length) return;
    setGuardandoClasificacionMasiva(true);
    try {
      await Promise.all(
        productos.map((producto) => {
          const recetaNombre = String(producto?.nombre_receta || '').trim();
          if (!recetaNombre) return Promise.resolve();
          return fetchAdmin('/tienda/catalogo/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              receta_nombre: recetaNombre,
              es_lanzamiento: Boolean(producto?.es_lanzamiento),
              es_favorito: Boolean(producto?.es_favorito),
              es_oferta: Boolean(producto?.es_oferta),
              es_accesorio: Boolean(producto?.es_accesorio)
            })
          });
        })
      );

      await cargarProductos();
      mostrarNotificacion('Clasificación guardada para todos los productos', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo guardar toda la clasificación', 'error');
    } finally {
      setGuardandoClasificacionMasiva(false);
      setGuardandoClasificacion('');
    }
  }

  async function cambiarOfertaRapida(producto, marcado) {
    const recetaNombre = String(producto?.nombre_receta || '').trim();
    if (!recetaNombre) return;
    setGuardandoClasificacion(recetaNombre);
    try {
      await fetchAdmin('/tienda/catalogo/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receta_nombre: recetaNombre,
          es_oferta: Boolean(marcado)
        })
      });
      setProductos((prev) => prev.map((item) => (
        item.nombre_receta === recetaNombre
          ? { ...item, es_oferta: Boolean(marcado) }
          : item
      )));
      mostrarNotificacion(`Producto ${marcado ? 'marcado' : 'desmarcado'} como oferta`, 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo actualizar el producto', 'error');
    } finally {
      setGuardandoClasificacion('');
    }
  }

  async function cambiarVisibilidadPublica(producto, marcado) {
    const recetaNombre = String(producto?.nombre_receta || '').trim();
    if (!recetaNombre) return;
    setGuardandoClasificacion(recetaNombre);
    try {
      const variantes = normalizarVariantes(producto?.variantes);
      const recetasObjetivo = Array.from(new Set(
        (variantes.length
          ? variantes.map((v) => String(v?.receta_nombre || '').trim()).filter(Boolean)
          : [recetaNombre])
      ));

      await Promise.all(recetasObjetivo.map((nombre) => fetchAdmin('/tienda/catalogo/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receta_nombre: nombre,
          activo: Boolean(marcado)
        })
      })));

      setProductos((prev) => prev.map((item) => (
        item.nombre_receta === recetaNombre
          ? { ...item, visible_publico: Boolean(marcado) }
          : item
      )));
      mostrarNotificacion(`Producto ${marcado ? 'visible' : 'oculto'} para público`, 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo actualizar visibilidad', 'error');
    } finally {
      setGuardandoClasificacion('');
    }
  }

  function toggleClasificacionProducto(recetaNombre, campo) {
    setProductos((prev) => prev.map((item) => {
      if (item.nombre_receta !== recetaNombre) return item;
      return { ...item, [campo]: !Boolean(item?.[campo]) };
    }));
  }

  async function cargarMisOrdenes(token = clienteToken) {
    if (!token) return;
    try {
      const data = await fetchJson('/tienda/ordenes/mis', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrdenes(Array.isArray(data) ? data : []);
    } catch {
      setOrdenes([]);
    }
  }

  function abrirDetalle(producto) {
    const variantes = normalizarVariantes(producto?.variantes);
    const primeraDisponible = variantes.find((v) => Boolean(v?.disponible)) || variantes[0] || null;
    const galeria = Array.isArray(producto?.galeria) ? producto.galeria.map((item) => String(item || '').trim()).filter(Boolean) : [];
    const imagenActiva = String(producto?.image_url || galeria[0] || '').trim();
    setSeleccionado({
      ...producto,
      variantes,
      variante_activa: primeraDisponible?.nombre || '',
      galeria,
      imagen_activa: imagenActiva
    });
    setVistaActiva('detalle');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function seleccionarVarianteDetalle(nombreVariante) {
    setSeleccionado((prev) => {
      if (!prev) return prev;
      return { ...prev, variante_activa: nombreVariante };
    });
  }

  function seleccionarImagenDetalle(url) {
    setSeleccionado((prev) => {
      if (!prev) return prev;
      return { ...prev, imagen_activa: String(url || '').trim() };
    });
  }

  function agregarAlCarrito(producto, variante = '') {
    const variantes = normalizarVariantes(producto?.variantes);
    const varianteEncontrada = variantes.find((v) => v.nombre === variante) || null;
    const recetaReal = String(varianteEncontrada?.receta_nombre || producto?.nombre_receta || '').trim();

    const precioUnitario = precioVariante(producto, varianteEncontrada);
    const clave = `${producto?.slug || producto?.nombre_receta}::${variante}::${recetaReal}`;

    setCarrito((prev) => {
      const idx = prev.findIndex((item) => item.clave === clave);
      if (idx >= 0) {
        const copia = [...prev];
        const nuevo = { ...copia[idx] };
        nuevo.cantidad += 1;
        nuevo.subtotal = nuevo.cantidad * nuevo.precio_unitario;
        copia[idx] = nuevo;
        return copia;
      }
      return [
        ...prev,
        {
          clave,
          nombre_receta: recetaReal,
          nombre_base: producto?.nombre_receta,
          slug: producto?.slug,
          variante,
          cantidad: 1,
          precio_unitario: precioUnitario,
          subtotal: precioUnitario
        }
      ];
    });

    mostrarNotificacion('Producto agregado al carrito', 'exito');
    setMostrarCarrito(true);
  }

  function actualizarCantidad(clave, cantidadNueva) {
    const cantidad = Math.max(1, Number(cantidadNueva) || 1);
    setCarrito((prev) => prev.map((item) => (
      item.clave === clave
        ? { ...item, cantidad, subtotal: cantidad * item.precio_unitario }
        : item
    )));
  }

  function eliminarDelCarrito(clave) {
    setCarrito((prev) => prev.filter((item) => item.clave !== clave));
  }

  async function enviarAuth(event) {
    event.preventDefault();
    const endpoint = modoAuth === 'login' ? '/tienda/auth/login' : '/tienda/auth/register';

    try {
      if (modoAuth === 'register' && String(credenciales.password || '') !== String(credenciales.confirmarPassword || '')) {
        throw new Error('La confirmación de contraseña no coincide');
      }

      const body = modoAuth === 'login'
        ? { email: credenciales.email, password: credenciales.password }
        : {
            nombre: credenciales.nombre,
            email: credenciales.email,
            password: credenciales.password,
            telefono: credenciales.telefono
          };

      const data = await fetchJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const token = String(data?.token || '');
      if (!token) throw new Error('No se recibió token de cliente');

      localStorage.setItem(CLAVE_TOKEN_CLIENTE, token);
      setClienteToken(token);
      setCredenciales({ nombre: '', email: '', password: '', confirmarPassword: '', telefono: '' });
      setPasoRegistro(1);
      setMostrarModalAuthCliente(false);
      mostrarNotificacion(modoAuth === 'login' ? 'Sesión iniciada' : 'Cuenta creada', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo autenticar', 'error');
    }
  }

  async function guardarPerfil() {
    if (!clienteToken) return;
    try {
      const data = await fetchJson('/tienda/auth/perfil', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clienteToken}`
        },
        body: JSON.stringify(perfil)
      });
      setCliente(data?.cliente || null);
      mostrarNotificacion('Perfil guardado', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo guardar el perfil', 'error');
    }
  }

  function cerrarSesionCliente() {
    localStorage.removeItem(CLAVE_TOKEN_CLIENTE);
    setClienteToken('');
    setCliente(null);
  }

  async function crearOrden() {
    if (!clienteToken) {
      mostrarNotificacion('Inicia sesión para finalizar compra', 'error');
      return;
    }
    if (!carrito.length) {
      mostrarNotificacion('Tu carrito está vacío', 'error');
      return;
    }

    try {
      const data = await fetchJson('/tienda/ordenes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clienteToken}`
        },
        body: JSON.stringify({
          items: carrito.map((item) => ({
            nombre_receta: item.nombre_receta,
            cantidad: item.cantidad,
            variante: item.variante || ''
          })),
          metodo_pago: checkout.metodo_pago,
          id_punto_entrega: Number(checkout.id_punto_entrega) || 0,
          notas: checkout.notas
        })
      });

      const orden = data?.orden;
      if (!orden) throw new Error('No se pudo crear la orden');

      setCarrito([]);
      await cargarMisOrdenes();
      await cargarProductos();

      if (data?.checkout?.init_point) {
        window.open(data.checkout.init_point, '_blank', 'noopener,noreferrer');
        mostrarNotificacion(`Orden ${orden.folio} creada. Abriendo Mercado Pago...`, 'exito');
        return;
      }

      if (data?.checkout?.error) {
        mostrarNotificacion(`Orden ${orden.folio} creada. ${data.checkout.error}`, 'error');
        return;
      }

      mostrarNotificacion(`Orden ${orden.folio} creada correctamente`, 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo crear la orden', 'error');
    }
  }

  return (
    <div>
      <div className="tiendaPromoBar">
        {configTienda.promo_texto}
      </div>

      <div className="tiendaMainHeader">
        <div className="tiendaBrand">CHIPACTLI SHOP</div>
        <div className="tiendaHeaderAcciones">
          <input
            className="cajaBusqueda"
            placeholder="🔍 Buscar producto..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
          {!clienteToken ? (
            <>
              <button className="boton" onClick={() => { setModoAuth('login'); setMostrarModalAuthCliente(true); }}>Iniciar sesión</button>
              <button className="boton botonExito" onClick={() => { setModoAuth('register'); setPasoRegistro(1); setMostrarModalAuthCliente(true); }}>Registrarme</button>
            </>
          ) : (
            <>
              <button className="boton" onClick={() => setMostrarModalPerfilCliente(true)}>Mi perfil</button>
              <button className="boton" onClick={cerrarSesionCliente}>Salir cliente</button>
            </>
          )}
          <button className="tiendaCartBtn" onClick={() => setMostrarCarrito(true)}>
            🛒
            <span className="tiendaCartCount">{carrito.length}</span>
          </button>
        </div>
      </div>

      <div className="tiendaCategoriasBar">
        <button className={vistaActiva === 'tienda' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setVistaActiva('tienda')}>Productos</button>
        <button className={seccionActiva === 'lanzamientos' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setSeccionActiva('lanzamientos')}>Lanzamientos</button>
        <button className={seccionActiva === 'favoritos' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setSeccionActiva('favoritos')}>Favoritos</button>
        <button className={seccionActiva === 'ofertas' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setSeccionActiva('ofertas')}>Ofertas</button>
        <button className={seccionActiva === 'accesorios' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setSeccionActiva('accesorios')}>Accesorios</button>
        <button className={seccionActiva === 'todos' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setSeccionActiva('todos')}>Todos</button>
        <select className="tiendaCategoriaSelect" value={categoriaActiva} onChange={(e) => setCategoriaActiva(e.target.value)}>
          <option value="todas">Todas las categorías</option>
          {categoriasDisponibles.map((categoria) => (
            <option key={categoria} value={categoria.toLowerCase()}>{categoria}</option>
          ))}
        </select>
        {tokenInterno && (
          <button className={vistaActiva === 'trastienda' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setVistaActiva('trastienda')}>Trastienda</button>
        )}
        {vistaActiva === 'info' && (
          <button className="tiendaTab activa" onClick={() => setVistaActiva('info')}>
            {infoSeleccionada?.titulo || 'Información'}
          </button>
        )}
        {vistaActiva === 'detalle' && seleccionado && (
          <button className="tiendaTab activa" onClick={() => setVistaActiva('detalle')}>
            {seleccionado?.nombre_receta || 'Detalle'}
          </button>
        )}
      </div>

      <div className="tiendaGrid">
      {vistaActiva === 'tienda' && (
      <section className="tarjeta tiendaCatalogo">
        <div className="tiendaHeader">
          <h2>Tienda de productos</h2>
        </div>

        {cargando ? (
          <div className="tiendaVacio">Cargando productos...</div>
        ) : (
          <div className="tiendaProductos">
            {productosFiltrados.map((producto) => {
              const variantes = normalizarVariantes(producto?.variantes);
              const varianteActiva = variantes.find((v) => Boolean(v?.disponible)) || variantes[0] || null;
              const disponible = varianteActiva ? Boolean(varianteActiva?.disponible) : ((Number(producto?.stock) || 0) > 0);
              const precioActual = varianteActiva ? precioVariante(producto, varianteActiva) : (Number(producto?.precio_venta) || 0);
              return (
                <article key={producto.slug || producto.nombre_receta} className="tiendaProductoCard">
                  <div className="tiendaImagenWrap">
                    {producto?.image_url ? (
                      <img src={producto.image_url} alt={producto.nombre_receta} className="tiendaImagen" />
                    ) : (
                      <div className="tiendaImagenPlaceholder">Sin imagen</div>
                    )}
                  </div>
                  <h3>{producto.nombre_receta}</h3>
                  {!!variantes.length && (
                    <div className="tiendaVariantes tiendaVariantesCard">
                      {variantes.map((v) => (
                        <span key={`${producto.nombre_receta}-${v.nombre}`} className="tiendaChipVariante">{v.nombre}</span>
                      ))}
                    </div>
                  )}
                  {String(producto.descripcion || '').trim() && (
                    <p className="tiendaDescripcion">{producto.descripcion}</p>
                  )}
                  <div className="tiendaMeta">
                    <span>{precioActual > 0 ? precio(precioActual) : 'Próximamente'}</span>
                    <span>
                      {tokenInterno
                        ? (disponible ? `Stock: ${producto.stock}` : 'Sin stock')
                        : (disponible ? 'Disponible' : 'Sobre pedido')}
                    </span>
                  </div>
                  {Boolean(tokenInterno) && (
                    <>
                      <div className={disponible ? 'tiendaEstadoActivo' : 'tiendaEstadoInactivo'}>
                        {disponible ? 'Activo para venta' : 'Pendiente de producción'}
                      </div>
                      <label className="tiendaSwitchCard tiendaSwitchToggle">
                        <input
                          type="checkbox"
                          checked={Boolean(producto?.visible_publico)}
                          disabled={guardandoClasificacion === producto.nombre_receta}
                          onChange={(e) => cambiarVisibilidadPublica(producto, e.target.checked)}
                        />
                        <span className="tiendaSwitchSlider"></span>
                        Visible al público
                      </label>
                    </>
                  )}
                  <div className="tiendaAccionesCard">
                    <button className="boton" onClick={() => abrirDetalle(producto)}>Ver detalle</button>
                    <button
                      className="boton botonExito"
                      onClick={() => agregarAlCarrito(producto, varianteActiva?.nombre || '')}
                    >
                      {disponible ? 'Agregar' : 'Agregar (sobre pedido)'}
                    </button>
                  </div>
                </article>
              );
            })}
            {!productosFiltrados.length && <div className="tiendaVacio">No hay productos disponibles.</div>}
          </div>
        )}
      </section>
      )}

      <section className={`tarjeta tiendaLateral ${mostrarCarrito ? 'abierta' : ''}`}>
        <div className="tiendaLateralHeader">
        <h2>Mi carrito</h2>
          <button className="boton" onClick={() => setMostrarCarrito(false)}>Cerrar</button>
        </div>
        <div className="tiendaCarritoLista">
          {carrito.map((item) => (
            <div key={item.clave} className="tiendaCarritoItem">
              <div>
                <strong>{item.nombre_base || item.nombre_receta}</strong>
                {item.variante ? <small> · {item.variante}</small> : null}
              </div>
              <div className="tiendaCarritoControles">
                <input
                  type="number"
                  min="1"
                  value={item.cantidad}
                  onChange={(e) => actualizarCantidad(item.clave, e.target.value)}
                />
                <span>{precio(item.subtotal)}</span>
                <button className="botonPequeno botonDanger" onClick={() => eliminarDelCarrito(item.clave)}>✕</button>
              </div>
            </div>
          ))}
          {!carrito.length && <div className="tiendaVacio">Aún no agregas productos.</div>}
        </div>

        <div className="tiendaCheckout">
          <div className="tiendaTotal">Total: {precio(totalCarrito)}</div>
          <select value={checkout.metodo_pago} onChange={(e) => setCheckout((p) => ({ ...p, metodo_pago: e.target.value }))}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta terminal</option>
            <option value="mercado_pago">Mercado Pago</option>
          </select>
          <select
            value={checkout.id_punto_entrega}
            onChange={(e) => setCheckout((p) => ({ ...p, id_punto_entrega: e.target.value }))}
          >
            <option value="">Selecciona punto de entrega</option>
            {puntosEntrega.map((punto) => (
              <option key={punto.id} value={punto.id}>{punto.nombre}{punto.direccion ? ` · ${punto.direccion}` : ''}</option>
            ))}
          </select>
          <textarea
            placeholder="Notas del pedido"
            value={checkout.notas}
            onChange={(e) => setCheckout((p) => ({ ...p, notas: e.target.value }))}
            rows={2}
          />
          <button className="boton botonExito" onClick={crearOrden}>Finalizar compra</button>
        </div>
      </section>

      {vistaActiva === 'trastienda' && tokenInterno && (
        <section className="tarjeta tiendaCatalogo">
          <div className="tiendaAdminPanel">
            <h3>Panel interno tienda</h3>

            <form className="tiendaAdminForm" onSubmit={crearPuntoEntregaAdmin}>
              <strong>Puntos de entrega</strong>
              <input
                placeholder="Nombre del punto"
                value={nuevoPunto.nombre}
                onChange={(e) => setNuevoPunto((p) => ({ ...p, nombre: e.target.value }))}
                required
              />
              <input
                placeholder="Dirección"
                value={nuevoPunto.direccion}
                onChange={(e) => setNuevoPunto((p) => ({ ...p, direccion: e.target.value }))}
              />
              <input
                placeholder="Horario"
                value={nuevoPunto.horario}
                onChange={(e) => setNuevoPunto((p) => ({ ...p, horario: e.target.value }))}
              />
              <button className="boton botonExito" type="submit">Agregar punto</button>
              <div className="tiendaAdminListado">
                {adminPuntos.map((punto) => (
                  <div key={punto.id} className="tiendaAdminFila">
                    <div className="tiendaAdminPuntoCampos">
                      <input value={punto.nombre || ''} onChange={(e) => editarCampoPunto(punto.id, 'nombre', e.target.value)} />
                      <input value={punto.direccion || ''} onChange={(e) => editarCampoPunto(punto.id, 'direccion', e.target.value)} />
                      <input value={punto.horario || ''} onChange={(e) => editarCampoPunto(punto.id, 'horario', e.target.value)} />
                    </div>
                    <div className="tiendaAdminPuntoAcciones">
                      <button className="botonPequeno" type="button" onClick={() => guardarPuntoAdmin(punto.id)}>Guardar</button>
                      <button className="botonPequeno" type="button" onClick={() => cambiarEstadoPunto(punto.id, Number(punto.activo) ? 0 : 1)}>
                        {Number(punto.activo) ? 'Desactivar' : 'Activar'}
                      </button>
                      <button className="botonPequeno botonDanger" type="button" onClick={() => eliminarPuntoAdmin(punto.id)}>Eliminar</button>
                    </div>
                  </div>
                ))}
                {!adminPuntos.length && <div className="tiendaVacio">Sin puntos registrados</div>}
              </div>
            </form>

            <div className="tiendaAdminForm">
              <strong>Configuración tienda y atención</strong>
              <input
                placeholder="Texto promoción superior"
                value={configTiendaAdmin.promo_texto || ''}
                onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, promo_texto: e.target.value }))}
              />
              <input
                placeholder="Título marca footer"
                value={configTiendaAdmin.footer_marca_titulo || ''}
                onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, footer_marca_titulo: e.target.value }))}
              />
              <textarea
                placeholder="Texto marca footer"
                value={configTiendaAdmin.footer_marca_texto || ''}
                onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, footer_marca_texto: e.target.value }))}
                rows={2}
              />
              <input
                placeholder="Horario lunes a sábado"
                value={configTiendaAdmin.atencion_horario_lunes_sabado || ''}
                onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, atencion_horario_lunes_sabado: e.target.value }))}
              />
              <input
                placeholder="Horario domingo"
                value={configTiendaAdmin.atencion_horario_domingo || ''}
                onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, atencion_horario_domingo: e.target.value }))}
              />
              <input
                placeholder="Teléfono atención"
                value={configTiendaAdmin.atencion_telefono || ''}
                onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, atencion_telefono: e.target.value }))}
              />
              <input
                placeholder="Correo atención"
                value={configTiendaAdmin.atencion_correo || ''}
                onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, atencion_correo: e.target.value }))}
              />
              <input
                placeholder="WhatsApp (solo números, ej 5212220001111)"
                value={configTiendaAdmin.whatsapp_numero || ''}
                onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, whatsapp_numero: e.target.value }))}
              />
              <input
                placeholder="Texto métodos de pago footer"
                value={configTiendaAdmin.footer_pagos_texto || ''}
                onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, footer_pagos_texto: e.target.value }))}
              />

              <strong>Links de Información (editar/ocultar)</strong>
              <div className="tiendaAdminFila tiendaAdminFilaCatalogo">
                <label className="tiendaSwitchPendientes">
                  <input
                    type="checkbox"
                    checked={configActivo(configTiendaAdmin.info_link_1_activo, true)}
                    onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_1_activo: e.target.checked ? '1' : '0' }))}
                  />
                  Mostrar
                </label>
                <input
                  placeholder="Texto link 1"
                  value={configTiendaAdmin.info_link_1_label || ''}
                  onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_1_label: e.target.value }))}
                />
                <input
                  placeholder="URL link 1"
                  value={configTiendaAdmin.info_link_1_url || ''}
                  onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_1_url: e.target.value }))}
                />
                <textarea
                  placeholder="Texto de contenido link 1"
                  value={configTiendaAdmin.info_link_1_texto || ''}
                  onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_1_texto: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="tiendaAdminFila tiendaAdminFilaCatalogo">
                <label className="tiendaSwitchPendientes">
                  <input
                    type="checkbox"
                    checked={configActivo(configTiendaAdmin.info_link_2_activo, true)}
                    onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_2_activo: e.target.checked ? '1' : '0' }))}
                  />
                  Mostrar
                </label>
                <input
                  placeholder="Texto link 2"
                  value={configTiendaAdmin.info_link_2_label || ''}
                  onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_2_label: e.target.value }))}
                />
                <input
                  placeholder="URL link 2"
                  value={configTiendaAdmin.info_link_2_url || ''}
                  onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_2_url: e.target.value }))}
                />
                <textarea
                  placeholder="Texto de contenido link 2"
                  value={configTiendaAdmin.info_link_2_texto || ''}
                  onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_2_texto: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="tiendaAdminFila tiendaAdminFilaCatalogo">
                <label className="tiendaSwitchPendientes">
                  <input
                    type="checkbox"
                    checked={configActivo(configTiendaAdmin.info_link_3_activo, true)}
                    onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_3_activo: e.target.checked ? '1' : '0' }))}
                  />
                  Mostrar
                </label>
                <input
                  placeholder="Texto link 3"
                  value={configTiendaAdmin.info_link_3_label || ''}
                  onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_3_label: e.target.value }))}
                />
                <input
                  placeholder="URL link 3"
                  value={configTiendaAdmin.info_link_3_url || ''}
                  onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_3_url: e.target.value }))}
                />
                <textarea
                  placeholder="Texto de contenido link 3"
                  value={configTiendaAdmin.info_link_3_texto || ''}
                  onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_3_texto: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="tiendaAdminFila tiendaAdminFilaCatalogo">
                <label className="tiendaSwitchPendientes">
                  <input
                    type="checkbox"
                    checked={configActivo(configTiendaAdmin.info_link_4_activo, true)}
                    onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_4_activo: e.target.checked ? '1' : '0' }))}
                  />
                  Mostrar
                </label>
                <input
                  placeholder="Texto link 4"
                  value={configTiendaAdmin.info_link_4_label || ''}
                  onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_4_label: e.target.value }))}
                />
                <input
                  placeholder="URL link 4"
                  value={configTiendaAdmin.info_link_4_url || ''}
                  onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_4_url: e.target.value }))}
                />
                <textarea
                  placeholder="Texto de contenido link 4"
                  value={configTiendaAdmin.info_link_4_texto || ''}
                  onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_4_texto: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="tiendaAdminFila tiendaAdminFilaCatalogo">
                <label className="tiendaSwitchPendientes">
                  <input
                    type="checkbox"
                    checked={configActivo(configTiendaAdmin.info_link_5_activo, true)}
                    onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_5_activo: e.target.checked ? '1' : '0' }))}
                  />
                  Mostrar
                </label>
                <input
                  placeholder="Texto link 5"
                  value={configTiendaAdmin.info_link_5_label || ''}
                  onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_5_label: e.target.value }))}
                />
                <input
                  placeholder="URL link 5"
                  value={configTiendaAdmin.info_link_5_url || ''}
                  onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_5_url: e.target.value }))}
                />
                <textarea
                  placeholder="Texto de contenido link 5"
                  value={configTiendaAdmin.info_link_5_texto || ''}
                  onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, info_link_5_texto: e.target.value }))}
                  rows={3}
                />
              </div>

              <button className="boton botonExito" type="button" onClick={guardarConfigTiendaAdmin}>Guardar configuración</button>
            </div>

            <div className="tiendaAdminForm">
              <strong>Clasificación de productos (tienda)</strong>
              <div className="tiendaAdminPendientes">
                Cambios pendientes: <strong>{pendientesClasificacion}</strong>
              </div>
              <div className="tiendaAdminAccionesClasificacion">
                <label className="tiendaSwitchPendientes">
                  <input
                    type="checkbox"
                    checked={soloPendientesClasificacion}
                    onChange={(e) => setSoloPendientesClasificacion(e.target.checked)}
                  />
                  Solo pendientes
                </label>
                <button
                  className="boton botonExito"
                  type="button"
                  disabled={guardandoClasificacionMasiva || !productos.length}
                  onClick={guardarClasificacionTodos}
                >
                  {guardandoClasificacionMasiva ? 'Guardando todo...' : 'Guardar todo'}
                </button>
              </div>
              <div className="tiendaAdminListado tiendaAdminCatalogoClasificacion">
                {productosClasificacion.map((producto) => (
                  <div key={producto.slug || producto.nombre_receta} className="tiendaAdminFila tiendaAdminFilaCatalogo">
                    <div>
                      <strong>{producto.nombre_receta}</strong>
                      <div className="tiendaAdminSubtexto">{producto.categoria_nombre || 'Sin categoría'}</div>
                      {clasificacionCambio(
                        estadoClasificacion(producto),
                        clasificacionGuardada[String(producto?.nombre_receta || '').trim()] || {}
                      ) && <span className="tiendaBadgePendiente">Pendiente</span>}
                    </div>
                    <div className="tiendaAdminChecks">
                      <label><input type="checkbox" checked={Boolean(producto.es_lanzamiento)} onChange={() => toggleClasificacionProducto(producto.nombre_receta, 'es_lanzamiento')} /> Lanzamiento</label>
                      <label><input type="checkbox" checked={Boolean(producto.es_favorito)} onChange={() => toggleClasificacionProducto(producto.nombre_receta, 'es_favorito')} /> Favorito</label>
                      <label><input type="checkbox" checked={Boolean(producto.es_oferta)} onChange={() => toggleClasificacionProducto(producto.nombre_receta, 'es_oferta')} /> Oferta</label>
                      <label><input type="checkbox" checked={Boolean(producto.es_accesorio)} onChange={() => toggleClasificacionProducto(producto.nombre_receta, 'es_accesorio')} /> Accesorio</label>
                    </div>
                    <button
                      className="botonPequeno"
                      type="button"
                      disabled={guardandoClasificacionMasiva || guardandoClasificacion === producto.nombre_receta}
                      onClick={() => guardarClasificacionProducto(producto)}
                    >
                      {guardandoClasificacion === producto.nombre_receta ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                ))}
                {!productosClasificacion.length && <div className="tiendaVacio">No hay productos para clasificar con ese filtro</div>}
              </div>
            </div>

            <div className="tiendaAdminForm">
              <strong>Clientes registrados</strong>
              <div className="tiendaAdminListado">
                {adminClientes.map((c) => (
                  <div key={c.id} className="tiendaAdminFila"><span>{c.nombre} · {c.email}</span></div>
                ))}
                {!adminClientes.length && <div className="tiendaVacio">Sin clientes</div>}
              </div>
            </div>

            <div className="tiendaAdminForm">
              <strong>Pedidos tienda</strong>
              <div className="tiendaAdminListado">
                {adminOrdenes.map((o) => (
                  <div key={o.id} className="tiendaAdminFila">
                    <span>{o.folio} · {o.nombre_cliente} · {precio(o.total)} · {o.nombre_punto_entrega || '-'}</span>
                    <select
                      value={String(o.estado || 'pendiente')}
                      onChange={(e) => actualizarEstadoOrdenAdmin(o.id, e.target.value)}
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="procesando">Procesando</option>
                      <option value="entregado">Entregado</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                ))}
                {!adminOrdenes.length && <div className="tiendaVacio">Sin pedidos</div>}
              </div>
            </div>
          </div>
        </section>
      )}

      {vistaActiva === 'info' && (
        <section className="tarjeta tiendaCatalogo tiendaInfoTab">
          <div className="tiendaInfoTabHeader">
            <h2>{infoSeleccionada?.titulo || 'Información'}</h2>
            <button className="boton" onClick={() => setVistaActiva('tienda')}>Volver a productos</button>
          </div>
          <div className="tiendaInfoTabBody">
            {String(infoSeleccionada?.texto || '').trim()}
            {String(infoSeleccionada?.href || '').trim() && String(infoSeleccionada?.href || '').trim() !== '#' && (
              <div className="tiendaInfoTabLinkWrap">
                <a href={infoSeleccionada.href} target="_blank" rel="noreferrer">Abrir enlace relacionado</a>
              </div>
            )}
          </div>
        </section>
      )}

      {vistaActiva === 'detalle' && seleccionado && (
        <section className="tarjeta tiendaCatalogo tiendaDetalleTabWrap">
          {(() => {
            const variantes = normalizarVariantes(seleccionado?.variantes);
            const varianteActiva = variantes.find((v) => v.nombre === seleccionado?.variante_activa)
              || variantes.find((v) => Boolean(v?.disponible))
              || variantes[0]
              || null;
            const variantesConPrecio = variantes.map((v) => ({
              ...v,
              precio_publico: Number(v?.precio_venta) > 0 ? Number(v.precio_venta) : precioVariante(seleccionado, v),
              precio_lista: Number(v?.precio_lista ?? v?.precio_regular ?? v?.precio_anterior ?? 0) || 0
            }));
            const precioActivo = precioVariante(seleccionado, varianteActiva);
            const precioListaActivo = Number(varianteActiva?.precio_lista ?? varianteActiva?.precio_regular ?? varianteActiva?.precio_anterior ?? 0) || 0;
            const stockActivo = varianteActiva ? (Number(varianteActiva.stock) || 0) : (Number(seleccionado?.stock) || 0);
            const disponibleActivo = stockActivo > 0;

            return (
              <>
                <div className="encabezadoModal tiendaDetalleHeaderFijo">
                  <div>
                    <h3>{seleccionado.nombre_receta}</h3>
                    <div className="tiendaDetallePresentacionActiva">{seleccionado.nombre_receta}</div>
                  </div>
                  <button className="boton" onClick={() => setVistaActiva('tienda')}>Volver a productos</button>
                </div>
                <div className="tiendaDetalleLayout">
                  <div className="tiendaDetalleLateralImagen">
                    <div className="tiendaDetalleColImagen">
                      {String(seleccionado?.imagen_activa || '').trim() ? (
                        <img src={seleccionado.imagen_activa} alt={seleccionado.nombre_receta} />
                      ) : (
                        <div className="tiendaImagenPlaceholder">Sin imagen</div>
                      )}
                    </div>
                    {!!(Array.isArray(seleccionado?.galeria) && seleccionado.galeria.length) && (
                      <div className="tiendaDetalleGaleriaMini">
                        {seleccionado.galeria.map((url, idx) => (
                          <button
                            key={`img-mini-${idx}`}
                            className={String(url) === String(seleccionado?.imagen_activa || '') ? 'tiendaMiniImg activa' : 'tiendaMiniImg'}
                            onClick={() => seleccionarImagenDetalle(url)}
                          >
                            <img src={url} alt={`Vista ${idx + 1}`} />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="tiendaDetalleDescripcionDebajo">
                      <strong>Descripción</strong>
                      <p>{seleccionado.descripcion || 'Sin descripción todavía.'}</p>
                    </div>
                  </div>
                  <div className="tiendaDetalleColInfo">
                    {!!variantesConPrecio.length && (
                      <div className="tiendaDetallePresentaciones">
                        <div className="tiendaDetallePresentacionesTitulo">Presentación</div>
                        <div className="tiendaDetallePresentacionesGrid">
                          {variantesConPrecio.map((v) => (
                            <button
                              key={`pres-${seleccionado.nombre_receta}-${v.nombre}`}
                              type="button"
                              className={v.nombre === varianteActiva?.nombre ? 'tiendaPresentacionCard activa' : 'tiendaPresentacionCard'}
                              onClick={() => seleccionarVarianteDetalle(v.nombre)}
                            >
                              <span className="tiendaPresentacionNombre">{v.nombre}</span>
                              <span className="tiendaPresentacionPrecio">{precio(v.precio_publico)}</span>
                              {v.precio_lista > v.precio_publico && (
                                <span className="tiendaPresentacionPrecioAnterior">{precio(v.precio_lista)}</span>
                              )}
                              <span className={v.disponible ? 'tiendaPresentacionEstado' : 'tiendaPresentacionEstado agotado'}>
                                {v.disponible ? 'Disponible' : 'Sin stock'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="tiendaDetalleResumen">
                      <p><strong>Precio:</strong> {precio(precioActivo)}</p>
                      {precioListaActivo > precioActivo && <p><strong>Antes:</strong> <span className="tiendaPrecioAnteriorResumen">{precio(precioListaActivo)}</span></p>}
                      {tokenInterno && <p><strong>Stock:</strong> {stockActivo}</p>}
                    </div>
                    <div className="tiendaDetalleTabs">
                      <div className="tiendaDetalleTabItem">
                        <strong>Modo de uso</strong>
                        <p>{String(seleccionado.modo_uso || '').trim() || 'Sin modo de uso todavía.'}</p>
                      </div>
                      <div className="tiendaDetalleTabItem">
                        <strong>Cuidados</strong>
                        <p>{String(seleccionado.cuidados || '').trim() || 'Sin cuidados registrados.'}</p>
                      </div>
                      <div className="tiendaDetalleTabItem">
                        <strong>Ingredientes</strong>
                        <ul>
                          {(Array.isArray(seleccionado.ingredientes) ? seleccionado.ingredientes : []).map((ing, idx) => (
                            <li key={`${ing}-${idx}`}>{String(ing)}</li>
                          ))}
                          {!Array.isArray(seleccionado.ingredientes) || !seleccionado.ingredientes.length ? <li>Sin ingredientes registrados.</li> : null}
                        </ul>
                      </div>
                    </div>
                    <div>
                      <div className="tiendaVariantes tiendaVariantesDetalle">
                        <button
                          className="boton botonExito"
                          onClick={() => agregarAlCarrito(seleccionado, varianteActiva?.nombre || '')}
                        >
                          {disponibleActivo ? 'Agregar al carrito' : 'Agregar al carrito (sobre pedido)'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </section>
      )}

      </div>

      {mostrarCarrito && <div className="tiendaOverlay" onClick={() => setMostrarCarrito(false)}></div>}

      {mostrarModalPerfilCliente && clienteToken && (
        <div className="modal" style={{ display: 'flex' }} onClick={() => setMostrarModalPerfilCliente(false)}>
          <div className="contenidoModal tiendaAuthModal" onClick={(e) => e.stopPropagation()}>
            <div className="encabezadoModal">
              <h3>Perfil del cliente</h3>
              <button className="cerrarModal" onClick={() => setMostrarModalPerfilCliente(false)}>&times;</button>
            </div>
            <div className="tiendaPerfil">
              <input
                placeholder="Nombre"
                value={perfil.nombre}
                onChange={(e) => setPerfil((p) => ({ ...p, nombre: e.target.value }))}
              />
              <input
                placeholder="Teléfono"
                value={perfil.telefono}
                onChange={(e) => setPerfil((p) => ({ ...p, telefono: e.target.value }))}
              />
              <select
                value={perfil.forma_pago_preferida}
                onChange={(e) => setPerfil((p) => ({ ...p, forma_pago_preferida: e.target.value }))}
              >
                <option value="">Forma de pago preferida</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta terminal</option>
                <option value="mercado_pago">Mercado Pago</option>
              </select>
              <div className="tiendaPerfilAcciones">
                <button className="boton botonExito" type="button" onClick={guardarPerfil}>Guardar perfil</button>
                <button className="boton botonDanger" type="button" onClick={cerrarSesionCliente}>Cerrar sesión</button>
              </div>

              <h3>Mis órdenes</h3>
              <div className="tiendaOrdenes">
                {ordenes.map((orden) => (
                  <div key={orden.id} className="tiendaOrdenItem">
                    <strong>{orden.folio}</strong>
                    <span>{orden.metodo_pago}</span>
                    <span>{precio(orden.total)}</span>
                    <span>{orden.estado}</span>
                  </div>
                ))}
                {!ordenes.length && <div className="tiendaVacio">Aún no tienes órdenes.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrarModalAuthCliente && (
        <div className="modal" style={{ display: 'flex' }} onClick={() => setMostrarModalAuthCliente(false)}>
          <div className="contenidoModal tiendaAuthModal tiendaAuthModalLogin" onClick={(e) => e.stopPropagation()}>
            <div className="tiendaAuthHeader">
              <button className="cerrarModal tiendaAuthCerrar" onClick={() => setMostrarModalAuthCliente(false)}>&times;</button>
              <img className="tiendaAuthLogo" src="/images/logo.png" alt="CHIPACTLI" />
              <h3 className="tiendaAuthTitulo">CHIPACTLI</h3>
              <p className="tiendaAuthSubtitulo">{modoAuth === 'login' ? 'Iniciar sesión cliente' : 'Registro de cliente'}</p>
            </div>
            <form className="tiendaAuth" onSubmit={enviarAuth}>
              {modoAuth === 'login' ? (
                <>
                  <input
                    type="email"
                    placeholder="Correo"
                    value={credenciales.email}
                    onChange={(e) => setCredenciales((p) => ({ ...p, email: e.target.value }))}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Contraseña"
                    value={credenciales.password}
                    onChange={(e) => setCredenciales((p) => ({ ...p, password: e.target.value }))}
                    required
                  />
                </>
              ) : (
                <>
                  <div className="tiendaRegistroPasos">Paso {pasoRegistro} de 3</div>
                  {pasoRegistro === 1 && (
                    <>
                      <input
                        placeholder="Nombre completo"
                        value={credenciales.nombre}
                        onChange={(e) => setCredenciales((p) => ({ ...p, nombre: e.target.value }))}
                        required
                      />
                      <input
                        placeholder="Teléfono"
                        value={credenciales.telefono}
                        onChange={(e) => setCredenciales((p) => ({ ...p, telefono: e.target.value }))}
                      />
                    </>
                  )}
                  {pasoRegistro === 2 && (
                    <input
                      type="email"
                      placeholder="Correo"
                      value={credenciales.email}
                      onChange={(e) => setCredenciales((p) => ({ ...p, email: e.target.value }))}
                      required
                    />
                  )}
                  {pasoRegistro === 3 && (
                    <>
                      <input
                        type="password"
                        placeholder="Contraseña"
                        value={credenciales.password}
                        onChange={(e) => setCredenciales((p) => ({ ...p, password: e.target.value }))}
                        required
                      />
                      <input
                        type="password"
                        placeholder="Confirmar contraseña"
                        value={credenciales.confirmarPassword}
                        onChange={(e) => setCredenciales((p) => ({ ...p, confirmarPassword: e.target.value }))}
                        required
                      />
                    </>
                  )}
                </>
              )}

              {modoAuth === 'login' ? (
                <div className="tiendaAuthAcciones tiendaAuthAccionesLogin">
                  <button className="boton botonExito" type="submit">Entrar</button>
                  <button
                    className="boton"
                    type="button"
                    onClick={() => {
                      setModoAuth('register');
                      setPasoRegistro(1);
                    }}
                  >
                    Crear cuenta nueva
                  </button>
                </div>
              ) : (
                <div className="tiendaAuthAcciones tiendaAuthAccionesRegistro">
                  {pasoRegistro > 1 && (
                    <button type="button" className="boton" onClick={() => setPasoRegistro((p) => Math.max(1, p - 1))}>Atrás</button>
                  )}
                  {pasoRegistro < 3 ? (
                    <button type="button" className="boton botonExito" onClick={() => setPasoRegistro((p) => Math.min(3, p + 1))}>Siguiente</button>
                  ) : (
                    <button className="boton botonExito" type="submit">Completar registro</button>
                  )}
                  <button
                    className="boton"
                    type="button"
                    onClick={() => {
                      setModoAuth('login');
                      setPasoRegistro(1);
                    }}
                  >
                    Ya tengo cuenta
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      <footer className="tiendaFooter">
        <div className="tiendaFooterCol">
          <h4>{configTienda.footer_marca_titulo}</h4>
          <p>{configTienda.footer_marca_texto}</p>
        </div>
        <div className="tiendaFooterCol">
          <h4>Atención al cliente</h4>
          <p><strong>Lunes a sábado:</strong> {configTienda.atencion_horario_lunes_sabado}</p>
          <p><strong>Domingo:</strong> {configTienda.atencion_horario_domingo}</p>
          <p>{configTienda.atencion_telefono}</p>
          <p>{configTienda.atencion_correo}</p>
          {String(configTienda.whatsapp_numero || '').trim() && (
            <a
              href={`https://wa.me/${String(configTienda.whatsapp_numero).replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="tiendaWhatsBtn"
            >
              WhatsApp directo
            </a>
          )}
        </div>
        <div className="tiendaFooterCol">
          <h4>Información</h4>
          {linksInformacion.map((item) => (
            <button
              key={`${item.label}-${item.href}`}
              type="button"
              className="tiendaFooterInfoBtn"
              onClick={() => abrirLinkInformacion(item)}
            >
              {item.label}
            </button>
          ))}
          <div className="tiendaFooterPagos">{configTienda.footer_pagos_texto}</div>
        </div>
      </footer>
    </div>
  );
}
