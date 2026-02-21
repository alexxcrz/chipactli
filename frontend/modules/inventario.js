// Mostrar modal de productos pendientes
export async function mostrarPendientesInsumos() {
  try {
    const respuesta = await fetch(`${API}/inventario`);
    const insumos = await respuesta.json();
    // Filtrar insumos pendientes o con datos incompletos
    const pendientes = insumos.filter(insumo => {
      return insumo.pendiente || !insumo.codigo || !insumo.nombre || !insumo.unidad || isNaN(insumo.cantidad_total) || isNaN(insumo.costo_total) || isNaN(insumo.costo_por_unidad) || insumo.cantidad_total === 0 || insumo.costo_total === 0 || insumo.costo_por_unidad === 0;
    });
    const modal = document.getElementById('modalPendientesInsumos');
    const cuerpo = document.getElementById('cuerpoPendientesInsumos');
    cuerpo.innerHTML = '';
    if (pendientes.length === 0) {
      cuerpo.innerHTML = '<div style="padding:30px;text-align:center;color:#999">No hay productos pendientes ni incompletos</div>';
    } else {
      pendientes.forEach(insumo => {
        const div = document.createElement('div');
        div.className = 'elementoIngrediente';
        div.innerHTML = `
          <div style="flex:1">
            <b>${insumo.nombre || '(Sin nombre)'}</b><br>
            <span style="font-size:11px;color:#d32f2f">${insumo.codigo ? '' : 'Sin código'} ${insumo.unidad ? '' : 'Sin unidad'} ${(isNaN(insumo.cantidad_total) || insumo.cantidad_total === 0) ? 'Sin cantidad' : ''} ${(isNaN(insumo.costo_total) || insumo.costo_total === 0) ? 'Sin costo' : ''}</span>
          </div>
            <button class="boton botonExito" style="margin-left:10px;padding:5px 14px;font-size:12px;border-radius:12px;box-shadow:0 1px 4px #6b9e6f22;display:flex;align-items:center;gap:5px;" onmouseover="this.style.background='#5a8d5e'" onmouseout="this.style.background=''" onclick="window.inventario.editarInsumo(${insumo.id});cerrarModal('modalPendientesInsumos')">
              <span style='font-size:15px;vertical-align:middle;'>➕</span>Agregar
            </button>
        `;
        cuerpo.appendChild(div);
      });
    }
    abrirModal('modalPendientesInsumos');
  } catch (error) {
    console.error('Error al cargar productos pendientes:', error);
    const cuerpo = document.getElementById('cuerpoPendientesInsumos');
    if (cuerpo) {
      cuerpo.innerHTML = `<div style=\"padding:30px;text-align:center;color:#d32f2f\">Error al cargar productos pendientes:<br><pre style='white-space:pre-wrap;text-align:left;font-size:12px;color:#b71c1c'>${error && error.stack ? error.stack : (error && error.message ? error.message : error)}</pre></div>`;
    }
    mostrarNotificacion('Error al cargar productos pendientes', 'error');
  }
}
// Módulo de Inventario
// Asegura que el botón de productos pendientes esté presente en la cabecera de insumos
export function insertarBotonPendientesInsumos() {
  let encabezado = document.querySelector('#insumos .encabezadoTarjeta > div');
  if (!encabezado) {
    // Si no existe el div, lo creamos y lo insertamos en el centro
    const contenedor = document.querySelector('#insumos .encabezadoTarjeta');
    if (!contenedor) return;
    encabezado = document.createElement('div');
    encabezado.style.display = 'flex';
    encabezado.style.justifyContent = 'center';
    encabezado.style.width = '100%';
    contenedor.appendChild(encabezado);
  }
  if (document.getElementById('btnPendientesInsumos')) return;
  const btn = document.createElement('button');
  btn.className = 'boton botonDanger';
  btn.id = 'btnPendientesInsumos';
  btn.textContent = 'Productos pendientes';
  btn.onclick = () => window.inventario.mostrarPendientesInsumos();
  encabezado.appendChild(btn);
}
// Insertar el botón al cargar la pestaña de insumos
if (typeof window !== 'undefined') {
  window.inventario = window.inventario || {};
  window.inventario.mostrarPendientesInsumos = mostrarPendientesInsumos;
}

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
      let clasePendiente = '';
      if (insumo.pendiente) {
        clasePendiente = 'insumoPendiente';
        agregarAlerta(
          `pendiente:${insumo.id}`,
          `Insumo pendiente: ${insumo.nombre}`,
          'advertencia'
        );
      } else if (porcentaje <= 25) {
        bajos.add(insumo.id);
        agregarAlerta(
          `stock:${insumo.id}`,
          `Stock bajo: ${insumo.nombre} (${porcentaje.toFixed(0)}%)`,
          'advertencia'
        );
      }
      // Normalizar unidad y abreviatura
      let unidadMostrar = insumo.unidad;
      if (unidadMostrar) {
        const u = unidadMostrar.toLowerCase();
        if (u === 'gotas') unidadMostrar = 'go';
      }
      // Normalizar nombre para mostrar en plural si es gota
      let nombreMostrar = insumo.nombre;
      if (insumo.unidad && insumo.unidad.toLowerCase() === 'gotas') {
        if (!/gotas/i.test(nombreMostrar)) {
          nombreMostrar = nombreMostrar.replace(/gota$/i, 'gotas');
        }
      }
      const fila = document.createElement('tr');
      if (clasePendiente) fila.classList.add(clasePendiente);
      fila.innerHTML = `
        <td>${insumo.codigo}</td>
        <td>${nombreMostrar}</td>
        <td>${unidadMostrar}</td>
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
          <button onclick="window.inventario.aumentarCantidadInsumo(${insumo.id}, '${insumo.nombre.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\"/g, '\\"')}')" class="botonPequeno" title="Aumentar cantidad">➕</button>
          <button onclick="window.inventario.editarInsumo(${insumo.id})" class="botonPequeno">✏️</button>
          <button onclick="window.inventario.mostrarHistorialInsumo(${insumo.id}, '${insumo.nombre.replace(/'/g, "\\'")})" class="botonPequeno">📜</button>
          <button onclick="window.inventario.eliminarInsumo(${insumo.id})" class="botonPequeno botonDanger">🗑️</button>
        </td>
      `;
      fragment.appendChild(fila);
    });
