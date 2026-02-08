// Módulo de Ventas

import { mostrarNotificacion } from '../utils/notificaciones.js';
import { abrirModal, mostrarConfirmacion } from '../utils/modales.js';
import { API } from '../config.js';

export let categoriaVentaActual = null;
export let periodoVentaActual = 'mes';

export async function cargarVentas() {
  try {
    let url = `${API}/ventas`;
    if (categoriaVentaActual !== null) {
      url += `?categoria=${categoriaVentaActual}`;
    }
    
    const respuesta = await fetch(url);
    const ventas = await respuesta.json();
    
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
        <td>$${venta.costo_produccion.toFixed(2)}</td>
        <td>$${(venta.precio_venta * venta.cantidad).toFixed(2)}</td>
        <td>$${venta.ganancia.toFixed(2)}</td>
        <td><button onclick="window.ventas.eliminarVenta(${venta.id})" class="botonPequeno botonDanger">🗑️</button></td>
      `;
      cuerpo.appendChild(fila);
    });
  } catch (error) {
    console.error('Error cargando ventas:', error);
  }
}

export async function cargarCortesias() {
  try {
    const respuesta = await fetch(`${API}/cortesias`);
    const cortesias = await respuesta.json();
    
    const cuerpo = document.getElementById('cuerpoCortesias');
    if (!cuerpo) return;
    
    cuerpo.innerHTML = '';
    
    if (cortesias.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="3" style="text-align:center">No hay cortesías registradas</td></tr>';
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

export async function eliminarVenta(id) {
  const motivo = prompt('¿Cuál es el motivo de la eliminación?');
  if (!motivo || motivo.trim() === '') {
    mostrarNotificacion('❌ Debes indicar un motivo', 'error');
    return;
  }

  try {
    const respuesta = await fetch(`${API}/ventas/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo })
    });

    if (respuesta.ok) {
      mostrarNotificacion('✅ Venta eliminada exitosamente', 'exito');
      cargarVentas();
      cargarEstadisticasVentas('mes');
    } else {
      mostrarNotificacion('❌ Error al eliminar venta', 'error');
    }
  } catch (error) {
    console.error('Error eliminando venta:', error);
    mostrarNotificacion('❌ Error de conexión', 'error');
  }
}

export async function cargarEstadisticasVentas(periodo) {
  periodoVentaActual = periodo;
  try {
    let url = `${API}/ventas/estadisticas/${periodo}`;
    if (categoriaVentaActual !== null) {
      url += `?categoria=${categoriaVentaActual}`;
    }
    
    const respuesta = await fetch(url);
    if (!respuesta.ok) return;
    const estadisticas = await respuesta.json();
    
    const el = (id) => document.getElementById(id);
    if (el('totalVentas')) el('totalVentas').textContent = estadisticas.total_sales || 0;
    if (el('unidadesVendidas')) el('unidadesVendidas').textContent = estadisticas.total_units || 0;
    if (el('inversionTotal')) el('inversionTotal').textContent = `$${(estadisticas.total_cost || 0).toFixed(2)}`;
    if (el('ingresosTotal')) el('ingresosTotal').textContent = `$${(estadisticas.total_revenue || 0).toFixed(2)}`;
    if (el('gananciaTotal')) el('gananciaTotal').textContent = `$${(estadisticas.total_profit || 0).toFixed(2)}`;
    if (el('costosTotal')) el('costosTotal').textContent = `$${(estadisticas.total_cost || 0).toFixed(2)}`;
  } catch (error) {
    console.error('Error cargando estadísticas:', error);
  }
}

export function filtrarVentas(termBusqueda) {
  const filas = document.querySelectorAll('#cuerpoVentas tr');
  const termino = termBusqueda.toLowerCase();
  
  filas.forEach(fila => {
    if (fila.cells.length < 2) return;
    const nombre = fila.cells[0]?.textContent.toLowerCase() || '';
    if (nombre.includes(termino)) {
      fila.style.display = '';
    } else {
      fila.style.display = 'none';
    }
  });
}

