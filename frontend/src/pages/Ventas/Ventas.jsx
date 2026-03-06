import React, { useEffect } from 'react';
import './Ventas.css';
import { mostrarNotificacion } from '../../utils/notificaciones.jsx';
import { mostrarConfirmacion } from '../../utils/modales.jsx';
import { API } from '../../utils/config.jsx';
import { importarDatos, exportarDatos } from '../../utils/importar-exportar.jsx';
import { normalizarTextoBusqueda } from '../../utils/texto.jsx';
import { fetchAPIJSON } from '../../utils/api.jsx';

export default function Ventas() {
  useEffect(() => {
    window.ventas = {
      cargarVentas,
      cargarCortesias,
      eliminarVenta,
      cargarEstadisticasVentas,
      filtrarVentas
    };

    cargarVentas();
    cargarCortesias();
    cargarEstadisticasVentas('mes');

    const onVentas = () => {
      cargarVentas();
      cargarEstadisticasVentas(periodoVentaActual);
    };
    const onCortesias = () => cargarCortesias();

    window.addEventListener('ventasActualizadas', onVentas);
    window.addEventListener('cortesiasActualizadas', onCortesias);

    return () => {
      window.removeEventListener('ventasActualizadas', onVentas);
      window.removeEventListener('cortesiasActualizadas', onCortesias);
    };
  }, []);

  return (
    <div>
      <div className="tarjeta">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <h2>Análisis de Ventas</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="botonesImportarExportar">
              <button className="botonImportar" onClick={() => document.getElementById('importarVentas')?.click()}>📥 Importar</button>
              <input type="file" id="importarVentas" className="inputArchivoOculto" accept=".json" onChange={e => importarDatos('ventas', e.target)} />
              <button className="botonExportar" onClick={() => exportarDatos('ventas')}>📤 Exportar</button>
            </div>
            <div className="selectorPeriodo">
              <button className="boton" onClick={() => cargarEstadisticasVentas('dia')}>Hoy</button>
              <button className="boton" onClick={() => cargarEstadisticasVentas('semana')}>Esta Semana</button>
              <button className="boton" onClick={() => cargarEstadisticasVentas('quincena')}>Quincena</button>
              <button className="boton" onClick={() => cargarEstadisticasVentas('mes')}>Este Mes</button>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <input type="text" className="cajaBusqueda" placeholder="🔍 Buscar venta..." onChange={e => filtrarVentas(e.target.value)} style={{ width: '240px' }} />
        </div>
        <div className="gridEstadisticas">
          <div className="tarjetaEstadistica"><h3 id="ingresosTotal">$0</h3><p>Ingresos</p></div>
          <div className="tarjetaEstadistica"><h3 id="costosTotal">$0</h3><p>Costos</p></div>
          <div className="tarjetaEstadistica"><h3 id="gananciaTotal">$0</h3><p>Ganancia</p></div>
          <div className="tarjetaEstadistica"><h3 id="unidadesVendidas">0</h3><p>Unidades Vendidas</p></div>
        </div>
      </div>

      <div className="tarjeta">
        <h2>Historial de Ventas</h2>
        <table>
          <thead>
            <tr>
              <th>Receta</th><th>Categoría</th><th>Cantidad</th><th>Pedido</th><th>Fecha Producción</th><th>Fecha Venta</th><th>Costo</th><th>Venta</th><th>Ganancia</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody id="cuerpoVentas"></tbody>
        </table>
      </div>

      <div className="tarjeta">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <h2>Historial de Cortesías</h2>
          <div className="botonesImportarExportar">
            <button className="botonImportar" onClick={() => document.getElementById('importarCortesias')?.click()}>📥 Importar cortesías</button>
            <input type="file" id="importarCortesias" className="inputArchivoOculto" accept=".json" onChange={e => importarDatos('cortesias', e.target)} />
            <button className="botonExportar" onClick={() => exportarDatos('cortesias')}>📤 Exportar cortesías</button>
          </div>
        </div>
        <table>
          <thead>
            <tr><th>Receta</th><th>Cantidad</th><th>Pedido</th><th>Motivo</th><th>Para quién</th><th>Fecha y hora</th></tr>
          </thead>
          <tbody id="cuerpoCortesias"></tbody>
        </table>
      </div>
    </div>
  );
}

let categoriaVentaActual = null;
let periodoVentaActual = 'mes';

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
    const ventas = await respuesta.json();
    if (!Array.isArray(ventas)) {
      console.error('Respuesta inválida en ventas:', ventas);
      return;
    }

    const cuerpo = document.getElementById('cuerpoVentas');
    if (!cuerpo) return;

    cuerpo.innerHTML = '';
    if (ventas.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="10" style="text-align:center">No hay ventas</td></tr>';
      return;
    }

    ventas.forEach(venta => {
      const fila = document.createElement('tr');
      const fechaProduccion = new Date(venta.fecha_produccion).toLocaleString();
      const fechaVenta = new Date(venta.fecha_venta).toLocaleString();
      fila.innerHTML = `
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
      cuerpo.appendChild(fila);
    });
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
    const cortesias = await respuesta.json();
    if (!Array.isArray(cortesias)) {
      console.error('Respuesta inválida en cortesías:', cortesias);
      return;
    }

    const cuerpo = document.getElementById('cuerpoCortesias');
    if (!cuerpo) return;

    cuerpo.innerHTML = '';
    if (cortesias.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="6" style="text-align:center">No hay cortesías registradas</td></tr>';
      return;
    }

    cortesias.forEach(cortesia => {
      const fila = document.createElement('tr');
      const fechaCortesia = new Date(cortesia.fecha_cortesia).toLocaleString();
      fila.innerHTML = `
        <td>${cortesia.nombre_receta}</td>
        <td>${cortesia.cantidad}</td>
        <td>${cortesia.numero_pedido || ''}</td>
        <td>${cortesia.motivo || ''}</td>
        <td>${cortesia.para_quien || ''}</td>
        <td>${fechaCortesia}</td>
      `;
      cuerpo.appendChild(fila);
    });
  } catch (error) {
    console.error('Error cargando cortesías:', error);
  }
}

async function eliminarVenta(id) {
  const ok = await mostrarConfirmacion('¿Confirmas eliminar esta venta? Esta acción no se puede deshacer.', 'Eliminar venta');
  if (!ok) return;

  try {
    await fetchAPIJSON(`${API}/ventas/${id}`, {
      method: 'DELETE',
      body: {}
    });

    mostrarNotificacion('Venta eliminada exitosamente', 'exito');
    cargarVentas();
    cargarEstadisticasVentas(periodoVentaActual);
  } catch (error) {
    console.error('Error eliminando venta:', error);
    mostrarNotificacion(error?.message || 'Error al eliminar venta', 'error');
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

    const el = id => document.getElementById(id);
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
  const filas = document.querySelectorAll('#cuerpoVentas tr');
  const termino = normalizarTextoBusqueda(termBusqueda);

  filas.forEach(fila => {
    if (fila.cells.length < 2) return;
    const nombre = normalizarTextoBusqueda(fila.cells[0]?.textContent || '');
    fila.style.display = nombre.includes(termino) ? '' : 'none';
  });
}
