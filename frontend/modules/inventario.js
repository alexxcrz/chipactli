// Módulo de Inventario

import { fetchAPI, fetchAPIJSON } from '../utils/api.js';
import { mostrarNotificacion, agregarAlerta, removerAlertaPorClave, alertasPorClave } from '../utils/notificaciones.js';
import { abrirModal, cerrarModal, mostrarConfirmacion } from '../utils/modales.js';
import { API } from '../config.js';

export async function cargarInventario() {
  try {
    const respuesta = await fetch(`${API}/inventario`);
    const insumos = await respuesta.json();
    
    const cuerpo = document.getElementById('cuerpoInventario');
    
    if (insumos.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="9" style="text-align:center">No hay insumos</td></tr>';
      return;
    }
    
    const fragment = document.createDocumentFragment();
    const bajos = new Set();
    
    insumos.forEach(insumo => {
      const porcentaje = insumo.cantidad_total > 0
        ? Math.min(100, Math.max(0, (insumo.cantidad_disponible / insumo.cantidad_total) * 100))
        : 0;
      const clasePorcentaje = porcentaje <= 25 ? 'porcentajeBajo' : porcentaje <= 50 ? 'porcentajeMedio' : 'porcentajeAlto';
      if (porcentaje <= 25) {
        bajos.add(insumo.id);
        agregarAlerta(
          `stock:${insumo.id}`,
          `Stock bajo: ${insumo.nombre} (${porcentaje.toFixed(0)}%)`,
          'advertencia'
        );
      }
      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td>${insumo.codigo}</td>
        <td>${insumo.nombre}</td>
        <td>${insumo.unidad}</td>
        <td>${insumo.cantidad_total.toFixed(2)}</td>
        <td>${insumo.cantidad_disponible.toFixed(2)}</td>
        <td>$${insumo.costo_total.toFixed(2)}</td>
        <td>$${insumo.costo_por_unidad.toFixed(2)}</td>
        <td>
          <div class="barraPorcentaje">
            <div class="barraPorcentajeRelleno ${clasePorcentaje}" style="width:${porcentaje.toFixed(0)}%"></div>
            <span class="textoPorcentaje">${porcentaje.toFixed(0)}%</span>
          </div>
        </td>
        <td>
          <button onclick="window.inventario.aumentarCantidadInsumo(${insumo.id}, '${insumo.nombre.replace(/'/g, "\\'")}')" class="botonPequeno" title="Aumentar cantidad">➕</button>
          <button onclick="window.inventario.editarInsumo(${insumo.id})" class="botonPequeno">✏️</button>
          <button onclick="window.inventario.mostrarHistorialInsumo(${insumo.id}, '${insumo.nombre.replace(/'/g, "\\'")}')" class="botonPequeno">📜</button>
          <button onclick="window.inventario.eliminarInsumo(${insumo.id})" class="botonPequeno botonDanger">🗑️</button>
        </td>
      `;
      fragment.appendChild(fila);
    });

    cuerpo.innerHTML = '';
    cuerpo.appendChild(fragment);

    Array.from(alertasPorClave.keys())
      .filter(clave => clave.startsWith('stock:'))
      .forEach(clave => {
        const id = parseInt(clave.split(':')[1], 10);
        if (!bajos.has(id)) removerAlertaPorClave(clave);
      });
  } catch (error) {
    console.error('Error cargando inventario:', error);
  }
}

export async function cargarEstadisticasInventario() {
  try {
    const respuesta = await fetch(`${API}/inventario/estadisticas`);
    const estadisticas = await respuesta.json();
    
    document.getElementById('totalInsumos').textContent = estadisticas.total_insumos || 0;
    document.getElementById('inversionTotal').textContent = `$${(estadisticas.inversion_total || 0).toFixed(2)}`;
    document.getElementById('inversionRecuperada').textContent = `$${(estadisticas.inversion_recuperada || 0).toFixed(2)}`;
    document.getElementById('inversionNeta').textContent = `$${(estadisticas.inversion_neta || 0).toFixed(2)}`;
  } catch (error) {
    console.error('Error cargando estadísticas:', error);
  }
}

export async function agregarInsumo(event) {
  if (event) {
    event.preventDefault();
  }
  const codigo = document.getElementById('codigoInsumo').value;
  const nombre = document.getElementById('nombreInsumo').value;
  const unidad = document.getElementById('unidadInsumo').value;
  const cantidad = parseFloat(document.getElementById('cantidadInsumo').value);
  const costo = parseFloat(document.getElementById('costoInsumo').value);
  
  if (!codigo || !nombre || !unidad || isNaN(cantidad) || isNaN(costo)) {
    mostrarNotificacion('Por favor completa todos los campos', 'error');
    return;
  }
  
  try {
    const respuesta = await fetch(`${API}/inventario/agregar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, nombre, unidad, cantidad, costo })
    });
    
    if (respuesta.ok) {
      document.getElementById('formularioInsumo').reset();
      cerrarModal('modalInsumo');
      mostrarNotificacion('Insumo agregado correctamente', 'exito');
      await Promise.all([cargarInventario(), cargarEstadisticasInventario()]);
    } else {
      const error = await respuesta.json();
      mostrarNotificacion('Error: ' + error.error, 'error');
    }
  } catch (error) {
    console.error('Error agregando insumo:', error);
  }
}

