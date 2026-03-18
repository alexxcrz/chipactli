import React, { useEffect, useState } from 'react';
import './inventario.css';
import Utensilios from '../utensilios/Utensilios.jsx';
import { mostrarNotificacion } from '../../utils/notificaciones.jsx';
import { abrirModal, cerrarModal, mostrarConfirmacion } from '../../utils/modales.jsx';
import { API } from '../../utils/config.jsx';
import { fetchAPI, fetchAPIJSON } from '../../utils/api.jsx';
import { normalizarTextoBusqueda } from '../../utils/texto.jsx';

let tabActiva = 'inventario';
let tabOrdenesActiva = 'lista-insumos';
let tabOrdenesCompraActiva = 'creadas';
let inventarioData = [];
let listaInsumosOrdenData = [];
let listaPreciosArchivosData = [];
let archivoListaPreciosPendiente = null;
let busquedaArchivoListaPrecios = '';
let itemsOrdenTemporal = [];
let proveedoresCatalogo = [];
let proveedoresMaestros = [];
let proveedorFiltroTexto = '';
let proveedoresUsoMapa = new Map();
let proveedorPendienteEliminar = null;
let usoProveedorPendiente = { inventario: 0, utensilios: 0, total: 0 };
let ordenesCompraCache = [];
let modalEditarItemOrdenId = null;
let modalSurtirItemOrdenId = null;
let modalEditarPrecioListaId = null;
let colaSurtidoOrden = [];
let indiceProveedorRapidoOrden = null;
const CLAVE_ULTIMO_PROVEEDOR_INSUMO = 'chipactli:ultimoProveedorInsumo';
const CLAVE_TAB_INVENTARIO_PRINCIPAL = 'chipactli:inventario:tabPrincipal';
const CLAVE_TAB_INVENTARIO_ORDENES = 'chipactli:inventario:tabOrdenes';
const CLAVE_TAB_INVENTARIO_ORDENES_COMPRA = 'chipactli:inventario:tabOrdenesCompra';

function leerTabPersistida(clave, permitidas, valorPorDefecto) {
  try {
    const valor = String(window.localStorage.getItem(clave) || '').trim();
    return permitidas.includes(valor) ? valor : valorPorDefecto;
  } catch {
    return valorPorDefecto;
  }
}

function guardarTabPersistida(clave, valor) {
  try {
    window.localStorage.setItem(clave, valor);
  } catch {
  }
}

tabActiva = leerTabPersistida(CLAVE_TAB_INVENTARIO_PRINCIPAL, ['inventario', 'utensilios', 'ordenes'], tabActiva);
tabOrdenesActiva = leerTabPersistida(CLAVE_TAB_INVENTARIO_ORDENES, ['lista-insumos', 'nueva', 'ordenes', 'proveedores'], tabOrdenesActiva);
tabOrdenesCompraActiva = leerTabPersistida(CLAVE_TAB_INVENTARIO_ORDENES_COMPRA, ['creadas', 'historial-surtidas'], tabOrdenesCompraActiva);

function texto(a) {
  return String(a || '');
}

function cmpTexto(a, b) {
  return texto(a).localeCompare(texto(b), 'es', { sensitivity: 'base' });
}

function abrevUnidad(unidad) {
  const u = texto(unidad).toLowerCase().trim();
  if (u === 'gotas' || u === 'gota' || u === 'go') return 'go';
  return u;
}

function normalizarUnidadSelectInventario(unidad) {
  const u = texto(unidad).toLowerCase().trim();
  if (!u) return '';
  if (u === 'go' || u === 'gota' || u === 'gotas') return 'go';
  if (u === 'gramo' || u === 'gramos') return 'g';
  if (u === 'kilogramo' || u === 'kilogramos') return 'kg';
  if (u === 'mililitro' || u === 'mililitros') return 'ml';
  if (u === 'litro' || u === 'litros') return 'l';
  if (u === 'pieza' || u === 'piezas') return 'pz';
  if (u === 'cucharada' || u === 'cucharadas') return 'cda';
  if (u === 'cucharadita' || u === 'cucharaditas') return 'cdta';
  if (u === 'tazas') return 'taza';
  if (u === 'onza' || u === 'onzas') return 'oz';
  return u;
}

function formatearFraccion(numerador, denominador) {
  if (!Number.isFinite(numerador) || !Number.isFinite(denominador) || denominador === 0) return '';
  const entero = Math.floor(numerador / denominador);
  const resto = numerador % denominador;
  if (!resto) return `${entero}`;
  if (!entero) return `${resto}/${denominador}`;
  return `${entero} ${resto}/${denominador}`;
}

function formatearCantidadComercial(cantidad, unidad) {
  const u = texto(unidad).toLowerCase().trim();
  const q = Number(cantidad || 0);
  if (!Number.isFinite(q) || q <= 0) return `0 ${abrevUnidad(unidad)}`;

  if (u === 'g' || u === 'gr' || u === 'gm' || u === 'gramo' || u === 'gramos') {
    if (q >= 500) {
      const cuartos = Math.round((q / 1000) * 4);
      if (Math.abs((cuartos / 4) - (q / 1000)) < 0.001) {
        return `${formatearFraccion(cuartos, 4)} kg`;
      }
      return `${(q / 1000).toFixed(2)} kg`;
    }
    return `${q.toFixed(2)} g`;
  }

  if (u === 'ml' || u === 'mililitro' || u === 'mililitros') {
    if (q >= 500) {
      const cuartos = Math.round((q / 1000) * 4);
      if (Math.abs((cuartos / 4) - (q / 1000)) < 0.001) {
        return `${formatearFraccion(cuartos, 4)} L`;
      }
      return `${(q / 1000).toFixed(2)} L`;
    }
    return `${q.toFixed(2)} ml`;
  }

  if (u === 'gota' || u === 'gotas' || u === 'go') {
    const gramosAprox = q / 20;
    if (gramosAprox >= 500) {
      const cuartos = Math.round((gramosAprox / 1000) * 4);
      if (Math.abs((cuartos / 4) - (gramosAprox / 1000)) < 0.001) {
        return `${formatearFraccion(cuartos, 4)} kg aprox`;
      }
      return `${(gramosAprox / 1000).toFixed(2)} kg aprox`;
    }
    return `${gramosAprox.toFixed(2)} g aprox`;
  }

  return `${q.toFixed(2)} ${abrevUnidad(unidad)}`;
}

function formatearFechaVariante(fechaIso) {
  const fecha = String(fechaIso || '').trim();
  if (!fecha) return '-';
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('es-MX');
}

function esPdfArchivoLista(tipo, url) {
  const mime = texto(tipo).toLowerCase();
  const ruta = texto(url).toLowerCase();
  return mime === 'application/pdf' || ruta.endsWith('.pdf');
}

