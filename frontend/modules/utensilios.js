// Modulo de Utensilios

import { mostrarNotificacion } from '../utils/notificaciones.js';
import { abrirModal, mostrarConfirmacion } from '../utils/modales.js';
import { API } from '../config.js';

export async function cargarUtensilios() {
  try {
    const respuesta = await fetch(`${API}/utensilios`);
    const utensilios = await respuesta.json();

    const cuerpo = document.getElementById('cuerpoUtensilios');
    if (!cuerpo) return;

    if (utensilios.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="7" style="text-align:center">No hay utensilios</td></tr>';
      return;
    }

    const fragment = document.createDocumentFragment();

    utensilios.forEach(utensilio => {
      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td>${utensilio.codigo}</td>
        <td>${utensilio.nombre}</td>
        <td>${utensilio.unidad}</td>
        <td>${Number(utensilio.cantidad_total || 0).toFixed(2)}</td>
        <td>$${Number(utensilio.costo_total || 0).toFixed(2)}</td>
        <td>$${Number(utensilio.costo_por_unidad || 0).toFixed(2)}</td>
        <td>
          <button onclick="window.utensilios.editarUtensilio(${utensilio.id})" class="botonPequeno">✏️</button>
          <button onclick="window.utensilios.mostrarHistorialUtensilio(${utensilio.id}, '${utensilio.nombre.replace(/'/g, "\\'")}')" class="botonPequeno">📜</button>
          <button onclick="window.utensilios.eliminarUtensilio(${utensilio.id})" class="botonPequeno botonDanger">🗑️</button>
        </td>
      `;
      fragment.appendChild(fila);
    });

    cuerpo.innerHTML = '';
    cuerpo.appendChild(fragment);
  } catch (error) {
    console.error('Error cargando utensilios:', error);
  }
}

export async function cargarEstadisticasUtensilios() {
  try {
    const respuesta = await fetch(`${API}/utensilios/estadisticas`);
    const estadisticas = await respuesta.json();

    const totalEl = document.getElementById('totalUtensilios');
    const invTotal = document.getElementById('inversionTotalUtensilios');
    const invRec = document.getElementById('inversionRecuperadaUtensilios');
    const invNeta = document.getElementById('inversionNetaUtensilios');

    if (totalEl) totalEl.textContent = estadisticas.total_utensilios || 0;
    if (invTotal) invTotal.textContent = `$${(estadisticas.inversion_total || 0).toFixed(2)}`;
    if (invRec) invRec.textContent = `$${(estadisticas.inversion_recuperada || 0).toFixed(2)}`;
    if (invNeta) invNeta.textContent = `$${(estadisticas.inversion_neta || 0).toFixed(2)}`;
  } catch (error) {
    console.error('Error cargando estadisticas de utensilios:', error);
  }
}

export async function agregarUtensilio(event) {
  if (event) event.preventDefault();

  const codigo = document.getElementById('codigoUtensilio').value;
  const nombre = document.getElementById('nombreUtensilio').value;
  const unidad = document.getElementById('unidadUtensilio').value;
  const cantidad = parseFloat(document.getElementById('cantidadUtensilio').value);
  const costo = parseFloat(document.getElementById('costoUtensilio').value);

  if (!codigo || !nombre || !unidad || isNaN(cantidad) || isNaN(costo)) {
    mostrarNotificacion('Por favor completa todos los campos', 'error');
    return;
  }

  try {
    const respuesta = await fetch(`${API}/utensilios/agregar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, nombre, unidad, cantidad, costo })
    });

    if (respuesta.ok) {
      document.getElementById('formularioUtensilio').reset();
      cerrarModal('modalUtensilio');
      mostrarNotificacion('Utensilio agregado correctamente', 'exito');
      await Promise.all([cargarUtensilios(), cargarEstadisticasUtensilios()]);
    } else {
      const error = await respuesta.json();
      mostrarNotificacion('Error: ' + error.error, 'error');
    }
  } catch (error) {
    console.error('Error agregando utensilio:', error);
  }
}

export async function editarUtensilio(id) {
  try {
    const respuesta = await fetch(`${API}/utensilios/${id}`);
    const utensilio = await respuesta.json();

    document.getElementById('editCodigoUtensilio').value = utensilio.codigo;
    document.getElementById('editNombreUtensilio').value = utensilio.nombre;
    document.getElementById('editUnidadUtensilio').value = utensilio.unidad;
    document.getElementById('editCantidadUtensilio').value = utensilio.cantidad_total;
    document.getElementById('editCostoUtensilio').value = utensilio.costo_total;
    document.getElementById('idEditUtensilio').value = utensilio.id;

    abrirModal('modalEditarUtensilio');
  } catch (error) {
    console.error('Error cargando utensilio:', error);
    mostrarNotificacion('Error al cargar el utensilio', 'error');
  }
}

