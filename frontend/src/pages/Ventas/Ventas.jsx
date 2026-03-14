import React, { useEffect } from 'react';
import './Ventas.css';
import { mostrarNotificacion } from '../../utils/notificaciones.jsx';
import { abrirModal, cerrarModal } from '../../utils/modales.jsx';
import { API } from '../../utils/config.jsx';
import { normalizarTextoBusqueda } from '../../utils/texto.jsx';
import { fetchAPI, fetchAPIJSON } from '../../utils/api.jsx';
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es.js';
import 'flatpickr/dist/flatpickr.min.css';

export default function Ventas() {
  const CLAVE_TAB_PRINCIPAL = 'chipactli:ventas:tab-principal';
  const CLAVE_TAB_VENTAS = 'chipactli:ventas:tab-ventas';
  const CLAVE_TAB_CORTESIAS = 'chipactli:ventas:tab-cortesias';
  const CLAVE_TAB_DEVOLUCIONES = 'chipactli:ventas:tab-devoluciones';

    const [ultimoResumenDatos, setUltimoResumenDatos] = React.useState(null);
    const [detalleResumen, setDetalleResumen] = React.useState({ titulo: '', lineas: [] });

    function formatoMoneda(valor) {
      return `$${Number(valor || 0).toFixed(2)}`;
    }

    useEffect(() => {
      // Mostrar estadísticas de empresa al cambiar pestaña
      const btnEstadisticas = document.getElementById('btnTabPrincipalEstadisticas');
      if (btnEstadisticas) {
        btnEstadisticas.addEventListener('click', cargarEstadisticasEmpresa);
      }

      try {
        const tabPrincipalGuardada = String(localStorage.getItem(CLAVE_TAB_PRINCIPAL) || '').trim();
        if (tabPrincipalGuardada) setTabPrincipal(tabPrincipalGuardada);
        const tabVentasGuardada = String(localStorage.getItem(CLAVE_TAB_VENTAS) || '').trim();
        if (tabVentasGuardada === 'historial' || tabVentasGuardada === 'dia') {
          pestanaVentasActiva = tabVentasGuardada;
        }
        const tabCortesiasGuardada = String(localStorage.getItem(CLAVE_TAB_CORTESIAS) || '').trim();
        if (tabCortesiasGuardada === 'historial' || tabCortesiasGuardada === 'dia') {
          pestanaCortesiasActiva = tabCortesiasGuardada;
        }
        const tabDevolucionesGuardada = String(localStorage.getItem(CLAVE_TAB_DEVOLUCIONES) || '').trim();
        if (tabDevolucionesGuardada === 'historial' || tabDevolucionesGuardada === 'dia') {
          pestanaDevolucionesActiva = tabDevolucionesGuardada;
        }
      } catch {
        // Ignorar errores de storage.
      }

      return () => {
        if (btnEstadisticas) btnEstadisticas.removeEventListener('click', cargarEstadisticasEmpresa);
      };
    }, []);

    async function cargarEstadisticasEmpresa() {
      try {
        // Obtener datos generales
        const respuesta = await fetch(`${API}/ventas/estadisticas/empresa`);
        if (!respuesta.ok) return;
        const datos = await respuesta.json();
        setUltimoResumenDatos(datos);
        const el = (id) => document.getElementById(id);
        if (el('estadisticaVentasReal')) el('estadisticaVentasReal').textContent = `$${(datos.ventas_reales || 0).toFixed(2)}`;
        if (el('estadisticaCostos')) el('estadisticaCostos').textContent = `$${(datos.costos_totales || 0).toFixed(2)}`;
        if (el('estadisticaInversiones')) el('estadisticaInversiones').textContent = `$${(datos.inversion_actual_total || datos.inversiones || 0).toFixed(2)}`;
        if (el('estadisticaGanancia')) el('estadisticaGanancia').textContent = `$${(datos.ganancia_neta || 0).toFixed(2)}`;
        if (el('estadisticaRentabilidad')) el('estadisticaRentabilidad').textContent = `${(datos.rentabilidad || 0).toFixed(2)}%`;
        if (el('estadisticaTiempoPromedio')) el('estadisticaTiempoPromedio').textContent = `${(datos.tiempo_promedio || 0)} días`;

        // Productos más vendidos
        const listaProd = el('listaProductosMasVendidos');
        if (listaProd) {
          listaProd.innerHTML = '';
          (datos.productos_mas_vendidos || []).forEach(p => {
            const li = document.createElement('li');
            li.textContent = `${p.nombre} (${p.cantidad} ventas)`;
            listaProd.appendChild(li);
          });
        }

        // Historial de inversiones
        const listaInv = el('listaHistorialInversiones');
        if (listaInv) {
          listaInv.innerHTML = '';
          const historialCompras = Array.isArray(datos.historial_compras_ordenes)
            ? datos.historial_compras_ordenes
            : (datos.historial_inversiones || []);
          historialCompras.forEach(inv => {
            const li = document.createElement('li');
            const fecha = String(inv?.fecha || '').replace('T', ' ').slice(0, 16) || '-';
            const numeroOrden = String(inv?.numero_orden || '').trim();
            const proveedor = String(inv?.proveedor || '').trim();
            const monto = Number(inv?.monto || 0).toFixed(2);
            li.textContent = `${fecha} · ${numeroOrden ? `OC ${numeroOrden}` : 'OC'}${proveedor ? ` · ${proveedor}` : ''} · $${monto}`;
            listaInv.appendChild(li);
          });
        }

        // Resumen empresa
        if (el('resumenTotalVentas')) el('resumenTotalVentas').textContent = `Total de ventas: $${(datos.ventas_reales || 0).toFixed(2)}`;
        if (el('resumenTotalCostos')) el('resumenTotalCostos').textContent = `Total de costos: $${(datos.costos_totales || 0).toFixed(2)}`;
        if (el('resumenTotalGanancia')) el('resumenTotalGanancia').textContent = `Ganancia total: $${(datos.ganancia_neta || 0).toFixed(2)}`;
        if (el('resumenTotalInversiones')) el('resumenTotalInversiones').textContent = `Inversión actual (inventario + utensilios): $${(datos.inversion_actual_total || datos.inversiones || 0).toFixed(2)}`;
        if (el('resumenComprasOC')) el('resumenComprasOC').textContent = `Compras surtidas (órdenes de compra): $${(datos.compras_ordenes_total || 0).toFixed(2)}`;
        if (el('resumenComprasPendientesOC')) el('resumenComprasPendientesOC').textContent = `Compras pendientes por surtir: $${(datos.compras_ordenes_pendientes || 0).toFixed(2)}`;
        if (el('resumenRecuperacionTotal')) el('resumenRecuperacionTotal').textContent = `Recuperación total: $${(datos.recuperacion_total || 0).toFixed(2)}`;
        if (el('resumenInversionNeta')) el('resumenInversionNeta').textContent = `Inversión neta: $${(datos.inversion_neta || 0).toFixed(2)}`;
        if (el('resumenRentabilidad')) el('resumenRentabilidad').textContent = `Rentabilidad: ${(datos.rentabilidad || 0).toFixed(2)}%`;
        if (el('resumenTiempoPromedio')) el('resumenTiempoPromedio').textContent = `Tiempo promedio de venta: ${(datos.tiempo_promedio || 0)} días`;

        renderGraficaLineaMensual(datos.serie_mensual || []);
        renderGraficaBarrasProductos(datos.productos_mas_vendidos || []);
      } catch (error) {
        console.error('Error cargando estadísticas de empresa:', error);
      }
    }

    function abrirDetalleResumen(clave) {
      const datos = ultimoResumenDatos;
      if (!datos) {
        mostrarNotificacion('Primero abre la pestaña Estadísticas para cargar datos', 'advertencia');
        return;
      }

      const lineas = [];
      let titulo = 'Detalle';

      if (clave === 'ventas') {
        titulo = 'Detalle: Total de ventas';
        lineas.push(`Total de ventas registradas: ${formatoMoneda(datos.ventas_reales)}`);
        lineas.push('Cálculo: suma de (precio_venta × cantidad) de cada venta.');
      } else if (clave === 'costos') {
        titulo = 'Detalle: Total de costos';
        lineas.push(`Total de costos de producción: ${formatoMoneda(datos.costos_totales)}`);
        lineas.push('Cálculo: suma de costo_produccion de cada venta.');
      } else if (clave === 'ganancia') {
        titulo = 'Detalle: Ganancia total';
        lineas.push(`Ganancia total: ${formatoMoneda(datos.ganancia_neta)}`);
        lineas.push('Cálculo: suma de ganancia por cada venta.');
      } else if (clave === 'inversiones') {
        titulo = 'Detalle: Inversión actual';
        lineas.push(`Inventario actual: ${formatoMoneda(datos.inversion_actual_inventario)}`);
        lineas.push(`Utensilios actuales: ${formatoMoneda(datos.inversion_actual_utensilios)}`);
        lineas.push(`Inversión actual total: ${formatoMoneda(datos.inversion_actual_total || datos.inversiones)}`);
      } else if (clave === 'compras_oc') {
        titulo = 'Detalle: Compras surtidas (OC)';
        lineas.push(`Compras surtidas total: ${formatoMoneda(datos.compras_ordenes_total)}`);
        lineas.push('Origen: órdenes de compra con estado surtida o items surtidos.');
      } else if (clave === 'compras_pendientes') {
        titulo = 'Detalle: Compras pendientes por surtir';
        lineas.push(`Compras pendientes: ${formatoMoneda(datos.compras_ordenes_pendientes)}`);
        lineas.push('Origen: items no surtidos de órdenes de compra (estimado por cantidad requerida × precio unitario).');
      } else if (clave === 'recuperacion') {
        titulo = 'Detalle: Recuperación total';
        const negativos = Array.isArray(datos.movimientos_recuperacion_negativos)
          ? datos.movimientos_recuperacion_negativos
          : [];
        const positivos = Array.isArray(datos.movimientos_recuperacion_positivos)
          ? datos.movimientos_recuperacion_positivos
          : [];

        lineas.push(`Recuperación total actual: ${formatoMoneda(datos.recuperacion_total)}`);
        lineas.push(`Movimientos positivos (histórico): ${Number(datos.recuperacion_positivos_historico_count || 0)} (${formatoMoneda(datos.recuperacion_positivos_historico_total)})`);
        lineas.push(`Movimientos negativos (histórico): ${Number(datos.recuperacion_negativos_historico_count || 0)} (${formatoMoneda(datos.recuperacion_negativos_historico_total)})`);

        if (Number(datos.recuperacion_negativos_historico_count || 0) <= 0) {
          lineas.push('No hay movimientos negativos registrados en el histórico de recuperación.');
        } else {
          lineas.push('Origen específico de la pérdida (últimos movimientos negativos encontrados):');
          negativos.slice(0, 20).forEach((m) => {
            const fecha = String(m?.fecha || '').replace('T', ' ').slice(0, 16) || '-';
            const id = Number(m?.id || 0);
            const monto = formatoMoneda(m?.monto || 0);
            const fuenteRaw = String(m?.fuente || '').trim();
            const fuente = fuenteRaw === 'inversion_recuperada'
              ? 'Tabla inversion_recuperada (recuperación ventas)'
              : (fuenteRaw === 'recuperado_utensilios'
                ? 'Tabla recuperado_utensilios'
                : (fuenteRaw || 'tabla desconocida'));
            lineas.push(`• ${fecha} · ${fuente} · ID ${id > 0 ? id : '-'} · ${monto}`);
          });
          if (!negativos.length) {
            lineas.push('No hay negativos dentro del lote reciente consultado; existen en histórico y pueden ser más antiguos.');
          }
        }
      } else if (clave === 'inversion_neta') {
        titulo = 'Detalle: Inversión neta';
        lineas.push(`Inversión actual total: ${formatoMoneda(datos.inversion_actual_total || datos.inversiones)}`);
        lineas.push(`Recuperación total: ${formatoMoneda(datos.recuperacion_total)}`);
        lineas.push(`Inversión neta: ${formatoMoneda(datos.inversion_neta)}`);
        lineas.push('Fórmula: inversión actual total - recuperación total.');
      } else if (clave === 'rentabilidad') {
        titulo = 'Detalle: Rentabilidad';
        lineas.push(`Rentabilidad: ${Number(datos.rentabilidad || 0).toFixed(2)}%`);
        lineas.push('Fórmula: (ganancia_neta / ventas_reales) × 100.');
      } else if (clave === 'tiempo') {
        titulo = 'Detalle: Tiempo promedio de venta';
        lineas.push(`Tiempo promedio: ${Number(datos.tiempo_promedio || 0)} días`);
        lineas.push('Cálculo: promedio de diferencia entre fechas consecutivas de venta.');
      }

      setDetalleResumen({ titulo, lineas });
      abrirModal('modalDetalleResumenEmpresa');
    }

    function renderGraficaLineaMensual(serie) {
      const svg = document.getElementById('graficaLineaMensualSvg');
      const tendenciaEl = document.getElementById('indicadorTendenciaMensual');
      if (!svg) return;

      const datos = Array.isArray(serie) ? serie : [];
      if (!datos.length) {
        svg.innerHTML = '<text x="10" y="24" fill="#6d7f76" font-size="12">Sin datos suficientes</text>';
        if (tendenciaEl) tendenciaEl.textContent = 'Sin tendencia disponible';
        return;
      }

      const width = 760;
      const height = 220;
      const padX = 34;
      const padY = 26;
      const innerW = width - (padX * 2);
      const innerH = height - (padY * 2);

      const maxValor = Math.max(
        1,
        ...datos.map((d) => Number(d?.ingresos || 0)),
        ...datos.map((d) => Number(d?.ganancia || 0)),
        ...datos.map((d) => Number(d?.compras || 0))
      );

      const puntosIngresos = [];
      const puntosGanancia = [];
      const puntosCompras = [];
      const etiquetas = [];

      datos.forEach((d, i) => {
        const x = padX + ((innerW * i) / Math.max(1, datos.length - 1));
        const yIngresos = padY + innerH - ((Number(d?.ingresos || 0) / maxValor) * innerH);
        const yGanancia = padY + innerH - ((Number(d?.ganancia || 0) / maxValor) * innerH);
        const yCompras = padY + innerH - ((Number(d?.compras || 0) / maxValor) * innerH);
        puntosIngresos.push(`${x},${yIngresos}`);
        puntosGanancia.push(`${x},${yGanancia}`);
        puntosCompras.push(`${x},${yCompras}`);
        etiquetas.push(`<text x="${x}" y="${height - 6}" text-anchor="middle" fill="#6d7f76" font-size="10">${String(d?.label || '').slice(0, 6)}</text>`);
      });

      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.innerHTML = `
        <rect x="0" y="0" width="${width}" height="${height}" rx="14" fill="#f8fbf9"></rect>
        <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" stroke="#d5e1db" stroke-width="1" />
        <line x1="${padX}" y1="${padY}" x2="${padX}" y2="${height - padY}" stroke="#d5e1db" stroke-width="1" />
        <polyline fill="none" stroke="#2f7f52" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${puntosIngresos.join(' ')}"></polyline>
        <polyline fill="none" stroke="#8aa34b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${puntosGanancia.join(' ')}"></polyline>
        <polyline fill="none" stroke="#b67c2a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${puntosCompras.join(' ')}"></polyline>
        ${etiquetas.join('')}
      `;

      if (tendenciaEl && datos.length >= 2) {
        const ultimo = Number(datos[datos.length - 1]?.ingresos || 0);
        const previo = Number(datos[datos.length - 2]?.ingresos || 0);
        const delta = ultimo - previo;
        const porcentaje = previo > 0 ? (delta / previo) * 100 : (ultimo > 0 ? 100 : 0);
        const texto = delta >= 0
          ? `Subiendo ${porcentaje.toFixed(1)}% vs mes anterior`
          : `Bajando ${Math.abs(porcentaje).toFixed(1)}% vs mes anterior`;
        tendenciaEl.textContent = texto;
      }
    }

    function renderGraficaBarrasProductos(productos) {
      const contenedor = document.getElementById('graficaTopProductos');
      if (!contenedor) return;
      const lista = Array.isArray(productos) ? productos.slice(0, 8) : [];
      if (!lista.length) {
        contenedor.innerHTML = '<div class="ventasGraficaVacio">Sin productos con ventas aún</div>';
        return;
      }
      const maximo = Math.max(1, ...lista.map((p) => Number(p?.cantidad || 0)));
      contenedor.innerHTML = lista.map((p) => {
        const cantidad = Number(p?.cantidad || 0);
        const pct = Math.max(2, (cantidad / maximo) * 100);
        return `
          <div class="ventasBarraFila">
            <div class="ventasBarraEtiqueta">${String(p?.nombre || 'Producto').slice(0, 34)}</div>
            <div class="ventasBarraTrack"><div class="ventasBarraFill" style="width:${pct}%"></div></div>
            <div class="ventasBarraValor">${cantidad}</div>
          </div>
        `;
      }).join('');
    }
  useEffect(() => {
    window.ventas = {
      cargarVentas,
      cargarCortesias,
      cargarDevoluciones,
      eliminarVenta,
      confirmarAccionEliminarVenta,
      cerrarModalEliminarVenta,
      cargarEstadisticasVentas,
      filtrarVentas,
      cambiarPestanaPrincipal,
      cambiarPestanaVentas,
      cambiarPestanaCortesias,
      cambiarPestanaDevoluciones
    };

    cargarVentas();
    cargarCortesias();
    cargarDevoluciones();
    renderPestanaPrincipal();

    const onVentas = () => {
      cargarVentas();
    };
    const onCortesias = () => {
      cargarCortesias();
    };
    const onDevoluciones = () => {
      cargarDevoluciones();
    };

    window.addEventListener('ventasActualizadas', onVentas);
    window.addEventListener('cortesiasActualizadas', onCortesias);
    window.addEventListener('devolucionesActualizadas', onDevoluciones);

    return () => {
      window.removeEventListener('ventasActualizadas', onVentas);
      window.removeEventListener('cortesiasActualizadas', onCortesias);
      window.removeEventListener('devolucionesActualizadas', onDevoluciones);
      destruirCalendario('busquedaFechaVentasHistorial');
      destruirCalendario('busquedaFechaCortesiasHistorial');
      destruirCalendario('busquedaFechaDevolucionesHistorial');
    };
  }, []);

  // Control de pestañas
  const [tabPrincipal, setTabPrincipal] = React.useState('ventas');

  useEffect(() => {
    if (tabPrincipal === 'estadisticas') {
      cargarEstadisticasEmpresa();
    }
  }, [tabPrincipal]);

  function cambiarPestanaPrincipal(tab) {
    setTabPrincipal(tab);
    try {
      localStorage.setItem(CLAVE_TAB_PRINCIPAL, String(tab || 'ventas'));
    } catch {
      // Ignorar errores de storage.
    }
    if (tab === 'estadisticas') cargarEstadisticasEmpresa();
  }

  return (
    <div>
      <div className="tarjeta ventasCabeceraCompacta">
        <div className="ventasCabeceraTabs">
          <button id="btnTabPrincipalVentas" className={tabPrincipal === 'ventas' ? 'boton activo' : 'boton'} onClick={() => cambiarPestanaPrincipal('ventas')}>Ventas</button>
          <button id="btnTabPrincipalCortesias" className={tabPrincipal === 'cortesias' ? 'boton activo' : 'boton'} onClick={() => cambiarPestanaPrincipal('cortesias')}>Cortesías</button>
          <button id="btnTabPrincipalDevoluciones" className={tabPrincipal === 'devoluciones' ? 'boton activo' : 'boton'} onClick={() => cambiarPestanaPrincipal('devoluciones')}>Devoluciones</button>
          <button id="btnTabPrincipalEstadisticas" className={tabPrincipal === 'estadisticas' ? 'boton activo' : 'boton'} onClick={() => cambiarPestanaPrincipal('estadisticas')}>📊 Estadísticas</button>
        </div>

        {tabPrincipal === 'ventas' && (
          <div className="ventasCabeceraBusquedaCompacta">
            <h2>Ventas</h2>
            <input
              type="text"
              className="cajaBusqueda ventasBusquedaCompacta"
              placeholder="🔍 Buscar venta..."
              onChange={e => filtrarVentas(e.target.value)}
            />
          </div>
        )}
      </div>

      {tabPrincipal === 'estadisticas' && (
        <div id="panelPrincipalEstadisticas" className="tarjeta">
          <h2>Estadísticas de Rentabilidad y Empresa</h2>
          <div className="gridEstadisticas" style={{ marginBottom: '15px' }}>
            <div className="tarjetaEstadistica"><h3 id="estadisticaVentasReal">$0</h3><p>Ventas reales</p></div>
            <div className="tarjetaEstadistica"><h3 id="estadisticaCostos">$0</h3><p>Costos totales</p></div>
            <div className="tarjetaEstadistica"><h3 id="estadisticaInversiones">$0</h3><p>Inversiones</p></div>
            <div className="tarjetaEstadistica"><h3 id="estadisticaGanancia">$0</h3><p>Ganancia neta</p></div>
            <div className="tarjetaEstadistica"><h3 id="estadisticaRentabilidad">0%</h3><p>Rentabilidad</p></div>
            <div className="tarjetaEstadistica"><h3 id="estadisticaTiempoPromedio">0</h3><p>Tiempo promedio de venta</p></div>
          </div>
          <div className="tarjeta" style={{ marginBottom: '15px' }}>
            <h3>Productos más vendidos</h3>
            <ul id="listaProductosMasVendidos"></ul>
          </div>
          <div className="tarjeta" style={{ marginBottom: '15px' }}>
            <h3>Historial de compras surtidas (órdenes de compra)</h3>
            <ul id="listaHistorialInversiones"></ul>
          </div>
          <div className="tarjeta" style={{ marginBottom: '15px' }}>
            <h3>Resumen de empresa</h3>
            <ul id="listaResumenEmpresa">
              <li><button type="button" className="resumenDetalleBtn" onClick={() => abrirDetalleResumen('ventas')}><span id="resumenTotalVentas">Total de ventas: $0</span></button></li>
              <li><button type="button" className="resumenDetalleBtn" onClick={() => abrirDetalleResumen('costos')}><span id="resumenTotalCostos">Total de costos: $0</span></button></li>
              <li><button type="button" className="resumenDetalleBtn" onClick={() => abrirDetalleResumen('ganancia')}><span id="resumenTotalGanancia">Ganancia total: $0</span></button></li>
              <li><button type="button" className="resumenDetalleBtn" onClick={() => abrirDetalleResumen('inversiones')}><span id="resumenTotalInversiones">Total de inversiones: $0</span></button></li>
              <li><button type="button" className="resumenDetalleBtn" onClick={() => abrirDetalleResumen('compras_oc')}><span id="resumenComprasOC">Compras surtidas (órdenes de compra): $0</span></button></li>
              <li><button type="button" className="resumenDetalleBtn" onClick={() => abrirDetalleResumen('compras_pendientes')}><span id="resumenComprasPendientesOC">Compras pendientes por surtir: $0</span></button></li>
              <li><button type="button" className="resumenDetalleBtn" onClick={() => abrirDetalleResumen('recuperacion')}><span id="resumenRecuperacionTotal">Recuperación total: $0</span></button></li>
              <li><button type="button" className="resumenDetalleBtn" onClick={() => abrirDetalleResumen('inversion_neta')}><span id="resumenInversionNeta">Inversión neta: $0</span></button></li>
              <li><button type="button" className="resumenDetalleBtn" onClick={() => abrirDetalleResumen('rentabilidad')}><span id="resumenRentabilidad">Rentabilidad: 0%</span></button></li>
              <li><button type="button" className="resumenDetalleBtn" onClick={() => abrirDetalleResumen('tiempo')}><span id="resumenTiempoPromedio">Tiempo promedio de venta: 0 días</span></button></li>
            </ul>
          </div>

          <div className="tarjeta ventasGraficaCard" style={{ marginBottom: '15px' }}>
            <div className="ventasGraficaHeader">
              <h3>Tendencia mensual (ingresos vs ganancia)</h3>
              <span id="indicadorTendenciaMensual" className="ventasIndicadorTendencia">Sin tendencia disponible</span>
            </div>
            <svg id="graficaLineaMensualSvg" className="ventasGraficaSvg" viewBox="0 0 760 220" aria-label="Gráfica de tendencia mensual"></svg>
            <div className="ventasGraficaLeyenda">
              <span><i className="dot ingresos"></i>Ingresos</span>
              <span><i className="dot ganancia"></i>Ganancia</span>
              <span><i className="dot compras"></i>Compras OC</span>
            </div>
          </div>

          <div className="tarjeta ventasGraficaCard" style={{ marginBottom: '15px' }}>
            <h3>Top productos más comprados</h3>
            <div id="graficaTopProductos" className="ventasBarrasWrap"></div>
          </div>
        </div>
      )}

      <div id="panelPrincipalVentas" className="tarjeta">
        <h2>Ventas</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
          <button id="btnVentasDia" className="boton activo" onClick={() => cambiarPestanaVentas('dia')}>Ventas del día</button>
          <button id="btnVentasHistorial" className="boton" onClick={() => cambiarPestanaVentas('historial')}>Historial de ventas</button>
          <input
            id="busquedaFechaVentasHistorial"
            type="date"
            style={{ marginLeft: 'auto' }}
            onChange={(e) => {
              fechaBusquedaHistorialVentas = String(e.target.value || '');
              renderVentas();
            }}
            title="Buscar historial por fecha"
          />
        </div>

        <div id="panelVentasDia">
          <table>
            <thead>
              <tr>
                <th>Receta</th><th>Categoría</th><th>Cantidad</th><th>Pedido</th><th>Fecha Producción</th><th>Fecha Venta</th><th>Costo</th><th>Venta</th><th>Ganancia</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody id="cuerpoVentasDia"></tbody>
          </table>
        </div>

        <div id="panelVentasHistorial" style={{ display: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Receta</th><th>Categoría</th><th>Cantidad</th><th>Pedido</th><th>Fecha Producción</th><th>Fecha Venta</th><th>Costo</th><th>Venta</th><th>Ganancia</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody id="cuerpoVentasHistorial"></tbody>
          </table>
        </div>
      </div>

      <div id="panelPrincipalCortesias" className="tarjeta" style={{ display: 'none' }}>
        <h2>Cortesías</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
          <button id="btnCortesiasDia" className="boton activo" onClick={() => cambiarPestanaCortesias('dia')}>Cortesías del día</button>
          <button id="btnCortesiasHistorial" className="boton" onClick={() => cambiarPestanaCortesias('historial')}>Historial de cortesías</button>
          <input
            id="busquedaFechaCortesiasHistorial"
            type="date"
            style={{ marginLeft: 'auto' }}
            onChange={(e) => {
              fechaBusquedaHistorialCortesias = String(e.target.value || '');
              renderCortesias();
            }}
            title="Buscar historial por fecha"
          />
        </div>

        <div id="panelCortesiasDia">
          <table>
            <thead>
              <tr><th>Receta</th><th>Cantidad</th><th>Pedido</th><th>Motivo</th><th>Para quién</th><th>Fecha y hora</th></tr>
            </thead>
            <tbody id="cuerpoCortesiasDia"></tbody>
          </table>
        </div>

        <div id="panelCortesiasHistorial" style={{ display: 'none' }}>
          <table>
            <thead>
              <tr><th>Receta</th><th>Cantidad</th><th>Pedido</th><th>Motivo</th><th>Para quién</th><th>Fecha y hora</th></tr>
            </thead>
            <tbody id="cuerpoCortesiasHistorial"></tbody>
          </table>
        </div>
      </div>

      <div id="panelPrincipalDevoluciones" className="tarjeta" style={{ display: 'none' }}>
        <h2>Devoluciones</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
          <button id="btnDevolucionesDia" className="boton activo" onClick={() => cambiarPestanaDevoluciones('dia')}>Devoluciones del día</button>
          <button id="btnDevolucionesHistorial" className="boton" onClick={() => cambiarPestanaDevoluciones('historial')}>Historial de devoluciones</button>
          <input
            id="busquedaFechaDevolucionesHistorial"
            type="date"
            style={{ marginLeft: 'auto' }}
            onChange={(e) => {
              fechaBusquedaHistorialDevoluciones = String(e.target.value || '');
              renderDevoluciones();
            }}
            title="Buscar devoluciones por fecha"
          />
        </div>

        <div id="panelDevolucionesDia">
          <table>
            <thead>
              <tr><th>Receta</th><th>Cantidad</th><th>Pedido</th><th>Tipo</th><th>Motivo</th><th>Observaciones</th><th>Fecha</th></tr>
            </thead>
            <tbody id="cuerpoDevolucionesDia"></tbody>
          </table>
        </div>

        <div id="panelDevolucionesHistorial" style={{ display: 'none' }}>
          <table>
            <thead>
              <tr><th>Receta</th><th>Cantidad</th><th>Pedido</th><th>Tipo</th><th>Motivo</th><th>Observaciones</th><th>Fecha</th></tr>
            </thead>
            <tbody id="cuerpoDevolucionesHistorial"></tbody>
          </table>
        </div>
      </div>

      <div id="modalAccionEliminarVenta" className="modal" onClick={() => cerrarModalEliminarVenta()}>
        <div className="contenidoModal" onClick={(e) => e.stopPropagation()}>
          <div className="encabezadoModal">
            <h3>Acción sobre venta</h3>
            <button className="cerrarModal" onClick={() => cerrarModalEliminarVenta()}>&times;</button>
          </div>
          <div className="cajaFormulario">
            <label htmlFor="accionEliminarVenta">¿Qué deseas hacer?</label>
            <select id="accionEliminarVenta" onChange={() => actualizarModalEliminarVenta()}>
              <option value="devolucion">Venta por devolución del cliente (merma)</option>
              <option value="regresar_produccion">Eliminar de ventas y regresar a producción</option>
            </select>

            <div id="bloqueMotivosDevolucion">
              <label htmlFor="motivoDevolucionVenta">Motivo de devolución</label>
              <select id="motivoDevolucionVenta">
                <option value="Producto dañado">Producto dañado</option>
                <option value="Error de entrega">Error de entrega</option>
                <option value="No le gustó al cliente">No le gustó al cliente</option>
                <option value="Vencimiento">Vencimiento</option>
                <option value="Empaque en mal estado">Empaque en mal estado</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <label htmlFor="motivoOperacionVenta">Motivo</label>
            <input id="motivoOperacionVenta" type="text" placeholder="Escribe el motivo" />

            <label htmlFor="observacionesOperacionVenta">Observaciones</label>
            <input id="observacionesOperacionVenta" type="text" placeholder="Opcional" />

            <button className="boton botonExito" type="button" onClick={() => confirmarAccionEliminarVenta()}>Confirmar</button>
          </div>
        </div>
      </div>

      <div id="modalDetalleResumenEmpresa" className="modal" onClick={() => cerrarModal('modalDetalleResumenEmpresa')}>
        <div className="contenidoModal" onClick={(e) => e.stopPropagation()}>
          <div className="encabezadoModal">
            <h3>{detalleResumen.titulo || 'Detalle de resumen'}</h3>
            <button className="cerrarModal" onClick={() => cerrarModal('modalDetalleResumenEmpresa')}>&times;</button>
          </div>
          <div className="cajaFormulario">
            <div className="resumenDetalleLista">
              {(detalleResumen.lineas || []).map((linea, idx) => (
                <p key={`detalle-resumen-${idx}`}>{linea}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

let categoriaVentaActual = null;
let periodoVentaActual = 'mes';
let ventasData = [];
let cortesiasData = [];
let devolucionesData = [];
let terminoBusquedaVentas = '';
let fechaBusquedaHistorialVentas = '';
let fechaBusquedaHistorialCortesias = '';
let fechaBusquedaHistorialDevoluciones = '';
let pestanaVentasActiva = 'dia';
let pestanaCortesiasActiva = 'dia';
let pestanaDevolucionesActiva = 'dia';
let pestanaPrincipalActiva = 'ventas';
let ventaPendienteAccion = null;

const CLAVE_TAB_VENTAS = 'chipactli:ventas:tab-ventas';
const CLAVE_TAB_CORTESIAS = 'chipactli:ventas:tab-cortesias';
const CLAVE_TAB_DEVOLUCIONES = 'chipactli:ventas:tab-devoluciones';

function destruirCalendario(inputId) {
  const input = document.getElementById(inputId);
  if (input?._flatpickr) {
    input._flatpickr.destroy();
  }
}

function construirSetFechas(lista = [], campoFecha = '') {
  const set = new Set();
  (Array.isArray(lista) ? lista : []).forEach((item) => {
    const clave = fechaClaveLocal(item?.[campoFecha]);
    if (clave) set.add(clave);
  });
  return set;
}

function inicializarCalendarioConPuntos({ inputId, valorActual, fechasConRegistro, onSeleccion, tipoMarca }) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (input._flatpickr) input._flatpickr.destroy();

  flatpickr(input, {
    locale: Spanish,
    dateFormat: 'Y-m-d',
    allowInput: true,
    defaultDate: valorActual || null,
    onChange: (_selected, dateStr) => {
      onSeleccion(String(dateStr || ''));
    },
    onDayCreate: (_dObj, _dStr, _fp, dayElem) => {
      const d = dayElem?.dateObj;
      if (!d) return;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const clave = `${y}-${m}-${day}`;
      if (fechasConRegistro.has(clave)) {
        dayElem.classList.add('chipactli-dia-con-registro');
        dayElem.classList.add(`chipactli-dia-con-registro-${String(tipoMarca || 'general')}`);
      }
    }
  });
}

function refrescarCalendariosConRegistros() {
  const fechasVentas = construirSetFechas(ventasData, 'fecha_venta');
  const fechasCortesias = construirSetFechas(cortesiasData, 'fecha_cortesia');
  const fechasDevoluciones = construirSetFechas(devolucionesData, 'fecha_devolucion');

  inicializarCalendarioConPuntos({
    inputId: 'busquedaFechaVentasHistorial',
    valorActual: fechaBusquedaHistorialVentas,
    fechasConRegistro: fechasVentas,
    tipoMarca: 'ventas',
    onSeleccion: (valor) => {
      fechaBusquedaHistorialVentas = valor;
      renderVentas();
    }
  });

  inicializarCalendarioConPuntos({
    inputId: 'busquedaFechaCortesiasHistorial',
    valorActual: fechaBusquedaHistorialCortesias,
    fechasConRegistro: fechasCortesias,
    tipoMarca: 'cortesias',
    onSeleccion: (valor) => {
      fechaBusquedaHistorialCortesias = valor;
      renderCortesias();
    }
  });

  inicializarCalendarioConPuntos({
    inputId: 'busquedaFechaDevolucionesHistorial',
    valorActual: fechaBusquedaHistorialDevoluciones,
    fechasConRegistro: fechasDevoluciones,
    tipoMarca: 'devoluciones',
    onSeleccion: (valor) => {
      fechaBusquedaHistorialDevoluciones = valor;
      renderDevoluciones();
    }
  });
}

function renderPestanaPrincipal() {
  const btnVentas = document.getElementById('btnTabPrincipalVentas');
  const btnCortesias = document.getElementById('btnTabPrincipalCortesias');
  const btnDevoluciones = document.getElementById('btnTabPrincipalDevoluciones');
  const panelVentas = document.getElementById('panelPrincipalVentas');
  const panelCortesias = document.getElementById('panelPrincipalCortesias');
  const panelDevoluciones = document.getElementById('panelPrincipalDevoluciones');

  if (btnVentas) btnVentas.classList.toggle('activo', pestanaPrincipalActiva === 'ventas');
  if (btnCortesias) btnCortesias.classList.toggle('activo', pestanaPrincipalActiva === 'cortesias');
  if (btnDevoluciones) btnDevoluciones.classList.toggle('activo', pestanaPrincipalActiva === 'devoluciones');
  if (panelVentas) panelVentas.style.display = pestanaPrincipalActiva === 'ventas' ? '' : 'none';
  if (panelCortesias) panelCortesias.style.display = pestanaPrincipalActiva === 'cortesias' ? '' : 'none';
  if (panelDevoluciones) panelDevoluciones.style.display = pestanaPrincipalActiva === 'devoluciones' ? '' : 'none';
}

function cambiarPestanaPrincipal(tab) {
  if (tab === 'cortesias') pestanaPrincipalActiva = 'cortesias';
  else if (tab === 'devoluciones') pestanaPrincipalActiva = 'devoluciones';
  else pestanaPrincipalActiva = 'ventas';
  renderPestanaPrincipal();
}

function fechaClaveLocal(fechaIso) {
  const d = new Date(fechaIso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hoyClaveLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatearFechaClave(fechaClave) {
  if (!fechaClave) return 'Sin fecha';
  const d = new Date(`${fechaClave}T00:00:00`);
  if (Number.isNaN(d.getTime())) return fechaClave;
  return d.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function renderPestanasVentas() {
  const btnDia = document.getElementById('btnVentasDia');
  const btnHist = document.getElementById('btnVentasHistorial');
  const panelDia = document.getElementById('panelVentasDia');
  const panelHist = document.getElementById('panelVentasHistorial');
  if (btnDia) btnDia.classList.toggle('activo', pestanaVentasActiva === 'dia');
  if (btnHist) btnHist.classList.toggle('activo', pestanaVentasActiva === 'historial');
  if (panelDia) panelDia.style.display = pestanaVentasActiva === 'dia' ? '' : 'none';
  if (panelHist) panelHist.style.display = pestanaVentasActiva === 'historial' ? '' : 'none';
}

function renderPestanasCortesias() {
  const btnDia = document.getElementById('btnCortesiasDia');
  const btnHist = document.getElementById('btnCortesiasHistorial');
  const panelDia = document.getElementById('panelCortesiasDia');
  const panelHist = document.getElementById('panelCortesiasHistorial');
  if (btnDia) btnDia.classList.toggle('activo', pestanaCortesiasActiva === 'dia');
  if (btnHist) btnHist.classList.toggle('activo', pestanaCortesiasActiva === 'historial');
  if (panelDia) panelDia.style.display = pestanaCortesiasActiva === 'dia' ? '' : 'none';
  if (panelHist) panelHist.style.display = pestanaCortesiasActiva === 'historial' ? '' : 'none';
}

function cambiarPestanaVentas(tab) {
  pestanaVentasActiva = tab === 'historial' ? 'historial' : 'dia';
  try {
    localStorage.setItem(CLAVE_TAB_VENTAS, pestanaVentasActiva);
  } catch {
    // Ignorar errores de storage.
  }
  renderPestanasVentas();
  refrescarCalendariosConRegistros();
}

function cambiarPestanaCortesias(tab) {
  pestanaCortesiasActiva = tab === 'historial' ? 'historial' : 'dia';
  try {
    localStorage.setItem(CLAVE_TAB_CORTESIAS, pestanaCortesiasActiva);
  } catch {
    // Ignorar errores de storage.
  }
  renderPestanasCortesias();
  refrescarCalendariosConRegistros();
}

function renderPestanasDevoluciones() {
  const btnDia = document.getElementById('btnDevolucionesDia');
  const btnHist = document.getElementById('btnDevolucionesHistorial');
  const panelDia = document.getElementById('panelDevolucionesDia');
  const panelHist = document.getElementById('panelDevolucionesHistorial');
  if (btnDia) btnDia.classList.toggle('activo', pestanaDevolucionesActiva === 'dia');
  if (btnHist) btnHist.classList.toggle('activo', pestanaDevolucionesActiva === 'historial');
  if (panelDia) panelDia.style.display = pestanaDevolucionesActiva === 'dia' ? '' : 'none';
  if (panelHist) panelHist.style.display = pestanaDevolucionesActiva === 'historial' ? '' : 'none';
}

function cambiarPestanaDevoluciones(tab) {
  pestanaDevolucionesActiva = tab === 'historial' ? 'historial' : 'dia';
  try {
    localStorage.setItem(CLAVE_TAB_DEVOLUCIONES, pestanaDevolucionesActiva);
  } catch {
    // Ignorar errores de storage.
  }
  renderPestanasDevoluciones();
  refrescarCalendariosConRegistros();
}

function actualizarTarjetaCortesiasDia() {
  const hoy = hoyClaveLocal();
  const total = (Array.isArray(cortesiasData) ? cortesiasData : []).reduce((sum, c) => {
    return fechaClaveLocal(c?.fecha_cortesia) === hoy ? (sum + (Number(c?.cantidad || 0))) : sum;
  }, 0);
  const el = document.getElementById('cortesiasDia');
  if (el) el.textContent = total;
}

function filaVentaHtml(venta) {
  const fechaProduccion = new Date(venta.fecha_produccion).toLocaleString();
  const fechaVenta = new Date(venta.fecha_venta).toLocaleString();
  return `
    <td>${venta.nombre_receta}</td>
    <td>${venta.categoria || 'Sin categoría'}</td>
    <td>${venta.cantidad}</td>
    <td>${venta.numero_pedido || ''}</td>
    <td>${fechaProduccion}</td>
    <td>${fechaVenta}</td>
    <td>$${Number(venta.costo_produccion || 0).toFixed(2)}</td>
    <td>$${(Number(venta.precio_venta || 0) * Number(venta.cantidad || 0)).toFixed(2)}</td>
    <td>$${Number(venta.ganancia || 0).toFixed(2)}</td>
    <td><button onclick="window.ventas.eliminarVenta(${venta.id})" class="botonPequeno botonDanger">🗑️ Eliminar</button></td>
  `;
}

function renderVentas() {
  const hoy = hoyClaveLocal();
  const termino = normalizarTextoBusqueda(terminoBusquedaVentas);
  const ventas = Array.isArray(ventasData) ? ventasData : [];

  const filtrarTermino = (venta) => {
    if (!termino) return true;
    const textoFila = [venta?.nombre_receta, venta?.categoria, venta?.numero_pedido]
      .map((v) => normalizarTextoBusqueda(v || ''))
      .join(' ');
    return textoFila.includes(termino);
  };

  const dia = ventas
    .filter((v) => fechaClaveLocal(v?.fecha_venta) === hoy)
    .filter(filtrarTermino)
    .sort((a, b) => String(b?.fecha_venta || '').localeCompare(String(a?.fecha_venta || '')));

  const historial = ventas
    .filter((v) => fechaClaveLocal(v?.fecha_venta) !== hoy)
    .filter((v) => !fechaBusquedaHistorialVentas || fechaClaveLocal(v?.fecha_venta) === fechaBusquedaHistorialVentas)
    .filter(filtrarTermino)
    .sort((a, b) => String(b?.fecha_venta || '').localeCompare(String(a?.fecha_venta || '')));

  const cuerpoDia = document.getElementById('cuerpoVentasDia');
  const cuerpoHist = document.getElementById('cuerpoVentasHistorial');
  if (!cuerpoDia || !cuerpoHist) return;

  cuerpoDia.innerHTML = '';
  if (!dia.length) {
    cuerpoDia.innerHTML = '<tr><td colspan="10" style="text-align:center">Sin ventas del día</td></tr>';
  } else {
    dia.forEach((venta) => {
      const fila = document.createElement('tr');
      fila.innerHTML = filaVentaHtml(venta);
      cuerpoDia.appendChild(fila);
    });
  }

  cuerpoHist.innerHTML = '';
  if (!historial.length) {
    cuerpoHist.innerHTML = '<tr><td colspan="10" style="text-align:center">Sin historial para la fecha seleccionada</td></tr>';
  } else {
    let fechaActual = '';
    historial.forEach((venta) => {
      const clave = fechaClaveLocal(venta?.fecha_venta);
      if (clave !== fechaActual) {
        fechaActual = clave;
        const filaGrupo = document.createElement('tr');
        filaGrupo.innerHTML = `<td colspan="10" style="background:#f2f6f3;font-weight:700">${formatearFechaClave(clave)}</td>`;
        cuerpoHist.appendChild(filaGrupo);
      }
      const fila = document.createElement('tr');
      fila.innerHTML = filaVentaHtml(venta);
      cuerpoHist.appendChild(fila);
    });
  }

  renderPestanasVentas();
}

function filaCortesiaHtml(cortesia) {
  const fechaCortesia = new Date(cortesia.fecha_cortesia).toLocaleString();
  return `
    <td>${cortesia.nombre_receta}</td>
    <td>${cortesia.cantidad}</td>
    <td>${cortesia.numero_pedido || ''}</td>
    <td>${cortesia.motivo || ''}</td>
    <td>${cortesia.para_quien || ''}</td>
    <td>${fechaCortesia}</td>
  `;
}

function renderCortesias() {
  const hoy = hoyClaveLocal();
  const cortesias = Array.isArray(cortesiasData) ? cortesiasData : [];

  const dia = cortesias
    .filter((c) => fechaClaveLocal(c?.fecha_cortesia) === hoy)
    .sort((a, b) => String(b?.fecha_cortesia || '').localeCompare(String(a?.fecha_cortesia || '')));

  const historial = cortesias
    .filter((c) => fechaClaveLocal(c?.fecha_cortesia) !== hoy)
    .filter((c) => !fechaBusquedaHistorialCortesias || fechaClaveLocal(c?.fecha_cortesia) === fechaBusquedaHistorialCortesias)
    .sort((a, b) => String(b?.fecha_cortesia || '').localeCompare(String(a?.fecha_cortesia || '')));

  const cuerpoDia = document.getElementById('cuerpoCortesiasDia');
  const cuerpoHist = document.getElementById('cuerpoCortesiasHistorial');
  if (!cuerpoDia || !cuerpoHist) return;

  cuerpoDia.innerHTML = '';
  if (!dia.length) {
    cuerpoDia.innerHTML = '<tr><td colspan="6" style="text-align:center">Sin cortesías del día</td></tr>';
  } else {
    dia.forEach((cortesia) => {
      const fila = document.createElement('tr');
      fila.innerHTML = filaCortesiaHtml(cortesia);
      cuerpoDia.appendChild(fila);
    });
  }

  cuerpoHist.innerHTML = '';
  if (!historial.length) {
    cuerpoHist.innerHTML = '<tr><td colspan="6" style="text-align:center">Sin historial para la fecha seleccionada</td></tr>';
  } else {
    let fechaActual = '';
    historial.forEach((cortesia) => {
      const clave = fechaClaveLocal(cortesia?.fecha_cortesia);
      if (clave !== fechaActual) {
        fechaActual = clave;
        const filaGrupo = document.createElement('tr');
        filaGrupo.innerHTML = `<td colspan="6" style="background:#f2f6f3;font-weight:700">${formatearFechaClave(clave)}</td>`;
        cuerpoHist.appendChild(filaGrupo);
      }
      const fila = document.createElement('tr');
      fila.innerHTML = filaCortesiaHtml(cortesia);
      cuerpoHist.appendChild(fila);
    });
  }

  renderPestanasCortesias();
}

async function cargarVentas() {
  try {
    let url = `${API}/ventas`;
    if (categoriaVentaActual !== null) url += `?categoria=${categoriaVentaActual}`;

    const respuesta = await fetch(url);
    if (!respuesta.ok) {
      if (respuesta.status === 401) {
        mostrarNotificacion('Sesión expirada. Vuelve a iniciar sesión.', 'error');
      }
      return;
    }

    const data = await respuesta.json();
    if (!Array.isArray(data)) {
      console.error('Respuesta inválida en ventas:', data);
      return;
    }

    ventasData = data;
    renderVentas();
  } catch (error) {
    console.error('Error cargando ventas:', error);
  }
}

async function cargarCortesias() {
  try {
    const respuesta = await fetch(`${API}/cortesias`);
    if (!respuesta.ok) {
      if (respuesta.status === 401) {
        mostrarNotificacion('Sesión expirada. Vuelve a iniciar sesión.', 'error');
      }
      return;
    }

    const data = await respuesta.json();
    if (!Array.isArray(data)) {
      console.error('Respuesta inválida en cortesías:', data);
      return;
    }

    cortesiasData = data;
    renderCortesias();
    actualizarTarjetaCortesiasDia();
  } catch (error) {
    console.error('Error cargando cortesías:', error);
  }
}

function filaDevolucionHtml(item) {
  const fecha = new Date(item?.fecha_devolucion || item?.fecha_venta_original || '').toLocaleString();
  return `
    <td>${item?.nombre_receta || ''}</td>
    <td>${item?.cantidad || 0}</td>
    <td>${item?.numero_pedido || ''}</td>
    <td>${item?.tipo_devolucion || ''}</td>
    <td>${item?.motivo || ''}</td>
    <td>${item?.observaciones || ''}</td>
    <td>${fecha}</td>
  `;
}

function renderDevoluciones() {
  const hoy = hoyClaveLocal();
  const devoluciones = Array.isArray(devolucionesData) ? devolucionesData : [];

  const dia = devoluciones
    .filter((d) => fechaClaveLocal(d?.fecha_devolucion) === hoy)
    .sort((a, b) => String(b?.fecha_devolucion || '').localeCompare(String(a?.fecha_devolucion || '')));

  const historial = devoluciones
    .filter((d) => fechaClaveLocal(d?.fecha_devolucion) !== hoy)
    .filter((d) => !fechaBusquedaHistorialDevoluciones || fechaClaveLocal(d?.fecha_devolucion) === fechaBusquedaHistorialDevoluciones)
    .sort((a, b) => String(b?.fecha_devolucion || '').localeCompare(String(a?.fecha_devolucion || '')));

  const cuerpoDia = document.getElementById('cuerpoDevolucionesDia');
  const cuerpoHist = document.getElementById('cuerpoDevolucionesHistorial');
  if (!cuerpoDia || !cuerpoHist) return;

  cuerpoDia.innerHTML = '';
  if (!dia.length) {
    cuerpoDia.innerHTML = '<tr><td colspan="7" style="text-align:center">Sin devoluciones del día</td></tr>';
  } else {
    dia.forEach((item) => {
      const fila = document.createElement('tr');
      fila.innerHTML = filaDevolucionHtml(item);
      cuerpoDia.appendChild(fila);
    });
  }

  cuerpoHist.innerHTML = '';
  if (!historial.length) {
    cuerpoHist.innerHTML = '<tr><td colspan="7" style="text-align:center">Sin historial para la fecha seleccionada</td></tr>';
  } else {
    let fechaActual = '';
    historial.forEach((item) => {
      const clave = fechaClaveLocal(item?.fecha_devolucion);
      if (clave !== fechaActual) {
        fechaActual = clave;
        const filaGrupo = document.createElement('tr');
        filaGrupo.innerHTML = `<td colspan="7" style="background:#f2f6f3;font-weight:700">${formatearFechaClave(clave)}</td>`;
        cuerpoHist.appendChild(filaGrupo);
      }
      const fila = document.createElement('tr');
      fila.innerHTML = filaDevolucionHtml(item);
      cuerpoHist.appendChild(fila);
    });
  }

  renderPestanasDevoluciones();
}

async function cargarDevoluciones() {
  try {
    const respuesta = await fetchAPI('/devoluciones');
    if (!respuesta.ok) {
      devolucionesData = [];
      renderDevoluciones();
      return;
    }

    const contentType = String(respuesta.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      devolucionesData = [];
      renderDevoluciones();
      return;
    }

    const data = await respuesta.json();
    devolucionesData = Array.isArray(data) ? data : [];
    renderDevoluciones();
  } catch (error) {
    devolucionesData = [];
    renderDevoluciones();
  }
}

async function eliminarVenta(id) {
  const venta = (Array.isArray(ventasData) ? ventasData : []).find((v) => Number(v?.id || 0) === Number(id || 0));
  if (!venta) {
    mostrarNotificacion('Venta no encontrada', 'error');
    return;
  }
  ventaPendienteAccion = venta;
  const accion = document.getElementById('accionEliminarVenta');
  const motivoDev = document.getElementById('motivoDevolucionVenta');
  const motivo = document.getElementById('motivoOperacionVenta');
  const observaciones = document.getElementById('observacionesOperacionVenta');
  if (accion) accion.value = 'devolucion';
  if (motivoDev) motivoDev.value = 'Producto dañado';
  if (motivo) motivo.value = '';
  if (observaciones) observaciones.value = '';
  actualizarModalEliminarVenta();
  abrirModal('modalAccionEliminarVenta');
}

function actualizarModalEliminarVenta() {
  const accion = String(document.getElementById('accionEliminarVenta')?.value || 'devolucion');
  const bloque = document.getElementById('bloqueMotivosDevolucion');
  if (bloque) bloque.style.display = accion === 'devolucion' ? '' : 'none';
}

function cerrarModalEliminarVenta() {
  ventaPendienteAccion = null;
  cerrarModal('modalAccionEliminarVenta');
}

async function confirmarAccionEliminarVenta() {
  if (!ventaPendienteAccion?.id) return;
  const accion = String(document.getElementById('accionEliminarVenta')?.value || 'devolucion');
  const motivoDev = String(document.getElementById('motivoDevolucionVenta')?.value || '').trim();
  const motivo = String(document.getElementById('motivoOperacionVenta')?.value || '').trim();
  const observaciones = String(document.getElementById('observacionesOperacionVenta')?.value || '').trim();

  if (!motivo) {
    mostrarNotificacion('Escribe el motivo de la operación', 'error');
    return;
  }

  try {
    if (accion === 'regresar_produccion') {
      await fetchAPIJSON(`/ventas/${Number(ventaPendienteAccion.id)}/regresar-produccion`, {
        method: 'POST',
        body: { motivo, observaciones }
      });
      mostrarNotificacion('Venta regresada a producción', 'exito');
    } else {
      await fetchAPIJSON(`/ventas/${Number(ventaPendienteAccion.id)}/devolucion`, {
        method: 'POST',
        body: {
          motivo,
          tipo_devolucion: motivoDev || 'merma',
          observaciones
        }
      });
      mostrarNotificacion('Venta marcada como devolución', 'exito');
    }

    cerrarModalEliminarVenta();
    cargarVentas();
    cargarDevoluciones();
    cargarEstadisticasVentas(periodoVentaActual);
  } catch (error) {
    console.error('Error aplicando acción de venta:', error);
    mostrarNotificacion(error?.message || 'Error al aplicar la acción', 'error');
  }
}

async function cargarEstadisticasVentas(periodo) {
  periodoVentaActual = periodo;
  try {
    let url = `${API}/ventas/estadisticas/${periodo}`;
    if (categoriaVentaActual !== null) url += `?categoria=${categoriaVentaActual}`;

    const respuesta = await fetch(url);
    if (!respuesta.ok) return;
    const estadisticas = await respuesta.json();

    const el = (id) => document.getElementById(id);
    if (el('totalVentas')) el('totalVentas').textContent = estadisticas.total_sales || 0;
    if (el('unidadesVendidas')) el('unidadesVendidas').textContent = estadisticas.total_units || 0;
    if (el('ingresosTotal')) el('ingresosTotal').textContent = `$${(estadisticas.total_revenue || 0).toFixed(2)}`;
    if (el('gananciaTotal')) el('gananciaTotal').textContent = `$${(estadisticas.total_profit || 0).toFixed(2)}`;
    if (el('costosTotal')) el('costosTotal').textContent = `$${(estadisticas.total_cost || 0).toFixed(2)}`;
  } catch (error) {
    console.error('Error cargando estadísticas:', error);
  }
}

function filtrarVentas(termBusqueda) {
  terminoBusquedaVentas = String(termBusqueda || '');
  renderVentas();
}
