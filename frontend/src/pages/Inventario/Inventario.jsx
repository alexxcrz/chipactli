import React, { useEffect } from 'react';
import './Inventario.css';
import Utensilios from '../utensilios/Utensilios.jsx';
import { mostrarNotificacion } from '../../utils/notificaciones.jsx';
import { abrirModal, cerrarModal, mostrarConfirmacion } from '../../utils/modales.jsx';
import { importarDatos, exportarDatos } from '../../utils/importar-exportar.jsx';
import { API } from '../../utils/config.jsx';
import { fetchAPI, fetchAPIJSON } from '../../utils/api.jsx';
import { normalizarTextoBusqueda } from '../../utils/texto.jsx';

let tabActiva = 'inventario';
let tabOrdenesActiva = 'lista-insumos';
let tabOrdenesCompraActiva = 'creadas';
let inventarioData = [];
let listaInsumosOrdenData = [];
let itemsOrdenTemporal = [];
let proveedoresCatalogo = [];
let proveedoresMaestros = [];
let proveedorPendienteEliminar = null;
let usoProveedorPendiente = { inventario: 0, utensilios: 0, total: 0 };
const CLAVE_ULTIMO_PROVEEDOR_INSUMO = 'chipactli:ultimoProveedorInsumo';

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

function escapeHtml(s) {
  return texto(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

function setTabOrdenes(tab) {
  tabOrdenesActiva = ['lista-insumos', 'nueva', 'ordenes', 'proveedores'].includes(tab) ? tab : 'lista-insumos';
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

  if (btnListaInsumos) btnListaInsumos.classList.toggle('activo', tabOrdenesActiva === 'lista-insumos');
  if (btnNueva) btnNueva.classList.toggle('activo', tabOrdenesActiva === 'nueva');
  if (btnOrdenes) btnOrdenes.classList.toggle('activo', tabOrdenesActiva === 'ordenes');
  if (btnProveedores) btnProveedores.classList.toggle('activo', tabOrdenesActiva === 'proveedores');

  if (tabOrdenesActiva === 'ordenes') setTabOrdenesCompra(tabOrdenesCompraActiva);
  if (tabOrdenesActiva === 'proveedores') cargarProveedoresMaestros();
}

function setTabOrdenesCompra(tab) {
  tabOrdenesCompraActiva = ['creadas', 'historial-surtidas'].includes(tab) ? tab : 'creadas';
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
  const select = document.getElementById('proveedorInsumo');
  if (!select) return;
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

  select.innerHTML = `<option value="">Selecciona proveedor</option>${proveedores.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}`;

  const reciente = obtenerProveedorRecienteGuardado();
  if (reciente && proveedores.includes(reciente)) {
    select.value = reciente;
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
    if (!lista.length) {
      cuerpo.innerHTML = '<tr><td colspan="10" style="text-align:center">No hay insumos</td></tr>';
      return;
    }

    cuerpo.innerHTML = '';
    const fragment = document.createDocumentFragment();
    agruparPorProveedor(lista).forEach((grupo) => {
      const filaGrupo = document.createElement('tr');
      filaGrupo.className = 'filaGrupoProveedorInventario';
      filaGrupo.innerHTML = `<td colspan="10">Proveedor: ${escapeHtml(grupo.proveedor)}</td>`;
      fragment.appendChild(filaGrupo);

      grupo.items.forEach((insumo) => {
        const porcentaje = Number(insumo.cantidad_total || 0) > 0
          ? Math.min(100, Math.max(0, (Number(insumo.cantidad_disponible || 0) / Number(insumo.cantidad_total || 0)) * 100))
          : 0;
        const clase = porcentaje <= 25 ? 'porcentajeBajo' : porcentaje <= 50 ? 'porcentajeMedio' : 'porcentajeAlto';
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${escapeHtml(insumo.codigo || '')}</td>
          <td>${escapeHtml(insumo.nombre || '')}</td>
          <td>${escapeHtml(insumo.proveedor || '') || '<span style="color:#999">Sin proveedor</span>'}</td>
          <td>${escapeHtml(abrevUnidad(insumo.unidad || ''))}</td>
          <td>${Number(insumo.cantidad_total || 0).toFixed(2)}</td>
          <td>${Number(insumo.cantidad_disponible || 0).toFixed(2)}</td>
          <td>$${Number(insumo.costo_total || 0).toFixed(2)}</td>
          <td>$${Number(insumo.costo_por_unidad || 0).toFixed(2)}</td>
          <td><div class="barraPorcentaje"><div class="barraPorcentajeRelleno ${clase}" style="width:${porcentaje.toFixed(0)}%"></div><span class="textoPorcentaje">${porcentaje.toFixed(0)}%</span></div></td>
          <td>
            <button onclick="window.inventario.editarInsumo(${insumo.id})" class="botonPequeno">✏️</button>
            <button onclick="window.inventario.mostrarHistorialInsumo(${insumo.id}, '${escapeHtml(texto(insumo.nombre).replaceAll('\\', '\\\\').replaceAll("'", "\\'"))}')" class="botonPequeno">📜</button>
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
  if (unidad) unidad.value = ins?.unidad ? abrevUnidad(ins.unidad) : '';
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
  const capt = window.prompt('Nombre del proveedor');
  const prov = texto(capt).trim();
  if (!prov) return;
  if (!proveedoresCatalogo.includes(prov)) proveedoresCatalogo.push(prov);
  proveedoresCatalogo.sort(cmpTexto);

  if (Number.isInteger(index) && index >= 0 && index < itemsOrdenTemporal.length) {
    itemsOrdenTemporal[index].proveedor = prov;
    renderItemsTemporales();
  }

  const select = document.getElementById('proveedorOrden');
  if (select) {
    select.innerHTML = renderOpcionesProveedor(prov);
    select.value = prov;
  }
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
          <div style="display:flex;justify-content:flex-end;margin-bottom:6px">${estadoHtml}</div>
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
  const cantidad = Number(window.prompt('Nueva cantidad requerida', '1'));
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    mostrarNotificacion('Cantidad inválida', 'error');
    return;
  }
  const precioTxt = window.prompt('Precio unitario (opcional, deja vacío para conservar)', '');
  const precio = precioTxt === null || texto(precioTxt).trim() === '' ? null : Number(precioTxt);

  try {
    await fetchAPIJSON(`${API}/recetas/ordenes-compra/items/${id}/cantidad`, {
      method: 'PATCH',
      body: {
        cantidad_requerida: cantidad,
        precio_unitario: Number.isFinite(precio) && precio >= 0 ? precio : undefined
      }
    });
    mostrarNotificacion('Ítem actualizado', 'exito');
    await Promise.all([cargarOrdenesRegistradas(), cargarHistorialOrdenesSurtidas()]);
  } catch (error) {
    mostrarNotificacion(error?.message || 'No se pudo actualizar el ítem', 'error');
  }
}

async function surtirItemOrden(idItem) {
  const id = Number(idItem);
  if (!Number.isFinite(id) || id <= 0) return;

  const cantidad = Number(window.prompt('Cantidad a surtir', '1'));
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    mostrarNotificacion('Cantidad inválida', 'error');
    return;
  }

  const costo = Number(window.prompt('Costo total surtido', '0'));
  if (!Number.isFinite(costo) || costo < 0) {
    mostrarNotificacion('Costo inválido', 'error');
    return;
  }

  const ok = await mostrarConfirmacion('Se actualizará inventario y se guardará historial de surtido.', 'Confirmar surtido');
  if (!ok) return;

  try {
    await fetchAPIJSON(`${API}/recetas/ordenes-compra/items/${id}/surtir`, {
      method: 'POST',
      body: { cantidad_surtida: cantidad, costo_total: costo }
    });
    mostrarNotificacion('Surtido aplicado y registrado en historial', 'exito');
    await Promise.all([cargarOrdenesRegistradas(), cargarHistorialOrdenesSurtidas(), cargarInventario(), cargarEstadisticasInventario(), cargarListaInsumosOrdenes()]);
  } catch (error) {
    mostrarNotificacion(error?.message || 'No se pudo surtir el ítem', 'error');
  }
}

function renderListaInsumosOrden() {
  const cuerpo = document.getElementById('cuerpoListaInsumosOC');
  if (!cuerpo) return;
  const busqueda = busquedaOrdenesActual();

  const listaBase = (Array.isArray(listaInsumosOrdenData) && listaInsumosOrdenData.length)
    ? listaInsumosOrdenData
    : (Array.isArray(inventarioData) ? inventarioData.map((it) => ({
      id_inventario: it?.id,
      codigo: it?.codigo,
      nombre: it?.nombre,
      proveedor: it?.proveedor,
      unidad: it?.unidad,
      cantidad: it?.cantidad_total,
      costo: it?.costo_total,
      fecha_cambio: null
    })) : []);

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
    cuerpo.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#777">No hay insumos para mostrar</td></tr>';
    return;
  }

  let proveedorActual = '';
  const filas = [];
  lista.forEach((it) => {
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
      </tr>
    `);
  });

  cuerpo.innerHTML = filas.join('');
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
    const mapaUso = new Map(usos);
    const cuerpo = document.getElementById('cuerpoTablaProveedores');
    if (!cuerpo) return;

    if (!proveedoresMaestros.length) {
      cuerpo.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#777">Sin proveedores</td></tr>';
      return;
    }

    cuerpo.innerHTML = proveedoresMaestros.map((p) => `
      <tr>
        <td>
          <div>${escapeHtml(p.nombre || '')}</div>
          <div style="margin-top:4px;font-size:11px;color:#666;display:inline-flex;gap:8px;align-items:center;padding:2px 8px;border:1px solid #ddd;border-radius:999px;background:#f7f7f7">
            <span>📦 ${Number(mapaUso.get(Number(p.id || 0))?.inventario || 0)}</span>
            <span>🧰 ${Number(mapaUso.get(Number(p.id || 0))?.utensilios || 0)}</span>
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
  } catch (error) {
    console.error(error);
  }
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
    document.getElementById('idEditInsumo').value = insumo.id;
    document.getElementById('editCodigoInsumo').value = insumo.codigo || '';
    document.getElementById('editNombreInsumo').value = insumo.nombre || '';
    document.getElementById('editProveedorInsumo').value = insumo.proveedor || '';
    document.getElementById('editUnidadInsumo').value = insumo.unidad || '';
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
  const payload = {
    codigo: document.getElementById('editCodigoInsumo')?.value,
    nombre: document.getElementById('editNombreInsumo')?.value,
    proveedor: texto(document.getElementById('editProveedorInsumo')?.value).trim(),
    unidad: document.getElementById('editUnidadInsumo')?.value,
    cantidad_total: Number(document.getElementById('editCantidadInsumo')?.value || 0),
    costo_total: Number(document.getElementById('editCostoInsumo')?.value || 0)
  };
  try {
    const respuesta = await fetchAPI(`${API}/inventario/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (respuesta.ok) {
      cerrarModal('modalEditarInsumo');
      mostrarNotificacion('Insumo actualizado correctamente', 'exito');
      await Promise.all([cargarInventario(), cargarEstadisticasInventario(), cargarCatalogoProveedores()]);
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

async function mostrarHistorialInsumo(id, nombre) {
  try {
    const historial = await fetchAPIJSON(`${API}/inventario/${id}/historial`);
    const cuerpo = document.getElementById('cuerpoHistorialInsumo');
    const titulo = document.getElementById('tituloHistorialInsumo');
    if (!cuerpo || !titulo) return;
    titulo.textContent = `Historial de: ${nombre}`;
    cuerpo.innerHTML = !historial.length
      ? '<tr><td colspan="3" style="text-align:center">Sin movimientos</td></tr>'
      : historial.map((item) => `<tr><td>${new Date(item.fecha_cambio).toLocaleString()}</td><td>${Number(item.cambio_cantidad || 0).toFixed(2)}</td><td>$${Number(item.cambio_costo || 0).toFixed(2)}</td></tr>`).join('');
    abrirModal('modalHistorialInsumo');
  } catch (error) {
    console.error(error);
  }
}

function filtrarInventario(termino) {
  const filas = document.querySelectorAll('#cuerpoInventario tr');
  const t = normalizarTextoBusqueda(termino);
  filas.forEach((fila) => {
    if (fila.cells.length < 2) return;
    const codigo = normalizarTextoBusqueda(fila.cells[0]?.textContent || '');
    const nombre = normalizarTextoBusqueda(fila.cells[1]?.textContent || '');
    const proveedor = normalizarTextoBusqueda(fila.cells[2]?.textContent || '');
    fila.style.display = (codigo.includes(t) || nombre.includes(t) || proveedor.includes(t)) ? '' : 'none';
  });
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
      return `
        <div style="border:2px solid #ddd;border-radius:8px;margin-bottom:15px;overflow:hidden">
          <div onclick="window.inventario.toggleHistorialFecha('${dia.fecha}')" style="background:#f5f5f5;padding:15px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none">
            <div style="flex:1">
              <h4 style="margin:0;color:#333;font-size:16px;text-transform:capitalize">${fecha}</h4>
              <p style="margin:5px 0 0 0;font-size:12px;color:#666">${dia.total_insumos} insumo(s) agregado(s) · Total: $${Number(dia.total_costo || 0).toFixed(2)}</p>
            </div>
            <button id="boton-${dia.fecha}" style="background:none;border:none;font-size:18px;cursor:pointer;padding:0 10px">▶</button>
          </div>
          <div id="detalles-${dia.fecha}" style="display:none;padding:12px;background:#fff">
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
      editarItemOrden,
      surtirItemOrden,
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
      mostrarHistorialInsumo,
      filtrarInventario,
      mostrarHistorialInversion,
      eliminarHistorialFecha,
      toggleHistorialFecha
    };

    cargarInventario();
    cargarEstadisticasInventario();
    setTab('inventario');

    return () => {
      delete window.inventario;
    };
  }, []);

  return (
    <div className="tarjeta">
      <div className="encabezadoTarjeta">
        <h2>Inventario</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <input type="text" className="cajaBusqueda" id="busquedaInventario" placeholder="🔍 Buscar insumo..." onChange={(e) => filtrarInventario(e.target.value)} style={{ width: '220px' }} />
          <div className="botonesImportarExportar">
            <button className="botonImportar" onClick={() => document.getElementById('importarInventario').click()}>📥 Importar</button>
            <input type="file" id="importarInventario" className="inputArchivoOculto" accept=".json" onChange={(e) => importarDatos('inventario', e.target)} />
            <button className="botonExportar" onClick={() => exportarDatos('inventario')}>📤 Exportar</button>
          </div>
          <button className="boton" onClick={() => abrirModalAgregarInsumo()}>➥ Agregar Insumo</button>
          <button className="boton" onClick={() => mostrarHistorialInversion()}>📊 Historial Inversión</button>
        </div>
      </div>

      <div className="tabsSubseccionInventario">
        <button id="btnTabInv" type="button" className="boton activo" onClick={() => setTab('inventario')}>📦 Insumos</button>
        <button id="btnTabUt" type="button" className="boton" onClick={() => setTab('utensilios')}>🧰 Utensilios</button>
        <button id="btnTabOc" type="button" className="boton" onClick={() => setTab('ordenes')}>🧾 Órdenes de compra</button>
      </div>

      <div id="panelInv">
        <div className="gridEstadisticas" style={{ marginBottom: '15px' }}>
          <div className="tarjetaEstadistica"><h3 id="totalInsumos">0</h3><p>Total de Insumos</p></div>
          <div className="tarjetaEstadistica"><h3 id="inversionTotal">$0.00</h3><p>Inversión Total</p></div>
          <div className="tarjetaEstadistica"><h3 id="inversionRecuperada">$0.00</h3><p>Inversión Recuperada</p></div>
          <div className="tarjetaEstadistica"><h3 id="inversionNeta">$0.00</h3><p>Inversión Neta</p></div>
        </div>
        <table>
          <thead>
            <tr><th>Código</th><th>Nombre</th><th>Proveedor</th><th>Unidad</th><th>Cantidad Total</th><th>Disponible</th><th>Costo Total</th><th>Costo/Unidad</th><th>Porcentaje</th><th>Acciones</th></tr>
          </thead>
          <tbody id="cuerpoInventario"></tbody>
        </table>
      </div>

      <div id="panelUt" style={{ display: 'none' }}>
        <Utensilios />
      </div>

      <div id="panelOc" style={{ display: 'none' }}>
        <div className="tabsSubseccionInventario" style={{ marginBottom: '10px' }}>
          <button id="btnOcListaInsumos" type="button" className="boton activo" onClick={() => setTabOrdenes('lista-insumos')}>📋 Lista de insumos</button>
          <button id="btnOcNueva" type="button" className="boton" onClick={() => setTabOrdenes('nueva')}>🧾 Nueva orden de compra</button>
          <button id="btnOcOrdenes" type="button" className="boton" onClick={() => setTabOrdenes('ordenes')}>📦 Órdenes de compra</button>
          <button id="btnOcProveedores" type="button" className="boton" onClick={() => setTabOrdenes('proveedores')}>👤 Proveedores</button>
        </div>

        <div className="bloqueOrdenCompraInventario">
          <div className="filaOrdenCompraInventario">
            <input id="buscarOrdenesGeneral" type="text" placeholder="Buscar por proveedor, código o insumo..." onChange={() => { renderListaInsumosOrden(); cargarOrdenesRegistradas(); cargarHistorialOrdenesSurtidas(); }} />
          </div>

          <div id="panelOrdenListaInsumos">
            <h3>Lista de insumos</h3>
            <table>
              <thead><tr><th>Código</th><th>Nombre</th><th>Gramaje inicial</th><th>Precio total</th><th>Fecha variante</th></tr></thead>
              <tbody id="cuerpoListaInsumosOC"></tbody>
            </table>
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
              <button className="boton" type="button" onClick={() => abrirModalProveedores()}>+ Nuevo proveedor</button>
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
              <input id="unidadInsumo" type="text" placeholder="Unidad" required />
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
            <div className="filaFormulario filaFormulario-CodigoNombre"><input id="editCodigoInsumo" type="text" readOnly /><input id="editNombreInsumo" type="text" required /></div>
            <div className="filaFormulario"><input id="editProveedorInsumo" type="text" placeholder="Proveedor" /></div>
            <div className="filaFormulario filaFormulario-UnidadCantidadCosto"><input id="editUnidadInsumo" type="text" required /><input id="editCantidadInsumo" type="number" step="0.01" min="0" required /><input id="editCostoInsumo" type="number" step="0.01" min="0" required /></div>
            <button className="boton botonExito" type="submit">Guardar cambios</button>
          </form>
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
    </div>
  );
}