export async function guardarEditarUtensilio(event) {
  if (event) event.preventDefault();

  const id = document.getElementById('idEditUtensilio').value;
  const nombre = document.getElementById('editNombreUtensilio').value;
  const unidad = document.getElementById('editUnidadUtensilio').value;
  const cantidad_total = parseFloat(document.getElementById('editCantidadUtensilio').value);
  const costo_total = parseFloat(document.getElementById('editCostoUtensilio').value);

  if (!nombre || !unidad || isNaN(cantidad_total) || isNaN(costo_total)) {
    mostrarNotificacion('Por favor completa todos los campos', 'error');
    return;
  }

  try {
    const respuesta = await fetch(`${API}/utensilios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, unidad, cantidad_total, costo_total })
    });

    if (respuesta.ok) {
      cerrarModal('modalEditarUtensilio');
      cargarUtensilios();
      cargarEstadisticasUtensilios();
      mostrarNotificacion('Utensilio actualizado correctamente', 'exito');
    }
  } catch (error) {
    console.error('Error actualizando utensilio:', error);
    mostrarNotificacion('Error al actualizar el utensilio', 'error');
  }
}

export async function eliminarUtensilio(id) {
  const ok = await mostrarConfirmacion('¿Eliminar este utensilio?', 'Eliminar utensilio');
  if (!ok) return;

  try {
    const respuesta = await fetch(`${API}/utensilios/${id}`, {
      method: 'DELETE'
    });

    if (respuesta.ok) {
      cargarUtensilios();
      cargarEstadisticasUtensilios();
    }
  } catch (error) {
    console.error('Error eliminando utensilio:', error);
  }
}

export async function mostrarHistorialUtensilio(id, nombre) {
  try {
    const respuesta = await fetch(`${API}/utensilios/${id}/historial`);
    const historial = await respuesta.json();
    const cuerpo = document.getElementById('cuerpoHistorialUtensilio');
    const titulo = document.getElementById('tituloHistorialUtensilio');

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
          <td>${Number(item.cambio_cantidad || 0).toFixed(2)}</td>
          <td>$${Number(item.cambio_costo || 0).toFixed(2)}</td>
        `;
        cuerpo.appendChild(fila);
      });
    }

    abrirModal('modalHistorialUtensilio');
  } catch (error) {
    console.error('Error cargando historial de utensilio:', error);
  }
}

export function filtrarUtensilios(termBusqueda) {
  const filas = document.querySelectorAll('#cuerpoUtensilios tr');
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

export async function mostrarHistorialAgregadoUtensilios() {
  try {
    const respuesta = await fetch(`${API}/utensilios/historial/agrupar/fechas`);
    const historialPorFecha = await respuesta.json();
    
    const modal = document.getElementById('modalHistorialAgregadoUtensilios');
    if(!modal) return;
    const listaDiv = modal.querySelector('#listaHistorialAgregadoUtensilios');
    
    if (!historialPorFecha || historialPorFecha.length === 0) {
      listaDiv.innerHTML = '<p style="text-align:center;color:#999">No hay registros de inversión en utensilios</p>';
      abrirModal('modalHistorialAgregadoUtensilios');
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
          <div onclick="window.utensilios.toggleHistorialUtensilioFecha('${dia.fecha}')" 
               style="background:#f5f5f5;padding:15px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none">
            <div style="flex:1">
              <h4 style="margin:0;color:#333;font-size:16px;text-transform:capitalize">${fechaFormato}</h4>
              <p style="margin:5px 0 0 0;font-size:12px;color:#666">${dia.total_utensilios} utensilio(s) agregado(s) · Total: $${dia.total_costo.toFixed(2)}</p>
            </div>
            <button id="boton-ut-${dia.fecha}" style="background:none;border:none;font-size:18px;cursor:pointer;padding:0 10px">▶</button>
          </div>
          
          <div id="detalles-ut-${dia.fecha}" style="display:none;padding:0">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f0f0f0">
                  <th style="padding:12px;text-align:left;border-bottom:1px solid #ddd;font-weight:600;font-size:13px">Hora</th>
                  <th style="padding:12px;text-align:left;border-bottom:1px solid #ddd;font-weight:600;font-size:13px">Código</th>
                  <th style="padding:12px;text-align:left;border-bottom:1px solid #ddd;font-weight:600;font-size:13px">Utensilio</th>
                  <th style="padding:12px;text-align:center;border-bottom:1px solid #ddd;font-weight:600;font-size:13px">Cantidad</th>
                  <th style="padding:12px;text-align:right;border-bottom:1px solid #ddd;font-weight:600;font-size:13px">Costo</th>
                </tr>
              </thead>
              <tbody>
      `;
      
      dia.utensilios.forEach(utensilio => {
        html += `
                <tr style="border-bottom:1px solid #eee">
                  <td style="padding:12px;font-size:12px;color:#666">${utensilio.hora}</td>
                  <td style="padding:12px;font-size:12px;color:#1a1a1a;font-weight:600">${utensilio.codigo}</td>
                  <td style="padding:12px;font-size:13px;color:#333">${utensilio.nombre}</td>
                  <td style="padding:12px;text-align:center;color:#666">${utensilio.cambio_cantidad} ${utensilio.unidad}</td>
                  <td style="padding:12px;text-align:right;color:#4a9b5e;font-weight:600">$${utensilio.cambio_costo.toFixed(2)}</td>
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
    abrirModal('modalHistorialAgregadoUtensilios');
  } catch (error) {
    console.error('Error cargando historial agrupado de utensilios:', error);
    mostrarNotificacion('Error al cargar historial', 'No se pudo cargar el historial agrupado de utensilios', 'error');
  }
}

export function toggleHistorialUtensilioFecha(fecha) {
  const detalles = document.getElementById(`detalles-ut-${fecha}`);
  const boton = document.getElementById(`boton-ut-${fecha}`);
  
  if (detalles.style.display === 'none' || detalles.style.display === '') {
    detalles.style.display = 'block';
    boton.textContent = '▼';
  } else {
    detalles.style.display = 'none';
    boton.textContent = '▶';
  }
}