export async function mostrarHistorialInversion() {
  try {
    const respuesta = await fetch(`${API}/inventario/historial/agrupar/fechas`);
    const historialPorFecha = await respuesta.json();
    
    const modal = document.getElementById('modalHistorialInv');
    if(!modal) return;
    const listaDiv = modal.querySelector('#listaHistorialPorFecha');
    
    if (!historialPorFecha || historialPorFecha.length === 0) {
      listaDiv.innerHTML = '<p style="text-align:center;color:#999">No hay registros de inversión</p>';
      abrirModal('modalHistorialInv');
      return;
    }
    
    let html = '';
    
    historialPorFecha.forEach(dia => {
      const fechaObj = new Date(dia.fecha);
      const fechaFormato = fechaObj.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      html += `
        <div style="border:2px solid #ddd;border-radius:8px;margin-bottom:15px;overflow:hidden">
          <div onclick="window.ventas.toggleHistorialFecha('${dia.fecha}')" 
               style="background:#f5f5f5;padding:15px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none">
            <div style="flex:1">
              <h4 style="margin:0;color:#333;font-size:16px;text-transform:capitalize">${fechaFormato}</h4>
              <p style="margin:5px 0 0 0;font-size:12px;color:#666">${dia.total_insumos} insumo(s) agregado(s) · Total: $${dia.total_costo.toFixed(2)}</p>
            </div>
            <div style="display:flex;gap:10px;align-items:center">
              <button onclick="event.stopPropagation();window.ventas.eliminarHistorialFecha('${dia.fecha}')" 
                      style="background:#f44336;color:white;border:none;padding:8px 12px;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600"
                      onmouseover="this.style.background='#d32f2f'" 
                      onmouseout="this.style.background='#f44336'">🗑️ Eliminar</button>
              <button id="boton-${dia.fecha}" style="background:none;border:none;font-size:18px;cursor:pointer;padding:0 10px">▶</button>
            </div>
          </div>
          
          <div id="detalles-${dia.fecha}" style="display:none;padding:0">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f0f0f0">
                  <th style="padding:12px;text-align:left;border-bottom:1px solid #ddd;font-weight:600;font-size:13px">Hora</th>
                  <th style="padding:12px;text-align:left;border-bottom:1px solid #ddd;font-weight:600;font-size:13px">Código</th>
                  <th style="padding:12px;text-align:left;border-bottom:1px solid #ddd;font-weight:600;font-size:13px">Insumo</th>
                  <th style="padding:12px;text-align:center;border-bottom:1px solid #ddd;font-weight:600;font-size:13px">Cantidad</th>
                  <th style="padding:12px;text-align:right;border-bottom:1px solid #ddd;font-weight:600;font-size:13px">Costo</th>
                </tr>
              </thead>
              <tbody>
      `;
      
      dia.insumos.forEach(insumo => {
        html += `
                <tr style="border-bottom:1px solid #eee">
                  <td style="padding:12px;font-size:12px;color:#666">${insumo.hora}</td>
                  <td style="padding:12px;font-size:12px;color:#1a1a1a;font-weight:600">${insumo.codigo}</td>
                  <td style="padding:12px;font-size:13px;color:#333">${insumo.nombre}</td>
                  <td style="padding:12px;text-align:center;color:#666">${insumo.cambio_cantidad} ${insumo.unidad}</td>
                  <td style="padding:12px;text-align:right;color:#4a9b5e;font-weight:600">$${insumo.cambio_costo.toFixed(2)}</td>
                </tr>
        `;
      });
      
      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    });
    
    listaDiv.innerHTML = html;
    abrirModal('modalHistorialInv');
  } catch (error) {
    console.error('Error cargando historial de inversión:', error);
    mostrarNotificacion('Error', 'No se pudo cargar el historial de inversiones', 'error');
  }
}

export async function eliminarHistorialFecha(fecha) {
  const fechaFormato = new Date(fecha).toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const confirmar = await mostrarConfirmacion(
    `Se eliminará todo el historial de inversión del ${fechaFormato}. Esta acción ajustará las cantidades y costos en el inventario.`,
    '¿Eliminar historial de este día?'
  );

  if (!confirmar) return;

  try {
    const respuesta = await fetch(`${API}/inventario/historial/fecha/${fecha}`, { method: 'DELETE' });
    if (!respuesta.ok) {
      mostrarNotificacion('❌ Error al eliminar historial', 'error');
      return;
    }

    mostrarNotificacion('✅ Historial eliminado exitosamente', 'exito');
    await mostrarHistorialInversion();
    if (window.inventario?.cargarInventario) window.inventario.cargarInventario();
    if (window.inventario?.cargarEstadisticasInventario) window.inventario.cargarEstadisticasInventario();
  } catch (error) {
    console.error('Error eliminando historial:', error);
    mostrarNotificacion('❌ Error de conexión', 'error');
  }
}

export function toggleHistorialFecha(fecha) {
  const detalles = document.getElementById(`detalles-${fecha}`);
  const boton = document.getElementById(`boton-${fecha}`);
  
  if (detalles.style.display === 'none' || detalles.style.display === '') {
    detalles.style.display = 'block';
    boton.textContent = '▼';
  } else {
    detalles.style.display = 'none';
    boton.textContent = '▶';
  }
}