function escapeHtml(s) {
  return texto(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escaparParaInlineJs(valor) {
  return texto(valor)
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replace(/\r?\n/g, ' ');
}

function agruparPorProveedor(lista = []) {
  const mapa = new Map();
  (Array.isArray(lista) ? lista : []).forEach((it) => {
    const prov = texto(it?.proveedor).trim() || 'Sin proveedor';
    if (!mapa.has(prov)) mapa.set(prov, []);
    mapa.get(prov).push(it);
  });
  return Array.from(mapa.entries())
    .sort((a, b) => cmpTexto(a[0], b[0]))
    .map(([proveedor, items]) => ({ proveedor, items: items.sort((a, b) => cmpTexto(a?.nombre, b?.nombre)) }));
}

function setTab(tab) {
  tabActiva = ['inventario', 'utensilios', 'ordenes'].includes(tab) ? tab : 'inventario';
  guardarTabPersistida(CLAVE_TAB_INVENTARIO_PRINCIPAL, tabActiva);
  const panelInv = document.getElementById('panelInv');
  const panelUt = document.getElementById('panelUt');
  const panelOc = document.getElementById('panelOc');
  const btnInv = document.getElementById('btnTabInv');
  const btnUt = document.getElementById('btnTabUt');
  const btnOc = document.getElementById('btnTabOc');
  if (panelInv) panelInv.style.display = tabActiva === 'inventario' ? '' : 'none';
  if (panelUt) panelUt.style.display = tabActiva === 'utensilios' ? '' : 'none';
  if (panelOc) panelOc.style.display = tabActiva === 'ordenes' ? '' : 'none';
  if (btnInv) btnInv.classList.toggle('activo', tabActiva === 'inventario');
  if (btnUt) btnUt.classList.toggle('activo', tabActiva === 'utensilios');
  if (btnOc) btnOc.classList.toggle('activo', tabActiva === 'ordenes');

  if (tabActiva === 'ordenes') {
    cargarCatalogoProveedores();
    cargarInsumosOrden();
    cargarListaInsumosOrdenes();
    cargarArchivosListaPrecios();
    renderItemsTemporales();
    renderListaInsumosOrden();
    cargarOrdenesRegistradas();
    cargarHistorialOrdenesSurtidas();
    setTabOrdenes(tabOrdenesActiva);
  }
}

async function cargarListaInsumosOrdenes() {
  try {
    const data = await fetchAPIJSON(`${API}/inventario/lista-insumos-ordenes`);
    listaInsumosOrdenData = Array.isArray(data?.items) ? data.items : [];
  } catch {
    listaInsumosOrdenData = [];
  }
  renderListaInsumosOrden();
}

async function cargarArchivosListaPrecios() {
  try {
    const q = texto(busquedaArchivoListaPrecios).trim();
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    const data = await fetchAPIJSON(`${API}/inventario/lista-precios/archivos${qs}`);
    listaPreciosArchivosData = Array.isArray(data?.archivos) ? data.archivos : [];
  } catch {
    listaPreciosArchivosData = [];
  }
  renderArchivosListaPrecios();
}

function renderArchivosListaPrecios() {
  const cont = document.getElementById('listaArchivosListaPrecios');
  if (!cont) return;
  const arr = Array.isArray(listaPreciosArchivosData) ? listaPreciosArchivosData : [];
  if (!arr.length) {
    cont.innerHTML = '<div style="color:#666;padding:8px 0">Sin archivos cargados en Lista de precios.</div>';
    return;
  }

  cont.innerHTML = arr.map((item) => {
    const id = Number(item?.id || 0);
    const nombre = escapeHtml(texto(item?.nombre || 'Archivo'));
    const proveedor = escapeHtml(texto(item?.proveedor || 'Sin proveedor'));
    const url = escapeHtml(texto(item?.url || ''));
    const tipo = escapeHtml(texto(item?.tipo || ''));
    const fecha = escapeHtml(formatearFechaVariante(item?.creado_en));
    const preview = esPdfArchivoLista(item?.tipo, item?.url)
      ? `<iframe src="${url}" style="width:100%;min-height:300px;border:1px solid #ddd;border-radius:8px;background:#fff"></iframe>`
      : `<iframe src="${url}" style="width:100%;min-height:300px;border:1px solid #ddd;border-radius:8px;background:#fff"></iframe>`;

    return `
      <div style="border:1px solid #d9e1dc;border-radius:10px;padding:10px;margin-bottom:10px;background:#fafdfb">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
          <div>
            <strong>${nombre}</strong><br/>
            <small style="color:#666">Proveedor: ${proveedor} · ${tipo || 'tipo no especificado'} · ${fecha}</small>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <a class="botonPequeno" href="${url}" download>Descargar</a>
            <button class="botonPequeno botonDanger" type="button" onclick="window.inventario.eliminarArchivoListaPrecios(${id})">Eliminar</button>
          </div>
        </div>
        ${preview}
      </div>
    `;
  }).join('');
}

function seleccionarArchivoListaPrecios(evento) {
  const input = evento?.target;
  archivoListaPreciosPendiente = input?.files?.[0] || null;
}

function buscarArchivosListaPrecios(valor) {
  busquedaArchivoListaPrecios = texto(valor).trim();
  cargarArchivosListaPrecios();
}

async function subirArchivoListaPrecios() {
  const archivo = archivoListaPreciosPendiente;
  if (!archivo) return;

  const proveedorInput = document.getElementById('proveedorArchivoListaPrecios');
  const proveedor = texto(proveedorInput?.value || '').trim();
  if (!proveedor) {
    mostrarNotificacion('Escribe el nombre del proveedor', 'error');
    return;
  }

  try {
    const token = texto(window.localStorage.getItem('token')).trim();
    if (!token) throw new Error('No hay sesión activa');

    const fd = new FormData();
    fd.append('archivo', archivo);
    const response = await fetch(`${API}/api/uploads/lista-precios-archivo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.url) {
      throw new Error(data?.mensaje || data?.error || 'No se pudo subir archivo');
    }

    let contenidoTexto = texto(data?.texto_extraido || '').trim();
    if (!contenidoTexto) {
      try {
        const textoLocal = await archivo.text();
        contenidoTexto = texto(textoLocal).slice(0, 200000);
      } catch {
        contenidoTexto = '';
      }
    }

    await fetchAPIJSON(`${API}/inventario/lista-precios/archivos`, {
      method: 'POST',
      body: {
        nombre: data?.nombre_original || archivo?.name || 'Archivo lista de precios',
        proveedor,
        url: data?.url || '',
        tipo: data?.tipo || archivo?.type || '',
        contenido_texto: contenidoTexto
      }
    });

    mostrarNotificacion('Archivo cargado en Lista de precios', 'exito');
    if (proveedorInput) proveedorInput.value = '';
    const fileInput = document.getElementById('archivoListaPreciosInput');
    if (fileInput) fileInput.value = '';
    archivoListaPreciosPendiente = null;
    await cargarArchivosListaPrecios();
  } catch (error) {
    mostrarNotificacion(error?.message || 'No se pudo cargar archivo', 'error');
  }
}

async function eliminarArchivoListaPrecios(idArchivo) {
  const id = Number(idArchivo || 0);
  if (!Number.isFinite(id) || id <= 0) return;
  const ok = await mostrarConfirmacion('¿Eliminar este archivo de Lista de precios?', 'Eliminar archivo');
  if (!ok) return;
  try {
    await fetchAPIJSON(`${API}/inventario/lista-precios/archivos/${id}`, { method: 'DELETE' });
    mostrarNotificacion('Archivo eliminado', 'exito');
    await cargarArchivosListaPrecios();
  } catch (error) {
    mostrarNotificacion(error?.message || 'No se pudo eliminar archivo', 'error');
  }
}

function setTabOrdenes(tab) {
  tabOrdenesActiva = ['lista-insumos', 'nueva', 'ordenes', 'proveedores'].includes(tab) ? tab : 'lista-insumos';
  guardarTabPersistida(CLAVE_TAB_INVENTARIO_ORDENES, tabOrdenesActiva);
  const barraBusquedaGeneral = document.getElementById('barraBusquedaOrdenesGeneral');
  const panelListaInsumos = document.getElementById('panelOrdenListaInsumos');
  const panelNueva = document.getElementById('panelOrdenNueva');
  const panelOrdenes = document.getElementById('panelOrdenesCompra');
  const panelProveedores = document.getElementById('panelOrdenProveedores');

  const btnListaInsumos = document.getElementById('btnOcListaInsumos');
  const btnNueva = document.getElementById('btnOcNueva');
  const btnOrdenes = document.getElementById('btnOcOrdenes');
  const btnProveedores = document.getElementById('btnOcProveedores');

  if (panelListaInsumos) panelListaInsumos.style.display = tabOrdenesActiva === 'lista-insumos' ? '' : 'none';
  if (panelNueva) panelNueva.style.display = tabOrdenesActiva === 'nueva' ? '' : 'none';
  if (panelOrdenes) panelOrdenes.style.display = tabOrdenesActiva === 'ordenes' ? '' : 'none';
  if (panelProveedores) panelProveedores.style.display = tabOrdenesActiva === 'proveedores' ? '' : 'none';
  if (barraBusquedaGeneral) barraBusquedaGeneral.style.display = tabOrdenesActiva === 'proveedores' ? 'none' : '';

  if (btnListaInsumos) btnListaInsumos.classList.toggle('activo', tabOrdenesActiva === 'lista-insumos');
  if (btnNueva) btnNueva.classList.toggle('activo', tabOrdenesActiva === 'nueva');
  if (btnOrdenes) btnOrdenes.classList.toggle('activo', tabOrdenesActiva === 'ordenes');
  if (btnProveedores) btnProveedores.classList.toggle('activo', tabOrdenesActiva === 'proveedores');

  if (tabOrdenesActiva === 'ordenes') setTabOrdenesCompra(tabOrdenesCompraActiva);
  if (tabOrdenesActiva === 'proveedores') cargarProveedoresMaestros();
  if (tabOrdenesActiva === 'lista-insumos') {
    cargarArchivosListaPrecios();
  }
}

function setTabOrdenesCompra(tab) {
  tabOrdenesCompraActiva = ['creadas', 'historial-surtidas'].includes(tab) ? tab : 'creadas';
  guardarTabPersistida(CLAVE_TAB_INVENTARIO_ORDENES_COMPRA, tabOrdenesCompraActiva);
  const panelCreadas = document.getElementById('panelOrdenesCreadas');
  const panelHistorial = document.getElementById('panelOrdenesSurtidas');
  const btnCreadas = document.getElementById('btnOrdenCompraCreadas');
  const btnHistorial = document.getElementById('btnOrdenCompraHistorial');

  if (panelCreadas) panelCreadas.style.display = tabOrdenesCompraActiva === 'creadas' ? '' : 'none';
  if (panelHistorial) panelHistorial.style.display = tabOrdenesCompraActiva === 'historial-surtidas' ? '' : 'none';
  if (btnCreadas) btnCreadas.classList.toggle('activo', tabOrdenesCompraActiva === 'creadas');
  if (btnHistorial) btnHistorial.classList.toggle('activo', tabOrdenesCompraActiva === 'historial-surtidas');
}

async function cargarCatalogoProveedores() {
  const nombres = new Set();
  try {
    const data = await fetchAPIJSON(`${API}/inventario/proveedores/catalogo`);
    (data?.proveedores || []).forEach((n) => {
      const limpio = texto(n).trim();
      if (limpio) nombres.add(limpio);
    });
  } catch {
  }
  proveedoresCatalogo = Array.from(nombres).sort(cmpTexto);
  const select = document.getElementById('proveedorOrden');
  if (!select) return;
  const actual = texto(select.value).trim();
  select.innerHTML = `<option value="">Selecciona proveedor</option>${proveedoresCatalogo.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}`;
  if (actual) select.value = actual;
}

function obtenerProveedorRecienteGuardado() {
  try {
    return texto(window.localStorage.getItem(CLAVE_ULTIMO_PROVEEDOR_INSUMO)).trim();
  } catch {
    return '';
  }
}

function guardarProveedorReciente(proveedor) {
  const valor = texto(proveedor).trim();
  if (!valor) return;
  try {
    window.localStorage.setItem(CLAVE_ULTIMO_PROVEEDOR_INSUMO, valor);
  } catch {
  }
}

async function cargarOpcionesProveedorInsumo() {
  let proveedores = [];
  try {
    const data = await fetchAPIJSON(`${API}/inventario/proveedores`);
    proveedores = (Array.isArray(data) ? data : [])
      .map((p) => texto(p?.nombre).trim())
      .filter(Boolean)
      .sort(cmpTexto);
  } catch {
    proveedores = [];
  }

  const cargarSelectProveedor = (idSelect, preferido = '') => {
    const select = document.getElementById(idSelect);
    if (!select) return;
    const actual = texto(select.value).trim() || texto(preferido).trim();
    let opciones = [...proveedores];
    if (actual && !opciones.includes(actual)) opciones.push(actual);
    opciones = opciones.sort(cmpTexto);
    select.innerHTML = `<option value="">Selecciona proveedor</option>${opciones.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}`;
    if (actual) select.value = actual;
  };

  const reciente = obtenerProveedorRecienteGuardado();
  cargarSelectProveedor('proveedorInsumo', reciente);
  cargarSelectProveedor('editProveedorInsumo');

  const selectAgregar = document.getElementById('proveedorInsumo');
  if (selectAgregar && !texto(selectAgregar.value).trim() && reciente && proveedores.includes(reciente)) {
    selectAgregar.value = reciente;
  }
}

async function abrirModalAgregarInsumo() {
  await cargarOpcionesProveedorInsumo();
  abrirModal('modalInsumo');
}

function renderOpcionesProveedor(selected = '') {
  const valor = texto(selected).trim();
  const lista = [...proveedoresCatalogo];
  if (valor && !lista.includes(valor)) lista.push(valor);
  return `<option value="">Selecciona proveedor</option>${lista.sort(cmpTexto).map((p) => `<option value="${escapeHtml(p)}" ${p === valor ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}`;
}

async function cargarInventario() {
  try {
    inventarioData = await fetchAPIJSON(`${API}/inventario`);
    const cuerpo = document.getElementById('cuerpoInventario');
    if (!cuerpo) return;

    const lista = Array.isArray(inventarioData) ? inventarioData : [];
    const totalPendientes = lista.filter((ins) => Number(ins?.pendiente || 0) === 1).length;
    const botonPendientes = document.getElementById('btnPendientesInventario');
    if (botonPendientes) {
      botonPendientes.textContent = totalPendientes > 0
        ? `⏳ Revisar pendientes (${totalPendientes})`
        : '⏳ Revisar pendientes';
    }

    if (!lista.length) {
      cuerpo.innerHTML = '<tr><td colspan="11" style="text-align:center">No hay insumos</td></tr>';
      return;
    }

    cuerpo.innerHTML = '';
    const fragment = document.createDocumentFragment();
    agruparPorProveedor(lista).forEach((grupo) => {
      const filaGrupo = document.createElement('tr');
      filaGrupo.className = 'filaGrupoProveedorInventario';
      filaGrupo.innerHTML = `<td colspan="11">Proveedor: ${escapeHtml(grupo.proveedor)}</td>`;
      fragment.appendChild(filaGrupo);

      grupo.items.forEach((insumo) => {
        const activoConsumo = Number(insumo?.activo_consumo ?? 1) === 1;
        const esPendiente = Number(insumo?.pendiente || 0) === 1;
        const porcentaje = Number(insumo.cantidad_total || 0) > 0
          ? Math.min(100, Math.max(0, (Number(insumo.cantidad_disponible || 0) / Number(insumo.cantidad_total || 0)) * 100))
          : 0;
        const clase = porcentaje <= 25 ? 'porcentajeBajo' : porcentaje <= 50 ? 'porcentajeMedio' : 'porcentajeAlto';
        const fila = document.createElement('tr');
        if (esPendiente) fila.className = 'filaInventarioPendiente';
        fila.innerHTML = `
          <td>${esPendiente ? `<span class="codigoPendienteInventario">${escapeHtml(insumo.codigo || '')}</span>` : escapeHtml(insumo.codigo || '')}</td>
          <td>${escapeHtml(insumo.nombre || '')}</td>
          <td>${escapeHtml(insumo.proveedor || '') || '<span style="color:#999">Sin proveedor</span>'}</td>
          <td>${escapeHtml(abrevUnidad(insumo.unidad || ''))}</td>
          <td>${Number(insumo.cantidad_total || 0).toFixed(2)}</td>
          <td>${Number(insumo.cantidad_disponible || 0).toFixed(2)}</td>
          <td>$${Number(insumo.costo_total || 0).toFixed(2)}</td>
          <td>$${Number(insumo.costo_por_unidad || 0).toFixed(2)}</td>
          <td>
            <label class="switchConsumoInventario" title="${activoConsumo ? 'Este lote participa en recetas' : 'Este lote NO participa en recetas'}">
              <input type="checkbox" ${activoConsumo ? 'checked' : ''} onchange="window.inventario.cambiarActivoConsumo(${insumo.id}, this.checked)" />
              <span class="sliderConsumoInventario"></span>
            </label>
          </td>
          <td><div class="barraPorcentaje"><div class="barraPorcentajeRelleno ${clase}" style="width:${porcentaje.toFixed(0)}%"></div><span class="textoPorcentaje">${porcentaje.toFixed(0)}%</span></div></td>
          <td>
            <button onclick="window.inventario.editarInsumo(${insumo.id})" class="botonPequeno">✏️</button>
            <button data-nombre="${escapeHtml(insumo?.nombre || '')}" onclick="window.inventario.mostrarHistorialInsumoDesdeBoton(${insumo.id}, this)" class="botonPequeno">📜</button>
            <button onclick="window.inventario.eliminarInsumo(${insumo.id})" class="botonPequeno botonDanger">🗑️</button>
          </td>
        `;
        fragment.appendChild(fila);
      });
    });

    cuerpo.appendChild(fragment);
  } catch (error) {
    console.error('Error cargando inventario:', error);
  }
}

function mostrarPendientesInventario() {
  const modal = document.getElementById('modalPendientesInventario');
  const cuerpo = document.getElementById('cuerpoPendientesInventario');
  if (!modal || !cuerpo) return;

  const pendientes = (Array.isArray(inventarioData) ? inventarioData : [])
    .filter((item) => Number(item?.pendiente || 0) === 1)
    .sort((a, b) => cmpTexto(a?.nombre, b?.nombre));

  if (!pendientes.length) {
    cuerpo.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#666">No hay insumos pendientes</td></tr>';
  } else {
    cuerpo.innerHTML = pendientes.map((item) => `
      <tr class="filaInventarioPendiente">
        <td><span class="codigoPendienteInventario">${escapeHtml(item?.codigo || '')}</span></td>
        <td>${escapeHtml(item?.nombre || '')}</td>
        <td>${escapeHtml(item?.proveedor || '') || '<span style="color:#999">Sin proveedor</span>'}</td>
        <td>${escapeHtml(abrevUnidad(item?.unidad || ''))}</td>
        <td>
          <button class="botonPequeno" type="button" onclick="window.inventario.editarInsumo(${Number(item?.id || 0)}); window.inventario.cerrarModalPendientesInventario();">✏️ Editar</button>
        </td>
      </tr>
    `).join('');
  }

  abrirModal('modalPendientesInventario');
}

function cerrarModalPendientesInventario() {
  cerrarModal('modalPendientesInventario');
}

async function cargarEstadisticasInventario() {
  try {
    const est = await fetchAPIJSON(`${API}/inventario/estadisticas`);
    const totalEl = document.getElementById('totalInsumos');
    const invTotEl = document.getElementById('inversionTotal');
    const invRecEl = document.getElementById('inversionRecuperada');
    const invNetaEl = document.getElementById('inversionNeta');
    if (totalEl) totalEl.textContent = est.total_insumos || 0;
    if (invTotEl) invTotEl.textContent = `$${Number(est.inversion_total || 0).toFixed(2)}`;
    if (invRecEl) invRecEl.textContent = `$${Number(est.inversion_recuperada || 0).toFixed(2)}`;
    if (invNetaEl) invNetaEl.textContent = `$${Number(est.inversion_neta || 0).toFixed(2)}`;
  } catch (error) {
    console.error('Error cargando estadísticas:', error);
  }
}

async function cargarInsumosOrden() {
  try {
    const insumos = await fetchAPIJSON(`${API}/inventario`);
    inventarioData = Array.isArray(insumos) ? insumos : [];
    const select = document.getElementById('insumoOrden');
    if (!select) return;
    const actual = select.value;
    select.innerHTML = '<option value="">Selecciona un insumo</option>';
    agruparPorProveedor(inventarioData).forEach((g) => {
      const og = document.createElement('optgroup');
      og.label = g.proveedor;
      g.items.forEach((ins) => {
        const op = document.createElement('option');
        op.value = String(ins.id);
        op.textContent = `${ins.nombre} (${ins.codigo || 'SIN-COD'}${ins.unidad ? ` • ${abrevUnidad(ins.unidad)}` : ''})`;
        og.appendChild(op);
      });
      select.appendChild(og);
    });
    if (actual) select.value = actual;
  } catch (error) {
    console.error(error);
  }
}

function seleccionarInsumoOrden() {
  const id = Number(document.getElementById('insumoOrden')?.value || 0);
  const ins = inventarioData.find((i) => Number(i.id) === id);
  const unidad = document.getElementById('unidadOrden');
  if (unidad) unidad.value = normalizarUnidadSelectInventario(ins?.unidad || '');
  const prov = document.getElementById('proveedorOrden');
  if (prov && !texto(prov.value).trim() && ins?.proveedor) prov.value = ins.proveedor;
}

function agregarItemOrden() {
  const id = Number(document.getElementById('insumoOrden')?.value || 0);
  const cantidad = Number(document.getElementById('cantidadOrden')?.value || 0);
  const proveedor = texto(document.getElementById('proveedorOrden')?.value).trim();
  const ins = inventarioData.find((i) => Number(i.id) === id);
  if (!ins || !Number.isFinite(cantidad) || cantidad <= 0) {
    mostrarNotificacion('Selecciona un insumo y cantidad válida', 'error');
    return;
  }

  const existente = itemsOrdenTemporal.find((x) => Number(x.id_inventario) === Number(ins.id));
  if (existente) {
    existente.cantidad_requerida = Number(existente.cantidad_requerida || 0) + cantidad;
    existente.proveedor = proveedor || existente.proveedor || '';
  } else {
    itemsOrdenTemporal.push({
      id_inventario: ins.id,
      codigo: ins.codigo || '',
      nombre: ins.nombre || '',
      unidad: ins.unidad || '',
      proveedor: proveedor || (ins.proveedor || ''),
      cantidad_requerida: cantidad
    });
  }

  const c = document.getElementById('cantidadOrden');
  const s = document.getElementById('insumoOrden');
  const u = document.getElementById('unidadOrden');
  if (c) c.value = '';
  if (s) s.value = '';
  if (u) u.value = '';
  renderItemsTemporales();
}

function eliminarItemOrden(index) {
  itemsOrdenTemporal.splice(index, 1);
  renderItemsTemporales();
}

function actualizarProveedorItem(index, proveedor) {
  if (!Number.isInteger(index) || index < 0 || index >= itemsOrdenTemporal.length) return;
  itemsOrdenTemporal[index].proveedor = texto(proveedor).trim();
}

function agregarProveedorRapido(index = null) {
  indiceProveedorRapidoOrden = Number.isInteger(index) ? index : null;
  const input = document.getElementById('inputProveedorRapidoOrden');
  if (input) input.value = '';
  abrirModal('modalProveedorRapidoOrden');
}

function confirmarProveedorRapidoOrden(event) {
  if (event) event.preventDefault();
  const prov = texto(document.getElementById('inputProveedorRapidoOrden')?.value).trim();
  if (!prov) {
    mostrarNotificacion('Ingresa el nombre del proveedor', 'error');
    return;
  }

  if (!proveedoresCatalogo.includes(prov)) proveedoresCatalogo.push(prov);
  proveedoresCatalogo.sort(cmpTexto);

  if (Number.isInteger(indiceProveedorRapidoOrden) && indiceProveedorRapidoOrden >= 0 && indiceProveedorRapidoOrden < itemsOrdenTemporal.length) {
    itemsOrdenTemporal[indiceProveedorRapidoOrden].proveedor = prov;
    renderItemsTemporales();
  }

  const select = document.getElementById('proveedorOrden');
  if (select) {
    select.innerHTML = renderOpcionesProveedor(prov);
    select.value = prov;
  }

  indiceProveedorRapidoOrden = null;
  cerrarModal('modalProveedorRapidoOrden');
}

function renderItemsTemporales() {
  const tbody = document.getElementById('tablaItemsOrden');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!itemsOrdenTemporal.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#777">Agrega insumos para crear la orden</td></tr>';
    return;
  }

  [...itemsOrdenTemporal]
    .sort((a, b) => cmpTexto(a.proveedor || 'Sin proveedor', b.proveedor || 'Sin proveedor') || cmpTexto(a.nombre || '', b.nombre || ''))
    .forEach((item) => {
      const index = itemsOrdenTemporal.indexOf(item);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(item.nombre)} <small style="color:#666">(${escapeHtml(item.codigo || 'SIN-COD')}${item.unidad ? ` • ${escapeHtml(abrevUnidad(item.unidad))}` : ''})</small></td>
        <td>
          <div class="controlProveedorItemInventario">
            <select class="selectProvItem" data-index="${index}">${renderOpcionesProveedor(item.proveedor || '')}</select>
            <button class="botonPequeno" type="button" onclick="window.inventario.agregarProveedorRapido(${index})">+</button>
          </div>
        </td>
        <td>${Number(item.cantidad_requerida || 0).toFixed(2)}</td>
        <td><button class="botonPequeno botonDanger" onclick="window.inventario.eliminarItemOrden(${index})">×</button></td>
      `;
      tbody.appendChild(tr);
    });

  tbody.querySelectorAll('.selectProvItem').forEach((el) => {
    el.addEventListener('change', (e) => {
      const idx = Number(e.target?.getAttribute('data-index'));
      const v = texto(e.target?.value).trim();
      actualizarProveedorItem(idx, v);
    });
  });
}

async function crearOrden() {
  if (!itemsOrdenTemporal.length) {
    mostrarNotificacion('Agrega al menos un insumo a la orden', 'error');
    return;
  }
  const proveedor = texto(document.getElementById('proveedorOrden')?.value).trim();
  try {
    const out = await fetchAPIJSON(`${API}/recetas/ordenes-compra`, {
      method: 'POST',
      body: { proveedor, items: itemsOrdenTemporal }
    });
    itemsOrdenTemporal = [];
    renderItemsTemporales();
    mostrarNotificacion(`Orden creada (${out?.numero_orden || 'sin folio'})`, 'exito');
    await Promise.all([cargarOrdenesRegistradas(), cargarHistorialOrdenesSurtidas(), cargarInventario(), cargarEstadisticasInventario()]);
  } catch (error) {
    mostrarNotificacion(error?.message || 'Error al crear orden', 'error');
  }
}

function renderItemOrdenConAcciones(item) {
  const requerido = Number(item?.cantidad_requerida || 0);
  const surtida = Number(item?.cantidad_surtida || 0);
  const faltante = Math.max(0, requerido - surtida);
  const surtido = Number(item?.surtido || 0) === 1;
  const etiquetaEstado = surtido ? '<span style="color:#2e7d32">Surtido</span>' : `<span style="color:#ef6c00">Pendiente (${faltante.toFixed(2)})</span>`;

  return `
    <li>
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">
        <span>${escapeHtml(item?.nombre || '')} • ${requerido.toFixed(2)} ${escapeHtml(abrevUnidad(item?.unidad || ''))}</span>
        ${etiquetaEstado}
      </div>
      <div style="display:flex;gap:6px;margin-top:6px;justify-content:flex-end">
        <button class="botonPequeno" type="button" onclick="window.inventario.editarItemOrden(${Number(item?.id || 0)})">✏️ Editar</button>
        <button class="botonPequeno botonExito" type="button" onclick="window.inventario.surtirItemOrden(${Number(item?.id || 0)})" ${surtido ? 'disabled' : ''}>✅ Surtir</button>
      </div>
    </li>
  `;
}

function busquedaOrdenesActual() {
  return normalizarTextoBusqueda(document.getElementById('buscarOrdenesGeneral')?.value || '');
}

async function eliminarOrdenCompra(idOrden, numeroOrden = '') {
  const id = Number(idOrden);
  if (!Number.isFinite(id) || id <= 0) return;

  const ok = await mostrarConfirmacion(
    `Se eliminará la orden ${texto(numeroOrden || '').trim() || `#${id}`}. Esta acción no se puede deshacer.`,
    'Eliminar orden de compra'
  );
  if (!ok) return;

  try {
    await fetchAPIJSON(`${API}/recetas/ordenes-compra/${id}`, { method: 'DELETE' });
    mostrarNotificacion('Orden eliminada correctamente', 'exito');
    await Promise.all([cargarOrdenesRegistradas(), cargarHistorialOrdenesSurtidas(), cargarListaInsumosOrdenes()]);
  } catch (error) {
    mostrarNotificacion(error?.message || 'No se pudo eliminar la orden', 'error');
  }
}

function buscarItemOrdenPorId(idItem) {
  const id = Number(idItem);
  for (const orden of ordenesCompraCache) {
    const item = (orden.items || []).find((it) => Number(it?.id) === id);
    if (item) return { item, orden };
  }
  return { item: null, orden: null };
}

async function cargarOrdenes(targetId = 'listaOrdenes', filtro = 'creadas') {
  const cont = document.getElementById(targetId);
  if (!cont) return;
  try {
    const ordenesCrudas = await fetchAPIJSON(`${API}/recetas/ordenes-compra`);
    const busqueda = busquedaOrdenesActual();
    const ordenes = (Array.isArray(ordenesCrudas) ? ordenesCrudas : [])
      .map((o) => ({
        ...o,
        estado: texto(o?.estado || 'pendiente').toLowerCase(),
        proveedor: texto(o?.proveedor).trim() || 'Sin proveedor',
        items: (Array.isArray(o?.items) ? o.items : []).sort((a, b) => cmpTexto(a?.nombre, b?.nombre))
      }))
      .filter((o) => {
        if (filtro === 'historial-surtidas') return o.estado === 'surtida';
        return o.estado !== 'surtida';
      })
      .sort((a, b) => new Date(b?.fecha_creacion || 0).getTime() - new Date(a?.fecha_creacion || 0).getTime())
      .sort((a, b) => cmpTexto(a.proveedor, b.proveedor));

    if (filtro === 'creadas') {
      ordenesCompraCache = ordenes;
    }

    const filtradas = !busqueda
      ? ordenes
      : ordenes.filter((o) => {
        if (normalizarTextoBusqueda(o.proveedor).includes(busqueda)) return true;
        return (o.items || []).some((i) => normalizarTextoBusqueda(i?.nombre).includes(busqueda));
      });

    if (!filtradas.length) {
      cont.innerHTML = filtro === 'historial-surtidas'
        ? '<div class="mensajeSinRecetasEscalado">No hay órdenes surtidas en historial</div>'
        : '<div class="mensajeSinRecetasEscalado">Aún no hay órdenes de compra registradas</div>';
      return;
    }

    cont.innerHTML = filtradas.map((orden) => {
      const numeroOrdenSeguro = escaparParaInlineJs(orden?.numero_orden || '');
      const estado = texto(orden?.estado || 'pendiente');
      const estadoHtml = estado === 'surtida'
        ? '<span style="color:#2e7d32;font-weight:700">Surtida</span>'
        : '<span style="color:#ef6c00;font-weight:700">Pendiente</span>';
      return `
        <div class="itemOrdenCompraInventario">
          <div class="itemOrdenCompraInventarioHeader">
            <strong>${escapeHtml(orden.numero_orden || 'Sin folio')}</strong>
            <span>${escapeHtml(orden.proveedor)}</span>
            <span>${orden.fecha_creacion ? new Date(orden.fecha_creacion).toLocaleString() : ''}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
            <div>${estadoHtml}</div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              ${estado !== 'surtida' ? `<button class="botonPequeno botonExito" type="button" onclick="window.inventario.surtirOrdenCompleta(${Number(orden?.id || 0)})">✅ Surtir todo</button>` : ''}
              <button class="botonPequeno botonDanger" type="button" onclick="window.inventario.eliminarOrdenCompra(${Number(orden?.id || 0)}, '${numeroOrdenSeguro}')">🗑️ Eliminar</button>
            </div>
          </div>
          <ul>${(orden.items || []).map((item) => renderItemOrdenConAcciones(item)).join('') || '<li>Sin insumos</li>'}</ul>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error(error);
    cont.innerHTML = '<div class="mensajeSinRecetasEscalado">Error al cargar órdenes de compra</div>';
  }
}

async function cargarOrdenesRegistradas() {
  return cargarOrdenes('listaOrdenes', 'creadas');
}

async function cargarHistorialOrdenesSurtidas() {
  return cargarOrdenes('listaOrdenesSurtidas', 'historial-surtidas');
}

async function editarItemOrden(idItem) {
  const id = Number(idItem);
  if (!Number.isFinite(id) || id <= 0) return;
  const { item } = buscarItemOrdenPorId(id);
  if (!item) {
    mostrarNotificacion('No se encontró el ítem a editar', 'error');
    return;
  }

  modalEditarItemOrdenId = id;
  const inputCantidad = document.getElementById('editOcCantidadRequerida');
  const inputPrecio = document.getElementById('editOcPrecioUnitario');
  const txtNombre = document.getElementById('editOcNombreItem');
  if (inputCantidad) inputCantidad.value = Number(item?.cantidad_requerida || 0).toFixed(2);
  if (inputPrecio) inputPrecio.value = Number(item?.precio_unitario || 0).toFixed(2);
  if (txtNombre) txtNombre.textContent = `${texto(item?.nombre)} (${abrevUnidad(item?.unidad || '')})`;
  abrirModal('modalEditarItemOrdenCompra');
}

async function confirmarEditarItemOrden(event) {
  if (event) event.preventDefault();
  const id = Number(modalEditarItemOrdenId);
  if (!Number.isFinite(id) || id <= 0) return;

  const cantidad = Number(document.getElementById('editOcCantidadRequerida')?.value || 0);
  const precio = Number(document.getElementById('editOcPrecioUnitario')?.value || 0);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    mostrarNotificacion('Cantidad inválida', 'error');
    return;
  }
  if (!Number.isFinite(precio) || precio < 0) {
    mostrarNotificacion('Precio unitario inválido', 'error');
    return;
  }

  try {
    await fetchAPIJSON(`${API}/recetas/ordenes-compra/items/${id}/cantidad`, {
      method: 'PATCH',
      body: {
        cantidad_requerida: cantidad,
        precio_unitario: precio
      }
    });
    cerrarModal('modalEditarItemOrdenCompra');
    modalEditarItemOrdenId = null;
    mostrarNotificacion('Ítem actualizado', 'exito');
    await Promise.all([cargarOrdenesRegistradas(), cargarHistorialOrdenesSurtidas(), cargarListaInsumosOrdenes()]);
  } catch (error) {
    mostrarNotificacion(error?.message || 'No se pudo actualizar el ítem', 'error');
  }
}

async function surtirItemOrden(idItem) {
  const id = Number(idItem);
  if (!Number.isFinite(id) || id <= 0) return;

  prepararModalSurtidoItem(id, false);
}

function prepararModalSurtidoItem(idItem, desdeLote = false) {
  const { item, orden } = buscarItemOrdenPorId(idItem);
  if (!item) {
    mostrarNotificacion('No se encontró el ítem para surtir', 'error');
    return;
  }

  const requerido = Number(item?.cantidad_requerida || 0);
  const surtida = Number(item?.cantidad_surtida || 0);
  const faltante = Math.max(0, requerido - surtida);
  const precioUnitario = Number(item?.precio_unitario || 0);

  if (faltante <= 0 || Number(item?.surtido || 0) === 1) {
    mostrarNotificacion('Este ítem ya está surtido', 'advertencia');
    return;
  }

  modalSurtirItemOrdenId = Number(idItem);

  const txtTitulo = document.getElementById('surtirOcTitulo');
  const txtSub = document.getElementById('surtirOcSubtitulo');
  const inputCant = document.getElementById('surtirOcCantidad');
  const inputCosto = document.getElementById('surtirOcCostoTotal');
  const radioCompleto = document.getElementById('surtirOcModoCompleto');
  const radioOtro = document.getElementById('surtirOcModoOtro');
  const bloqueCantidad = document.getElementById('surtirOcBloqueCantidad');
  const txtLote = document.getElementById('surtirOcEstadoLote');

  if (txtTitulo) txtTitulo.textContent = `${texto(item?.nombre)} (${abrevUnidad(item?.unidad || '')})`;
  if (txtSub) txtSub.textContent = `Orden: ${texto(orden?.numero_orden)} | Faltante: ${faltante.toFixed(2)}`;
  if (inputCant) inputCant.value = faltante.toFixed(2);
  if (inputCosto) inputCosto.value = Math.max(0, precioUnitario * faltante).toFixed(2);
  if (radioCompleto) radioCompleto.checked = true;
  if (radioOtro) radioOtro.checked = false;
  if (bloqueCantidad) bloqueCantidad.style.display = 'none';

  if (txtLote) {
    txtLote.textContent = desdeLote && colaSurtidoOrden.length
      ? `Surtido por lote: faltan ${colaSurtidoOrden.length} producto(s) después de este`
      : '';
  }

  abrirModal('modalSurtirItemOrdenCompra');
}

function cambiarModoCantidadSurtido() {
  const radioOtro = document.getElementById('surtirOcModoOtro');
  const bloqueCantidad = document.getElementById('surtirOcBloqueCantidad');
  if (!bloqueCantidad) return;
  bloqueCantidad.style.display = radioOtro?.checked ? '' : 'none';
}

function cerrarModalEditarItemOrden() {
  modalEditarItemOrdenId = null;
  cerrarModal('modalEditarItemOrdenCompra');
}

function cancelarSurtirItemOrden() {
  modalSurtirItemOrdenId = null;
  colaSurtidoOrden = [];
  cerrarModal('modalSurtirItemOrdenCompra');
}

async function confirmarSurtirItemOrden(event) {
  if (event) event.preventDefault();
  const id = Number(modalSurtirItemOrdenId);
  if (!Number.isFinite(id) || id <= 0) return;

  const { item } = buscarItemOrdenPorId(id);
  if (!item) {
    mostrarNotificacion('No se encontró el ítem para surtir', 'error');
    return;
  }

  const requerido = Number(item?.cantidad_requerida || 0);
  const surtida = Number(item?.cantidad_surtida || 0);
  const faltante = Math.max(0, requerido - surtida);
  const radioOtro = document.getElementById('surtirOcModoOtro');
  const inputCant = document.getElementById('surtirOcCantidad');
  const inputCosto = document.getElementById('surtirOcCostoTotal');

  let cantidad = faltante;
  if (radioOtro?.checked) {
    cantidad = Number(inputCant?.value || 0);
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > faltante) {
    mostrarNotificacion(`Cantidad inválida. Debe ser mayor a 0 y menor o igual a ${faltante.toFixed(2)}`, 'error');
    return;
  }

  const costo = Number(inputCosto?.value || 0);
  if (!Number.isFinite(costo) || costo < 0) {
    mostrarNotificacion('Costo inválido', 'error');
    return;
  }

  const ok = await mostrarConfirmacion(
    'Se actualizará inventario y se guardará historial de surtido.',
    'Confirmar surtido'
  );
  if (!ok) return;

  try {
    await fetchAPIJSON(`${API}/recetas/ordenes-compra/items/${id}/surtir`, {
      method: 'POST',
      body: { cantidad_surtida: cantidad, costo_total: costo }
    });
    cerrarModal('modalSurtirItemOrdenCompra');
    modalSurtirItemOrdenId = null;
    mostrarNotificacion('Surtido aplicado y registrado en historial', 'exito');
    await Promise.all([cargarOrdenesRegistradas(), cargarHistorialOrdenesSurtidas(), cargarInventario(), cargarEstadisticasInventario(), cargarListaInsumosOrdenes()]);

    if (colaSurtidoOrden.length) {
      const siguiente = colaSurtidoOrden.shift();
      if (Number.isFinite(Number(siguiente))) {
        prepararModalSurtidoItem(Number(siguiente), true);
      }
    }
  } catch (error) {
    mostrarNotificacion(error?.message || 'No se pudo surtir el ítem', 'error');
  }
}

async function surtirOrdenCompleta(idOrden) {
  const id = Number(idOrden);
  if (!Number.isFinite(id) || id <= 0) return;

  const orden = ordenesCompraCache.find((o) => Number(o?.id) === id);
  if (!orden) {
    mostrarNotificacion('No se encontró la orden seleccionada', 'error');
    return;
  }

  const pendientes = (orden.items || [])
    .filter((item) => Number(item?.surtido || 0) !== 1)
    .map((item) => Number(item?.id))
    .filter((itemId) => Number.isFinite(itemId) && itemId > 0);

  if (!pendientes.length) {
    mostrarNotificacion('La orden ya está completamente surtida', 'advertencia');
    return;
  }

  const ok = await mostrarConfirmacion(
    `Se abrirá un modal por producto para confirmar cantidad y costo (${pendientes.length} pendiente(s)).`,
    `Surtir todo ${texto(orden?.numero_orden || '')}`
  );
  if (!ok) return;

  colaSurtidoOrden = [...pendientes];
  const primero = colaSurtidoOrden.shift();
  if (Number.isFinite(Number(primero))) {
    prepararModalSurtidoItem(Number(primero), true);
  }
}

function renderListaInsumosOrden() {
  const cuerpo = document.getElementById('cuerpoListaInsumosOC');
  if (!cuerpo) return;
  const busqueda = busquedaOrdenesActual();

  const listaBase = Array.isArray(listaInsumosOrdenData) ? listaInsumosOrdenData : [];

  const lista = listaBase
    .filter((it) => {
      if (!busqueda) return true;
      return normalizarTextoBusqueda(it?.nombre).includes(busqueda)
        || normalizarTextoBusqueda(it?.codigo).includes(busqueda)
        || normalizarTextoBusqueda(it?.proveedor).includes(busqueda)
        || normalizarTextoBusqueda(it?.unidad).includes(busqueda);
    })
    .sort((a, b) => cmpTexto(a?.proveedor || 'Sin proveedor', b?.proveedor || 'Sin proveedor') || cmpTexto(a?.nombre, b?.nombre));

  if (!lista.length) {
    cuerpo.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#777">No hay insumos para mostrar</td></tr>';
    return;
  }

  let proveedorActual = '';
  const filas = [];
  lista.forEach((it) => {
    const idRegistro = Number(it?.id || it?.id_movimiento || 0);
    const proveedor = texto(it?.proveedor).trim() || 'Sin proveedor';
    if (proveedor !== proveedorActual) {
      proveedorActual = proveedor;
      filas.push(`<tr><td colspan="5" style="background:#f7f7f7;font-weight:700;color:#444">Proveedor: ${escapeHtml(proveedor)}</td></tr>`);
    }

    filas.push(`
      <tr>
        <td>${escapeHtml(it?.codigo || '-')}</td>
        <td>${escapeHtml(it?.nombre || '')}</td>
        <td>${escapeHtml(formatearCantidadComercial(Number(it?.cantidad || 0), it?.unidad || ''))}</td>
        <td>$${Number(it?.costo || 0).toFixed(2)}</td>
        <td>${escapeHtml(formatearFechaVariante(it?.fecha_cambio))}</td>
        <td>
          <button class="botonPequeno" type="button" onclick="window.inventario.editarPrecioListaInsumo(${idRegistro})">✏️</button>
          <button class="botonPequeno" type="button" onclick="window.inventario.verHistorialPrecioListaInsumo(${idRegistro})">📜</button>
          <button class="botonPequeno botonDanger" type="button" onclick="window.inventario.eliminarPrecioListaInsumo(${idRegistro})">🗑️</button>
        </td>
      </tr>
    `);
  });

  cuerpo.innerHTML = filas.join('');
}

async function editarPrecioListaInsumo(idRegistro) {
  const id = Number(idRegistro || 0);
  if (!Number.isFinite(id) || id <= 0) {
    mostrarNotificacion('Este registro aún no tiene ID válido. Recarga la pestaña.', 'error');
    return;
  }
  const item = (listaInsumosOrdenData || []).find((x) => Number(x?.id) === id);
  if (!item) {
    mostrarNotificacion('No se encontró el insumo en la lista', 'error');
    return;
  }

  modalEditarPrecioListaId = id;
  const f = (idEl, val) => {
    const el = document.getElementById(idEl);
    if (el) el.value = val;
  };

  f('editListaPrecioCodigo', texto(item?.codigo || ''));
  f('editListaPrecioNombre', texto(item?.nombre || ''));
  f('editListaPrecioProveedor', texto(item?.proveedor || ''));
  f('editListaPrecioUnidad', texto(item?.unidad || ''));
  f('editListaPrecioCantidad', Number(item?.cantidad || 0).toFixed(2));
  f('editListaPrecioUnitario', Number(item?.precio_unitario || 0).toFixed(4));
  f('editListaPrecioTotal', Number(item?.costo || 0).toFixed(2));

  abrirModal('modalEditarPrecioListaOC');
}

async function guardarEdicionPrecioLista(event) {
  if (event) event.preventDefault();
  const id = Number(modalEditarPrecioListaId || 0);
  if (!Number.isFinite(id) || id <= 0) return;

  const payload = {
    codigo: texto(document.getElementById('editListaPrecioCodigo')?.value || '').trim(),
    nombre: texto(document.getElementById('editListaPrecioNombre')?.value || '').trim(),
    proveedor: texto(document.getElementById('editListaPrecioProveedor')?.value || '').trim(),
    unidad: texto(document.getElementById('editListaPrecioUnidad')?.value || '').trim(),
    cantidad_referencia: Number(document.getElementById('editListaPrecioCantidad')?.value || 0),
    precio_unitario: Number(document.getElementById('editListaPrecioUnitario')?.value || 0),
    costo_total_referencia: Number(document.getElementById('editListaPrecioTotal')?.value || 0)
  };

  if (!payload.nombre) {
    mostrarNotificacion('Nombre requerido', 'error');
    return;
  }
  if (!Number.isFinite(payload.cantidad_referencia) || payload.cantidad_referencia <= 0) {
    mostrarNotificacion('Cantidad inválida', 'error');
    return;
  }
  if (!Number.isFinite(payload.precio_unitario) || payload.precio_unitario < 0) {
    mostrarNotificacion('Precio unitario inválido', 'error');
    return;
  }

  try {
    await fetchAPIJSON(`${API}/inventario/lista-insumos-ordenes/${id}`, {
      method: 'PATCH',
      body: payload
    });
    cerrarModal('modalEditarPrecioListaOC');
    modalEditarPrecioListaId = null;
    mostrarNotificacion('Registro de precio actualizado', 'exito');
    await cargarListaInsumosOrdenes();
  } catch (error) {
    mostrarNotificacion(error?.message || 'No se pudo guardar el registro', 'error');
  }
}

function cerrarModalEditarPrecioLista() {
  modalEditarPrecioListaId = null;
  cerrarModal('modalEditarPrecioListaOC');
}

async function eliminarPrecioListaInsumo(idRegistro) {
  const id = Number(idRegistro || 0);
  if (!Number.isFinite(id) || id <= 0) {
    mostrarNotificacion('Este registro aún no tiene ID válido. Recarga la pestaña.', 'error');
    return;
  }
  const ok = await mostrarConfirmacion('¿Eliminar este insumo de la lista de precios?', 'Eliminar registro');
  if (!ok) return;

  try {
    await fetchAPIJSON(`${API}/inventario/lista-insumos-ordenes/${id}`, { method: 'DELETE' });
    mostrarNotificacion('Registro eliminado', 'exito');
    await cargarListaInsumosOrdenes();
  } catch (error) {
    mostrarNotificacion(error?.message || 'No se pudo eliminar el registro', 'error');
  }
}

async function verHistorialPrecioListaInsumo(idRegistro) {
  const id = Number(idRegistro || 0);
  if (!Number.isFinite(id) || id <= 0) {
    mostrarNotificacion('Este registro aún no tiene ID válido. Recarga la pestaña.', 'error');
    return;
  }

  try {
    const data = await fetchAPIJSON(`${API}/inventario/lista-insumos-ordenes/${id}/historial`);
    const item = data?.item || {};
    const historial = Array.isArray(data?.historial) ? data.historial : [];

    const titulo = document.getElementById('tituloHistorialPrecioListaOC');
    if (titulo) titulo.textContent = `Historial de precio · ${texto(item?.nombre || 'Insumo')}`;

    const cuerpo = document.getElementById('cuerpoHistorialPrecioListaOC');
    if (cuerpo) {
      if (!historial.length) {
        cuerpo.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#777">Sin historial de precio</td></tr>';
      } else {
        cuerpo.innerHTML = historial.map((h) => `
          <tr>
            <td>${escapeHtml(formatearFechaVariante(h?.vigente_desde))}</td>
            <td>${escapeHtml(h?.vigente_hasta ? formatearFechaVariante(h.vigente_hasta) : 'Vigente')}</td>
            <td>$${Number(h?.precio_unitario || 0).toFixed(4)}</td>
            <td>$${Number(h?.costo_total_referencia || 0).toFixed(2)}</td>
            <td>${escapeHtml(h?.motivo || '-')}</td>
            <td>${escapeHtml(formatearFechaVariante(h?.registrado_en))}</td>
          </tr>
        `).join('');
      }
    }

    abrirModal('modalHistorialPrecioListaOC');
  } catch (error) {
    mostrarNotificacion(error?.message || 'No se pudo cargar historial de precio', 'error');
  }
}

async function cargarProveedoresMaestros() {
  try {
    const data = await fetchAPIJSON(`${API}/inventario/proveedores`);
    proveedoresMaestros = Array.isArray(data) ? data.sort((a, b) => cmpTexto(a?.nombre, b?.nombre)) : [];
    const usos = await Promise.all(
      proveedoresMaestros.map(async (p) => {
        const id = Number(p?.id || 0);
        if (!id) return [id, { inventario: 0, utensilios: 0, total: 0 }];
        try {
          const detalle = await fetchAPIJSON(`${API}/inventario/proveedores/${id}/uso`);
          const uso = detalle?.uso || {};
          return [id, {
            inventario: Number(uso.inventario || 0),
            utensilios: Number(uso.utensilios || 0),
            total: Number(uso.total || 0)
          }];
        } catch {
          return [id, { inventario: 0, utensilios: 0, total: 0 }];
        }
      })
    );
    proveedoresUsoMapa = new Map(usos);
    renderTablaProveedoresMaestros();
  } catch (error) {
    console.error(error);
  }
}

function renderTablaProveedoresMaestros() {
  const cuerpo = document.getElementById('cuerpoTablaProveedores');
  if (!cuerpo) return;

  const termino = normalizarTextoBusqueda(proveedorFiltroTexto);
  const lista = (Array.isArray(proveedoresMaestros) ? proveedoresMaestros : [])
    .filter((p) => {
      if (!termino) return true;
      const nombre = normalizarTextoBusqueda(p?.nombre || '');
      const telefono = normalizarTextoBusqueda(p?.telefono || '');
      const correo = normalizarTextoBusqueda(p?.correo || '');
      const formaPago = normalizarTextoBusqueda(p?.forma_pago || '');
      const direccion = normalizarTextoBusqueda(p?.direccion || '');
      return nombre.includes(termino)
        || telefono.includes(termino)
        || correo.includes(termino)
        || formaPago.includes(termino)
        || direccion.includes(termino);
    });

  if (!lista.length) {
    cuerpo.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#777">Sin proveedores para ese filtro</td></tr>';
    return;
  }

  cuerpo.innerHTML = lista.map((p) => `
      <tr>
        <td>
          <div>${escapeHtml(p.nombre || '')}</div>
          <div style="margin-top:4px;font-size:11px;color:#666;display:inline-flex;gap:8px;align-items:center;padding:2px 8px;border:1px solid #ddd;border-radius:999px;background:#f7f7f7">
            <span>📦 ${Number(proveedoresUsoMapa.get(Number(p.id || 0))?.inventario || 0)}</span>
            <span>🧰 ${Number(proveedoresUsoMapa.get(Number(p.id || 0))?.utensilios || 0)}</span>
          </div>
        </td>
        <td>${escapeHtml(p.telefono || '-')}</td>
        <td>${escapeHtml(p.correo || '-')}</td>
        <td>
          <div>${escapeHtml(p.forma_pago || '-')}</div>
          ${String(p?.forma_pago || '').toLowerCase() === 'transferencia' && texto(p?.numero_cuenta).trim() ? `<div style="font-size:11px;color:#666;margin-top:3px">${escapeHtml(p.numero_cuenta || '')}</div>` : ''}
        </td>
        <td>${escapeHtml(p.direccion || '-')}</td>
        <td style="text-align:center;vertical-align:middle">
          <div style="display:inline-flex;gap:6px;align-items:center;justify-content:center">
            <button class="botonPequeno" type="button" onclick="window.inventario.editarProveedor(${Number(p.id || 0)})">✏️</button>
            <button class="botonPequeno botonDanger" type="button" onclick="window.inventario.solicitarEliminarProveedor(${Number(p.id || 0)})">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
}

function filtrarProveedoresMaestros(valor) {
  proveedorFiltroTexto = texto(valor).trim();
  renderTablaProveedoresMaestros();
}

function abrirModalProveedores() {
  document.getElementById('formProveedorInventario')?.reset();
  const idEl = document.getElementById('provId');
  if (idEl) idEl.value = '';
  abrirModal('modalProveedoresInventario');
  actualizarVisibilidadCuentaProveedor();
}

function actualizarVisibilidadCuentaProveedor() {
  const formaPago = texto(document.getElementById('provFormaPago')?.value).trim().toLowerCase();
  const filaPrincipal = document.getElementById('filaProveedorPrincipal');
  const contCuenta = document.getElementById('contCuentaProveedor');
  const inputCuenta = document.getElementById('provCuenta');
  const requiere = formaPago === 'transferencia';
  if (contCuenta) contCuenta.style.display = requiere ? '' : 'none';
  if (filaPrincipal) {
    filaPrincipal.style.gridTemplateColumns = requiere ? '1.05fr 0.85fr 1fr 1fr' : '1.2fr 0.9fr 1fr';
  }
  if (inputCuenta) {
    inputCuenta.required = requiere;
    if (!requiere) inputCuenta.value = '';
  }
}

function autoAjustarTextarea(textarea) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.max(42, textarea.scrollHeight)}px`;
}

function editarProveedor(id) {
  const p = proveedoresMaestros.find((x) => Number(x.id) === Number(id));
  if (!p) return;
  abrirModal('modalProveedoresInventario');
  const idEl = document.getElementById('provId');
  const nombre = document.getElementById('provNombre');
  const dir = document.getElementById('provDireccion');
  const tel = document.getElementById('provTelefono');
  const formaPago = document.getElementById('provFormaPago');
  const cuenta = document.getElementById('provCuenta');
  const correo = document.getElementById('provCorreo');
  if (idEl) idEl.value = p.id;
  if (nombre) nombre.value = p.nombre || '';
  if (dir) dir.value = p.direccion || '';
  if (tel) tel.value = p.telefono || '';
  if (formaPago) formaPago.value = p.forma_pago || '';
  if (cuenta) cuenta.value = p.numero_cuenta || '';
  if (correo) correo.value = p.correo || '';
  autoAjustarTextarea(dir);
  actualizarVisibilidadCuentaProveedor();
}

async function guardarProveedor(event) {
  event?.preventDefault();
  const formaPago = texto(document.getElementById('provFormaPago')?.value).trim();
  const numeroCuenta = texto(document.getElementById('provCuenta')?.value).trim();
  const id = Number(document.getElementById('provId')?.value || 0);
  const payload = {
    nombre: texto(document.getElementById('provNombre')?.value).trim(),
    telefono: texto(document.getElementById('provTelefono')?.value).trim(),
    forma_pago: formaPago,
    numero_cuenta: formaPago.toLowerCase() === 'transferencia' ? numeroCuenta : '',
    direccion: texto(document.getElementById('provDireccion')?.value).trim(),
    correo: texto(document.getElementById('provCorreo')?.value).trim()
  };

  if (!payload.nombre) {
    mostrarNotificacion('Nombre de proveedor requerido', 'error');
    return;
  }
  if (!payload.forma_pago) {
    mostrarNotificacion('Selecciona la forma de pago', 'error');
    return;
  }
  if (payload.forma_pago.toLowerCase() === 'transferencia' && !payload.numero_cuenta) {
    mostrarNotificacion('Captura el número de cuenta para transferencia', 'error');
    return;
  }

  try {
    if (id > 0) {
      await fetchAPIJSON(`${API}/inventario/proveedores/${id}`, { method: 'PATCH', body: payload });
      mostrarNotificacion('Proveedor actualizado', 'exito');
    } else {
      await fetchAPIJSON(`${API}/inventario/proveedores`, { method: 'POST', body: payload });
      mostrarNotificacion('Proveedor agregado', 'exito');
    }
    document.getElementById('formProveedorInventario')?.reset();
    const idEl = document.getElementById('provId');
    if (idEl) idEl.value = '';
    actualizarVisibilidadCuentaProveedor();
    await Promise.all([cargarProveedoresMaestros(), cargarCatalogoProveedores()]);
  } catch (error) {
    mostrarNotificacion(error?.message || 'No se pudo guardar proveedor', 'error');
  }
}

function cerrarModalReasignacionProveedor() {
  proveedorPendienteEliminar = null;
  usoProveedorPendiente = { inventario: 0, utensilios: 0, total: 0 };
  const sel = document.getElementById('reemplazoProveedorEliminar');
  if (sel) sel.value = '';
  cerrarModal('modalReasignarProveedorInventario');
}

async function solicitarEliminarProveedor(id) {
  const proveedor = proveedoresMaestros.find((x) => Number(x.id) === Number(id));
  if (!proveedor) {
    mostrarNotificacion('Proveedor no encontrado', 'error');
    return;
  }

  try {
    const detalle = await fetchAPIJSON(`${API}/inventario/proveedores/${Number(id)}/uso`);
    const uso = detalle?.uso || { inventario: 0, utensilios: 0, total: 0 };
    if (Number(uso.total || 0) <= 0) {
      const ok = await mostrarConfirmacion(`¿Eliminar proveedor "${proveedor.nombre}"?`, 'Eliminar proveedor');
      if (!ok) return;
      await fetchAPIJSON(`${API}/inventario/proveedores/${Number(id)}`, { method: 'DELETE', body: {} });
      mostrarNotificacion('Proveedor eliminado', 'exito');
      await Promise.all([cargarProveedoresMaestros(), cargarCatalogoProveedores(), cargarInventario()]);
      return;
    }

    proveedorPendienteEliminar = { id: Number(proveedor.id), nombre: String(proveedor.nombre || '') };
    usoProveedorPendiente = {
      inventario: Number(uso.inventario || 0),
      utensilios: Number(uso.utensilios || 0),
      total: Number(uso.total || 0)
    };

    const textoUso = document.getElementById('textoUsoProveedorEliminar');
    if (textoUso) {
      textoUso.textContent = `El proveedor "${proveedorPendienteEliminar.nombre}" tiene ${usoProveedorPendiente.inventario} insumo(s) y ${usoProveedorPendiente.utensilios} utensilio(s). Selecciona el nuevo proveedor para reasignar antes de eliminar.`;
    }

    const select = document.getElementById('reemplazoProveedorEliminar');
    if (select) {
      const opciones = proveedoresMaestros
        .filter((p) => Number(p.id) !== Number(proveedorPendienteEliminar.id))
        .map((p) => `<option value="${escapeHtml(texto(p.nombre).trim())}">${escapeHtml(p.nombre || '')}</option>`)
        .join('');
      select.innerHTML = `<option value="">Selecciona proveedor destino</option>${opciones}`;
      select.value = '';
    }

    abrirModal('modalReasignarProveedorInventario');
  } catch (error) {
    mostrarNotificacion(error?.message || 'No se pudo validar el proveedor', 'error');
  }
}

async function confirmarEliminarProveedorConReasignacion() {
  if (!proveedorPendienteEliminar?.id) {
    mostrarNotificacion('Proveedor no seleccionado', 'error');
    return;
  }

  const reemplazo = texto(document.getElementById('reemplazoProveedorEliminar')?.value).trim();
  if (!reemplazo) {
    mostrarNotificacion('Selecciona el proveedor destino', 'error');
    return;
  }

  try {
    await fetchAPIJSON(`${API}/inventario/proveedores/${Number(proveedorPendienteEliminar.id)}`, {
      method: 'DELETE',
      body: { reemplazo_proveedor: reemplazo }
    });
    cerrarModalReasignacionProveedor();
    mostrarNotificacion('Proveedor eliminado y registros reasignados', 'exito');
    await Promise.all([cargarProveedoresMaestros(), cargarCatalogoProveedores(), cargarInventario()]);
  } catch (error) {
    mostrarNotificacion(error?.message || 'No se pudo eliminar proveedor', 'error');
  }
}

async function agregarInsumo(event) {
  if (event) event.preventDefault();
  const codigo = document.getElementById('codigoInsumo')?.value;
  const nombre = document.getElementById('nombreInsumo')?.value;
  const proveedor = texto(document.getElementById('proveedorInsumo')?.value).trim();
  const unidad = document.getElementById('unidadInsumo')?.value;
  const cantidad = Number(document.getElementById('cantidadInsumo')?.value || 0);
  const costo = Number(document.getElementById('costoInsumo')?.value || 0);
  if (!codigo || !nombre || !unidad || !Number.isFinite(cantidad) || !Number.isFinite(costo)) {
    mostrarNotificacion('Por favor completa todos los campos', 'error');
    return;
  }
  if (!proveedor) {
    mostrarNotificacion('Selecciona un proveedor registrado', 'error');
    return;
  }
  try {
    const respuesta = await fetchAPI(`${API}/inventario/agregar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, nombre, proveedor, unidad, cantidad, costo })
    });
    if (respuesta.ok) {
      guardarProveedorReciente(proveedor);
      document.getElementById('formularioInsumo')?.reset();
      cerrarModal('modalInsumo');
      mostrarNotificacion('Insumo agregado correctamente', 'exito');
      await Promise.all([cargarInventario(), cargarEstadisticasInventario(), cargarCatalogoProveedores(), cargarOpcionesProveedorInsumo()]);
    }
  } catch (error) {
    console.error(error);
  }
}

async function editarInsumo(id) {
  try {
    const insumo = await fetchAPIJSON(`${API}/inventario/${id}`);
    const esPendiente = Number(insumo?.pendiente || 0) === 1;

    await cargarOpcionesProveedorInsumo();

    document.getElementById('idEditInsumo').value = insumo.id;
    const inputCodigo = document.getElementById('editCodigoInsumo');
    const estadoPendiente = document.getElementById('editPendienteInsumo');
    const avisoPendiente = document.getElementById('avisoPendienteInsumo');

    if (estadoPendiente) estadoPendiente.value = esPendiente ? '1' : '0';
    if (inputCodigo) {
      inputCodigo.value = insumo.codigo || '';
      inputCodigo.readOnly = !esPendiente;
      inputCodigo.classList.toggle('inputCodigoPendienteInventario', esPendiente);
    }
    if (avisoPendiente) avisoPendiente.style.display = esPendiente ? 'block' : 'none';

    document.getElementById('editNombreInsumo').value = insumo.nombre || '';
    const selectProveedor = document.getElementById('editProveedorInsumo');
    if (selectProveedor) {
      const proveedorInsumo = texto(insumo.proveedor).trim();
      if (proveedorInsumo && !Array.from(selectProveedor.options).some((op) => texto(op.value).trim() === proveedorInsumo)) {
        const option = document.createElement('option');
        option.value = proveedorInsumo;
        option.textContent = proveedorInsumo;
        selectProveedor.appendChild(option);
      }
      selectProveedor.value = proveedorInsumo;
    }
    document.getElementById('editUnidadInsumo').value = normalizarUnidadSelectInventario(insumo.unidad || '');
    document.getElementById('editCantidadInsumo').value = insumo.cantidad_total || 0;
    document.getElementById('editCostoInsumo').value = insumo.costo_total || 0;
    abrirModal('modalEditarInsumo');
  } catch (error) {
    mostrarNotificacion('Error al cargar el insumo', 'error');
  }
}

async function guardarEditarInsumo(event) {
  event?.preventDefault();
  const id = document.getElementById('idEditInsumo')?.value;
  const codigo = texto(document.getElementById('editCodigoInsumo')?.value).trim();
  const esPendiente = Number(document.getElementById('editPendienteInsumo')?.value || 0) === 1;

  if (esPendiente) {
    if (!codigo) {
      mostrarNotificacion('El código final es obligatorio para un insumo pendiente', 'error');
      return;
    }
    if (codigo.toUpperCase().startsWith('PEND-')) {
      mostrarNotificacion('Ingresa un código real para liberar este insumo pendiente', 'error');
      return;
    }
  }

  // Obtener valores anteriores
  let insumoAnterior = null;
  try {
    insumoAnterior = await fetchAPIJSON(`${API}/inventario/${id}`);
  } catch {}

  const nombreAnterior = insumoAnterior?.nombre || '';
  const codigoAnterior = insumoAnterior?.codigo || '';
  const proveedorAnterior = insumoAnterior?.proveedor || '';
  const unidadAnterior = insumoAnterior?.unidad || '';
  const cantidadAnterior = Number(insumoAnterior?.cantidad_total || 0);
  const costoAnterior = Number(insumoAnterior?.costo_total || 0);

  const nombreNuevo = document.getElementById('editNombreInsumo')?.value;
  const codigoNuevo = texto(document.getElementById('editCodigoInsumo')?.value).trim();
  const proveedorNuevo = texto(document.getElementById('editProveedorInsumo')?.value).trim();
  const unidadNuevo = document.getElementById('editUnidadInsumo')?.value;
  const cantidadNuevo = Number(document.getElementById('editCantidadInsumo')?.value || 0);
  const costoNuevo = Number(document.getElementById('editCostoInsumo')?.value || 0);

  const payload = {
    codigo: codigoNuevo,
    nombre: nombreNuevo,
    proveedor: proveedorNuevo,
    unidad: unidadNuevo,
    cantidad_total: cantidadNuevo,
    costo_total: costoNuevo
  };
  try {
    const respuesta = await fetchAPI(`${API}/inventario/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (respuesta.ok) {
      cerrarModal('modalEditarInsumo');
      // Notificación detallada
      let detalles = [];
      if (nombreAnterior !== nombreNuevo) detalles.push(`nombre: "${codigoAnterior} - ${nombreAnterior}" → "${codigoNuevo} - ${nombreNuevo}"`);
      if (codigoAnterior !== codigoNuevo) detalles.push(`código: "${codigoAnterior}" → "${codigoNuevo}"`);
      if (proveedorAnterior !== proveedorNuevo) detalles.push(`proveedor: "${proveedorAnterior}" → "${proveedorNuevo}"`);
      if (unidadAnterior !== unidadNuevo) detalles.push(`unidad: "${unidadAnterior}" → "${unidadNuevo}"`);
      if (cantidadAnterior !== cantidadNuevo) detalles.push(`cantidad: ${cantidadAnterior} → ${cantidadNuevo}`);
      if (costoAnterior !== costoNuevo) detalles.push(`costo: $${costoAnterior} → $${costoNuevo}`);
      if (detalles.length) {
        // Notificación precisa en alertas
        const clave = `insumo-edit-${id}`;
        const mensaje = `Inventario: ${detalles.join(', ')}`;
        agregarAlerta(clave, mensaje, 'exito');
        mostrarNotificacion(mensaje, 'exito');
      } else {
        agregarAlerta(`insumo-edit-${id}`, 'Inventario: insumo actualizado sin cambios visibles', 'info');
        mostrarNotificacion('Insumo actualizado sin cambios visibles', 'info');
      }
      // Mantener filtro actual
      const filtroActual = document.getElementById('busquedaInventario')?.value || '';
      await Promise.all([cargarInventario(), cargarEstadisticasInventario(), cargarCatalogoProveedores()]);
      if (filtroActual) filtrarInventario(filtroActual);
    }
  } catch (error) {
    console.error(error);
  }
}

async function eliminarInsumo(id) {
  const ok = await mostrarConfirmacion('¿Eliminar este insumo?', 'Eliminar insumo');
  if (!ok) return;
  try {
    const respuesta = await fetchAPI(`${API}/inventario/${id}`, { method: 'DELETE' });
    if (respuesta.ok) {
      mostrarNotificacion('Insumo eliminado correctamente', 'exito');
      await Promise.all([cargarInventario(), cargarEstadisticasInventario()]);
    }
  } catch (error) {
    console.error(error);
  }
}

async function cambiarActivoConsumo(id, activo) {
  const idInsumo = Number(id || 0);
  const activoNormalizado = activo ? 1 : 0;
  if (!Number.isFinite(idInsumo) || idInsumo <= 0) {
    mostrarNotificacion('No se pudo actualizar switch de consumo: ID inválido', 'error');
    return;
  }

  try {
    const respuesta = await fetchAPI(`${API}/inventario/${idInsumo}/activo-consumo`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo_consumo: activoNormalizado })
    });
    if (!respuesta.ok) {
      throw new Error('No se pudo guardar switch');
    }
    await cargarInventario();
    if (!activoNormalizado) {
      mostrarNotificacion('Lote desactivado para consumo en recetas', 'info');
    } else {
      mostrarNotificacion('Lote activado para consumo en recetas', 'exito');
    }
  } catch (error) {
    console.error(error);
    mostrarNotificacion('No se pudo actualizar el switch de consumo', 'error');
  }
}

function mostrarHistorialInsumoDesdeBoton(id, boton) {
  const nombre = texto(boton?.dataset?.nombre || '').trim() || 'Insumo';
  return mostrarHistorialInsumo(id, nombre);
}

async function mostrarHistorialInsumo(id, nombre) {
  const idInsumo = Number(id || 0);
  const cuerpo = document.getElementById('cuerpoHistorialInsumo');
  const titulo = document.getElementById('tituloHistorialInsumo');
  if (!cuerpo || !titulo) return;

  if (!Number.isFinite(idInsumo) || idInsumo <= 0) {
    titulo.textContent = `Historial de: ${nombre || 'Insumo'}`;
    cuerpo.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#b23c3c">No se pudo identificar el insumo</td></tr>';
    abrirModal('modalHistorialInsumo');
    mostrarNotificacion('No se pudo abrir historial: ID inválido', 'error');
    return;
  }

  titulo.textContent = `Historial de: ${nombre}`;
  cuerpo.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#666">Cargando historial...</td></tr>';
  abrirModal('modalHistorialInsumo');

  try {
    const respuesta = await fetchAPI(`${API}/inventario/${idInsumo}/historial`);
    if (!respuesta.ok) {
      const textoError = await respuesta.text();
      throw new Error(textoError || 'No se pudo cargar historial');
    }

    const historial = await respuesta.json();
    const lista = Array.isArray(historial) ? historial : [];
    cuerpo.innerHTML = !lista.length
      ? '<tr><td colspan="3" style="text-align:center">Sin movimientos</td></tr>'
      : lista.map((item) => `<tr><td>${new Date(item.fecha_cambio).toLocaleString()}</td><td>${Number(item.cambio_cantidad || 0).toFixed(2)}</td><td>$${Number(item.cambio_costo || 0).toFixed(2)}</td></tr>`).join('');
  } catch (error) {
    console.error(error);
    cuerpo.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#b23c3c">No se pudo cargar el historial</td></tr>';
    mostrarNotificacion('No se pudo cargar historial del insumo', 'error');
  }
}

function filtrarInventario(termino) {
  const filas = document.querySelectorAll('#cuerpoInventario tr');
  const t = normalizarTextoBusqueda(termino);
  let ultimoProveedorRow = null;
  let insumosVisibles = 0;
  filas.forEach((fila) => {
    // Detect provider row
    if (fila.classList.contains('filaGrupoProveedorInventario')) {
      if (ultimoProveedorRow) {
        // Hide previous provider if no insumos visible
        if (insumosVisibles === 0) ultimoProveedorRow.style.display = 'none';
        else ultimoProveedorRow.style.display = '';
      }
      ultimoProveedorRow = fila;
      insumosVisibles = 0;
      return;
    }
    if (fila.cells.length < 2) return;
    const codigo = normalizarTextoBusqueda(fila.cells[0]?.textContent || '');
    const nombre = normalizarTextoBusqueda(fila.cells[1]?.textContent || '');
    const proveedor = normalizarTextoBusqueda(fila.cells[2]?.textContent || '');
    const visible = (codigo.includes(t) || nombre.includes(t) || proveedor.includes(t));
    fila.style.display = visible ? '' : 'none';
    if (visible) insumosVisibles++;
  });
  // Hide last provider if no insumos visible
  if (ultimoProveedorRow) {
    if (insumosVisibles === 0) ultimoProveedorRow.style.display = 'none';
    else ultimoProveedorRow.style.display = '';
  }
}

async function mostrarHistorialInversion() {
  try {
    const respuesta = await fetchAPI(`${API}/inventario/historial/agrupar/fechas`);
    if (!respuesta.ok) return;
    const historialPorFecha = await respuesta.json();
    const listaDiv = document.getElementById('listaHistorialPorFecha');
    if (!listaDiv) return;

    if (!historialPorFecha || !historialPorFecha.length) {
      listaDiv.innerHTML = '<p style="text-align:center;color:#999">No hay registros de inversión</p>';
      abrirModal('modalHistorialInv');
      return;
    }

    listaDiv.innerHTML = historialPorFecha.map((dia) => {
      const fecha = new Date(dia.fecha).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const fechaClave = encodeURIComponent(texto(dia?.fecha));
      return `
        <div style="border:2px solid #ddd;border-radius:8px;margin-bottom:15px;overflow:hidden">
          <div onclick="window.inventario.toggleHistorialFecha('${fechaClave}')" style="background:#f5f5f5;padding:15px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none">
            <div style="flex:1">
              <h4 style="margin:0;color:#333;font-size:16px;text-transform:capitalize">${fecha}</h4>
              <p style="margin:5px 0 0 0;font-size:12px;color:#666">${dia.total_insumos} insumo(s) agregado(s) · Total: $${Number(dia.total_costo || 0).toFixed(2)}</p>
            </div>
            <button id="boton-${fechaClave}" style="background:none;border:none;font-size:18px;cursor:pointer;padding:0 10px">▶</button>
          </div>
          <div id="detalles-${fechaClave}" style="display:none;padding:12px;background:#fff">
            ${(dia.insumos || []).map((insumo) => `
              <div style="display:grid;grid-template-columns:120px 1fr 120px 120px;gap:8px;padding:6px 0;border-bottom:1px solid #eee">
                <span>${insumo.hora}</span>
                <span>${insumo.codigo} - ${insumo.nombre}</span>
                <span>${insumo.cambio_cantidad} ${insumo.unidad}</span>
                <span style="text-align:right">$${Number(insumo.cambio_costo || 0).toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    abrirModal('modalHistorialInv');
  } catch (error) {
    console.error(error);
  }
}

async function eliminarHistorialFecha(fecha) {
  const ok = await mostrarConfirmacion(
    `Se eliminará todo el historial de inversión del ${new Date(fecha).toLocaleDateString('es-ES')}. Esta acción ajustará inventario.`,
    '¿Eliminar historial de este día?'
  );
  if (!ok) return;
  try {
    const respuesta = await fetchAPI(`${API}/inventario/historial/fecha/${fecha}`, { method: 'DELETE' });
    if (!respuesta.ok) return;
    await Promise.all([mostrarHistorialInversion(), cargarInventario(), cargarEstadisticasInventario()]);
  } catch (error) {
    console.error(error);
  }
}

function toggleHistorialFecha(fecha) {
  const detalles = document.getElementById(`detalles-${fecha}`);
  const boton = document.getElementById(`boton-${fecha}`);
  if (!detalles || !boton) return;
  if (detalles.style.display === 'none' || detalles.style.display === '') {
    detalles.style.display = 'block';
    boton.textContent = '▼';
  } else {
    detalles.style.display = 'none';
    boton.textContent = '▶';
  }
}

export default function Inventario() {
  const [mostrarTarjetasStats, setMostrarTarjetasStats] = useState(false);

  useEffect(() => {
    window.inventario = {
      setTab,
      cargarInventario,
      cargarEstadisticasInventario,
      seleccionarInsumoOrden,
      agregarItemOrden,
      eliminarItemOrden,
      agregarProveedorRapido,
      crearOrden,
      cargarOrdenes,
      eliminarOrdenCompra,
      editarItemOrden,
      surtirItemOrden,
      surtirOrdenCompleta,
      editarPrecioListaInsumo,
      eliminarPrecioListaInsumo,
      verHistorialPrecioListaInsumo,
      eliminarArchivoListaPrecios,
      subirArchivoListaPrecios,
      abrirModalProveedores,
      editarProveedor,
      guardarProveedor,
      solicitarEliminarProveedor,
      confirmarEliminarProveedorConReasignacion,
      cerrarModalReasignacionProveedor,
      agregarInsumo,
      abrirModalAgregarInsumo,
      editarInsumo,
      guardarEditarInsumo,
      eliminarInsumo,
      cambiarActivoConsumo,
      mostrarHistorialInsumoDesdeBoton,
      mostrarHistorialInsumo,
      mostrarPendientesInventario,
      cerrarModalPendientesInventario,
      filtrarInventario,
      mostrarHistorialInversion,
      eliminarHistorialFecha,
      toggleHistorialFecha
    };

    cargarInventario();
    cargarEstadisticasInventario();
    setTab(tabActiva);

    return () => {
      delete window.inventario;
    };
  }, []);

  return (
    <div className="tarjeta">
      <div className="encabezadoTarjeta">
        <h2>Inventario</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <button
            type="button"
            className={`boton botonHojitaInventario ${mostrarTarjetasStats ? 'activo' : ''}`}
            onClick={() => setMostrarTarjetasStats((prev) => !prev)}
            title={mostrarTarjetasStats ? 'Ocultar tarjetas' : 'Mostrar tarjetas'}
          >
            <span className="iconoHojitaInventario">🍃</span>
            {mostrarTarjetasStats ? 'Ocultar tarjetas' : 'Mostrar tarjetas'}
          </button>
          <input type="text" className="cajaBusqueda" id="busquedaInventario" placeholder="🔍 Buscar insumo..." onChange={(e) => filtrarInventario(e.target.value)} style={{ width: '220px' }} />
          <button className="boton" onClick={() => abrirModalAgregarInsumo()}>➥ Agregar Insumo</button>
          <button id="btnPendientesInventario" className="boton" onClick={() => mostrarPendientesInventario()}>⏳ Revisar pendientes</button>
          <button className="boton" onClick={() => mostrarHistorialInversion()}>📊 Historial Inversión</button>
        </div>
      </div>

      <div className="tabsSubseccionInventario">
        <button id="btnTabInv" type="button" className="boton activo" onClick={() => setTab('inventario')}>📦 Insumos</button>
        <button id="btnTabUt" type="button" className="boton" onClick={() => setTab('utensilios')}>🧰 Utensilios</button>
        <button id="btnTabOc" type="button" className="boton" onClick={() => setTab('ordenes')}>🧾 Órdenes de compra</button>
      </div>

      <div id="panelInv">
        <div className={`panelTarjetasOcultables ${mostrarTarjetasStats ? 'visible' : 'oculto'}`}>
          <div className="gridEstadisticas" style={{ marginBottom: '15px' }}>
            <div className="tarjetaEstadistica"><h3 id="totalInsumos">0</h3><p>Total de Insumos</p></div>
            <div className="tarjetaEstadistica"><h3 id="inversionTotal">$0.00</h3><p>Inversión Total</p></div>
            <div className="tarjetaEstadistica"><h3 id="inversionRecuperada">$0.00</h3><p>Inversión Recuperada</p></div>
            <div className="tarjetaEstadistica"><h3 id="inversionNeta">$0.00</h3><p>Inversión Neta</p></div>
          </div>
        </div>
        <table>
          <thead>
            <tr><th>Código</th><th>Nombre</th><th>Proveedor</th><th>Unidad</th><th>Cantidad Total</th><th>Disponible</th><th>Costo Total</th><th>Costo/Unidad</th><th>Activo en recetas</th><th>Porcentaje</th><th>Acciones</th></tr>
          </thead>
          <tbody id="cuerpoInventario"></tbody>
        </table>
      </div>

      <div id="panelUt" style={{ display: 'none' }}>
        <Utensilios mostrarTarjetasStats={mostrarTarjetasStats} />
      </div>

      <div id="panelOc" style={{ display: 'none' }}>
        <div className="tabsSubseccionInventario" style={{ marginBottom: '10px' }}>
          <button id="btnOcListaInsumos" type="button" className="boton activo" onClick={() => setTabOrdenes('lista-insumos')}>📋 Lista de precios</button>
          <button id="btnOcNueva" type="button" className="boton" onClick={() => setTabOrdenes('nueva')}>🧾 Nueva orden de compra</button>
          <button id="btnOcOrdenes" type="button" className="boton" onClick={() => setTabOrdenes('ordenes')}>📦 Órdenes de compra</button>
          <button id="btnOcProveedores" type="button" className="boton" onClick={() => setTabOrdenes('proveedores')}>👤 Proveedores</button>
        </div>

        <div className="bloqueOrdenCompraInventario">
          <div id="barraBusquedaOrdenesGeneral" className="filaOrdenCompraInventario">
            <input id="buscarOrdenesGeneral" type="text" placeholder="Buscar por proveedor, código o insumo..." onChange={() => { renderListaInsumosOrden(); cargarOrdenesRegistradas(); cargarHistorialOrdenesSurtidas(); }} />
          </div>

          <div id="panelOrdenListaInsumos">
            <h3>Lista de precios</h3>
            <div className="filaOrdenCompraInventario" style={{ marginBottom: '10px', alignItems: 'center' }}>
              <input
                id="proveedorArchivoListaPrecios"
                type="text"
                placeholder="Nombre del proveedor"
                style={{ minWidth: '220px' }}
              />
              <input
                id="archivoListaPreciosInput"
                type="file"
                accept=".pdf,.xls,.xlsx,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                onChange={(e) => seleccionarArchivoListaPrecios(e)}
              />
              <button className="boton" type="button" onClick={() => subirArchivoListaPrecios()}>Subir archivo</button>
              <input
                id="buscarArchivoListaPrecios"
                type="text"
                placeholder="Buscar producto dentro de archivos..."
                style={{ minWidth: '260px' }}
                onChange={(e) => buscarArchivosListaPrecios(e.target.value)}
              />
            </div>
            <div id="listaArchivosListaPrecios" style={{ marginBottom: '10px' }}></div>
          </div>

          <div id="panelOrdenNueva" style={{ display: 'none' }}>
            <h3>Nueva orden de compra</h3>
            <div className="filaOrdenCompraInventario">
              <div className="controlProveedorInventario">
                <select id="proveedorOrden"><option value="">Selecciona proveedor</option></select>
                <button className="boton botonPequeno" type="button" onClick={() => agregarProveedorRapido()}>+ Nuevo</button>
              </div>
              <select id="insumoOrden" onChange={() => seleccionarInsumoOrden()}><option value="">Selecciona un insumo</option></select>
              <input id="cantidadOrden" type="number" step="0.01" min="0.01" placeholder="Cantidad" />
              <input id="unidadOrden" type="text" placeholder="Unidad" readOnly />
              <button className="boton" type="button" onClick={() => agregarItemOrden()}>+ Agregar</button>
            </div>

            <table>
              <thead><tr><th>Insumo</th><th>Proveedor</th><th>Cantidad</th><th></th></tr></thead>
              <tbody id="tablaItemsOrden"></tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button className="boton botonExito" type="button" onClick={() => crearOrden()}>Guardar orden de compra</button>
            </div>
          </div>

          <div id="panelOrdenesCompra" style={{ display: 'none' }}>
            <h3>Órdenes de compra</h3>
            <div className="tabsSubseccionInventario" style={{ marginBottom: '10px' }}>
              <button id="btnOrdenCompraCreadas" type="button" className="boton activo" onClick={() => setTabOrdenesCompra('creadas')}>📦 Creadas</button>
              <button id="btnOrdenCompraHistorial" type="button" className="boton" onClick={() => setTabOrdenesCompra('historial-surtidas')}>✅ Historial surtidas</button>
            </div>

            <div id="panelOrdenesCreadas">
              <div id="listaOrdenes" className="listaOrdenesCompraInventario"></div>
            </div>

            <div id="panelOrdenesSurtidas" style={{ display: 'none' }}>
              <div id="listaOrdenesSurtidas" className="listaOrdenesCompraInventario"></div>
            </div>
          </div>

          <div id="panelOrdenProveedores" style={{ display: 'none' }}>
            <h3>Proveedores</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
              <p style={{ margin: 0, color: '#555' }}>Lista de proveedores registrados</p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  id="buscarProveedoresMaestros"
                  type="text"
                  placeholder="Buscar proveedor..."
                  onChange={(e) => filtrarProveedoresMaestros(e.target.value)}
                  style={{ minWidth: '220px' }}
                />
                <button className="boton" type="button" onClick={() => abrirModalProveedores()}>+ Nuevo proveedor</button>
              </div>
            </div>
            <table>
              <thead><tr><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Forma de pago</th><th>Dirección</th><th></th></tr></thead>
              <tbody id="cuerpoTablaProveedores"></tbody>
            </table>
          </div>
        </div>

      </div>

      <div id="modalInsumo" className="modal" onClick={() => cerrarModal('modalInsumo')}>
        <div className="contenidoModal" onClick={(e) => e.stopPropagation()}>
          <div className="encabezadoModal"><h3>Agregar Insumo</h3><button className="cerrarModal" onClick={() => cerrarModal('modalInsumo')}>&times;</button></div>
          <form id="formularioInsumo" onSubmit={agregarInsumo} className="cajaFormulario">
            <div className="filaFormulario filaFormulario-CodigoNombre"><input id="codigoInsumo" type="text" placeholder="Código" required /><input id="nombreInsumo" type="text" placeholder="Nombre" required /></div>
            <div className="filaFormulario" style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.65fr 0.75fr 0.8fr', gap: '8px' }}>
              <select id="proveedorInsumo" required><option value="">Selecciona proveedor</option></select>
              <select id="unidadInsumo" required>
                <option value="">Unidad</option>
                <option value="cda">Cucharadas (cda)</option>
                <option value="cdta">Cucharaditas (cdta)</option>
                <option value="go">Gotas (go)</option>
                <option value="g">Gramos (g)</option>
                <option value="kg">Kilogramos (kg)</option>
                <option value="l">Litros (l)</option>
                <option value="ml">Mililitros (ml)</option>
                <option value="oz">Onzas (oz)</option>
                <option value="pz">Piezas (pz)</option>
                <option value="taza">Tazas</option>
              </select>
              <input id="cantidadInsumo" type="number" step="0.01" min="0" placeholder="Cantidad" required />
              <input id="costoInsumo" type="number" step="0.01" min="0" placeholder="Costo" required />
            </div>
            <button className="boton botonExito" type="submit">Guardar</button>
          </form>
        </div>
      </div>

      <div id="modalEditarInsumo" className="modal" onClick={() => cerrarModal('modalEditarInsumo')}>
        <div className="contenidoModal" onClick={(e) => e.stopPropagation()}>
          <div className="encabezadoModal"><h3>Editar Insumo</h3><button className="cerrarModal" onClick={() => cerrarModal('modalEditarInsumo')}>&times;</button></div>
          <form onSubmit={guardarEditarInsumo} className="cajaFormulario">
            <input id="idEditInsumo" type="hidden" />
            <input id="editPendienteInsumo" type="hidden" />
            <div className="filaFormulario filaFormulario-CodigoNombre"><input id="editCodigoInsumo" type="text" readOnly /><input id="editNombreInsumo" type="text" required /></div>
            <p id="avisoPendienteInsumo" className="avisoPendienteInventario" style={{ display: 'none' }}>
              Este insumo est\u00e1 pendiente. Captura el c\u00f3digo real para liberarlo y marcarlo como disponible.
            </p>
            <div className="filaFormulario">
              <select id="editProveedorInsumo" required>
                <option value="">Selecciona proveedor</option>
              </select>
            </div>
            <div className="filaFormulario filaFormulario-UnidadCantidadCosto">
              <select id="editUnidadInsumo" required>
                <option value="">Unidad</option>
                <option value="cda">Cucharadas (cda)</option>
                <option value="cdta">Cucharaditas (cdta)</option>
                <option value="go">Gotas (go)</option>
                <option value="g">Gramos (g)</option>
                <option value="kg">Kilogramos (kg)</option>
                <option value="l">Litros (l)</option>
                <option value="ml">Mililitros (ml)</option>
                <option value="oz">Onzas (oz)</option>
                <option value="pz">Piezas (pz)</option>
                <option value="taza">Tazas</option>
              </select>
              <input id="editCantidadInsumo" type="number" step="0.01" min="0" required />
              <input id="editCostoInsumo" type="number" step="0.01" min="0" required />
            </div>
            <button className="boton botonExito" type="submit">Guardar cambios</button>
          </form>
        </div>
      </div>

      <div id="modalPendientesInventario" className="modal" onClick={() => cerrarModalPendientesInventario()}>
        <div className="contenidoModal" style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
          <div className="encabezadoModal">
            <h3>Insumos pendientes</h3>
            <button className="cerrarModal" onClick={() => cerrarModalPendientesInventario()}>&times;</button>
          </div>
          <div className="cajaFormulario" style={{ maxHeight: '62vh', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr><th>C\u00f3digo</th><th>Nombre</th><th>Proveedor</th><th>Unidad</th><th>Acciones</th></tr>
              </thead>
              <tbody id="cuerpoPendientesInventario"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div id="modalHistorialInsumo" className="modal" onClick={() => cerrarModal('modalHistorialInsumo')}>
        <div className="contenidoModal" onClick={(e) => e.stopPropagation()}>
          <div className="encabezadoModal"><h3 id="tituloHistorialInsumo">Historial</h3><button className="cerrarModal" onClick={() => cerrarModal('modalHistorialInsumo')}>&times;</button></div>
          <div className="cajaFormulario"><table><thead><tr><th>Fecha</th><th>Cantidad</th><th>Costo</th></tr></thead><tbody id="cuerpoHistorialInsumo"></tbody></table></div>
        </div>
      </div>

      <div id="modalHistorialInv" className="modal" onClick={() => cerrarModal('modalHistorialInv')}>
        <div className="contenidoModal" style={{ maxWidth: '1000px' }} onClick={(e) => e.stopPropagation()}>
          <div className="encabezadoModal"><h3>Historial de Inversión por Fecha</h3><button className="cerrarModal" onClick={() => cerrarModal('modalHistorialInv')}>&times;</button></div>
          <div id="listaHistorialPorFecha" style={{ maxHeight: '65vh', overflowY: 'auto', padding: '10px' }}></div>
        </div>
      </div>

      <div id="modalProveedoresInventario" className="modal" style={{ zIndex: 3600 }} onClick={() => cerrarModal('modalProveedoresInventario')}>
        <div className="contenidoModal" style={{ maxWidth: '820px', marginTop: '70px', maxHeight: 'calc(100vh - 90px)', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
          <div className="encabezadoModal"><h3>Proveedor</h3><button className="cerrarModal" onClick={() => cerrarModal('modalProveedoresInventario')}>&times;</button></div>
          <div className="cajaFormulario">
            <form id="formProveedorInventario" onSubmit={guardarProveedor} className="cajaFormulario" style={{ marginBottom: 0 }}>
              <input id="provId" type="hidden" />
              <div id="filaProveedorPrincipal" className="filaFormulario" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 1fr', gap: '10px' }}>
                <input id="provNombre" type="text" placeholder="Nombre" required />
                <input id="provTelefono" type="text" placeholder="Teléfono" required />
                <select id="provFormaPago" defaultValue="" onChange={() => actualizarVisibilidadCuentaProveedor()} required>
                  <option value="" disabled>Forma de pago</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta/Efectivo">Tarjeta/Efectivo</option>
                  <option value="Interna">Interna</option>
                </select>
                <div id="contCuentaProveedor" style={{ display: 'none' }}>
                  <input id="provCuenta" type="text" placeholder="Número de cuenta" style={{ width: '100%' }} />
                </div>
              </div>
              <div className="filaFormulario" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'center' }}>
                <textarea id="provDireccion" placeholder="Dirección" required rows={1} style={{ resize: 'none', minHeight: '42px', width: '100%', overflow: 'hidden' }} onInput={(e) => autoAjustarTextarea(e.target)} />
                <input id="provCorreo" type="email" placeholder="Correo" required />
                <button className="boton botonExito" type="submit" style={{ whiteSpace: 'nowrap' }}>Guardar proveedor</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div id="modalReasignarProveedorInventario" className="modal" onClick={() => cerrarModalReasignacionProveedor()}>
        <div className="contenidoModal" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
          <div className="encabezadoModal">
            <h3>Reasignar insumos del proveedor</h3>
            <button className="cerrarModal" onClick={() => cerrarModalReasignacionProveedor()}>&times;</button>
          </div>
          <div className="cajaFormulario">
            <p id="textoUsoProveedorEliminar" style={{ margin: '0 0 10px 0', color: '#555' }}></p>
            <div className="filaFormulario">
              <select id="reemplazoProveedorEliminar"><option value="">Selecciona proveedor destino</option></select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="boton" type="button" onClick={() => cerrarModalReasignacionProveedor()}>Cancelar</button>
              <button className="boton botonExito" type="button" onClick={() => confirmarEliminarProveedorConReasignacion()}>Reasignar y eliminar</button>
            </div>
          </div>
        </div>
      </div>

      <div id="modalProveedorRapidoOrden" className="modal" onClick={() => cerrarModal('modalProveedorRapidoOrden')}>
        <div className="contenidoModal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
          <div className="encabezadoModal">
            <h3>Nuevo proveedor para orden</h3>
            <button className="cerrarModal" onClick={() => cerrarModal('modalProveedorRapidoOrden')}>&times;</button>
          </div>
          <form className="cajaFormulario" onSubmit={confirmarProveedorRapidoOrden}>
            <div className="filaFormulario">
              <input id="inputProveedorRapidoOrden" type="text" placeholder="Nombre del proveedor" required />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="boton" type="button" onClick={() => cerrarModal('modalProveedorRapidoOrden')}>Cancelar</button>
              <button className="boton botonExito" type="submit">Guardar proveedor</button>
            </div>
          </form>
        </div>
      </div>

      <div id="modalEditarItemOrdenCompra" className="modal" onClick={() => cerrarModalEditarItemOrden()}>
        <div className="contenidoModal" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
          <div className="encabezadoModal">
            <h3>Editar item de orden</h3>
            <button className="cerrarModal" onClick={() => cerrarModalEditarItemOrden()}>&times;</button>
          </div>
          <form className="cajaFormulario" onSubmit={confirmarEditarItemOrden}>
            <p id="editOcNombreItem" style={{ margin: '0 0 8px 0', color: '#555' }}></p>
            <div className="filaFormulario" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input id="editOcCantidadRequerida" type="number" min="0.01" step="0.01" placeholder="Cantidad requerida" required />
              <input id="editOcPrecioUnitario" type="number" min="0" step="0.01" placeholder="Precio unitario" required />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="boton" type="button" onClick={() => cerrarModalEditarItemOrden()}>Cancelar</button>
              <button className="boton botonExito" type="submit">Guardar cambios</button>
            </div>
          </form>
        </div>
      </div>

      <div id="modalEditarPrecioListaOC" className="modal" onClick={() => cerrarModalEditarPrecioLista()}>
        <div className="contenidoModal" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()}>
          <div className="encabezadoModal">
            <h3>Editar registro de lista de precios</h3>
            <button className="cerrarModal" onClick={() => cerrarModalEditarPrecioLista()}>&times;</button>
          </div>
          <form className="cajaFormulario" onSubmit={guardarEdicionPrecioLista}>
            <div className="filaFormulario" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input id="editListaPrecioCodigo" type="text" placeholder="Código" />
              <input id="editListaPrecioNombre" type="text" placeholder="Nombre" required />
            </div>
            <div className="filaFormulario">
              <input id="editListaPrecioProveedor" type="text" placeholder="Proveedor" />
            </div>
            <div className="filaFormulario" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <input id="editListaPrecioCantidad" type="number" min="0.01" step="0.01" placeholder="Cantidad" required />
              <input id="editListaPrecioUnidad" type="text" placeholder="Unidad" />
              <input id="editListaPrecioUnitario" type="number" min="0" step="0.0001" placeholder="Precio unitario" required />
            </div>
            <div className="filaFormulario">
              <input id="editListaPrecioTotal" type="number" min="0" step="0.01" placeholder="Precio total" required />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="boton" type="button" onClick={() => cerrarModalEditarPrecioLista()}>Cancelar</button>
              <button className="boton botonExito" type="submit">Guardar cambios</button>
            </div>
          </form>
        </div>
      </div>

      <div id="modalHistorialPrecioListaOC" className="modal" onClick={() => cerrarModal('modalHistorialPrecioListaOC')}>
        <div className="contenidoModal" style={{ maxWidth: '920px' }} onClick={(e) => e.stopPropagation()}>
          <div className="encabezadoModal">
            <h3 id="tituloHistorialPrecioListaOC">Historial de precio</h3>
            <button className="cerrarModal" onClick={() => cerrarModal('modalHistorialPrecioListaOC')}>&times;</button>
          </div>
          <div className="cajaFormulario" style={{ maxHeight: '62vh', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr><th>Desde</th><th>Hasta</th><th>Precio unitario</th><th>Precio total</th><th>Motivo</th><th>Registro</th></tr>
              </thead>
              <tbody id="cuerpoHistorialPrecioListaOC"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div id="modalSurtirItemOrdenCompra" className="modal" onClick={() => cancelarSurtirItemOrden()}>
        <div className="contenidoModal" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
          <div className="encabezadoModal">
            <h3>Surtir item de orden</h3>
            <button className="cerrarModal" onClick={() => cancelarSurtirItemOrden()}>&times;</button>
          </div>
          <form className="cajaFormulario" onSubmit={confirmarSurtirItemOrden}>
            <h4 id="surtirOcTitulo" style={{ margin: '0 0 6px 0' }}></h4>
            <p id="surtirOcSubtitulo" style={{ margin: '0 0 6px 0', color: '#555' }}></p>
            <p id="surtirOcEstadoLote" style={{ margin: '0 0 10px 0', color: '#666', fontSize: '12px' }}></p>

            <div className="filaFormulario surtirOcModoFila">
              <label className="surtirOcModoOpcion">
                <input id="surtirOcModoCompleto" name="surtirOcModo" type="radio" defaultChecked onChange={cambiarModoCantidadSurtido} />
                Surtir cantidad faltante completa
              </label>
              <label className="surtirOcModoOpcion">
                <input id="surtirOcModoOtro" name="surtirOcModo" type="radio" onChange={cambiarModoCantidadSurtido} />
                Surtir otra cantidad
              </label>
            </div>

            <div id="surtirOcBloqueCantidad" className="filaFormulario" style={{ display: 'none' }}>
              <input id="surtirOcCantidad" type="number" min="0.01" step="0.01" placeholder="Cantidad a surtir" />
            </div>

            <div className="filaFormulario">
              <input id="surtirOcCostoTotal" type="number" min="0" step="0.01" placeholder="Costo total de esta entrada" required />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="boton" type="button" onClick={() => cancelarSurtirItemOrden()}>Cancelar</button>
              <button className="boton botonExito" type="submit">Aplicar surtido</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