export async function editarInsumo(id) {
  try {
    const respuesta = await fetch(`${API}/inventario/${id}`);
    const insumo = await respuesta.json();
    
    document.getElementById('editCodigoInsumo').value = insumo.codigo;
    document.getElementById('editNombreInsumo').value = insumo.nombre;
    document.getElementById('editUnidadInsumo').value = insumo.unidad;
    document.getElementById('editCantidadInsumo').value = insumo.cantidad_total;
    document.getElementById('editCostoInsumo').value = insumo.costo_total;
    document.getElementById('idEditInsumo').value = insumo.id;
    
    abrirModal('modalEditarInsumo');
  } catch (error) {
    console.error('Error cargando insumo:', error);
    mostrarNotificacion('Error al cargar el insumo', 'error');
  }
}

export async function guardarEditarInsumo(event) {
  if (event) event.preventDefault();
  
  const id = document.getElementById('idEditInsumo').value;
  const nombre = document.getElementById('editNombreInsumo').value;
  const unidad = document.getElementById('editUnidadInsumo').value;
  const cantidad_total = parseFloat(document.getElementById('editCantidadInsumo').value);
  const costo_total = parseFloat(document.getElementById('editCostoInsumo').value);
  
  if (!nombre || !unidad || isNaN(cantidad_total) || isNaN(costo_total)) {
    mostrarNotificacion('Por favor completa todos los campos', 'error');
    return;
  }
  
  try {
    const respuesta = await fetch(`${API}/inventario/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, unidad, cantidad_total, costo_total })
    });
    
    if (respuesta.ok) {
      cerrarModal('modalEditarInsumo');
      cargarInventario();
      cargarEstadisticasInventario();
      mostrarNotificacion('Insumo actualizado correctamente', 'exito');
    }
  } catch (error) {
    console.error('Error actualizando insumo:', error);
    mostrarNotificacion('Error al actualizar el insumo', 'error');
  }
}

export async function eliminarInsumo(id) {
  const ok = await mostrarConfirmacion('¿Eliminar este insumo?', 'Eliminar insumo');
  if (!ok) return;
  
  try {
    const respuesta = await fetch(`${API}/inventario/${id}`, {
      method: 'DELETE'
    });
    
    if (respuesta.ok) {
      cargarInventario();
      cargarEstadisticasInventario();
    }
  } catch (error) {
    console.error('Error eliminando insumo:', error);
  }
}

export async function mostrarHistorialInsumo(id, nombre) {
  try {
    const respuesta = await fetch(`${API}/inventario/${id}/historial`);
    const historial = await respuesta.json();
    const cuerpo = document.getElementById('cuerpoHistorialInsumo');
    const titulo = document.getElementById('tituloHistorialInsumo');

    titulo.textContent = `Historial de: ${nombre}`;
    cuerpo.innerHTML = '';

    if (!historial.length) {
      cuerpo.innerHTML = '<tr><td colspan="3" style="text-align:center">Sin movimientos</td></tr>';
    } else {
      historial.forEach(item => {
        const fecha = new Date(item.fecha_cambio).toLocaleString();
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${fecha}</td>
          <td>${item.cambio_cantidad.toFixed(2)}</td>
          <td>$${item.cambio_costo.toFixed(2)}</td>
        `;
        cuerpo.appendChild(fila);
      });
    }

    abrirModal('modalHistorialInsumo');
  } catch (error) {
    console.error('Error cargando historial de insumo:', error);
  }
}

export function aumentarCantidadInsumo(id, nombre) {
  document.getElementById('aumentarInsumoId').value = id;
  document.getElementById('aumentarInsumoNombre').value = nombre;
  document.getElementById('aumentarCantidad').value = '';
  document.getElementById('aumentarCosto').value = '';
  abrirModal('modalAumentarInsumo');
}

export async function guardarAumentarInsumo(event) {
  event.preventDefault();
  const id = parseInt(document.getElementById('aumentarInsumoId').value);
  const cantidad = parseFloat(document.getElementById('aumentarCantidad').value);
  const costo = parseFloat(document.getElementById('aumentarCosto').value);

  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    mostrarNotificacion('❌ Cantidad debe ser mayor a 0', 'error');
    return;
  }

  if (!Number.isFinite(costo) || costo < 0) {
    mostrarNotificacion('❌ Costo debe ser un número válido', 'error');
    return;
  }

  try {
    const respuesta = await fetch(`${API}/inventario/aumentar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, cantidad, costo })
    });

    if (respuesta.ok) {
      cerrarModal('modalAumentarInsumo');
      mostrarNotificacion('✅ Cantidad aumentada exitosamente', 'exito');
      cargarInventario();
      cargarEstadisticasInventario();
    } else {
      mostrarNotificacion('❌ Error al aumentar cantidad', 'error');
    }
  } catch (error) {
    console.error('Error aumentando cantidad:', error);
    mostrarNotificacion('❌ Error de conexión', 'error');
  }
}

export function filtrarInventario(termBusqueda) {
  const filas = document.querySelectorAll('#cuerpoInventario tr');
  const termino = termBusqueda.toLowerCase();
  
  filas.forEach(fila => {
    if (fila.cells.length < 2) return;
    const codigo = fila.cells[0]?.textContent.toLowerCase() || '';
    const nombre = fila.cells[1]?.textContent.toLowerCase() || '';
    
    if (codigo.includes(termino) || nombre.includes(termino)) {
      fila.style.display = '';
    } else {
      fila.style.display = 'none';
    }
  });
}
