import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Tienda.css';
import { API } from '../../utils/config.jsx';
import {
  configurarSonidoNotificacion,
  mostrarNotificacion,
  mostrarNotificacionNativa,
  notificacionesNativasDisponibles,
  obtenerPermisoNotificacionesNativas,
  obtenerSonidoNotificacion,
  OPCIONES_SONIDO_NOTIFICACION,
  reproducirSonidoAlerta,
  solicitarPermisoNotificacionesNativas
} from '../../utils/notificaciones.jsx';
import { mostrarConfirmacion, solicitarTextoModal } from '../../utils/modales.jsx';
import PasswordInput from '../../components/PasswordInput.jsx';
import TurnstileWidget, { turnstileFrontendActivo } from '../../components/TurnstileWidget.jsx';

const API_TIENDA = API || '';
const FETCH_TIMEOUT_MS = 15000;
const ADMIN_COOKIE_SESSION_SENTINEL = '__cookie_admin__';
const CLIENTE_COOKIE_SESSION_SENTINEL = '__cookie_cliente__';
const TURNSTILE_PUBLIC_AUTH_ENABLED = turnstileFrontendActivo();

const CLAVE_TOKEN_CLIENTE = 'tienda_cliente_token';
const CLAVE_CARRITO_TIENDA = 'tienda_carrito_v2';
const CLAVE_CUPONES_CARRITO_TIENDA = 'tienda_carrito_cupones_v2';
const CLAVE_NOTIF_PEDIDOS_ULTIMO_PROMPT = 'tienda_notif_pedidos_ultimo_prompt';
const CLAVE_TIENDA_VISTA_ACTIVA = 'chipactli:tienda:vistaActiva';
const CLAVE_TIENDA_SECCION_ACTIVA = 'chipactli:tienda:seccionActiva';
const CLAVE_TIENDA_CATEGORIA_ACTIVA = 'chipactli:tienda:categoriaActiva';
const CLAVE_TIENDA_FAVORITOS_PREFIJO = 'chipactli:vitrina:favoritos';
const CLAVE_TRASTIENDA_VISTA_ADMIN = 'chipactli:trastienda:adminVista';
const CLAVE_TRASTIENDA_CONFIG_TAB = 'chipactli:trastienda:configAdminTab';
const CLAVE_TRASTIENDA_DESCUENTOS_TAB = 'chipactli:trastienda:descuentoTabInterna';
const TRASTIENDA_VISTAS = [
  { id: 'pedidos', label: 'Pedidos', accion: 'pedidos' },
  { id: 'clientes', label: 'Clientes', accion: 'clientes' },
  { id: 'puntos', label: 'Puntos de entrega', accion: 'puntos' },
  { id: 'catalogo', label: 'Catalogo', accion: 'catalogo' },
  { id: 'descuentos', label: 'Descuentos', accion: 'descuentos' },
  { id: 'cupones', label: 'Cupones', accion: 'cupones' },
  { id: 'metricas', label: 'Metricas', accion: 'metricas' },
  { id: 'config', label: 'Configuracion', accion: 'config' }
];
const CLAVE_MP_CHECKOUT_PENDIENTE = 'chipactli:tienda:mp-checkout-pendiente';
const CLAVE_VISITA_SESION_ID = 'chipactli:visita:sesion-id';
const OCULTAR_MERCADO_PAGO = true;
const EXPIRACION_CARRITO_INVITADO_MS = 24 * 60 * 60 * 1000;
const SINCRONIZACION_CARRITO_DEBOUNCE_MS = 400;
const SINCRONIZACION_CARRITO_PULL_MS = 9000;
const SECCIONES_INFO_LINKS = [
  { idx: 2, titulo: 'Nosotros' },
  { idx: 4, titulo: 'Términos y condiciones' },
  { idx: 5, titulo: 'Aviso de privacidad' }
];
const METODOS_PAGO_BASE = [
  { id: 'visa', label: 'Visa', activo: '1', logo_url: '/images/visa-logo.svg' },
  { id: 'mastercard', label: 'MasterCard', activo: '1', logo_url: '/images/mastercard.svg' },
  { id: 'amex', label: 'AMEX', activo: '1', logo_url: '/images/amex-logo.svg' },
  { id: 'mercado_pago', label: 'Mercado Pago', activo: '1', logo_url: '/images/mercado-pago-badge.svg' },
  { id: 'paypal', label: 'PayPal', activo: '0', logo_url: '' },
  { id: 'oxxo', label: 'OXXO', activo: '0', logo_url: '' },
  { id: 'spei', label: 'SPEI / Transferencia', activo: '1', logo_url: '' },
  { id: 'debito_credito', label: 'Tarjeta Débito/Crédito', activo: '1', logo_url: '' },
  { id: 'apple_pay', label: 'Apple Pay', activo: '0', logo_url: '' },
  { id: 'google_pay', label: 'Google Pay', activo: '0', logo_url: '' },
  { id: 'kueski_pay', label: 'Kueski Pay', activo: '0', logo_url: '' },
  { id: 'a_plazos', label: 'Pago a plazos', activo: '0', logo_url: '' }
];
const METODOS_PAGO_BASE_SERIALIZADO = JSON.stringify(METODOS_PAGO_BASE);
const CONFIG_DEFAULT = {
  promo_texto: '',
  footer_marca_titulo: 'CHIPACTLI',
  footer_marca_texto: 'Formulamos productos artesanales para el cuidado personal de forma segura y consciente.',
  atencion_horario_lunes_viernes: '',
  atencion_horario_sabado: '',
  atencion_horario_lunes_sabado: '',
  atencion_horario_domingo: '',
  atencion_correo: '',
  transferencia_clabe: '',
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
  footer_pagos_logo_url: '/images/visa-logo.svg',
  footer_pagos_logos: '/images/visa-logo.svg\n/images/mastercard.svg\n/images/amex-logo.svg\n/images/mercado-pago-badge.svg',
  footer_pagos_metodos: METODOS_PAGO_BASE_SERIALIZADO,
  footer_pagos_remover_fondo_png: '1',
  menu_todos_activo: '1',
  menu_lanzamientos_activo: '1',
  menu_favoritos_activo: '1',
  menu_ofertas_activo: '1',
  menu_accesorios_activo: '1',
  menu_categoria_activo: '1',
  menu_tabs_personalizadas: '[]',
  menu_tabs_base_eliminadas: '[]',
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
  info_link_5_activo: '1',
  correo_bienvenida_asunto: 'Bienvenido a CHIPACTLI, {{nombre_cliente}}',
  correo_bienvenida_cuerpo: 'Hola {{nombre_cliente}},\n\nTu cuenta fue creada con éxito.\nYa puedes iniciar sesión y comprar en nuestra vitrina.\n\nIr a la vitrina: {{url_tienda}}\n\nGracias por unirte a CHIPACTLI.',
  correo_confirmacion_asunto: 'Confirmacion de pedido {{folio}}',
  correo_confirmacion_cuerpo: 'Hola {{nombre_cliente}},\n\nRecibimos tu pedido {{folio}} correctamente.\n\nResumen:\nTotal: {{total}}\nMetodo de pago: {{metodo_pago}}\n{{clabe_transferencia_linea}}\nPunto de entrega: {{punto_entrega}}\n{{direccion_entrega}}\n\nDetalle del pedido:\n{{detalle_items}}\n\nImportante:\nRealiza tu transferencia usando la CLABE indicada y guarda tu comprobante.\nEn cuanto se confirme el pago, te notificaremos el siguiente avance de tu pedido.\n\nGracias por tu compra en CHIPACTLI.',
  correo_confirmacion_cuerpo_contraentrega: 'Hola {{nombre_cliente}},\n\nRecibimos tu pedido {{folio}}.\n{{estado_preparacion_linea}}\n\nResumen:\nTotal: {{total}}\nMetodo de pago: {{metodo_pago}}\nPunto de entrega: {{punto_entrega}}\n{{direccion_entrega}}\n\nDetalle del pedido:\n{{detalle_items}}\n\nGracias por tu compra en CHIPACTLI.',
  correo_estado_asunto: 'Actualizacion de pedido {{folio}}: {{estado_titulo}}',
  correo_estado_cuerpo: 'Hola {{nombre_cliente}},\n\nTu pedido {{folio}} cambio de estado.\nEstado actual: {{estado_titulo}}\n{{mensaje_estado}}\nTotal: {{total}}\nMetodo de pago: {{metodo_pago}}\nPunto de entrega: {{punto_entrega}}\n{{paqueteria_linea}}\n{{guia_linea}}\n\nGracias por comprar en CHIPACTLI.',
  correo_diagnostico_asunto: 'Diagnostico correo CHIPACTLI{{etiqueta_sufijo}}',
  correo_diagnostico_cuerpo: 'Hola {{nombre_admin}},\n\nEste es un correo de diagnostico del modulo de pedidos de CHIPACTLI.\nFecha: {{fecha}}\nSMTP host: {{smtp_host}}\nUsuario SMTP: {{smtp_user}}\n\nSi recibiste este correo, el envio SMTP esta funcionando.',
  correo_campana_asunto: 'Novedades CHIPACTLI: {{titulo_campana}}',
  correo_campana_cuerpo: 'Hola {{nombre_cliente}},\n\n{{contenido_campana}}\n\nVisita nuestra vitrina: {{url_tienda}}\n\nGracias por seguir a CHIPACTLI.',
  correo_campana_titulo: 'Novedades CHIPACTLI',
  correo_campana_contenido: '',
  correo_campana_imagen_url: '',
  servicio_domicilio_habilitado: '0',
  atencion_asuntos: 'Consulta de pedido\nCambio de dirección\nIncidencia con producto\nSugerencia\nOtro'
};

const PUNTO_ENTREGA_DEFAULT = { nombre: '', direccion: '', horario: '', activo: true };
const DIRECCION_CLIENTE_DEFAULT = { alias: 'Casa', direccion: '', referencias: '', es_preferida: true };
const CUPON_ADMIN_DEFAULT = {
  codigo: '',
  nombre: '',
  tipo: 'general',
  alcance_tipo: 'todos',
  alcance_clave: '',
  influencer_nombre: '',
  influencer_handle: '',
  tipo_descuento: 'porcentaje',
  valor_descuento: 0,
  monto_minimo: 0,
  max_descuento: 0,
  usos_maximos_total: 0,
  usos_maximos_por_cliente: 0,
  un_solo_uso_por_cliente: false,
  vigente_indefinido: true,
  valido_desde: '',
  valido_hasta: '',
  activo: true
};
const ATENCION_ASUNTOS = [
  'Consulta de pedido',
  'Cambio de dirección',
  'Incidencia con producto',
  'Sugerencia',
  'Otro'
];

const ESTATUS_PEDIDO_OPCIONES = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'procesando', label: 'Procesando' },
  { value: 'listo_para_envio', label: 'Listo para envío' },
  { value: 'enviado_por_paqueteria', label: 'Enviado por paquetería' },
  { value: 'en_transito', label: 'En tránsito' },
  { value: 'en_reparto_local', label: 'En reparto local' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'no_entregado', label: 'No entregado' },
  { value: 'devuelto', label: 'Devuelto' },
  { value: 'cancelado', label: 'Cancelado' }
];

const ESTATUS_PAGO_OPCIONES = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'pendiente_manual', label: 'Pendiente (manual)' },
  { value: 'pagado', label: 'Pagado' },
  { value: 'rechazado', label: 'Rechazado' },
  { value: 'reembolsado', label: 'Reembolsado' }
];

const PAQUETERIAS_MX = [
  { value: 'dhl', label: 'DHL' },
  { value: 'fedex', label: 'FedEx' },
  { value: 'estafeta', label: 'Estafeta' },
  { value: 'redpack', label: 'Redpack' },
  { value: 'paquetexpress', label: 'Paquetexpress' },
  { value: 'castores', label: 'Transportes Castores' },
  { value: 'tresguerras', label: 'Tresguerras' },
  { value: 'sendex', label: 'Sendex' },
  { value: 'jtexpress', label: 'JT Express' },
  { value: '99minutos', label: '99 Minutos' },
  { value: 'ampm', label: 'AMPM' },
  { value: 'correos_demexico', label: 'Correos de México' },
  { value: 'otra', label: 'Otra paquetería' }
];

const PAQUETERIA_TRACKING_URLS = {
  dhl: 'https://www.dhl.com/mx-es/home/rastreo.html?tracking-id={guia}',
  fedex: 'https://www.fedex.com/fedextrack/?trknbr={guia}',
  estafeta: 'https://rastreo.estafeta.com/Rastreo/?tracking={guia}',
  redpack: 'https://www.redpack.com.mx/es/rastreo/?guias={guia}',
  paquetexpress: 'https://www.paquetexpress.com.mx/rastreo/?guia={guia}',
  castores: 'https://www.castores.com.mx/rastreo/?guia={guia}',
  tresguerras: 'https://www.tresguerras.com.mx/seguimiento?guia={guia}',
  sendex: 'https://sendex.mx/rastreo/?guia={guia}',
  jtexpress: 'https://www.jtexpress.mx/track?billcode={guia}',
  '99minutos': 'https://track.99minutos.com/?guide={guia}',
  ampm: 'https://ampm.com.mx/',
  correos_demexico: 'https://www.correosdemexico.gob.mx/SSLServicios/SeguimientoEnvio/Seguimiento.aspx'
};
const EXTENSIONES_VIDEO_TIENDA = /\.(mp4|webm|ogg|ogv|mov|m4v)(?:[?#].*)?$/i;

function esUrlVideoTienda(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return false;
  const sinHash = raw.split('#')[0] || '';
  const sinQuery = sinHash.split('?')[0] || '';
  return EXTENSIONES_VIDEO_TIENDA.test(sinQuery) || raw.startsWith('data:video/');
}

function leerValorPersistido(clave, valorPorDefecto) {
  try {
    const valor = String(localStorage.getItem(clave) || '').trim();
    return valor || valorPorDefecto;
  } catch {
    return valorPorDefecto;
  }
}

function leerValorPersistidoPermitido(clave, permitidos, valorPorDefecto) {
  const valor = leerValorPersistido(clave, valorPorDefecto);
  return permitidos.includes(valor) ? valor : valorPorDefecto;
}

function guardarValorPersistido(clave, valor) {
  try {
    localStorage.setItem(clave, String(valor || ''));
  } catch {
  }
}

function leerRutaPublicaTiendaDesdeUrl() {
  if (typeof window === 'undefined') return null;
  const pathname = String(window.location.pathname || '/').trim().toLowerCase();

  if (pathname === '/vitrina' || pathname.startsWith('/vitrina/') || pathname === '/tienda' || pathname.startsWith('/tienda/')) {
    const params = new URLSearchParams(String(window.location.search || ''));
    return {
      categoria: String(params.get('categoria') || 'todas').trim().toLowerCase() || 'todas',
      producto: String(params.get('producto') || '').trim(),
      info: String(params.get('info') || '').trim().toLowerCase()
    };
  }

  const hashRaw = String(window.location.hash || '').trim();
  if (hashRaw.startsWith('#/vitrina')) {
    const idxQuery = hashRaw.indexOf('?');
    const params = new URLSearchParams(idxQuery >= 0 ? hashRaw.slice(idxQuery + 1) : '');
    return {
      categoria: String(params.get('categoria') || 'todas').trim().toLowerCase() || 'todas',
      producto: String(params.get('producto') || '').trim(),
      info: String(params.get('info') || '').trim().toLowerCase()
    };
  }
  if (!hashRaw.startsWith('#/tienda')) return null;
  const idxQuery = hashRaw.indexOf('?');
  const params = new URLSearchParams(idxQuery >= 0 ? hashRaw.slice(idxQuery + 1) : '');
  return {
    categoria: String(params.get('categoria') || 'todas').trim().toLowerCase() || 'todas',
    producto: String(params.get('producto') || '').trim(),
    info: String(params.get('info') || '').trim().toLowerCase()
  };
}

function construirRutaPublicaTienda(ruta = {}) {
  const params = new URLSearchParams();
  const categoria = String(ruta?.categoria || 'todas').trim().toLowerCase() || 'todas';
  const producto = String(ruta?.producto || '').trim();
  const info = String(ruta?.info || '').trim().toLowerCase();

  if (categoria && categoria !== 'todas') params.set('categoria', categoria);
  if (producto) params.set('producto', producto);
  if (!producto && info) params.set('info', info);

  return `/vitrina${params.toString() ? `?${params.toString()}` : ''}`;
}

function actualizarRutaPublicaTiendaHash(ruta = {}, opciones = {}) {
  if (typeof window === 'undefined') return;
  const siguiente = construirRutaPublicaTienda(ruta);
  const actual = `${window.location.pathname}${window.location.search}`;
  if (siguiente === actual) return;

  if (opciones?.replace) {
    window.history.replaceState({}, document.title, siguiente);
    return;
  }

  window.history.pushState({}, document.title, siguiente);
}

function construirLinkCompartirProducto(producto = null) {
  if (typeof window === 'undefined') return '';
  const slugRaw = String(producto?.slug || producto?.nombre_receta || '').trim();
  const slug = slugRaw.includes('%')
    ? slugRaw
    : (slugPestanaMenu(slugRaw) || slugRaw);
  if (!slug) return '';

  return `${window.location.origin}${construirRutaPublicaTienda({ producto: slug })}`;
}

function obtenerSesionVisitaId() {
  try {
    const actual = String(localStorage.getItem(CLAVE_VISITA_SESION_ID) || '').trim();
    if (actual) return actual;
    const generado = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `visita-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CLAVE_VISITA_SESION_ID, generado);
    return generado;
  } catch {
    return `visita-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function etiquetaEstadoPedido(estado) {
  const clave = String(estado || '').trim().toLowerCase();
  const match = ESTATUS_PEDIDO_OPCIONES.find((item) => item.value === clave);
  return match ? match.label : (clave || '-');
}

function etiquetaPaqueteria(paqueteria) {
  const clave = String(paqueteria || '').trim().toLowerCase();
  const match = PAQUETERIAS_MX.find((item) => item.value === clave);
  return match ? match.label : (clave || 'Sin paquetería');
}

function etiquetaEstadoPago(estadoPago) {
  const clave = String(estadoPago || '').trim().toLowerCase();
  const match = ESTATUS_PAGO_OPCIONES.find((item) => item.value === clave);
  return match ? match.label : (clave || 'Pendiente');
}

function etiquetaOrigenPedido(origenPedido) {
  const origen = String(origenPedido || '').trim().toLowerCase();
  return origen === 'app' ? 'App' : 'Web';
}

function resolverOrigenPedidoCliente() {
  if (typeof window === 'undefined') return 'web';
  try {
    if (window.__chipactliApp === true || window.__chipactliOrigenPedido === 'app') return 'app';

    const capacitor = window.Capacitor;
    if (capacitor && typeof capacitor.isNativePlatform === 'function' && capacitor.isNativePlatform()) {
      return 'app';
    }
    if (capacitor && typeof capacitor.getPlatform === 'function') {
      const plataforma = String(capacitor.getPlatform() || '').trim().toLowerCase();
      if (plataforma && plataforma !== 'web') return 'app';
    }

    const userAgent = String(window.navigator?.userAgent || '').toLowerCase();
    const esWebViewMovil = /android|iphone|ipad|ipod/.test(userAgent) && /wv|version\/4\.0|; wv\)/.test(userAgent);
    return esWebViewMovil ? 'app' : 'web';
  } catch {
    return 'web';
  }
}

function construirLinkRastreo(paqueteria, numeroGuia) {
  const clave = String(paqueteria || '').trim().toLowerCase();
  const guia = String(numeroGuia || '').trim();
  if (!clave || !guia) return '';
  const plantilla = PAQUETERIA_TRACKING_URLS[clave] || '';
  if (!plantilla) return '';
  if (plantilla.includes('{guia}')) {
    return plantilla.replace('{guia}', encodeURIComponent(guia));
  }
  return plantilla;
}

function mensajeEstadoPedidoCliente(estado) {
  const clave = String(estado || '').trim().toLowerCase();
  if (clave === 'confirmado') return 'Tu pedido fue confirmado por nuestro equipo.';
  if (clave === 'enviado_por_paqueteria') return 'Tu pedido ya fue enviado por paquetería.';
  if (clave === 'en_transito') return 'Tu pedido va en camino.';
  if (clave === 'entregado') return 'Tu pedido fue entregado.';
  if (clave === 'cancelado') return 'Tu pedido fue cancelado.';
  return `Tu pedido cambió a ${etiquetaEstadoPedido(clave)}.`;
}

function tituloEstadoPedidoCliente(estado) {
  const clave = String(estado || '').trim().toLowerCase();
  if (clave === 'confirmado') return 'Pedido confirmado';
  if (clave === 'enviado_por_paqueteria') return 'Pedido enviado';
  if (clave === 'en_transito') return 'Pedido en tránsito';
  if (clave === 'entregado') return 'Pedido entregado';
  if (clave === 'cancelado') return 'Pedido cancelado';
  return 'Pedido actualizado';
}

function pedidoEstaCerrado(estado) {
  const clave = String(estado || '').trim().toLowerCase();
  return clave === 'entregado' || clave === 'cancelado' || clave === 'devuelto' || clave === 'no_entregado';
}

function configActivo(valor, predeterminado = true) {
  if (valor === undefined || valor === null || valor === '') return predeterminado;
  const txt = String(valor).trim().toLowerCase();
  return !(txt === '0' || txt === 'false' || txt === 'no' || txt === 'off');
}

function obtenerAsuntosAtencionConfig(valor) {
  const raw = String(valor || '').trim();
  const lista = raw
    .split(/\r?\n|,|;/)
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  const unicos = Array.from(new Set(lista));
  return unicos.length ? unicos : [...ATENCION_ASUNTOS];
}

function slugPestanaMenu(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}

function obtenerIdentificadorFavoritoProducto(producto = null) {
  const slug = String(producto?.slug || '').trim();
  if (slug) return `slug:${slug.toLowerCase()}`;

  const nombre = slugPestanaMenu(String(producto?.nombre_receta || producto?.nombre || '').trim());
  if (nombre) return `nombre:${nombre}`;

  return '';
}

function productoPaqueteDisponibleTienda(producto = null) {
  const tipo = String(producto?.tipo_producto || '').trim().toLowerCase();
  if (tipo !== 'paquete') return false;
  const visible = producto?.visible_publico == null ? true : Boolean(producto?.visible_publico);
  const detalles = Array.isArray(producto?.paquete_detalle) ? producto.paquete_detalle : [];
  return visible && detalles.length > 0;
}

function obtenerClaveFavoritosVitrina(idCliente = 0) {
  const idNormalizado = Number(idCliente) || 0;
  return `${CLAVE_TIENDA_FAVORITOS_PREFIJO}:${idNormalizado || 'invitado'}`;
}

function cargarFavoritosVitrina(idCliente = 0) {
  try {
    const raw = localStorage.getItem(obtenerClaveFavoritosVitrina(idCliente));
    const lista = JSON.parse(String(raw || '[]'));
    if (!Array.isArray(lista)) return [];
    return lista
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function obtenerTabsNavegacionConfig(valor) {
  let lista = [];
  try {
    const parseado = JSON.parse(String(valor || '[]'));
    lista = Array.isArray(parseado) ? parseado : [];
  } catch {
    lista = [];
  }

  return lista
    .map((item, idx) => {
      const label = String(item?.label || '').trim();
      const categoria = String(item?.categoria || '').trim();
      const activo = String(item?.activo ?? '1').trim() !== '0';
      if (!label || !categoria) return null;
      const idBase = String(item?.id || '').trim();
      const id = idBase || slugPestanaMenu(`${label}-${categoria}-${idx + 1}`) || `tab-${idx + 1}`;
      return { id, label, categoria, activo };
    })
    .filter(Boolean);
}

function obtenerTabsBaseEliminadasConfig(valor) {
  try {
    const parseado = JSON.parse(String(valor || '[]'));
    if (!Array.isArray(parseado)) return [];
    return Array.from(new Set(parseado.map((item) => String(item || '').trim()).filter(Boolean)));
  } catch {
    return [];
  }
}

function obtenerLogosPagoConfig(valor) {
  return String(valor || '')
    .split(/\r?\n|,|;/)
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function normalizarMetodoPagoItem(item, idx = 0) {
  const idBase = String(item?.id || item?.label || `metodo-${idx + 1}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  const id = idBase || `metodo-${idx + 1}`;
  return {
    id,
    label: String(item?.label || '').trim() || `Método ${idx + 1}`,
    activo: String(item?.activo ?? '1') === '0' ? '0' : '1',
    logo_url: String(item?.logo_url || '').trim()
  };
}

function serializarMetodosPagoConfig(lista = []) {
  return JSON.stringify((Array.isArray(lista) ? lista : []).map((item, idx) => normalizarMetodoPagoItem(item, idx)));
}

function obtenerNombrePerfilRed(url, clave = '') {
  const limpio = String(url || '').trim();
  if (!limpio) return '';

  try {
    const parsed = new URL(limpio);
    const segmentos = String(parsed.pathname || '').split('/').filter(Boolean);
    const ultimo = String(segmentos[segmentos.length - 1] || '').trim();
    if (ultimo && !/^(share|reel|p|watch|video|videos)$/i.test(ultimo)) {
      return decodeURIComponent(ultimo).replace(/^@+/, '@');
    }
  } catch {
    // Ignorar: continuar con fallback.
  }

  const red = String(clave || '').trim().toLowerCase();
  if (!red) return '@perfil';
  if (red === 'x') return '@perfil_x';
  return `@${red}`;
}

function fechaLocalIsoHoy() {
  const ahora = new Date();
  const yyyy = ahora.getFullYear();
  const mm = String(ahora.getMonth() + 1).padStart(2, '0');
  const dd = String(ahora.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function fechaIsoDesdeDate(fecha) {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return '';
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function obtenerInicioSemanaDomingo(fechaIso = '') {
  const fecha = new Date(`${String(fechaIso || '').trim()}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return '';
  fecha.setDate(fecha.getDate() - fecha.getDay());
  return fechaIsoDesdeDate(fecha);
}

function sumarDiasFechaIso(fechaIso = '', dias = 0) {
  const fecha = new Date(`${String(fechaIso || '').trim()}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return '';
  fecha.setDate(fecha.getDate() + (Number(dias) || 0));
  return fechaIsoDesdeDate(fecha);
}

function obtenerMetodosPagoConfig(valor, config = {}) {
  try {
    const parseado = JSON.parse(String(valor || '[]'));
    if (Array.isArray(parseado) && parseado.length) {
      return parseado.map((item, idx) => normalizarMetodoPagoItem(item, idx));
    }
  } catch {
    // Fallback a configuración legacy.
  }

  const base = METODOS_PAGO_BASE.map((item, idx) => normalizarMetodoPagoItem(item, idx));
  const logosLegacy = obtenerLogosPagoConfig(config?.footer_pagos_logos);
  if (!logosLegacy.length) return base;

  const mapaPorId = new Map(base.map((item) => [item.id, { ...item }]));
  const noAsignados = [];
  logosLegacy.forEach((url) => {
    const txt = String(url || '').toLowerCase();
    if (txt.includes('visa')) {
      mapaPorId.get('visa').logo_url = url;
      return;
    }
    if (txt.includes('master')) {
      mapaPorId.get('mastercard').logo_url = url;
      return;
    }
    if (txt.includes('amex') || txt.includes('american')) {
      mapaPorId.get('amex').logo_url = url;
      return;
    }
    if (txt.includes('mercado')) {
      mapaPorId.get('mercado_pago').logo_url = url;
      return;
    }
    if (txt.includes('paypal')) {
      mapaPorId.get('paypal').logo_url = url;
      return;
    }
    if (txt.includes('oxxo')) {
      mapaPorId.get('oxxo').logo_url = url;
      return;
    }
    noAsignados.push(url);
  });

  const lista = Array.from(mapaPorId.values());
  let cursor = 0;
  for (let i = 0; i < lista.length && cursor < noAsignados.length; i += 1) {
    if (lista[i].logo_url) continue;
    lista[i].logo_url = noAsignados[cursor];
    cursor += 1;
  }
  return lista;
}

function metodoPagoOculto(idMetodo = '') {
  const id = String(idMetodo || '').trim().toLowerCase();
  return OCULTAR_MERCADO_PAGO && id === 'mercado_pago';
}

function esLogoPng(ruta = '') {
  const txt = String(ruta || '').trim().toLowerCase();
  if (!txt) return false;
  const limpio = txt.split('?')[0].split('#')[0];
  return limpio.endsWith('.png');
}

async function removerFondoBlancoPng(url = '', umbral = 245) {
  const src = String(url || '').trim();
  if (!src) return '';

  const imagen = await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar imagen para limpiar fondo.'));
    img.src = src;
  });

  const width = Number(imagen.naturalWidth || imagen.width) || 0;
  const height = Number(imagen.naturalHeight || imagen.height) || 0;
  if (!width || !height) return '';

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';

  ctx.drawImage(imagen, 0, 0, width, height);
  const frame = ctx.getImageData(0, 0, width, height);
  const px = frame.data;

  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const a = px[i + 3];
    if (a === 0) continue;

    const esCasiBlanco = r >= umbral && g >= umbral && b >= umbral;
    if (esCasiBlanco) {
      px[i + 3] = 0;
    }
  }

  ctx.putImageData(frame, 0, 0);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = ((y * width) + x) * 4;
      const alpha = px[idx + 3];
      if (alpha <= 8) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  let outputCanvas = canvas;
  if (maxX >= minX && maxY >= minY) {
    const padding = 2;
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropW = Math.min(width - cropX, (maxX - minX + 1) + (padding * 2));
    const cropH = Math.min(height - cropY, (maxY - minY + 1) + (padding * 2));

    const recorte = document.createElement('canvas');
    recorte.width = Math.max(1, cropW);
    recorte.height = Math.max(1, cropH);
    const recorteCtx = recorte.getContext('2d');
    if (recorteCtx) {
      recorteCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      outputCanvas = recorte;
    }
  }

  const blob = await new Promise((resolve) => outputCanvas.toBlob(resolve, 'image/png'));
  if (!blob) return '';
  return URL.createObjectURL(blob);
}

function apiUrl(path) {
  const ruta = String(path || '').trim();
  return `${API_TIENDA}${ruta}`;
}

function normalizarUrlMediaTienda(valor) {
  const txt = String(valor || '').trim();
  if (!txt) return '';
  if (/^https?:\/\//i.test(txt)) return txt;
  if (txt.startsWith('/uploads/')) return apiUrl(txt);
  if (txt.startsWith('uploads/')) return apiUrl(`/${txt}`);
  return txt;
}

function normalizarClaveCategoriaTienda(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokenPareceJwt(token = '') {
  return String(token || '').trim().split('.').length === 3;
}

async function fetchJson(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const headers = new Headers(options?.headers || {});
  const authActual = String(headers.get('Authorization') || '').trim();
  if (authActual.startsWith('Bearer ') && !tokenPareceJwt(authActual.slice(7).trim())) {
    headers.delete('Authorization');
  }

  let respuesta;
  try {
    respuesta = await fetch(apiUrl(path), {
      ...options,
      headers,
      credentials: typeof options?.credentials === 'undefined' ? 'include' : options.credentials,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('La conexion tardo demasiado. Revisa la red del dispositivo y vuelve a intentar.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  const data = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const base = data?.mensaje || data?.error || `Error HTTP ${respuesta.status}`;
    const detalle = String(data?.detalle || data?.motivo || '').trim();
    throw new Error(detalle ? `${base}: ${detalle}` : base);
  }
  return data;
}

function esCorreoValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || '').trim());
}

function headersClienteSesion(base = {}, token = '') {
  if (!tokenPareceJwt(token)) return { ...base };
  return {
    ...base,
    Authorization: `Bearer ${token}`
  };
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
        precio_original: Number(item?.precio_original) || Number(item?.precio_venta) || 0,
        stock: Number(item?.stock) || 0,
        disponible: Boolean(item?.disponible) || (Number(item?.stock) || 0) > 0,
        gramaje: Number(item?.gramaje) || 0,
        descuento_porcentaje: Number(item?.descuento_porcentaje) || 0,
        descuento_activo: Boolean(item?.descuento_activo)
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
    return { items: [], creadoEn: Date.now(), actualizadoEn: Date.now(), cuponesAplicados: [] };
  }

  try {
    const raw = localStorage.getItem(CLAVE_CARRITO_TIENDA);
    const rawCupones = localStorage.getItem(CLAVE_CUPONES_CARRITO_TIENDA);
    const cuponesRaw = rawCupones ? JSON.parse(rawCupones) : [];
    const cuponesAplicados = Array.isArray(cuponesRaw)
      ? cuponesRaw
      : (cuponesRaw && String(cuponesRaw?.codigo || '').trim() ? [cuponesRaw] : []);
    if (!raw) return { items: [], creadoEn: Date.now(), actualizadoEn: Date.now(), cuponesAplicados };

    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const creadoEn = Number(parsed?.creadoEn) || Date.now();
    const actualizadoEn = Number(parsed?.actualizadoEn) || Date.now();
    if (!items.length) return { items: [], creadoEn: Date.now(), actualizadoEn: Date.now(), cuponesAplicados: [] };

    if (!esCliente && (Date.now() - creadoEn > EXPIRACION_CARRITO_INVITADO_MS)) {
      return { items: [], creadoEn: Date.now(), actualizadoEn: Date.now(), cuponesAplicados: [] };
    }

    return { items, creadoEn, actualizadoEn, cuponesAplicados };
  } catch {
    return { items: [], creadoEn: Date.now(), actualizadoEn: Date.now(), cuponesAplicados: [] };
  }
}

function guardarCarritoGuardado(items, creadoEn, cuponesAplicados = []) {
  if (typeof window === 'undefined') return;
  if (!Array.isArray(items) || !items.length) {
    localStorage.removeItem(CLAVE_CARRITO_TIENDA);
    localStorage.removeItem(CLAVE_CUPONES_CARRITO_TIENDA);
    return;
  }

  localStorage.setItem(CLAVE_CARRITO_TIENDA, JSON.stringify({
    items,
    creadoEn: Number(creadoEn) || Date.now(),
    actualizadoEn: Date.now()
  }));

  const cuponesValidos = (Array.isArray(cuponesAplicados) ? cuponesAplicados : [])
    .filter((cup) => String(cup?.codigo || '').trim());
  if (cuponesValidos.length) {
    localStorage.setItem(CLAVE_CUPONES_CARRITO_TIENDA, JSON.stringify(cuponesValidos));
  } else {
    localStorage.removeItem(CLAVE_CUPONES_CARRITO_TIENDA);
  }
}

function normalizarItemCarritoCliente(item) {
  const clave = String(item?.clave || '').trim();
  const nombreReceta = String(item?.nombre_receta || '').trim();
  if (!clave || !nombreReceta) return null;

  const cantidad = Math.max(1, Math.min(999, Number(item?.cantidad) || 1));
  const precioUnitario = Math.max(0, Number(item?.precio_unitario) || 0);
  return {
    clave,
    nombre_receta: nombreReceta,
    nombre_base: String(item?.nombre_base || '').trim(),
    categoria_nombre: String(item?.categoria_nombre || '').trim(),
    image_url: String(item?.image_url || '').trim(),
    descripcion_mp: String(item?.descripcion_mp || '').trim(),
    slug: String(item?.slug || '').trim(),
    variante: String(item?.variante || '').trim(),
    cantidad,
    precio_unitario: precioUnitario,
    subtotal: Number((cantidad * precioUnitario).toFixed(2))
  };
}

function normalizarListaCarritoCliente(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => normalizarItemCarritoCliente(item))
    .filter(Boolean)
    .slice(0, 250);
}

function serializarCarritoCliente(items) {
  return JSON.stringify(normalizarListaCarritoCliente(items));
}

function marcaTiempoMs(valor) {
  if (typeof valor === 'number' && Number.isFinite(valor) && valor > 0) return valor;
  if (!valor) return 0;
  const ms = Date.parse(String(valor));
  return Number.isFinite(ms) ? ms : 0;
}

function extraerIdClienteToken(token) {
  try {
    const partes = String(token || '').split('.');
    if (partes.length < 2) return 0;
    const base64 = partes[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(base64 + padding));
    return Number(payload?.id) || 0;
  } catch {
    return 0;
  }
}

function Tienda({
  modo = 'tienda',
  mostrarLogoAccesoSistema = false,
  onClickLogoAccesoSistema = null,
  mostrarAccesoRapidoPwa = false,
  onActivarAccesoRapidoPwa = null,
  integradaEnPanelInterno = false
}) {
  const esVistaTrastienda = modo === 'trastienda';
  const [productos, setProductos] = useState([]);
  const [vistaActiva, setVistaActiva] = useState(() => (esVistaTrastienda
    ? 'trastienda'
    : leerValorPersistidoPermitido(CLAVE_TIENDA_VISTA_ACTIVA, ['tienda', 'detalle', 'info'], 'tienda')));
  const [seccionActiva, setSeccionActiva] = useState(() => leerValorPersistido(CLAVE_TIENDA_SECCION_ACTIVA, 'todos'));
  const [categoriaActiva, setCategoriaActiva] = useState(() => leerValorPersistido(CLAVE_TIENDA_CATEGORIA_ACTIVA, 'todas'));
  const [categoriasAdmin, setCategoriasAdmin] = useState([]);
  const [cargandoCategoriasAdmin, setCargandoCategoriasAdmin] = useState(false);
  const [subiendoImagenCategoriaId, setSubiendoImagenCategoriaId] = useState(0);
  const [categoriaEntrandoKey, setCategoriaEntrandoKey] = useState('');
  const [categoriaFlashKey, setCategoriaFlashKey] = useState('');
  const [animandoEntradaCategoria, setAnimandoEntradaCategoria] = useState(false);
  const [transicionCategoriaVentana, setTransicionCategoriaVentana] = useState({
    activa: false,
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    imageUrl: '',
    label: ''
  });
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
  const [mostrarMenuMovil, setMostrarMenuMovil] = useState(false);
  const [pasoCheckout, setPasoCheckout] = useState(1);
  const [creandoOrden, setCreandoOrden] = useState(false);
  const [procesandoPagoMp, setProcesandoPagoMp] = useState(false);
  const [modoAuth, setModoAuth] = useState('login');
  const [mostrarModalAuthCliente, setMostrarModalAuthCliente] = useState(false);
  const [enviandoAuthCliente, setEnviandoAuthCliente] = useState(false);
  const [errorAuthCliente, setErrorAuthCliente] = useState('');
  const [sacudirAuthCliente, setSacudirAuthCliente] = useState(false);
  const [clienteTurnstileToken, setClienteTurnstileToken] = useState('');
  const [clienteTurnstileResetKey, setClienteTurnstileResetKey] = useState(0);
  const [mostrarPanelRecuperarCliente, setMostrarPanelRecuperarCliente] = useState(false);
  const [recuperarClienteEmail, setRecuperarClienteEmail] = useState('');
  const [enviandoRecuperacionCliente, setEnviandoRecuperacionCliente] = useState(false);
  const [recuperacionClienteMensaje, setRecuperacionClienteMensaje] = useState('');
  const [recuperacionTurnstileToken, setRecuperacionTurnstileToken] = useState('');
  const [recuperacionTurnstileResetKey, setRecuperacionTurnstileResetKey] = useState(0);
  const [modalCambioPasswordCliente, setModalCambioPasswordCliente] = useState({ visible: false, nueva: '', confirmar: '', guardando: false, cerrarSesiones: true });
  const [mostrarModalPerfilCliente, setMostrarModalPerfilCliente] = useState(false);
  const [pasoRegistro, setPasoRegistro] = useState(1);
  const passwordLoginRef = useRef(null);
  const [credenciales, setCredenciales] = useState({
    nombre: '',
    apellido_paterno: '',
    apellido_materno: '',
    email: '',
    password: '',
    confirmarPassword: '',
    telefono: '',
    recibe_promociones: false
  });
  const [clienteToken, setClienteToken] = useState(() => localStorage.getItem(CLAVE_TOKEN_CLIENTE) || '');
  const [tokenInterno, setTokenInterno] = useState(() => localStorage.getItem('token') || '');
  const [sesionInternaValidada, setSesionInternaValidada] = useState(() => !localStorage.getItem('token'));
  const sesionInternaActiva = Boolean(tokenInterno) && sesionInternaValidada;
  const excluirMetricasVisitas = Boolean(tokenInterno) || esVistaTrastienda || vistaActiva === 'trastienda';
  const [cliente, setCliente] = useState(null);
  const idClienteFavoritos = Number(cliente?.id) || extraerIdClienteToken(clienteToken) || 0;
  const claveFavoritosVitrina = useMemo(
    () => obtenerClaveFavoritosVitrina(idClienteFavoritos),
    [idClienteFavoritos]
  );
  const [favoritosVitrina, setFavoritosVitrina] = useState(() => cargarFavoritosVitrina(extraerIdClienteToken(localStorage.getItem(CLAVE_TOKEN_CLIENTE) || '')));
  const [favoritoBurst, setFavoritoBurst] = useState({ id: '', nonce: 0 });
  const [perfil, setPerfil] = useState({
    nombre: '',
    apellido_paterno: '',
    apellido_materno: '',
    email: '',
    telefono: '',
    fecha_nacimiento: '',
    direccion_default: '',
    forma_pago_preferida: '',
    recibe_promociones: false
  });
  const [perfilModalTab, setPerfilModalTab] = useState('datos');
  const [perfilPedidosTab, setPerfilPedidosTab] = useState('activos');
  const [direccionesPerfil, setDireccionesPerfil] = useState([]);
  const [direccionPerfilNueva, setDireccionPerfilNueva] = useState(DIRECCION_CLIENTE_DEFAULT);
  const [mostrarModalNuevaDireccion, setMostrarModalNuevaDireccion] = useState(false);
  const [direccionPerfilEditandoId, setDireccionPerfilEditandoId] = useState(null);
  const [guardandoDireccionPerfil, setGuardandoDireccionPerfil] = useState(false);
  const [atencionForm, setAtencionForm] = useState({ asunto: '', mensaje: '' });
  const [enviandoAtencionPerfil, setEnviandoAtencionPerfil] = useState(false);
  const [checkout, setCheckout] = useState({ metodo_pago: 'efectivo', id_punto_entrega: '', notas: '' });
  const [ordenes, setOrdenes] = useState([]);
  const [puntosEntrega, setPuntosEntrega] = useState([]);
  const [adminPuntos, setAdminPuntos] = useState([]);
  const [adminClientes, setAdminClientes] = useState([]);
  const [adminOrdenes, setAdminOrdenes] = useState([]);
  const [seguimientoDraftPorOrden, setSeguimientoDraftPorOrden] = useState({});
  const [procesandoPedidosAdmin, setProcesandoPedidosAdmin] = useState(false);
  const [actualizandoClienteAccionesId, setActualizandoClienteAccionesId] = useState(0);
  const [modalResetContadoresAdmin, setModalResetContadoresAdmin] = useState({ visible: false, password: '' });
  const [adminVista, setAdminVista] = useState(() => leerValorPersistidoPermitido(CLAVE_TRASTIENDA_VISTA_ADMIN, ['pedidos', 'clientes', 'puntos', 'catalogo', 'descuentos', 'cupones', 'config', 'metricas'], 'pedidos'));
  const [filtroEstadoOrdenAdmin, setFiltroEstadoOrdenAdmin] = useState('todos');
  const [busquedaAdmin, setBusquedaAdmin] = useState('');
  const [ordenObjetivoAdmin, setOrdenObjetivoAdmin] = useState({ id: '', folio: '' });
  const [infoSeleccionada, setInfoSeleccionada] = useState(null);
  const [configTienda, setConfigTienda] = useState(CONFIG_DEFAULT);
  const [configTiendaAdmin, setConfigTiendaAdmin] = useState(CONFIG_DEFAULT);
  const [activandoServicioDomicilio, setActivandoServicioDomicilio] = useState(false);
  const [nuevoPunto, setNuevoPunto] = useState(PUNTO_ENTREGA_DEFAULT);
  const [mostrarModalNuevoPunto, setMostrarModalNuevoPunto] = useState(false);
  const [modalPunto, setModalPunto] = useState({ visible: false, modo: 'ver', data: null });
  const [guardandoClasificacion, setGuardandoClasificacion] = useState('');
  const [guardandoClasificacionMasiva, setGuardandoClasificacionMasiva] = useState(false);
  const [clasificacionGuardada, setClasificacionGuardada] = useState({});
  const [soloPendientesClasificacion, setSoloPendientesClasificacion] = useState(false);
  const [filtroNombreClasificacion, setFiltroNombreClasificacion] = useState('');
  const [filtroCategoriaClasificacion, setFiltroCategoriaClasificacion] = useState('todas');
  const [configAdminTab, setConfigAdminTab] = useState(() => leerValorPersistidoPermitido(CLAVE_TRASTIENDA_CONFIG_TAB, ['general', 'correos', 'nav', 'redes', 'links'], 'general'));
  const [infoLinkAdminTab, setInfoLinkAdminTab] = useState(2);
  const [mostrarBotonArribaTienda, setMostrarBotonArribaTienda] = useState(false);
  const [descuentosAdmin, setDescuentosAdmin] = useState([]);
  const [guardandoDescuentoClave, setGuardandoDescuentoClave] = useState('');
  const [descuentoTabInterna, setDescuentoTabInterna] = useState(() => leerValorPersistidoPermitido(CLAVE_TRASTIENDA_DESCUENTOS_TAB, ['general', 'categorias'], 'general'));
  const [descuentoCategoriaActiva, setDescuentoCategoriaActiva] = useState('');
  const [filtroDescuentoProducto, setFiltroDescuentoProducto] = useState('');
  const [filtroExclusionGlobal, setFiltroExclusionGlobal] = useState('');
  const [descuentoDrafts, setDescuentoDrafts] = useState({});
  const [codigoCuponInput, setCodigoCuponInput] = useState('');
  const [validandoCupon, setValidandoCupon] = useState(false);
  const [cuponesAplicados, setCuponesAplicados] = useState(
    Array.isArray(carritoInicial?.cuponesAplicados) ? carritoInicial.cuponesAplicados : []
  );
  const [estadoInputCupon, setEstadoInputCupon] = useState('neutral');
  const [cuponesAdmin, setCuponesAdmin] = useState([]);
  const [cuponAdminDraft, setCuponAdminDraft] = useState(CUPON_ADMIN_DEFAULT);
  const [guardandoCuponAdmin, setGuardandoCuponAdmin] = useState(false);
  const [mostrandoModalCuponAdmin, setMostrandoModalCuponAdmin] = useState(false);
  const [pasoModalCuponAdmin, setPasoModalCuponAdmin] = useState(1);
  const [editandoCuponAdminId, setEditandoCuponAdminId] = useState(0);
  const [actualizandoActivoCuponId, setActualizandoActivoCuponId] = useState(0);
  const [resumenCuponesAdmin, setResumenCuponesAdmin] = useState({
    cupones_totales: 0,
    cupones_activos: 0,
    usos_totales: 0,
    ventas_totales: 0,
    descuentos_totales: 0,
    productos_vendidos_totales: 0
  });
  const [historialCuponesAdmin, setHistorialCuponesAdmin] = useState({ historial: [], influencers: [] });
  const [cargandoHistorialCuponesAdmin, setCargandoHistorialCuponesAdmin] = useState(false);
  const [tabsNavegacionAdmin, setTabsNavegacionAdmin] = useState([]);
  const [tabsBaseEliminadasAdmin, setTabsBaseEliminadasAdmin] = useState([]);
  const [resenasDetalle, setResenasDetalle] = useState([]);
  const [cargandoResenas, setCargandoResenas] = useState(false);
  const [enviandoResena, setEnviandoResena] = useState(false);
  const [resenaNueva, setResenaNueva] = useState({ calificacion: 5, comentario: '' });
  const [mostrarModalResena, setMostrarModalResena] = useState(false);
  const [resenaEditandoId, setResenaEditandoId] = useState(0);
  const [resenaDetalleModal, setResenaDetalleModal] = useState(null);
  const [mostrarWhatsForm, setMostrarWhatsForm] = useState(false);
  const [whatsForm, setWhatsForm] = useState({ nombre: '', mensaje: '' });
  const [permisoNotificacionesPedidos, setPermisoNotificacionesPedidos] = useState(() => obtenerPermisoNotificacionesNativas());
  const [mostrarPromptNotificacionesPedidos, setMostrarPromptNotificacionesPedidos] = useState(false);
  const [sonidoNotificacionesPedidos, setSonidoNotificacionesPedidos] = useState(() => obtenerSonidoNotificacion());
  const [sonidoNotificacionesPedidosDraft, setSonidoNotificacionesPedidosDraft] = useState(() => obtenerSonidoNotificacion());
  const [notificacionesClientePedidos, setNotificacionesClientePedidos] = useState([]);
  const [notificacionesTabPerfil, setNotificacionesTabPerfil] = useState('sin_leer');
  const [editorProducto, setEditorProducto] = useState(null);
  const [subiendoLogoPagoId, setSubiendoLogoPagoId] = useState('');
  const [dragLogoPagoId, setDragLogoPagoId] = useState('');
  const [subiendoImagenCampana, setSubiendoImagenCampana] = useState(false);
  const [arrastrandoImagenCampana, setArrastrandoImagenCampana] = useState(false);
  const [correoDiagnosticoDestino, setCorreoDiagnosticoDestino] = useState('chipactli.ventas@gmail.com');
  const [enviandoCorreoDiagnostico, setEnviandoCorreoDiagnostico] = useState(false);
  const [enviandoCorreoMasivo, setEnviandoCorreoMasivo] = useState(false);
  const [mostrandoPreviewCorreo, setMostrandoPreviewCorreo] = useState(false);
  const [cargandoPreviewCorreo, setCargandoPreviewCorreo] = useState(false);
  const [previewCorreoHtml, setPreviewCorreoHtml] = useState('');
  const [previewCorreoAsunto, setPreviewCorreoAsunto] = useState('');
  const [previewTipoCorreo, setPreviewTipoCorreo] = useState('campana');
  const [mpReconcileTick, setMpReconcileTick] = useState(0);
  const [visitasActivas, setVisitasActivas] = useState({ totalActivos: 0, ubicaciones: [], listo: false });
  const [resumenVisitasAdmin, setResumenVisitasAdmin] = useState({
    cargando: false,
    fecha: '',
    activosAhora: 0,
    visitasDia: 0,
    eventosDia: 0,
    horaPico: { hora: '00:00', total: 0 },
    ubicacionesTop: [],
    porHora: [],
    actualizadoEn: ''
  });
  const [historialVisitasAdmin, setHistorialVisitasAdmin] = useState({
    cargando: false,
    rangoDias: 15,
    porDia: [],
    topUbicaciones: [],
    totalVisitas: 0,
    totalEventos: 0,
    promedioVisitasDia: 0,
    diaConMasVisitas: { fecha: '', visitas: 0, eventos: 0 }
  });
  const [fechaVisitaSeleccionada, setFechaVisitaSeleccionada] = useState(() => fechaLocalIsoHoy());
  const [paginaHorasResumen, setPaginaHorasResumen] = useState(0);
  const [paginaHistorialSemana, setPaginaHistorialSemana] = useState(0);
  const [metricasSubVista, setMetricasSubVista] = useState('visitas');
  const [comportamientoVisitasAdmin, setComportamientoVisitasAdmin] = useState({
    cargando: false,
    totalEventos: 0,
    topAcciones: [],
    topProductos: []
  });
  const [reiniciandoMetricasAdmin, setReiniciandoMetricasAdmin] = useState(false);
  const bloqueoAperturaCarritoRef = useRef(0);
  const ubicacionVisitanteRef = useRef(null);
  const cargandoUbicacionVisitanteRef = useRef(false);
  const inputLogoPagoArchivoRef = useRef(null);
  const inputImagenCategoriaArchivoRef = useRef(null);
  const inputImagenCampanaArchivoRef = useRef(null);
  const categoriaImagenUploadTargetRef = useRef(0);
  const metodoPagoUploadTargetRef = useRef('');
  const animacionCategoriaTimerRef = useRef(null);
  const transicionCategoriaTimerRef = useRef(null);
  const contenedorScrollRef = useRef(null);
  const detalleTouchStartRef = useRef({ x: 0, y: 0 });
  const detalleTouchTrackingRef = useRef(false);
  const ultimoClickComportamientoRef = useRef({ ts: 0, clave: '' });
  const eventosPedidoNotificadosRef = useRef(new Set());
  const estadoOrdenesClienteRef = useRef(new Map());
  const estadoOrdenesInicializadoRef = useRef(false);
  const confirmandoPagoMpRef = useRef(false);
  const hidratandoCarritoServidorRef = useRef(false);
  const guardandoCarritoServidorRef = useRef(false);
  const debounceCarritoServidorRef = useRef(null);
  const snapshotCarritoServidorRef = useRef('[]');
  const actualizadoCarritoServidorMsRef = useRef(0);
  const ultimoCambioCarritoLocalMsRef = useRef(Date.now());
  const carritoActualRef = useRef(carrito);
  const carritoCreadoEnActualRef = useRef(carritoCreadoEn);
  const clienteTokenActualRef = useRef(clienteToken);
  const cuponesAplicadosRef = useRef(cuponesAplicados);
  const categoriaActivaRef = useRef(categoriaActiva);
  const vistaActivaRef = useRef(vistaActiva);
  const seleccionadoRef = useRef(seleccionado);
  const infoSeleccionadaRef = useRef(infoSeleccionada);

  const usuarioInterno = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('usuario') || 'null');
    } catch {
      return null;
    }
  }, [tokenInterno]);

  useEffect(() => {
    const sincronizarTokenInterno = (tokenForzado = null) => {
      const tokenActual = tokenForzado === null
        ? String(localStorage.getItem('token') || '')
        : String(tokenForzado || '');
      setTokenInterno(tokenActual);
      if (!tokenActual) setSesionInternaValidada(false);
    };

    const onStorage = (event) => {
      if (!event || event.key === null || event.key === 'token') {
        sincronizarTokenInterno(event?.newValue ?? null);
      }
    };

    const onSesionInterna = (event) => {
      sincronizarTokenInterno(event?.detail?.token ?? '');
    };

    const onAuthInvalid = () => {
      sincronizarTokenInterno('');
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('chipactli:session-token', onSesionInterna);
    window.addEventListener('chipactli:auth-invalid', onAuthInvalid);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('chipactli:session-token', onSesionInterna);
      window.removeEventListener('chipactli:auth-invalid', onAuthInvalid);
    };
  }, []);

  useEffect(() => {
    let cancelado = false;
    const requiereValidacionInterna = Boolean(tokenInterno)
      && (tokenPareceJwt(tokenInterno) || esVistaTrastienda || vistaActiva === 'trastienda');

    if (!tokenInterno || !requiereValidacionInterna) {
      setSesionInternaValidada(false);
      return undefined;
    }

    setSesionInternaValidada(false);
    fetchJson('/api/auth/validar', {
      headers: { Authorization: `Bearer ${tokenInterno}` }
    }).then(() => {
      if (cancelado) return;
      setSesionInternaValidada(true);
    }).catch(() => {
      if (cancelado) return;
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
      } catch {
        // Ignorar errores de localStorage.
      }
      setTokenInterno('');
      setSesionInternaValidada(false);
      window.dispatchEvent(new CustomEvent('chipactli:auth-invalid', {
        detail: { mensaje: 'Tu sesión interna expiró. Inicia sesión nuevamente.' }
      }));
    });

    return () => {
      cancelado = true;
    };
  }, [esVistaTrastienda, tokenInterno, vistaActiva]);

  const esRolInternoTotal = useMemo(() => {
    const rol = String(usuarioInterno?.rol || '').trim().toLowerCase();
    return rol === 'ceo' || rol === 'admin';
  }, [usuarioInterno]);

  const permisosTrastiendaNodo = useMemo(() => {
    const permisos = usuarioInterno?.permisos;
    if (!permisos || typeof permisos !== 'object') return null;
    return permisos?.trastienda || permisos?.ventas || null;
  }, [usuarioInterno]);

  const vistasTrastiendaDisponibles = useMemo(() => {
    if (!tokenInterno) return [];
    if (esRolInternoTotal) return TRASTIENDA_VISTAS;
    const nodo = permisosTrastiendaNodo;
    if (!nodo || typeof nodo !== 'object') return [];

    const accesoGeneral = Boolean(nodo?.ver);
    return TRASTIENDA_VISTAS.filter((item) => {
      const acciones = (nodo?.acciones && typeof nodo.acciones === 'object') ? nodo.acciones : {};
      if (Object.prototype.hasOwnProperty.call(acciones, item.accion)) {
        return Boolean(acciones[item.accion]);
      }
      if (Object.prototype.hasOwnProperty.call(acciones, 'ver')) {
        return Boolean(acciones.ver);
      }
      return accesoGeneral;
    });
  }, [tokenInterno, esRolInternoTotal, permisosTrastiendaNodo]);

  const puedeEditarTrastienda = useMemo(() => {
    if (!tokenInterno) return false;
    if (esRolInternoTotal) return true;
    const nodo = permisosTrastiendaNodo;
    if (!nodo || typeof nodo !== 'object') return false;
    const acciones = (nodo?.acciones && typeof nodo.acciones === 'object') ? nodo.acciones : {};
    if (Object.prototype.hasOwnProperty.call(acciones, 'editar')) {
      return Boolean(acciones.editar);
    }
    return Boolean(nodo?.editar);
  }, [tokenInterno, esRolInternoTotal, permisosTrastiendaNodo]);

  const vistaTrastiendaFallback = useMemo(
    () => (vistasTrastiendaDisponibles[0]?.id || '__sin_permisos__'),
    [vistasTrastiendaDisponibles]
  );

  useEffect(() => {
    carritoActualRef.current = carrito;
  }, [carrito]);

  useEffect(() => {
    carritoCreadoEnActualRef.current = carritoCreadoEn;
  }, [carritoCreadoEn]);

  useEffect(() => {
    clienteTokenActualRef.current = clienteToken;
  }, [clienteToken]);

  useEffect(() => {
    cuponesAplicadosRef.current = cuponesAplicados;
  }, [cuponesAplicados]);

  useEffect(() => {
    categoriaActivaRef.current = categoriaActiva;
  }, [categoriaActiva]);

  useEffect(() => {
    vistaActivaRef.current = vistaActiva;
  }, [vistaActiva]);

  useEffect(() => {
    seleccionadoRef.current = seleccionado;
  }, [seleccionado]);

  useEffect(() => {
    infoSeleccionadaRef.current = infoSeleccionada;
  }, [infoSeleccionada]);

  const totalNoLeidasCliente = useMemo(() => (
    (notificacionesClientePedidos || []).filter((item) => !item?.leida).length
  ), [notificacionesClientePedidos]);

  const notificacionesClienteSinLeer = useMemo(
    () => (Array.isArray(notificacionesClientePedidos)
      ? notificacionesClientePedidos.filter((item) => !item?.leida)
      : []),
    [notificacionesClientePedidos]
  );

  const notificacionesClienteLeidas = useMemo(
    () => (Array.isArray(notificacionesClientePedidos)
      ? notificacionesClientePedidos.filter((item) => Boolean(item?.leida))
      : []),
    [notificacionesClientePedidos]
  );

  const ordenesPerfilActivas = useMemo(
    () => (Array.isArray(ordenes) ? ordenes.filter((orden) => !pedidoEstaCerrado(orden?.estado)) : []),
    [ordenes]
  );

  const ordenesPerfilCerradas = useMemo(
    () => (Array.isArray(ordenes) ? ordenes.filter((orden) => pedidoEstaCerrado(orden?.estado)) : []),
    [ordenes]
  );

  const servicioDomicilioActivoAdmin = configActivo(configTiendaAdmin?.servicio_domicilio_habilitado, false);
  const servicioDomicilioActivoCliente = configActivo(configTienda?.servicio_domicilio_habilitado, false);
  const nombreClienteCompleto = [perfil.nombre, perfil.apellido_paterno, perfil.apellido_materno]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(' ');
  const nombreClienteHeaderRaw = String(nombreClienteCompleto || cliente?.nombre || '').trim() || 'Cliente';
  const nombreClienteHeader = String(nombreClienteHeaderRaw.split(/\s+/)[0] || 'Cliente').trim();
  const asuntosAtencionDisponibles = useMemo(
    () => obtenerAsuntosAtencionConfig(configTienda?.atencion_asuntos),
    [configTienda?.atencion_asuntos]
  );

  const tabsNavegacionCliente = useMemo(
    () => obtenerTabsNavegacionConfig(configTienda?.menu_tabs_personalizadas),
    [configTienda?.menu_tabs_personalizadas]
  );

  const tabsBaseEliminadasClienteSet = useMemo(
    () => new Set(obtenerTabsBaseEliminadasConfig(configTienda?.menu_tabs_base_eliminadas)),
    [configTienda?.menu_tabs_base_eliminadas]
  );

  useEffect(() => {
    const favoritosGuardados = cargarFavoritosVitrina(idClienteFavoritos);
    setFavoritosVitrina(favoritosGuardados);
  }, [idClienteFavoritos, claveFavoritosVitrina]);

  useEffect(() => {
    if (!idClienteFavoritos) return;
    const favoritosInvitado = cargarFavoritosVitrina(0);
    if (!favoritosInvitado.length) return;

    setFavoritosVitrina((prev) => {
      const unidos = Array.from(new Set([...(Array.isArray(prev) ? prev : []), ...favoritosInvitado]));
      try {
        localStorage.setItem(claveFavoritosVitrina, JSON.stringify(unidos));
        localStorage.removeItem(obtenerClaveFavoritosVitrina(0));
      } catch {
      }
      return unidos;
    });
  }, [idClienteFavoritos, claveFavoritosVitrina]);

  useEffect(() => {
    try {
      localStorage.setItem(claveFavoritosVitrina, JSON.stringify(Array.isArray(favoritosVitrina) ? favoritosVitrina : []));
    } catch {
    }
  }, [claveFavoritosVitrina, favoritosVitrina]);

  const favoritosVitrinaSet = useMemo(
    () => new Set((Array.isArray(favoritosVitrina) ? favoritosVitrina : []).map((item) => String(item || '').trim()).filter(Boolean)),
    [favoritosVitrina]
  );

  function productoEsFavoritoCliente(producto = null) {
    const identificador = obtenerIdentificadorFavoritoProducto(producto);
    if (!identificador) return false;
    return favoritosVitrinaSet.has(identificador);
  }

  function toggleFavoritoProducto(producto = null) {
    const identificador = obtenerIdentificadorFavoritoProducto(producto);
    if (!identificador) return;

    const nonce = Date.now();
    setFavoritoBurst({ id: identificador, nonce });
    setTimeout(() => {
      setFavoritoBurst((actual) => {
        if (actual.id !== identificador || actual.nonce !== nonce) {
          return actual;
        }
        return { id: '', nonce: 0 };
      });
    }, 720);

    setFavoritosVitrina((prev) => {
      const actual = new Set((Array.isArray(prev) ? prev : []).map((item) => String(item || '').trim()).filter(Boolean));
      if (actual.has(identificador)) {
        actual.delete(identificador);
      } else {
        actual.add(identificador);
      }
      return Array.from(actual);
    });
  }

  const metodosPagoFooter = useMemo(
    () => obtenerMetodosPagoConfig(configTienda?.footer_pagos_metodos, configTienda),
    [configTienda?.footer_pagos_metodos, configTienda?.footer_pagos_logos, configTienda?.footer_pagos_logo_url]
  );

  const metodosPagoFooterVisibles = useMemo(
    () => metodosPagoFooter.filter((item) => String(item?.activo ?? '1') !== '0' && !metodoPagoOculto(item?.id)),
    [metodosPagoFooter]
  );

  const textoUbicacionesVisitas = useMemo(
    () => (Array.isArray(visitasActivas?.ubicaciones)
      ? visitasActivas.ubicaciones
        .slice(0, 3)
        .map((item) => `${item?.ubicacion || item?.pais || 'Desconocido'} (${Number(item?.total) || 0})`)
        .join(' · ')
      : ''),
    [visitasActivas]
  );

  const historialSemanas = useMemo(() => {
    const mapa = new Map();
    (historialVisitasAdmin.porDia || []).forEach((item) => {
      const fecha = String(item?.fecha || '').trim();
      if (!fecha) return;
      const inicio = obtenerInicioSemanaDomingo(fecha);
      if (!inicio) return;
      if (!mapa.has(inicio)) {
        mapa.set(inicio, {
          inicio,
          fin: sumarDiasFechaIso(inicio, 6),
          dias: [],
          visitas: 0,
          eventos: 0
        });
      }
      const semana = mapa.get(inicio);
      semana.dias.push(item);
      semana.visitas += Number(item?.visitas) || 0;
      semana.eventos += Number(item?.eventos) || 0;
    });
    return Array.from(mapa.values()).sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
  }, [historialVisitasAdmin.porDia]);

  const totalPaginasHistorialSemana = useMemo(
    () => Math.max(1, historialSemanas.length || 1),
    [historialSemanas.length]
  );

  const paginaHistorialSemanaSegura = Math.max(0, Math.min(paginaHistorialSemana, totalPaginasHistorialSemana - 1));

  const historialSemanaActual = useMemo(
    () => historialSemanas[paginaHistorialSemanaSegura] || { inicio: '', fin: '', dias: [] },
    [historialSemanas, paginaHistorialSemanaSegura]
  );

  const etiquetaHistorialSemana = useMemo(() => {
    if (!historialSemanaActual?.dias?.length) return 'Semana sin datos';
    const primerDia = historialSemanaActual.dias[0];
    const ultimoDia = historialSemanaActual.dias[historialSemanaActual.dias.length - 1];
    return `${primerDia?.fecha || historialSemanaActual.inicio} - ${ultimoDia?.fecha || historialSemanaActual.fin}`;
  }, [historialSemanaActual]);

  const maximoVisitasHistorialSemana = useMemo(
    () => (historialSemanaActual?.dias || []).reduce((max, item) => Math.max(max, Number(item?.visitas) || 0), 0),
    [historialSemanaActual]
  );

  const esFechaResumenHoy = useMemo(() => {
    const fechaResumen = String(resumenVisitasAdmin?.fecha || fechaVisitaSeleccionada || '').trim();
    return Boolean(fechaResumen) && fechaResumen === fechaLocalIsoHoy();
  }, [resumenVisitasAdmin?.fecha, fechaVisitaSeleccionada]);

  const horasResumenCompletas = useMemo(() => {
    const horaActual = new Date().getHours();
    const acumulado = new Map();

    (resumenVisitasAdmin.porHora || []).forEach((item) => {
      const hora = Number(String(item?.hora || '00').slice(0, 2));
      if (!Number.isFinite(hora) || hora < 0 || hora > 23) return;
      const totalActual = Number(acumulado.get(hora) || 0);
      const totalNuevo = Number(item?.total) || 0;
      acumulado.set(hora, totalActual + totalNuevo);
    });

    return Array.from({ length: 24 }, (_, hora) => {
      const futura = esFechaResumenHoy && hora > horaActual;
      const totalBase = Number(acumulado.get(hora) || 0);
      return {
        hora,
        horaInicio: `${String(hora).padStart(2, '0')}:00`,
        horaFin: `${String(Math.min(23, hora)).padStart(2, '0')}:59`,
        total: futura ? 0 : totalBase,
        esHoraActual: esFechaResumenHoy && hora === horaActual,
        esFutura: futura
      };
    });
  }, [resumenVisitasAdmin.porHora, esFechaResumenHoy]);

  const totalPaginasHorasResumen = useMemo(
    () => Math.max(1, Math.ceil(horasResumenCompletas.length / 6)),
    [horasResumenCompletas]
  );

  const paginaHorasResumenSegura = Math.max(0, Math.min(paginaHorasResumen, totalPaginasHorasResumen - 1));

  const horasResumenPaginadas = useMemo(() => {
    const inicio = paginaHorasResumenSegura * 6;
    return horasResumenCompletas.slice(inicio, inicio + 6);
  }, [horasResumenCompletas, paginaHorasResumenSegura]);

  const etiquetaRangoHorasPagina = useMemo(() => {
    if (!horasResumenPaginadas.length) return '00:00 - 05:59';
    const primero = horasResumenPaginadas[0];
    const ultimo = horasResumenPaginadas[horasResumenPaginadas.length - 1];
    return `${primero.horaInicio} - ${ultimo.horaFin}`;
  }, [horasResumenPaginadas]);

  useEffect(() => {
    setPaginaHistorialSemana(Math.max(0, historialSemanas.length - 1));
  }, [historialSemanas.length]);

  const removerFondoPngFooter = configActivo(configTienda?.footer_pagos_remover_fondo_png, true);
  const [metodosPagoRenderFooter, setMetodosPagoRenderFooter] = useState([]);

  const metodosPagoAdmin = useMemo(
    () => obtenerMetodosPagoConfig(configTiendaAdmin?.footer_pagos_metodos, configTiendaAdmin).filter((item) => !metodoPagoOculto(item?.id)),
    [configTiendaAdmin?.footer_pagos_metodos, configTiendaAdmin?.footer_pagos_logos, configTiendaAdmin?.footer_pagos_logo_url]
  );

  const mapaSeccionesPersonalizadas = useMemo(() => {
    const mapa = new Map();
    tabsNavegacionCliente.forEach((tab) => {
      if (!tab?.activo) return;
      mapa.set(`custom:${tab.id}`, normalizarClaveCategoriaTienda(tab?.categoria));
    });
    return mapa;
  }, [tabsNavegacionCliente]);

  useEffect(() => {
    let cancelado = false;
    const urlsTemporales = [];

    const procesar = async () => {
      if (!metodosPagoFooterVisibles.length) {
        setMetodosPagoRenderFooter([]);
        return;
      }

      const resultado = await Promise.all(metodosPagoFooterVisibles.map(async (metodo) => {
        const url = String(metodo?.logo_url || '').trim();
        if (!url || !removerFondoPngFooter) {
          return { ...metodo, logo_render_url: url };
        }
        try {
          const limpio = await removerFondoBlancoPng(url);
          if (limpio) {
            urlsTemporales.push(limpio);
            return { ...metodo, logo_render_url: limpio };
          }
          return { ...metodo, logo_render_url: url };
        } catch {
          return { ...metodo, logo_render_url: url };
        }
      }));

      if (cancelado) {
        urlsTemporales.forEach((tmp) => URL.revokeObjectURL(tmp));
        return;
      }
      setMetodosPagoRenderFooter(resultado);
    };

    procesar();

    return () => {
      cancelado = true;
      urlsTemporales.forEach((tmp) => URL.revokeObjectURL(tmp));
    };
  }, [metodosPagoFooterVisibles, removerFondoPngFooter]);

  useEffect(() => {
    const sessionId = obtenerSesionVisitaId();
    if (!sessionId) return undefined;

    let cancelado = false;

    const resolverUbicacionVisitante = async () => {
      if (ubicacionVisitanteRef.current) return ubicacionVisitanteRef.current;
      if (cargandoUbicacionVisitanteRef.current) return null;

      try {
        const cacheRaw = sessionStorage.getItem('chipactli:geo-visita');
        if (cacheRaw) {
          const cache = JSON.parse(cacheRaw);
          const expiracion = Number(cache?.expiracion || 0);
          if (expiracion > Date.now()) {
            const ubicacion = {
              pais: String(cache?.pais || '').trim(),
              region: String(cache?.region || '').trim(),
              ciudad: String(cache?.ciudad || '').trim()
            };
            ubicacionVisitanteRef.current = ubicacion;
            return ubicacion;
          }
        }
      } catch {
        // Ignorar cache inválido.
      }

      cargandoUbicacionVisitanteRef.current = true;
      try {
        // La geolocalización ya se resuelve en backend a partir de la IP real.
        // Aquí solo reutilizamos cache local si existe para evitar dependencias CORS de terceros.
        return null;
      } catch {
        return null;
      } finally {
        cargandoUbicacionVisitanteRef.current = false;
      }
    };

    const enviarHeartbeatVisita = async () => {
      try {
        if (excluirMetricasVisitas) {
          const estado = await fetchJson('/visitas/estado');
          if (!cancelado) {
            setVisitasActivas({
              totalActivos: Number(estado?.totalActivos) || 0,
              ubicaciones: Array.isArray(estado?.ubicaciones) ? estado.ubicaciones : [],
              listo: true
            });
          }
          return;
        }

        const zonaHoraria = Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || '';
        const idioma = String(window?.navigator?.language || '').trim();
        const ruta = String(window?.location?.hash || (esVistaTrastienda ? '#/trastienda' : '#/vitrina')).trim();
        const geo = await resolverUbicacionVisitante();
        const data = await fetchJson('/visitas/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            idCliente: Number(cliente?.id || 0) > 0 ? Number(cliente?.id || 0) : undefined,
            ruta,
            zonaHoraria,
            idioma,
            pais: String(geo?.pais || '').trim(),
            region: String(geo?.region || '').trim(),
            ciudad: String(geo?.ciudad || '').trim(),
            visible: document.visibilityState === 'visible',
            esTrastienda: excluirMetricasVisitas
          })
        });

        if (!cancelado) {
          setVisitasActivas({
            totalActivos: Number(data?.totalActivos) || 0,
            ubicaciones: Array.isArray(data?.ubicaciones) ? data.ubicaciones : [],
            listo: true
          });
        }
      } catch {
        if (!cancelado) {
          setVisitasActivas((prev) => ({ ...prev, listo: true }));
        }
      }
    };

    enviarHeartbeatVisita();
    const intervalo = window.setInterval(enviarHeartbeatVisita, 30_000);
    const alVolverVisible = () => {
      if (document.visibilityState === 'visible') {
        enviarHeartbeatVisita();
      }
    };

    document.addEventListener('visibilitychange', alVolverVisible);

    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolverVisible);
    };
  }, [esVistaTrastienda, cliente?.id, excluirMetricasVisitas]);

  useEffect(() => {
    if (!esVistaTrastienda || !tokenInterno || adminVista !== 'metricas') return undefined;

    cargarResumenVisitasAdmin(fechaVisitaSeleccionada);
    cargarHistorialVisitasAdmin(historialVisitasAdmin.rangoDias);
    cargarComportamientoVisitasAdmin(historialVisitasAdmin.rangoDias);
    const intervalo = window.setInterval(() => {
      cargarResumenVisitasAdmin(fechaVisitaSeleccionada);
      cargarHistorialVisitasAdmin(historialVisitasAdmin.rangoDias);
      cargarComportamientoVisitasAdmin(historialVisitasAdmin.rangoDias);
    }, 30_000);

    return () => window.clearInterval(intervalo);
  }, [esVistaTrastienda, tokenInterno, adminVista, historialVisitasAdmin.rangoDias, fechaVisitaSeleccionada]);

  useEffect(() => {
    setPaginaHorasResumen(0);
  }, [fechaVisitaSeleccionada]);

  useEffect(() => {
    if (esVistaTrastienda) return;
    if (vistaActiva !== 'tienda') return;
    registrarEventoComportamiento('ver_tienda');
  }, [esVistaTrastienda, vistaActiva]);

  useEffect(() => {
    if (esVistaTrastienda) return;
    if (vistaActiva !== 'tienda') return;
    registrarEventoComportamiento('ver_seccion', seccionActiva || 'todos');
  }, [esVistaTrastienda, vistaActiva, seccionActiva]);

  useEffect(() => {
    if (excluirMetricasVisitas) return undefined;
    const contenedor = contenedorScrollRef.current;
    if (!contenedor) return undefined;

    const onClickCaptura = (event) => {
      const target = event?.target;
      if (!(target instanceof Element)) return;
      const clickeable = target.closest('button, a, [role="button"], .tiendaTab, .boton');
      if (!clickeable) return;
      if (!contenedor.contains(clickeable)) return;

      const texto = String(
        clickeable.getAttribute('aria-label')
        || clickeable.getAttribute('title')
        || clickeable.textContent
        || ''
      ).replace(/\s+/g, ' ').trim().slice(0, 120);
      const clave = `${String(vistaActiva || '')}:${texto || 'clic'}`;
      const ahora = Date.now();
      if ((ahora - Number(ultimoClickComportamientoRef.current.ts || 0)) < 650
        && ultimoClickComportamientoRef.current.clave === clave) {
        return;
      }

      ultimoClickComportamientoRef.current = { ts: ahora, clave };
      registrarEventoComportamiento('click_interfaz', texto || 'clic');
    };

    contenedor.addEventListener('click', onClickCaptura, true);
    return () => contenedor.removeEventListener('click', onClickCaptura, true);
  }, [vistaActiva, adminVista, seccionActiva, excluirMetricasVisitas]);

  function sincronizarTabsNavegacionAdminDesdeConfig(config = configTiendaAdmin) {
    const lista = obtenerTabsNavegacionConfig(config?.menu_tabs_personalizadas);
    setTabsNavegacionAdmin(lista);
    setTabsBaseEliminadasAdmin(obtenerTabsBaseEliminadasConfig(config?.menu_tabs_base_eliminadas));
  }

  function actualizarTabsNavegacionAdmin(updater) {
    setTabsNavegacionAdmin((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const siguiente = typeof updater === 'function' ? updater(base) : (Array.isArray(updater) ? updater : base);
      const serializado = JSON.stringify(siguiente.map((item) => ({
        id: String(item?.id || '').trim(),
        label: String(item?.label || '').trim(),
        categoria: String(item?.categoria || '').trim(),
        activo: item?.activo ? '1' : '0'
      })));
      setConfigTiendaAdmin((p) => ({ ...p, menu_tabs_personalizadas: serializado }));
      return siguiente;
    });
  }

  function actualizarTabsBaseEliminadasAdmin(updater) {
    setTabsBaseEliminadasAdmin((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const siguiente = typeof updater === 'function' ? updater(base) : (Array.isArray(updater) ? updater : base);
      const unicos = Array.from(new Set(siguiente.map((item) => String(item || '').trim()).filter(Boolean)));
      setConfigTiendaAdmin((p) => ({ ...p, menu_tabs_base_eliminadas: JSON.stringify(unicos) }));
      return unicos;
    });
  }

  async function eliminarPestanaBase(baseId, configKey, label) {
    const id = String(baseId || '').trim();
    const clave = String(configKey || '').trim();
    if (!id) return;

    const confirmado = await confirmarAccionCriticaTrastienda({
      titulo: 'Eliminar pestaña base',
      mensaje: `Vas a ocultar la pestaña ${String(label || 'de navegación').trim()} de la vitrina. Guarda configuración después para aplicar el cambio.`,
      frase: 'ELIMINAR PESTANA'
    });
    if (!confirmado) return;

    actualizarTabsBaseEliminadasAdmin((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (clave) {
      setConfigTiendaAdmin((prev) => ({ ...prev, [clave]: '0' }));
    }
    mostrarNotificacion(`Pestaña "${String(label || 'navegación')}" eliminada. Guarda configuración para aplicar.`, 'exito');
  }

  function actualizarMetodosPagoAdmin(updater) {
    const base = Array.isArray(metodosPagoAdmin) ? metodosPagoAdmin : [];
    const siguiente = typeof updater === 'function' ? updater(base) : base;
    setConfigTiendaAdmin((prev) => ({
      ...prev,
      footer_pagos_metodos: serializarMetodosPagoConfig(siguiente)
    }));
  }

  function editarMetodoPagoAdmin(idMetodo, cambios = {}) {
    const id = String(idMetodo || '').trim();
    if (!id) return;
    actualizarMetodosPagoAdmin((prev) => prev.map((item) => (
      item.id === id ? { ...item, ...cambios } : item
    )));
  }

  function agregarMetodoPagoAdmin() {
    const siguienteId = `metodo_${Date.now().toString(36)}`;
    actualizarMetodosPagoAdmin((prev) => ([
      ...prev,
      { id: siguienteId, label: 'Nuevo método', activo: '1', logo_url: '' }
    ]));
  }

  function abrirSelectorLogoMetodoPago(idMetodo) {
    metodoPagoUploadTargetRef.current = String(idMetodo || '').trim();
    inputLogoPagoArchivoRef.current?.click();
  }

  function abrirSelectorImagenCampana() {
    inputImagenCampanaArchivoRef.current?.click();
  }

  async function optimizarImagenArchivoCliente(archivo, opciones = {}) {
    const tipo = String(archivo?.type || '').toLowerCase();
    if (!archivo) return archivo;
    if (!tipo.startsWith('image/')) return archivo;
    if (tipo.includes('svg')) return archivo;

    const maxLado = Number(opciones?.maxLado || 1600);
    const calidadInicial = Number(opciones?.calidad || 0.85);
    const pesoObjetivoKB = Number(opciones?.pesoObjetivoKB || 700);

    try {
      const url = URL.createObjectURL(archivo);
      const imagen = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });

      const anchoOriginal = Number(imagen?.width || 0);
      const altoOriginal = Number(imagen?.height || 0);
      if (anchoOriginal <= 0 || altoOriginal <= 0) {
        URL.revokeObjectURL(url);
        return archivo;
      }

      const escala = Math.min(1, maxLado / Math.max(anchoOriginal, altoOriginal));
      const ancho = Math.max(1, Math.round(anchoOriginal * escala));
      const alto = Math.max(1, Math.round(altoOriginal * escala));

      const canvas = document.createElement('canvas');
      canvas.width = ancho;
      canvas.height = alto;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return archivo;
      }

      ctx.drawImage(imagen, 0, 0, ancho, alto);
      URL.revokeObjectURL(url);

      let calidad = Math.max(0.5, Math.min(0.95, calidadInicial));
      let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', calidad));
      if (!blob) return archivo;

      while (blob.size > (pesoObjetivoKB * 1024) && calidad > 0.55) {
        calidad -= 0.07;
        const nuevo = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', calidad));
        if (!nuevo) break;
        blob = nuevo;
      }

      if (!blob || blob.size >= archivo.size) return archivo;

      const nombreBase = String(archivo?.name || 'imagen')
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'imagen';
      return new File([blob], `${nombreBase}.webp`, { type: 'image/webp' });
    } catch {
      return archivo;
    }
  }

  function validarArchivoImagen(archivo) {
    if (!archivo) return 'No se encontró el archivo de imagen.';
    const tipo = String(archivo?.type || '').toLowerCase();
    if (tipo.startsWith('image/')) return '';
    const nombre = String(archivo?.name || '').toLowerCase();
    if (nombre.endsWith('.svg')) return '';
    return 'Solo se permiten imágenes (PNG, JPG, WEBP, SVG, etc.).';
  }

  function validarArchivoMediaCampana(archivo) {
    if (!archivo) return 'No se encontró el archivo multimedia.';
    const tipo = String(archivo?.type || '').toLowerCase();
    if (tipo.startsWith('image/')) return '';
    if (tipo.startsWith('video/')) return '';
    const nombre = String(archivo?.name || '').toLowerCase();
    if (/\.(mp4|webm|ogg|ogv|mov|m4v|gif|png|jpe?g|webp|svg)$/i.test(nombre)) return '';
    return 'Solo se permiten imágenes, GIF y video (MP4/WEBM/OGG/MOV).';
  }

  async function subirImagenTiendaArchivo(archivo) {
    const errorArchivo = validarArchivoImagen(archivo);
    if (errorArchivo) throw new Error(errorArchivo);

    const archivoOptimizado = await optimizarImagenArchivoCliente(archivo);
    const formData = new FormData();
    formData.append('imagen', archivoOptimizado || archivo);
    const data = await fetchAdmin('/api/uploads/tienda-imagen', {
      method: 'POST',
      body: formData
    });
    const url = String(data?.url || '').trim();
    if (!url) throw new Error('No se recibió la URL de la imagen subida.');
    return url;
  }

  async function subirMediaCampanaArchivo(archivo) {
    const errorArchivo = validarArchivoMediaCampana(archivo);
    if (errorArchivo) throw new Error(errorArchivo);

    const tipo = String(archivo?.type || '').toLowerCase();
    const esImagenNoGif = tipo.startsWith('image/') && !tipo.includes('gif');
    const archivoProcesado = esImagenNoGif
      ? await optimizarImagenArchivoCliente(archivo)
      : archivo;

    const formData = new FormData();
    formData.append('imagen', archivoProcesado || archivo);
    const data = await fetchAdmin('/api/uploads/tienda-imagen', {
      method: 'POST',
      body: formData
    });
    const url = String(data?.url || '').trim();
    if (!url) throw new Error('No se recibió la URL del archivo multimedia subido.');
    return url;
  }

  async function subirLogoMetodoDesdeArchivo(idMetodo, archivo) {
    const id = String(idMetodo || '').trim();
    if (!id) throw new Error('Método de pago inválido para subir logo.');
    const url = await subirImagenTiendaArchivo(archivo);
    editarMetodoPagoAdmin(id, { logo_url: url });
  }

  async function subirLogoPagoDesdeComputadora(event) {
    const archivo = event?.target?.files?.[0] || null;
    const idMetodo = String(metodoPagoUploadTargetRef.current || '').trim();
    if (!archivo) return;
    if (!idMetodo) {
      mostrarNotificacion('Selecciona primero un método de pago para subir su imagen.', 'error');
      if (event?.target) event.target.value = '';
      return;
    }

    try {
      setSubiendoLogoPagoId(idMetodo);
      await subirLogoMetodoDesdeArchivo(idMetodo, archivo);
      mostrarNotificacion('Logo agregado correctamente.', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo subir el logo.', 'error');
    } finally {
      setSubiendoLogoPagoId('');
      metodoPagoUploadTargetRef.current = '';
      if (event?.target) event.target.value = '';
    }
  }

  async function manejarDropLogoPago(event, idMetodo) {
    event.preventDefault();
    event.stopPropagation();
    const id = String(idMetodo || '').trim();
    setDragLogoPagoId('');

    const archivo = event?.dataTransfer?.files?.[0] || null;
    if (!archivo || !id) return;

    try {
      setSubiendoLogoPagoId(id);
      await subirLogoMetodoDesdeArchivo(id, archivo);
      mostrarNotificacion('Logo agregado correctamente.', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo subir el logo.', 'error');
    } finally {
      setSubiendoLogoPagoId('');
    }
  }

  function abrirSelectorImagenCategoria(idCategoria) {
    categoriaImagenUploadTargetRef.current = Number(idCategoria) || 0;
    inputImagenCategoriaArchivoRef.current?.click();
  }

  async function guardarImagenCategoriaAdmin(idCategoria, imageUrl) {
    const id = Number(idCategoria) || 0;
    if (!id || !tokenInterno) return;
    const categoria = (Array.isArray(categoriasAdmin) ? categoriasAdmin : []).find((item) => Number(item?.id) === id);
    const nombre = String(categoria?.nombre || '').trim();
    if (!nombre) throw new Error('Categoría inválida para actualizar imagen.');

    await fetchAdmin(`/categorias/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, image_url: String(imageUrl || '').trim() })
    });

    await cargarCategoriasAdmin({ silencioso: true });
    await cargarProductos({ silencioso: true });
  }

  async function subirImagenCategoriaDesdeComputadora(event) {
    const archivo = event?.target?.files?.[0] || null;
    const idCategoria = Number(categoriaImagenUploadTargetRef.current) || 0;
    if (!archivo) return;

    if (!idCategoria) {
      mostrarNotificacion('Selecciona una categoría para subir imagen.', 'error');
      if (event?.target) event.target.value = '';
      return;
    }

    try {
      setSubiendoImagenCategoriaId(idCategoria);
      const url = await subirImagenTiendaArchivo(archivo);
      await guardarImagenCategoriaAdmin(idCategoria, url);
      mostrarNotificacion('Imagen de categoría guardada.', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo subir la imagen de categoría.', 'error');
    } finally {
      setSubiendoImagenCategoriaId(0);
      categoriaImagenUploadTargetRef.current = 0;
      if (event?.target) event.target.value = '';
    }
  }

  async function quitarImagenCategoriaAdmin(idCategoria) {
    const id = Number(idCategoria) || 0;
    if (!id) return;
    try {
      setSubiendoImagenCategoriaId(id);
      await guardarImagenCategoriaAdmin(id, '');
      mostrarNotificacion('Imagen de categoría eliminada.', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo quitar la imagen de categoría.', 'error');
    } finally {
      setSubiendoImagenCategoriaId(0);
    }
  }

  async function subirImagenCampanaDesdeArchivo(archivo) {
    const url = await subirMediaCampanaArchivo(archivo);
    setConfigTiendaAdmin((prev) => ({ ...prev, correo_campana_imagen_url: url }));
  }

  async function subirImagenCampanaDesdeComputadora(event) {
    const archivo = event?.target?.files?.[0] || null;
    if (!archivo) return;

    try {
      setSubiendoImagenCampana(true);
      await subirImagenCampanaDesdeArchivo(archivo);
      mostrarNotificacion('Multimedia de campaña cargada correctamente.', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo subir la multimedia de campaña.', 'error');
    } finally {
      setSubiendoImagenCampana(false);
      if (event?.target) event.target.value = '';
    }
  }

  async function manejarDropImagenCampana(event) {
    event.preventDefault();
    event.stopPropagation();
    setArrastrandoImagenCampana(false);

    const archivo = event?.dataTransfer?.files?.[0] || null;
    if (!archivo) return;

    try {
      setSubiendoImagenCampana(true);
      await subirImagenCampanaDesdeArchivo(archivo);
      mostrarNotificacion('Multimedia de campaña cargada correctamente.', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo subir la multimedia de campaña.', 'error');
    } finally {
      setSubiendoImagenCampana(false);
    }
  }

  function agregarNotificacionClientePedido({ titulo, mensaje, tipo = 'pedido' }) {
    const nueva = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      titulo: String(titulo || 'Pedido'),
      mensaje: String(mensaje || '').trim(),
      tipo: String(tipo || 'pedido'),
      leida: false,
      fecha: new Date().toISOString()
    };
    setNotificacionesClientePedidos((prev) => [nueva, ...(Array.isArray(prev) ? prev : [])]);
  }

  function marcarNotificacionesClienteComoLeidas() {
    setNotificacionesClientePedidos((prev) => (Array.isArray(prev)
      ? prev.map((item) => ({ ...item, leida: true }))
      : []));
    if (!clienteToken) return;
    fetchJson('/tienda/auth/notificaciones/marcar-leidas', {
      method: 'POST',
      headers: { Authorization: `Bearer ${clienteToken}` }
    }).catch(() => {});
  }

  function limpiarNotificacionesCliente() {
    setNotificacionesClientePedidos([]);
    if (!clienteToken) return;
    fetchJson('/tienda/auth/notificaciones', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${clienteToken}` }
    }).catch(() => {});
  }

  async function marcarNotificacionClienteComoLeida(notificacionId) {
    const id = Number(notificacionId) || 0;
    setNotificacionesClientePedidos((prev) => (Array.isArray(prev)
      ? prev.map((item) => (Number(item?.id) === id ? { ...item, leida: true } : item))
      : []));
    setNotificacionesTabPerfil('leidas');

    if (!clienteToken || !id) return;
    try {
      await fetchJson(`/tienda/auth/notificaciones/${id}/marcar-leida`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${clienteToken}` }
      });
    } catch {
      // Ignorar errores temporales de sincronización.
    }
  }

  function revisarCambiosEstadoOrdenes(listaOrdenes = []) {
    const ordenesLista = Array.isArray(listaOrdenes) ? listaOrdenes : [];
    const mapaPrevio = estadoOrdenesClienteRef.current;
    const mapaNuevo = new Map();
    const firmaOrden = (orden) => {
      const estado = String(orden?.estado || '').trim().toLowerCase();
      const marcaTiempo = String(orden?.actualizado_en || orden?.creado_en || '').trim();
      return `${estado}|${marcaTiempo}`;
    };

    if (!estadoOrdenesInicializadoRef.current) {
      ordenesLista.forEach((orden) => {
        const idOrden = Number(orden?.id) || 0;
        if (!idOrden) return;
        mapaNuevo.set(idOrden, firmaOrden(orden));
      });
      estadoOrdenesClienteRef.current = mapaNuevo;
      estadoOrdenesInicializadoRef.current = true;
      return;
    }

    ordenesLista.forEach((orden) => {
      const idOrden = Number(orden?.id) || 0;
      if (!idOrden) return;

      const estadoActual = String(orden?.estado || '').trim().toLowerCase();
      const firmaActual = firmaOrden(orden);
      mapaNuevo.set(idOrden, firmaActual);

      const firmaPrevia = String(mapaPrevio.get(idOrden) || '').trim();
      if (!firmaPrevia) {
        const keyNuevo = `tienda_orden_nueva:${idOrden}:nueva`;
        if (eventosPedidoNotificadosRef.current.has(keyNuevo)) return;
        eventosPedidoNotificadosRef.current.add(keyNuevo);

        const folioNuevo = String(orden?.folio || '').trim();
        const mensajeNuevo = folioNuevo
          ? `Tu pedido ${folioNuevo} fue realizado correctamente.`
          : 'Tu pedido fue realizado correctamente.';
        agregarNotificacionClientePedido({ titulo: 'Pedido realizado', mensaje: mensajeNuevo, tipo: 'pedido_nuevo' });
        if (permisoNotificacionesPedidos === 'granted') {
          mostrarNotificacionNativa({
            titulo: 'Pedido recibido',
            mensaje: mensajeNuevo,
            tag: `pedido:nuevo:fallback:${idOrden}`,
            sonido: sonidoNotificacionesPedidos
          });
        }
        return;
      }

      if (firmaPrevia === firmaActual) return;
      const keyCambio = `tienda_orden_actualizada:${idOrden}:${estadoActual || 'actualizado'}:${firmaActual}`;
      if (eventosPedidoNotificadosRef.current.has(keyCambio)) return;
      eventosPedidoNotificadosRef.current.add(keyCambio);

      const folio = String(orden?.folio || '').trim();
      const mensajeEstado = mensajeEstadoPedidoCliente(estadoActual);
      const mensajeFinal = folio ? `${mensajeEstado} (${folio})` : mensajeEstado;
      agregarNotificacionClientePedido({
        titulo: tituloEstadoPedidoCliente(estadoActual),
        mensaje: mensajeFinal,
        tipo: 'pedido_estado'
      });
      mostrarNotificacion(mensajeFinal, 'exito');
      if (permisoNotificacionesPedidos === 'granted') {
        mostrarNotificacionNativa({
          titulo: tituloEstadoPedidoCliente(estadoActual),
          mensaje: mensajeFinal,
          tag: `pedido:estado:fallback:${idOrden}:${estadoActual || 'actualizado'}`,
          sonido: sonidoNotificacionesPedidos
        });
      }
    });

    estadoOrdenesClienteRef.current = mapaNuevo;
  }

  const opcionesMetodoPago = [
    { value: 'efectivo', label: 'Efectivo contra entrega' },
    { value: 'transferencia', label: 'Transferencia' },
    { value: 'tarjeta', label: 'Tarjeta presencial' },
    { value: 'mercado_pago', label: 'Mercado Pago' }
  ].filter((item) => !metodoPagoOculto(item?.value));

  useEffect(() => {
    if (!esVistaTrastienda) return;
    setVistaActiva('trastienda');
  }, [esVistaTrastienda]);

  useEffect(() => {
    if (esVistaTrastienda) return;
    guardarValorPersistido(CLAVE_TIENDA_VISTA_ACTIVA, vistaActiva);
  }, [esVistaTrastienda, vistaActiva]);

  useEffect(() => {
    if (esVistaTrastienda) return;

    const infoInvalida = vistaActiva === 'info' && !String(infoSeleccionada?.titulo || '').trim();
    const detalleInvalido = vistaActiva === 'detalle' && !seleccionado;
    if (infoInvalida || detalleInvalido) {
      setVistaActiva('tienda');
    }
  }, [esVistaTrastienda, vistaActiva, infoSeleccionada, seleccionado]);

  useEffect(() => {
    if (esVistaTrastienda) return;
    guardarValorPersistido(CLAVE_TIENDA_SECCION_ACTIVA, seccionActiva);
  }, [esVistaTrastienda, seccionActiva]);

  useEffect(() => {
    if (esVistaTrastienda) return;
    guardarValorPersistido(CLAVE_TIENDA_CATEGORIA_ACTIVA, categoriaActiva);
  }, [esVistaTrastienda, categoriaActiva]);

  useEffect(() => {
    if (!esVistaTrastienda) return;
    guardarValorPersistido(CLAVE_TRASTIENDA_VISTA_ADMIN, adminVista);
  }, [esVistaTrastienda, adminVista]);

  useEffect(() => {
    if (!(esVistaTrastienda || vistaActiva === 'trastienda')) return;
    if (!tokenInterno) return;

    if (!vistasTrastiendaDisponibles.length) {
      if (adminVista !== '__sin_permisos__') {
        setAdminVista('__sin_permisos__');
      }
      return;
    }

    const existeActual = vistasTrastiendaDisponibles.some((item) => item.id === adminVista);
    if (!existeActual) {
      setAdminVista(vistaTrastiendaFallback);
    }
  }, [esVistaTrastienda, vistaActiva, tokenInterno, adminVista, vistasTrastiendaDisponibles, vistaTrastiendaFallback]);

  useEffect(() => {
    if (!esVistaTrastienda) return;
    guardarValorPersistido(CLAVE_TRASTIENDA_CONFIG_TAB, configAdminTab);
  }, [esVistaTrastienda, configAdminTab]);

  useEffect(() => {
    if (!esVistaTrastienda) return;
    guardarValorPersistido(CLAVE_TRASTIENDA_DESCUENTOS_TAB, descuentoTabInterna);
  }, [esVistaTrastienda, descuentoTabInterna]);

  useEffect(() => {
    if (!clienteToken) return;
    const onFocus = () => setMpReconcileTick((v) => v + 1);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setMpReconcileTick((v) => v + 1);
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [clienteToken]);

  useEffect(() => {
    if (!clienteToken) return;

    const intervalo = window.setInterval(() => {
      try {
        const raw = String(localStorage.getItem(CLAVE_MP_CHECKOUT_PENDIENTE) || '').trim();
        if (!raw) return;
        const data = JSON.parse(raw) || {};
        const creadoEn = Number(data?.creado_en) || 0;
        if (creadoEn > 0 && (Date.now() - creadoEn) > (20 * 60 * 1000)) {
          localStorage.removeItem(CLAVE_MP_CHECKOUT_PENDIENTE);
          return;
        }
        setMpReconcileTick((v) => v + 1);
      } catch {
      }
    }, 7000);

    return () => window.clearInterval(intervalo);
  }, [clienteToken]);

  useEffect(() => {
    if (!clienteToken) return;
    if (confirmandoPagoMpRef.current) return;

    const limpiarRetornoMercadoPago = () => {
      try {
        const url = new URL(window.location.href);
        const claves = [
          'mp_status',
          'status',
          'collection_status',
          'payment_id',
          'collection_id',
          'preference_id'
        ];
        let huboCambios = false;
        claves.forEach((clave) => {
          if (url.searchParams.has(clave)) {
            url.searchParams.delete(clave);
            huboCambios = true;
          }
        });
        if (huboCambios) {
          const siguiente = `${url.pathname}${url.search}${url.hash}`;
          window.history.replaceState({}, document.title, siguiente);
        }
      } catch {
      }
    };

    const obtenerParametro = (paramsA, paramsB, ...claves) => {
      for (const clave of claves) {
        const a = String(paramsA.get(clave) || '').trim();
        if (a) return a;
        const b = String(paramsB.get(clave) || '').trim();
        if (b) return b;
      }
      return '';
    };

    const ejecutar = async () => {
      const limpiarPendienteLocal = () => {
        try {
          localStorage.removeItem(CLAVE_MP_CHECKOUT_PENDIENTE);
        } catch {
        }
      };

      const leerPendienteLocal = () => {
        try {
          const raw = String(localStorage.getItem(CLAVE_MP_CHECKOUT_PENDIENTE) || '').trim();
          if (!raw) return null;
          const data = JSON.parse(raw) || {};
          return {
            preference_id: String(data?.preference_id || '').trim(),
            folio: String(data?.folio || '').trim(),
            creado_en: Number(data?.creado_en) || 0
          };
        } catch {
          return null;
        }
      };

      const searchParams = new URLSearchParams(String(window.location.search || ''));
      const hashRaw = String(window.location.hash || '');
      const hashQuery = hashRaw.includes('?') ? hashRaw.slice(hashRaw.indexOf('?') + 1) : '';
      const hashParams = new URLSearchParams(hashQuery);

      const statusRaw = obtenerParametro(searchParams, hashParams, 'collection_status', 'status', 'mp_status');
      const paymentId = obtenerParametro(searchParams, hashParams, 'payment_id', 'collection_id');
      const preferenceIdUrl = obtenerParametro(searchParams, hashParams, 'preference_id');
      const pendienteLocal = leerPendienteLocal();
      const preferenceId = String(preferenceIdUrl || pendienteLocal?.preference_id || '').trim();
      const vieneDeCallback = Boolean(statusRaw || paymentId || preferenceIdUrl);

      if (!vieneDeCallback && !preferenceId) return;

      const status = String(statusRaw || '').trim().toLowerCase();
      if (vieneDeCallback && status && status !== 'approved' && status !== 'authorized' && status !== 'success') {
        limpiarRetornoMercadoPago();
        if (status === 'rejected' || status === 'cancelled') {
          limpiarPendienteLocal();
        }
        mostrarNotificacion(
          status === 'pending'
            ? 'Tu pago aún está pendiente de confirmación en Mercado Pago.'
            : 'El pago no se completó en Mercado Pago.',
          status === 'pending' ? 'advertencia' : 'error'
        );
        return;
      }

      confirmandoPagoMpRef.current = true;
      if (vieneDeCallback) {
        setProcesandoPagoMp(true);
      }
      try {
        if (vieneDeCallback) {
          mostrarNotificacion('Pago detectado. Estamos confirmando y generando tu pedido...', 'exito');
        }
        const endpoint = vieneDeCallback
          ? '/tienda/checkout/mercado-pago/confirmar'
          : '/tienda/checkout/mercado-pago/reconciliar';
        const data = await fetchJson(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${clienteToken}`
          },
          body: JSON.stringify({
            payment_id: paymentId,
            preference_id: preferenceId
          })
        });

        const orden = data?.orden;
        if (!orden?.folio) {
          if (!vieneDeCallback && data?.pendiente) return;
          throw new Error('No se pudo generar la orden después del pago');
        }

        setCarrito([]);
        setCarritoCreadoEn(Date.now());
        setCheckout((prev) => ({ ...prev, notas: '' }));
        cerrarCarrito();
        await cargarMisOrdenes();
        await cargarProductos({ silencioso: true });
        limpiarRetornoMercadoPago();
        limpiarPendienteLocal();

        await mostrarConfirmacion(
          `Pago confirmado. Tu pedido ${orden.folio} ya fue generado correctamente.`,
          'Pago confirmado'
        );
      } catch (error) {
        limpiarRetornoMercadoPago();
        mostrarNotificacion(error?.message || 'No se pudo confirmar el pago de Mercado Pago', 'error');
      } finally {
        if (vieneDeCallback) {
          setProcesandoPagoMp(false);
        }
        confirmandoPagoMpRef.current = false;
      }
    };

    ejecutar();
  }, [clienteToken, mpReconcileTick]);

  useEffect(() => {
    if (!esVistaTrastienda) return;
    const aplicarObjetivoPedido = ({ folio = '', idOrden = '' } = {}) => {
      const tienePermisoPedidos = vistasTrastiendaDisponibles.some((item) => item.id === 'pedidos');
      setAdminVista(tienePermisoPedidos ? 'pedidos' : vistaTrastiendaFallback);
      if (!tienePermisoPedidos) {
        setOrdenObjetivoAdmin({ id: '', folio: '' });
        return;
      }

      const folioLimpio = String(folio || '').trim();
      const idLimpio = String(idOrden || '').trim();
      const termino = folioLimpio || idLimpio;
      setFiltroEstadoOrdenAdmin('todos');
      if (termino) {
        setBusquedaAdmin(termino);
      }
      setOrdenObjetivoAdmin({ id: idLimpio, folio: folioLimpio });
    };

    const aplicarFiltroPedidosDesdeHash = () => {
      const hashRaw = String(window.location.hash || '').trim();
      const hashActual = hashRaw.toLowerCase();
      if (!hashActual.startsWith('#/trastienda/pedidos')) return;

      const idxQuery = hashRaw.indexOf('?');
      if (idxQuery < 0) {
        aplicarObjetivoPedido({});
        return;
      }
      const params = new URLSearchParams(hashRaw.slice(idxQuery + 1));
      aplicarObjetivoPedido({
        folio: String(params.get('folio') || '').trim(),
        idOrden: String(params.get('id_orden') || '').trim()
      });
    };

    const onAlertaClick = (event) => {
      const destinoPage = String(event?.detail?.destino?.page || '').trim().toLowerCase();
      const destinoSection = String(event?.detail?.destino?.section || '').trim().toLowerCase();
      if (destinoPage !== 'trastienda' || destinoSection !== 'pedidos') return;
      aplicarObjetivoPedido({
        folio: String(event?.detail?.meta?.folio || '').trim(),
        idOrden: String(event?.detail?.meta?.id_orden || '').trim()
      });
    };

    aplicarFiltroPedidosDesdeHash();
    window.addEventListener('hashchange', aplicarFiltroPedidosDesdeHash);
    window.addEventListener('chipactli:alerta-click', onAlertaClick);

    return () => {
      window.removeEventListener('hashchange', aplicarFiltroPedidosDesdeHash);
      window.removeEventListener('chipactli:alerta-click', onAlertaClick);
    };
  }, [esVistaTrastienda, vistasTrastiendaDisponibles, vistaTrastiendaFallback]);

  useEffect(() => {
    if (!esVistaTrastienda) return;
    if (adminVista !== 'pedidos') return;

    const objetivoId = Number(ordenObjetivoAdmin?.id || 0);
    const objetivoFolio = String(ordenObjetivoAdmin?.folio || '').trim().toLowerCase();
    if (!objetivoId && !objetivoFolio) return;

    const ordenObjetivo = (adminOrdenes || []).find((orden) => {
      const idOrden = Number(orden?.id || 0);
      const folioOrden = String(orden?.folio || '').trim().toLowerCase();
      if (objetivoId && idOrden === objetivoId) return true;
      if (objetivoFolio && folioOrden === objetivoFolio) return true;
      return false;
    });
    if (!ordenObjetivo?.id) return;

    const run = () => {
      const el = document.getElementById(`admin-orden-${Number(ordenObjetivo.id)}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        setOrdenObjetivoAdmin({ id: String(ordenObjetivo.id), folio: String(ordenObjetivo.folio || '').trim() });
      }, 250);
    };

    const raf = window.requestAnimationFrame(run);
    return () => window.cancelAnimationFrame(raf);
  }, [esVistaTrastienda, adminVista, adminOrdenes, ordenObjetivoAdmin]);

  useEffect(() => {
    cargarProductos();
    cargarCategoriasAdmin({ silencioso: true });
    cargarPuntosEntrega();
    cargarConfigTienda();
  }, []);

  useEffect(() => {
    if (esVistaTrastienda) return;
    setCategoriaActiva('todas');
  }, [esVistaTrastienda]);

  useEffect(() => () => {
    if (animacionCategoriaTimerRef.current) {
      clearTimeout(animacionCategoriaTimerRef.current);
      animacionCategoriaTimerRef.current = null;
    }
    if (transicionCategoriaTimerRef.current) {
      clearTimeout(transicionCategoriaTimerRef.current);
      transicionCategoriaTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!clienteToken) {
      setCliente(null);
      setOrdenes([]);
      setDireccionesPerfil([]);
      hidratandoCarritoServidorRef.current = false;
      guardandoCarritoServidorRef.current = false;
      snapshotCarritoServidorRef.current = '[]';
      actualizadoCarritoServidorMsRef.current = 0;
      if (debounceCarritoServidorRef.current) {
        clearTimeout(debounceCarritoServidorRef.current);
        debounceCarritoServidorRef.current = null;
      }
      setMostrarPromptNotificacionesPedidos(false);
      setNotificacionesClientePedidos([]);
      estadoOrdenesClienteRef.current = new Map();
      estadoOrdenesInicializadoRef.current = false;
      return;
    }
    estadoOrdenesClienteRef.current = new Map();
    estadoOrdenesInicializadoRef.current = false;
    cargarPerfil(clienteToken);
    cargarMisOrdenes(clienteToken);
    cargarNotificacionesCliente(clienteToken);
    cargarDireccionesPerfil(clienteToken);
    cargarCarritoServidor(clienteToken, { fusionarLocal: true, aplicarEstado: true, silencioso: true });
  }, [clienteToken]);

  useEffect(() => {
    if (!clienteToken) return undefined;

    const intervalo = setInterval(() => {
      cargarMisOrdenes(clienteToken);
      cargarNotificacionesCliente(clienteToken);
    }, 5000);

    return () => clearInterval(intervalo);
  }, [clienteToken]);

  useEffect(() => {
    if (!clienteToken) return undefined;

    const refrescar = async () => {
      if (guardandoCarritoServidorRef.current) return;
      const ultimoCambioLocal = Number(ultimoCambioCarritoLocalMsRef.current) || 0;
      if (Date.now() - ultimoCambioLocal < 1200) return;

      const data = await cargarCarritoServidor(clienteToken, {
        fusionarLocal: false,
        aplicarEstado: false,
        silencioso: true
      });
      if (!data) return;

      const snapshotRemoto = serializarCarritoCliente(data.items || []);
      const snapshotLocal = serializarCarritoCliente(carrito);
      if (snapshotRemoto === snapshotLocal) return;

      hidratandoCarritoServidorRef.current = true;
      setCarrito(normalizarListaCarritoCliente(data.items || []));
      setCarritoCreadoEn(Number(data.creadoEn) || Date.now());
      window.setTimeout(() => {
        hidratandoCarritoServidorRef.current = false;
      }, 0);
    };

    const intervalo = setInterval(refrescar, SINCRONIZACION_CARRITO_PULL_MS);
    return () => clearInterval(intervalo);
  }, [clienteToken, carrito]);

  useEffect(() => {
    if (!clienteToken) return undefined;

    const alVolverVisible = () => {
      if (document.visibilityState === 'visible') {
        cargarMisOrdenes(clienteToken);
        cargarCarritoServidor(clienteToken, {
          fusionarLocal: false,
          aplicarEstado: true,
          silencioso: true
        });
        return;
      }

      if (document.visibilityState === 'hidden') {
        sincronizarCarritoPendienteAntesDeSalir(clienteToken);
      }
    };

    document.addEventListener('visibilitychange', alVolverVisible);
    return () => document.removeEventListener('visibilitychange', alVolverVisible);
  }, [clienteToken]);

  useEffect(() => {
    setPermisoNotificacionesPedidos(obtenerPermisoNotificacionesNativas());
  }, []);

  useEffect(() => {
    if (!clienteToken || !notificacionesNativasDisponibles()) {
      setMostrarPromptNotificacionesPedidos(false);
      return;
    }

    if (permisoNotificacionesPedidos !== 'default') {
      setMostrarPromptNotificacionesPedidos(false);
      return;
    }

    let ultimoPrompt = 0;
    try {
      ultimoPrompt = Number(localStorage.getItem(CLAVE_NOTIF_PEDIDOS_ULTIMO_PROMPT) || 0);
    } catch {
      ultimoPrompt = 0;
    }

    const haceMasDeUnDia = (Date.now() - ultimoPrompt) > (24 * 60 * 60 * 1000);
    setMostrarPromptNotificacionesPedidos(haceMasDeUnDia);
  }, [clienteToken, permisoNotificacionesPedidos]);

  useEffect(() => {
    setSonidoNotificacionesPedidosDraft(sonidoNotificacionesPedidos);
  }, [sonidoNotificacionesPedidos]);

  useEffect(() => {
    if (!mostrarModalPerfilCliente) return;
    if (perfilModalTab !== 'direcciones') return;
    if (!clienteToken) return;
    cargarDireccionesPerfil(clienteToken);
  }, [mostrarModalPerfilCliente, perfilModalTab, clienteToken]);

  useEffect(() => {
    const esCliente = Boolean(clienteToken);
    if (!esCliente && carrito.length && (Date.now() - carritoCreadoEn > EXPIRACION_CARRITO_INVITADO_MS)) {
      setCarrito([]);
      setCarritoCreadoEn(Date.now());
      return;
    }
    guardarCarritoGuardado(carrito, carritoCreadoEn, cuponesAplicados);
  }, [carrito, carritoCreadoEn, clienteToken, cuponesAplicados]);

  useEffect(() => {
    ultimoCambioCarritoLocalMsRef.current = Date.now();
    if (!clienteToken) return undefined;
    if (hidratandoCarritoServidorRef.current) return undefined;

    const snapshotLocal = serializarCarritoCliente(carrito);
    if (snapshotLocal === snapshotCarritoServidorRef.current && !guardandoCarritoServidorRef.current) {
      return undefined;
    }

    if (debounceCarritoServidorRef.current) {
      clearTimeout(debounceCarritoServidorRef.current);
    }

    debounceCarritoServidorRef.current = setTimeout(() => {
      guardarCarritoServidor(carrito, carritoCreadoEn, clienteToken, true);
    }, SINCRONIZACION_CARRITO_DEBOUNCE_MS);

    return () => {
      if (debounceCarritoServidorRef.current) {
        clearTimeout(debounceCarritoServidorRef.current);
        debounceCarritoServidorRef.current = null;
      }
    };
  }, [carrito, carritoCreadoEn, clienteToken]);

  useEffect(() => () => {
    sincronizarCarritoPendienteAntesDeSalir();
  }, []);

  const productosFiltrados = useMemo(() => {
    const termino = filtro.trim().toLowerCase();
    return productos.filter((item) => {
      if (String(item?.tipo_producto || '').trim().toLowerCase() === 'paquete' && !productoPaqueteDisponibleTienda(item)) {
        return false;
      }

      const nombre = String(item?.nombre_receta || '').toLowerCase();
      const descripcion = String(item?.descripcion || '').toLowerCase();
      const categoria = normalizarClaveCategoriaTienda(item?.categoria_nombre);

      const matchTexto = !termino || nombre.includes(termino) || descripcion.includes(termino);
      if (!matchTexto) return false;

      if (categoriaActiva !== 'todas' && categoria !== categoriaActiva) return false;

      if (seccionActiva === 'lanzamientos') return Boolean(item?.es_lanzamiento);
      if (seccionActiva === 'favoritos') return productoEsFavoritoCliente(item);
      if (seccionActiva === 'ofertas') return Boolean(item?.es_oferta);
      if (seccionActiva === 'accesorios') return Boolean(item?.es_accesorio);

      const categoriaCustom = mapaSeccionesPersonalizadas.get(seccionActiva);
      if (categoriaCustom) return categoria === categoriaCustom;

      return true;
    });
  }, [productos, filtro, categoriaActiva, seccionActiva, mapaSeccionesPersonalizadas, favoritosVitrinaSet]);

  const categoriasDisponibles = useMemo(() => {
    const setCategorias = new Set();
    for (const item of productos) {
      if (String(item?.tipo_producto || '').trim().toLowerCase() === 'paquete' && !productoPaqueteDisponibleTienda(item)) {
        continue;
      }
      const categoria = String(item?.categoria_nombre || '').trim();
      if (categoria) setCategorias.add(categoria);
    }
    return Array.from(setCategorias).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [productos]);

  const categoriasDisponiblesNormalizadas = useMemo(
    () => new Set(categoriasDisponibles.map((cat) => normalizarClaveCategoriaTienda(cat)).filter(Boolean)),
    [categoriasDisponibles]
  );

  const mapaImagenCategoria = useMemo(() => {
    const mapaPorId = new Map();
    const mapaPorNombre = new Map();
    for (const item of (Array.isArray(categoriasAdmin) ? categoriasAdmin : [])) {
      const id = Number(item?.id) || 0;
      const nombre = normalizarClaveCategoriaTienda(item?.nombre);
      const imageUrl = normalizarUrlMediaTienda(item?.image_url);
      if (!imageUrl) continue;
      if (id > 0) {
        mapaPorId.set(id, imageUrl);
      }
      if (nombre) {
        mapaPorNombre.set(nombre, imageUrl);
      }
    }
    return { mapaPorId, mapaPorNombre };
  }, [categoriasAdmin]);

  const categoriasTarjetas = useMemo(() => {
    const termino = filtro.trim().toLowerCase();
    const mapa = new Map();

    for (const item of productos) {
      if (String(item?.tipo_producto || '').trim().toLowerCase() === 'paquete' && !productoPaqueteDisponibleTienda(item)) {
        continue;
      }

      const nombre = String(item?.nombre_receta || '').toLowerCase();
      const descripcion = String(item?.descripcion || '').toLowerCase();
      const categoriaTexto = String(item?.categoria_nombre || '').trim() || 'Sin categoría';
      const categoria = normalizarClaveCategoriaTienda(categoriaTexto);
      const categoriaId = Number(item?.categoria_id) || 0;

      const matchTexto = !termino || nombre.includes(termino) || descripcion.includes(termino) || categoria.includes(termino);
      if (!matchTexto) continue;

      if (seccionActiva === 'lanzamientos' && !Boolean(item?.es_lanzamiento)) continue;
      if (seccionActiva === 'favoritos' && !productoEsFavoritoCliente(item)) continue;
      if (seccionActiva === 'ofertas' && !Boolean(item?.es_oferta)) continue;
      if (seccionActiva === 'accesorios' && !Boolean(item?.es_accesorio)) continue;

      const categoriaCustom = mapaSeccionesPersonalizadas.get(seccionActiva);
      if (categoriaCustom && categoria !== categoriaCustom) continue;

      if (!mapa.has(categoria)) {
        const imageUrlCategoria = categoriaId > 0
          ? String(mapaImagenCategoria?.mapaPorId?.get(categoriaId) || mapaImagenCategoria?.mapaPorNombre?.get(categoria) || '').trim()
          : String(mapaImagenCategoria?.mapaPorNombre?.get(categoria) || '').trim();
        mapa.set(categoria, {
          key: categoria,
          label: categoriaTexto,
          total: 0,
          imageUrl: imageUrlCategoria
        });
      }

      const actual = mapa.get(categoria);
      actual.total += 1;

      const mediaUrl = String(item?.image_url || '').trim();
      if (!actual.imageUrl && mediaUrl && !esUrlVideoTienda(mediaUrl)) {
        actual.imageUrl = mediaUrl;
      }
    }

    return Array.from(mapa.values()).sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
  }, [productos, filtro, seccionActiva, mapaSeccionesPersonalizadas, mapaImagenCategoria, favoritosVitrinaSet]);

  const categoriasTarjetasVisibles = useMemo(() => {
    if (categoriaActiva === 'todas') return categoriasTarjetas;
    return categoriasTarjetas.filter((cat) => cat.key === categoriaActiva);
  }, [categoriaActiva, categoriasTarjetas]);

  function entrarCategoriaDesdeVista(categoriaKey, origenEl = null, datosCategoria = null, opciones = {}) {
    const key = String(categoriaKey || '').trim().toLowerCase();
    if (!key || key === 'todas') {
      if (!opciones?.sinHash) {
        navegarRutaPublicaTienda({ categoria: 'todas' });
      }
      // Animación inversa al regresar a categorías
      if (categoriaActiva !== 'todas') {
        // Buscar el botón de la categoría activa para animar la salida
        const idx = categoriasTarjetas.findIndex(c => c.key === categoriaActiva);
        const card = document.querySelectorAll('.tiendaCategoriasVista .tiendaCategoriaCard')[idx];
        let rect, imageUrl, label;
        if (card) {
          rect = card.getBoundingClientRect();
          imageUrl = categoriasTarjetas[idx]?.imageUrl || '';
          label = categoriasTarjetas[idx]?.label || '';
        } else {
          rect = { left: window.innerWidth/2-100, top: window.innerHeight/2-100, width: 200, height: 200 };
          imageUrl = '';
          label = '';
        }
        setTransicionCategoriaVentana({
          activa: true,
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          imageUrl,
          label,
          entrando: false,
          salidaRapida: true
        });
        if (transicionCategoriaTimerRef.current) {
          clearTimeout(transicionCategoriaTimerRef.current);
        }
        transicionCategoriaTimerRef.current = setTimeout(() => {
          setTransicionCategoriaVentana((prev) => ({ ...prev, activa: false }));
          setCategoriaActiva('todas');
          setCategoriaEntrandoKey('');
          setAnimandoEntradaCategoria(false);
          transicionCategoriaTimerRef.current = null;
        }, 220);
        return;
      }
      setCategoriaActiva('todas');
      setCategoriaEntrandoKey('');
      setAnimandoEntradaCategoria(false);
      return;
    }

    if (!opciones?.sinHash) {
      navegarRutaPublicaTienda({ categoria: key });
    }

    if (origenEl && typeof window !== 'undefined' && typeof origenEl.getBoundingClientRect === 'function') {
      const rect = origenEl.getBoundingClientRect();
      const imageUrl = String(datosCategoria?.imageUrl || '').trim();
      const label = String(datosCategoria?.label || '').trim();
      setTransicionCategoriaVentana({
        activa: true,
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        imageUrl,
        label,
        entrando: true,
        salidaRapida: false
      });
      if (transicionCategoriaTimerRef.current) {
        clearTimeout(transicionCategoriaTimerRef.current);
      }
      transicionCategoriaTimerRef.current = setTimeout(() => {
        setTransicionCategoriaVentana((prev) => ({ ...prev, activa: false }));
        transicionCategoriaTimerRef.current = null;
      }, 180);
    }
    setCategoriaActiva(key);
    setCategoriaEntrandoKey(key);
    setAnimandoEntradaCategoria(true);
    if (animacionCategoriaTimerRef.current) {
      clearTimeout(animacionCategoriaTimerRef.current);
    }
    animacionCategoriaTimerRef.current = setTimeout(() => {
      setAnimandoEntradaCategoria(false);
      setCategoriaEntrandoKey('');
      animacionCategoriaTimerRef.current = null;
    }, 120);
  }

  useEffect(() => {
    if (esVistaTrastienda) return;
    if (categoriaActiva === 'todas') return;

    if (seccionActiva === 'favoritos') return;

    const existe = categoriasDisponiblesNormalizadas.has(categoriaActiva);
    if (!existe) {
      setCategoriaActiva('todas');
    }
  }, [esVistaTrastienda, categoriaActiva, seccionActiva, categoriasDisponiblesNormalizadas]);

  const controlesSecciones = useMemo(() => {
    const opciones = [
      { id: 'todos', key: 'todos', label: 'Todos', configKey: 'menu_todos_activo', predeterminado: true },
      { id: 'lanzamientos', key: 'lanzamientos', label: 'Lanzamientos', configKey: 'menu_lanzamientos_activo', predeterminado: true },
      { id: 'favoritos', key: 'favoritos', label: 'Favoritos', configKey: 'menu_favoritos_activo', predeterminado: true },
      { id: 'ofertas', key: 'ofertas', label: 'Ofertas', configKey: 'menu_ofertas_activo', predeterminado: true },
      { id: 'accesorios', key: 'accesorios', label: 'Accesorios', configKey: 'menu_accesorios_activo', predeterminado: true }
    ];
    const fijas = opciones.filter((item) => {
      if (item.key === 'favoritos') return true;
      if (tabsBaseEliminadasClienteSet.has(item.id)) return false;
      return configActivo(configTienda?.[item.configKey], item.predeterminado);
    });
    const personalizadas = tabsNavegacionCliente
      .filter((tab) => tab?.activo)
      .map((tab) => ({ key: `custom:${tab.id}`, label: tab.label }));
    return [...fijas, ...personalizadas];
  }, [configTienda, tabsNavegacionCliente, tabsBaseEliminadasClienteSet]);

  const mostrarFiltroCategoria = !tabsBaseEliminadasClienteSet.has('menu_categoria')
    && configActivo(configTienda?.menu_categoria_activo, true);

  const seccionCatalogoPrincipal = useMemo(
    () => controlesSecciones.find((item) => item.key !== 'favoritos')?.key || 'todos',
    [controlesSecciones]
  );

  const mostrandoVistaCategorias = categoriaActiva === 'todas' && seccionActiva !== 'favoritos';

  const abrirSesionCliente = () => {
    setModoAuth('login');
    setPasoRegistro(1);
    setMostrarModalAuthCliente(true);
    setMostrarMenuMovil(false);
  };

  const abrirPerfilCliente = () => {
    setPerfilModalTab('datos');
    setMostrarModalPerfilCliente(true);
    setMostrarMenuMovil(false);
  };

  const abrirCarritoDesdeMenuMovil = () => {
    setMostrarMenuMovil(false);
    abrirCarrito();
  };

  const abrirCategoriaDesdeMenuMovil = (categoriaKey) => {
    setSeccionActiva(seccionCatalogoPrincipal);
    entrarCategoriaDesdeVista(categoriaKey);
    setMostrarMenuMovil(false);
  };

  const abrirFavoritosDesdeMenuMovil = () => {
    setSeccionActiva('favoritos');
    setCategoriaActiva('todas');
    setMostrarMenuMovil(false);
  };

  useEffect(() => {
    if (esVistaTrastienda) return;
    if (!controlesSecciones.length) {
      if (seccionActiva !== 'todos') setSeccionActiva('todos');
      return;
    }
    if (seccionActiva === 'favoritos') return;
    if (!controlesSecciones.some((item) => item.key === seccionActiva)) {
      setSeccionActiva(controlesSecciones[0].key);
    }
  }, [controlesSecciones, seccionActiva, esVistaTrastienda]);

  useEffect(() => {
    if (esVistaTrastienda) {
      setMostrarMenuMovil(false);
    }
  }, [esVistaTrastienda]);

  useEffect(() => {
    if (!mostrarMenuMovil) return undefined;

    const html = document.documentElement;
    const body = document.body;
    const esMovil = window.matchMedia('(max-width: 768px)').matches;

    if (!esMovil) return undefined;

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [mostrarMenuMovil]);

  const subtotalCarrito = useMemo(() => {
    return carrito.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  }, [carrito]);

  const descuentoCuponCarrito = useMemo(() => {
    const lista = Array.isArray(cuponesAplicados) ? cuponesAplicados : [];
    if (!lista.length) return 0;

    let restante = Math.max(0, Number(subtotalCarrito) || 0);
    let descuento = 0;

    for (const cupon of lista) {
      if (restante <= 0) break;
      const descuentoValidado = Math.max(0, Number(cupon?.monto_descuento) || 0);
      let descuentoCupon = Math.max(0, Math.min(restante, Number(descuentoValidado.toFixed(2))));
      if (descuentoCupon <= 0) {
        const tipo = String(cupon?.tipo_descuento || 'porcentaje').trim().toLowerCase();
        const valor = Math.max(0, Number(cupon?.valor_descuento) || 0);
        const descuentoBase = tipo === 'monto_fijo'
          ? valor
          : (restante * (valor / 100));
        descuentoCupon = Math.max(0, Math.min(restante, Number(descuentoBase.toFixed(2))));
      }
      descuento += descuentoCupon;
      restante = Math.max(0, Number((restante - descuentoCupon).toFixed(2)));
    }

    return Math.max(0, Math.min(subtotalCarrito, Number(descuento.toFixed(2))));
  }, [cuponesAplicados, subtotalCarrito]);

  const totalCarrito = useMemo(() => (
    Math.max(0, Number((subtotalCarrito - descuentoCuponCarrito).toFixed(2)))
  ), [subtotalCarrito, descuentoCuponCarrito]);

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

  const linksInformacionPorSlug = useMemo(() => {
    const mapa = new Map();
    linksInformacion.forEach((item) => {
      const slug = slugPestanaMenu(item?.label || '');
      if (slug) mapa.set(slug, item);
    });
    return mapa;
  }, [linksInformacion]);

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
      { clave: 'facebook', label: 'Facebook', icono: 'f', logo: '/images/facebook.png' },
      { clave: 'instagram', label: 'Instagram', icono: 'ig', logo: '/images/instagram.png' },
      { clave: 'tiktok', label: 'TikTok', icono: 'tt', logo: '/images/tiktok.png' },
      { clave: 'youtube', label: 'YouTube', icono: 'yt', logo: '/images/youtube.png' },
      { clave: 'x', label: 'X', icono: 'x', logo: '' },
      { clave: 'linkedin', label: 'LinkedIn', icono: 'in', logo: '' }
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

  function navegarRutaPublicaTienda(ruta = {}, opciones = {}) {
    actualizarRutaPublicaTiendaHash(ruta, opciones);
  }

  function abrirLinkInformacion(item, opciones = {}) {
    setInfoSeleccionada({
      titulo: String(item?.label || 'Información').trim() || 'Información',
      texto: String(item?.texto || '').trim() || 'Aún no hay contenido configurado para esta sección.',
      href: String(item?.href || '').trim()
    });
    setVistaActiva('info');
    if (!opciones?.sinHash) {
      navegarRutaPublicaTienda({
        categoria: categoriaActiva,
        info: slugPestanaMenu(item?.label || 'informacion')
      });
    }
  }

  function volverAVitrinaActual(opciones = {}) {
    setVistaActiva('tienda');
    setInfoSeleccionada(null);
    setSeleccionado(null);
    if (!opciones?.sinHash) {
      navegarRutaPublicaTienda({ categoria: categoriaActiva });
    }
  }

  function restablecerVistaTienda(opciones = {}) {
    setVistaActiva('tienda');
    setSeccionActiva('todos');
    setCategoriaActiva('todas');
    setFiltro('');
    setInfoSeleccionada(null);
    setSeleccionado(null);
    if (!opciones?.sinHash) {
      navegarRutaPublicaTienda({ categoria: 'todas' });
    }
    if (!opciones?.silencioso) {
      mostrarNotificacion('Vitrina restablecida', 'exito');
    }
  }

  useEffect(() => {
    if (esVistaTrastienda) return undefined;

    const aplicarRutaPublica = () => {
      const ruta = leerRutaPublicaTiendaDesdeUrl();
      if (!ruta) return;

      const categoriaHash = normalizarClaveCategoriaTienda(ruta?.categoria || 'todas') || 'todas';
      const categoriaExiste = categoriaHash === 'todas' || categoriasTarjetas.some((item) => item.key === categoriaHash);
      const categoriaFinal = categoriaExiste ? categoriaHash : 'todas';

      if (categoriaActivaRef.current !== categoriaFinal) {
        setCategoriaActiva(categoriaFinal);
        setCategoriaEntrandoKey('');
        setAnimandoEntradaCategoria(false);
      }

      const slugProducto = String(ruta?.producto || '').trim().toLowerCase();
      if (slugProducto) {
        const objetivo = (productos || []).find((item) => (
          String(item?.slug || '').trim().toLowerCase() === slugProducto
        ));
        if (objetivo) {
          const slugActual = String(seleccionadoRef.current?.slug || '').trim().toLowerCase();
          if (!(vistaActivaRef.current === 'detalle' && slugActual === slugProducto)) {
            abrirDetalle(objetivo, { sinHash: true, scroll: false, registrar: false });
          }
          return;
        }
      }

      const slugInfo = String(ruta?.info || '').trim().toLowerCase();
      if (slugInfo) {
        const itemInfo = linksInformacionPorSlug.get(slugInfo) || null;
        if (itemInfo) {
          const slugInfoActual = slugPestanaMenu(infoSeleccionadaRef.current?.titulo || '');
          if (!(vistaActivaRef.current === 'info' && slugInfoActual === slugInfo)) {
            abrirLinkInformacion(itemInfo, { sinHash: true });
          }
          return;
        }
      }

      if (vistaActivaRef.current !== 'tienda' || infoSeleccionadaRef.current || seleccionadoRef.current) {
        volverAVitrinaActual({ sinHash: true });
      }
    };

    aplicarRutaPublica();
    window.addEventListener('hashchange', aplicarRutaPublica);
    window.addEventListener('popstate', aplicarRutaPublica);
    return () => {
      window.removeEventListener('hashchange', aplicarRutaPublica);
      window.removeEventListener('popstate', aplicarRutaPublica);
    };
  }, [
    esVistaTrastienda,
    productos,
    categoriasTarjetas,
    linksInformacionPorSlug
  ]);

  async function compartirProducto(producto) {
    const nombre = String(producto?.nombre_receta || 'Producto CHIPACTLI').trim();
    const link = construirLinkCompartirProducto(producto);
    if (!link) {
      mostrarNotificacion('No se pudo generar el enlace del producto', 'error');
      return;
    }

    const payload = {
      title: nombre,
      text: `Mira este producto de CHIPACTLI: ${nombre}`,
      url: link
    };

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(payload);
        registrarEventoComportamiento('compartir_producto', nombre);
        return;
      } catch (error) {
        if (String(error?.name || '') === 'AbortError') return;
      }
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        mostrarNotificacion('Enlace copiado al portapapeles', 'exito');
      } else {
        mostrarNotificacion('No se pudo copiar automáticamente, pero puedes copiar el enlace desde este modal.', 'advertencia', {
          titulo: 'Copiar enlace del producto',
          detalle: nombre ? `Producto: ${nombre}` : '',
          copyText: link,
          copyLabel: 'Copiar enlace'
        });
      }
      registrarEventoComportamiento('compartir_producto', nombre);
    } catch {
      mostrarNotificacion('No se pudo copiar automáticamente, pero puedes copiar el enlace desde este modal.', 'advertencia', {
        titulo: 'Copiar enlace del producto',
        detalle: nombre ? `Producto: ${nombre}` : '',
        copyText: link,
        copyLabel: 'Copiar enlace'
      });
    }
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

    const textEnc = encodeURIComponent(texto);
    const webUrl = `https://api.whatsapp.com/send?phone=${telefono}&text=${textEnc}`;
    try {
      const popup = window.open(webUrl, '_blank', 'noopener,noreferrer');
      if (!popup) {
        window.location.href = webUrl;
      }
    } catch (_) {
      window.location.href = webUrl;
    }
    registrarEventoComportamiento('enviar_whatsapp', nombre || 'anonimo');
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

  const productosDescuento = useMemo(() => {
    return (productos || [])
      .filter((producto) => String(producto?.tipo_producto || '').trim().toLowerCase() !== 'paquete')
      .sort((a, b) => {
        const categoriaA = String(a?.categoria_nombre || '').trim();
        const categoriaB = String(b?.categoria_nombre || '').trim();
        const cmpCategoria = categoriaA.localeCompare(categoriaB, 'es', { sensitivity: 'base' });
        if (cmpCategoria !== 0) return cmpCategoria;
        return String(a?.nombre_receta || '').localeCompare(String(b?.nombre_receta || ''), 'es', { sensitivity: 'base' });
      });
  }, [productos]);

  const categoriasDescuento = useMemo(() => {
    const setCategorias = new Set();
    for (const item of productosDescuento) {
      const categoria = String(item?.categoria_nombre || '').trim();
      if (categoria) setCategorias.add(categoria);
    }
    return Array.from(setCategorias).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [productosDescuento]);

  const productosCategoriaDescuento = useMemo(() => {
    const categoriaNorm = String(descuentoCategoriaActiva || '').trim().toLowerCase();
    const termino = String(filtroDescuentoProducto || '').trim().toLowerCase();
    return productosDescuento.filter((producto) => {
      const categoria = String(producto?.categoria_nombre || '').trim().toLowerCase();
      if (categoriaNorm && categoria !== categoriaNorm) return false;
      if (!termino) return true;
      const nombre = String(producto?.nombre_receta || '').toLowerCase();
      return nombre.includes(termino);
    });
  }, [productosDescuento, descuentoCategoriaActiva, filtroDescuentoProducto]);

  const productosExclusionGlobal = useMemo(() => {
    const termino = String(filtroExclusionGlobal || '').trim().toLowerCase();
    return productosDescuento.filter((producto) => {
      if (!termino) return true;
      const nombre = String(producto?.nombre_receta || '').toLowerCase();
      const categoria = String(producto?.categoria_nombre || '').toLowerCase();
      return nombre.includes(termino) || categoria.includes(termino);
    });
  }, [productosDescuento, filtroExclusionGlobal]);

  useEffect(() => {
    if (!categoriasDescuento.length) {
      setDescuentoCategoriaActiva('');
      return;
    }
    const existe = categoriasDescuento.some((categoria) => String(categoria).toLowerCase() === String(descuentoCategoriaActiva || '').toLowerCase());
    if (!existe) setDescuentoCategoriaActiva(String(categoriasDescuento[0] || '').toLowerCase());
  }, [categoriasDescuento, descuentoCategoriaActiva]);

  useEffect(() => {
    setDescuentoDrafts({});
  }, [descuentosAdmin]);


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
    const base = {
      total: adminOrdenes.length,
      pendiente: 0,
      procesando: 0,
      enviado_por_paqueteria: 0,
      en_transito: 0,
      entregado: 0,
      cancelado: 0
    };
    for (const orden of adminOrdenes) {
      const estado = String(orden?.estado || '').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(base, estado)) {
        base[estado] += 1;
      }
    }
    return base;
  }, [adminOrdenes]);

  useEffect(() => {
    const draft = {};
    for (const orden of (adminOrdenes || [])) {
      const id = Number(orden?.id) || 0;
      if (!id) continue;
      draft[id] = {
        estado: String(orden?.estado || 'pendiente').trim().toLowerCase(),
        estado_pago: String(orden?.estado_pago || 'pendiente_manual').trim().toLowerCase(),
        paqueteria: String(orden?.paqueteria || '').trim().toLowerCase(),
        numero_guia: String(orden?.numero_guia || '').trim()
      };
    }
    setSeguimientoDraftPorOrden(draft);
  }, [adminOrdenes]);

  function abrirCarrito() {
    if (Date.now() < bloqueoAperturaCarritoRef.current) return;
    setMostrarCarrito(true);
    setPasoCheckout(1);
    registrarEventoComportamiento('abrir_carrito');
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
    registrarEventoComportamiento('iniciar_checkout');
  }

  function continuarPasoPago() {
    if (!checkout.id_punto_entrega) {
      mostrarNotificacion('Selecciona un punto de entrega', 'error');
      return;
    }
    setPasoCheckout(3);
    registrarEventoComportamiento('checkout_paso_pago');
  }

  function regresarPasoCheckout() {
    setPasoCheckout((prev) => Math.max(1, prev - 1));
  }

  async function habilitarNotificacionesPedidosCliente() {
    if (!notificacionesNativasDisponibles()) {
      mostrarNotificacion('Tu navegador no soporta notificaciones nativas', 'advertencia');
      return;
    }

    const permiso = await solicitarPermisoNotificacionesNativas();
    setPermisoNotificacionesPedidos(permiso);
    try {
      localStorage.setItem(CLAVE_NOTIF_PEDIDOS_ULTIMO_PROMPT, String(Date.now()));
    } catch {
      // Ignorar errores de storage.
    }

    if (permiso === 'granted') {
      setMostrarPromptNotificacionesPedidos(false);
      await mostrarNotificacionNativa({
        titulo: 'CHIPACTLI',
        mensaje: 'Notificaciones de pedidos activadas.',
        tag: 'tienda:notificaciones-activadas',
        sonido: sonidoNotificacionesPedidos
      });
      mostrarNotificacion('Notificaciones de pedidos activadas', 'exito');
      return;
    }

    if (permiso === 'denied') {
      mostrarNotificacion('Bloqueaste las notificaciones. Puedes activarlas en ajustes del navegador.', 'advertencia');
      return;
    }

    mostrarNotificacion('No se activaron las notificaciones todavía', 'advertencia');
  }

  function cambiarSonidoNotificacionesPedidos(valor) {
    const nuevo = String(valor || '').trim().toLowerCase();
    setSonidoNotificacionesPedidosDraft(nuevo);
    reproducirSonidoAlerta(nuevo);
  }

  function guardarSonidoNotificacionesPedidos() {
    const guardado = configurarSonidoNotificacion(sonidoNotificacionesPedidosDraft);
    setSonidoNotificacionesPedidos(guardado);
    if (guardado === 'silencio') {
      mostrarNotificacion('Sonido guardado: sin sonido', 'exito');
      return;
    }
    mostrarNotificacion('Sonido de notificaciones guardado', 'exito');
  }

  async function activarServicioDomicilioAdmin() {
    if (activandoServicioDomicilio) return;
    const yaActivo = configActivo(configTiendaAdmin?.servicio_domicilio_habilitado, false);
    if (yaActivo) return;

    const confirmar = await confirmarAccionCriticaTrastienda({
      titulo: 'Activar servicio a domicilio',
      mensaje: 'Esta acción notificará a todos los clientes registrados y habilitará un canal operativo visible en la tienda.',
      frase: 'ACTIVAR DOMICILIO'
    });
    if (!confirmar) return;

    const passwordCeo = await solicitarTextoModal({
      titulo: 'Contraseña del CEO',
      mensaje: 'Ingresa la contraseña del CEO para confirmar la activación del servicio a domicilio.',
      etiqueta: 'Contraseña del CEO',
      tipo: 'password',
      aceptarLabel: 'Confirmar',
      autocomplete: 'current-password'
    }) || '';
    if (!String(passwordCeo || '').trim()) {
      mostrarNotificacion('Se requiere la contraseña del CEO', 'error');
      return;
    }

    setActivandoServicioDomicilio(true);
    try {
      await fetchAdmin('/tienda/admin/servicio-domicilio/habilitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password_ceo: passwordCeo })
      });
      await cargarConfigTiendaAdmin();
      await cargarConfigTienda();
      mostrarNotificacion('Servicio a domicilio activado y notificación enviada a clientes', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo activar el servicio a domicilio', 'error');
    } finally {
      setActivandoServicioDomicilio(false);
    }
  }

  async function cargarProductos(opciones = {}) {
    const silencioso = Boolean(opciones?.silencioso);

    if (!silencioso) setCargando(true);
    try {
      const usarRutaAdmin = Boolean(sesionInternaActiva) && (esVistaTrastienda || vistaActiva === 'trastienda');
      let data = [];
      if (usarRutaAdmin) {
        try {
          data = await fetchAdmin('/tienda/admin/productos');
        } catch {
          // Fallback defensivo: si el token interno expiró, no romper carga de productos.
          data = await fetchJson('/tienda/productos');
        }
      } else {
        data = await fetchJson('/tienda/productos');
      }
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
      mostrarNotificacion(error?.message || 'No se pudo cargar la vitrina', 'error');
    } finally {
      if (!silencioso) setCargando(false);
    }
  }

  async function cargarCategoriasAdmin(opciones = {}) {
    const silencioso = Boolean(opciones?.silencioso);
    if (!silencioso) setCargandoCategoriasAdmin(true);
    try {
      const data = await fetchJson('/categorias');
      const lista = Array.isArray(data) ? data : [];
      setCategoriasAdmin(lista.map((item) => ({
        id: Number(item?.id) || 0,
        nombre: String(item?.nombre || '').trim(),
        image_url: normalizarUrlMediaTienda(item?.image_url)
      })).filter((item) => item.id && item.nombre));
    } catch {
      if (!silencioso) mostrarNotificacion('No se pudieron cargar las categorías', 'error');
      setCategoriasAdmin([]);
    } finally {
      if (!silencioso) setCargandoCategoriasAdmin(false);
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

  function parseTextoFichaEnItems(texto = '') {
    const base = String(texto || '').trim();
    if (!base) return [];

    const normalizado = base
      .replace(/\r\n?/g, '\n')
      .replace(/\s*[•●▪◦·]\s*/g, '\n• ')
      .replace(/\s+(?=\d+[\.)]\s+)/g, '\n');

    return normalizado
      .split('\n')
      .map((linea) => String(linea || '').trim())
      .filter(Boolean)
      .map((linea) => String(linea).replace(/^[•●▪◦·]\s*/, '').trim())
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
    const confirmado = await confirmarAccionCriticaTrastienda({
      titulo: 'Guardar ficha de producto',
      mensaje: 'Vas a actualizar la ficha pública de un producto en tienda, incluyendo descripción, imagen o variantes.',
      frase: 'GUARDAR PRODUCTO'
    });
    if (!confirmado) return;

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
      await cargarProductos({ silencioso: true });
      mostrarNotificacion('Ficha de producto guardada', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo guardar la ficha', 'error');
    }
  }

  async function cargarPerfil(token) {
    try {
      const data = await fetchJson('/tienda/auth/perfil', {
        headers: headersClienteSesion({}, token)
      });
      if (token && !tokenPareceJwt(token)) {
        localStorage.setItem(CLAVE_TOKEN_CLIENTE, CLIENTE_COOKIE_SESSION_SENTINEL);
        setClienteToken(CLIENTE_COOKIE_SESSION_SENTINEL);
      }
      setCliente(data?.cliente || null);
      setPerfil({
        nombre: data?.cliente?.nombre || '',
        apellido_paterno: data?.cliente?.apellido_paterno || '',
        apellido_materno: data?.cliente?.apellido_materno || '',
        email: data?.cliente?.email || '',
        telefono: data?.cliente?.telefono || '',
        fecha_nacimiento: data?.cliente?.fecha_nacimiento || '',
        direccion_default: data?.cliente?.direccion_default || '',
        forma_pago_preferida: data?.cliente?.forma_pago_preferida || '',
        recibe_promociones: Boolean(data?.cliente?.recibe_promociones)
      });
      setCheckout((prev) => ({
        ...prev,
        metodo_pago: metodoPagoOculto(data?.cliente?.forma_pago_preferida) ? prev.metodo_pago : (data?.cliente?.forma_pago_preferida || prev.metodo_pago)
      }));
    } catch {
      localStorage.removeItem(CLAVE_TOKEN_CLIENTE);
      setClienteToken('');
      setMostrarModalPerfilCliente(false);
      setPerfilModalTab('datos');
      setVistaActiva('tienda');
    }
  }

  async function cargarDireccionesPerfil(token = clienteToken) {
    if (!token) return;
    try {
      const data = await fetchJson('/tienda/auth/direcciones', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDireccionesPerfil(Array.isArray(data?.direcciones) ? data.direcciones : []);
    } catch {
      setDireccionesPerfil([]);
    }
  }

  async function cargarNotificacionesCliente(token = clienteToken) {
    if (!token) return;
    try {
      const data = await fetchJson('/tienda/auth/notificaciones', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const lista = Array.isArray(data?.notificaciones) ? data.notificaciones : [];
      setNotificacionesClientePedidos(lista.map((item) => ({
        id: String(item?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        titulo: String(item?.titulo || 'Pedido'),
        mensaje: String(item?.mensaje || '').trim(),
        tipo: String(item?.tipo || 'pedido'),
        leida: Number(item?.leida) === 1,
        fecha: String(item?.creado_en || new Date().toISOString())
      })));
    } catch {
      // Ignorar error temporal para no romper la vista.
    }
  }

  async function guardarCarritoServidor(items, creadoEn, token = clienteToken, silencioso = true) {
    if (!token) return null;

    const itemsNormalizados = normalizarListaCarritoCliente(items);
    guardandoCarritoServidorRef.current = true;
    try {
      const data = await fetchJson('/tienda/auth/carrito', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          items: itemsNormalizados,
          creado_en: Number(creadoEn) || Date.now()
        })
      });

      snapshotCarritoServidorRef.current = serializarCarritoCliente(data?.items || itemsNormalizados);
      actualizadoCarritoServidorMsRef.current = marcaTiempoMs(data?.actualizado_en);
      return data;
    } catch (error) {
      if (!silencioso) {
        mostrarNotificacion(error?.message || 'No se pudo sincronizar el carrito', 'error');
      }
      return null;
    } finally {
      guardandoCarritoServidorRef.current = false;
    }
  }

  function guardarCarritoServidorKeepAlive(items, creadoEn, token = clienteToken) {
    if (!token) return;
    const itemsNormalizados = normalizarListaCarritoCliente(items);

    fetch(apiUrl('/tienda/auth/carrito'), {
      method: 'PUT',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        items: itemsNormalizados,
        creado_en: Number(creadoEn) || Date.now()
      })
    }).catch(() => {});

    snapshotCarritoServidorRef.current = serializarCarritoCliente(itemsNormalizados);
  }

  function sincronizarCarritoPendienteAntesDeSalir(tokenForzado = '') {
    const tokenActual = String(tokenForzado || clienteTokenActualRef.current || '').trim();
    if (!tokenActual) return;
    if (guardandoCarritoServidorRef.current) return;

    if (debounceCarritoServidorRef.current) {
      clearTimeout(debounceCarritoServidorRef.current);
      debounceCarritoServidorRef.current = null;
    }

    const itemsActuales = normalizarListaCarritoCliente(carritoActualRef.current || []);
    const snapshotLocal = serializarCarritoCliente(itemsActuales);
    if (snapshotLocal === snapshotCarritoServidorRef.current) return;

    const creadoEnActual = Number(carritoCreadoEnActualRef.current) || Date.now();
    guardarCarritoServidorKeepAlive(itemsActuales, creadoEnActual, tokenActual);
  }

  async function cargarCarritoServidor(token = clienteToken, opciones = {}) {
    if (!token) return null;

    const fusionarLocal = Boolean(opciones?.fusionarLocal);
    const aplicarEstado = opciones?.aplicarEstado !== false;
    const silencioso = opciones?.silencioso !== false;

    try {
      const data = await fetchJson('/tienda/auth/carrito', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const itemsServidor = normalizarListaCarritoCliente(data?.items || []);
      const creadoServidor = Number(data?.creado_en) || Date.now();
      const actualizadoServidorMs = marcaTiempoMs(data?.actualizado_en);

      let itemsFinales = itemsServidor;
      let creadoFinal = creadoServidor;

      if (fusionarLocal) {
        const carritoLocal = cargarCarritoGuardado(true);
        const itemsLocal = normalizarListaCarritoCliente(carritoLocal?.items || []);
        const actualizadoLocalMs = marcaTiempoMs(carritoLocal?.actualizadoEn);
        const sonIguales = serializarCarritoCliente(itemsLocal) === serializarCarritoCliente(itemsServidor);

        if (!sonIguales && itemsLocal.length && (!itemsServidor.length || actualizadoLocalMs > actualizadoServidorMs)) {
          itemsFinales = itemsLocal;
          creadoFinal = Number(carritoLocal?.creadoEn) || Date.now();
          await guardarCarritoServidor(itemsFinales, creadoFinal, token, true);
        }
      }

      if (aplicarEstado) {
        hidratandoCarritoServidorRef.current = true;
        setCarrito(itemsFinales);
        setCarritoCreadoEn(Number(creadoFinal) || Date.now());
        window.setTimeout(() => {
          hidratandoCarritoServidorRef.current = false;
        }, 0);
      }

      snapshotCarritoServidorRef.current = serializarCarritoCliente(itemsFinales);
      actualizadoCarritoServidorMsRef.current = Math.max(actualizadoServidorMs, actualizadoCarritoServidorMsRef.current);
      return {
        items: itemsFinales,
        creadoEn: creadoFinal,
        actualizadoMs: actualizadoServidorMs
      };
    } catch (error) {
      if (!silencioso) {
        mostrarNotificacion(error?.message || 'No se pudo cargar el carrito sincronizado', 'error');
      }
      return null;
    }
  }

  async function agregarDireccionPerfil() {
    if (!clienteToken || guardandoDireccionPerfil) return;
    const direccion = String(direccionPerfilNueva?.direccion || '').trim();
    if (!direccion) {
      mostrarNotificacion('Captura la dirección', 'error');
      return;
    }

    setGuardandoDireccionPerfil(true);
    try {
      const esEdicion = Number(direccionPerfilEditandoId) > 0;
      const endpoint = esEdicion
        ? `/tienda/auth/direcciones/${direccionPerfilEditandoId}`
        : '/tienda/auth/direcciones';
      const method = esEdicion ? 'PATCH' : 'POST';

      await fetchJson(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clienteToken}`
        },
        body: JSON.stringify({
          alias: direccionPerfilNueva.alias,
          direccion,
          referencias: direccionPerfilNueva.referencias,
          es_preferida: Boolean(direccionPerfilNueva.es_preferida)
        })
      });
      setDireccionPerfilNueva(DIRECCION_CLIENTE_DEFAULT);
      setDireccionPerfilEditandoId(null);
      setMostrarModalNuevaDireccion(false);
      await cargarDireccionesPerfil();
      await cargarPerfil(clienteToken);
      mostrarNotificacion(esEdicion ? 'Dirección actualizada' : 'Dirección guardada', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo guardar la dirección', 'error');
    } finally {
      setGuardandoDireccionPerfil(false);
    }
  }

  async function marcarDireccionPreferidaPerfil(idDireccion) {
    if (!clienteToken) return;
    try {
      await fetchJson(`/tienda/auth/direcciones/${idDireccion}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clienteToken}`
        },
        body: JSON.stringify({ es_preferida: true })
      });
      await cargarDireccionesPerfil();
      await cargarPerfil(clienteToken);
      mostrarNotificacion('Dirección preferida actualizada', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo actualizar la dirección preferida', 'error');
    }
  }

  async function eliminarDireccionPerfil(idDireccion) {
    if (!clienteToken) return;
    const ok = await confirmarAccionCriticaCliente({
      titulo: 'Eliminar dirección',
      mensaje: 'Vas a eliminar una dirección guardada de tu cuenta.',
      frase: 'ELIMINAR DIRECCION'
    });
    if (!ok) return;

    try {
      await fetchJson(`/tienda/auth/direcciones/${idDireccion}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${clienteToken}` }
      });
      await cargarDireccionesPerfil();
      await cargarPerfil(clienteToken);
      mostrarNotificacion('Dirección eliminada', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo eliminar la dirección', 'error');
    }
  }

  async function enviarAtencionPerfil() {
    if (!clienteToken || enviandoAtencionPerfil) return;
    const asunto = String(atencionForm?.asunto || '').trim();
    const mensaje = String(atencionForm?.mensaje || '').trim();
    if (!asunto || !mensaje) {
      mostrarNotificacion('Selecciona asunto y escribe tu mensaje', 'error');
      return;
    }

    setEnviandoAtencionPerfil(true);
    try {
      await fetchJson('/tienda/auth/atencion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clienteToken}`
        },
        body: JSON.stringify({
          asunto,
          mensaje,
          nombre: nombreClienteCompleto || perfil.nombre,
          email: perfil.email,
          telefono: perfil.telefono
        })
      });
      setAtencionForm({ asunto: '', mensaje: '' });
      mostrarNotificacion('Mensaje enviado a atención al cliente', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo enviar el mensaje', 'error');
    } finally {
      setEnviandoAtencionPerfil(false);
    }
  }

  useEffect(() => {
    if (!sesionInternaActiva) return;
    cargarAdminPuntos();
    cargarAdminClientes();
    cargarAdminOrdenes();
    cargarConfigTiendaAdmin();
    cargarDescuentosAdmin();
    cargarCuponesAdmin();
    cargarHistorialCuponesAdmin();
  }, [
    sesionInternaActiva,
    clienteToken,
    cliente?.id,
    permisoNotificacionesPedidos,
    sonidoNotificacionesPedidos
  ]);

  useEffect(() => {
    if (carrito.length) return;
    if (!cuponesAplicados.length && !codigoCuponInput) return;
    setCuponesAplicados([]);
    setCodigoCuponInput('');
    setEstadoInputCupon('neutral');
  }, [carrito.length, cuponesAplicados, codigoCuponInput]);

  async function revalidarCuponPersistidoEnCarrito(opciones = {}) {
    const silencioso = opciones?.silencioso !== false;
    const cuponesActuales = Array.isArray(cuponesAplicadosRef.current) ? cuponesAplicadosRef.current : [];
    if (!cuponesActuales.length) return;
    if (!Array.isArray(carrito) || !carrito.length) return;

    try {
      const ruta = clienteToken ? '/tienda/cupones/validar' : '/tienda/cupones/validar-publico';
      const headers = { 'Content-Type': 'application/json' };
      if (clienteToken) headers.Authorization = `Bearer ${clienteToken}`;

      let subtotalTemporal = Math.max(0, Number(subtotalCarrito) || 0);
      const cuponesValidados = [];
      let removidos = 0;

      for (const cuponActual of cuponesActuales) {
        const codigoActual = String(cuponActual?.codigo || '').trim();
        if (!codigoActual) continue;

        try {
          const data = await fetchJson(ruta, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              codigo_cupon: codigoActual,
              subtotal: subtotalTemporal,
              items: carrito.map((item) => ({
                nombre_receta: String(item?.nombre_receta || '').trim(),
                categoria_nombre: String(item?.categoria_nombre || '').trim(),
                cantidad: Number(item?.cantidad) || 1,
                precio_unitario: Number(item?.precio_unitario) || 0,
                subtotal: Number(item?.subtotal) || 0
              }))
            })
          });

          if (!data?.ok || !data?.cupon) {
            removidos += 1;
            continue;
          }

          cuponesValidados.push(data.cupon);
          subtotalTemporal = Math.max(0, Number(data?.total) || subtotalTemporal);
        } catch {
          removidos += 1;
        }
      }

      const codigosEstadoActual = (Array.isArray(cuponesAplicadosRef.current) ? cuponesAplicadosRef.current : [])
        .map((cup) => String(cup?.codigo || '').trim().toUpperCase())
        .filter(Boolean)
        .join('|');
      const codigosIniciales = cuponesActuales
        .map((cup) => String(cup?.codigo || '').trim().toUpperCase())
        .filter(Boolean)
        .join('|');
      if (codigosEstadoActual !== codigosIniciales) return;

      setCuponesAplicados(cuponesValidados);
      if (removidos > 0) {
        setEstadoInputCupon('invalido');
        if (!silencioso) {
          mostrarNotificacion('Uno o más cupones dejaron de ser válidos y se removieron del carrito', 'advertencia');
        }
      }
    } catch {
      if (!silencioso) {
        mostrarNotificacion('No se pudo revalidar los cupones del carrito', 'advertencia');
      }
    }
  }

  useEffect(() => {
    if (!cuponesAplicados.length || !carrito.length) return undefined;
    revalidarCuponPersistidoEnCarrito({ silencioso: true });
    const timer = window.setInterval(() => {
      revalidarCuponPersistidoEnCarrito({ silencioso: true });
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [clienteToken, carrito, cuponesAplicados]);

  useEffect(() => {
    const contenedor = contenedorScrollRef.current;
    if (!contenedor) return undefined;

    const onScroll = () => {
      const top = Number(contenedor.scrollTop) || 0;
      setMostrarBotonArribaTienda(top > 220);
    };

    onScroll();
    contenedor.addEventListener('scroll', onScroll, { passive: true });
    return () => contenedor.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const contenedor = contenedorScrollRef.current;
    if (!contenedor) return undefined;

    const tieneScrollPropio = (objetivo) => {
      let nodo = objetivo instanceof Element ? objetivo : null;
      while (nodo && nodo !== contenedor) {
        const estilo = window.getComputedStyle(nodo);
        const overflowY = String(estilo?.overflowY || '').toLowerCase();
        const desplazable = (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')
          && nodo.scrollHeight > nodo.clientHeight;
        if (desplazable) return true;
        nodo = nodo.parentElement;
      }
      return false;
    };

    const onWheel = (event) => {
      const deltaY = Number(event?.deltaY) || 0;
      if (!deltaY) return;
      if (tieneScrollPropio(event.target)) return;

      const maxScroll = Math.max(0, contenedor.scrollHeight - contenedor.clientHeight);
      if (maxScroll <= 0) return;

      const siguiente = Math.min(maxScroll, Math.max(0, contenedor.scrollTop + deltaY));
      if (siguiente === contenedor.scrollTop) return;

      contenedor.scrollTop = siguiente;
      event.preventDefault();
    };

    contenedor.addEventListener('wheel', onWheel, { passive: false });
    return () => contenedor.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    if (!(esVistaTrastienda || vistaActiva === 'trastienda')) return undefined;
    if (typeof window === 'undefined' || window.innerWidth > 980) return undefined;

    const contenedor = contenedorScrollRef.current;
    if (!contenedor) return undefined;

    let ultimoX = 0;
    let ultimoY = 0;
    let gestoActivo = false;
    let bloquearScrollVertical = false;

    const perteneceAZonaHorizontal = (objetivo) => {
      return objetivo instanceof Element
        ? Boolean(objetivo.closest('.tiendaAdminTabs, .tiendaMetricasSubTabs, .tiendaCuponWizardPasos'))
        : false;
    };

    const dentroDeTrastienda = (objetivo) => (
      contenedor && objetivo instanceof Node ? contenedor.contains(objetivo) : false
    );

    const onTouchStart = (event) => {
      if (!dentroDeTrastienda(event.target)) return;
      const touch = event.touches?.[0];
      if (!touch) return;
      ultimoX = Number(touch.clientX) || 0;
      ultimoY = Number(touch.clientY) || 0;
      gestoActivo = true;
      bloquearScrollVertical = perteneceAZonaHorizontal(event.target);
    };

    const onTouchMove = (event) => {
      if (!gestoActivo) return;
      if (!dentroDeTrastienda(event.target)) return;

      const touch = event.touches?.[0];
      if (!touch) return;

      const xActual = Number(touch.clientX) || 0;
      const yActual = Number(touch.clientY) || 0;
      const deltaX = xActual - ultimoX;
      const deltaY = yActual - ultimoY;

      if (bloquearScrollVertical && Math.abs(deltaX) > Math.abs(deltaY)) {
        ultimoX = xActual;
        ultimoY = yActual;
        return;
      }

      if (Math.abs(deltaY) <= Math.abs(deltaX) || Math.abs(deltaY) < 2) {
        ultimoX = xActual;
        ultimoY = yActual;
        return;
      }

      const maxScroll = Math.max(0, contenedor.scrollHeight - contenedor.clientHeight);
      if (maxScroll <= 0) return;

      const siguiente = Math.min(maxScroll, Math.max(0, contenedor.scrollTop - deltaY));
      if (siguiente !== contenedor.scrollTop) {
        contenedor.scrollTop = siguiente;
        event.preventDefault();
      }

      ultimoX = xActual;
      ultimoY = yActual;
    };

    const onTouchEnd = () => {
      gestoActivo = false;
      bloquearScrollVertical = false;
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true, capture: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart, true);
      document.removeEventListener('touchmove', onTouchMove, true);
      document.removeEventListener('touchend', onTouchEnd, true);
      document.removeEventListener('touchcancel', onTouchEnd, true);
    };
  }, [esVistaTrastienda, vistaActiva]);

  useEffect(() => {
    const contenedor = contenedorScrollRef.current;
    if (!contenedor) return undefined;

    const esMovil = window.matchMedia('(max-width: 980px)').matches;
    if (esMovil) {
      contenedor.style.height = '';
      contenedor.style.maxHeight = '';
      return undefined;
    }

    const ajustarAlto = () => {
      const top = Number(contenedor.getBoundingClientRect()?.top) || 0;
      const viewport = window.innerHeight || document.documentElement?.clientHeight || 0;
      const alto = Math.max(320, viewport - Math.max(0, top));
      contenedor.style.height = `${alto}px`;
      contenedor.style.maxHeight = `${alto}px`;
    };

    ajustarAlto();
    window.addEventListener('resize', ajustarAlto);
    window.addEventListener('orientationchange', ajustarAlto);
    return () => {
      window.removeEventListener('resize', ajustarAlto);
      window.removeEventListener('orientationchange', ajustarAlto);
    };
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const esMovil = window.matchMedia('(max-width: 980px)').matches;
    if (esMovil) return undefined;

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  useEffect(() => {
    let timerRefresco = null;
    const idClienteActual = Number(cliente?.id) || extraerIdClienteToken(clienteToken) || 0;

    const onRealtime = (event) => {
      const tipo = String(event?.detail?.tipo || '').trim();
      if (!tipo) return;

      const requiereRefrescoProductos = (
        tipo === 'tienda_catalogo_actualizado'
        || tipo === 'tienda_descuentos_actualizados'
        || tipo === 'categorias_actualizado'
        || tipo === 'recetas_actualizado'
        || tipo === 'produccion_actualizado'
        || tipo === 'inventario_actualizado'
        || tipo === 'ventas_actualizado'
      );

      if (requiereRefrescoProductos) {
        if (timerRefresco) clearTimeout(timerRefresco);
        timerRefresco = setTimeout(() => {
          cargarProductos({ silencioso: true });
          cargarCategoriasAdmin({ silencioso: true });
        }, 100);
      }

      if (tokenInterno && (tipo === 'tienda_orden_nueva' || tipo === 'tienda_orden_actualizada')) {
        cargarAdminOrdenes();
      }
      if (tokenInterno && tipo === 'tienda_descuentos_actualizados') {
        cargarDescuentosAdmin();
      }
      if (tokenInterno && tipo === 'tienda_cupones_actualizados') {
        cargarCuponesAdmin();
        cargarHistorialCuponesAdmin();
      }

      if (tokenInterno && tipo === 'tienda_servicio_domicilio_habilitado') {
        cargarConfigTiendaAdmin();
      }

      if (clienteToken && tipo === 'tienda_servicio_domicilio_habilitado') {
        cargarConfigTienda();
        const mensajeDomicilio = String(event?.detail?.mensaje || '').trim()
          || 'Ya contamos con servicio a domicilio.';
        agregarNotificacionClientePedido({
          titulo: 'Servicio a domicilio activo',
          mensaje: mensajeDomicilio,
          tipo: 'servicio_domicilio'
        });
        mostrarNotificacion(mensajeDomicilio, 'exito');
        if (permisoNotificacionesPedidos === 'granted') {
          mostrarNotificacionNativa({
            titulo: 'Servicio a domicilio activo',
            mensaje: mensajeDomicilio,
            tag: `tienda:domicilio:${Date.now()}`,
            sonido: sonidoNotificacionesPedidos
          });
        }
      }

      if (clienteToken && tipo === 'tienda_carrito_actualizado') {
        const idClienteEvento = Number(event?.detail?.id_cliente) || 0;
        if (!idClienteActual || !idClienteEvento || idClienteEvento === idClienteActual) {
          cargarCarritoServidor(clienteToken, {
            fusionarLocal: false,
            aplicarEstado: true,
            silencioso: true
          });
        }
      }

      const esEventoPedidoCliente = (tipo === 'tienda_orden_nueva' || tipo === 'tienda_orden_actualizada');
      if (!clienteToken || !esEventoPedidoCliente) return;

      const idClienteEvento = Number(event?.detail?.id_cliente) || 0;
      if (idClienteActual && idClienteEvento && idClienteEvento !== idClienteActual) return;

      cargarMisOrdenes(clienteToken);
      cargarNotificacionesCliente(clienteToken);

      const idOrden = Number(event?.detail?.id_orden) || 0;
      const estado = String(event?.detail?.estado || '').trim().toLowerCase();
      const claveEvento = `${tipo}:${idOrden}:${estado || 'nueva'}`;
      if (eventosPedidoNotificadosRef.current.has(claveEvento)) return;
      eventosPedidoNotificadosRef.current.add(claveEvento);
      if (eventosPedidoNotificadosRef.current.size > 240) {
        eventosPedidoNotificadosRef.current.clear();
      }

      if (tipo === 'tienda_orden_nueva') {
        const folioNuevo = String(event?.detail?.folio || '').trim();
        const mensajeNuevo = folioNuevo
          ? `Tu pedido ${folioNuevo} fue realizado correctamente.`
          : 'Tu pedido fue realizado correctamente.';
        agregarNotificacionClientePedido({
          titulo: 'Pedido realizado',
          mensaje: mensajeNuevo,
          tipo: 'pedido_nuevo'
        });
        mostrarNotificacion(mensajeNuevo, 'exito');
        if (permisoNotificacionesPedidos === 'granted') {
          mostrarNotificacionNativa({
            titulo: 'Pedido recibido',
            mensaje: mensajeNuevo,
            tag: `pedido:nuevo:${idOrden || Date.now()}`,
            sonido: sonidoNotificacionesPedidos
          });
        }
        return;
      }

      const folio = String(event?.detail?.folio || '').trim();
      const mensajeEstado = mensajeEstadoPedidoCliente(estado);
      const mensajeFinal = folio
        ? `${mensajeEstado} (${folio})`
        : mensajeEstado;
      agregarNotificacionClientePedido({
        titulo: tituloEstadoPedidoCliente(estado),
        mensaje: mensajeFinal,
        tipo: 'pedido_estado'
      });

      mostrarNotificacion(mensajeFinal, 'exito');
      if (permisoNotificacionesPedidos === 'granted') {
        mostrarNotificacionNativa({
          titulo: tituloEstadoPedidoCliente(estado),
          mensaje: mensajeFinal,
          tag: `pedido:estado:${idOrden || Date.now()}:${estado || 'actualizado'}`,
          sonido: sonidoNotificacionesPedidos
        });
      }
    };

    window.addEventListener('chipactli:realtime', onRealtime);
    return () => {
      window.removeEventListener('chipactli:realtime', onRealtime);
      if (timerRefresco) clearTimeout(timerRefresco);
    };
  }, [tokenInterno, clienteToken, cliente?.id, permisoNotificacionesPedidos, sonidoNotificacionesPedidos]);

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
      sincronizarTabsNavegacionAdminDesdeConfig(normalizada);
    } catch {
      setConfigTiendaAdmin(CONFIG_DEFAULT);
      sincronizarTabsNavegacionAdminDesdeConfig(CONFIG_DEFAULT);
    }
  }

  async function confirmarAccionCriticaTrastienda({ titulo = 'Confirmar acción crítica', mensaje = '', frase = '' } = {}) {
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

  async function confirmarAccionCriticaCliente({ titulo = 'Confirmar acción', mensaje = '', frase = '' } = {}) {
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

  async function eliminarPestanaPersonalizadaAdmin(index, label = '') {
    const confirmado = await confirmarAccionCriticaTrastienda({
      titulo: 'Eliminar pestaña personalizada',
      mensaje: `Vas a eliminar la pestaña personalizada ${String(label || 'de navegación').trim() || 'de navegación'} de la vitrina. Guarda configuración después para aplicar el cambio.`,
      frase: 'ELIMINAR PESTANA'
    });
    if (!confirmado) return;

    actualizarTabsNavegacionAdmin((prev) => prev.filter((_, i) => i !== index));
  }

  async function cancelarOrdenPerfil(idOrden) {
    const id = Number(idOrden || 0);
    if (!clienteToken || !Number.isFinite(id) || id <= 0) return;

    const confirmado = await confirmarAccionCriticaCliente({
      titulo: 'Cancelar orden',
      mensaje: 'Vas a cancelar esta orden pendiente. La acción puede afectar seguimiento y pago asociado.',
      frase: 'CANCELAR ORDEN'
    });
    if (!confirmado) return;

    try {
      await fetchJson(`/tienda/ordenes/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${clienteToken}` } });
      await cargarMisOrdenes();
      mostrarNotificacion('Orden cancelada', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo cancelar la orden', 'error');
    }
  }

  async function guardarConfigTiendaAdmin() {
    const confirmado = await confirmarAccionCriticaTrastienda({
      titulo: 'Guardar configuración de Trastienda',
      mensaje: 'Vas a modificar la configuración pública de la vitrina y navegación de la tienda. Este cambio impacta a clientes y operación.',
      frase: 'GUARDAR CONFIG'
    });
    if (!confirmado) return;

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
      sincronizarTabsNavegacionAdminDesdeConfig(conf);
      mostrarNotificacion('Configuración de vitrina guardada', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo guardar configuración', 'error');
    }
  }

  async function enviarDiagnosticoCorreoAdmin() {
    const destino = String(correoDiagnosticoDestino || '').trim();
    if (!destino || !destino.includes('@')) {
      mostrarNotificacion('Ingresa un correo válido para diagnóstico', 'error');
      return;
    }

    setEnviandoCorreoDiagnostico(true);
    try {
      const data = await fetchAdmin('/tienda/admin/mail/diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: destino,
          nombre: 'Administracion CHIPACTLI',
          etiqueta: 'Prueba desde Trastienda'
        })
      });
      mostrarNotificacion(`Correo de diagnóstico enviado a ${String(data?.to || destino)}`, 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo enviar el correo de diagnóstico', 'error');
    } finally {
      setEnviandoCorreoDiagnostico(false);
    }
  }

  async function enviarCorreoMasivoAdmin() {
    const titulo = String(configTiendaAdmin?.correo_campana_titulo || '').trim() || 'Novedades CHIPACTLI';
    const contenido = String(configTiendaAdmin?.correo_campana_contenido || '').trim();
    const imagenUrl = String(configTiendaAdmin?.correo_campana_imagen_url || '').trim();

    if (!contenido) {
      mostrarNotificacion('Debes escribir el contenido de la campaña', 'error');
      return;
    }

    const confirmar = await confirmarAccionCriticaTrastienda({
      titulo: 'Enviar campaña masiva',
      mensaje: 'Vas a enviar correo masivo a clientes suscritos. Esta acción es de alto impacto comercial y reputacional.',
      frase: 'ENVIAR CAMPANA'
    });
    if (!confirmar) return;

    setEnviandoCorreoMasivo(true);
    try {
      const data = await fetchAdmin('/tienda/admin/mail/masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          contenido,
          imagen_url: imagenUrl,
          asunto: String(configTiendaAdmin?.correo_campana_asunto || '').trim(),
          cuerpo: String(configTiendaAdmin?.correo_campana_cuerpo || '').trim(),
          max_destinatarios: 1000
        })
      });
      const enviados = Number(data?.enviados || 0);
      const fallidos = Number(data?.fallidos || 0);
      mostrarNotificacion(`Campana enviada. Exito: ${enviados} · Fallidos: ${fallidos}`, fallidos > 0 ? 'advertencia' : 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo enviar correo masivo', 'error');
    } finally {
      setEnviandoCorreoMasivo(false);
    }
  }

  async function abrirVistaPreviaCorreoAdmin(tipoForzado = '') {
    const tipo = String(tipoForzado || previewTipoCorreo || 'campana').trim().toLowerCase();
    if (tipo !== previewTipoCorreo) setPreviewTipoCorreo(tipo);
    setMostrandoPreviewCorreo(true);
    setCargandoPreviewCorreo(true);
    setPreviewCorreoHtml('');
    setPreviewCorreoAsunto('');

    try {
      const asuntoPreview = tipo === 'bienvenida'
        ? String(configTiendaAdmin?.correo_bienvenida_asunto || '').trim()
        : String(configTiendaAdmin?.correo_campana_asunto || '').trim();
      const cuerpoPreview = tipo === 'bienvenida'
        ? String(configTiendaAdmin?.correo_bienvenida_cuerpo || '').trim()
        : String(configTiendaAdmin?.correo_campana_cuerpo || '').trim();

      const data = await fetchAdmin('/tienda/admin/mail/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          titulo: String(configTiendaAdmin?.correo_campana_titulo || '').trim(),
          contenido: String(configTiendaAdmin?.correo_campana_contenido || '').trim(),
          imagen_url: String(configTiendaAdmin?.correo_campana_imagen_url || '').trim(),
          asunto: asuntoPreview,
          cuerpo: cuerpoPreview
        })
      });

      setPreviewCorreoAsunto(String(data?.subject || '').trim());
      setPreviewCorreoHtml(String(data?.html || '').trim());
    } catch (error) {
      setPreviewCorreoAsunto('');
      setPreviewCorreoHtml('');
      mostrarNotificacion(error?.message || 'No se pudo generar la vista previa del correo', 'error');
    } finally {
      setCargandoPreviewCorreo(false);
    }
  }

  async function cargarDescuentosAdmin() {
    if (!tokenInterno) return;
    try {
      const data = await fetchAdmin('/tienda/admin/descuentos');
      setDescuentosAdmin(Array.isArray(data) ? data : []);
    } catch {
      setDescuentosAdmin([]);
    }
  }

  function obtenerDescuento(scope, clave) {
    const s = String(scope || '').trim().toLowerCase();
    const c = String(clave || '').trim().toLowerCase();
    return descuentosAdmin.find((d) => String(d?.scope || '').trim().toLowerCase() === s && String(d?.clave || '').trim().toLowerCase() === c) || null;
  }

  function claveDraftDescuento(scope, clave) {
    return `${String(scope || '').trim().toLowerCase()}:${String(clave || '').trim().toLowerCase()}`;
  }

  function obtenerControlDescuento(scope, clave) {
    const key = claveDraftDescuento(scope, clave);
    const draft = descuentoDrafts[key];
    if (draft) {
      return {
        activo: Boolean(draft.activo),
        porcentaje: Number(draft.porcentaje) || 0
      };
    }

    const existente = obtenerDescuento(scope, clave);
    return {
      activo: Number(existente?.activo) === 1,
      porcentaje: Number(existente?.porcentaje) || 0
    };
  }

  function actualizarControlDescuento(scope, clave, cambios = {}) {
    const key = claveDraftDescuento(scope, clave);
    const actual = obtenerControlDescuento(scope, clave);
    const siguiente = {
      activo: typeof cambios.activo === 'boolean' ? cambios.activo : actual.activo,
      porcentaje: typeof cambios.porcentaje === 'number' ? cambios.porcentaje : actual.porcentaje
    };
    setDescuentoDrafts((prev) => ({ ...prev, [key]: siguiente }));
  }

  function cambiarDescuentoTab(valor) {
    setDescuentoTabInterna(valor);
  }

  function cambiarDescuentoCategoria(valor) {
    setDescuentoCategoriaActiva(String(valor || '').trim().toLowerCase());
  }

  async function guardarDescuento(scope, clave, activo, porcentaje) {
    const key = claveDraftDescuento(scope, scope === 'global' ? '__all__' : clave);

    const confirmado = await confirmarAccionCriticaTrastienda({
      titulo: 'Guardar descuento de Trastienda',
      mensaje: 'Este cambio modifica precios promocionales visibles para clientes y puede afectar pedidos nuevos inmediatamente.',
      frase: 'GUARDAR DESCUENTO'
    });
    if (!confirmado) return;

    setGuardandoDescuentoClave(key);
    try {
      await fetchAdmin('/tienda/admin/descuentos/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, clave, activo, porcentaje })
      });
      await cargarDescuentosAdmin();
      await cargarProductos({ silencioso: true });
      mostrarNotificacion('Descuento guardado', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo guardar descuento', 'error');
    } finally {
      setGuardandoDescuentoClave('');
    }
  }

  async function aplicarCuponCarrito() {
    const codigo = String(codigoCuponInput || '').trim().toUpperCase();
    if (!codigo) {
      setEstadoInputCupon('invalido');
      mostrarNotificacion('Ingresa un codigo de cupon', 'error');
      return;
    }
    if (!carrito.length) {
      setEstadoInputCupon('invalido');
      mostrarNotificacion('Agrega productos al carrito para aplicar cupon', 'error');
      return;
    }

    setValidandoCupon(true);
    try {
      const ruta = clienteToken ? '/tienda/cupones/validar' : '/tienda/cupones/validar-publico';
      const headers = {
        'Content-Type': 'application/json'
      };
      if (clienteToken) {
        headers.Authorization = `Bearer ${clienteToken}`;
      }

      const data = await fetchJson(ruta, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          codigo_cupon: codigo,
          subtotal: Math.max(0, Number((subtotalCarrito - descuentoCuponCarrito).toFixed(2))),
          items: carrito.map((item) => ({
            nombre_receta: String(item?.nombre_receta || '').trim(),
            categoria_nombre: String(item?.categoria_nombre || '').trim(),
            cantidad: Number(item?.cantidad) || 1,
            precio_unitario: Number(item?.precio_unitario) || 0,
            subtotal: Number(item?.subtotal) || 0
          }))
        })
      });

      if (!data?.ok || !data?.cupon) {
        throw new Error(data?.error || 'No se pudo aplicar el cupon');
      }

      const codigoNuevo = String(data?.cupon?.codigo || codigo).trim().toUpperCase();
      const yaExiste = (Array.isArray(cuponesAplicadosRef.current) ? cuponesAplicadosRef.current : [])
        .some((cup) => String(cup?.codigo || '').trim().toUpperCase() === codigoNuevo);
      if (yaExiste) {
        setEstadoInputCupon('invalido');
        mostrarNotificacion('Ese cupón ya está aplicado', 'advertencia');
        return;
      }

      setCuponesAplicados((prev) => ([...(Array.isArray(prev) ? prev : []), data.cupon]));
      setCodigoCuponInput('');
      setEstadoInputCupon('valido');
      mostrarNotificacion(`Cupon ${String(data?.cupon?.codigo || codigo)} aplicado`, 'exito');
    } catch (error) {
      setEstadoInputCupon('invalido');
      mostrarNotificacion('Cupón no válido', 'error');
    } finally {
      setValidandoCupon(false);
    }
  }

  function quitarCuponCarrito(codigo = '') {
    const codigoObjetivo = String(codigo || '').trim().toUpperCase();
    if (!codigoObjetivo) {
      setCuponesAplicados([]);
    } else {
      setCuponesAplicados((prev) => (Array.isArray(prev)
        ? prev.filter((cup) => String(cup?.codigo || '').trim().toUpperCase() !== codigoObjetivo)
        : []));
    }
    setEstadoInputCupon('neutral');
    try {
      const actuales = Array.isArray(cuponesAplicadosRef.current) ? cuponesAplicadosRef.current : [];
      const restantes = !codigoObjetivo
        ? []
        : actuales.filter((cup) => String(cup?.codigo || '').trim().toUpperCase() !== codigoObjetivo);
      if (restantes.length) {
        localStorage.setItem(CLAVE_CUPONES_CARRITO_TIENDA, JSON.stringify(restantes));
      } else {
        localStorage.removeItem(CLAVE_CUPONES_CARRITO_TIENDA);
      }
    } catch {
      // Ignorar errores de almacenamiento local.
    }
  }

  async function cargarCuponesAdmin() {
    if (!tokenInterno) return;
    try {
      const data = await fetchAdmin('/tienda/admin/cupones');
      setCuponesAdmin(Array.isArray(data?.cupones) ? data.cupones : []);
      setResumenCuponesAdmin({
        cupones_totales: Number(data?.resumen_general?.cupones_totales) || 0,
        cupones_activos: Number(data?.resumen_general?.cupones_activos) || 0,
        usos_totales: Number(data?.resumen_general?.usos_totales) || 0,
        ventas_totales: Number(data?.resumen_general?.ventas_totales) || 0,
        descuentos_totales: Number(data?.resumen_general?.descuentos_totales) || 0,
        productos_vendidos_totales: Number(data?.resumen_general?.productos_vendidos_totales) || 0
      });
    } catch {
      setCuponesAdmin([]);
      setResumenCuponesAdmin({
        cupones_totales: 0,
        cupones_activos: 0,
        usos_totales: 0,
        ventas_totales: 0,
        descuentos_totales: 0,
        productos_vendidos_totales: 0
      });
    }
  }

  async function cargarHistorialCuponesAdmin() {
    if (!tokenInterno) return;
    setCargandoHistorialCuponesAdmin(true);
    try {
      const data = await fetchAdmin('/tienda/admin/cupones/historial');
      setHistorialCuponesAdmin({
        historial: Array.isArray(data?.historial) ? data.historial : [],
        influencers: Array.isArray(data?.influencers) ? data.influencers : []
      });
    } catch {
      setHistorialCuponesAdmin({ historial: [], influencers: [] });
    } finally {
      setCargandoHistorialCuponesAdmin(false);
    }
  }

  async function enviarCampanaCuponSuscriptores(cupon) {
    const codigo = String(cupon?.codigo || '').trim().toUpperCase();
    if (!codigo) return;

    const tipoDescuento = String(cupon?.tipo_descuento || 'porcentaje').trim().toLowerCase();
    const valorDescuento = Math.max(0, Number(cupon?.valor_descuento) || 0);
    const descuentoTxt = tipoDescuento === 'porcentaje'
      ? `${valorDescuento}% de descuento`
      : `$${valorDescuento} MXN de descuento`;

    const minimoTxt = Math.max(0, Number(cupon?.monto_minimo) || 0) > 0
      ? `\n- Compra mínima: $${Math.max(0, Number(cupon?.monto_minimo) || 0)} MXN`
      : '';
    const topeTxt = Math.max(0, Number(cupon?.max_descuento) || 0) > 0
      ? `\n- Tope de descuento: $${Math.max(0, Number(cupon?.max_descuento) || 0)} MXN`
      : '';

    const titulo = `Nuevo cupón disponible: ${codigo}`;
    const contenido = [
      `¡Tenemos un cupón nuevo para ti!`,
      '',
      `Código: ${codigo}`,
      `Beneficio: ${descuentoTxt}`,
      minimoTxt ? minimoTxt.replace(/^\n/, '') : '',
      topeTxt ? topeTxt.replace(/^\n/, '') : '',
      '',
      `Úsalo en tu próxima compra antes de que termine su vigencia.`
    ].filter(Boolean).join('\n');

    return fetchAdmin('/tienda/admin/mail/masivo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo,
        contenido,
        imagen_url: String(configTiendaAdmin?.correo_campana_imagen_url || '').trim(),
        asunto: `Cupón activo en CHIPACTLI: ${codigo}`,
        cuerpo: [
          'Hola {{nombre_cliente}},',
          '',
          'Tenemos una promoción especial para ti.',
          '',
          `Código de cupón: ${codigo}`,
          `Beneficio: ${descuentoTxt}`,
          minimoTxt,
          topeTxt,
          '',
          'Canjéalo desde la vitrina en línea.',
          'Visita nuestra vitrina: {{url_tienda}}'
        ].join('\n').replace(/\n{3,}/g, '\n\n'),
        max_destinatarios: 1000
      })
    });
  }

  async function guardarCuponAdmin() {
    if (!tokenInterno || guardandoCuponAdmin) return;
    const esNuevoCupon = (Number(editandoCuponAdminId) || 0) <= 0;

    const payload = {
      ...cuponAdminDraft,
      codigo: String(cuponAdminDraft?.codigo || '').trim().toUpperCase().replace(/\s+/g, ''),
      nombre: String(cuponAdminDraft?.nombre || '').trim(),
      alcance_tipo: String(cuponAdminDraft?.alcance_tipo || 'todos').trim().toLowerCase(),
      alcance_clave: String(cuponAdminDraft?.alcance_clave || '').trim().toLowerCase(),
      influencer_nombre: String(cuponAdminDraft?.influencer_nombre || '').trim(),
      influencer_handle: String(cuponAdminDraft?.influencer_handle || '').trim(),
      valor_descuento: Math.max(0, Number(cuponAdminDraft?.valor_descuento) || 0),
      monto_minimo: Math.max(0, Number(cuponAdminDraft?.monto_minimo) || 0),
      max_descuento: Math.max(0, Number(cuponAdminDraft?.max_descuento) || 0),
      usos_maximos_total: Math.max(0, Number(cuponAdminDraft?.usos_maximos_total) || 0),
      usos_maximos_por_cliente: Math.max(0, Number(cuponAdminDraft?.usos_maximos_por_cliente) || 0)
    };

    if (!payload.codigo) {
      mostrarNotificacion('Codigo de cupon obligatorio', 'error');
      return;
    }
    if (!payload.nombre) {
      mostrarNotificacion('El nombre de la promocion es obligatorio', 'error');
      return;
    }
    if ((payload.alcance_tipo === 'categoria' || payload.alcance_tipo === 'producto') && !payload.alcance_clave) {
      mostrarNotificacion('Selecciona la categoría o producto para el alcance del cupón', 'error');
      return;
    }
    if (payload.tipo === 'influencer' && !payload.influencer_nombre) {
      mostrarNotificacion('El nombre del influencer es obligatorio', 'error');
      return;
    }
    if (!payload.vigente_indefinido && (!payload.valido_desde || !payload.valido_hasta)) {
      mostrarNotificacion('Define fecha de inicio y fin para la vigencia', 'error');
      return;
    }

    const confirmado = await confirmarAccionCriticaTrastienda({
      titulo: esNuevoCupon ? 'Crear cupón en Trastienda' : 'Actualizar cupón en Trastienda',
      mensaje: esNuevoCupon
        ? 'Vas a crear un cupón nuevo que puede afectar descuentos y campañas activas.'
        : 'Vas a modificar un cupón existente. Esto puede cambiar reglas de descuento y redención para clientes.',
      frase: esNuevoCupon ? 'CREAR CUPON' : 'ACTUALIZAR CUPON'
    });
    if (!confirmado) return;

    setGuardandoCuponAdmin(true);
    try {
      await fetchAdmin('/tienda/admin/cupones/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (esNuevoCupon) {
        const confirmarEnvio = await confirmarAccionCriticaTrastienda({
          titulo: 'Enviar cupón a suscriptores',
          mensaje: 'Vas a enviar este cupón por correo a todos los suscriptores de la página. Esta acción impacta comunicación masiva y reputación comercial.',
          frase: 'ENVIAR CUPON'
        });
        if (confirmarEnvio) {
          try {
            const dataEnvio = await enviarCampanaCuponSuscriptores(payload);
            const enviados = Number(dataEnvio?.enviados || 0);
            const fallidos = Number(dataEnvio?.fallidos || 0);
            mostrarNotificacion(`Cupón enviado por correo. Éxito: ${enviados} · Fallidos: ${fallidos}`, fallidos > 0 ? 'advertencia' : 'exito');
          } catch (errorMail) {
            mostrarNotificacion(errorMail?.message || 'Cupón guardado, pero falló el envío a suscriptores', 'advertencia');
          }
        }
      }

      mostrarNotificacion('Cupon guardado', 'exito');
      setCuponAdminDraft(CUPON_ADMIN_DEFAULT);
      setMostrandoModalCuponAdmin(false);
      setEditandoCuponAdminId(0);
      await cargarCuponesAdmin();
      await cargarHistorialCuponesAdmin();
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo guardar cupon', 'error');
    } finally {
      setGuardandoCuponAdmin(false);
    }
  }

  async function cambiarActivoCuponAdmin(cupon, activo) {
    const idCupon = Number(cupon?.id) || 0;
    if (!idCupon || !tokenInterno) return;

    const confirmado = await confirmarAccionCriticaTrastienda({
      titulo: activo ? 'Activar cupón' : 'Desactivar cupón',
      mensaje: `Vas a ${activo ? 'activar' : 'desactivar'} el cupón ${String(cupon?.codigo || '').trim().toUpperCase() || `#${idCupon}`}. Esto impacta compras nuevas inmediatamente.`,
      frase: activo ? 'ACTIVAR CUPON' : 'DESACTIVAR CUPON'
    });
    if (!confirmado) return;

    setActualizandoActivoCuponId(idCupon);
    try {
      await fetchAdmin(`/tienda/admin/cupones/${idCupon}/activo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: Boolean(activo) })
      });
      await cargarCuponesAdmin();
      mostrarNotificacion('Estado del cupón actualizado', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo cambiar el estado del cupón', 'error');
    } finally {
      setActualizandoActivoCuponId(0);
    }
  }

  function abrirModalCuponAdmin(cupon = null) {
    if (cupon) {
      setEditandoCuponAdminId(Number(cupon?.id) || 0);
      setCuponAdminDraft({
        ...CUPON_ADMIN_DEFAULT,
        ...cupon,
        alcance_tipo: String(cupon?.alcance_tipo || 'todos').trim().toLowerCase() || 'todos',
        alcance_clave: String(cupon?.alcance_clave || '').trim().toLowerCase(),
        un_solo_uso_por_cliente: Number(cupon?.un_solo_uso_por_cliente) === 1,
        vigente_indefinido: Number(cupon?.vigente_indefinido) === 1,
        activo: Number(cupon?.activo) === 1,
        valido_desde: String(cupon?.valido_desde || '').slice(0, 16),
        valido_hasta: String(cupon?.valido_hasta || '').slice(0, 16)
      });
    } else {
      setEditandoCuponAdminId(0);
      setCuponAdminDraft(CUPON_ADMIN_DEFAULT);
    }
    setPasoModalCuponAdmin(1);
    setMostrandoModalCuponAdmin(true);
  }

  async function fetchAdmin(path, options = {}) {
    const method = String(options?.method || 'GET').trim().toUpperCase() || 'GET';
    const esLectura = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
    if (!sesionInternaActiva) {
      throw new Error('Sesión interna no disponible');
    }
    if (!esLectura && !puedeEditarTrastienda) {
      mostrarNotificacion('No tienes permiso para editar en Trastienda.', 'error');
      throw new Error('Permiso insuficiente para editar Trastienda');
    }
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${tokenInterno}`
    };
    return fetchJson(path, { ...options, headers });
  }

  async function cargarResumenVisitasAdmin(fecha = fechaVisitaSeleccionada) {
    if (!tokenInterno) return;
    setResumenVisitasAdmin((prev) => ({ ...prev, cargando: true }));
    try {
      const fechaQuery = String(fecha || '').trim();
      const ruta = fechaQuery ? `/visitas/resumen?fecha=${encodeURIComponent(fechaQuery)}` : '/visitas/resumen';
      const data = await fetchAdmin(ruta);
      setResumenVisitasAdmin({
        cargando: false,
        fecha: String(data?.fecha || '').trim(),
        activosAhora: Number(data?.activosAhora) || 0,
        visitasDia: Number(data?.visitasDia) || 0,
        eventosDia: Number(data?.eventosDia) || 0,
        horaPico: {
          hora: String(data?.horaPico?.hora || '00:00').trim(),
          total: Number(data?.horaPico?.total) || 0
        },
        ubicacionesTop: Array.isArray(data?.ubicacionesTop) ? data.ubicacionesTop : [],
        porHora: Array.isArray(data?.porHora) ? data.porHora : [],
        actualizadoEn: String(data?.actualizadoEn || '').trim()
      });
    } catch {
      setResumenVisitasAdmin((prev) => ({ ...prev, cargando: false }));
    }
  }

  async function cargarHistorialVisitasAdmin(rango = historialVisitasAdmin.rangoDias) {
    if (!tokenInterno) return;
    const dias = Math.max(7, Math.min(120, Number(rango) || 15));
    setHistorialVisitasAdmin((prev) => ({ ...prev, cargando: true, rangoDias: dias }));
    try {
      const data = await fetchAdmin(`/visitas/historial?dias=${dias}`);
      setHistorialVisitasAdmin({
        cargando: false,
        rangoDias: dias,
        porDia: Array.isArray(data?.porDia) ? data.porDia : [],
        topUbicaciones: Array.isArray(data?.topUbicaciones) ? data.topUbicaciones : [],
        totalVisitas: Number(data?.totalVisitas) || 0,
        totalEventos: Number(data?.totalEventos) || 0,
        promedioVisitasDia: Number(data?.promedioVisitasDia) || 0,
        diaConMasVisitas: {
          fecha: String(data?.diaConMasVisitas?.fecha || '').trim(),
          visitas: Number(data?.diaConMasVisitas?.visitas) || 0,
          eventos: Number(data?.diaConMasVisitas?.eventos) || 0
        }
      });
    } catch {
      setHistorialVisitasAdmin((prev) => ({ ...prev, cargando: false }));
    }
  }

  async function cargarComportamientoVisitasAdmin(rango = historialVisitasAdmin.rangoDias) {
    if (!tokenInterno) return;
    const dias = Math.max(7, Math.min(120, Number(rango) || 15));
    setComportamientoVisitasAdmin((prev) => ({ ...prev, cargando: true }));
    try {
      const data = await fetchAdmin(`/visitas/comportamiento?dias=${dias}`);
      setComportamientoVisitasAdmin({
        cargando: false,
        totalEventos: Number(data?.totalEventos) || 0,
        topAcciones: Array.isArray(data?.topAcciones) ? data.topAcciones : [],
        topProductos: Array.isArray(data?.topProductos) ? data.topProductos : []
      });
    } catch {
      setComportamientoVisitasAdmin((prev) => ({ ...prev, cargando: false }));
    }
  }

  function abrirVentanaAnalisisMetricas() {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const params = new URLSearchParams();
    params.set('tab', metricasSubVista === 'comportamiento' ? 'acciones' : 'visitas');
    params.set('mes', String(fechaVisitaSeleccionada || fechaLocalIsoHoy()).slice(0, 7) || fechaLocalIsoHoy().slice(0, 7));
    url.search = '';
    url.hash = `#/metricas-analisis?${params.toString()}`;
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }

  async function reiniciarMetricasAdmin() {
    if (!tokenInterno || reiniciandoMetricasAdmin) return;
    const confirmar = await confirmarAccionCriticaTrastienda({
      titulo: 'Reiniciar métricas',
      mensaje: 'Vas a borrar métricas de visitas y comportamiento. La información histórica dejará de estar disponible en el panel.',
      frase: 'REINICIAR METRICAS'
    });
    if (!confirmar) return;

    setReiniciandoMetricasAdmin(true);
    try {
      await fetchAdmin('/tienda/admin/metricas/reset', { method: 'POST' });
      await Promise.all([
        cargarResumenVisitasAdmin(fechaVisitaSeleccionada),
        cargarHistorialVisitasAdmin(historialVisitasAdmin.rangoDias),
        cargarComportamientoVisitasAdmin(historialVisitasAdmin.rangoDias)
      ]);
      mostrarNotificacion('Métricas reiniciadas', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudieron reiniciar las métricas', 'error');
    } finally {
      setReiniciandoMetricasAdmin(false);
    }
  }

  function registrarEventoComportamiento(accion, producto = '') {
    if (excluirMetricasVisitas) return;
    const sessionId = obtenerSesionVisitaId();
    if (!sessionId) return;

    const idCliente = Number(cliente?.id || 0);
    const zonaHoraria = Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || '';
    const payload = {
      sessionId,
      idCliente: idCliente > 0 ? idCliente : undefined,
      accion: String(accion || '').trim().slice(0, 64),
      producto: String(producto || '').trim().slice(0, 140),
      seccion: String(seccionActiva || '').trim().slice(0, 64),
      ruta: String(window?.location?.hash || '#/vitrina').trim().slice(0, 120),
      zonaHoraria: String(zonaHoraria || '').trim().slice(0, 64),
      esTrastienda: excluirMetricasVisitas
    };
    if (!payload.accion) return;

    const body = JSON.stringify(payload);

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(apiUrl('/visitas/evento'), blob);
      } catch {
        // Ignorar y continuar con fetch.
      }
    }

    fetchJson('/visitas/evento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => {});
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

  async function cambiarAccionesClienteAdmin(idCliente, accionesActivas) {
    const id = Number(idCliente || 0);
    if (!Number.isFinite(id) || id <= 0) return;

    const cliente = adminClientes.find((item) => Number(item?.id || 0) === id);
    const confirmado = await confirmarAccionCriticaTrastienda({
      titulo: accionesActivas ? 'Activar acciones del cliente' : 'Desactivar acciones del cliente',
      mensaje: `Vas a ${accionesActivas ? 'activar' : 'desactivar'} acciones de app para ${String(cliente?.nombre || cliente?.email || `cliente #${id}`).trim()}. Esto altera su operativa en tienda.`,
      frase: accionesActivas ? 'ACTIVAR CLIENTE' : 'DESACTIVAR CLIENTE'
    });
    if (!confirmado) return;

    setActualizandoClienteAccionesId(id);
    try {
      await fetchAdmin(`/tienda/admin/clientes/${id}/acciones-app`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acciones_app_activas: Boolean(accionesActivas) })
      });

      setAdminClientes((prev) => (Array.isArray(prev)
        ? prev.map((item) => (
          Number(item?.id || 0) === id
            ? { ...item, acciones_app_activas: accionesActivas ? 1 : 0 }
            : item
        ))
        : []));
      mostrarNotificacion('Estado de acciones del cliente actualizado', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo actualizar el estado del cliente', 'error');
    } finally {
      setActualizandoClienteAccionesId(0);
    }
  }

  async function eliminarClienteAdmin(idCliente) {
    const id = Number(idCliente || 0);
    if (!Number.isFinite(id) || id <= 0) return;
    const cliente = adminClientes.find((item) => Number(item?.id || 0) === id);
    const ok = await confirmarAccionCriticaTrastienda({
      titulo: 'Eliminar cliente',
      mensaje: `Vas a eliminar a ${String(cliente?.nombre || cliente?.email || `cliente #${id}`).trim()} junto con datos asociados. Esta acción no se puede deshacer.`,
      frase: 'ELIMINAR CLIENTE'
    });
    if (!ok) return;
    try {
      await fetchAdmin(`/tienda/admin/clientes/${id}`, { method: 'DELETE' });
      await cargarAdminClientes();
      mostrarNotificacion('Cliente eliminado', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo eliminar el cliente', 'error');
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

    const confirmado = await confirmarAccionCriticaTrastienda({
      titulo: 'Crear punto de entrega',
      mensaje: 'Vas a crear un nuevo punto de entrega visible para clientes en checkout y operación interna.',
      frase: 'CREAR PUNTO'
    });
    if (!confirmado) return;

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

    const confirmado = await confirmarAccionCriticaTrastienda({
      titulo: activo ? 'Activar punto de entrega' : 'Desactivar punto de entrega',
      mensaje: `Vas a ${activo ? 'activar' : 'desactivar'} el punto ${String(punto?.nombre || '').trim() || `#${id}`}. Esto afecta disponibilidad para clientes.`,
      frase: activo ? 'ACTIVAR PUNTO' : 'DESACTIVAR PUNTO'
    });
    if (!confirmado) return;

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

    const confirmado = await confirmarAccionCriticaTrastienda({
      titulo: 'Guardar punto de entrega',
      mensaje: `Vas a actualizar el punto ${String(punto?.nombre || '').trim() || `#${punto?.id || ''}`}. Este cambio altera la información operativa mostrada a clientes.`,
      frase: 'GUARDAR PUNTO'
    });
    if (!confirmado) return;

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
    const ok = await confirmarAccionCriticaTrastienda({
      titulo: 'Eliminar punto',
      mensaje: 'Vas a eliminar este punto de entrega. Clientes y operación dejarán de verlo inmediatamente.',
      frase: 'ELIMINAR PUNTO'
    });
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

  function actualizarDraftSeguimientoOrden(id, cambios = {}) {
    setSeguimientoDraftPorOrden((prev) => {
      const actual = prev?.[id] || { estado: 'pendiente', paqueteria: '', numero_guia: '' };
      return {
        ...prev,
        [id]: {
          ...actual,
          ...cambios
        }
      };
    });
  }

  async function actualizarEstadoOrdenAdmin(id, cambios = {}) {
    try {
      const payloadRaw = (typeof cambios === 'string') ? { estado: cambios } : (cambios || {});
      const payload = {
        estado: String(payloadRaw?.estado || '').trim().toLowerCase(),
        estado_pago: String(payloadRaw?.estado_pago || '').trim().toLowerCase(),
        paqueteria: String(payloadRaw?.paqueteria || '').trim().toLowerCase(),
        numero_guia: String(payloadRaw?.numero_guia || '').trim()
      };

      if (!payload.estado) {
        throw new Error('Selecciona un estado válido');
      }
      if (payload.estado === 'enviado_por_paqueteria' && (!payload.paqueteria || !payload.numero_guia)) {
        throw new Error('Captura paquetería y número de guía para guardar este estatus');
      }

      await fetchAdmin(`/tienda/admin/ordenes/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      await cargarAdminOrdenes();
      mostrarNotificacion('Estado de pedido actualizado', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo actualizar estado', 'error');
    }
  }

  async function actualizarEstadoPagoOrdenAdmin(id, estadoPago) {
    try {
      await fetchAdmin(`/tienda/admin/ordenes/${id}/pago`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado_pago: String(estadoPago || '').trim().toLowerCase() })
      });
      await cargarAdminOrdenes();
      mostrarNotificacion('Estado de pago actualizado', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo actualizar estado de pago', 'error');
    }
  }

  async function eliminarOrdenAdmin(idOrden) {
    const id = Number(idOrden || 0);
    if (!Number.isFinite(id) || id <= 0) return;

    const confirmar = await confirmarAccionCriticaTrastienda({
      titulo: 'Eliminar pedido',
      mensaje: 'Vas a eliminar este pedido. La acción afecta historial operativo y no se puede deshacer.',
      frase: 'ELIMINAR PEDIDO'
    });
    if (!confirmar) return;

    setProcesandoPedidosAdmin(true);
    try {
      await fetchAdmin(`/tienda/admin/ordenes/${id}`, { method: 'DELETE' });
      await cargarAdminOrdenes();
      mostrarNotificacion('Pedido eliminado', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo eliminar el pedido', 'error');
    } finally {
      setProcesandoPedidosAdmin(false);
    }
  }

  async function eliminarPedidosFiltradosAdmin() {
    const ids = ordenesAdminFiltradas
      .map((orden) => Number(orden?.id || 0))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (!ids.length) {
      mostrarNotificacion('No hay pedidos filtrados para eliminar', 'error');
      return;
    }

    const confirmar = await mostrarConfirmacion(
      `¿Eliminar ${ids.length} pedido(s) visibles en el filtro actual? Esta acción no se puede deshacer.`,
      'Eliminar pedidos filtrados'
    );
    if (!confirmar) return;

    const confirmado = await confirmarAccionCriticaTrastienda({
      titulo: 'Eliminar pedidos filtrados',
      mensaje: `Vas a eliminar ${ids.length} pedido(s) visibles en el filtro actual. Esto impacta historial y folios operativos.`,
      frase: 'ELIMINAR PEDIDOS'
    });
    if (!confirmado) return;

    setProcesandoPedidosAdmin(true);
    try {
      await fetchAdmin('/tienda/admin/ordenes/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      await cargarAdminOrdenes();
      mostrarNotificacion('Pedidos filtrados eliminados', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudieron eliminar los pedidos filtrados', 'error');
    } finally {
      setProcesandoPedidosAdmin(false);
    }
  }

  async function reiniciarContadoresPedidosAdmin() {
    const passwordAdmin = String(modalResetContadoresAdmin.password || '').trim();
    if (!passwordAdmin) {
      mostrarNotificacion('Se requiere la contraseña del admin', 'error');
      return;
    }

    const confirmado = await confirmarAccionCriticaTrastienda({
      titulo: 'Reiniciar contadores de pedidos',
      mensaje: 'Vas a eliminar pedidos y reiniciar folios. Esta acción es destructiva y altera trazabilidad operativa.',
      frase: 'REINICIAR PEDIDOS'
    });
    if (!confirmado) return;

    setProcesandoPedidosAdmin(true);
    try {
      await fetchAdmin('/tienda/admin/ordenes/reset-contadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password_admin: passwordAdmin,
          password_ceo: passwordAdmin,
          password: passwordAdmin
        })
      });
      await cargarAdminOrdenes();
      setBusquedaAdmin('');
      setFiltroEstadoOrdenAdmin('todos');
      setOrdenObjetivoAdmin({ id: '', folio: '' });
      setModalResetContadoresAdmin({ visible: false, password: '' });
      mostrarNotificacion('Contadores y pedidos reiniciados', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudieron reiniciar los contadores', 'error');
    } finally {
      setProcesandoPedidosAdmin(false);
    }
  }

  function abrirModalResetContadoresAdmin() {
    if (procesandoPedidosAdmin) return;
    setModalResetContadoresAdmin({ visible: true, password: '' });
  }

  function cerrarModalResetContadoresAdmin() {
    if (procesandoPedidosAdmin) return;
    setModalResetContadoresAdmin({ visible: false, password: '' });
  }


  async function guardarClasificacionProducto(producto) {
    const recetaNombre = String(producto?.nombre_receta || '').trim();
    if (!recetaNombre) return;

    const confirmado = await confirmarAccionCriticaTrastienda({
      titulo: 'Guardar clasificación de producto',
      mensaje: `Vas a cambiar banderas comerciales de ${recetaNombre} en la vitrina.`,
      frase: 'CLASIFICAR PRODUCTO'
    });
    if (!confirmado) return;

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
          es_accesorio: Boolean(producto?.es_accesorio),
          activo: Boolean(producto?.visible_publico)
        })
      });
      await cargarProductos({ silencioso: true });
      mostrarNotificacion(`Clasificación guardada para ${recetaNombre}`, 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo guardar clasificación', 'error');
    } finally {
      setGuardandoClasificacion('');
    }
  }

  async function guardarClasificacionTodos() {
    if (!productos.length) return;

    const confirmado = await confirmarAccionCriticaTrastienda({
      titulo: 'Guardar clasificación masiva',
      mensaje: 'Vas a aplicar clasificación comercial masiva sobre todos los productos cargados. Esto puede alterar la vitrina completa.',
      frase: 'CLASIFICAR TODO'
    });
    if (!confirmado) return;

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
              es_accesorio: Boolean(producto?.es_accesorio),
              activo: Boolean(producto?.visible_publico)
            })
          });
        })
      );

      await cargarProductos({ silencioso: true });
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
          es_oferta: Boolean(marcado),
          activo: Boolean(producto?.visible_publico)
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
      const lista = Array.isArray(data) ? data : [];
      setOrdenes(lista);
      revisarCambiosEstadoOrdenes(lista);
    } catch {
      setOrdenes([]);
    }
  }

  async function cargarResenasProducto(recetaNombre) {
    const receta = String(recetaNombre || '').trim();
    if (!receta) {
      setResenasDetalle([]);
      setResenaDetalleModal(null);
      return;
    }

    setCargandoResenas(true);
    try {
      const headers = {};
      if (clienteToken) headers.Authorization = `Bearer ${clienteToken}`;
      const data = await fetchJson(`/tienda/resenas?receta_nombre=${encodeURIComponent(receta)}`, { headers });
      const resumen = data?.resumen || {};
      setResenasDetalle(Array.isArray(data?.resenas) ? data.resenas : []);
      setResenaDetalleModal(null);
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
      setResenaDetalleModal(null);
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
      setMostrarModalResena(false);
      await cargarResenasProducto(receta);
      await cargarProductos({ silencioso: true });

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

  async function actualizarResenaProducto() {
    const idResena = Number(resenaEditandoId || 0);
    const receta = String(seleccionado?.nombre_receta || '').trim();
    const comentario = String(resenaNueva?.comentario || '').trim();
    const calificacion = Math.max(1, Math.min(5, Number(resenaNueva?.calificacion) || 0));

    if (!clienteToken) {
      mostrarNotificacion('Inicia sesión para editar tu comentario', 'error');
      return;
    }
    if (!idResena) return;
    if (!receta) return;
    if (comentario.length < 3) {
      mostrarNotificacion('Escribe un comentario más completo', 'error');
      return;
    }

    setEnviandoResena(true);
    try {
      const data = await fetchJson(`/tienda/resenas/${idResena}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clienteToken}`
        },
        body: JSON.stringify({ calificacion, comentario })
      });

      setResenaNueva({ calificacion: 5, comentario: '' });
      setResenaEditandoId(0);
      setMostrarModalResena(false);
      await cargarResenasProducto(receta);
      await cargarProductos({ silencioso: true });

      const resumen = data?.resumen || {};
      setSeleccionado((prev) => {
        if (!prev || String(prev?.nombre_receta || '').trim() !== receta) return prev;
        return {
          ...prev,
          resenas_total: Number(resumen?.total) || prev?.resenas_total || 0,
          resenas_promedio: Number(resumen?.promedio) || prev?.resenas_promedio || 0
        };
      });
      mostrarNotificacion('Comentario actualizado', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo actualizar tu comentario', 'error');
    } finally {
      setEnviandoResena(false);
    }
  }

  function resolverClaveResena(resena = {}, idx = 0) {
    const id = Number(resena?.id) || 0;
    if (id > 0) return `resena-${id}`;
    const nombre = String(resena?.nombre_cliente || 'cliente').trim().toLowerCase();
    return `resena-${nombre || 'anon'}-${idx}`;
  }

  function obtenerVistaPreviaComentario(comentario = '', limite = 180) {
    const texto = String(comentario || '').trim().replace(/\s+/g, ' ');
    if (!texto) return '';
    if (texto.length <= limite) return texto;
    return `${texto.slice(0, limite).trimEnd()}...`;
  }

  function abrirDetalle(producto, opciones = {}) {
    const variantes = normalizarVariantes(producto?.variantes);
    const primeraDisponible = variantes.find((v) => Boolean(v?.disponible)) || variantes[0] || null;
    const detallePaquete = Array.isArray(producto?.paquete_detalle) ? producto.paquete_detalle : [];
    const imagenPaquete = String(producto?.image_url || '').trim();
    const galeriaBase = Array.isArray(producto?.galeria)
      ? producto.galeria.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    const galeriaDetalles = detallePaquete
      .map((item) => String(item?.image_url || '').trim())
      .filter(Boolean);
    const galeria = Array.from(new Set([imagenPaquete, ...galeriaBase, ...galeriaDetalles].filter(Boolean)));
    const imagenActiva = String(imagenPaquete || galeria[0] || '').trim();
    setSeleccionado({
      ...producto,
      variantes,
      variante_activa: primeraDisponible?.nombre || '',
      detalle_paquete_activo: 0,
      galeria,
      imagen_activa: imagenActiva
    });
    setResenaNueva({ calificacion: 5, comentario: '' });
    setResenaEditandoId(0);
    setMostrarModalResena(false);
    setResenaDetalleModal(null);
    cargarResenasProducto(producto?.nombre_receta);
    setVistaActiva('detalle');
    if (!opciones?.sinHash) {
      navegarRutaPublicaTienda({
        categoria: categoriaActiva,
        producto: String(producto?.slug || '').trim()
      });
    }
    if (opciones?.registrar !== false) {
      registrarEventoComportamiento('ver_detalle_producto', producto?.nombre_receta || 'producto');
    }
    if (opciones?.scroll !== false) {
      const contenedor = contenedorScrollRef.current;
      if (contenedor && typeof contenedor.scrollTo === 'function') {
        contenedor.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  function seleccionarVarianteDetalle(nombreVariante) {
    setSeleccionado((prev) => {
      if (!prev) return prev;
      return { ...prev, variante_activa: nombreVariante };
    });
  }

  function seleccionarDetallePaquete(index) {
    const idx = Number(index) || 0;
    setSeleccionado((prev) => {
      if (!prev) return prev;
      const detalles = Array.isArray(prev?.paquete_detalle) ? prev.paquete_detalle : [];
      if (!detalles.length) return prev;
      const idxSeguro = Math.max(0, Math.min(idx, detalles.length - 1));
      return {
        ...prev,
        detalle_paquete_activo: idxSeguro
      };
    });

    const detalle = (Array.isArray(seleccionado?.paquete_detalle) ? seleccionado.paquete_detalle : [])[idx];
    const nombreRecetaDetalle = String(detalle?.receta_nombre || '').trim();
    if (nombreRecetaDetalle) {
      cargarResenasProducto(nombreRecetaDetalle);
    }
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
          image_url: String(producto?.image_url || '').trim(),
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
    registrarEventoComportamiento('agregar_carrito', recetaReal || producto?.nombre_receta || 'producto');
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

  function limpiarErrorAuthCliente() {
    setErrorAuthCliente('');
    setSacudirAuthCliente(false);
  }

  function reiniciarTurnstileAuthCliente() {
    setClienteTurnstileToken('');
    setClienteTurnstileResetKey((prev) => prev + 1);
  }

  function reiniciarTurnstileRecuperacionCliente() {
    setRecuperacionTurnstileToken('');
    setRecuperacionTurnstileResetKey((prev) => prev + 1);
  }

  function cerrarModalAuthCliente() {
    setMostrarModalAuthCliente(false);
    limpiarErrorAuthCliente();
    reiniciarTurnstileAuthCliente();
    reiniciarTurnstileRecuperacionCliente();
  }

  async function enviarAuth(event) {
    event.preventDefault();
    if (enviandoAuthCliente) return;

    const endpoint = modoAuth === 'login' ? '/tienda/auth/login' : '/tienda/auth/register';
    const emailNormalizado = String(credenciales.email || '').trim().toLowerCase();
    const passwordActual = String(credenciales.password || '');

    try {
      limpiarErrorAuthCliente();

      if (!emailNormalizado) {
        throw new Error('Escribe tu correo para continuar');
      }

      if (!esCorreoValido(emailNormalizado)) {
        throw new Error('Escribe un correo valido para continuar');
      }

      if (!passwordActual) {
        throw new Error(modoAuth === 'login' ? 'Escribe tu contraseña para entrar' : 'Escribe una contraseña para continuar');
      }

      if (TURNSTILE_PUBLIC_AUTH_ENABLED && !clienteTurnstileToken) {
        throw new Error('Completa la verificación de seguridad para continuar');
      }

      if (modoAuth === 'register' && String(credenciales.password || '') !== String(credenciales.confirmarPassword || '')) {
        throw new Error('La confirmación de contraseña no coincide');
      }

      if (modoAuth === 'register') {
        const nombre = String(credenciales.nombre || '').trim();
        const apellidoPaterno = String(credenciales.apellido_paterno || '').trim();
        const apellidoMaterno = String(credenciales.apellido_materno || '').trim();
        if (!nombre || !apellidoPaterno || !apellidoMaterno) {
          throw new Error('Nombre, apellido paterno y apellido materno son obligatorios');
        }
      }

      setEnviandoAuthCliente(true);

      const body = modoAuth === 'login'
        ? { email: emailNormalizado, password: passwordActual, turnstile_token: clienteTurnstileToken }
        : {
            nombre: credenciales.nombre,
            apellido_paterno: credenciales.apellido_paterno,
            apellido_materno: credenciales.apellido_materno,
            email: emailNormalizado,
            password: passwordActual,
            telefono: credenciales.telefono,
            recibe_promociones: Boolean(credenciales.recibe_promociones),
            turnstile_token: clienteTurnstileToken
          };

      const data = await fetchJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      localStorage.setItem(CLAVE_TOKEN_CLIENTE, CLIENTE_COOKIE_SESSION_SENTINEL);
      setClienteToken(CLIENTE_COOKIE_SESSION_SENTINEL);
      setMostrarModalPerfilCliente(false);
      setPerfilModalTab('datos');
      setVistaActiva('tienda');
      setCredenciales({
        nombre: '',
        apellido_paterno: '',
        apellido_materno: '',
        email: '',
        password: '',
        confirmarPassword: '',
        telefono: '',
        recibe_promociones: false
      });
      setPasoRegistro(1);
      cerrarModalAuthCliente();
      mostrarNotificacion(modoAuth === 'login' ? 'Sesión iniciada' : 'Cuenta creada', 'exito');

      if (modoAuth === 'login' && Boolean(data?.debe_cambiar_password)) {
        setModalCambioPasswordCliente({ visible: true, nueva: '', confirmar: '', guardando: false, cerrarSesiones: true });
        mostrarNotificacion('Por seguridad, cambia tu contraseña temporal para continuar.', 'advertencia');
      }
    } catch (error) {
      const mensaje = error?.message || 'No se pudo autenticar';
      if (modoAuth === 'login' && /credenciales inv[aá]lidas/i.test(mensaje)) {
        setErrorAuthCliente('Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.');
        setSacudirAuthCliente(true);
        window.setTimeout(() => {
          passwordLoginRef.current?.focus();
          passwordLoginRef.current?.select?.();
        }, 0);
      } else {
        setErrorAuthCliente(mensaje);
      }
      mostrarNotificacion(error?.message || 'No se pudo autenticar', 'error');
    } finally {
      setEnviandoAuthCliente(false);
      if (TURNSTILE_PUBLIC_AUTH_ENABLED) reiniciarTurnstileAuthCliente();
    }
  }

  function avanzarPasoRegistro() {
    if (pasoRegistro === 1) {
      const nombre = String(credenciales.nombre || '').trim();
      const apellidoPaterno = String(credenciales.apellido_paterno || '').trim();
      const apellidoMaterno = String(credenciales.apellido_materno || '').trim();
      if (!nombre || !apellidoPaterno || !apellidoMaterno) {
        mostrarNotificacion('Completa nombre, apellido paterno y apellido materno para continuar', 'error');
        return;
      }
    }
    setPasoRegistro((p) => Math.min(3, p + 1));
  }

  async function enviarRecuperacionCliente() {
    setRecuperacionClienteMensaje('');

    try {
      const email = String(recuperarClienteEmail || '').trim().toLowerCase();
      if (!email) throw new Error('Escribe tu correo para recuperar tu contraseña');
      if (!esCorreoValido(email)) throw new Error('Escribe un correo valido para recuperar tu contraseña');
      if (TURNSTILE_PUBLIC_AUTH_ENABLED && !recuperacionTurnstileToken) {
        throw new Error('Completa la verificación de seguridad para continuar');
      }

      setEnviandoRecuperacionCliente(true);
      const data = await fetchJson('/tienda/auth/olvide-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstile_token: recuperacionTurnstileToken })
      });

      setCredenciales((prev) => ({ ...prev, email, password: '' }));
      setMostrarPanelRecuperarCliente(false);
      setRecuperacionClienteMensaje('');
      setRecuperarClienteEmail('');
      mostrarNotificacion(data?.mensaje || 'Te enviamos una contraseña temporal a tu correo.', 'exito');
    } catch (error) {
      setRecuperacionClienteMensaje(error?.message || 'No se pudo enviar el correo de recuperación');
    } finally {
      setEnviandoRecuperacionCliente(false);
      if (TURNSTILE_PUBLIC_AUTH_ENABLED) reiniciarTurnstileRecuperacionCliente();
    }
  }

  async function guardarNuevaPasswordCliente(event) {
    event.preventDefault();

    try {
      const nueva = String(modalCambioPasswordCliente.nueva || '');
      const confirmar = String(modalCambioPasswordCliente.confirmar || '');
      if (!nueva || nueva.length < 8) throw new Error('Tu nueva contraseña debe tener al menos 8 caracteres');
      if (nueva !== confirmar) throw new Error('Las contraseñas no coinciden');
      if (!clienteToken) throw new Error('Tu sesión no es válida. Inicia sesión nuevamente');

      setModalCambioPasswordCliente((prev) => ({ ...prev, guardando: true }));
      const data = await fetchJson('/tienda/auth/cambiar-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clienteToken}`
        },
        body: JSON.stringify({
          password_nueva: nueva,
          cerrar_sesiones: Boolean(modalCambioPasswordCliente.cerrarSesiones)
        })
      });

      const cerrarSesiones = Boolean(modalCambioPasswordCliente.cerrarSesiones);
      const tokenRefrescado = String(data?.token || '').trim();
      if (cerrarSesiones || tokenRefrescado) {
        localStorage.setItem(CLAVE_TOKEN_CLIENTE, CLIENTE_COOKIE_SESSION_SENTINEL);
        setClienteToken(CLIENTE_COOKIE_SESSION_SENTINEL);
      }
      setModalCambioPasswordCliente({ visible: false, nueva: '', confirmar: '', guardando: false, cerrarSesiones: true });
      if (cerrarSesiones) {
        mostrarNotificacion('Contraseña actualizada. Se cerró sesión en tus otros dispositivos.', 'exito');
      } else {
        mostrarNotificacion('Contraseña actualizada correctamente', 'exito');
      }
    } catch (error) {
      setModalCambioPasswordCliente((prev) => ({ ...prev, guardando: false }));
      mostrarNotificacion(error?.message || 'No se pudo cambiar la contraseña', 'error');
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
      setPerfil({
        nombre: data?.cliente?.nombre || perfil.nombre || '',
        apellido_paterno: data?.cliente?.apellido_paterno || perfil.apellido_paterno || '',
        apellido_materno: data?.cliente?.apellido_materno || perfil.apellido_materno || '',
        email: data?.cliente?.email || perfil.email || '',
        telefono: data?.cliente?.telefono || perfil.telefono || '',
        fecha_nacimiento: data?.cliente?.fecha_nacimiento || perfil.fecha_nacimiento || '',
        direccion_default: data?.cliente?.direccion_default || perfil.direccion_default || '',
        forma_pago_preferida: data?.cliente?.forma_pago_preferida || perfil.forma_pago_preferida || '',
        recibe_promociones: Boolean(data?.cliente?.recibe_promociones)
      });
      setCheckout((prev) => ({
        ...prev,
        metodo_pago: metodoPagoOculto(data?.cliente?.forma_pago_preferida) ? prev.metodo_pago : (data?.cliente?.forma_pago_preferida || prev.metodo_pago)
      }));
      mostrarNotificacion('Perfil guardado', 'exito');
    } catch (error) {
      mostrarNotificacion(error?.message || 'No se pudo guardar el perfil', 'error');
    }
  }

  async function cerrarSesionCliente() {
    try {
      await fetchJson('/tienda/auth/logout', { method: 'POST' });
    } catch {
      // No bloquear cierre local si la cookie ya no existe o el backend no responde.
    }
    localStorage.removeItem(CLAVE_TOKEN_CLIENTE);
    setClienteToken('');
    setCliente(null);
    setMostrarModalPerfilCliente(false);
    setPerfilModalTab('datos');
    setVistaActiva('tienda');
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

    if (metodoPagoOculto(checkout.metodo_pago)) {
      setCheckout((prev) => ({ ...prev, metodo_pago: 'transferencia' }));
      mostrarNotificacion('Mercado Pago está oculto temporalmente. Usa transferencia, efectivo o tarjeta.', 'info');
      return;
    }

    if (String(checkout.metodo_pago || '').trim().toLowerCase() === 'mercado_pago') {
      const confirmar = await mostrarConfirmacion(
        'Se creará tu pedido y te redirigiremos a Mercado Pago para completar el pago. ¿Deseas continuar?',
        'Continuar con Mercado Pago'
      );
      if (!confirmar) return;
    }

    try {
      setCreandoOrden(true);

      if (String(checkout.metodo_pago || '').trim().toLowerCase() === 'mercado_pago') {
        const urlRetornoBase = (() => {
          try {
            const origen = String(window.location.origin || '').trim();
            const ruta = String(window.location.pathname || '').trim();
            return `${origen}${ruta}`;
          } catch {
            return '';
          }
        })();

        const dataCheckout = await fetchJson('/tienda/checkout/mercado-pago/preferencia', {
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
            origen_pedido: resolverOrigenPedidoCliente(),
            id_punto_entrega: Number(checkout.id_punto_entrega) || 0,
            notas: checkout.notas,
            codigo_cupon: String((cuponesAplicados[0]?.codigo) || '').trim(),
            codigos_cupones: (Array.isArray(cuponesAplicados) ? cuponesAplicados : [])
              .map((cup) => String(cup?.codigo || '').trim())
              .filter(Boolean),
            url_retorno_base: urlRetornoBase
          })
        });

        const mpUrl = String(dataCheckout?.checkout?.init_point || '').trim();
        if (!mpUrl) throw new Error('No se pudo iniciar checkout de Mercado Pago');

        try {
          localStorage.setItem(CLAVE_MP_CHECKOUT_PENDIENTE, JSON.stringify({
            preference_id: String(dataCheckout?.checkout?.preference_id || '').trim(),
            folio: String(dataCheckout?.folio || '').trim(),
            creado_en: Date.now()
          }));
        } catch {
        }

        let popup = null;
        try {
          popup = window.open(mpUrl, '_blank', 'noopener,noreferrer');
        } catch {
          popup = null;
        }
        if (!popup) {
          window.location.href = mpUrl;
        } else {
          const monitorPopup = window.setInterval(() => {
            try {
              if (popup.closed) {
                window.clearInterval(monitorPopup);
                setMpReconcileTick((v) => v + 1);
              }
            } catch {
            }
          }, 1200);
          window.setTimeout(() => window.clearInterval(monitorPopup), 20 * 60 * 1000);
        }
        mostrarNotificacion('Te estamos redirigiendo a Mercado Pago para confirmar tu pago.', 'exito');
        return;
      }

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
          origen_pedido: resolverOrigenPedidoCliente(),
          metodo_pago: checkout.metodo_pago,
          id_punto_entrega: Number(checkout.id_punto_entrega) || 0,
          notas: checkout.notas,
          codigo_cupon: String((cuponesAplicados[0]?.codigo) || '').trim(),
          codigos_cupones: (Array.isArray(cuponesAplicados) ? cuponesAplicados : [])
            .map((cup) => String(cup?.codigo || '').trim())
            .filter(Boolean)
        })
      });

      const orden = data?.orden;
      if (!orden) throw new Error('No se pudo crear la orden');

      setCarrito([]);
      setCarritoCreadoEn(Date.now());
      setCheckout((prev) => ({ ...prev, notas: '' }));
      setCuponesAplicados([]);
      setCodigoCuponInput('');
      cerrarCarrito();
      await cargarMisOrdenes();
      await cargarProductos({ silencioso: true });

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
    <div
      ref={contenedorScrollRef}
      className={[
        'tiendaRootScroll',
        !esVistaTrastienda ? 'tiendaPublica' : '',
        (esVistaTrastienda || vistaActiva === 'trastienda') ? 'tiendaRootScrollAdminMovil' : '',
        integradaEnPanelInterno && !esVistaTrastienda ? 'tiendaEnPanelInterno' : ''
      ].filter(Boolean).join(' ')}
      tabIndex={0}
    >
      {!esVistaTrastienda && String(configTienda.promo_texto || '').trim() && (
      <div className="tiendaPromoBar" aria-label={configTienda.promo_texto}>
        <div className="tiendaPromoBarPista">
          <span className="tiendaPromoBarTexto">{configTienda.promo_texto}</span>
          <span className="tiendaPromoBarSeparador" aria-hidden="true">•</span>
          <span className="tiendaPromoBarTexto" aria-hidden="true">{configTienda.promo_texto}</span>
          <span className="tiendaPromoBarSeparador" aria-hidden="true">•</span>
        </div>
      </div>
      )}

      {esVistaTrastienda && tokenInterno && visitasActivas.listo && (
        <div className={`tiendaVisitasActivas ${esVistaTrastienda ? 'admin' : ''}`}>
          <strong>
            {visitasActivas.totalActivos} {visitasActivas.totalActivos === 1 ? 'persona activa ahora' : 'personas activas ahora'}
          </strong>
          {textoUbicacionesVisitas && (
            <span>Desde: {textoUbicacionesVisitas}</span>
          )}
        </div>
      )}

      {!esVistaTrastienda && (
      <div className="tiendaMainHeader">
        <button
          type="button"
          className={mostrarMenuMovil ? 'tiendaMenuMovilToggle tiendaSoloMovil abierta' : 'tiendaMenuMovilToggle tiendaSoloMovil'}
          onClick={() => setMostrarMenuMovil((prev) => !prev)}
          aria-label={mostrarMenuMovil ? 'Cerrar menú móvil' : 'Abrir menú móvil'}
          aria-expanded={mostrarMenuMovil}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M3 6.5h18" />
            <path d="M3 12h18" />
            <path d="M3 17.5h18" />
          </svg>
        </button>
        <div className="tiendaHeaderLogoLado">
          {mostrarLogoAccesoSistema && (
            <button
              type="button"
              className="tiendaBrandLogoBtn"
              onClick={onClickLogoAccesoSistema || undefined}
              title="Acceso al sistema"
              aria-label="Acceso al sistema"
            >
              <img src="/images/banner chipactli.png" alt="Acceso" className="tiendaBrandLogoImg" />
            </button>
          )}
        </div>
        <button
          type="button"
          className="tiendaCartBtn tiendaCartBtnMovil tiendaSoloMovil"
          onClick={abrirCarrito}
          aria-label="Abrir carrito"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="9" cy="19" r="1.75" />
            <circle cx="17" cy="19" r="1.75" />
            <path d="M3.5 5h2.1l1.85 8.1a1 1 0 0 0 .98.78h8.25a1 1 0 0 0 .97-.76l1.45-5.62H7.1" />
          </svg>
          {carrito.length > 0 && <span className="tiendaCartCount">{carrito.length}</span>}
        </button>
        <div className="tiendaHeaderBusquedaWrap">
          <input
            className="cajaBusqueda"
            placeholder="🔍 Buscar producto..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
        <div className="tiendaHeaderAcciones tiendaSoloDesktop">
          {mostrarAccesoRapidoPwa && typeof onActivarAccesoRapidoPwa === 'function' && (
            <button
              type="button"
              className="boton tiendaAccesoRapidoBtn"
              onClick={onActivarAccesoRapidoPwa}
              title="Guardar acceso rápido en este dispositivo"
            >
              Acceso rápido
            </button>
          )}
          {!clienteToken ? (
            <button
              type="button"
              className="tiendaSaludoCliente tiendaSesionBtnInvitado"
              onClick={abrirSesionCliente}
              title="Iniciar sesión"
              aria-label="Iniciar sesión"
            >
              <span className="tiendaSaludoContenido">
                <span className="tiendaSaludoEnredadera" aria-hidden="true">
                  <svg viewBox="0 0 140 18" role="presentation" focusable="false" preserveAspectRatio="none">
                    <path d="M1 9 C20 2, 40 16, 60 9 C80 2, 100 16, 120 9 C128 6, 134 8, 139 9" />
                    <ellipse cx="14" cy="5" rx="4" ry="2.2" transform="rotate(-25 14 5)" />
                    <ellipse cx="29" cy="13" rx="4.3" ry="2.4" transform="rotate(22 29 13)" />
                    <ellipse cx="45" cy="5" rx="4" ry="2.2" transform="rotate(-20 45 5)" />
                    <ellipse cx="61" cy="13" rx="4.3" ry="2.4" transform="rotate(22 61 13)" />
                    <ellipse cx="77" cy="5" rx="4" ry="2.2" transform="rotate(-24 77 5)" />
                    <ellipse cx="93" cy="13" rx="4.3" ry="2.4" transform="rotate(22 93 13)" />
                    <ellipse cx="109" cy="5" rx="4" ry="2.2" transform="rotate(-20 109 5)" />
                    <ellipse cx="126" cy="12" rx="4" ry="2.2" transform="rotate(20 126 12)" />
                  </svg>
                </span>
                <span className="tiendaSaludoLabel">Bienvenido</span>
                <strong className="tiendaSaludoNombre">Inicia sesión</strong>
              </span>
              <span className="tiendaSaludoIcono" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                  <circle cx="12" cy="8" r="4.2" />
                  <path d="M4.5 19.5c0-3.8 3.3-6.4 7.5-6.4s7.5 2.6 7.5 6.4" />
                </svg>
              </span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="tiendaSaludoCliente"
                onClick={abrirPerfilCliente}
                title={`Perfil de ${nombreClienteHeader}`}
                aria-label={`Perfil de ${nombreClienteHeader}`}
              >
                <span className="tiendaSaludoContenido">
                  <span className="tiendaSaludoEnredadera" aria-hidden="true">
                    <svg viewBox="0 0 140 18" role="presentation" focusable="false" preserveAspectRatio="none">
                      <path d="M1 9 C20 2, 40 16, 60 9 C80 2, 100 16, 120 9 C128 6, 134 8, 139 9" />
                      <ellipse cx="14" cy="5" rx="4" ry="2.2" transform="rotate(-25 14 5)" />
                      <ellipse cx="29" cy="13" rx="4.3" ry="2.4" transform="rotate(22 29 13)" />
                      <ellipse cx="45" cy="5" rx="4" ry="2.2" transform="rotate(-20 45 5)" />
                      <ellipse cx="61" cy="13" rx="4.3" ry="2.4" transform="rotate(22 61 13)" />
                      <ellipse cx="77" cy="5" rx="4" ry="2.2" transform="rotate(-24 77 5)" />
                      <ellipse cx="93" cy="13" rx="4.3" ry="2.4" transform="rotate(22 93 13)" />
                      <ellipse cx="109" cy="5" rx="4" ry="2.2" transform="rotate(-20 109 5)" />
                      <ellipse cx="126" cy="12" rx="4" ry="2.2" transform="rotate(20 126 12)" />
                    </svg>
                  </span>
                  <span className="tiendaSaludoLabel">Bienvenido</span>
                  <strong className="tiendaSaludoNombre">{nombreClienteHeader}</strong>
                </span>
                <span className="tiendaSaludoIcono" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                    <circle cx="12" cy="8" r="4.2" />
                    <path d="M4.5 19.5c0-3.8 3.3-6.4 7.5-6.4s7.5 2.6 7.5 6.4" />
                  </svg>
                </span>
                {totalNoLeidasCliente > 0 && <span className="tiendaPerfilBtnCount">{totalNoLeidasCliente}</span>}
              </button>
            </>
          )}
          <button className="tiendaCartBtn" onClick={abrirCarrito} aria-label="Abrir carrito">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="9" cy="19" r="1.75" />
              <circle cx="17" cy="19" r="1.75" />
              <path d="M3.5 5h2.1l1.85 8.1a1 1 0 0 0 .98.78h8.25a1 1 0 0 0 .97-.76l1.45-5.62H7.1" />
            </svg>
            {carrito.length > 0 && <span className="tiendaCartCount">{carrito.length}</span>}
          </button>
        </div>
      </div>
      )}

      {!esVistaTrastienda && (
        <div
          className={mostrarMenuMovil ? 'tiendaMenuMovilOverlay tiendaSoloMovil abierta' : 'tiendaMenuMovilOverlay tiendaSoloMovil'}
          onClick={() => setMostrarMenuMovil(false)}
          aria-hidden={!mostrarMenuMovil}
        >
          <aside
            className={mostrarMenuMovil ? 'tiendaMenuMovilPanel abierta' : 'tiendaMenuMovilPanel'}
            role="dialog"
            aria-modal="true"
            aria-label="Menú móvil"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="tiendaMenuMovilHeader">
              {!clienteToken ? (
                <button
                  type="button"
                  className="tiendaMenuMovilCuentaBtn"
                  onClick={abrirSesionCliente}
                >
                  <span className="tiendaMenuMovilCuentaIcono" aria-hidden="true">
                    <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                      <circle cx="12" cy="8" r="4.2" />
                      <path d="M4.5 19.5c0-3.8 3.3-6.4 7.5-6.4s7.5 2.6 7.5 6.4" />
                    </svg>
                  </span>
                  <span className="tiendaMenuMovilCuentaTexto">
                    <span className="tiendaMenuMovilCuentaLabel">Bienvenido</span>
                    <strong className="tiendaMenuMovilCuentaNombre">Inicia sesión</strong>
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className="tiendaMenuMovilCuentaBtn"
                  onClick={abrirPerfilCliente}
                >
                  <span className="tiendaMenuMovilCuentaIcono" aria-hidden="true">
                    <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                      <circle cx="12" cy="8" r="4.2" />
                      <path d="M4.5 19.5c0-3.8 3.3-6.4 7.5-6.4s7.5 2.6 7.5 6.4" />
                    </svg>
                  </span>
                  <span className="tiendaMenuMovilCuentaTexto">
                    <span className="tiendaMenuMovilCuentaLabel">Bienvenido</span>
                    <strong className="tiendaMenuMovilCuentaNombre">{nombreClienteHeader}</strong>
                  </span>
                </button>
              )}
              <button
                type="button"
                className="tiendaMenuMovilCerrar"
                onClick={() => setMostrarMenuMovil(false)}
                aria-label="Cerrar menú móvil"
              >
                ×
              </button>
            </div>

            <div className="tiendaMenuMovilBody">
              <div className="tiendaMenuMovilAcciones">
                {mostrarAccesoRapidoPwa && typeof onActivarAccesoRapidoPwa === 'function' && (
                  <button
                    type="button"
                    className="tiendaMenuMovilAccion"
                    onClick={() => {
                      setMostrarMenuMovil(false);
                      onActivarAccesoRapidoPwa();
                    }}
                  >
                    Acceso rápido
                  </button>
                )}
              </div>

              {vistaActiva === 'tienda' && (
                <section className="tiendaMenuMovilSeccion" aria-label="Categorías móviles">
                  <h3>Categorías</h3>
                  <div className="tiendaMenuMovilLista">
                    <button
                      type="button"
                      className={seccionActiva !== 'favoritos' && categoriaActiva === 'todas'
                        ? 'tiendaMenuMovilCategoriaBtn activa'
                        : 'tiendaMenuMovilCategoriaBtn'}
                      onClick={() => abrirCategoriaDesdeMenuMovil('todas')}
                    >
                      <span>Todos los productos</span>
                      <span className="tiendaMenuMovilFlecha" aria-hidden="true">›</span>
                    </button>
                    {categoriasTarjetas.map((categoria) => (
                      <button
                        key={`menu-${categoria.key}`}
                        type="button"
                        className={categoriaActiva === categoria.key ? 'tiendaMenuMovilCategoriaBtn activa' : 'tiendaMenuMovilCategoriaBtn'}
                        onClick={() => abrirCategoriaDesdeMenuMovil(categoria.key)}
                      >
                        <span>{categoria.label}</span>
                        <span className="tiendaMenuMovilFlecha" aria-hidden="true">›</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      className={seccionActiva === 'favoritos'
                        ? 'tiendaMenuMovilCategoriaBtn tiendaMenuMovilCategoriaBtnFavoritos activa'
                        : 'tiendaMenuMovilCategoriaBtn tiendaMenuMovilCategoriaBtnFavoritos'}
                      onClick={abrirFavoritosDesdeMenuMovil}
                    >
                      <span>Favoritos</span>
                      <span className="tiendaMenuMovilFlecha" aria-hidden="true">›</span>
                    </button>
                  </div>
                </section>
              )}
            </div>
          </aside>
        </div>
      )}

      {!esVistaTrastienda && clienteToken && mostrarPromptNotificacionesPedidos && (
        <div className="tiendaNotifPedidosInline">
          <span>Activa notificaciones para recibir cambios de estatus de tus pedidos.</span>
          <button type="button" className="botonPequeno botonExito" onClick={habilitarNotificacionesPedidosCliente}>
            Activar
          </button>
        </div>
      )}

      <div className={esVistaTrastienda ? 'tiendaGrid tiendaGridAdminFull' : 'tiendaGrid'}>
      {!esVistaTrastienda && vistaActiva === 'tienda' && (
      <section className="tarjeta tiendaCatalogo">
        <div className="tiendaHeader">
          <h2>VITRINA</h2>
        </div>

        {cargando ? (
          <div className="tiendaVacio">Cargando productos...</div>
        ) : (
          <>
            {mostrandoVistaCategorias ? (
            <div className="tiendaCategoriasVista">
              <aside className="tiendaCategoriasSidebarFina" aria-label="Categorías">
                <button
                  type="button"
                  className={seccionActiva !== 'favoritos' && categoriaActiva === 'todas' ? 'tiendaCategoriaSidebarBtn activa' : 'tiendaCategoriaSidebarBtn'}
                  onClick={() => {
                    setSeccionActiva(seccionCatalogoPrincipal);
                    entrarCategoriaDesdeVista('todas');
                  }}
                >
                  Todos los productos
                </button>
                {categoriasTarjetas.map((categoria) => (
                  <button
                    key={categoria.key}
                    type="button"
                    className={categoriaActiva === categoria.key ? 'tiendaCategoriaSidebarBtn activa' : 'tiendaCategoriaSidebarBtn'}
                    onClick={() => entrarCategoriaDesdeVista(categoria.key)}
                  >
                    {categoria.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={seccionActiva === 'favoritos' ? 'tiendaCategoriaSidebarBtn tiendaCategoriaSidebarBtnFavoritos activa' : 'tiendaCategoriaSidebarBtn tiendaCategoriaSidebarBtnFavoritos'}
                  onClick={() => {
                    setSeccionActiva('favoritos');
                    setCategoriaActiva('todas');
                  }}
                >
                  Favoritos
                </button>
              </aside>

              <div className="tiendaCategoriasCardsGrid">
                {(categoriasTarjetasVisibles.length ? categoriasTarjetasVisibles : categoriasTarjetas).map((categoria) => (
                  <button
                    key={`card-${categoria.key}`}
                    type="button"
                    className={[
                      'tiendaCategoriaVisualCard',
                      categoriaActiva === categoria.key ? 'activa' : '',
                      categoriaEntrandoKey === categoria.key ? 'entrando' : '',
                      categoria.key === categoriaFlashKey ? 'flash' : ''
                    ].filter(Boolean).join(' ')}
                    onClick={(e) => {
                      setCategoriaFlashKey(categoria.key);
                      setTimeout(() => setCategoriaFlashKey(''), 180);
                      entrarCategoriaDesdeVista(categoria.key, e.currentTarget, categoria);
                    }}
                    aria-label={`Abrir categoría ${categoria.label}`}
                  >
                    {categoria.imageUrl ? (
                      <img src={categoria.imageUrl} alt={categoria.label} className="tiendaCategoriaVisualImg" />
                    ) : (
                      <div className="tiendaCategoriaVisualPlaceholder">{categoria.label}</div>
                    )}
                    <span className="tiendaCategoriaVisualCapa"></span>
                    <span className="tiendaCategoriaVisualTitulo">{categoria.label}</span>
                  </button>
                ))}
              </div>
            </div>
            ) : (
              <div className="tiendaVistaCategoriaAcciones">
                <button
                  type="button"
                  className="tiendaCategoriaVolverBtn"
                  onClick={() => {
                    if (seccionActiva === 'favoritos' && categoriaActiva === 'todas') {
                      setSeccionActiva(seccionCatalogoPrincipal);
                      setCategoriaActiva('todas');
                      return;
                    }
                    entrarCategoriaDesdeVista('todas');
                  }}
                >
                  {seccionActiva === 'favoritos' && categoriaActiva === 'todas' ? '← Volver a vitrina' : '← Volver a categorías'}
                </button>
              </div>
            )}

            {mostrandoVistaCategorias ? null : (
            <div key={`productos-${categoriaActiva}`} className={animandoEntradaCategoria ? 'tiendaProductos tiendaProductosEntrada' : 'tiendaProductos'}>
              {productosFiltrados.map((producto) => {
                const variantes = normalizarVariantes(producto?.variantes);
                const varianteActiva = variantes.find((v) => Boolean(v?.disponible)) || variantes[0] || null;
                const disponible = varianteActiva ? Boolean(varianteActiva?.disponible) : ((Number(producto?.stock) || 0) > 0);
                const precioFicha = Number(producto?.tienda_precio_publico) || 0;
                const tienePrecioConfigurado = precioFicha > 0;
                const categoriaProducto = String(producto?.categoria_nombre || '').trim() || 'Sin categoría';
                const totalResenas = Number(producto?.resenas_total) || 0;
                const promedioResenas = Number(producto?.resenas_promedio) || 0;
                const hojitas = pintarHojitas(promedioResenas);
                const identificadorFavorito = obtenerIdentificadorFavoritoProducto(producto);
                const favoritoActivo = identificadorFavorito ? favoritosVitrinaSet.has(identificadorFavorito) : false;
                const burstFavoritoActivo = identificadorFavorito && favoritoBurst.id === identificadorFavorito
                  ? favoritoBurst.nonce
                  : 0;
                return (
                  <article key={producto.slug || producto.nombre_receta} className="tiendaProductoCard">
                    <button
                      type="button"
                      className={favoritoActivo ? 'tiendaFavoritoBtn activa' : 'tiendaFavoritoBtn'}
                      onClick={() => toggleFavoritoProducto(producto)}
                      aria-label={favoritoActivo ? `Quitar ${producto.nombre_receta} de favoritos` : `Agregar ${producto.nombre_receta} a favoritos`}
                      title={favoritoActivo ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                    >
                      {burstFavoritoActivo ? (
                        <span key={`burst-${burstFavoritoActivo}`} className="tiendaFavoritoBurst" aria-hidden="true">
                          <span className="tiendaFavoritoBurstPart">♥</span>
                          <span className="tiendaFavoritoBurstPart">♥</span>
                          <span className="tiendaFavoritoBurstPart">♥</span>
                          <span className="tiendaFavoritoBurstPart">♥</span>
                          <span className="tiendaFavoritoBurstPart">♥</span>
                        </span>
                      ) : null}
                      <span className="tiendaFavoritoIcono" aria-hidden="true">♥</span>
                    </button>
                    <div className="tiendaImagenWrap">
                      {producto?.image_url ? (
                        esUrlVideoTienda(producto.image_url) ? (
                          <video
                            src={producto.image_url}
                            className="tiendaImagen"
                            autoPlay
                            muted
                            loop
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <img src={producto.image_url} alt={producto.nombre_receta} className="tiendaImagen" />
                        )
                      ) : (
                        <div className="tiendaImagenPlaceholder">Sin imagen</div>
                      )}
                    </div>
                    <div className="tiendaShareIconRow">
                      <button
                        type="button"
                        className="tiendaShareIconBtn"
                        onClick={() => compartirProducto(producto)}
                        aria-label={`Compartir ${producto.nombre_receta}`}
                        title="Compartir"
                      >
                        <svg viewBox="0 0 24 24" role="presentation" focusable="false" aria-hidden="true">
                          <path d="M18 16a3 3 0 0 0-2.29 1.06l-6.72-3.36a3.14 3.14 0 0 0 0-1.4l6.72-3.36A3 3 0 1 0 15 7a3.2 3.2 0 0 0 .03.41L8.3 10.77a3 3 0 1 0 0 2.46l6.73 3.36A3 3 0 1 0 18 16z" />
                        </svg>
                      </button>
                    </div>
                    <div className="tiendaCategoriaBadge">{categoriaProducto}</div>
                    <h3>{producto.nombre_receta}</h3>
                    <div className={totalResenas > 0 ? 'tiendaCalificacionCard' : 'tiendaCalificacionCard sinTexto'} title={totalResenas ? `${promedioResenas.toFixed(1)} de 5` : 'Sin calificaciones'}>
                      <div className="tiendaHojitasFila">
                        {hojitas.map((activa, idx) => (
                          <span key={`hojita-${producto.nombre_receta}-${idx}`} className={activa ? 'tiendaHojita activa' : 'tiendaHojita'}>🍃</span>
                        ))}
                      </div>
                      {totalResenas > 0 && (
                        <span className="tiendaCalificacionTxt">
                          {totalResenas >= 5
                            ? `${promedioResenas.toFixed(1)} / 5`
                            : `${totalResenas} calificaciones`}
                        </span>
                      )}
                    </div>
                    {!!variantes.length && (
                      <div className="tiendaVariantes tiendaVariantesCard">
                        <div className="tiendaVariantesLista">
                          {variantes.map((v) => (
                            <span key={`${producto.nombre_receta}-${v.nombre}`} className="tiendaChipVariante">{v.nombre}</span>
                          ))}
                        </div>
                        <span className={tienePrecioConfigurado ? 'tiendaMetaPrecio tiendaMetaPrecioInline' : 'tiendaMetaSolo tiendaMetaPrecioInline'}>
                          {tienePrecioConfigurado ? precio(precioFicha) : 'Próximamente'}
                        </span>
                      </div>
                    )}
                    {!variantes.length && (
                      <div className="tiendaMeta tiendaMetaFallback">
                        <span className={tienePrecioConfigurado ? 'tiendaMetaPrecio tiendaMetaPrecioInline' : 'tiendaMetaSolo tiendaMetaPrecioInline'}>
                          {tienePrecioConfigurado ? precio(precioFicha) : 'Próximamente'}
                        </span>
                      </div>
                    )}
                    {String(producto.descripcion || '').trim() && (
                      <p className="tiendaDescripcion">{producto.descripcion}</p>
                    )}
                    <div className="tiendaCardFooter">
                      <div className="tiendaAccionesCard">
                        <button className="boton" onClick={() => abrirDetalle(producto)}>Ver detalle</button>
                        <button
                          className="boton botonExito"
                          onClick={() => agregarAlCarrito(producto, varianteActiva?.nombre || '')}
                          disabled={!tienePrecioConfigurado}
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
              {!productosFiltrados.length && <div className="tiendaVacio">{seccionActiva === 'favoritos' ? 'Aún no tienes productos favoritos.' : 'No hay productos disponibles.'}</div>}
            </div>
            )}

            {/* Animación de overlay de categoría eliminada por solicitud */}
          </>
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

        <div className="tiendaLateralCuerpo">

        {pasoCheckout === 1 && (
          <div className="tiendaCarritoPaso">
            <div className="tiendaCarritoLista">
              {carrito.map((item) => (
                <div key={item.clave} className="tiendaCarritoItem">
                  <div className="tiendaCarritoInfo">
                    <div className="tiendaCarritoThumb">
                      {item.image_url ? (
                        esUrlVideoTienda(item.image_url) ? (
                          <video
                            src={item.image_url}
                            muted
                            loop
                            autoPlay
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <img src={item.image_url} alt={item.nombre_base || item.nombre_receta} loading="lazy" />
                        )
                      ) : (
                        <span className="tiendaCarritoThumbPlaceholder">Sin foto</span>
                      )}
                    </div>
                    <div>
                      <div className="tiendaCarritoCategoria">{item.categoria_nombre || 'Producto'}</div>
                      <strong className="tiendaCarritoNombre">{item.nombre_base || item.nombre_receta}</strong>
                      {item.variante ? <small> · {item.variante}</small> : null}
                    </div>
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

            <div className="tiendaCheckout tiendaCheckoutPie">
              <div className="tiendaCuponBox">
                <input
                  type="text"
                  placeholder="Cupón"
                  className={estadoInputCupon === 'valido' ? 'tiendaCuponInput valido' : (estadoInputCupon === 'invalido' ? 'tiendaCuponInput invalido' : 'tiendaCuponInput')}
                  value={codigoCuponInput}
                  onChange={(e) => {
                    setCodigoCuponInput(String(e.target.value || '').toUpperCase().replace(/\s+/g, ''));
                    if (estadoInputCupon !== 'neutral') setEstadoInputCupon('neutral');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      aplicarCuponCarrito();
                    }
                  }}
                  disabled={validandoCupon}
                />
                <button type="button" className="botonPequeno" onClick={aplicarCuponCarrito} disabled={validandoCupon || !carrito.length}>
                  {validandoCupon ? 'Validando...' : 'Aplicar'}
                </button>
              </div>
              {cuponesAplicados.length > 0 && (
                <div className="tiendaCuponAplicadoBar">
                  <span>Cupones activos:</span>
                  <div className="tiendaCuponAplicadoLista">
                    {cuponesAplicados.map((cup) => {
                      const codigo = String(cup?.codigo || '').trim().toUpperCase();
                      return (
                        <span key={codigo} className="tiendaCuponAplicadoChip">
                          <strong>{codigo}</strong>
                          <button type="button" className="botonPequeno botonDanger" onClick={() => quitarCuponCarrito(codigo)}>
                            Quitar
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="tiendaCheckoutTotales">
                <span>Subtotal: <strong>{precio(subtotalCarrito)}</strong></span>
                {cuponesAplicados.length > 0 && (
                  <span>
                    Descuento ({cuponesAplicados.map((cup) => String(cup?.codigo || '').trim().toUpperCase()).join(' + ')}):
                    <strong> -{precio(descuentoCuponCarrito)}</strong>
                  </span>
                )}
                <span className="tiendaCheckoutTotalFinal">Total: <strong>{precio(totalCarrito)}</strong></span>
              </div>
              <button type="button" className="boton botonExito" onClick={continuarPasoEntrega}>
                Continuar con la entrega
              </button>
            </div>
          </div>
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
              <div className="tiendaCheckoutResumenFilas">
                <span>Subtotal:</span>
                <strong>{precio(subtotalCarrito)}</strong>
              </div>
              {cuponesAplicados.length > 0 && (
                <div className="tiendaCheckoutResumenFilas">
                  <span>Descuento ({cuponesAplicados.map((cup) => String(cup?.codigo || '').trim().toUpperCase()).join(' + ')}):</span>
                  <strong>-{precio(descuentoCuponCarrito)}</strong>
                </div>
              )}
              <div className="tiendaCheckoutResumenFilas tiendaCheckoutResumenTotal">
                <span>Total a pagar:</span>
                <strong>{precio(totalCarrito)}</strong>
              </div>
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
        </div>
      </section>
      )}

      {(esVistaTrastienda || vistaActiva === 'trastienda') && tokenInterno && (
        <section className="tarjeta tiendaCatalogo">
          <div className={puedeEditarTrastienda ? 'tiendaAdminPanel' : 'tiendaAdminPanel soloLectura'}>
            <h3>Panel interno vitrina</h3>

            {!puedeEditarTrastienda && (
              <div className="tiendaAdminSoloLecturaAviso">
                Modo solo lectura activo. Puedes usar filtros y búsquedas, pero no guardar cambios.
              </div>
            )}

            <div className="tiendaAdminTabs">
              {vistasTrastiendaDisponibles.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={adminVista === item.id ? 'tiendaTab activa' : 'tiendaTab'}
                  onClick={() => setAdminVista(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {!vistasTrastiendaDisponibles.length && (
              <div className="tiendaVacio" style={{ marginTop: 12 }}>
                No tienes permisos para ver secciones de Trastienda.
              </div>
            )}

            {adminVista === 'metricas' && (
              <div className="tiendaAdminForm tiendaMetricasWrap">
                <div className="tiendaMetricasHeader">
                  <strong>
                    {metricasSubVista === 'visitas'
                      ? `Resumen de visitas del día ${resumenVisitasAdmin.fecha ? `(${resumenVisitasAdmin.fecha})` : ''}`
                      : `Comportamiento del rango (${historialVisitasAdmin.rangoDias} días)`}
                  </strong>
                  <div className="tiendaMetricasAcciones">
                    <button type="button" className="boton botonSecundario" onClick={abrirVentanaAnalisisMetricas}>
                      Analizar
                    </button>
                    <select
                      value={historialVisitasAdmin.rangoDias}
                      onChange={(event) => {
                        cargarHistorialVisitasAdmin(event.target.value);
                        cargarComportamientoVisitasAdmin(event.target.value);
                      }}
                    >
                      <option value={7}>Últimos 7 días</option>
                      <option value={15}>Últimos 15 días</option>
                      <option value={30}>Últimos 30 días</option>
                      <option value={90}>Últimos 90 días</option>
                    </select>
                    <input
                      type="date"
                      className="tiendaMetricasFechaInput"
                      value={fechaVisitaSeleccionada}
                      onChange={(event) => setFechaVisitaSeleccionada(String(event.target.value || '').trim())}
                    />
                    <button
                      type="button"
                      className="boton"
                      onClick={() => {
                        cargarResumenVisitasAdmin(fechaVisitaSeleccionada);
                        cargarHistorialVisitasAdmin(historialVisitasAdmin.rangoDias);
                        cargarComportamientoVisitasAdmin(historialVisitasAdmin.rangoDias);
                      }}
                      disabled={resumenVisitasAdmin.cargando || historialVisitasAdmin.cargando || comportamientoVisitasAdmin.cargando}
                    >
                      {(resumenVisitasAdmin.cargando || historialVisitasAdmin.cargando || comportamientoVisitasAdmin.cargando) ? 'Actualizando...' : 'Actualizar'}
                    </button>
                    <button
                      type="button"
                      className="boton botonEliminar"
                      onClick={reiniciarMetricasAdmin}
                      disabled={reiniciandoMetricasAdmin}
                    >
                      {reiniciandoMetricasAdmin ? 'Reiniciando...' : 'Reiniciar métricas'}
                    </button>
                  </div>
                </div>

                <div className="tiendaMetricasSubTabs" role="tablist" aria-label="Subsecciones de métricas">
                  <button
                    type="button"
                    className={metricasSubVista === 'visitas' ? 'tiendaMetricasSubTab activa' : 'tiendaMetricasSubTab'}
                    onClick={() => setMetricasSubVista('visitas')}
                  >
                    Visitas
                  </button>
                  <button
                    type="button"
                    className={metricasSubVista === 'comportamiento' ? 'tiendaMetricasSubTab activa' : 'tiendaMetricasSubTab'}
                    onClick={() => setMetricasSubVista('comportamiento')}
                  >
                    Comportamiento
                  </button>
                </div>

                {metricasSubVista === 'visitas' && (
                  <>
                    <div className="tiendaMetricasGrid">
                      <article className="tiendaMetricaCard">
                        <span>Personas activas ahora</span>
                        <strong>{resumenVisitasAdmin.activosAhora}</strong>
                      </article>
                      <article className="tiendaMetricaCard">
                        <span>Visitas únicas de hoy</span>
                        <strong>{resumenVisitasAdmin.visitasDia}</strong>
                      </article>
                      <article className="tiendaMetricaCard">
                        <span>Eventos registrados hoy</span>
                        <strong>{resumenVisitasAdmin.eventosDia}</strong>
                      </article>
                      <article className="tiendaMetricaCard">
                        <span>Horario con más visitas</span>
                        <strong>
                          {resumenVisitasAdmin.horaPico?.hora || '00:00'}
                          {' - '}
                          {String(Math.min(23, (Number(String(resumenVisitasAdmin.horaPico?.hora || '00').slice(0, 2)) || 0))).padStart(2, '0')}:59
                          {' '}
                          ({Number(resumenVisitasAdmin.horaPico?.total) || 0})
                        </strong>
                      </article>
                    </div>

                    <div className="tiendaMetricasResumenLayout">
                      <div className="tiendaMetricasResumenColumna tiendaMetricasResumenColumnaIzquierda">
                        <div className="tiendaMetricasBloque">
                          <h4>Ubicaciones con más visitas hoy</h4>
                          <ul className="tiendaMetricasLista">
                            {(resumenVisitasAdmin.ubicacionesTop || []).map((item, idx) => (
                              <li key={`ubi-top-${idx}-${item?.pais || 'sin-pais'}`}>
                                <span>{item?.ubicacion || item?.pais || 'Desconocido'}</span>
                                <strong>{Number(item?.total) || 0}</strong>
                              </li>
                            ))}
                            {!(resumenVisitasAdmin.ubicacionesTop || []).length && <li><span>Sin datos todavía</span></li>}
                          </ul>
                        </div>

                        <div className="tiendaMetricasBloque">
                          <div className="tiendaMetricasHorasHeader">
                            <h4>Visitas por horario (24 horas)</h4>
                            <div className="tiendaMetricasHorasNavegacion">
                              <button
                                type="button"
                                className="tiendaMetricasHorasFlecha"
                                onClick={() => setPaginaHorasResumen((prev) => Math.max(0, prev - 1))}
                                disabled={paginaHorasResumenSegura <= 0}
                                aria-label="Ver bloque horario anterior"
                              >
                                ◀
                              </button>
                              <span className="tiendaMetricasHorasRango">
                                {etiquetaRangoHorasPagina}
                                {' · '}
                                Pág. {paginaHorasResumenSegura + 1}/{totalPaginasHorasResumen}
                              </span>
                              <button
                                type="button"
                                className="tiendaMetricasHorasFlecha"
                                onClick={() => setPaginaHorasResumen((prev) => Math.min(totalPaginasHorasResumen - 1, prev + 1))}
                                disabled={paginaHorasResumenSegura >= totalPaginasHorasResumen - 1}
                                aria-label="Ver bloque horario siguiente"
                              >
                                ▶
                              </button>
                            </div>
                          </div>
                          <ul className="tiendaMetricasLista tiendaMetricasListaHoras">
                            {horasResumenPaginadas
                              .map((item, idx) => (
                                <li
                                  key={`hora-pag-${idx}-${item?.horaInicio || '00:00'}`}
                                  className={[
                                    item?.esHoraActual ? 'tiendaHoraActual' : '',
                                    item?.esFutura ? 'tiendaHoraFutura' : ''
                                  ].filter(Boolean).join(' ')}
                                >
                                  <span>
                                    {item?.horaInicio || '00:00'} - {item?.horaFin || '00:59'}
                                    {item?.esHoraActual ? ' (hora actual)' : ''}
                                  </span>
                                  <strong>{Number(item?.total) || 0}</strong>
                                </li>
                              ))}
                            {!horasResumenPaginadas.length && <li><span>Sin datos todavía</span></li>}
                          </ul>
                        </div>
                      </div>

                      <div className="tiendaMetricasBloque tiendaMetricasBloqueHistorialCompacto">
                        <div className="tiendaMetricasHorasHeader">
                          <h4>Historial de visitas por semana</h4>
                          <div className="tiendaMetricasHorasNavegacion">
                            <button
                              type="button"
                              className="tiendaMetricasHorasFlecha"
                              onClick={() => setPaginaHistorialSemana((prev) => Math.max(0, prev - 1))}
                              disabled={paginaHistorialSemanaSegura <= 0}
                              aria-label="Ver semana anterior"
                            >
                              ◀
                            </button>
                            <span className="tiendaMetricasHorasRango">
                              {etiquetaHistorialSemana}
                              {' · '}
                              Sem. {paginaHistorialSemanaSegura + 1}/{totalPaginasHistorialSemana}
                            </span>
                            <button
                              type="button"
                              className="tiendaMetricasHorasFlecha"
                              onClick={() => setPaginaHistorialSemana((prev) => Math.min(totalPaginasHistorialSemana - 1, prev + 1))}
                              disabled={paginaHistorialSemanaSegura >= totalPaginasHistorialSemana - 1}
                              aria-label="Ver semana siguiente"
                            >
                              ▶
                            </button>
                          </div>
                        </div>
                        <div className="tiendaHistorialVisitasChart">
                          {(historialSemanaActual?.dias || []).map((item) => {
                            const visitas = Number(item?.visitas) || 0;
                            const ancho = maximoVisitasHistorialSemana > 0
                              ? Math.max(4, Math.round((visitas / maximoVisitasHistorialSemana) * 100))
                              : 0;
                            return (
                              <div className="tiendaHistorialVisitasFila" key={`hist-dia-${item?.fecha || 'sin-fecha'}`}>
                                <span>{item?.fecha || 'Sin fecha'}</span>
                                <div className="tiendaHistorialVisitasBarraWrap">
                                  <div className="tiendaHistorialVisitasBarra" style={{ width: `${ancho}%` }} />
                                </div>
                                <strong>{visitas}</strong>
                              </div>
                            );
                          })}
                          {!(historialSemanaActual?.dias || []).length && <div className="tiendaVacio">Sin historial todavía</div>}
                        </div>
                      </div>
                    </div>

                    <div className="tiendaMetricasBloques">
                      <div className="tiendaMetricasBloque">
                        <h4>Resumen del rango</h4>
                        <ul className="tiendaMetricasLista">
                          <li>
                            <span>Total visitas únicas</span>
                            <strong>{historialVisitasAdmin.totalVisitas}</strong>
                          </li>
                          <li>
                            <span>Total eventos</span>
                            <strong>{historialVisitasAdmin.totalEventos}</strong>
                          </li>
                          <li>
                            <span>Promedio diario</span>
                            <strong>{historialVisitasAdmin.promedioVisitasDia}</strong>
                          </li>
                          <li>
                            <span>Día más fuerte</span>
                            <strong>
                              {historialVisitasAdmin.diaConMasVisitas?.fecha || 'N/A'}
                              {' '}
                              ({Number(historialVisitasAdmin.diaConMasVisitas?.visitas) || 0})
                            </strong>
                          </li>
                        </ul>
                      </div>

                      <div className="tiendaMetricasBloque">
                        <h4>Ubicaciones top del rango</h4>
                        <ul className="tiendaMetricasLista">
                          {(historialVisitasAdmin.topUbicaciones || []).map((item, idx) => (
                            <li key={`ubi-rango-${idx}-${item?.pais || 'sin-pais'}`}>
                              <span>{item?.ubicacion || item?.pais || 'Desconocido'}</span>
                              <strong>{Number(item?.total) || 0}</strong>
                            </li>
                          ))}
                          {!(historialVisitasAdmin.topUbicaciones || []).length && <li><span>Sin datos todavía</span></li>}
                        </ul>
                      </div>
                    </div>
                  </>
                )}

                {metricasSubVista === 'comportamiento' && (
                  <>
                    <div className="tiendaMetricasGrid">
                      <article className="tiendaMetricaCard">
                        <span>Eventos del rango</span>
                        <strong>{comportamientoVisitasAdmin.totalEventos}</strong>
                      </article>
                      <article className="tiendaMetricaCard">
                        <span>Acción más frecuente</span>
                        <strong>
                          {comportamientoVisitasAdmin.topAcciones?.[0]?.accion
                            ? String(comportamientoVisitasAdmin.topAcciones[0].accion).replace(/_/g, ' ')
                            : 'Sin datos'}
                        </strong>
                      </article>
                      <article className="tiendaMetricaCard">
                        <span>Producto más visto/interactivo</span>
                        <strong>
                          {comportamientoVisitasAdmin.topProductos?.[0]?.producto || 'Sin datos'}
                        </strong>
                      </article>
                    </div>

                    <p className="tiendaMetricasAyuda">
                      Eventos registrados: acciones como ver detalle, agregar al carrito, iniciar checkout y enviar WhatsApp.
                    </p>

                    <div className="tiendaMetricasBloques">
                      <div className="tiendaMetricasBloque">
                        <h4>Acciones que más realizan</h4>
                        <ul className="tiendaMetricasLista">
                          {(comportamientoVisitasAdmin.topAcciones || []).map((item, idx) => (
                            <li key={`accion-top-${idx}-${item?.accion || 'accion'}`}>
                              <span>{String(item?.accion || 'accion').replace(/_/g, ' ')}</span>
                              <strong>{Number(item?.total) || 0}</strong>
                            </li>
                          ))}
                          {!(comportamientoVisitasAdmin.topAcciones || []).length && <li><span>Sin datos todavía</span></li>}
                        </ul>
                      </div>

                      <div className="tiendaMetricasBloque">
                        <h4>Productos que más interesan</h4>
                        <ul className="tiendaMetricasLista">
                          {(comportamientoVisitasAdmin.topProductos || []).map((item, idx) => (
                            <li key={`producto-top-${idx}-${item?.producto || 'producto'}`}>
                              <span>{item?.producto || 'Producto'}</span>
                              <strong>{Number(item?.total) || 0}</strong>
                            </li>
                          ))}
                          {!(comportamientoVisitasAdmin.topProductos || []).length && <li><span>Sin datos todavía</span></li>}
                        </ul>
                      </div>
                    </div>
                  </>
                )}

                <div className="tiendaMetricasActualizado">
                  Última actualización: {resumenVisitasAdmin.actualizadoEn ? String(resumenVisitasAdmin.actualizadoEn).replace('T', ' ').slice(0, 19) : 'pendiente'}
                </div>
              </div>
            )}

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
                    {ESTATUS_PEDIDO_OPCIONES.map((estado) => (
                      <option key={`filtro-estado-${estado.value}`} value={estado.value}>{estado.label}</option>
                    ))}
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
              <strong>Configuración de vitrina y atención</strong>
              <div className="tiendaAdminTabs tiendaAdminTabsConfigInternas">
                <button type="button" className={configAdminTab === 'general' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setConfigAdminTab('general')}>General</button>
                <button type="button" className={configAdminTab === 'correos' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setConfigAdminTab('correos')}>Correos</button>
                <button type="button" className={configAdminTab === 'nav' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setConfigAdminTab('nav')}>Navegación</button>
                <button type="button" className={configAdminTab === 'redes' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setConfigAdminTab('redes')}>Redes</button>
                <button type="button" className={configAdminTab === 'links' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => setConfigAdminTab('links')}>Links info</button>
              </div>

              {configAdminTab === 'general' && (
                <>
                  <input
                    placeholder="Texto promoción superior"
                    value={configTiendaAdmin.promo_texto || ''}
                    onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, promo_texto: e.target.value }))}
                  />
                  <div className="tiendaAdminCampos5">
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
                      placeholder="CLABE para transferencias"
                      value={configTiendaAdmin.transferencia_clabe || ''}
                      onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, transferencia_clabe: e.target.value }))}
                    />
                    <input
                      placeholder="WhatsApp (solo números, ej 5212220001111)"
                      value={configTiendaAdmin.whatsapp_numero || ''}
                      onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, whatsapp_numero: e.target.value }))}
                    />
                  </div>
                  <SwitchConTexto
                    checked={configActivo(configTiendaAdmin.footer_pagos_remover_fondo_png, true)}
                    label="Quitar fondo blanco en PNG (logos footer)"
                    onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, footer_pagos_remover_fondo_png: e.target.checked ? '1' : '0' }))}
                  />
                  <span className="tiendaAdminLogosPagoHintWarn">
                    Funciona mejor con fondos blancos lisos. Si el logo ya viene transparente (SVG/PNG), puedes desactivarlo.
                  </span>
                  <div className="tiendaAdminLogosPagoBox">
                    <div className="tiendaAdminLogosPagoHead">
                      <strong>Gestor de logos de pago</strong>
                      <input
                        ref={inputLogoPagoArchivoRef}
                        type="file"
                        accept="image/*,.svg"
                        className="tiendaInputOculto"
                        onChange={subirLogoPagoDesdeComputadora}
                      />
                      <button
                        type="button"
                        className="botonPequeno"
                        onClick={agregarMetodoPagoAdmin}
                      >
                        + Agregar método
                      </button>
                    </div>
                    <div className="tiendaAdminLogosPagoLista">
                      {metodosPagoAdmin.map((metodo) => (
                        <div
                          key={`cfg-metodo-pago-${metodo.id}`}
                          className={dragLogoPagoId === metodo.id ? 'tiendaAdminMetodoPagoFila tiendaAdminDropActiva' : 'tiendaAdminMetodoPagoFila'}
                          onDragEnter={(e) => {
                            e.preventDefault();
                            setDragLogoPagoId(metodo.id);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (dragLogoPagoId !== metodo.id) setDragLogoPagoId(metodo.id);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            setDragLogoPagoId((actual) => (actual === metodo.id ? '' : actual));
                          }}
                          onDrop={(e) => manejarDropLogoPago(e, metodo.id)}
                        >
                          <label className="tiendaAdminMetodoPagoSwitch" title="Mostrar u ocultar en footer">
                            <input
                              type="checkbox"
                              checked={String(metodo?.activo ?? '1') !== '0'}
                              onChange={(e) => editarMetodoPagoAdmin(metodo.id, { activo: e.target.checked ? '1' : '0' })}
                            />
                            <span>{String(metodo?.activo ?? '1') !== '0' ? 'Mostrar' : 'Oculto'}</span>
                          </label>
                          <input
                            value={metodo.label}
                            onChange={(e) => editarMetodoPagoAdmin(metodo.id, { label: e.target.value })}
                            placeholder="Nombre del método"
                          />
                          <button
                            type="button"
                            className="botonPequeno"
                            onClick={() => abrirSelectorLogoMetodoPago(metodo.id)}
                            disabled={subiendoLogoPagoId === metodo.id}
                          >
                            {subiendoLogoPagoId === metodo.id ? 'Subiendo...' : 'Subir imagen'}
                          </button>
                          {String(metodo?.logo_url || '').trim() ? (
                            <div className="tiendaAdminImagenMiniWrap">
                              <img
                                src={String(metodo.logo_url || '').trim()}
                                alt={`Logo ${String(metodo?.label || 'método de pago')}`}
                                className="tiendaAdminImagenMini"
                              />
                              <button
                                type="button"
                                className="botonPequeno botonDanger"
                                onClick={() => editarMetodoPagoAdmin(metodo.id, { logo_url: '' })}
                              >
                                Quitar imagen
                              </button>
                              <span className="tiendaAdminSubtexto">También puedes arrastrar y soltar otra imagen aquí.</span>
                            </div>
                          ) : (
                            <span className="tiendaAdminSubtexto">Sin imagen cargada. Arrastra una imagen aquí o usa el botón de subir.</span>
                          )}
                        </div>
                      ))}
                      {!metodosPagoAdmin.length && (
                        <span className="tiendaAdminLogosPagoHint">No hay logos agregados.</span>
                      )}
                    </div>
                  </div>
                  <textarea
                    placeholder="Texto marca footer"
                    value={configTiendaAdmin.footer_marca_texto || ''}
                    onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, footer_marca_texto: e.target.value }))}
                    rows={2}
                  />
                  <textarea
                    placeholder="Asuntos de atención al cliente (uno por línea)"
                    value={configTiendaAdmin.atencion_asuntos || ''}
                    onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, atencion_asuntos: e.target.value }))}
                    rows={4}
                  />
                  <div className="tiendaAdminHorariosBox">
                    <strong>Horarios de atención</strong>
                    <div className="tiendaAdminHorariosGrid">
                      <div className="tiendaAdminHorarioCard">
                        <label htmlFor="cfgHorarioLunesViernes">Lunes a viernes</label>
                        <input
                          id="cfgHorarioLunesViernes"
                          placeholder="Ej. 09:00 a 18:00"
                          value={configTiendaAdmin.atencion_horario_lunes_viernes || ''}
                          onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, atencion_horario_lunes_viernes: e.target.value }))}
                        />
                      </div>
                      <div className="tiendaAdminHorarioCard">
                        <label htmlFor="cfgHorarioSabado">Sábado</label>
                        <input
                          id="cfgHorarioSabado"
                          placeholder="Ej. 09:00 a 14:00"
                          value={configTiendaAdmin.atencion_horario_sabado || ''}
                          onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, atencion_horario_sabado: e.target.value }))}
                        />
                      </div>
                      <div className="tiendaAdminHorarioCard">
                        <label htmlFor="cfgHorarioDomingo">Domingo</label>
                        <input
                          id="cfgHorarioDomingo"
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

              {configAdminTab === 'correos' && (
                <div className="tiendaAdminLinksWrap tiendaAdminCorreosGrid">
                  <div className="tiendaAdminHorariosBox">
                    <strong>Plantilla: Bienvenida de registro</strong>
                    <input
                      placeholder="Asunto"
                      value={configTiendaAdmin.correo_bienvenida_asunto || ''}
                      onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, correo_bienvenida_asunto: e.target.value }))}
                    />
                    <textarea
                      rows={10}
                      className="tiendaAdminCorreoTextarea"
                      placeholder="Cuerpo"
                      value={configTiendaAdmin.correo_bienvenida_cuerpo || ''}
                      onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, correo_bienvenida_cuerpo: e.target.value }))}
                    />
                    <div className="tiendaAdminSubtexto">Variables sugeridas: {'{{nombre_cliente}}'}, {'{{email_cliente}}'}, {'{{url_tienda}}'}</div>
                  </div>

                  <div className="tiendaAdminHorariosBox">
                    <strong>Plantilla: Confirmación de pedido</strong>
                    <input
                      placeholder="Asunto"
                      value={configTiendaAdmin.correo_confirmacion_asunto || ''}
                      onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, correo_confirmacion_asunto: e.target.value }))}
                    />
                    <textarea
                      rows={12}
                      className="tiendaAdminCorreoTextarea"
                      placeholder="Cuerpo"
                      value={configTiendaAdmin.correo_confirmacion_cuerpo || ''}
                      onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, correo_confirmacion_cuerpo: e.target.value }))}
                    />
                    <div className="tiendaAdminSubtexto">Variables sugeridas: {'{{nombre_cliente}}'}, {'{{folio}}'}, {'{{total}}'}, {'{{metodo_pago}}'}, {'{{clabe_transferencia_linea}}'}, {'{{punto_entrega}}'}, {'{{direccion_entrega}}'}, {'{{detalle_items}}'}</div>
                    <textarea
                      rows={8}
                      className="tiendaAdminCorreoTextarea"
                      placeholder="Cuerpo (contra entrega: efectivo/tarjeta)"
                      value={configTiendaAdmin.correo_confirmacion_cuerpo_contraentrega || ''}
                      onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, correo_confirmacion_cuerpo_contraentrega: e.target.value }))}
                    />
                    <div className="tiendaAdminSubtexto">Variables sugeridas (contra entrega): {'{{nombre_cliente}}'}, {'{{folio}}'}, {'{{total}}'}, {'{{metodo_pago}}'}, {'{{estado_preparacion_linea}}'}, {'{{punto_entrega}}'}, {'{{direccion_entrega}}'}, {'{{detalle_items}}'}</div>
                  </div>

                  <div className="tiendaAdminHorariosBox">
                    <strong>Plantilla: Actualización de estado</strong>
                    <input
                      placeholder="Asunto"
                      value={configTiendaAdmin.correo_estado_asunto || ''}
                      onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, correo_estado_asunto: e.target.value }))}
                    />
                    <textarea
                      rows={12}
                      className="tiendaAdminCorreoTextarea"
                      placeholder="Cuerpo"
                      value={configTiendaAdmin.correo_estado_cuerpo || ''}
                      onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, correo_estado_cuerpo: e.target.value }))}
                    />
                  </div>

                  <div className="tiendaAdminHorariosBox">
                    <strong>Plantilla: Diagnóstico</strong>
                    <input
                      placeholder="Asunto"
                      value={configTiendaAdmin.correo_diagnostico_asunto || ''}
                      onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, correo_diagnostico_asunto: e.target.value }))}
                    />
                    <textarea
                      rows={10}
                      className="tiendaAdminCorreoTextarea"
                      placeholder="Cuerpo"
                      value={configTiendaAdmin.correo_diagnostico_cuerpo || ''}
                      onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, correo_diagnostico_cuerpo: e.target.value }))}
                    />
                    <div className="tiendaAdminSubtexto">Variables sugeridas: {'{{nombre_admin}}'}, {'{{fecha}}'}, {'{{smtp_host}}'}, {'{{smtp_user}}'}, {'{{etiqueta_sufijo}}'}</div>
                    <div className="tiendaAdminSubtexto" style={{ marginTop: '10px' }}>
                      Envía una prueba SMTP para validar que Gmail está configurado correctamente.
                    </div>
                    <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
                      <label htmlFor="cfgCorreoDiagnostico">Correo destino</label>
                      <input
                        id="cfgCorreoDiagnostico"
                        type="email"
                        placeholder="correo@dominio.com"
                        value={correoDiagnosticoDestino}
                        onChange={(e) => setCorreoDiagnosticoDestino(e.target.value)}
                      />
                      <button
                        type="button"
                        className="boton"
                        onClick={enviarDiagnosticoCorreoAdmin}
                        disabled={enviandoCorreoDiagnostico}
                      >
                        {enviandoCorreoDiagnostico ? 'Enviando prueba...' : 'Enviar correo de diagnóstico'}
                      </button>
                    </div>
                  </div>

                  <div className="tiendaAdminHorariosBox tiendaAdminHorariosBoxCampana">
                    <strong>Plantilla: Campaña masiva</strong>
                    <input
                      ref={inputImagenCampanaArchivoRef}
                      type="file"
                      accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime,.mov,.m4v"
                      className="tiendaInputOculto"
                      onChange={subirImagenCampanaDesdeComputadora}
                    />
                    <div className="tiendaAdminCampanaGrid">
                      <div className="tiendaAdminCampanaColumna">
                        <input
                          placeholder="Título de campaña (se usa al enviar)"
                          value={configTiendaAdmin.correo_campana_titulo || ''}
                          onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, correo_campana_titulo: e.target.value }))}
                        />
                        <textarea
                          rows={8}
                          className="tiendaAdminCorreoTextarea"
                          placeholder="Contenido de campaña (se usa al enviar)"
                          value={configTiendaAdmin.correo_campana_contenido || ''}
                          onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, correo_campana_contenido: e.target.value }))}
                        />
                        <div
                          className={arrastrandoImagenCampana ? 'tiendaAdminImagenCampanaDropZone tiendaAdminDropActiva' : 'tiendaAdminImagenCampanaDropZone'}
                          onDragEnter={(e) => {
                            e.preventDefault();
                            setArrastrandoImagenCampana(true);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (!arrastrandoImagenCampana) setArrastrandoImagenCampana(true);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            setArrastrandoImagenCampana(false);
                          }}
                          onDrop={manejarDropImagenCampana}
                        >
                          <div className="tiendaAdminSubtexto">Arrastra y suelta aquí tu imagen, GIF o video promocional, o usa el botón.</div>
                        </div>
                        <div className="tiendaAdminImagenCampanaAcciones">
                          <button
                            type="button"
                            className="boton"
                            onClick={abrirSelectorImagenCampana}
                            disabled={subiendoImagenCampana}
                          >
                            {subiendoImagenCampana ? 'Subiendo multimedia...' : 'Subir multimedia promocional'}
                          </button>
                          {String(configTiendaAdmin?.correo_campana_imagen_url || '').trim() && (
                            <button
                              type="button"
                              className="boton botonDanger"
                              onClick={() => setConfigTiendaAdmin((p) => ({ ...p, correo_campana_imagen_url: '' }))}
                            >
                              Quitar imagen
                            </button>
                          )}
                        </div>
                        {String(configTiendaAdmin?.correo_campana_imagen_url || '').trim() ? (
                          <div className="tiendaAdminImagenCampanaPreviewWrap">
                            {esUrlVideoTienda(String(configTiendaAdmin.correo_campana_imagen_url || '').trim()) ? (
                              <video
                                src={String(configTiendaAdmin.correo_campana_imagen_url || '').trim()}
                                className="tiendaAdminImagenCampanaPreview"
                                autoPlay
                                muted
                                loop
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={String(configTiendaAdmin.correo_campana_imagen_url || '').trim()}
                                alt="Vista previa campaña"
                                className="tiendaAdminImagenCampanaPreview"
                              />
                            )}
                          </div>
                        ) : (
                          <div className="tiendaAdminSubtexto">Sin multimedia promocional cargada</div>
                        )}
                      </div>

                      <div className="tiendaAdminCampanaColumna">
                        <input
                          placeholder="Asunto"
                          value={configTiendaAdmin.correo_campana_asunto || ''}
                          onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, correo_campana_asunto: e.target.value }))}
                        />
                        <textarea
                          rows={12}
                          className="tiendaAdminCorreoTextarea"
                          placeholder="Cuerpo"
                          value={configTiendaAdmin.correo_campana_cuerpo || ''}
                          onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, correo_campana_cuerpo: e.target.value }))}
                        />
                        <div className="tiendaAdminSubtexto">Variables sugeridas: {'{{nombre_cliente}}'}, {'{{titulo_campana}}'}, {'{{contenido_campana}}'}, {'{{url_tienda}}'}, {'{{imagen_campana_url}}'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {configAdminTab === 'nav' && (
                <div className="tiendaAdminNavConfigWrap">
                  <div className="tiendaAdminSwitchGrid">
                    {[
                      { id: 'todos', configKey: 'menu_todos_activo', label: 'Mostrar botón "Todos"', labelCorta: 'Todos', predeterminado: true },
                      { id: 'lanzamientos', configKey: 'menu_lanzamientos_activo', label: 'Mostrar botón "Lanzamientos"', labelCorta: 'Lanzamientos', predeterminado: true },
                      { id: 'favoritos', configKey: 'menu_favoritos_activo', label: 'Mostrar botón "Favoritos"', labelCorta: 'Favoritos', predeterminado: true },
                      { id: 'ofertas', configKey: 'menu_ofertas_activo', label: 'Mostrar botón "Ofertas"', labelCorta: 'Ofertas', predeterminado: true },
                      { id: 'accesorios', configKey: 'menu_accesorios_activo', label: 'Mostrar botón "Accesorios"', labelCorta: 'Accesorios', predeterminado: true },
                      { id: 'menu_categoria', configKey: 'menu_categoria_activo', label: 'Mostrar filtro de categorías', labelCorta: 'Filtro de categorías', predeterminado: true }
                    ]
                      .filter((item) => !tabsBaseEliminadasAdmin.includes(item.id))
                      .map((item) => (
                        <div className="tiendaAdminSwitchRow" key={`nav-base-${item.id}`}>
                          <SwitchConTexto
                            checked={configActivo(configTiendaAdmin[item.configKey], item.predeterminado)}
                            onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, [item.configKey]: e.target.checked ? '1' : '0' }))}
                            label={item.label}
                          />
                          <button
                            type="button"
                            className="botonPequeno botonDanger tiendaAdminDeleteMini"
                            onClick={() => eliminarPestanaBase(item.id, item.configKey, item.labelCorta)}
                          >
                            Eliminar
                          </button>
                        </div>
                      ))}
                  </div>

                  <div className="tiendaAdminNavCustomBox">
                    <div className="tiendaAdminNavCustomHead">
                      <strong>Pestañas personalizadas</strong>
                      <button
                        type="button"
                        className="botonPequeno botonExito"
                        onClick={() => {
                          actualizarTabsNavegacionAdmin((prev) => {
                            const idx = (Array.isArray(prev) ? prev.length : 0) + 1;
                            const id = slugPestanaMenu(`personalizada-${Date.now()}-${idx}`) || `personalizada-${idx}`;
                            return [...(Array.isArray(prev) ? prev : []), {
                              id,
                              label: `Pestaña ${idx}`,
                              categoria: '',
                              activo: true
                            }];
                          });
                        }}
                      >
                        + Nueva pestaña
                      </button>
                    </div>

                    {!tabsNavegacionAdmin.length && (
                      <p className="tiendaAdminNavCustomAyuda">Agrega pestañas para filtrar por categoría en la navegación principal.</p>
                    )}

                    <div className="tiendaAdminNavCustomGrid">
                      {tabsNavegacionAdmin.map((tab, idx) => (
                        <article key={`cfg-tab-nav-${tab.id}`} className="tiendaAdminNavCustomCard">
                          <SwitchConTexto
                            checked={Boolean(tab?.activo)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              actualizarTabsNavegacionAdmin((prev) => prev.map((item, i) => (
                                i === idx ? { ...item, activo: checked } : item
                              )));
                            }}
                            label={'Pestaña activa'}
                          />
                          <input
                            placeholder="Nombre de pestaña"
                            value={String(tab?.label || '')}
                            onChange={(e) => {
                              const value = e.target.value;
                              actualizarTabsNavegacionAdmin((prev) => prev.map((item, i) => (
                                i === idx ? { ...item, label: value } : item
                              )));
                            }}
                          />
                          <select
                            value={String(tab?.categoria || '')}
                            onChange={(e) => {
                              const value = e.target.value;
                              actualizarTabsNavegacionAdmin((prev) => prev.map((item, i) => (
                                i === idx ? { ...item, categoria: value } : item
                              )));
                            }}
                          >
                            <option value="">Selecciona categoría</option>
                            {categoriasDisponibles.map((categoria) => (
                              <option key={`cfg-tab-nav-cat-${tab.id}-${categoria}`} value={categoria}>{categoria}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="botonPequeno botonDanger"
                            onClick={() => eliminarPestanaPersonalizadaAdmin(idx, tab.label || tab.labelCorta || '')}
                          >
                            Eliminar
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>
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
                      className="tiendaAdminLinkTextarea"
                      placeholder={'Contenido que verá el cliente en esta sección'}
                      value={configTiendaAdmin[`info_link_${infoLinkAdminTab}_texto`] || ''}
                      onChange={(e) => setConfigTiendaAdmin((p) => ({ ...p, [`info_link_${infoLinkAdminTab}_texto`]: e.target.value }))}
                      rows={12}
                    />
                  </div>
                </div>
              )}

              {configAdminTab === 'correos' ? (
                <div className="tiendaAdminAccionesCorreoFila">
                  <button
                    className="boton"
                    type="button"
                    onClick={abrirVistaPreviaCorreoAdmin}
                    disabled={cargandoPreviewCorreo}
                  >
                    {cargandoPreviewCorreo ? 'Generando vista previa...' : 'Vista previa del correo'}
                  </button>
                  <button
                    className="boton botonExito"
                    type="button"
                    onClick={enviarCorreoMasivoAdmin}
                    disabled={enviandoCorreoMasivo}
                  >
                    {enviandoCorreoMasivo ? 'Enviando campaña...' : 'Enviar correo masivo'}
                  </button>
                  <button className="boton botonExito" type="button" onClick={guardarConfigTiendaAdmin}>Guardar configuración</button>
                </div>
              ) : (
                <button className="boton botonExito" type="button" onClick={guardarConfigTiendaAdmin}>Guardar configuración</button>
              )}
            </div>
            )}

            {adminVista === 'catalogo' && (
            <div className="tiendaAdminForm">
              <input
                ref={inputImagenCategoriaArchivoRef}
                type="file"
                accept="image/*"
                className="tiendaInputOculto"
                onChange={subirImagenCategoriaDesdeComputadora}
              />

              <strong>Clasificación de productos (vitrina)</strong>
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

              <div className="tiendaAdminCategoriasImagenes">
                <div className="tiendaAdminCategoriasImagenesHead">
                  <strong>Imagen por categoría</strong>
                  {cargandoCategoriasAdmin && <span className="tiendaAdminSubtexto">Cargando categorías...</span>}
                </div>
                <div className="tiendaAdminCategoriasImagenesGrid">
                  {(Array.isArray(categoriasAdmin) ? categoriasAdmin : []).map((categoria) => {
                    const idCat = Number(categoria?.id) || 0;
                    const imageUrl = String(categoria?.image_url || '').trim();
                    const subiendo = subiendoImagenCategoriaId === idCat;
                    return (
                      <div key={`cat-img-${idCat}`} className="tiendaAdminCategoriaImagenCard">
                        <div className="tiendaAdminCategoriaImagenTitulo">{categoria?.nombre || 'Categoría'}</div>
                        {imageUrl ? (
                          <img src={imageUrl} alt={categoria?.nombre || 'Categoría'} className="tiendaAdminCategoriaImagenPreview" />
                        ) : (
                          <div className="tiendaAdminCategoriaImagenPlaceholder">Sin imagen</div>
                        )}
                        <div className="tiendaAdminCategoriaImagenAcciones">
                          <button
                            type="button"
                            className="botonPequeno"
                            onClick={() => abrirSelectorImagenCategoria(idCat)}
                            disabled={subiendo}
                          >
                            {subiendo ? 'Subiendo...' : 'Subir imagen'}
                          </button>
                          <button
                            type="button"
                            className="botonPequeno botonDanger"
                            onClick={() => quitarImagenCategoriaAdmin(idCat)}
                            disabled={subiendo || !imageUrl}
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
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

            {adminVista === 'descuentos' && (
            <div className="tiendaAdminForm">
              <strong>Descuentos</strong>
              <div className="tiendaVacio" style={{ marginBottom: '8px' }}>
                Descuento redondeado hacia abajo al peso entero.
              </div>

              <div className="tiendaAdminTabs tiendaAdminTabsConfigInternas" style={{ marginBottom: '10px' }}>
                <button type="button" className={descuentoTabInterna === 'general' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => cambiarDescuentoTab('general')}>General</button>
                <button type="button" className={descuentoTabInterna === 'categorias' ? 'tiendaTab activa' : 'tiendaTab'} onClick={() => cambiarDescuentoTab('categorias')}>Por categoría</button>
              </div>

              {descuentoTabInterna === 'general' && (() => {
                const controlGlobal = obtenerControlDescuento('global', '__all__');
                const keyGlobal = claveDraftDescuento('global', '__all__');
                return (
                  <div className="tiendaDescuentoPanel">
                    <div className="tiendaDescuentoRow tiendaDescuentoRowGlobal">
                      <strong>Descuento general para todos los productos</strong>
                      <label className="tiendaSwitchCard tiendaSwitchToggle tiendaSwitchSoloIcono" title="Activar descuento general">
                        <input
                          type="checkbox"
                          checked={Boolean(controlGlobal.activo)}
                          onChange={(e) => actualizarControlDescuento('global', '__all__', { activo: e.target.checked })}
                        />
                        <span className="tiendaSwitchSlider" />
                      </label>
                      <input
                        className="tiendaDescuentoInput"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="95"
                        step="0.1"
                        value={Number(controlGlobal.porcentaje || 0) > 0 ? String(Number(controlGlobal.porcentaje || 0)) : ''}
                        disabled={!controlGlobal.activo}
                        onChange={(e) => {
                          const valor = Math.max(0, Math.min(95, Number(e.target.value) || 0));
                          actualizarControlDescuento('global', '__all__', { porcentaje: valor });
                        }}
                      />
                      <button
                        className="botonPequeno"
                        type="button"
                        disabled={guardandoDescuentoClave === keyGlobal}
                        onClick={() => guardarDescuento('global', '__all__', controlGlobal.activo, controlGlobal.porcentaje)}
                      >
                        {guardandoDescuentoClave === keyGlobal ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>

                    <details className="tiendaDescuentoExclusionMenu">
                      <summary>Excluir recetas del descuento general</summary>
                      <div className="tiendaDescuentoExclusionBody">
                        <input
                          type="text"
                          placeholder="Buscar receta para excluir..."
                          value={filtroExclusionGlobal}
                          onChange={(e) => setFiltroExclusionGlobal(e.target.value)}
                        />
                        <div className="tiendaDescuentoExclusionLista">
                          {productosExclusionGlobal.map((producto) => {
                            const nombre = String(producto?.nombre_receta || '').trim();
                            const categoria = String(producto?.categoria_nombre || '').trim() || 'Sin categoría';
                            const controlExclusion = obtenerControlDescuento('global_exclusion', nombre);
                            const keyExclusion = claveDraftDescuento('global_exclusion', nombre);
                            return (
                              <div key={`desc-exclusion-${nombre}`} className="tiendaDescuentoExclusionItem">
                                <div>
                                  <strong>{nombre}</strong>
                                  <span>{categoria}</span>
                                </div>
                                <label className="tiendaSwitchCard tiendaSwitchToggle tiendaSwitchSoloIcono" title={`Excluir ${nombre}`}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(controlExclusion.activo)}
                                    disabled={guardandoDescuentoClave === keyExclusion}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      actualizarControlDescuento('global_exclusion', nombre, { activo: checked, porcentaje: 0 });
                                      guardarDescuento('global_exclusion', nombre, checked, 0);
                                    }}
                                  />
                                  <span className="tiendaSwitchSlider" />
                                </label>
                              </div>
                            );
                          })}
                          {!productosExclusionGlobal.length && <div className="tiendaVacio">No hay recetas para ese filtro.</div>}
                        </div>
                      </div>
                    </details>
                  </div>
                );
              })()}

              {descuentoTabInterna === 'categorias' && (
                <div className="tiendaDescuentoPanel">
                  <div className="tiendaAdminTabs tiendaAdminTabsConfigInternas tiendaDescuentoCategoriasTabs">
                    {categoriasDescuento.map((categoria) => {
                      const categoriaValue = String(categoria || '').toLowerCase();
                      return (
                        <button
                          key={`tab-desc-categoria-${categoria}`}
                          type="button"
                          className={descuentoCategoriaActiva === categoriaValue ? 'tiendaTab activa' : 'tiendaTab'}
                          onClick={() => cambiarDescuentoCategoria(categoriaValue)}
                        >
                          {categoria}
                        </button>
                      );
                    })}
                  </div>

                  {!!categoriasDescuento.length && (() => {
                    const categoriaSeleccionada = categoriasDescuento.find((categoria) => String(categoria || '').toLowerCase() === String(descuentoCategoriaActiva || '').toLowerCase()) || categoriasDescuento[0];
                    const controlCategoria = obtenerControlDescuento('categoria', categoriaSeleccionada);
                    const keyCategoria = claveDraftDescuento('categoria', categoriaSeleccionada);

                    return (
                      <>
                        <div className="tiendaDescuentoRow tiendaDescuentoRowCategoria">
                          <strong>{categoriaSeleccionada}</strong>
                          <label className="tiendaSwitchCard tiendaSwitchToggle tiendaSwitchSoloIcono" title={`Activar descuento en ${categoriaSeleccionada}`}>
                            <input
                              type="checkbox"
                              checked={Boolean(controlCategoria.activo)}
                              onChange={(e) => actualizarControlDescuento('categoria', categoriaSeleccionada, { activo: e.target.checked })}
                            />
                            <span className="tiendaSwitchSlider" />
                          </label>
                          <input
                            className="tiendaDescuentoInput"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="95"
                            step="0.1"
                            value={Number(controlCategoria.porcentaje || 0) > 0 ? String(Number(controlCategoria.porcentaje || 0)) : ''}
                            disabled={!controlCategoria.activo}
                            onChange={(e) => {
                              const valor = Math.max(0, Math.min(95, Number(e.target.value) || 0));
                              actualizarControlDescuento('categoria', categoriaSeleccionada, { porcentaje: valor });
                            }}
                          />
                          <button
                            className="botonPequeno"
                            type="button"
                            disabled={guardandoDescuentoClave === keyCategoria}
                            onClick={() => guardarDescuento('categoria', categoriaSeleccionada, controlCategoria.activo, controlCategoria.porcentaje)}
                          >
                            {guardandoDescuentoClave === keyCategoria ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>

                        <div className="tiendaDescuentoFiltroProductos">
                          <input
                            type="text"
                            placeholder="Buscar producto en esta categoría..."
                            value={filtroDescuentoProducto}
                            onChange={(e) => setFiltroDescuentoProducto(e.target.value)}
                          />
                        </div>

                        <div className="tiendaDescuentoListaProductos">
                          {productosCategoriaDescuento.map((producto) => {
                            const nombre = String(producto?.nombre_receta || '').trim();
                            const controlProducto = obtenerControlDescuento('producto', nombre);
                            const keyProducto = claveDraftDescuento('producto', nombre);
                            return (
                              <div key={`desc-prod-${nombre}`} className="tiendaDescuentoRow tiendaDescuentoRowProducto">
                                <span className="tiendaDescuentoProductoNombre">{nombre}</span>
                                <label className="tiendaSwitchCard tiendaSwitchToggle tiendaSwitchSoloIcono" title={`Activar descuento para ${nombre}`}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(controlProducto.activo)}
                                    onChange={(e) => actualizarControlDescuento('producto', nombre, { activo: e.target.checked })}
                                  />
                                  <span className="tiendaSwitchSlider" />
                                </label>
                                <input
                                  className="tiendaDescuentoInput"
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  max="95"
                                  step="0.1"
                                  value={Number(controlProducto.porcentaje || 0) > 0 ? String(Number(controlProducto.porcentaje || 0)) : ''}
                                  disabled={!controlProducto.activo}
                                  onChange={(e) => {
                                    const valor = Math.max(0, Math.min(95, Number(e.target.value) || 0));
                                    actualizarControlDescuento('producto', nombre, { porcentaje: valor });
                                  }}
                                />
                                <button
                                  className="botonPequeno"
                                  type="button"
                                  disabled={guardandoDescuentoClave === keyProducto}
                                  onClick={() => guardarDescuento('producto', nombre, controlProducto.activo, controlProducto.porcentaje)}
                                >
                                  {guardandoDescuentoClave === keyProducto ? 'Guardando...' : 'Guardar'}
                                </button>
                              </div>
                            );
                          })}
                          {!productosCategoriaDescuento.length && <div className="tiendaVacio">No hay productos para ese filtro en esta categoría.</div>}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
            )}

            {adminVista === 'cupones' && (
            <div className="tiendaAdminForm tiendaCuponesAdminWrap">
              <strong>Cupones de checkout</strong>
              <div className="tiendaVacio" style={{ marginBottom: '8px' }}>
                Crea cupones generales o de influencer con vigencia, límites de uso y seguimiento de ventas.
              </div>

              <div className="tiendaCuponesResumenGrid">
                <article className="tiendaCuponResumenCard"><span>Cupones</span><strong>{resumenCuponesAdmin.cupones_totales}</strong></article>
                <article className="tiendaCuponResumenCard"><span>Activos</span><strong>{resumenCuponesAdmin.cupones_activos}</strong></article>
                <article className="tiendaCuponResumenCard"><span>Usos</span><strong>{resumenCuponesAdmin.usos_totales}</strong></article>
                <article className="tiendaCuponResumenCard"><span>Productos vendidos</span><strong>{resumenCuponesAdmin.productos_vendidos_totales}</strong></article>
                <article className="tiendaCuponResumenCard"><span>Ventas</span><strong>{precio(resumenCuponesAdmin.ventas_totales)}</strong></article>
                <article className="tiendaCuponResumenCard"><span>Descuentos</span><strong>{precio(resumenCuponesAdmin.descuentos_totales)}</strong></article>
              </div>

              <div className="tiendaCuponesListaCard">
                <div className="tiendaCuponesListaHead">
                  <strong>Cupones registrados ({cuponesAdmin.length})</strong>
                  <div className="tiendaCuponesListaAcciones">
                    <button className="botonPequeno botonExito" type="button" onClick={() => abrirModalCuponAdmin(null)}>
                      + Nuevo cupón
                    </button>
                    <button className="botonPequeno" type="button" onClick={() => { cargarCuponesAdmin(); cargarHistorialCuponesAdmin(); }}>
                      Refrescar
                    </button>
                  </div>
                </div>
                <div className="tiendaCuponesListaTabla">
                  {(cuponesAdmin || []).map((cupon) => (
                    <article key={`admin-cupon-${cupon.id}-${cupon.codigo}`} className="tiendaCuponFila">
                      <div>
                        <strong>{cupon.codigo}</strong>
                        <div className="tiendaAdminSubtexto">
                          {cupon.nombre || 'Sin nombre'} · {cupon.tipo === 'influencer' ? 'Influencer' : 'General'} · {cupon.alcance_tipo || 'todos'}
                        </div>
                        {!!cupon.influencer_nombre && (
                          <div className="tiendaAdminSubtexto">{cupon.influencer_nombre}{cupon.influencer_handle ? ` (${cupon.influencer_handle})` : ''}</div>
                        )}
                        {!!cupon.alcance_clave && <div className="tiendaAdminSubtexto">Alcance: {cupon.alcance_clave}</div>}
                      </div>
                      <div className="tiendaCuponFilaStats">
                        <span>Usos: <strong>{Number(cupon?.estadistica?.usos) || 0}</strong></span>
                        <span>Productos: <strong>{Number(cupon?.estadistica?.productos_vendidos) || 0}</strong></span>
                        <span>Ventas: <strong>{precio(Number(cupon?.estadistica?.total_ventas) || 0)}</strong></span>
                        <span>Descuento: <strong>{precio(Number(cupon?.estadistica?.descuento_total) || 0)}</strong></span>
                      </div>
                      <div className="tiendaCuponFilaAcciones">
                        <SwitchConTexto
                          checked={Number(cupon?.activo) === 1}
                          label={Number(cupon?.activo) === 1 ? 'Activo' : 'Inactivo'}
                          onChange={(e) => cambiarActivoCuponAdmin(cupon, e.target.checked)}
                          ariaLabel={`Activar o desactivar cupón ${cupon.codigo}`}
                        />
                        <button
                          type="button"
                          className="botonPequeno"
                          disabled={actualizandoActivoCuponId === Number(cupon?.id)}
                          onClick={() => abrirModalCuponAdmin(cupon)}
                        >
                          Editar
                        </button>
                      </div>
                    </article>
                  ))}
                  {!cuponesAdmin.length && <div className="tiendaVacio">Sin cupones registrados.</div>}
                </div>
              </div>

              <div className="tiendaCuponesInfluencersCard">
                <strong>Tracking de influencers</strong>
                {cargandoHistorialCuponesAdmin ? (
                  <div className="tiendaVacio">Cargando métricas...</div>
                ) : (
                  <div className="tiendaCuponesInfluencersGrid">
                    {(historialCuponesAdmin.influencers || []).map((item) => (
                      <article key={`influencer-cupon-${item.id}-${item.codigo}`} className="tiendaCuponInfluencerItem">
                        <strong>{item.codigo}</strong>
                        <span>{item.influencer_nombre || item.nombre || 'Influencer'}</span>
                        <span>Órdenes: {Number(item.ordenes) || 0}</span>
                        <span>Productos vendidos: {Number(item.productos_vendidos) || 0}</span>
                        <span>Total vendido: {precio(Number(item.total_ventas) || 0)}</span>
                        <span>Descuento otorgado: {precio(Number(item.descuento_otorgado) || 0)}</span>
                      </article>
                    ))}
                    {!(historialCuponesAdmin.influencers || []).length && <div className="tiendaVacio">No hay datos de influencer aún.</div>}
                  </div>
                )}
              </div>

              {mostrandoModalCuponAdmin && typeof document !== 'undefined' && createPortal(
                <div className="tiendaPerfilOverlay tiendaCuponOverlay" onClick={() => setMostrandoModalCuponAdmin(false)}>
                  <div className="contenidoModal tiendaAuthModal tiendaCuponModal" onClick={(e) => e.stopPropagation()}>
                    <div className="encabezadoModal tiendaPerfilHeaderPro">
                      <h3>{editandoCuponAdminId > 0 ? 'Editar cupón' : 'Nuevo cupón'}</h3>
                      <button className="cerrarModal" onClick={() => { setMostrandoModalCuponAdmin(false); setPasoModalCuponAdmin(1); }}>&times;</button>
                    </div>

                    <div className="tiendaCuponWizardPasos">
                      {[1, 2, 3, 4].map((paso) => (
                        <div key={`paso-cupon-${paso}`} className={pasoModalCuponAdmin === paso ? 'tiendaCuponWizardPaso activo' : 'tiendaCuponWizardPaso'}>
                          Paso {paso}
                        </div>
                      ))}
                    </div>

                    {pasoModalCuponAdmin === 1 && (
                      <div className="tiendaCuponWizardPanel">
                        <h4>Datos básicos</h4>
                        <div className="tiendaCuponesCampos2">
                          <input
                            placeholder="Código"
                            value={cuponAdminDraft.codigo}
                            onChange={(e) => setCuponAdminDraft((p) => ({ ...p, codigo: String(e.target.value || '').toUpperCase().replace(/\s+/g, '') }))}
                          />
                          <input
                            placeholder="Promoción (nombre)"
                            value={cuponAdminDraft.nombre}
                            onChange={(e) => setCuponAdminDraft((p) => ({ ...p, nombre: e.target.value }))}
                          />
                        </div>
                        <div className="tiendaCuponesCampos2">
                          <select value={cuponAdminDraft.tipo} onChange={(e) => setCuponAdminDraft((p) => ({ ...p, tipo: e.target.value }))}>
                            <option value="general">General</option>
                            <option value="influencer">Influencer</option>
                          </select>
                          <label className="tiendaSwitchCard tiendaSwitchToggle">
                            <input
                              type="checkbox"
                              checked={Boolean(cuponAdminDraft.activo)}
                              onChange={(e) => setCuponAdminDraft((p) => ({ ...p, activo: e.target.checked }))}
                            />
                            <span className="tiendaSwitchSlider" />
                            <span>Activo</span>
                          </label>
                        </div>
                        {cuponAdminDraft.tipo === 'influencer' && (
                          <div className="tiendaCuponesCampos2">
                            <input placeholder="Nombre influencer" value={cuponAdminDraft.influencer_nombre} onChange={(e) => setCuponAdminDraft((p) => ({ ...p, influencer_nombre: e.target.value }))} />
                            <input placeholder="@handle (opcional)" value={cuponAdminDraft.influencer_handle} onChange={(e) => setCuponAdminDraft((p) => ({ ...p, influencer_handle: e.target.value }))} />
                          </div>
                        )}
                      </div>
                    )}

                    {pasoModalCuponAdmin === 2 && (
                      <div className="tiendaCuponWizardPanel">
                        <h4>Alcance del cupón</h4>
                        <div className="tiendaCuponesCampos2">
                          <select value={cuponAdminDraft.alcance_tipo} onChange={(e) => setCuponAdminDraft((p) => ({ ...p, alcance_tipo: e.target.value, alcance_clave: '' }))}>
                            <option value="todos">Menú general (todos)</option>
                            <option value="categoria">Solo una categoría</option>
                            <option value="producto">Solo un producto</option>
                          </select>
                          {cuponAdminDraft.alcance_tipo === 'categoria' ? (
                            <select value={cuponAdminDraft.alcance_clave} onChange={(e) => setCuponAdminDraft((p) => ({ ...p, alcance_clave: e.target.value }))}>
                              <option value="">Selecciona categoría</option>
                              {categoriasDisponibles.map((categoria) => (
                                <option key={`cupon-cat-${categoria}`} value={String(categoria || '').toLowerCase()}>{categoria}</option>
                              ))}
                            </select>
                          ) : cuponAdminDraft.alcance_tipo === 'producto' ? (
                            <select value={cuponAdminDraft.alcance_clave} onChange={(e) => setCuponAdminDraft((p) => ({ ...p, alcance_clave: e.target.value }))}>
                              <option value="">Selecciona producto</option>
                              {productos.map((producto) => (
                                <option key={`cupon-prod-${producto?.slug || producto?.nombre_receta}`} value={String(producto?.nombre_receta || '').trim().toLowerCase()}>{producto?.nombre_receta}</option>
                              ))}
                            </select>
                          ) : (
                            <input value="Aplica a todos" disabled />
                          )}
                        </div>
                      </div>
                    )}

                    {pasoModalCuponAdmin === 3 && (
                      <div className="tiendaCuponWizardPanel">
                        <h4>Descuento y reglas de uso</h4>
                        <div className="tiendaCuponSwitchTop">
                          <label className="tiendaSwitchCard tiendaSwitchToggle">
                            <input type="checkbox" checked={Boolean(cuponAdminDraft.un_solo_uso_por_cliente)} onChange={(e) => setCuponAdminDraft((p) => ({ ...p, un_solo_uso_por_cliente: e.target.checked }))} />
                            <span className="tiendaSwitchSlider" />
                            <span>Un solo uso por cliente</span>
                          </label>
                        </div>

                        <div className="tiendaCuponesCampos3">
                          <select
                            value={cuponAdminDraft.tipo_descuento}
                            onChange={(e) => {
                              const nuevoTipo = String(e.target.value || 'porcentaje').trim().toLowerCase();
                              setCuponAdminDraft((p) => {
                                let valor = Math.max(0, Number(p?.valor_descuento) || 0);
                                if (nuevoTipo === 'porcentaje') {
                                  valor = Math.min(100, Math.max(5, Math.round((valor || 5) / 5) * 5));
                                }
                                return { ...p, tipo_descuento: nuevoTipo, valor_descuento: valor };
                              });
                            }}
                          >
                            <option value="porcentaje">Descuento %</option>
                            <option value="monto_fijo">Descuento fijo</option>
                          </select>
                          {cuponAdminDraft.tipo_descuento === 'porcentaje' ? (
                            <select
                              value={String(Math.min(100, Math.max(5, Math.round((Number(cuponAdminDraft.valor_descuento) || 5) / 5) * 5)))}
                              onChange={(e) => setCuponAdminDraft((p) => ({ ...p, valor_descuento: Number(e.target.value) || 5 }))}
                            >
                              {Array.from({ length: 20 }, (_, i) => (i + 1) * 5).map((valor) => (
                                <option key={`cupon-desc-${valor}`} value={valor}>{valor}% de descuento</option>
                              ))}
                            </select>
                          ) : (
                            <select
                              value={String(Math.max(0, Number(cuponAdminDraft.valor_descuento) || 0))}
                              onChange={(e) => setCuponAdminDraft((p) => ({ ...p, valor_descuento: Number(e.target.value) || 0 }))}
                            >
                              {[50, 100, 150, 200, 250, 300, 400, 500, 750, 1000].map((valor) => (
                                <option key={`cupon-monto-${valor}`} value={valor}>${valor} MXN descuento</option>
                              ))}
                            </select>
                          )}
                          <select
                            value={String(Math.max(0, Number(cuponAdminDraft.monto_minimo) || 0))}
                            onChange={(e) => setCuponAdminDraft((p) => ({ ...p, monto_minimo: Number(e.target.value) || 0 }))}
                          >
                            {[0, 100, 200, 300, 500, 700, 1000, 1500, 2000].map((valor) => (
                              <option key={`cupon-min-${valor}`} value={valor}>{valor === 0 ? 'Sin mínimo de compra' : `Compra mínima $${valor} MXN`}</option>
                            ))}
                          </select>
                          <select
                            value={String(Math.max(0, Number(cuponAdminDraft.max_descuento) || 0))}
                            onChange={(e) => setCuponAdminDraft((p) => ({ ...p, max_descuento: Number(e.target.value) || 0 }))}
                          >
                            {[0, 50, 100, 150, 200, 300, 500, 700, 1000].map((valor) => (
                              <option key={`cupon-tope-${valor}`} value={valor}>{valor === 0 ? 'Sin tope de descuento' : `Tope $${valor} MXN`}</option>
                            ))}
                          </select>
                          <select
                            value={String(Math.max(0, Number(cuponAdminDraft.usos_maximos_total) || 0))}
                            onChange={(e) => setCuponAdminDraft((p) => ({ ...p, usos_maximos_total: Number(e.target.value) || 0 }))}
                          >
                            {[0, 10, 20, 30, 50, 100, 200, 500, 1000].map((valor) => (
                              <option key={`cupon-usos-total-${valor}`} value={valor}>{valor === 0 ? 'Sin límite total' : `${valor} usos totales`}</option>
                            ))}
                          </select>
                          <select
                            value={String(Math.max(0, Number(cuponAdminDraft.usos_maximos_por_cliente) || 0))}
                            onChange={(e) => setCuponAdminDraft((p) => ({ ...p, usos_maximos_por_cliente: Number(e.target.value) || 0 }))}
                          >
                            {[0, 1, 2, 3, 5, 10].map((valor) => (
                              <option key={`cupon-usos-cliente-${valor}`} value={valor}>{valor === 0 ? 'Sin límite por cliente' : `${valor} usos por cliente`}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {pasoModalCuponAdmin === 4 && (
                      <div className="tiendaCuponWizardPanel">
                        <h4>Vigencia</h4>
                        <div className="tiendaCuponesCampos2">
                          <label className="tiendaSwitchCard tiendaSwitchToggle">
                            <input type="checkbox" checked={Boolean(cuponAdminDraft.vigente_indefinido)} onChange={(e) => setCuponAdminDraft((p) => ({ ...p, vigente_indefinido: e.target.checked }))} />
                            <span className="tiendaSwitchSlider" />
                            <span>Vigencia indefinida</span>
                          </label>
                        </div>
                        {!cuponAdminDraft.vigente_indefinido && (
                          <div className="tiendaCuponesCampos2">
                            <input type="datetime-local" value={cuponAdminDraft.valido_desde} onChange={(e) => setCuponAdminDraft((p) => ({ ...p, valido_desde: e.target.value }))} />
                            <input type="datetime-local" value={cuponAdminDraft.valido_hasta} onChange={(e) => setCuponAdminDraft((p) => ({ ...p, valido_hasta: e.target.value }))} />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="tiendaCuponesEditorAcciones">
                      <button
                        className="boton"
                        type="button"
                        onClick={() => setPasoModalCuponAdmin((p) => Math.max(1, p - 1))}
                        disabled={pasoModalCuponAdmin <= 1 || guardandoCuponAdmin}
                      >
                        Atrás
                      </button>

                      {pasoModalCuponAdmin < 4 ? (
                        <button
                          className="boton botonExito"
                          type="button"
                          onClick={() => {
                            if (pasoModalCuponAdmin === 1) {
                              if (!String(cuponAdminDraft.codigo || '').trim()) {
                                mostrarNotificacion('Captura el código del cupón', 'error');
                                return;
                              }
                              if (!String(cuponAdminDraft.nombre || '').trim()) {
                                mostrarNotificacion('Captura el nombre de la promoción', 'error');
                                return;
                              }
                              if (String(cuponAdminDraft.tipo || '') === 'influencer' && !String(cuponAdminDraft.influencer_nombre || '').trim()) {
                                mostrarNotificacion('Captura el nombre del influencer', 'error');
                                return;
                              }
                            }
                            if (pasoModalCuponAdmin === 2 && (cuponAdminDraft.alcance_tipo === 'categoria' || cuponAdminDraft.alcance_tipo === 'producto') && !String(cuponAdminDraft.alcance_clave || '').trim()) {
                              mostrarNotificacion('Selecciona el alcance específico del cupón', 'error');
                              return;
                            }
                            setPasoModalCuponAdmin((p) => Math.min(4, p + 1));
                          }}
                        >
                          Siguiente
                        </button>
                      ) : (
                        <button className="boton botonExito" type="button" onClick={guardarCuponAdmin} disabled={guardandoCuponAdmin}>
                          {guardandoCuponAdmin ? 'Guardando...' : 'Guardar cupón'}
                        </button>
                      )}

                      <button className="boton" type="button" onClick={() => { setMostrandoModalCuponAdmin(false); setPasoModalCuponAdmin(1); }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )}
            </div>
            )}

            {adminVista === 'clientes' && (
              <div className="tiendaAdminForm">
                <strong>Clientes registrados</strong>
                <div className="tiendaAdminListado tiendaAdminListadoAmplio">
                  <div className="clientesGrid">
                    {clientesAdminFiltrados.map((c) => (
                      <div key={c.id} className="tiendaAdminFila tiendaAdminClienteCard">
                        <div className="tiendaAdminClienteHeader">
                          <strong>{c.nombre || 'Sin nombre'}</strong>
                          <div className="tiendaAdminSubtexto">{c.email || 'Sin correo'}</div>
                        </div>

                        <div className="tiendaAdminClienteCuerpo">
                          <div className="tiendaAdminClienteDatosGrid">
                            <div className="tiendaAdminClienteDato"><span>Teléfono</span><strong>{c.telefono || '-'}</strong></div>
                            <div className="tiendaAdminClienteDato"><span>Promociones</span><strong>{Number(c.recibe_promociones) === 1 ? 'Suscrito' : 'No suscrito'}</strong></div>
                            <div className="tiendaAdminClienteDato"><span>Acciones app</span><strong>{Number(c.acciones_app_activas ?? 1) === 1 ? 'Activas' : 'Pausadas'}</strong></div>
                            <div className="tiendaAdminClienteDato"><span>Pago preferido</span><strong>{c.forma_pago_preferida || '-'}</strong></div>
                            <div className="tiendaAdminClienteDato tiendaAdminClienteDatoAncho"><span>Dirección</span><strong>{c.direccion_default || '-'}</strong></div>
                            <div className="tiendaAdminClienteDato"><span>Alta</span><strong>{String(c.creado_en || '').replace('T', ' ').slice(0, 16) || '-'}</strong></div>
                            <div className="tiendaAdminClienteDato tiendaAdminClienteAccionCelda">
                              <SwitchConTexto
                                checked={Number(c.acciones_app_activas ?? 1) === 1}
                                label={Number(c.acciones_app_activas ?? 1) === 1 ? 'Tomar en cuenta acciones' : 'Ignorar acciones'}
                                onChange={(e) => cambiarAccionesClienteAdmin(c.id, e.target.checked)}
                                ariaLabel={`Activar o desactivar acciones en app para ${c.nombre || c.email || 'cliente'}`}
                              />
                              <button className="boton botonEliminar" onClick={() => eliminarClienteAdmin(c.id)}>Eliminar</button>
                            </div>
                          </div>
                        </div>
                        {actualizandoClienteAccionesId === Number(c.id || 0) && (
                          <div className="tiendaAdminSubtexto tiendaAdminClienteActualizando">Actualizando estado...</div>
                        )}
                      </div>
                    ))}
                  </div>
                  {!clientesAdminFiltrados.length && <div className="tiendaVacio">No hay clientes con ese filtro</div>}
                </div>
              </div>
            )}

            {adminVista === 'pedidos' && (
              <div className="tiendaAdminForm">
                <strong>Seguimiento de pedidos</strong>
                {!servicioDomicilioActivoAdmin && (
                  <div className="tiendaAdminServicioDomicilioAlert">
                    <div>
                      <strong>Servicio a domicilio para clientes</strong>
                      <p>
                        Al activarlo se enviará aviso a todos los clientes conectados. Es una acción única protegida con contraseña del CEO.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="boton botonExito"
                      onClick={activarServicioDomicilioAdmin}
                      disabled={activandoServicioDomicilio}
                    >
                      {activandoServicioDomicilio ? 'Activando...' : 'Activar servicio a domicilio'}
                    </button>
                  </div>
                )}
                <div className="tiendaAdminResumenPedidos">
                  <button
                    type="button"
                    className={filtroEstadoOrdenAdmin === 'todos' ? 'activo' : ''}
                    onClick={() => setFiltroEstadoOrdenAdmin('todos')}
                  >
                    Total: <strong>{resumenOrdenesAdmin.total}</strong>
                  </button>
                  <button
                    type="button"
                    className={filtroEstadoOrdenAdmin === 'pendiente' ? 'activo' : ''}
                    onClick={() => setFiltroEstadoOrdenAdmin('pendiente')}
                  >
                    Pendientes: <strong>{resumenOrdenesAdmin.pendiente}</strong>
                  </button>
                  <button
                    type="button"
                    className={filtroEstadoOrdenAdmin === 'procesando' ? 'activo' : ''}
                    onClick={() => setFiltroEstadoOrdenAdmin('procesando')}
                  >
                    Procesando: <strong>{resumenOrdenesAdmin.procesando}</strong>
                  </button>
                  <button
                    type="button"
                    className={filtroEstadoOrdenAdmin === 'enviado_por_paqueteria' ? 'activo' : ''}
                    onClick={() => setFiltroEstadoOrdenAdmin('enviado_por_paqueteria')}
                  >
                    Enviados por paquetería: <strong>{resumenOrdenesAdmin.enviado_por_paqueteria}</strong>
                  </button>
                  <button
                    type="button"
                    className={filtroEstadoOrdenAdmin === 'en_transito' ? 'activo' : ''}
                    onClick={() => setFiltroEstadoOrdenAdmin('en_transito')}
                  >
                    En tránsito: <strong>{resumenOrdenesAdmin.en_transito}</strong>
                  </button>
                  <button
                    type="button"
                    className={filtroEstadoOrdenAdmin === 'entregado' ? 'activo' : ''}
                    onClick={() => setFiltroEstadoOrdenAdmin('entregado')}
                  >
                    Entregados: <strong>{resumenOrdenesAdmin.entregado}</strong>
                  </button>
                  <button
                    type="button"
                    className={filtroEstadoOrdenAdmin === 'cancelado' ? 'activo' : ''}
                    onClick={() => setFiltroEstadoOrdenAdmin('cancelado')}
                  >
                    Cancelados: <strong>{resumenOrdenesAdmin.cancelado}</strong>
                  </button>
                </div>
                <div className="tiendaAdminPedidosDangerActions">
                  <button
                    type="button"
                    className="boton botonDanger"
                    onClick={eliminarPedidosFiltradosAdmin}
                    disabled={procesandoPedidosAdmin || !ordenesAdminFiltradas.length}
                  >
                    {procesandoPedidosAdmin ? 'Procesando...' : `Eliminar filtrados (${ordenesAdminFiltradas.length})`}
                  </button>
                  <button
                    type="button"
                    className="boton botonEliminar"
                    onClick={abrirModalResetContadoresAdmin}
                    disabled={procesandoPedidosAdmin}
                  >
                    {procesandoPedidosAdmin ? 'Procesando...' : 'Reiniciar contadores de pedidos'}
                  </button>
                </div>
                <div className="tiendaAdminListado tiendaAdminListadoAmplio tiendaAdminListadoPedidos">
                  <div className="tiendaAdminOrdenGrid">
                  {ordenesAdminFiltradas.map((o) => (
                    (() => {
                      const draft = seguimientoDraftPorOrden[o.id] || {
                        estado: String(o.estado || 'pendiente').trim().toLowerCase(),
                        estado_pago: String(o.estado_pago || 'pendiente_manual').trim().toLowerCase(),
                        paqueteria: String(o.paqueteria || '').trim().toLowerCase(),
                        numero_guia: String(o.numero_guia || '').trim()
                      };
                      const estadoActual = String(o.estado || 'pendiente').trim().toLowerCase();
                      const estadoSeleccionado = String(draft.estado || estadoActual || 'pendiente').trim().toLowerCase();
                      const mostrarSeguimiento = estadoSeleccionado === 'enviado_por_paqueteria'
                        || Boolean(draft.paqueteria || draft.numero_guia);
                      const linkRastreo = construirLinkRastreo(draft.paqueteria, draft.numero_guia);

                      return (
                        <div
                          id={`admin-orden-${Number(o.id || 0)}`}
                          key={o.id}
                          className="tiendaAdminFila tiendaAdminOrdenCard"
                          style={
                            (Number(ordenObjetivoAdmin?.id || 0) === Number(o.id || 0)
                              || (String(ordenObjetivoAdmin?.folio || '').trim() && String(o?.folio || '').trim() === String(ordenObjetivoAdmin?.folio || '').trim()))
                              ? { border: '2px solid #2e7d32', boxShadow: '0 0 0 3px rgba(46, 125, 50, 0.12)' }
                              : undefined
                          }
                        >
                          <div className="tiendaAdminOrdenInfo">
                            <strong>{o.folio}</strong>
                            <div className="tiendaAdminSubtexto">{o.nombre_cliente} · {o.email_cliente || 'Sin correo'} · {o.telefono_cliente || 'Sin teléfono'}</div>
                            <div className="tiendaAdminSubtexto">Entrega: {o.nombre_punto_entrega || '-'} · {o.direccion_entrega || '-'}</div>
                            <div className="tiendaAdminSubtexto">Origen: {etiquetaOrigenPedido(o.origen_pedido)} · Pago: {o.metodo_pago || '-'} · Estatus pago: {etiquetaEstadoPago(draft.estado_pago || o.estado_pago)} · Total: {precio(o.total)} · {String(o.creado_en || '').replace('T', ' ').slice(0, 16)}</div>
                            <div className="tiendaAdminSubtexto">Estado actual: {etiquetaEstadoPedido(estadoActual)}</div>
                            {String(o.notas || '').trim() && <div className="tiendaAdminSubtexto">Notas: {o.notas}</div>}
                            {Boolean(draft.paqueteria || draft.numero_guia) && (
                              <div className="tiendaAdminSubtexto">
                                Envío: {draft.paqueteria ? etiquetaPaqueteria(draft.paqueteria) : 'Sin paquetería'}
                                {draft.numero_guia ? ` · Guía: ${draft.numero_guia}` : ''}
                              </div>
                            )}
                          </div>

                          <div className="tiendaAdminOrdenAcciones">
                            <label htmlFor={`orden-estado-${o.id}`} className="tiendaAdminMiniLabel">Estatus del pedido</label>
                            <select
                              id={`orden-estado-${o.id}`}
                              value={estadoSeleccionado}
                              onChange={(e) => {
                                const nuevoEstado = String(e.target.value || '').trim().toLowerCase();
                                const draftActual = seguimientoDraftPorOrden[o.id] || { estado: estadoActual, estado_pago: String(o.estado_pago || 'pendiente_manual').trim().toLowerCase(), paqueteria: '', numero_guia: '' };
                                actualizarDraftSeguimientoOrden(o.id, { estado: nuevoEstado });
                                if (nuevoEstado === 'enviado_por_paqueteria') {
                                  return;
                                }
                                actualizarEstadoOrdenAdmin(o.id, {
                                  estado: nuevoEstado,
                                  estado_pago: draftActual.estado_pago,
                                  paqueteria: draftActual.paqueteria,
                                  numero_guia: draftActual.numero_guia
                                });
                              }}
                            >
                              {ESTATUS_PEDIDO_OPCIONES.map((estado) => (
                                <option key={`estado-${o.id}-${estado.value}`} value={estado.value}>{estado.label}</option>
                              ))}
                            </select>

                            <label htmlFor={`orden-estado-pago-${o.id}`} className="tiendaAdminMiniLabel">Estatus del pago</label>
                            <select
                              id={`orden-estado-pago-${o.id}`}
                              value={String(draft.estado_pago || o.estado_pago || 'pendiente_manual').trim().toLowerCase()}
                              onChange={(e) => {
                                const nuevoEstadoPago = String(e.target.value || '').trim().toLowerCase();
                                actualizarDraftSeguimientoOrden(o.id, { estado_pago: nuevoEstadoPago });
                                actualizarEstadoPagoOrdenAdmin(o.id, nuevoEstadoPago);
                              }}
                            >
                              {ESTATUS_PAGO_OPCIONES.map((estadoPago) => (
                                <option key={`estado-pago-${o.id}-${estadoPago.value}`} value={estadoPago.value}>{estadoPago.label}</option>
                              ))}
                            </select>

                            {mostrarSeguimiento && (
                              <div className="tiendaAdminSeguimientoWrap">
                                <label htmlFor={`orden-paqueteria-${o.id}`} className="tiendaAdminMiniLabel">Paquetería</label>
                                <select
                                  id={`orden-paqueteria-${o.id}`}
                                  value={draft.paqueteria}
                                  onChange={(e) => actualizarDraftSeguimientoOrden(o.id, { paqueteria: String(e.target.value || '').trim().toLowerCase() })}
                                >
                                  <option value="">Selecciona paquetería</option>
                                  {PAQUETERIAS_MX.map((carrier) => (
                                    <option key={`carrier-${o.id}-${carrier.value}`} value={carrier.value}>{carrier.label}</option>
                                  ))}
                                </select>

                                <label htmlFor={`orden-guia-${o.id}`} className="tiendaAdminMiniLabel">Número de guía</label>
                                <input
                                  id={`orden-guia-${o.id}`}
                                  type="text"
                                  placeholder="Ej. 1234567890"
                                  value={draft.numero_guia}
                                  onChange={(e) => actualizarDraftSeguimientoOrden(o.id, { numero_guia: String(e.target.value || '').trim() })}
                                />

                                <button
                                  type="button"
                                  className="botonPequeno botonExito"
                                  onClick={() => actualizarEstadoOrdenAdmin(o.id, {
                                    estado: estadoSeleccionado,
                                    paqueteria: draft.paqueteria,
                                    numero_guia: draft.numero_guia
                                  })}
                                >
                                  Guardar estatus y seguimiento
                                </button>

                                {linkRastreo && (
                                  <a className="tiendaTrackingLink" href={linkRastreo} target="_blank" rel="noreferrer">
                                    Abrir rastreo en paquetería
                                  </a>
                                )}
                              </div>
                            )}

                            <button
                              type="button"
                              className="botonPequeno botonDanger"
                              onClick={() => eliminarOrdenAdmin(o.id)}
                              disabled={procesandoPedidosAdmin}
                            >
                              {procesandoPedidosAdmin ? 'Procesando...' : 'Eliminar pedido'}
                            </button>

                          </div>
                        </div>
                      );
                    })()
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
              onClick={() => volverAVitrinaActual()}
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
            const esPaqueteDetalle = String(seleccionado?.tipo_producto || '').trim().toLowerCase() === 'paquete'
              || (Array.isArray(seleccionado?.paquete_detalle) && seleccionado.paquete_detalle.length > 0);
            const detallePaquete = Array.isArray(seleccionado?.paquete_detalle) ? seleccionado.paquete_detalle : [];
            const idxDetalleActivo = Math.max(0, Math.min(Number(seleccionado?.detalle_paquete_activo) || 0, Math.max(0, detallePaquete.length - 1)));
            const detalleActivo = esPaqueteDetalle ? (detallePaquete[idxDetalleActivo] || {}) : null;
            const modoUsoActivo = String(seleccionado?.modo_uso || '').trim();
            const cuidadosActivo = String(seleccionado?.cuidados || '').trim();
            const descripcionActiva = String(seleccionado?.descripcion || '').trim();
            const ingredientesActivos = Array.isArray(seleccionado?.ingredientes) ? seleccionado.ingredientes : [];
            const modoUsoFinal = esPaqueteDetalle
              ? String(detalleActivo?.modo_uso || modoUsoActivo).trim()
              : modoUsoActivo;
            const cuidadosFinal = esPaqueteDetalle
              ? String(detalleActivo?.cuidados || cuidadosActivo).trim()
              : cuidadosActivo;
            const descripcionFinal = esPaqueteDetalle
              ? String(detalleActivo?.descripcion || descripcionActiva).trim()
              : descripcionActiva;
            const ingredientesFinal = esPaqueteDetalle
              ? (Array.isArray(detalleActivo?.ingredientes) && detalleActivo.ingredientes.length
                ? detalleActivo.ingredientes
                : ingredientesActivos)
              : ingredientesActivos;
            const modoUsoItems = parseTextoFichaEnItems(modoUsoFinal);
            const cuidadosItems = parseTextoFichaEnItems(cuidadosFinal);
            const modoUsoNumerado = modoUsoItems.length > 1 && modoUsoItems.every((linea) => /^\d+[\.)]\s+/.test(linea));
            const cuidadosNumerado = cuidadosItems.length > 1 && cuidadosItems.every((linea) => /^\d+[\.)]\s+/.test(linea));
            const variantesDisponibles = variantes;
            const precioFichaDetalle = Number(seleccionado?.tienda_precio_publico) || 0;
            const tienePrecioDetalle = precioFichaDetalle > 0;
            const stockActivo = varianteActiva ? (Number(varianteActiva.stock) || 0) : (Number(seleccionado?.stock) || 0);
            const disponibleActivo = stockActivo > 0;

            return (
              <>
                <div className="encabezadoModal tiendaDetalleHeaderFijo">
                  <div>
                    <h3>Detalle del producto</h3>
                    <div className="tiendaDetallePresentacionActiva">{seleccionado.nombre_receta}</div>
                  </div>
                  <button
                    className="boton tiendaBotonVolverMini"
                    type="button"
                    aria-label="Volver a productos"
                    title="Volver a productos"
                    onClick={() => volverAVitrinaActual()}
                  >
                    ←
                  </button>
                </div>
                <div className="tiendaDetalleLayout">
                  <div className="tiendaDetalleLateralImagen">
                    {esPaqueteDetalle && detallePaquete.length > 0 && (
                      <div className="tiendaDetalleProductoTabs">
                        {detallePaquete.map((item, idx) => {
                          const nombreTab = String(item?.receta_nombre || `Producto ${idx + 1}`);
                          const activa = idx === idxDetalleActivo;
                          return (
                            <button
                              key={`paquete-detalle-tab-${idx}-${nombreTab}`}
                              type="button"
                              className={activa ? 'tiendaDetalleProductoTab activa' : 'tiendaDetalleProductoTab'}
                              onClick={() => seleccionarDetallePaquete(idx)}
                            >
                              {nombreTab}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div
                      className="tiendaDetalleColImagen"
                      onTouchStart={iniciarSwipeDetalle}
                      onTouchEnd={finalizarSwipeDetalle}
                    >
                      <span className="tiendaDetalleMarcoEnredadera tiendaDetalleMarcoEnredaderaTop" aria-hidden="true">
                        <svg viewBox="0 0 140 18" role="presentation" focusable="false" preserveAspectRatio="none">
                          <path d="M1 9 C20 2, 40 16, 60 9 C80 2, 100 16, 120 9 C128 6, 134 8, 139 9" />
                          <ellipse cx="14" cy="5" rx="4" ry="2.2" transform="rotate(-25 14 5)" />
                          <ellipse cx="29" cy="13" rx="4.3" ry="2.4" transform="rotate(22 29 13)" />
                          <ellipse cx="45" cy="5" rx="4" ry="2.2" transform="rotate(-20 45 5)" />
                          <ellipse cx="61" cy="13" rx="4.3" ry="2.4" transform="rotate(22 61 13)" />
                          <ellipse cx="77" cy="5" rx="4" ry="2.2" transform="rotate(-24 77 5)" />
                          <ellipse cx="93" cy="13" rx="4.3" ry="2.4" transform="rotate(22 93 13)" />
                          <ellipse cx="109" cy="5" rx="4" ry="2.2" transform="rotate(-20 109 5)" />
                          <ellipse cx="126" cy="12" rx="4" ry="2.2" transform="rotate(20 126 12)" />
                        </svg>
                      </span>
                      {String(seleccionado?.imagen_activa || '').trim() ? (
                        esUrlVideoTienda(seleccionado.imagen_activa) ? (
                          <video
                            src={seleccionado.imagen_activa}
                            autoPlay
                            muted
                            loop
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <img src={seleccionado.imagen_activa} alt={seleccionado.nombre_receta} />
                        )
                      ) : (
                        <div className="tiendaImagenPlaceholder">Sin imagen</div>
                      )}
                      <span className="tiendaDetalleMarcoEnredadera tiendaDetalleMarcoEnredaderaBottom" aria-hidden="true">
                        <svg viewBox="0 0 140 18" role="presentation" focusable="false" preserveAspectRatio="none">
                          <path d="M1 9 C20 2, 40 16, 60 9 C80 2, 100 16, 120 9 C128 6, 134 8, 139 9" />
                          <ellipse cx="14" cy="5" rx="4" ry="2.2" transform="rotate(-25 14 5)" />
                          <ellipse cx="29" cy="13" rx="4.3" ry="2.4" transform="rotate(22 29 13)" />
                          <ellipse cx="45" cy="5" rx="4" ry="2.2" transform="rotate(-20 45 5)" />
                          <ellipse cx="61" cy="13" rx="4.3" ry="2.4" transform="rotate(22 61 13)" />
                          <ellipse cx="77" cy="5" rx="4" ry="2.2" transform="rotate(-24 77 5)" />
                          <ellipse cx="93" cy="13" rx="4.3" ry="2.4" transform="rotate(22 93 13)" />
                          <ellipse cx="109" cy="5" rx="4" ry="2.2" transform="rotate(-20 109 5)" />
                          <ellipse cx="126" cy="12" rx="4" ry="2.2" transform="rotate(20 126 12)" />
                        </svg>
                      </span>
                    </div>
                    {!!(Array.isArray(seleccionado?.galeria) && seleccionado.galeria.length) && (
                      <div className="tiendaDetalleGaleriaMini">
                        {seleccionado.galeria.map((url, idx) => (
                          <button
                            key={`img-mini-${idx}`}
                            className={String(url) === String(seleccionado?.imagen_activa || '') ? 'tiendaMiniImg activa' : 'tiendaMiniImg'}
                            onClick={() => seleccionarImagenDetalle(url)}
                          >
                            {esUrlVideoTienda(url) ? (
                              <video src={url} muted loop autoPlay playsInline preload="metadata" />
                            ) : (
                              <img src={url} alt={`Vista ${idx + 1}`} />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {!!variantesDisponibles.length && (
                      <div className="tiendaDetallePresentaciones">
                        <div className="tiendaDetallePresentacionesTitulo">Presentación</div>
                        <div className="tiendaDetallePresentacionesGrid">
                          {variantesDisponibles.map((v) => (
                            <button
                              key={`pres-${seleccionado.nombre_receta}-${v.nombre}`}
                              type="button"
                              className={v.nombre === varianteActiva?.nombre ? 'tiendaPresentacionCard activa' : 'tiendaPresentacionCard'}
                              onClick={() => seleccionarVarianteDetalle(v.nombre)}
                            >
                              <span className="tiendaPresentacionNombre">{v.nombre}</span>
                              <span className={v.disponible ? 'tiendaPresentacionEstado' : 'tiendaPresentacionEstado agotado'}>
                                {v.disponible ? 'Disponible' : 'Sin stock'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="tiendaDetalleResumen">
                      <p><strong>{tienePrecioDetalle ? precio(precioFichaDetalle) : 'Próximamente'}</strong></p>
                      {tokenInterno && <p><strong>Stock:</strong> {stockActivo}</p>}
                    </div>
                    <div className="tiendaDetalleDescripcionDebajo">
                      <strong>Descripción</strong>
                      <p>{descripcionFinal || 'Sin descripción todavía.'}</p>
                    </div>
                  </div>
                  <div className="tiendaDetalleColInfo">
                    <div className="tiendaDetalleTabs">
                      <div className="tiendaDetalleTabItem">
                        <strong>Modo de uso</strong>
                        {!modoUsoItems.length ? (
                          <p>Sin modo de uso todavía.</p>
                        ) : modoUsoItems.length === 1 ? (
                          <p>{modoUsoItems[0]}</p>
                        ) : modoUsoNumerado ? (
                          <ol className="tiendaDetalleListaTexto">
                            {modoUsoItems.map((paso, idx) => (
                              <li key={`modo-uso-item-${idx}`}>{String(paso).replace(/^\d+[\.)]\s+/, '')}</li>
                            ))}
                          </ol>
                        ) : (
                          <ul className="tiendaDetalleListaTexto">
                            {modoUsoItems.map((paso, idx) => (
                              <li key={`modo-uso-item-${idx}`}>{paso}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="tiendaDetalleTabItem">
                        <strong>Cuidados</strong>
                        {!cuidadosItems.length ? (
                          <p>Sin cuidados registrados.</p>
                        ) : cuidadosItems.length === 1 ? (
                          <p>{cuidadosItems[0]}</p>
                        ) : cuidadosNumerado ? (
                          <ol className="tiendaDetalleListaTexto">
                            {cuidadosItems.map((paso, idx) => (
                              <li key={`cuidados-item-${idx}`}>{String(paso).replace(/^\d+[\.)]\s+/, '')}</li>
                            ))}
                          </ol>
                        ) : (
                          <ul className="tiendaDetalleListaTexto">
                            {cuidadosItems.map((paso, idx) => (
                              <li key={`cuidados-item-${idx}`}>{paso}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="tiendaDetalleTabItem">
                        <strong>Ingredientes</strong>
                        <ul>
                          {ingredientesFinal.map((ing, idx) => (
                            <li key={`${ing}-${idx}`}>{String(ing)}</li>
                          ))}
                          {!ingredientesFinal.length ? <li>Sin ingredientes registrados.</li> : null}
                        </ul>
                      </div>
                    </div>
                    <div className="tiendaDetalleResenas">
                      <div className="tiendaDetalleResenasHead">
                        <strong>Calificación del producto</strong>
                        {(Number(seleccionado?.resenas_total) || 0) > 0 && (
                          <span>
                            {(Number(seleccionado?.resenas_total) || 0) >= 5
                              ? `Promedio ${(Number(seleccionado?.resenas_promedio) || 0).toFixed(1)} / 5`
                              : `${Number(seleccionado?.resenas_total) || 0} calificaciones`}
                          </span>
                        )}
                      </div>
                      <div className="tiendaHojitasFila tiendaHojitasPromedio">
                        {pintarHojitas(Number(seleccionado?.resenas_promedio) || 0).map((activa, idx) => (
                          <span key={`prom-hoja-${idx}`} className={activa ? 'tiendaHojita activa' : 'tiendaHojita'}>🍃</span>
                        ))}
                      </div>

                      {clienteToken ? (
                        <div className="tiendaResenaAcciones">
                          <button
                            type="button"
                            className="boton botonExito"
                            onClick={() => {
                              setResenaEditandoId(0);
                              setResenaNueva({ calificacion: 5, comentario: '' });
                              setMostrarModalResena(true);
                            }}
                          >
                            Agregar comentario
                          </button>
                        </div>
                      ) : (
                        <div className="tiendaVacio">Inicia sesión para dejar tu comentario.</div>
                      )}

                      <div className="tiendaListaResenas">
                        {cargandoResenas && <div className="tiendaVacio">Cargando comentarios...</div>}
                        {!cargandoResenas && !resenasDetalle.length && <div className="tiendaVacio">Aún no hay comentarios.</div>}
                        {resenasDetalle.map((resena, idx) => {
                          const claveResena = resolverClaveResena(resena, idx);
                          const comentarioOriginal = String(resena?.comentario || '').trim();
                          const comentarioPreview = obtenerVistaPreviaComentario(comentarioOriginal);
                          const requiereToggle = comentarioPreview !== comentarioOriginal;

                          return (
                          <article key={claveResena} className="tiendaResenaCard">
                            <div className="tiendaResenaHead">
                              <strong>{resena.nombre_cliente || 'Cliente'}</strong>
                              <div className="tiendaHojitasFila tiendaResenaHojitas">
                                {pintarHojitas(Number(resena.calificacion) || 0).map((activa, idx) => (
                                  <span key={`resena-hoja-${resena.id}-${idx}`} className={activa ? 'tiendaHojita activa' : 'tiendaHojita'}>🍃</span>
                                ))}
                              </div>
                            </div>
                            <p>{comentarioPreview || 'Sin comentario.'}</p>
                            {requiereToggle && (
                              <button
                                type="button"
                                className="tiendaResenaToggleTexto"
                                onClick={() => setResenaDetalleModal({
                                  nombre: String(resena?.nombre_cliente || 'Cliente'),
                                  calificacion: Number(resena?.calificacion) || 0,
                                  comentario: comentarioOriginal || 'Sin comentario.'
                                })}
                              >
                                Ver más
                              </button>
                            )}
                            {Boolean(resena?.puede_editar) && (
                              <button
                                type="button"
                                className="tiendaResenaToggleTexto"
                                onClick={() => {
                                  setResenaEditandoId(Number(resena?.id) || 0);
                                  setResenaNueva({
                                    calificacion: Math.max(1, Math.min(5, Number(resena?.calificacion) || 5)),
                                    comentario: String(resena?.comentario || '')
                                  });
                                  setMostrarModalResena(true);
                                }}
                              >
                                Editar
                              </button>
                            )}
                          </article>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="tiendaVariantes tiendaVariantesDetalle">
                        <button
                          className="boton botonExito"
                          onClick={() => agregarAlCarrito(seleccionado, varianteActiva?.nombre || '')}
                          disabled={!tienePrecioDetalle}
                        >
                          Agregar al carrito
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

      {mostrarModalResena && !esVistaTrastienda && vistaActiva === 'detalle' && (
        <div className="tiendaPerfilOverlay tiendaResenaOverlay" onClick={() => {
          setMostrarModalResena(false);
          setResenaEditandoId(0);
        }}>
          <div className="contenidoModal tiendaAuthModal tiendaResenaModal" onClick={(e) => e.stopPropagation()}>
            <div className="encabezadoModal">
              <h3>{resenaEditandoId > 0 ? 'Editar comentario' : 'Agregar calificación'}</h3>
              <button
                type="button"
                className="cerrarModal"
                aria-label="Cerrar modal de comentario"
                onClick={() => {
                  setMostrarModalResena(false);
                  setResenaEditandoId(0);
                }}
              >
                &times;
              </button>
            </div>
            <div className="tiendaResenaForm">
              <div className="tiendaResenaSelector">
                {Array.from({ length: 5 }).map((_, idx) => {
                  const valor = idx + 1;
                  const activa = valor <= Number(resenaNueva.calificacion || 0);
                  return (
                    <button
                      key={`set-hoja-modal-${valor}`}
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
                rows={5}
                placeholder="Cuéntanos cómo te pareció este producto"
                value={resenaNueva.comentario}
                onChange={(e) => setResenaNueva((prev) => ({ ...prev, comentario: e.target.value }))}
              />
              <div className="tiendaResenaModalAcciones">
                <button
                  type="button"
                  className="boton"
                  onClick={() => {
                    setMostrarModalResena(false);
                    setResenaEditandoId(0);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="boton botonExito"
                  onClick={resenaEditandoId > 0 ? actualizarResenaProducto : enviarResenaProducto}
                  disabled={enviandoResena}
                >
                  {enviandoResena ? 'Enviando...' : (resenaEditandoId > 0 ? 'Guardar cambios' : 'Guardar comentario')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {resenaDetalleModal && !esVistaTrastienda && vistaActiva === 'detalle' && (
        <div className="tiendaPerfilOverlay tiendaResenaOverlay" onClick={() => setResenaDetalleModal(null)}>
          <div className="contenidoModal tiendaAuthModal tiendaResenaModal tiendaResenaDetalleModal" onClick={(e) => e.stopPropagation()}>
            <div className="encabezadoModal">
              <h3>Comentario completo</h3>
              <button
                type="button"
                className="cerrarModal"
                aria-label="Cerrar comentario"
                onClick={() => setResenaDetalleModal(null)}
              >
                &times;
              </button>
            </div>
            <div className="tiendaResenaDetalleBody">
              <strong>{resenaDetalleModal?.nombre || 'Cliente'}</strong>
              <div className="tiendaHojitasFila tiendaResenaHojitas">
                {pintarHojitas(Number(resenaDetalleModal?.calificacion) || 0).map((activa, idx) => (
                  <span key={`resena-modal-hoja-${idx}`} className={activa ? 'tiendaHojita activa' : 'tiendaHojita'}>🍃</span>
                ))}
              </div>
              <p>{String(resenaDetalleModal?.comentario || 'Sin comentario.')}</p>
              <div className="tiendaResenaModalAcciones">
                <button
                  type="button"
                  className="boton"
                  onClick={() => setResenaDetalleModal(null)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>

      {mostrarCarrito && <div className="tiendaOverlay" onClick={cerrarCarrito}></div>}

      {mostrarModalPerfilCliente && clienteToken && (
        <div className="tiendaPerfilOverlay" onClick={() => setMostrarModalPerfilCliente(false)}>
          <div className="contenidoModal tiendaAuthModal tiendaPerfilModalPro" onClick={(e) => e.stopPropagation()}>
            <div className="encabezadoModal tiendaPerfilHeaderPro">
              <h3>Perfil</h3>
              <button className="cerrarModal" onClick={() => setMostrarModalPerfilCliente(false)}>&times;</button>
            </div>
            <div className="tiendaPerfilMainTabs" role="tablist" aria-label="Secciones del perfil">
              <button
                type="button"
                className={perfilModalTab === 'datos' ? 'tiendaTab activa' : 'tiendaTab'}
                onClick={() => setPerfilModalTab('datos')}
              >
                Datos
              </button>
              <button
                type="button"
                className={perfilModalTab === 'ordenes' ? 'tiendaTab activa' : 'tiendaTab'}
                onClick={() => setPerfilModalTab('ordenes')}
              >
                Órdenes
              </button>
              <button
                type="button"
                className={perfilModalTab === 'direcciones' ? 'tiendaTab activa' : 'tiendaTab'}
                onClick={() => setPerfilModalTab('direcciones')}
              >
                Direcciones
              </button>
              <button
                type="button"
                className={perfilModalTab === 'atencion' ? 'tiendaTab activa' : 'tiendaTab'}
                onClick={() => setPerfilModalTab('atencion')}
              >
                Atención
              </button>
              <button
                type="button"
                className={perfilModalTab === 'notificaciones' ? 'tiendaTab activa' : 'tiendaTab'}
                onClick={() => setPerfilModalTab('notificaciones')}
              >
                Notificaciones
                {totalNoLeidasCliente > 0 && <span className="tiendaPerfilTabDot" aria-hidden="true" />}
              </button>
            </div>

            <div className="tiendaPerfilLayoutPro">
              {perfilModalTab === 'datos' && (
                <div className="tiendaPerfilPanelPro tiendaPerfilPanelSolo">
                  <h4>Mi perfil</h4>
                  <div className="tiendaPerfilResumenGrid">
                    <div className="tiendaPerfilResumenItem">
                      <span>Cliente</span>
                      <strong>{nombreClienteCompleto || cliente?.nombre || 'Sin nombre'}</strong>
                    </div>
                    <div className="tiendaPerfilResumenItem">
                      <span>Correo</span>
                      <strong>{cliente?.email || 'Sin correo'}</strong>
                    </div>
                  </div>
                  <div className="tiendaPerfilCamposGrid2">
                    <div className="tiendaPerfil tiendaPerfilCamposPro">
                      <label htmlFor="perfilNombreCliente">Nombre</label>
                      <input
                        id="perfilNombreCliente"
                        placeholder="Nombre"
                        value={perfil.nombre}
                        onChange={(e) => setPerfil((p) => ({ ...p, nombre: e.target.value }))}
                      />

                      <label htmlFor="perfilApellidoPaternoCliente">Apellido paterno</label>
                      <input
                        id="perfilApellidoPaternoCliente"
                        placeholder="Apellido paterno"
                        value={perfil.apellido_paterno}
                        onChange={(e) => setPerfil((p) => ({ ...p, apellido_paterno: e.target.value }))}
                      />

                      <label htmlFor="perfilApellidoMaternoCliente">Apellido materno</label>
                      <input
                        id="perfilApellidoMaternoCliente"
                        placeholder="Apellido materno"
                        value={perfil.apellido_materno}
                        onChange={(e) => setPerfil((p) => ({ ...p, apellido_materno: e.target.value }))}
                      />
                    </div>

                    <div className="tiendaPerfil tiendaPerfilCamposPro">
                      <label htmlFor="perfilEmailCliente">Correo electrónico</label>
                      <input
                        id="perfilEmailCliente"
                        type="email"
                        placeholder="Correo"
                        value={perfil.email}
                        onChange={(e) => setPerfil((p) => ({ ...p, email: e.target.value }))}
                      />
                      <SwitchConTexto
                        checked={Boolean(perfil.recibe_promociones)}
                        onChange={(e) => setPerfil((p) => ({ ...p, recibe_promociones: e.target.checked }))}
                        label="registrate a nuestras promociones y/o informacion"
                        ariaLabel="Recibir promociones e información"
                      />

                      <label htmlFor="perfilTelefonoCliente">Teléfono</label>
                      <input
                        id="perfilTelefonoCliente"
                        placeholder="Teléfono"
                        value={perfil.telefono}
                        onChange={(e) => setPerfil((p) => ({ ...p, telefono: e.target.value }))}
                      />

                      <label htmlFor="perfilFechaNacimientoCliente">Cumpleaños</label>
                      <input
                        id="perfilFechaNacimientoCliente"
                        type="date"
                        value={perfil.fecha_nacimiento}
                        onChange={(e) => setPerfil((p) => ({ ...p, fecha_nacimiento: e.target.value }))}
                      />

                      <label htmlFor="perfilPagoPreferidoCliente">Forma de pago preferida</label>
                      <select
                        id="perfilPagoPreferidoCliente"
                        value={perfil.forma_pago_preferida}
                        onChange={(e) => setPerfil((p) => ({ ...p, forma_pago_preferida: e.target.value }))}
                      >
                        <option value="">Forma de pago preferida</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="tarjeta">Tarjeta terminal</option>
                        {!OCULTAR_MERCADO_PAGO && <option value="mercado_pago">Mercado Pago</option>}
                      </select>
                    </div>
                  </div>
                  <div className="tiendaPerfilAcciones">
                    <button className="boton botonExito" type="button" onClick={guardarPerfil}>Guardar perfil</button>
                    <button className="boton botonDanger" type="button" onClick={cerrarSesionCliente}>Cerrar sesión</button>
                  </div>
                </div>
              )}

              {perfilModalTab === 'ordenes' && (
                <div className="tiendaPerfilPanelPro tiendaPerfilPanelSolo tiendaPerfilPanelOrdenes">
                  <h4>Mis órdenes</h4>
                  <div className="tiendaPedidosTabsPerfil">
                    <button
                      type="button"
                      className={perfilPedidosTab === 'activos' ? 'tiendaTab activa' : 'tiendaTab'}
                      onClick={() => setPerfilPedidosTab('activos')}
                    >
                      Activos ({ordenesPerfilActivas.length})
                    </button>
                    <button
                      type="button"
                      className={perfilPedidosTab === 'cerrados' ? 'tiendaTab activa' : 'tiendaTab'}
                      onClick={() => setPerfilPedidosTab('cerrados')}
                    >
                      Cerrados ({ordenesPerfilCerradas.length})
                    </button>
                  </div>

                  <div className="tiendaOrdenes tiendaOrdenesPro">
                    {(perfilPedidosTab === 'cerrados' ? ordenesPerfilCerradas : ordenesPerfilActivas).map((orden) => (
                      <div key={orden.id} className="tiendaOrdenCardPro">
                        {(() => {
                          const linkRastreo = construirLinkRastreo(orden?.paqueteria, orden?.numero_guia);
                          return (
                            <>
                              <strong>{orden.folio}</strong>
                              <span>Origen: {etiquetaOrigenPedido(orden.origen_pedido)}</span>
                              <span>Pago: {orden.metodo_pago}</span>
                              <span>Estatus pago: {etiquetaEstadoPago(orden.estado_pago)}</span>
                              <span>Subtotal: {precio(Number(orden?.subtotal) || Number(orden?.total) || 0)}</span>
                              {Number(orden?.descuento_total) > 0 && <span>Descuento: -{precio(orden.descuento_total)}</span>}
                              {String(orden?.codigo_cupon || '').trim() && <span>Cupón: {orden.codigo_cupon}</span>}
                              <span>Total: {precio(orden.total)}</span>
                              <span>Estado: {etiquetaEstadoPedido(orden.estado)}</span>
                              {String(orden?.paqueteria || '').trim() && <span>Paquetería: {etiquetaPaqueteria(orden.paqueteria)}</span>}
                              {String(orden?.numero_guia || '').trim() && <span>Guía: {orden.numero_guia}</span>}
                              {linkRastreo && (
                                <a className="tiendaTrackingLink" href={linkRastreo} target="_blank" rel="noreferrer">
                                  Rastrear paquete
                                </a>
                              )}
                            </>
                          );
                        })()}
                        {String(orden.estado).toLowerCase() === 'pendiente' && (
                          <button
                            className="botonPequeno botonDanger"
                            type="button"
                            onClick={() => cancelarOrdenPerfil(orden.id)}
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    ))}
                    {!(perfilPedidosTab === 'cerrados' ? ordenesPerfilCerradas : ordenesPerfilActivas).length && (
                      <div className="tiendaVacio">
                        {perfilPedidosTab === 'cerrados'
                          ? 'No tienes pedidos cerrados todavía.'
                          : 'No tienes pedidos activos en este momento.'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {perfilModalTab === 'direcciones' && (
                <div className="tiendaPerfilPanelPro tiendaPerfilPanelSolo">
                  <div className="tiendaDireccionesHead">
                    <h4>Mis direcciones</h4>
                    <button
                      type="button"
                      className="boton botonExito"
                      onClick={() => {
                        setDireccionPerfilNueva(DIRECCION_CLIENTE_DEFAULT);
                        setDireccionPerfilEditandoId(null);
                        setMostrarModalNuevaDireccion(true);
                      }}
                    >
                      + Agregar dirección
                    </button>
                  </div>
                  <small className="tiendaPerfilLeyendaDireccion">
                    {servicioDomicilioActivoCliente
                      ? 'Selecciona una dirección preferida para entregas a domicilio.'
                      : 'Próximamente activaremos servicio a domicilio. Puedes dejar tus direcciones desde ahora.'}
                  </small>

                  <div className="tiendaDireccionesLista">
                    {!direccionesPerfil.length && (
                      <div className="tiendaVacio">Aún no tienes direcciones registradas.</div>
                    )}
                    {direccionesPerfil.map((direccion) => (
                      <article key={`direccion-${direccion.id}`} className="tiendaDireccionCard">
                        <div className="tiendaDireccionCardHead">
                          <label className="tiendaDireccionPreferida">
                            <input
                              type="radio"
                              name="direccionPreferida"
                              checked={Number(direccion.es_preferida) === 1}
                              onChange={() => marcarDireccionPreferidaPerfil(direccion.id)}
                            />
                            <span>Preferida</span>
                          </label>
                          <div className="tiendaDireccionAcciones">
                            <button
                              type="button"
                              className="botonPequeno"
                              onClick={() => {
                                setDireccionPerfilNueva({
                                  alias: String(direccion.alias || '').trim() || 'Casa',
                                  direccion: String(direccion.direccion || '').trim(),
                                  referencias: String(direccion.referencias || '').trim(),
                                  es_preferida: Number(direccion.es_preferida) === 1
                                });
                                setDireccionPerfilEditandoId(Number(direccion.id) || null);
                                setMostrarModalNuevaDireccion(true);
                              }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="botonPequeno botonDanger"
                              onClick={() => eliminarDireccionPerfil(direccion.id)}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                        <strong>{direccion.alias || 'Dirección'}</strong>
                        <p>{direccion.direccion}</p>
                        {String(direccion.referencias || '').trim() && <small>{direccion.referencias}</small>}
                      </article>
                    ))}
                  </div>

                  {mostrarModalNuevaDireccion && (
                    <div className="tiendaDireccionModalBackdrop" onClick={() => setMostrarModalNuevaDireccion(false)}>
                      <div className="tiendaDireccionModalCard" onClick={(e) => e.stopPropagation()}>
                        <div className="tiendaDireccionModalHead">
                          <h5>{Number(direccionPerfilEditandoId) > 0 ? 'Editar dirección' : 'Nueva dirección'}</h5>
                          <button
                            type="button"
                            className="botonPequeno"
                            onClick={() => {
                              setMostrarModalNuevaDireccion(false);
                              setDireccionPerfilEditandoId(null);
                              setDireccionPerfilNueva(DIRECCION_CLIENTE_DEFAULT);
                            }}
                          >
                            Cerrar
                          </button>
                        </div>

                        <div className="tiendaPerfil tiendaPerfilCamposPro tiendaDireccionNuevaBox">
                          <label htmlFor="perfilDireccionAlias">Alias</label>
                          <input
                            id="perfilDireccionAlias"
                            placeholder="Casa, Trabajo, Familiar..."
                            value={direccionPerfilNueva.alias}
                            onChange={(e) => setDireccionPerfilNueva((prev) => ({ ...prev, alias: e.target.value }))}
                          />

                          <label htmlFor="perfilDireccionTexto">Dirección</label>
                          <textarea
                            id="perfilDireccionTexto"
                            rows={3}
                            placeholder="Calle, número, colonia, ciudad..."
                            value={direccionPerfilNueva.direccion}
                            onChange={(e) => setDireccionPerfilNueva((prev) => ({ ...prev, direccion: e.target.value }))}
                          />

                          <label htmlFor="perfilDireccionRef">Referencias</label>
                          <input
                            id="perfilDireccionRef"
                            placeholder="Entre calles, color de fachada, etc."
                            value={direccionPerfilNueva.referencias}
                            onChange={(e) => setDireccionPerfilNueva((prev) => ({ ...prev, referencias: e.target.value }))}
                          />

                          <label className="tiendaDireccionPreferidaCheck">
                            <input
                              type="checkbox"
                              checked={Boolean(direccionPerfilNueva.es_preferida)}
                              onChange={(e) => setDireccionPerfilNueva((prev) => ({ ...prev, es_preferida: e.target.checked }))}
                            />
                            <span>Marcar como dirección preferida</span>
                          </label>

                          <button
                            type="button"
                            className="boton botonExito"
                            onClick={agregarDireccionPerfil}
                            disabled={guardandoDireccionPerfil}
                          >
                            {guardandoDireccionPerfil
                              ? 'Guardando...'
                              : Number(direccionPerfilEditandoId) > 0
                                ? 'Actualizar dirección'
                                : 'Guardar dirección'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {perfilModalTab === 'atencion' && (
                <div className="tiendaPerfilPanelPro tiendaPerfilPanelSolo">
                  <h4>Atención al cliente</h4>
                  <div className="tiendaAtencionGrid">
                    <div className="tiendaAtencionIntro">
                      <h5>Tu opinión cuenta, envíanos un mensaje.</h5>
                      <p>
                        Si tu consulta o incidencia está relacionada con una compra, incluye tu número de pedido para atenderte más rápido.
                      </p>
                      <div className="tiendaAtencionMeta">
                        {String(configTienda.atencion_correo || '').trim() && (
                          <span><strong>Correo:</strong> {configTienda.atencion_correo}</span>
                        )}
                        {String(configTienda.atencion_horario_lunes_viernes || '').trim() && (
                          <span><strong>Horario:</strong> {configTienda.atencion_horario_lunes_viernes}</span>
                        )}
                      </div>
                    </div>

                    <div className="tiendaPerfil tiendaPerfilCamposPro">
                      <label htmlFor="perfilAtencionAsunto">Asunto</label>
                      <select
                        id="perfilAtencionAsunto"
                        value={atencionForm.asunto}
                        onChange={(e) => setAtencionForm((prev) => ({ ...prev, asunto: e.target.value }))}
                      >
                        <option value="">Selecciona un asunto</option>
                        {asuntosAtencionDisponibles.map((asunto) => (
                          <option key={`asunto-${asunto}`} value={asunto}>{asunto}</option>
                        ))}
                      </select>

                      <label htmlFor="perfilAtencionMensaje">Mensaje</label>
                      <textarea
                        id="perfilAtencionMensaje"
                        rows={6}
                        placeholder="Describe detalladamente tu consulta"
                        value={atencionForm.mensaje}
                        onChange={(e) => setAtencionForm((prev) => ({ ...prev, mensaje: e.target.value }))}
                      />

                      <button
                        type="button"
                        className="boton botonExito"
                        onClick={enviarAtencionPerfil}
                        disabled={enviandoAtencionPerfil}
                      >
                        {enviandoAtencionPerfil ? 'Enviando...' : 'Enviar mensaje'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {perfilModalTab === 'notificaciones' && (
                <div className="tiendaPerfilPanelPro tiendaPerfilPanelSolo">
                  <div className="tiendaNotifsPerfilHead">
                    <h4>Notificaciones</h4>
                    <div className="tiendaNotifsPerfilHeadActions">
                      <button type="button" className="botonPequeno" onClick={marcarNotificacionesClienteComoLeidas}>Marcar todas leídas</button>
                      <button type="button" className="botonPequeno" onClick={limpiarNotificacionesCliente}>Limpiar historial</button>
                    </div>
                  </div>
                  {mostrarPromptNotificacionesPedidos && (
                    <div className="tiendaNotifPedidosPrompt">
                      <strong>Activa notificaciones de pedidos</strong>
                      <p>Te avisaremos cuando tu pedido se realice o cambie de estatus.</p>
                      <button type="button" className="boton botonExito" onClick={habilitarNotificacionesPedidosCliente}>
                        Activar notificaciones
                      </button>
                    </div>
                  )}

                  <div className="tiendaNotifPedidosConfig">
                    <span>
                      Estado de notificaciones: {
                        !notificacionesNativasDisponibles()
                          ? 'No disponible en este navegador'
                          : permisoNotificacionesPedidos === 'granted'
                            ? 'Activadas'
                            : permisoNotificacionesPedidos === 'denied'
                              ? 'Bloqueadas'
                              : 'Pendientes'
                      }
                    </span>
                    <div className="tiendaNotifPedidosConfigRow">
                      <label htmlFor="tiendaSonidoNotificacionesPedidos">Sonido</label>
                      <select
                        id="tiendaSonidoNotificacionesPedidos"
                        value={sonidoNotificacionesPedidosDraft}
                        onChange={(e) => cambiarSonidoNotificacionesPedidos(e.target.value)}
                      >
                        {OPCIONES_SONIDO_NOTIFICACION.map((opcion) => (
                          <option key={`sonido-notif-${opcion.value}`} value={opcion.value}>{opcion.label}</option>
                        ))}
                      </select>
                    </div>
                    {sonidoNotificacionesPedidosDraft !== sonidoNotificacionesPedidos && (
                      <button type="button" className="botonPequeno botonExito" onClick={guardarSonidoNotificacionesPedidos}>
                        Guardar sonido
                      </button>
                    )}
                    {notificacionesNativasDisponibles() && permisoNotificacionesPedidos !== 'granted' && (
                      <button type="button" className="botonPequeno" onClick={habilitarNotificacionesPedidosCliente}>
                        Habilitar notificaciones
                      </button>
                    )}
                  </div>

                  <div className="tiendaNotifsClienteLista tiendaNotifsClienteListaPerfil">
                    <div className="tiendaNotifsTabsPerfil">
                      <button
                        type="button"
                        className={notificacionesTabPerfil === 'sin_leer' ? 'tiendaTab activa' : 'tiendaTab'}
                        onClick={() => setNotificacionesTabPerfil('sin_leer')}
                      >
                        Sin leer ({notificacionesClienteSinLeer.length})
                      </button>
                      <button
                        type="button"
                        className={notificacionesTabPerfil === 'leidas' ? 'tiendaTab activa' : 'tiendaTab'}
                        onClick={() => setNotificacionesTabPerfil('leidas')}
                      >
                        Leídas ({notificacionesClienteLeidas.length})
                      </button>
                    </div>

                    {!(notificacionesTabPerfil === 'sin_leer' ? notificacionesClienteSinLeer : notificacionesClienteLeidas).length && (
                      <div className="tiendaVacio">No hay notificaciones registradas todavía.</div>
                    )}
                    {(notificacionesTabPerfil === 'sin_leer' ? notificacionesClienteSinLeer : notificacionesClienteLeidas).map((item) => {
                      const esLeida = Boolean(item?.leida);
                      return (
                        <article
                          key={`perfil-notif-${item.id}`}
                          className={esLeida ? 'tiendaNotifsClienteItem' : 'tiendaNotifsClienteItem tiendaNotifsClienteItemNueva'}
                          onClick={() => {
                            if (esLeida) return;
                            marcarNotificacionClienteComoLeida(item.id);
                          }}
                          role={!esLeida ? 'button' : undefined}
                          tabIndex={!esLeida ? 0 : -1}
                          onKeyDown={(e) => {
                            if (esLeida) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              marcarNotificacionClienteComoLeida(item.id);
                            }
                          }}
                        >
                          <strong>{item.titulo}</strong>
                          <p>{item.mensaje}</p>
                          <span>{String(item.fecha || '').replace('T', ' ').slice(0, 16)}</span>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {mostrarModalAuthCliente && (
        <div className="modal" style={{ display: 'flex' }} onClick={cerrarModalAuthCliente}>
          <div className={`contenidoModal tiendaAuthModal tiendaAuthModalLogin ${sacudirAuthCliente ? 'tiendaAuthModalShake' : ''}`.trim()} onClick={(e) => e.stopPropagation()}>
            <div className="tiendaAuthHeader">
              <button className="cerrarModal tiendaAuthCerrar" onClick={cerrarModalAuthCliente}>&times;</button>
              <img className="tiendaAuthLogo" src="/images/logo.png" alt="CHIPACTLI" />
              <h3 className="tiendaAuthTitulo">CHIPACTLI</h3>
            </div>
            <form className="tiendaAuth" onSubmit={enviarAuth} noValidate>
              {modoAuth === 'login' ? (
                <>
                  <input
                    type="email"
                    placeholder="Correo"
                    value={credenciales.email}
                    onChange={(e) => {
                      limpiarErrorAuthCliente();
                      setCredenciales((p) => ({ ...p, email: e.target.value }));
                    }}
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="email"
                    aria-invalid="false"
                    required
                  />
                  <PasswordInput
                    ref={passwordLoginRef}
                    placeholder="Contraseña"
                    value={credenciales.password}
                    onChange={(e) => {
                      limpiarErrorAuthCliente();
                      setCredenciales((p) => ({ ...p, password: e.target.value }));
                    }}
                    inputClassName={errorAuthCliente ? 'tiendaAuthInputError' : ''}
                    autoComplete="current-password"
                    aria-invalid={errorAuthCliente ? 'true' : 'false'}
                    required
                  />
                  {TURNSTILE_PUBLIC_AUTH_ENABLED && (
                    <div className="tiendaTurnstileWrap">
                      <TurnstileWidget
                        key={`auth-${modoAuth}-${clienteTurnstileResetKey}`}
                        action={modoAuth === 'login' ? 'tienda_login' : 'tienda_register'}
                        onVerify={(token) => setClienteTurnstileToken(token)}
                        onExpire={() => setClienteTurnstileToken('')}
                        onError={() => setClienteTurnstileToken('')}
                      />
                    </div>
                  )}
                  {!!errorAuthCliente && <div className="tiendaAuthErrorMsg">{errorAuthCliente}</div>}
                  <button
                    type="button"
                    className="tiendaAuthRecuperarBtn"
                    onClick={() => {
                      setMostrarPanelRecuperarCliente(true);
                      setRecuperacionClienteMensaje('');
                      if (!recuperarClienteEmail && credenciales.email) {
                        setRecuperarClienteEmail(String(credenciales.email || ''));
                      }
                    }}
                  >
                    Se te olvidó tu contraseña?
                  </button>
                </>
              ) : (
                <>
                  <div className="tiendaRegistroPasos">Paso {pasoRegistro} de 3</div>
                  {pasoRegistro === 1 && (
                    <div className="tiendaRegistroCamposGrid">
                      <input
                        placeholder="Nombre(s)"
                        value={credenciales.nombre}
                        onChange={(e) => setCredenciales((p) => ({ ...p, nombre: e.target.value }))}
                        autoComplete="given-name"
                        required
                      />
                      <input
                        placeholder="Apellido paterno"
                        value={credenciales.apellido_paterno}
                        onChange={(e) => setCredenciales((p) => ({ ...p, apellido_paterno: e.target.value }))}
                        autoComplete="family-name"
                        required
                      />
                      <input
                        placeholder="Apellido materno"
                        value={credenciales.apellido_materno}
                        onChange={(e) => setCredenciales((p) => ({ ...p, apellido_materno: e.target.value }))}
                        autoComplete="additional-name"
                        required
                      />
                      <input
                        placeholder="Teléfono"
                        value={credenciales.telefono}
                        onChange={(e) => setCredenciales((p) => ({ ...p, telefono: e.target.value }))}
                        autoComplete="tel"
                        autoCorrect="off"
                        spellCheck={false}
                        inputMode="tel"
                      />
                    </div>
                  )}
                  {pasoRegistro === 2 && (
                    <>
                      <input
                        type="email"
                        placeholder="Correo"
                        value={credenciales.email}
                        onChange={(e) => setCredenciales((p) => ({ ...p, email: e.target.value }))}
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        inputMode="email"
                        required
                      />
                      <SwitchConTexto
                        checked={Boolean(credenciales.recibe_promociones)}
                        onChange={(e) => setCredenciales((p) => ({ ...p, recibe_promociones: e.target.checked }))}
                        label="registrate a nuestras promociones y/o informacion"
                        ariaLabel="Suscribirme a promociones e información"
                      />
                    </>
                  )}
                  {pasoRegistro === 3 && (
                    <>
                      <PasswordInput
                        placeholder="Contraseña"
                        value={credenciales.password}
                        onChange={(e) => setCredenciales((p) => ({ ...p, password: e.target.value }))}
                        autoComplete="new-password"
                        required
                      />
                      <PasswordInput
                        placeholder="Confirmar contraseña"
                        value={credenciales.confirmarPassword}
                        onChange={(e) => setCredenciales((p) => ({ ...p, confirmarPassword: e.target.value }))}
                        autoComplete="new-password"
                        required
                      />
                    </>
                  )}
                </>
              )}

              {modoAuth === 'login' ? (
                <div className="tiendaAuthAcciones tiendaAuthAccionesLogin">
                  <button className={`boton botonExito ${errorAuthCliente ? 'tiendaAuthBotonError' : ''}`.trim()} type="submit" disabled={enviandoAuthCliente}>{enviandoAuthCliente ? 'Entrando...' : 'Entrar'}</button>
                  <button
                    className="boton"
                    type="button"
                    disabled={enviandoAuthCliente}
                    onClick={() => {
                      limpiarErrorAuthCliente();
                      setModoAuth('register');
                      setPasoRegistro(1);
                      reiniciarTurnstileAuthCliente();
                    }}
                  >
                    Crear cuenta nueva
                  </button>
                </div>
              ) : (
                <div className="tiendaAuthAcciones tiendaAuthAccionesRegistro">
                  {pasoRegistro > 1 && (
                    <button type="button" className="boton" disabled={enviandoAuthCliente} onClick={() => setPasoRegistro((p) => Math.max(1, p - 1))}>Atrás</button>
                  )}
                  {pasoRegistro < 3 ? (
                    <button type="button" className="boton botonExito" disabled={enviandoAuthCliente} onClick={avanzarPasoRegistro}>Siguiente</button>
                  ) : (
                    <button className="boton botonExito" type="submit" disabled={enviandoAuthCliente}>{enviandoAuthCliente ? 'Guardando...' : 'Completar registro'}</button>
                  )}
                  <button
                    className="boton"
                    type="button"
                    disabled={enviandoAuthCliente}
                    onClick={() => {
                      limpiarErrorAuthCliente();
                      setModoAuth('login');
                      setPasoRegistro(1);
                      reiniciarTurnstileAuthCliente();
                    }}
                  >
                    Ya tengo cuenta
                  </button>
                </div>
              )}
            </form>

            {modoAuth === 'login' && mostrarPanelRecuperarCliente && (
              <div
                className="tiendaMiniModalRecuperarPassword"
                onClick={() => {
                  setMostrarPanelRecuperarCliente(false);
                  setRecuperacionClienteMensaje('');
                  reiniciarTurnstileRecuperacionCliente();
                }}
              >
                <div className="tiendaMiniModalRecuperarPasswordCard" onClick={(e) => e.stopPropagation()}>
                  <h3>Recuperar contraseña</h3>
                  <p>Escribe tu correo registrado. Si existe en el sistema, te enviaremos una contraseña temporal.</p>
                  <div className="tiendaMiniModalRecuperarPasswordForm">
                    <input
                      className="tiendaMiniModalRecuperarPasswordInput"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={recuperarClienteEmail}
                      onChange={(e) => setRecuperarClienteEmail(e.target.value)}
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="email"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          enviarRecuperacionCliente();
                        }
                      }}
                      required
                    />
                    {TURNSTILE_PUBLIC_AUTH_ENABLED && (
                      <div className="tiendaTurnstileWrap tiendaTurnstileWrapRecuperacion tiendaTurnstileWrapRecuperacionModal">
                        <TurnstileWidget
                          key={`recover-${recuperacionTurnstileResetKey}`}
                          action="tienda_recovery"
                          onVerify={(token) => setRecuperacionTurnstileToken(token)}
                          onExpire={() => setRecuperacionTurnstileToken('')}
                          onError={() => setRecuperacionTurnstileToken('')}
                        />
                      </div>
                    )}
                    {!!recuperacionClienteMensaje && <div className="tiendaAuthRecuperarMsg">{recuperacionClienteMensaje}</div>}
                    <div className="tiendaMiniModalRecuperarPasswordAcciones">
                      <button
                        type="button"
                        className="boton botonExito"
                        disabled={enviandoRecuperacionCliente}
                        onClick={() => enviarRecuperacionCliente()}
                      >
                        {enviandoRecuperacionCliente ? 'Enviando...' : 'Enviar correo'}
                      </button>
                      <button
                        type="button"
                        className="boton"
                        onClick={() => {
                          setMostrarPanelRecuperarCliente(false);
                          setRecuperacionClienteMensaje('');
                          reiniciarTurnstileRecuperacionCliente();
                        }}
                        disabled={enviandoRecuperacionCliente}
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {modalCambioPasswordCliente.visible && (
        <div className="modal" style={{ display: 'flex' }} onClick={(e) => e.stopPropagation()}>
          <div className="contenidoModal tiendaAuthModal tiendaCambioPasswordModal" onClick={(e) => e.stopPropagation()}>
            <div className="tiendaAuthHeader">
              <h3 className="tiendaAuthTitulo">Actualiza tu contraseña</h3>
              <p className="tiendaAuthSubtitulo">Iniciaste con una contraseña temporal. Crea una nueva para continuar.</p>
            </div>
            <form className="tiendaAuth" onSubmit={guardarNuevaPasswordCliente}>
              <PasswordInput
                placeholder="Nueva contraseña"
                value={modalCambioPasswordCliente.nueva}
                onChange={(e) => setModalCambioPasswordCliente((prev) => ({ ...prev, nueva: e.target.value }))}
                required
              />
              <PasswordInput
                placeholder="Confirmar nueva contraseña"
                value={modalCambioPasswordCliente.confirmar}
                onChange={(e) => setModalCambioPasswordCliente((prev) => ({ ...prev, confirmar: e.target.value }))}
                required
              />
              <div className="tiendaCambioPasswordPregunta">
                <div className="tiendaCambioPasswordPreguntaTitulo">¿Cerrar sesión en tus otros dispositivos?</div>
                <div className="tiendaCambioPasswordOpciones">
                  <label className="tiendaCambioPasswordOpcion">
                    <input
                      type="radio"
                      name="cerrarSesionesPassword"
                      checked={Boolean(modalCambioPasswordCliente.cerrarSesiones)}
                      onChange={() => setModalCambioPasswordCliente((prev) => ({ ...prev, cerrarSesiones: true }))}
                    />
                    Sí, cerrar las demás sesiones
                  </label>
                  <label className="tiendaCambioPasswordOpcion">
                    <input
                      type="radio"
                      name="cerrarSesionesPassword"
                      checked={!Boolean(modalCambioPasswordCliente.cerrarSesiones)}
                      onChange={() => setModalCambioPasswordCliente((prev) => ({ ...prev, cerrarSesiones: false }))}
                    />
                    No, mantener sesiones
                  </label>
                </div>
              </div>
              <div className="tiendaAuthAcciones tiendaAuthAccionesLogin">
                <button className="boton botonExito" type="submit" disabled={modalCambioPasswordCliente.guardando}>
                  {modalCambioPasswordCliente.guardando ? 'Guardando...' : 'Guardar contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!esVistaTrastienda && <footer className="tiendaFooter">
        <div className="tiendaFooterCol tiendaFooterColMarca">
          <h4>{configTienda.footer_marca_titulo}</h4>
          <p>{configTienda.footer_marca_texto}</p>
          {!!redesDisponibles.length && (
            <div className="tiendaFooterRedes tiendaFooterRedesDesktop">
              {redesDisponibles.map((red) => (
                <div key={`red-footer-${red.clave}`} className="tiendaRedSocialItem">
                  <a
                    href={red.url}
                    target="_blank"
                    rel="noreferrer"
                    className="tiendaRedSocialBtn"
                    title={red.label}
                    aria-label={red.label}
                  >
                    {red.logo
                      ? <img src={red.logo} alt={red.label} className="tiendaRedSocialImg" />
                      : red.icono}
                  </a>
                  <span className="tiendaRedSocialPerfil">{obtenerNombrePerfilRed(red.url, red.clave)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="tiendaFooterCol tiendaFooterColAtencion">
          <h4>Atención al cliente</h4>
          {String(horariosAtencion.lunesViernes || '').trim() && (
            <p className="tiendaFooterHorario"><strong>Lunes a viernes:</strong><span>{horariosAtencion.lunesViernes}</span></p>
          )}
          {String(horariosAtencion.sabado || '').trim() && (
            <p className="tiendaFooterHorario"><strong>Sábado:</strong><span>{horariosAtencion.sabado}</span></p>
          )}
          {String(horariosAtencion.domingo || '').trim() && (
            <p className="tiendaFooterHorario"><strong>Domingo:</strong><span>{horariosAtencion.domingo}</span></p>
          )}
          {String(configTienda.atencion_correo || '').trim() && (
            <p>
              <a href={`mailto:${String(configTienda.atencion_correo || '').trim()}`}>
                {configTienda.atencion_correo}
              </a>
            </p>
          )}
        </div>
        {!!redesDisponibles.length && (
          <div className="tiendaFooterRedes tiendaFooterRedesMovil">
            {redesDisponibles.map((red) => (
              <div key={`red-footer-movil-${red.clave}`} className="tiendaRedSocialItem">
                <a
                  href={red.url}
                  target="_blank"
                  rel="noreferrer"
                  className="tiendaRedSocialBtn"
                  title={red.label}
                  aria-label={red.label}
                >
                  {red.logo
                    ? <img src={red.logo} alt={red.label} className="tiendaRedSocialImg" />
                    : red.icono}
                </a>
                <span className="tiendaRedSocialPerfil">{obtenerNombrePerfilRed(red.url, red.clave)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="tiendaFooterCol tiendaFooterColInfo">
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
          <div className="tiendaFooterPagos tiendaFooterPagosDesktop">
            {metodosPagoRenderFooter.length ? (
              <div className="tiendaFooterPagosLogosWrap">
                {metodosPagoRenderFooter.map((metodo, idx) => (
                  String(metodo?.logo_render_url || '').trim() ? (
                    <span key={`footer-logo-pago-${metodo.id}-${idx}`} className="tiendaFooterPagoLogoItem">
                      <img
                        src={String(metodo.logo_render_url).trim()}
                        alt={metodo?.label || `Método de pago ${idx + 1}`}
                        className="tiendaFooterPagosLogos"
                        loading="lazy"
                      />
                    </span>
                  ) : (
                    <span key={`footer-txt-pago-${metodo.id}-${idx}`} className="tiendaFooterPagoTextoItem">
                      {metodo?.label || `Método de pago ${idx + 1}`}
                    </span>
                  )
                ))}
              </div>
            ) : (
              <span>{configTienda.footer_pagos_texto}</span>
            )}
          </div>
        </div>
        <div className="tiendaFooterPagos tiendaFooterPagosMovil">
          {metodosPagoRenderFooter.length ? (
            <div className="tiendaFooterPagosLogosWrap">
              {metodosPagoRenderFooter.map((metodo, idx) => (
                String(metodo?.logo_render_url || '').trim() ? (
                  <span key={`footer-logo-pago-movil-${metodo.id}-${idx}`} className="tiendaFooterPagoLogoItem">
                    <img
                      src={String(metodo.logo_render_url).trim()}
                      alt={metodo?.label || `Método de pago ${idx + 1}`}
                      className="tiendaFooterPagosLogos"
                      loading="lazy"
                    />
                  </span>
                ) : (
                  <span key={`footer-txt-pago-movil-${metodo.id}-${idx}`} className="tiendaFooterPagoTextoItem">
                    {metodo?.label || `Método de pago ${idx + 1}`}
                  </span>
                )
              ))}
            </div>
          ) : (
            <span>{configTienda.footer_pagos_texto}</span>
          )}
        </div>
      </footer>}

      {!esVistaTrastienda && String(configTienda.whatsapp_numero || '').trim() && (
        <>
        {mostrarWhatsForm && (
          <div className="tiendaWhatsPanel" role="dialog" aria-label="Enviar mensaje por WhatsApp">
            <div className="tiendaWhatsPanelHead">
              <div>
                <strong>Escríbenos por WhatsApp</strong>
                <p className="tiendaWhatsPanelSub">Respuesta rápida en horario de atención</p>
              </div>
              <button type="button" className="tiendaWhatsCerrarBtn" onClick={() => setMostrarWhatsForm(false)}>Cerrar</button>
            </div>
            <label className="tiendaWhatsLabel" htmlFor="tienda-whats-nombre">Tu nombre</label>
            <input
              id="tienda-whats-nombre"
              className="tiendaWhatsInput"
              type="text"
              placeholder="Tu nombre"
              value={whatsForm.nombre}
              onChange={(e) => setWhatsForm((prev) => ({ ...prev, nombre: e.target.value }))}
            />
            <label className="tiendaWhatsLabel" htmlFor="tienda-whats-mensaje">Mensaje</label>
            <textarea
              id="tienda-whats-mensaje"
              className="tiendaWhatsTextarea"
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
                className="boton botonExito tiendaWhatsEnviarBtn"
                onClick={enviarMensajeWhatsDesdePagina}
                disabled={whatsMensajeInvalido}
              >Enviar</button>
            </div>
          </div>
        )}
        <button
          type="button"
          className="tiendaWhatsFab"
          title={mostrarWhatsForm ? 'Cerrar chat' : 'Abrir WhatsApp'}
          aria-label={mostrarWhatsForm ? 'Cerrar chat' : 'Abrir WhatsApp'}
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

      {modalResetContadoresAdmin.visible && (
        <div className="modal tiendaModalTop" style={{ display: 'flex' }} onClick={cerrarModalResetContadoresAdmin}>
          <div className="contenidoModal tiendaAuthModal tiendaAdminResetModal" onClick={(e) => e.stopPropagation()}>
            <div className="encabezadoModal">
              <h3>Reiniciar contadores de pedidos</h3>
              <button className="cerrarModal" type="button" onClick={cerrarModalResetContadoresAdmin} disabled={procesandoPedidosAdmin}>&times;</button>
            </div>
            <div className="tiendaAdminResetModalBody">
              <p className="tiendaAdminResetAviso">
                Esta acción eliminará todos los pedidos y reiniciará los contadores de folios.
                Para confirmar, ingresa la contraseña del admin.
              </p>
              <div className="tiendaAdminResetPasswordRow">
                <PasswordInput
                  value={modalResetContadoresAdmin.password}
                  onChange={(e) => setModalResetContadoresAdmin((prev) => ({ ...prev, password: e.target.value }))}
                  inputClassName="tiendaAdminResetPasswordInput"
                  placeholder="Contraseña del admin"
                  disabled={procesandoPedidosAdmin}
                />
              </div>
              <div className="tiendaAdminResetAcciones">
                <button className="boton" type="button" onClick={cerrarModalResetContadoresAdmin} disabled={procesandoPedidosAdmin}>Cancelar</button>
                <button className="boton botonEliminar" type="button" onClick={reiniciarContadoresPedidosAdmin} disabled={procesandoPedidosAdmin}>
                  {procesandoPedidosAdmin ? 'Procesando...' : 'Confirmar reinicio'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrandoPreviewCorreo && (
        <div className="modal tiendaModalTop" style={{ display: 'flex' }} onClick={() => setMostrandoPreviewCorreo(false)}>
          <div className="contenidoModal tiendaAuthModal tiendaPreviewCorreoModal" onClick={(e) => e.stopPropagation()}>
            <div className="encabezadoModal">
              <h3>Vista previa del correo</h3>
              <button className="cerrarModal" type="button" onClick={() => setMostrandoPreviewCorreo(false)}>&times;</button>
            </div>
            <div className="tiendaPreviewCorreoSelector">
              <label htmlFor="previewTipoCorreo"><strong>Tipo:</strong></label>
              <select
                id="previewTipoCorreo"
                value={previewTipoCorreo}
                onChange={(e) => abrirVistaPreviaCorreoAdmin(e.target.value)}
                disabled={cargandoPreviewCorreo}
              >
                <option value="campana">Campaña</option>
                <option value="bienvenida">Bienvenida de registro</option>
                <option value="confirmacion">Confirmación de pedido</option>
                <option value="estado">Actualización de estado</option>
                <option value="diagnostico">Diagnóstico</option>
              </select>
            </div>
            {cargandoPreviewCorreo ? (
              <div className="tiendaAdminSubtexto">Generando vista previa...</div>
            ) : (
              <div className="tiendaPreviewCorreoContenido">
                <div className="tiendaAdminSubtexto"><strong>Asunto:</strong> {previewCorreoAsunto || '(sin asunto)'}</div>
                <iframe
                  title="Vista previa correo cliente"
                  className="tiendaPreviewCorreoFrame"
                  srcDoc={previewCorreoHtml || '<div style="padding:16px;font-family:Arial,sans-serif;">No se pudo generar la vista previa.</div>'}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {procesandoPagoMp && (
        <div className="modal tiendaModalTop" style={{ display: 'flex' }} onClick={(e) => e.stopPropagation()}>
          <div className="contenidoModal tiendaPagoProcesoModal" onClick={(e) => e.stopPropagation()}>
            <div className="encabezadoModal">
              <h3>Procesando pago</h3>
            </div>
            <div className="tiendaPagoProcesoContenido">
              <div className="tiendaPagoProcesoSpinner" aria-hidden="true" />
              <p>Confirmando el pago en Mercado Pago y generando tu pedido...</p>
              <small>No cierres esta ventana.</small>
            </div>
          </div>
        </div>
      )}

      {mostrarBotonArribaTienda && (
        <button
          type="button"
          className="tiendaBotonSubir"
          onClick={() => {
            const contenedor = contenedorScrollRef.current;
            if (contenedor && typeof contenedor.scrollTo === 'function') {
              contenedor.scrollTo({ top: 0, behavior: 'smooth' });
              return;
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          title="Volver al inicio"
          aria-label="Volver al inicio"
        >
          ↑
        </button>
      )}
    </div>
  );
}

export default Tienda;
