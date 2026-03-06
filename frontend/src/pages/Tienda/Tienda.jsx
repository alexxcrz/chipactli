import React, { useEffect, useMemo, useRef, useState } from 'react';
import './Tienda.css';
import { API } from '../../utils/config.jsx';
import { mostrarNotificacion } from '../../utils/notificaciones.jsx';
import { mostrarConfirmacion } from '../../utils/modales.jsx';
import PasswordInput from '../../components/PasswordInput.jsx';

const API_TIENDA = import.meta.env.DEV
  ? (import.meta.env.VITE_BACKEND_URL || '')
  : API;

const CLAVE_TOKEN_CLIENTE = 'tienda_cliente_token';
const CLAVE_CARRITO_TIENDA = 'tienda_carrito_v2';
const EXPIRACION_CARRITO_INVITADO_MS = 24 * 60 * 60 * 1000;
const SECCIONES_INFO_LINKS = [
  { idx: 2, titulo: 'Nosotros' },
  { idx: 4, titulo: 'Términos y condiciones' },
  { idx: 5, titulo: 'Aviso de privacidad' }
];
const CONFIG_DEFAULT = {
  promo_texto: '💖 ¡Últimas horas! Llévate productos favoritos con promoción especial.',
  footer_marca_titulo: 'CHIPACTLI',
  footer_marca_texto: 'Formulamos productos artesanales para el cuidado personal de forma segura y consciente.',
  atencion_horario_lunes_viernes: '09:00 a.m. - 06:00 p.m.',
  atencion_horario_sabado: '09:00 a.m. - 02:00 p.m.',
  atencion_horario_lunes_sabado: '09:00 a.m. - 09:00 p.m.',
  atencion_horario_domingo: '08:00 a.m. - 12:00 p.m.',
  atencion_correo: 'atc@chipactli.mx',
  whatsapp_numero: '',
  social_facebook_url: '',
  social_facebook_activo: '0',
  social_instagram_url: '',
  social_instagram_activo: '0',
  social_tiktok_url: '',
  social_tiktok_activo: '0',
  social_youtube_url: '',
  social_youtube_activo: '0',
  social_x_url: '',
  social_x_activo: '0',
  social_linkedin_url: '',
  social_linkedin_activo: '0',
  footer_pagos_texto: 'VISA · MasterCard · PayPal · AMEX · OXXO',
  menu_todos_activo: '1',
  menu_lanzamientos_activo: '1',
  menu_favoritos_activo: '1',
  menu_ofertas_activo: '1',
  menu_accesorios_activo: '1',
  menu_categoria_activo: '1',
  info_link_1_label: '',
  info_link_1_url: '#',
  info_link_1_texto: '',
  info_link_1_activo: '0',
  info_link_2_label: 'Nosotros',
  info_link_2_url: '#',
  info_link_2_texto: 'Somos CHIPACTLI, una marca enfocada en el cuidado personal artesanal y consciente.',
  info_link_2_activo: '1',
  info_link_3_label: '',
  info_link_3_url: '#',
  info_link_3_texto: '',
  info_link_3_activo: '0',
  info_link_4_label: 'Términos y condiciones',
  info_link_4_url: '#',
  info_link_4_texto: 'Consulta aquí nuestros términos y condiciones de compra y uso del sitio.',
  info_link_4_activo: '1',
  info_link_5_label: 'Aviso de privacidad',
  info_link_5_url: '#',
  info_link_5_texto: 'Conoce cómo recopilamos, usamos y protegemos tus datos personales en CHIPACTLI.',
  info_link_5_activo: '1'
};

const PUNTO_ENTREGA_DEFAULT = { nombre: '', direccion: '', horario: '', activo: true };

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

function SwitchConTexto({ checked, onChange, label, ariaLabel }) {
  return (
    <label className="tiendaSwitchCard tiendaSwitchToggle tiendaSwitchConTexto">
      <input type="checkbox" checked={Boolean(checked)} onChange={onChange} aria-label={ariaLabel || label} />
      <span className="tiendaSwitchSlider" />
      <span>{label}</span>
    </label>
  );
}

function pintarHojitas(calificacion = 0) {
  const valor = Math.max(0, Math.min(5, Number(calificacion) || 0));
  return Array.from({ length: 5 }).map((_, idx) => idx < Math.round(valor));
}

function cargarCarritoGuardado(esCliente) {
  if (typeof window === 'undefined') {
    return { items: [], creadoEn: Date.now() };
  }

  try {
    const raw = localStorage.getItem(CLAVE_CARRITO_TIENDA);
    if (!raw) return { items: [], creadoEn: Date.now() };

    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const creadoEn = Number(parsed?.creadoEn) || Date.now();
    if (!items.length) return { items: [], creadoEn: Date.now() };

    if (!esCliente && (Date.now() - creadoEn > EXPIRACION_CARRITO_INVITADO_MS)) {
      return { items: [], creadoEn: Date.now() };
    }

    return { items, creadoEn };
  } catch {
    return { items: [], creadoEn: Date.now() };
  }
}

function guardarCarritoGuardado(items, creadoEn) {
  if (typeof window === 'undefined') return;
  if (!Array.isArray(items) || !items.length) {
    localStorage.removeItem(CLAVE_CARRITO_TIENDA);
    return;
  }

  localStorage.setItem(CLAVE_CARRITO_TIENDA, JSON.stringify({
    items,
    creadoEn: Number(creadoEn) || Date.now(),
    actualizadoEn: Date.now()
  }));
}