// CSS para resaltar insumos pendientes en rojo
if (!document.getElementById('cssInsumoPendiente')) {
  const style = document.createElement('style');
  style.id = 'cssInsumoPendiente';
  style.innerHTML = `.insumoPendiente td { color: #d32f2f !important; font-weight: bold; }`;
  document.head.appendChild(style);
}

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

    // Permitir editar el código solo si es pendiente
    const codigoInput = document.getElementById('editCodigoInsumo');
    if (insumo.pendiente) {
      codigoInput.removeAttribute('readonly');
      codigoInput.classList.add('campoEditablePendiente');
    } else {
      codigoInput.setAttribute('readonly', 'readonly');
      codigoInput.classList.remove('campoEditablePendiente');
    }

    abrirModal('modalEditarInsumo');
  } catch (error) {
    console.error('Error cargando insumo:', error);
    mostrarNotificacion('Error al cargar el insumo', 'error');
  }
// CSS para resaltar campo editable de código en insumos pendientes
if (!document.getElementById('cssCodigoEditablePendiente')) {
  const style = document.createElement('style');
  style.id = 'cssCodigoEditablePendiente';
  style.innerHTML = `.campoEditablePendiente { border: 2px dashed #d32f2f !important; background: #fff8f8 !important; }`;
  document.head.appendChild(style);
}
}

export async function guardarEditarInsumo(event) {
  if (event) event.preventDefault();
  
  const id = document.getElementById('idEditInsumo').value;
  const nombre = document.getElementById('editNombreInsumo').value;
  const unidad = document.getElementById('editUnidadInsumo').value;
  const cantidad_total = parseFloat(document.getElementById('editCantidadInsumo').value);
  const costo_total = parseFloat(document.getElementById('editCostoInsumo').value);
  const codigo = document.getElementById('editCodigoInsumo').value;

  if (!nombre || !unidad || isNaN(cantidad_total) || isNaN(costo_total)) {
    mostrarNotificacion('Por favor completa todos los campos', 'error');
    return;
  }

  try {
    const respuesta = await fetch(`${API}/inventario/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, unidad, cantidad_total, costo_total, codigo })
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