export default function Tienda({
  modo = 'tienda',
  mostrarLogoAccesoSistema = false,
  onClickLogoAccesoSistema = null
}) {
  const esVistaTrastienda = modo === 'trastienda';
  const [productos, setProductos] = useState([]);
  const [vistaActiva, setVistaActiva] = useState(esVistaTrastienda ? 'trastienda' : 'tienda');
  const [seccionActiva, setSeccionActiva] = useState('todos');
  const [categoriaActiva, setCategoriaActiva] = useState('todas');
  const [filtro, setFiltro] = useState('');
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState(null);
  const carritoInicial = useMemo(
    () => cargarCarritoGuardado(Boolean(localStorage.getItem(CLAVE_TOKEN_CLIENTE))),
    []
  );
  const [carrito, setCarrito] = useState(carritoInicial.items || []);
  const [carritoCreadoEn, setCarritoCreadoEn] = useState(carritoInicial.creadoEn || Date.now());
  const [mostrarCarrito, setMostrarCarrito] = useState(false);
  const [pasoCheckout, setPasoCheckout] = useState(1);
  const [creandoOrden, setCreandoOrden] = useState(false);
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
  const [adminVista, setAdminVista] = useState('pedidos');
  const [filtroEstadoOrdenAdmin, setFiltroEstadoOrdenAdmin] = useState('todos');
  const [busquedaAdmin, setBusquedaAdmin] = useState('');
  const [infoSeleccionada, setInfoSeleccionada] = useState(null);
  const [configTienda, setConfigTienda] = useState(CONFIG_DEFAULT);
  const [configTiendaAdmin, setConfigTiendaAdmin] = useState(CONFIG_DEFAULT);
  const [nuevoPunto, setNuevoPunto] = useState(PUNTO_ENTREGA_DEFAULT);
  const [mostrarModalNuevoPunto, setMostrarModalNuevoPunto] = useState(false);
  const [modalPunto, setModalPunto] = useState({ visible: false, modo: 'ver', data: null });
  const [guardandoClasificacion, setGuardandoClasificacion] = useState('');
  const [guardandoClasificacionMasiva, setGuardandoClasificacionMasiva] = useState(false);
  const [clasificacionGuardada, setClasificacionGuardada] = useState({});
  const [soloPendientesClasificacion, setSoloPendientesClasificacion] = useState(false);
  const [filtroNombreClasificacion, setFiltroNombreClasificacion] = useState('');
  const [filtroCategoriaClasificacion, setFiltroCategoriaClasificacion] = useState('todas');
  const [configAdminTab, setConfigAdminTab] = useState('general');
  const [infoLinkAdminTab, setInfoLinkAdminTab] = useState(2);
  const [resenasDetalle, setResenasDetalle] = useState([]);
  const [cargandoResenas, setCargandoResenas] = useState(false);
  const [enviandoResena, setEnviandoResena] = useState(false);
  const [resenaNueva, setResenaNueva] = useState({ calificacion: 5, comentario: '' });
  const [mostrarWhatsForm, setMostrarWhatsForm] = useState(false);
  const [whatsForm, setWhatsForm] = useState({ nombre: '', mensaje: '' });
  const [editorProducto, setEditorProducto] = useState(null);
  const bloqueoAperturaCarritoRef = useRef(0);
  const detalleTouchStartRef = useRef({ x: 0, y: 0 });
  const detalleTouchTrackingRef = useRef(false);

  const opcionesMetodoPago = [
    { value: 'efectivo', label: 'Efectivo contra entrega' },
    { value: 'transferencia', label: 'Transferencia' },
    { value: 'tarjeta', label: 'Tarjeta presencial' },
    { value: 'mercado_pago', label: 'Mercado Pago' }
  ];

  useEffect(() => {
    if (!esVistaTrastienda) return;
    setVistaActiva('trastienda');
  }, [esVistaTrastienda]);

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

  useEffect(() => {
    const esCliente = Boolean(clienteToken);
    if (!esCliente && carrito.length && (Date.now() - carritoCreadoEn > EXPIRACION_CARRITO_INVITADO_MS)) {
      setCarrito([]);
      setCarritoCreadoEn(Date.now());
      return;
    }
    guardarCarritoGuardado(carrito, carritoCreadoEn);
  }, [carrito, carritoCreadoEn, clienteToken]);

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

  const controlesSecciones = useMemo(() => {
    const opciones = [
      { key: 'todos', label: 'Todos', configKey: 'menu_todos_activo', predeterminado: true },
      { key: 'lanzamientos', label: 'Lanzamientos', configKey: 'menu_lanzamientos_activo', predeterminado: true },
      { key: 'favoritos', label: 'Favoritos', configKey: 'menu_favoritos_activo', predeterminado: true },
      { key: 'ofertas', label: 'Ofertas', configKey: 'menu_ofertas_activo', predeterminado: true },
      { key: 'accesorios', label: 'Accesorios', configKey: 'menu_accesorios_activo', predeterminado: true }
    ];
    return opciones.filter((item) => configActivo(configTienda?.[item.configKey], item.predeterminado));
  }, [configTienda]);

  const mostrarFiltroCategoria = configActivo(configTienda?.menu_categoria_activo, true);

  useEffect(() => {
    if (esVistaTrastienda) return;
    if (!controlesSecciones.length) {
      if (seccionActiva !== 'todos') setSeccionActiva('todos');
      return;
    }
    if (!controlesSecciones.some((item) => item.key === seccionActiva)) {
      setSeccionActiva(controlesSecciones[0].key);
    }
  }, [controlesSecciones, seccionActiva, esVistaTrastienda]);

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

    const lista = SECCIONES_INFO_LINKS.map(({ idx }) => {
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
    return lista.filter((item) => {
      if (!item.label || !item.activo) return false;
      const etiqueta = String(item.label || '').trim().toLowerCase();
      if (etiqueta.includes('pedido') || etiqueta.includes('blog') || etiqueta.includes('envio')) return false;
      return true;
    });
  }, [configTienda]);

  useEffect(() => {
    if (!SECCIONES_INFO_LINKS.some((item) => item.idx === infoLinkAdminTab)) {
      setInfoLinkAdminTab(SECCIONES_INFO_LINKS[0].idx);
    }
  }, [infoLinkAdminTab]);

  const horariosAtencion = useMemo(() => ({
    lunesViernes: String(
      configTienda?.atencion_horario_lunes_viernes
      || configTienda?.atencion_horario_lunes_sabado
      || ''
    ).trim(),
    sabado: String(configTienda?.atencion_horario_sabado || '').trim(),
    domingo: String(configTienda?.atencion_horario_domingo || '').trim()
  }), [configTienda]);

  const redesDisponibles = useMemo(() => {
    const redes = [
      { clave: 'facebook', label: 'Facebook', icono: 'f' },
      { clave: 'instagram', label: 'Instagram', icono: 'ig' },
      { clave: 'tiktok', label: 'TikTok', icono: 'tt' },
      { clave: 'youtube', label: 'YouTube', icono: 'yt' },
      { clave: 'x', label: 'X', icono: 'x' },
      { clave: 'linkedin', label: 'LinkedIn', icono: 'in' }
    ];

    return redes.filter((red) => {
      const url = String(configTienda?.[`social_${red.clave}_url`] || '').trim();
      const activo = configActivo(configTienda?.[`social_${red.clave}_activo`], false);
      return Boolean(url) && activo;
    }).map((red) => ({
      ...red,
      url: String(configTienda?.[`social_${red.clave}_url`] || '').trim()
    }));
  }, [configTienda]);

  function abrirLinkInformacion(item) {
    setInfoSeleccionada({
      titulo: String(item?.label || 'Información').trim() || 'Información',
      texto: String(item?.texto || '').trim() || 'Aún no hay contenido configurado para esta sección.',
      href: String(item?.href || '').trim()
    });
    setVistaActiva('info');
  }

  function enviarMensajeWhatsDesdePagina() {
    const telefono = String(configTienda?.whatsapp_numero || '').replace(/\D/g, '');
    if (!telefono) {
      mostrarNotificacion('Configura tu número de WhatsApp en Trastienda', 'error');
      return;
    }

    const nombre = String(whatsForm?.nombre || '').trim();
    const mensajeUsuarioRaw = String(whatsForm?.mensaje || '');
    const mensajeUsuario = mensajeUsuarioRaw.trim();
    if (mensajeUsuario.length < 6) {
      mostrarNotificacion('Escribe al menos 6 caracteres en tu mensaje', 'error');
      return;
    }
    if (mensajeUsuario.length > 420) {
      mostrarNotificacion('Tu mensaje es demasiado largo (máximo 420 caracteres)', 'error');
      return;
    }

    const texto = [
      'Hola CHIPACTLI, me interesa información.',
      nombre ? `Nombre: ${nombre}` : '',
      `Mensaje: ${mensajeUsuario}`
    ].filter(Boolean).join('\n');

    const url = `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setMostrarWhatsForm(false);
    setWhatsForm({ nombre: '', mensaje: '' });
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

  const categoriasClasificacion = useMemo(() => {
    const setCategorias = new Set();
    for (const item of productos) {
      const categoria = String(item?.categoria_nombre || '').trim();
      if (categoria) setCategorias.add(categoria);
    }
    return Array.from(setCategorias).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [productos]);

  const productosClasificacion = useMemo(() => {
    const termino = String(filtroNombreClasificacion || '').trim().toLowerCase();
    const categoriaFiltro = String(filtroCategoriaClasificacion || 'todas').trim().toLowerCase();
    return productos.filter((producto) => {
      if (soloPendientesClasificacion && !clasificacionCambio(
        estadoClasificacion(producto),
        clasificacionGuardada[String(producto?.nombre_receta || '').trim()] || {}
      )) {
        return false;
      }

      const nombre = String(producto?.nombre_receta || '').toLowerCase();
      const categoria = String(producto?.categoria_nombre || '').trim().toLowerCase();
      if (termino && !nombre.includes(termino)) return false;
      if (categoriaFiltro !== 'todas' && categoria !== categoriaFiltro) return false;

      return true;
    });
  }, [
    productos,
    clasificacionGuardada,
    soloPendientesClasificacion,
    filtroNombreClasificacion,
    filtroCategoriaClasificacion
  ]);

  const ordenesAdminFiltradas = useMemo(() => {
    const termino = String(busquedaAdmin || '').trim().toLowerCase();
    return adminOrdenes.filter((orden) => {
      const estado = String(orden?.estado || 'pendiente').toLowerCase();
      if (filtroEstadoOrdenAdmin !== 'todos' && estado !== filtroEstadoOrdenAdmin) return false;
      if (!termino) return true;
      const texto = [
        orden?.folio,
        orden?.nombre_cliente,
        orden?.email_cliente,
        orden?.telefono_cliente,
        orden?.nombre_punto_entrega
      ].map((v) => String(v || '').toLowerCase()).join(' ');
      return texto.includes(termino);
    });
  }, [adminOrdenes, busquedaAdmin, filtroEstadoOrdenAdmin]);

  const clientesAdminFiltrados = useMemo(() => {
    const termino = String(busquedaAdmin || '').trim().toLowerCase();
    if (!termino) return adminClientes;
    return adminClientes.filter((clienteAdmin) => {
      const texto = [
        clienteAdmin?.nombre,
        clienteAdmin?.email,
        clienteAdmin?.telefono,
        clienteAdmin?.direccion_default,
        clienteAdmin?.forma_pago_preferida
      ].map((v) => String(v || '').toLowerCase()).join(' ');
      return texto.includes(termino);
    });
  }, [adminClientes, busquedaAdmin]);

  const resumenOrdenesAdmin = useMemo(() => {
    const base = { total: adminOrdenes.length, pendiente: 0, procesando: 0, entregado: 0, cancelado: 0 };
    for (const orden of adminOrdenes) {
      const estado = String(orden?.estado || '').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(base, estado)) {
        base[estado] += 1;
      }
    }
    return base;
  }, [adminOrdenes]);

  function abrirCarrito() {
    if (Date.now() < bloqueoAperturaCarritoRef.current) return;
    setMostrarCarrito(true);
    setPasoCheckout(1);
  }

  function cerrarCarrito() {
    bloqueoAperturaCarritoRef.current = Date.now() + 350;
    setMostrarCarrito(false);
    setPasoCheckout(1);
  }

  function continuarPasoEntrega() {
    if (!carrito.length) {
      mostrarNotificacion('Agrega productos para continuar', 'error');
      return;
    }
    setPasoCheckout(2);
  }

  function continuarPasoPago() {
    if (!checkout.id_punto_entrega) {
      mostrarNotificacion('Selecciona un punto de entrega', 'error');
      return;
    }
    setPasoCheckout(3);
  }

  function regresarPasoCheckout() {
    setPasoCheckout((prev) => Math.max(1, prev - 1));
  }

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
      const normalizada = { ...CONFIG_DEFAULT, ...(data || {}) };
      if (!String(normalizada.atencion_horario_lunes_viernes || '').trim()) {
        normalizada.atencion_horario_lunes_viernes = String(normalizada.atencion_horario_lunes_sabado || '').trim();
      }
      setConfigTienda(normalizada);
    } catch {
      setConfigTienda(CONFIG_DEFAULT);
    }
  }

  async function cargarConfigTiendaAdmin() {
    try {
      const data = await fetchAdmin('/tienda/admin/config');
      const normalizada = { ...CONFIG_DEFAULT, ...(data || {}) };
      if (!String(normalizada.atencion_horario_lunes_viernes || '').trim()) {
        normalizada.atencion_horario_lunes_viernes = String(normalizada.atencion_horario_lunes_sabado || '').trim();
      }
      setConfigTiendaAdmin(normalizada);
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
      if (!String(conf.atencion_horario_lunes_viernes || '').trim()) {
        conf.atencion_horario_lunes_viernes = String(conf.atencion_horario_lunes_sabado || '').trim();
      }
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
      setNuevoPunto(PUNTO_ENTREGA_DEFAULT);
      setMostrarModalNuevoPunto(false);
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

  function abrirModalNuevoPuntoAdmin() {
    setNuevoPunto(PUNTO_ENTREGA_DEFAULT);
    setMostrarModalNuevoPunto(true);
  }

  function abrirModalPunto(modo, punto) {
    if (!punto) return;
    setModalPunto({
      visible: true,
      modo,
      data: {
        id: punto.id,
        nombre: punto.nombre || '',
        direccion: punto.direccion || '',
        horario: punto.horario || '',
        activo: Number(punto.activo) === 1
      }
    });
  }

  function cerrarModalPunto() {
    setModalPunto({ visible: false, modo: 'ver', data: null });
  }

  function editarCampoModalPunto(campo, valor) {
    setModalPunto((prev) => {
      if (!prev.visible || !prev.data) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          [campo]: valor
        }
      };
    });
  }

  async function guardarPuntoAdmin(puntoParam = null) {
    const punto = puntoParam || modalPunto.data;
    if (!punto) return;
    try {
      await fetchAdmin(`/tienda/admin/puntos-entrega/${punto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: punto.nombre,
          direccion: punto.direccion,
          horario: punto.horario,
          activo: Boolean(punto.activo)
        })
      });
      await cargarAdminPuntos();
      await cargarPuntosEntrega();
      mostrarNotificacion('Punto actualizado', 'exito');
      cerrarModalPunto();
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo guardar punto', 'error');
    }
  }

  async function eliminarPuntoAdmin(id) {
    const ok = await mostrarConfirmacion('¿Eliminar este punto de entrega?', 'Eliminar punto');
    if (!ok) return;
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

  async function cargarResenasProducto(recetaNombre) {
    const receta = String(recetaNombre || '').trim();
    if (!receta) {
      setResenasDetalle([]);
      return;
    }

    setCargandoResenas(true);
    try {
      const data = await fetchJson(`/tienda/resenas?receta_nombre=${encodeURIComponent(receta)}`);
      const resumen = data?.resumen || {};
      setResenasDetalle(Array.isArray(data?.resenas) ? data.resenas : []);
      setSeleccionado((prev) => {
        if (!prev || String(prev?.nombre_receta || '').trim() !== receta) return prev;
        return {
          ...prev,
          resenas_total: Number(resumen?.total) || 0,
          resenas_promedio: Number(resumen?.promedio) || 0
        };
      });
    } catch {
      setResenasDetalle([]);
    } finally {
      setCargandoResenas(false);
    }
  }

  async function enviarResenaProducto() {
    const receta = String(seleccionado?.nombre_receta || '').trim();
    const comentario = String(resenaNueva?.comentario || '').trim();
    const calificacion = Math.max(1, Math.min(5, Number(resenaNueva?.calificacion) || 0));

    if (!clienteToken) {
      mostrarNotificacion('Inicia sesión para comentar', 'error');
      return;
    }
    if (!receta) return;
    if (comentario.length < 3) {
      mostrarNotificacion('Escribe un comentario más completo', 'error');
      return;
    }

    setEnviandoResena(true);
    try {
      const data = await fetchJson('/tienda/resenas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clienteToken}`
        },
        body: JSON.stringify({ receta_nombre: receta, calificacion, comentario })
      });

      setResenaNueva({ calificacion: 5, comentario: '' });
      await cargarResenasProducto(receta);
      await cargarProductos();

      const resumen = data?.resumen || {};
      setSeleccionado((prev) => {
        if (!prev || String(prev?.nombre_receta || '').trim() !== receta) return prev;
        return {
          ...prev,
          resenas_total: Number(resumen?.total) || prev?.resenas_total || 0,
          resenas_promedio: Number(resumen?.promedio) || prev?.resenas_promedio || 0
        };
      });
      mostrarNotificacion('Gracias por tu comentario', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo guardar tu comentario', 'error');
    } finally {
      setEnviandoResena(false);
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
    setResenaNueva({ calificacion: 5, comentario: '' });
    cargarResenasProducto(producto?.nombre_receta);
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

  function moverImagenDetallePorPaso(paso) {
    setSeleccionado((prev) => {
      if (!prev) return prev;
      const galeriaBase = Array.isArray(prev?.galeria) ? prev.galeria : [];
      const galeria = Array.from(new Set([
        String(prev?.imagen_activa || '').trim(),
        ...galeriaBase.map((item) => String(item || '').trim())
      ].filter(Boolean)));
      if (galeria.length < 2) return prev;

      const actual = String(prev?.imagen_activa || '').trim();
      const idxActual = Math.max(0, galeria.findIndex((img) => img === actual));
      const siguiente = (idxActual + paso + galeria.length) % galeria.length;
      return { ...prev, imagen_activa: galeria[siguiente] };
    });
  }

  function iniciarSwipeDetalle(event) {
    const touch = event?.changedTouches?.[0];
    if (!touch) return;
    detalleTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
    detalleTouchTrackingRef.current = true;
  }

  function finalizarSwipeDetalle(event) {
    if (!detalleTouchTrackingRef.current) return;
    detalleTouchTrackingRef.current = false;
    const touch = event?.changedTouches?.[0];
    if (!touch) return;

    const dx = touch.clientX - Number(detalleTouchStartRef.current?.x || 0);
    const dy = touch.clientY - Number(detalleTouchStartRef.current?.y || 0);
    const horizontal = Math.abs(dx) > Math.abs(dy);
    if (!horizontal || Math.abs(dx) < 34) return;

    moverImagenDetallePorPaso(dx < 0 ? 1 : -1);
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
          categoria_nombre: String(producto?.categoria_nombre || '').trim(),
          descripcion_mp: `${String(producto?.categoria_nombre || '').trim()} - ${String(producto?.nombre_receta || recetaReal).trim()}`.replace(/^\s*-\s*/, '').trim(),
          slug: producto?.slug,
          variante,
          cantidad: 1,
          precio_unitario: precioUnitario,
          subtotal: precioUnitario
        }
      ];
    });

    if (!carrito.length) {
      setCarritoCreadoEn(Date.now());
    }

    mostrarNotificacion('Producto agregado al carrito', 'exito');
  }

  function actualizarCantidad(clave, cantidadNueva) {
    const cantidad = Math.max(1, Number(cantidadNueva) || 1);
    setCarrito((prev) => prev.map((item) => (
      item.clave === clave
        ? { ...item, cantidad, subtotal: cantidad * item.precio_unitario }
        : item
    )));
  }

  function cambiarCantidadPorDelta(clave, delta) {
    setCarrito((prev) => prev.map((item) => {
      if (item.clave !== clave) return item;
      const cantidad = Math.max(1, (Number(item.cantidad) || 1) + Number(delta || 0));
      return { ...item, cantidad, subtotal: cantidad * item.precio_unitario };
    }));
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
    if (creandoOrden) return;
    if (!clienteToken) {
      mostrarNotificacion('Inicia sesión para finalizar compra', 'error');
      return;
    }
    if (!carrito.length) {
      mostrarNotificacion('Tu carrito está vacío', 'error');
      return;
    }
    if (!checkout.id_punto_entrega) {
      mostrarNotificacion('Selecciona un punto de entrega', 'error');
      setPasoCheckout(2);
      return;
    }

    try {
      setCreandoOrden(true);
      const data = await fetchJson('/tienda/ordenes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clienteToken}`
        },
        body: JSON.stringify({
          items: carrito.map((item) => ({
            nombre_receta: item.nombre_receta,
            categoria_nombre: item.categoria_nombre || '',
            descripcion_mp: item.descripcion_mp || '',
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
      setCarritoCreadoEn(Date.now());
      setCheckout((prev) => ({ ...prev, notas: '' }));
      cerrarCarrito();
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
    } finally {
      setCreandoOrden(false);
    }
  }

  const whatsMensaje = String(whatsForm?.mensaje || '');
  const whatsMensajeLen = whatsMensaje.length;
  const whatsMensajeTrimLen = whatsMensaje.trim().length;
  const whatsMensajeInvalido = whatsMensajeTrimLen < 6 || whatsMensajeTrimLen > 420;

  return (
    <div>
      {!esVistaTrastienda && (
      <div className="tiendaPromoBar">
        {configTienda.promo_texto}
      </div>
      )}

      {!esVistaTrastienda && (
      <div className="tiendaMainHeader">
        <div className="tiendaHeaderLogoLado">
          {mostrarLogoAccesoSistema && (
            <button
              type="button"
              className="tiendaBrandLogoBtn"
              onClick={onClickLogoAccesoSistema || undefined}
              title="Acceso al sistema"
              aria-label="Acceso al sistema"
            >
              <img src="/images/logo.png" alt="Acceso" className="tiendaBrandLogoImg" />
            </button>
          )}
        </div>
        <div className="tiendaHeaderCentroShop" aria-label="VITRINA">VITRINA</div>
        <div className="tiendaHeaderAcciones">
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
          <button className="tiendaCartBtn" onClick={abrirCarrito}>
            🛒
            {carrito.length > 0 && <span className="tiendaCartCount">{carrito.length}</span>}
          </button>
        </div>
        <div className="tiendaHeaderBusquedaWrap tiendaSoloMovil">
          <input
            className="cajaBusqueda"
            placeholder="🔍 Buscar producto..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
      </div>
      )}

      {!esVistaTrastienda && (
      <div className="tiendaCategoriasBar">
        {controlesSecciones.map((item) => (
          <button
            key={item.key}
            className={seccionActiva === item.key ? 'tiendaTab activa' : 'tiendaTab'}
            onClick={() => setSeccionActiva(item.key)}
          >
            {item.label}
          </button>
        ))}
        {mostrarFiltroCategoria && (
          <select className="tiendaCategoriaSelect" value={categoriaActiva} onChange={(e) => setCategoriaActiva(e.target.value)}>
            <option value="todas">Todas las categorías</option>
            {categoriasDisponibles.map((categoria) => (
              <option key={categoria} value={categoria.toLowerCase()}>{categoria}</option>
            ))}
          </select>
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
        <div className="tiendaCategoriasBusqueda tiendaSoloDesktop">
          <input
            className="cajaBusqueda"
            placeholder="🔍 Buscar producto..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
      </div>
      )}

      <div className={esVistaTrastienda ? 'tiendaGrid tiendaGridAdminFull' : 'tiendaGrid'}>
      {!esVistaTrastienda && vistaActiva === 'tienda' && (
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
              const categoriaProducto = String(producto?.categoria_nombre || '').trim() || 'Sin categoría';
              const totalResenas = Number(producto?.resenas_total) || 0;
              const promedioResenas = Number(producto?.resenas_promedio) || 0;
              const hojitas = pintarHojitas(promedioResenas);
              return (
                <article key={producto.slug || producto.nombre_receta} className="tiendaProductoCard">
                  <div className="tiendaImagenWrap">
                    {producto?.image_url ? (
                      <img src={producto.image_url} alt={producto.nombre_receta} className="tiendaImagen" />
                    ) : (
                      <div className="tiendaImagenPlaceholder">Sin imagen</div>
                    )}
                  </div>
                  <div className="tiendaCategoriaBadge">{categoriaProducto}</div>
                  <h3>{producto.nombre_receta}</h3>
                  <div className="tiendaCalificacionCard" title={totalResenas ? `${promedioResenas.toFixed(1)} de 5` : 'Sin calificaciones'}>
                    <div className="tiendaHojitasFila">
                      {hojitas.map((activa, idx) => (
                        <span key={`hojita-${producto.nombre_receta}-${idx}`} className={activa ? 'tiendaHojita activa' : 'tiendaHojita'}>🍃</span>
                      ))}
                    </div>
                    <span className="tiendaCalificacionTxt">
                      {totalResenas >= 5
                        ? `${promedioResenas.toFixed(1)} / 5`
                        : `${totalResenas} calificaciones`}
                    </span>
                  </div>
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

      {mostrarCarrito && (
      <section className="tarjeta tiendaLateral abierta">
        <div className="tiendaLateralHeader">
          <h2>Mi carrito</h2>
          <button
            type="button"
            className="boton"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              cerrarCarrito();
            }}
          >
            Cerrar
          </button>
        </div>
        <div className="tiendaCheckoutPasos">
          <span className={pasoCheckout === 1 ? 'tiendaPasoActivo' : 'tiendaPaso'}>1. Carrito</span>
          <span className={pasoCheckout === 2 ? 'tiendaPasoActivo' : 'tiendaPaso'}>2. Entrega</span>
          <span className={pasoCheckout === 3 ? 'tiendaPasoActivo' : 'tiendaPaso'}>3. Pago</span>
        </div>

        {pasoCheckout === 1 && (
          <>
            <div className="tiendaCarritoLista">
              {carrito.map((item) => (
                <div key={item.clave} className="tiendaCarritoItem">
                  <div>
                    <div className="tiendaCarritoCategoria">{item.categoria_nombre || 'Producto'}</div>
                    <strong>{item.nombre_base || item.nombre_receta}</strong>
                    {item.variante ? <small> · {item.variante}</small> : null}
                  </div>
                  <div className="tiendaCarritoControles">
                    <button type="button" className="tiendaQtyBtn" onClick={() => cambiarCantidadPorDelta(item.clave, -1)}>-</button>
                    <input
                      type="text"
                      min="1"
                      value={item.cantidad}
                      onChange={(e) => actualizarCantidad(item.clave, e.target.value)}
                    />
                    <button type="button" className="tiendaQtyBtn" onClick={() => cambiarCantidadPorDelta(item.clave, 1)}>+</button>
                    <span>{precio(item.subtotal)}</span>
                    <button type="button" className="botonPequeno botonDanger" onClick={() => eliminarDelCarrito(item.clave)}>✕</button>
                  </div>
                </div>
              ))}
              {!carrito.length && <div className="tiendaVacio">Aún no agregas productos.</div>}
            </div>

            <div className="tiendaCheckout">
              <div className="tiendaTotal">Total: {precio(totalCarrito)}</div>
              <button type="button" className="boton botonExito" onClick={continuarPasoEntrega}>
                Continuar con la entrega
              </button>
            </div>
          </>
        )}

        {pasoCheckout === 2 && (
          <div className="tiendaCheckout">
            <div className="tiendaTotal">Paso 2: Ubicación de entrega</div>
            <select
              value={checkout.id_punto_entrega}
              onChange={(e) => setCheckout((p) => ({ ...p, id_punto_entrega: e.target.value }))}
            >
              <option value="">Selecciona punto de entrega</option>
              {puntosEntrega.map((punto) => (
                <option key={punto.id} value={punto.id}>{punto.nombre}{punto.direccion ? ` · ${punto.direccion}` : ''}</option>
              ))}
            </select>

            <div className="tiendaCheckoutAcciones">
              <button type="button" className="boton" onClick={regresarPasoCheckout}>Atrás</button>
              <button type="button" className="boton botonExito" onClick={continuarPasoPago}>Continuar con el pago</button>
            </div>
          </div>
        )}

        {pasoCheckout === 3 && (
          <div className="tiendaCheckout">
            <div className="tiendaTotal">Paso 3: Forma de pago</div>
            <div className="tiendaMetodoPagoGrid" role="radiogroup" aria-label="Forma de pago">
              {opcionesMetodoPago.map((opcion) => {
                const activa = checkout.metodo_pago === opcion.value;
                return (
                  <button
                    key={opcion.value}
                    type="button"
                    className={activa ? 'tiendaMetodoPagoOption activa' : 'tiendaMetodoPagoOption'}
                    onClick={() => setCheckout((p) => ({ ...p, metodo_pago: opcion.value }))}
                  >
                    <span className={activa ? 'tiendaMetodoPagoRadio activo' : 'tiendaMetodoPagoRadio'}></span>
                    <span>{opcion.label}</span>
                  </button>
                );
              })}
            </div>
            <textarea
              placeholder="Notas del pedido"
              value={checkout.notas}
              onChange={(e) => setCheckout((p) => ({ ...p, notas: e.target.value }))}
              rows={2}
            />

            <div className="tiendaCheckoutResumen">
              <span>Total a pagar:</span>
              <strong>{precio(totalCarrito)}</strong>
            </div>

            <div className="tiendaCheckoutAcciones">
              <button type="button" className="boton" onClick={regresarPasoCheckout}>Atrás</button>
              {checkout.metodo_pago === 'mercado_pago' ? (
                <button
                  type="button"
                  className="boton tiendaBotonMercadoPagoReal"
                  onClick={crearOrden}
                  disabled={creandoOrden}
                >
                  {creandoOrden ? (
                    <span>Conectando con Mercado Pago...</span>
                  ) : (
                    <img
                      src="/images/botonmp.jpg"
                      alt="Pagar con Mercado Pago"
                      className="tiendaMpBadgeImg"
                    />
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="boton botonExito"
                  onClick={crearOrden}
                  disabled={creandoOrden}
                >
                  {creandoOrden ? 'Generando pedido...' : 'Confirmar pedido'}
                </button>
              )}
            </div>
          </div>
        )}
      </section>
      )}

      {(esVistaTrastienda || vistaActiva === 'trastienda') && tokenInterno && (
        <section className="tarjeta tiendaCatalogo">
          <div className="tiendaAdminPanel">
            <h3>Panel interno tienda</h3>

            <div className="tiendaAdminTabs">
              <button type="button" className={adminVista === 'pedidos' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setAdminVista('pedidos')}>Pedidos</button>
              <button type="button" className={adminVista === 'clientes' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setAdminVista('clientes')}>Clientes</button>
              <button type="button" className={adminVista === 'puntos' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setAdminVista('puntos')}>Puntos de entrega</button>
              <button type="button" className={adminVista === 'catalogo' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setAdminVista('catalogo')}>Catálogo</button>
              <button type="button" className={adminVista === 'config' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setAdminVista('config')}>Configuración</button>
            </div>

            {(adminVista === 'pedidos' || adminVista === 'clientes') && (
              <div className="tiendaAdminBuscadorWrap">
                <input
                  placeholder={adminVista === 'pedidos' ? 'Buscar por folio, cliente, correo o punto de entrega' : 'Buscar cliente por nombre, correo o teléfono'}
                  value={busquedaAdmin}
                  onChange={(e) => setBusquedaAdmin(e.target.value)}
                />
                {adminVista === 'pedidos' && (
                  <select value={filtroEstadoOrdenAdmin} onChange={(e) => setFiltroEstadoOrdenAdmin(e.target.value)}>
                    <option value="todos">Todos los estados</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="procesando">Procesando</option>
                    <option value="entregado">Entregado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                )}
              </div>
            )}

            {adminVista === 'puntos' && (
            <div className="tiendaAdminForm">
              <div className="tiendaAdminPuntosHeader">
                <strong>Puntos de entrega</strong>
                <button
                  className="boton botonExito"
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    abrirModalNuevoPuntoAdmin();
                  }}
                >
                  + Nuevo punto
                </button>
              </div>
              <div className="tiendaAdminPuntosGrid">
                {adminPuntos.map((punto) => (
                  <article key={punto.id} className="tiendaAdminPuntoCard">
                    <div className="tiendaAdminPuntoCardHead">
                      <h4>{punto.nombre || 'Sin nombre'}</h4>
                      <SwitchConTexto
                        checked={Number(punto.activo) === 1}
                        label={Number(punto.activo) === 1 ? 'Activo' : 'Inactivo'}
                        ariaLabel={`Estado del punto ${punto.nombre || punto.id}`}
                        onChange={(event) => cambiarEstadoPunto(punto.id, event.target.checked)}
                      />
                    </div>
                    <p>{punto.direccion || 'Sin dirección'}</p>
                    <p><strong>Horario:</strong> {punto.horario || 'Sin horario'}</p>
                    <div className="tiendaAdminPuntoCardAcciones">
                      <button className="botonPequeno" type="button" onClick={() => abrirModalPunto('ver', punto)}>Ver</button>
                      <button className="botonPequeno" type="button" onClick={() => abrirModalPunto('editar', punto)}>Editar</button>
                      <button className="botonPequeno botonDanger" type="button" onClick={() => eliminarPuntoAdmin(punto.id)}>Eliminar</button>
                    </div>
                  </article>
                ))}
                {!adminPuntos.length && <div className="tiendaVacio">Sin puntos registrados</div>}
              </div>
            </div>
            )}

            {adminVista === 'config' && (
            <div className="tiendaAdminForm">
              <strong>Configuración tienda y atención</strong>
              <div className="tiendaAdminTabs tiendaAdminTabsConfigInternas">
                <button type="button" className={configAdminTab === 'general' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setConfigAdminTab('general')}>General</button>
                <button type="button" className={configAdminTab === 'nav' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setConfigAdminTab('nav')}>Navegación</button>
                <button type="button" className={configAdminTab === 'redes' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setConfigAdminTab('redes')}>Redes</button>
                <button type="button" className={configAdminTab === 'links' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setConfigAdminTab('links')}>Links info</button>
              </div>

              {configAdminTab === 'general' && (
                <>
                  <div className="tiendaAdminCampos5">
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
                  </div>
                  <textarea
                    placeholder="Texto marca footer"
                    value={configTiendaAdmin.footer_marca_texto || ''}
                    onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, footer_marca_texto: e.target.value }))}
                    rows={2}
                  />
                  <div className="tiendaAdminHorariosBox">
                    <strong>Horarios de atención</strong>
                    <div className="tiendaAdminHorariosGrid">
                      <div className="tiendaAdminHorarioCard">
                        <label>Lunes a viernes</label>
                        <input
                          placeholder="Ej. 09:00 a 18:00"
                          value={configTiendaAdmin.atencion_horario_lunes_viernes || ''}
                          onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, atencion_horario_lunes_viernes: e.target.value }))}
                        />
                      </div>
                      <div className="tiendaAdminHorarioCard">
                        <label>Sábado</label>
                        <input
                          placeholder="Ej. 09:00 a 14:00"
                          value={configTiendaAdmin.atencion_horario_sabado || ''}
                          onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, atencion_horario_sabado: e.target.value }))}
                        />
                      </div>
                      <div className="tiendaAdminHorarioCard">
                        <label>Domingo</label>
                        <input
                          placeholder="Ej. Cerrado o 10:00 a 13:00"
                          value={configTiendaAdmin.atencion_horario_domingo || ''}
                          onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, atencion_horario_domingo: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="tiendaAdminHorarioPreview">
                      <span><strong>Lunes a viernes:</strong> {configTiendaAdmin.atencion_horario_lunes_viernes || '-'}</span>
                      <span><strong>Sábado:</strong> {configTiendaAdmin.atencion_horario_sabado || '-'}</span>
                      <span><strong>Domingo:</strong> {configTiendaAdmin.atencion_horario_domingo || '-'}</span>
                    </div>
                  </div>
                </>
              )}

              {configAdminTab === 'nav' && (
                <div className="tiendaAdminSwitchGrid">
                  <SwitchConTexto
                    checked={configActivo(configTiendaAdmin.menu_todos_activo, true)}
                    onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, menu_todos_activo: e.target.checked ? '1' : '0' }))}
                    label={'Mostrar botón "Todos"'}
                  />
                  <SwitchConTexto
                    checked={configActivo(configTiendaAdmin.menu_lanzamientos_activo, true)}
                    onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, menu_lanzamientos_activo: e.target.checked ? '1' : '0' }))}
                    label={'Mostrar botón "Lanzamientos"'}
                  />
                  <SwitchConTexto
                    checked={configActivo(configTiendaAdmin.menu_favoritos_activo, true)}
                    onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, menu_favoritos_activo: e.target.checked ? '1' : '0' }))}
                    label={'Mostrar botón "Favoritos"'}
                  />
                  <SwitchConTexto
                    checked={configActivo(configTiendaAdmin.menu_ofertas_activo, true)}
                    onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, menu_ofertas_activo: e.target.checked ? '1' : '0' }))}
                    label={'Mostrar botón "Ofertas"'}
                  />
                  <SwitchConTexto
                    checked={configActivo(configTiendaAdmin.menu_accesorios_activo, true)}
                    onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, menu_accesorios_activo: e.target.checked ? '1' : '0' }))}
                    label={'Mostrar botón "Accesorios"'}
                  />
                  <SwitchConTexto
                    checked={configActivo(configTiendaAdmin.menu_categoria_activo, true)}
                    onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, menu_categoria_activo: e.target.checked ? '1' : '0' }))}
                    label={'Mostrar filtro de categorías'}
                  />
                </div>
              )}

              {configAdminTab === 'redes' && (
                <div className="tiendaAdminSocialGrid">
                  {[
                    { clave: 'facebook', label: 'Facebook' },
                    { clave: 'instagram', label: 'Instagram' },
                    { clave: 'tiktok', label: 'TikTok' },
                    { clave: 'youtube', label: 'YouTube' },
                    { clave: 'x', label: 'X' },
                    { clave: 'linkedin', label: 'LinkedIn' }
                  ].map((red) => (
                    <div key={`cfg-red-${red.clave}`} className="tiendaAdminSocialCard">
                      <SwitchConTexto
                        checked={configActivo(configTiendaAdmin[`social_${red.clave}_activo`], false)}
                        onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, [`social_${red.clave}_activo`]: e.target.checked ? '1' : '0' }))}
                        label={`Mostrar ${red.label}`}
                      />
                      <input
                        placeholder={`URL ${red.label}`}
                        value={configTiendaAdmin[`social_${red.clave}_url`] || ''}
                        onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, [`social_${red.clave}_url`]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              )}

              {configAdminTab === 'links' && (
                <div className="tiendaAdminLinksWrap">
                  <div className="tiendaAdminTabs tiendaAdminTabsLinks">
                    {SECCIONES_INFO_LINKS.map((item) => (
                      <button
                        key={`tab-link-${item.idx}`}
                        type="button"
                        className={infoLinkAdminTab === item.idx ? 'tiendaTab activa' : 'tiendaTab'}
                        onClick={() => setInfoLinkAdminTab(item.idx)}
                      >
                        {item.titulo}
                      </button>
                    ))}
                  </div>
                  <div className="tiendaAdminLinkCard">
                    <SwitchConTexto
                      checked={configActivo(configTiendaAdmin[`info_link_${infoLinkAdminTab}_activo`], true)}
                      onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, [`info_link_${infoLinkAdminTab}_activo`]: e.target.checked ? '1' : '0' }))}
                      label="Mostrar link"
                    />
                    <input
                      placeholder={'Título visible del apartado'}
                      value={configTiendaAdmin[`info_link_${infoLinkAdminTab}_label`] || ''}
                      onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, [`info_link_${infoLinkAdminTab}_label`]: e.target.value }))}
                    />
                    <textarea
                      placeholder={'Contenido que verá el cliente en esta sección'}
                      value={configTiendaAdmin[`info_link_${infoLinkAdminTab}_texto`] || ''}
                      onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, [`info_link_${infoLinkAdminTab}_texto`]: e.target.value }))}
                      rows={5}
                    />
                  </div>
                </div>
              )}

              <button className="boton botonExito" type="button" onClick={guardarConfigTiendaAdmin}>Guardar configuración</button>
            </div>
            )}

            {adminVista === 'catalogo' && (
            <div className="tiendaAdminForm">
              <strong>Clasificación de productos (tienda)</strong>
              <div className="tiendaAdminPendientes">
                Cambios pendientes: <strong>{pendientesClasificacion}</strong>
              </div>
              <div className="tiendaAdminAccionesClasificacion">
                <SwitchConTexto
                  checked={soloPendientesClasificacion}
                  onChange={(e) => setSoloPendientesClasificacion(e.target.checked)}
                  label="Solo pendientes"
                />
                <button
                  className="boton botonExito"
                  type="button"
                  disabled={guardandoClasificacionMasiva || !productos.length}
                  onClick={guardarClasificacionTodos}
                >
                  {guardandoClasificacionMasiva ? 'Guardando todo...' : 'Guardar todo'}
                </button>
              </div>
              <div className="tiendaAdminFiltrosClasificacion">
                <input
                  type="text"
                  placeholder="Filtrar por producto"
                  value={filtroNombreClasificacion}
                  onChange={(e) => setFiltroNombreClasificacion(e.target.value)}
                />
                <select
                  value={filtroCategoriaClasificacion}
                  onChange={(e) => setFiltroCategoriaClasificacion(e.target.value)}
                >
                  <option value="todas">Todas las categorias</option>
                  {categoriasClasificacion.map((categoria) => (
                    <option key={categoria} value={String(categoria).toLowerCase()}>{categoria}</option>
                  ))}
                </select>
              </div>
              <div className="tiendaAdminListado tiendaAdminCatalogoClasificacion">
                <div className="tiendaAdminFilaCatalogoHead" aria-hidden="true">
                  <span>Producto</span>
                  <span>Lanzamiento</span>
                  <span>Favorito</span>
                  <span>Oferta</span>
                  <span>Accesorio</span>
                  <span>Accion</span>
                </div>
                {productosClasificacion.map((producto) => (
                  <div key={producto.slug || producto.nombre_receta} className="tiendaAdminFilaCatalogoGrid">
                    <div className="tiendaAdminProductoClasificacion">
                      <strong>{producto.nombre_receta}</strong>
                      <div className="tiendaAdminSubtexto">{producto.categoria_nombre || 'Sin categoría'}</div>
                      {clasificacionCambio(
                        estadoClasificacion(producto),
                        clasificacionGuardada[String(producto?.nombre_receta || '').trim()] || {}
                      ) && <span className="tiendaBadgePendiente">Pendiente</span>}
                    </div>
                    <label className="tiendaSwitchCard tiendaSwitchToggle tiendaSwitchSoloIcono">
                      <input
                        type="checkbox"
                        checked={Boolean(producto.es_lanzamiento)}
                        onChange={() => toggleClasificacionProducto(producto.nombre_receta, 'es_lanzamiento')}
                        aria-label={`Lanzamiento para ${producto.nombre_receta}`}
                      />
                      <span className="tiendaSwitchSlider" />
                      <span className="tiendaSwitchTextoMovil">Lanzamiento</span>
                    </label>
                    <label className="tiendaSwitchCard tiendaSwitchToggle tiendaSwitchSoloIcono">
                      <input
                        type="checkbox"
                        checked={Boolean(producto.es_favorito)}
                        onChange={() => toggleClasificacionProducto(producto.nombre_receta, 'es_favorito')}
                        aria-label={`Favorito para ${producto.nombre_receta}`}
                      />
                      <span className="tiendaSwitchSlider" />
                      <span className="tiendaSwitchTextoMovil">Favorito</span>
                    </label>
                    <label className="tiendaSwitchCard tiendaSwitchToggle tiendaSwitchSoloIcono">
                      <input
                        type="checkbox"
                        checked={Boolean(producto.es_oferta)}
                        onChange={() => toggleClasificacionProducto(producto.nombre_receta, 'es_oferta')}
                        aria-label={`Oferta para ${producto.nombre_receta}`}
                      />
                      <span className="tiendaSwitchSlider" />
                      <span className="tiendaSwitchTextoMovil">Oferta</span>
                    </label>
                    <label className="tiendaSwitchCard tiendaSwitchToggle tiendaSwitchSoloIcono">
                      <input
                        type="checkbox"
                        checked={Boolean(producto.es_accesorio)}
                        onChange={() => toggleClasificacionProducto(producto.nombre_receta, 'es_accesorio')}
                        aria-label={`Accesorio para ${producto.nombre_receta}`}
                      />
                      <span className="tiendaSwitchSlider" />
                      <span className="tiendaSwitchTextoMovil">Accesorio</span>
                    </label>
                    <div className="tiendaAdminAccionClasificacion">
                      <button
                        className="botonPequeno"
                        type="button"
                        disabled={guardandoClasificacionMasiva || guardandoClasificacion === producto.nombre_receta}
                        onClick={() => guardarClasificacionProducto(producto)}
                      >
                        {guardandoClasificacion === producto.nombre_receta ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                ))}
                {!productosClasificacion.length && <div className="tiendaVacio">No hay productos para clasificar con ese filtro</div>}
              </div>
            </div>
            )}

            {adminVista === 'clientes' && (
              <div className="tiendaAdminForm">
                <strong>Clientes registrados</strong>
                <div className="tiendaAdminListado tiendaAdminListadoAmplio">
                  {clientesAdminFiltrados.map((c) => (
                    <div key={c.id} className="tiendaAdminFila tiendaAdminClienteCard">
                      <div>
                        <strong>{c.nombre || 'Sin nombre'}</strong>
                        <div className="tiendaAdminSubtexto">{c.email || 'Sin correo'}</div>
                      </div>
                      <div className="tiendaAdminClienteMeta">
                        <span>Tel: {c.telefono || '-'}</span>
                        <span>Pago preferido: {c.forma_pago_preferida || '-'}</span>
                        <span>Dirección: {c.direccion_default || '-'}</span>
                        <span>Alta: {String(c.creado_en || '').replace('T', ' ').slice(0, 16) || '-'}</span>
                      </div>
                    </div>
                  ))}
                  {!clientesAdminFiltrados.length && <div className="tiendaVacio">No hay clientes con ese filtro</div>}
                </div>
              </div>
            )}

            {adminVista === 'pedidos' && (
              <div className="tiendaAdminForm">
                <strong>Seguimiento de pedidos</strong>
                <div className="tiendaAdminResumenPedidos">
                  <span>Total: <strong>{resumenOrdenesAdmin.total}</strong></span>
                  <span>Pendientes: <strong>{resumenOrdenesAdmin.pendiente}</strong></span>
                  <span>Procesando: <strong>{resumenOrdenesAdmin.procesando}</strong></span>
                  <span>Entregados: <strong>{resumenOrdenesAdmin.entregado}</strong></span>
                  <span>Cancelados: <strong>{resumenOrdenesAdmin.cancelado}</strong></span>
                </div>
                <div className="tiendaAdminListado tiendaAdminListadoAmplio tiendaAdminListadoPedidos">
                  <div className="tiendaAdminOrdenGrid">
                  {ordenesAdminFiltradas.map((o) => (
                    <div key={o.id} className="tiendaAdminFila tiendaAdminOrdenCard">
                      <div className="tiendaAdminOrdenInfo">
                        <strong>{o.folio}</strong>
                        <div className="tiendaAdminSubtexto">{o.nombre_cliente} · {o.email_cliente || 'Sin correo'} · {o.telefono_cliente || 'Sin teléfono'}</div>
                        <div className="tiendaAdminSubtexto">Entrega: {o.nombre_punto_entrega || '-'} · {o.direccion_entrega || '-'}</div>
                        <div className="tiendaAdminSubtexto">Pago: {o.metodo_pago || '-'} · Total: {precio(o.total)} · {String(o.creado_en || '').replace('T', ' ').slice(0, 16)}</div>
                        {String(o.notas || '').trim() && <div className="tiendaAdminSubtexto">Notas: {o.notas}</div>}
                      </div>
                      <div className="tiendaAdminOrdenAcciones">
                        <select
                          value={String(o.estado || 'pendiente')}
                          onChange={(e) => actualizarEstadoOrdenAdmin(o.id, e.target.value)}
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="procesando">Procesando</option>
                          <option value="entregado">Entregado</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                        <button type="button" className="botonPequeno" onClick={() => actualizarEstadoOrdenAdmin(o.id, 'pendiente')}>Marcar pendiente</button>
                        <button type="button" className="botonPequeno botonExito" onClick={() => actualizarEstadoOrdenAdmin(o.id, 'entregado')}>Marcar entregado</button>
                        <button type="button" className="botonPequeno botonDanger" onClick={() => actualizarEstadoOrdenAdmin(o.id, 'cancelado')}>Cancelar</button>
                      </div>
                    </div>
                  ))}
                  </div>
                  {!ordenesAdminFiltradas.length && <div className="tiendaVacio">No hay pedidos con ese filtro</div>}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {!esVistaTrastienda && vistaActiva === 'info' && (
        <section className="tarjeta tiendaCatalogo tiendaInfoTab">
          <div className="tiendaInfoTabHeader">
            <h2>{infoSeleccionada?.titulo || 'Información'}</h2>
            <button
              className="boton tiendaBotonVolverMini"
              type="button"
              aria-label="Volver a productos"
              title="Volver a productos"
              onClick={() => setVistaActiva('tienda')}
            >
              ←
            </button>
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

      {!esVistaTrastienda && vistaActiva === 'detalle' && seleccionado && (
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
                  <button
                    className="boton tiendaBotonVolverMini"
                    type="button"
                    aria-label="Volver a productos"
                    title="Volver a productos"
                    onClick={() => setVistaActiva('tienda')}
                  >
                    ←
                  </button>
                </div>
                <div className="tiendaDetalleLayout">
                  <div className="tiendaDetalleLateralImagen">
                    <div
                      className="tiendaDetalleColImagen"
                      onTouchStart={iniciarSwipeDetalle}
                      onTouchEnd={finalizarSwipeDetalle}
                    >
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
                    <div className="tiendaDetalleResenas">
                      <div className="tiendaDetalleResenasHead">
                        <strong>Calificación del producto</strong>
                        <span>
                          {(Number(seleccionado?.resenas_total) || 0) >= 5
                            ? `Promedio ${(Number(seleccionado?.resenas_promedio) || 0).toFixed(1)} / 5`
                            : `${Number(seleccionado?.resenas_total) || 0} calificaciones`}
                        </span>
                      </div>
                      <div className="tiendaHojitasFila tiendaHojitasPromedio">
                        {pintarHojitas(Number(seleccionado?.resenas_promedio) || 0).map((activa, idx) => (
                          <span key={`prom-hoja-${idx}`} className={activa ? 'tiendaHojita activa' : 'tiendaHojita'}>🍃</span>
                        ))}
                      </div>

                      {clienteToken ? (
                        <div className="tiendaResenaForm">
                          <div className="tiendaResenaSelector">
                            {Array.from({ length: 5 }).map((_, idx) => {
                              const valor = idx + 1;
                              const activa = valor <= Number(resenaNueva.calificacion || 0);
                              return (
                                <button
                                  key={`set-hoja-${valor}`}
                                  type="button"
                                  className={activa ? 'tiendaBotonHojita activa' : 'tiendaBotonHojita'}
                                  onClick={() => setResenaNueva((prev) => ({ ...prev, calificacion: valor }))}
                                  aria-label={`Calificar con ${valor} de 5`}
                                >
                                  🍃
                                </button>
                              );
                            })}
                          </div>
                          <textarea
                            rows={3}
                            placeholder="Cuéntanos cómo te pareció este producto"
                            value={resenaNueva.comentario}
                            onChange={(e) => setResenaNueva((prev) => ({ ...prev, comentario: e.target.value }))}
                          />
                          <button
                            type="button"
                            className="boton botonExito"
                            onClick={enviarResenaProducto}
                            disabled={enviandoResena}
                          >
                            {enviandoResena ? 'Enviando...' : 'Enviar comentario'}
                          </button>
                        </div>
                      ) : (
                        <div className="tiendaVacio">Inicia sesión para dejar tu comentario.</div>
                      )}

                      <div className="tiendaListaResenas">
                        {cargandoResenas && <div className="tiendaVacio">Cargando comentarios...</div>}
                        {!cargandoResenas && !resenasDetalle.length && <div className="tiendaVacio">Aún no hay comentarios.</div>}
                        {resenasDetalle.map((resena) => (
                          <article key={`resena-${resena.id}`} className="tiendaResenaCard">
                            <div className="tiendaResenaHead">
                              <strong>{resena.nombre_cliente || 'Cliente'}</strong>
                              <div className="tiendaHojitasFila">
                                {pintarHojitas(Number(resena.calificacion) || 0).map((activa, idx) => (
                                  <span key={`resena-hoja-${resena.id}-${idx}`} className={activa ? 'tiendaHojita activa' : 'tiendaHojita'}>🍃</span>
                                ))}
                              </div>
                            </div>
                            <p>{resena.comentario}</p>
                          </article>
                        ))}
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

      {mostrarCarrito && <div className="tiendaOverlay" onClick={cerrarCarrito}></div>}

      {mostrarModalPerfilCliente && clienteToken && (
        <div className="modal" style={{ display: 'flex' }} onClick={() => setMostrarModalPerfilCliente(false)}>
          <div className="contenidoModal tiendaAuthModal tiendaPerfilModalPro" onClick={(e) => e.stopPropagation()}>
            <div className="encabezadoModal tiendaPerfilHeaderPro">
              <h3>Perfil del cliente</h3>
              <button className="cerrarModal" onClick={() => setMostrarModalPerfilCliente(false)}>&times;</button>
            </div>
            <div className="tiendaPerfilLayoutPro">
              <div className="tiendaPerfilPanelPro">
                <h4>Datos de contacto</h4>
                <div className="tiendaPerfil tiendaPerfilCamposPro">
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
                </div>
                <div className="tiendaPerfilAcciones">
                  <button className="boton botonExito" type="button" onClick={guardarPerfil}>Guardar perfil</button>
                  <button className="boton botonDanger" type="button" onClick={cerrarSesionCliente}>Cerrar sesión</button>
                </div>
              </div>

              <div className="tiendaPerfilPanelPro tiendaPerfilPanelOrdenes">
                <h4>Mis órdenes</h4>
                <div className="tiendaOrdenes tiendaOrdenesPro">
                  {ordenes.map((orden) => (
                    <div key={orden.id} className="tiendaOrdenCardPro">
                      <strong>{orden.folio}</strong>
                      <span>Pago: {orden.metodo_pago}</span>
                      <span>Total: {precio(orden.total)}</span>
                      <span>Estado: {orden.estado}</span>
                      {String(orden.estado).toLowerCase() === 'pendiente' && (
                        <button
                          className="botonPequeno botonDanger"
                          type="button"
                          onClick={async () => {
                            const ok = await mostrarConfirmacion('¿Cancelar esta orden?', 'Cancelar orden');
                            if (!ok) return;
                            try {
                              await fetchJson(`/tienda/ordenes/${orden.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${clienteToken}` } });
                              await cargarMisOrdenes();
                              mostrarNotificacion('Orden cancelada', 'exito');
                            } catch (error) {
                              mostrarNotificacion(error?.message || 'No se pudo cancelar la orden', 'error');
                            }
                          }}
                        >Cancelar</button>
                      )}
                    </div>
                  ))}
                  {!ordenes.length && <div className="tiendaVacio">Aún no tienes órdenes.</div>}
                </div>
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
                  <PasswordInput
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
                      <PasswordInput
                        placeholder="Contraseña"
                        value={credenciales.password}
                        onChange={(e) => setCredenciales((p) => ({ ...p, password: e.target.value }))}
                        required
                      />
                      <PasswordInput
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

      {!esVistaTrastienda && <footer className="tiendaFooter">
        <div className="tiendaFooterCol">
          <h4>{configTienda.footer_marca_titulo}</h4>
          <p>{configTienda.footer_marca_texto}</p>
          {!!redesDisponibles.length && (
            <div className="tiendaFooterRedes">
              {redesDisponibles.map((red) => (
                <a
                  key={`red-footer-${red.clave}`}
                  href={red.url}
                  target="_blank"
                  rel="noreferrer"
                  className="tiendaRedSocialBtn"
                  title={red.label}
                  aria-label={red.label}
                >
                  {red.icono}
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="tiendaFooterCol">
          <h4>Atención al cliente</h4>
          <p><strong>Lunes a viernes:</strong> {horariosAtencion.lunesViernes || '-'}</p>
          <p><strong>Sábado:</strong> {horariosAtencion.sabado || '-'}</p>
          <p><strong>Domingo:</strong> {horariosAtencion.domingo || '-'}</p>
          <p>{configTienda.atencion_correo}</p>
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
      </footer>}

      {!esVistaTrastienda && String(configTienda.whatsapp_numero || '').trim() && (
        <>
        {mostrarWhatsForm && (
          <div className="tiendaWhatsPanel" role="dialog" aria-label="Enviar mensaje por WhatsApp">
            <div className="tiendaWhatsPanelHead">
              <strong>Escríbenos por WhatsApp</strong>
              <button type="button" className="botonPequeno" onClick={() => setMostrarWhatsForm(false)}>Cerrar</button>
            </div>
            <input
              type="text"
              placeholder="Tu nombre"
              value={whatsForm.nombre}
              onChange={(e) => setWhatsForm((prev) => ({ ...prev, nombre: e.target.value }))}
            />
            <textarea
              rows={3}
              placeholder="Escribe tu mensaje"
              value={whatsForm.mensaje}
              onChange={(e) => setWhatsForm((prev) => ({ ...prev, mensaje: String(e.target.value || '').slice(0, 420) }))}
            />
            <div className={whatsMensajeInvalido ? 'tiendaWhatsCounter invalido' : 'tiendaWhatsCounter'}>
              {whatsMensajeTrimLen < 6
                ? `Mínimo 6 caracteres (${whatsMensajeLen}/420)`
                : `${whatsMensajeLen}/420`}
            </div>
            <div className="tiendaWhatsPanelAcciones">
              <button
                type="button"
                className="boton botonExito"
                onClick={enviarMensajeWhatsDesdePagina}
                disabled={whatsMensajeInvalido}
              >Enviar por WhatsApp</button>
              <a
                href={`https://wa.me/${String(configTienda.whatsapp_numero).replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="boton"
              >Abrir directo</a>
            </div>
          </div>
        )}
        <button
          type="button"
          className="tiendaWhatsFab"
          title="WhatsApp"
          aria-label="WhatsApp"
          onClick={() => setMostrarWhatsForm((prev) => !prev)}
        >
          <img src="/images/whatsapp.png" alt="WhatsApp" className="tiendaWhatsFabImg" />
        </button>
        </>
      )}

      {mostrarModalNuevoPunto && (
        <div className="modal tiendaModalTop" style={{ display: 'flex' }} onClick={() => setMostrarModalNuevoPunto(false)}>
          <div className="contenidoModal tiendaAuthModal tiendaAdminPuntoModal" onClick={(e) => e.stopPropagation()}>
            <div className="encabezadoModal">
              <h3>Nuevo punto de entrega</h3>
              <button className="cerrarModal" type="button" onClick={() => setMostrarModalNuevoPunto(false)}>&times;</button>
            </div>
            <form className="tiendaAdminPuntoModalForm" onSubmit={crearPuntoEntregaAdmin}>
              <input
                placeholder="Nombre del punto"
                value={nuevoPunto.nombre}
                onChange={(e) => setNuevoPunto((p) => ({ ...p, nombre: e.target.value }))}
                required
              />
              <input
                placeholder="Direccion"
                value={nuevoPunto.direccion}
                onChange={(e) => setNuevoPunto((p) => ({ ...p, direccion: e.target.value }))}
              />
              <input
                placeholder="Horario"
                value={nuevoPunto.horario}
                onChange={(e) => setNuevoPunto((p) => ({ ...p, horario: e.target.value }))}
              />
              <label className="tiendaCheckFila">
                <input
                  type="checkbox"
                  checked={Boolean(nuevoPunto.activo)}
                  onChange={(e) => setNuevoPunto((p) => ({ ...p, activo: e.target.checked }))}
                />
                Punto activo
              </label>
              <div className="tiendaAdminPuntoModalAcciones">
                <button className="boton" type="button" onClick={() => setMostrarModalNuevoPunto(false)}>Cancelar</button>
                <button className="boton botonExito" type="submit">Guardar punto</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalPunto.visible && modalPunto.data && (
        <div className="modal tiendaModalTop" style={{ display: 'flex' }} onClick={cerrarModalPunto}>
          <div className="contenidoModal tiendaAuthModal tiendaAdminPuntoModal" onClick={(e) => e.stopPropagation()}>
            <div className="encabezadoModal">
              <h3>{modalPunto.modo === 'editar' ? 'Editar punto de entrega' : 'Detalle de punto de entrega'}</h3>
              <button className="cerrarModal" type="button" onClick={cerrarModalPunto}>&times;</button>
            </div>

            {modalPunto.modo === 'ver' ? (
              <div className="tiendaAdminPuntoVista">
                <p><strong>Nombre:</strong> {modalPunto.data.nombre || 'Sin nombre'}</p>
                <p><strong>Direccion:</strong> {modalPunto.data.direccion || 'Sin direccion'}</p>
                <p><strong>Horario:</strong> {modalPunto.data.horario || 'Sin horario'}</p>
                <p><strong>Estado:</strong> {modalPunto.data.activo ? 'Activo' : 'Inactivo'}</p>
                <div className="tiendaAdminPuntoModalAcciones">
                  <button className="boton" type="button" onClick={cerrarModalPunto}>Cerrar</button>
                </div>
              </div>
            ) : (
              <form className="tiendaAdminPuntoModalForm" onSubmit={(event) => { event.preventDefault(); guardarPuntoAdmin(); }}>
                <input
                  placeholder="Nombre del punto"
                  value={modalPunto.data.nombre}
                  onChange={(e) => editarCampoModalPunto('nombre', e.target.value)}
                  required
                />
                <input
                  placeholder="Direccion"
                  value={modalPunto.data.direccion}
                  onChange={(e) => editarCampoModalPunto('direccion', e.target.value)}
                />
                <input
                  placeholder="Horario"
                  value={modalPunto.data.horario}
                  onChange={(e) => editarCampoModalPunto('horario', e.target.value)}
                />
                <label className="tiendaCheckFila">
                  <input
                    type="checkbox"
                    checked={Boolean(modalPunto.data.activo)}
                    onChange={(e) => editarCampoModalPunto('activo', e.target.checked)}
                  />
                  Punto activo
                </label>
                <div className="tiendaAdminPuntoModalAcciones">
                  <button className="boton" type="button" onClick={cerrarModalPunto}>Cancelar</button>
                  <button className="boton botonExito" type="submit">Guardar cambios</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
