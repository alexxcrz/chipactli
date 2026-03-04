import React, { useEffect } from 'react';
import './Utensilios.css';
import { mostrarNotificacion } from '../../utils/notificaciones.jsx';
import { abrirModal, cerrarModal, mostrarConfirmacion } from '../../utils/modales.jsx';
import { API } from '../../utils/config.jsx';
import { importarDatos, exportarDatos } from '../../utils/importar-exportar.jsx';
import { normalizarTextoBusqueda } from '../../utils/texto.jsx';

export default function Utensilios() {
  useEffect(() => {
    window.utensilios = {
      cargarUtensilios,
      cargarEstadisticasUtensilios,
      agregarUtensilio,
      editarUtensilio,
      guardarEditarUtensilio,
      eliminarUtensilio,
      mostrarHistorialUtensilio,
      filtrarUtensilios,
      mostrarHistorialAgregadoUtensilios,
      toggleHistorialUtensilioFecha
    };

    cargarUtensilios();
    cargarEstadisticasUtensilios();
  }, []);

  return (
    <div>
      <div className="tarjeta">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2>Estadísticas de Utensilios</h2>
          <button className="boton" onClick={() => mostrarHistorialAgregadoUtensilios()}>📊 Historial Agrupado</button>
        </div>
        <div className="gridEstadisticas">
          <div className="tarjetaEstadistica"><h3 id="inversionTotalUtensilios">$0.00</h3><p>Inversión Total</p></div>
          <div className="tarjetaEstadistica"><h3 id="inversionRecuperadaUtensilios">$0.00</h3><p>Inversión Recuperada</p></div>
          <div className="tarjetaEstadistica"><h3 id="inversionNetaUtensilios">$0.00</h3><p>Inversión Neta</p></div>
          <div className="tarjetaEstadistica"><h3 id="totalUtensilios">0</h3><p>Total de Utensilios</p></div>
        </div>
      </div>

      <div className="tarjeta">
        <div className="encabezadoTarjeta">
          <h2>Inventario de Utensilios</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="text" className="cajaBusqueda" id="busquedaUtensilios" placeholder="🔍 Buscar utensilio..." onChange={e => filtrarUtensilios(e.target.value)} />
            <div className="botonesImportarExportar">
              <button className="botonImportar" onClick={() => document.getElementById('importarUtensilios')?.click()}>📥 Importar</button>
              <input type="file" id="importarUtensilios" className="inputArchivoOculto" accept=".json" onChange={e => importarDatos('utensilios', e.target)} />
              <button className="botonExportar" onClick={() => exportarDatos('utensilios')}>📤 Exportar</button>
            </div>
            <button className="boton" onClick={() => abrirModal('modalUtensilio')}>➥ Agregar Utensilio</button>
          </div>
        </div>
        <table>
          <thead>
            <tr><th>Código</th><th>Nombre</th><th>Proveedor</th><th>Unidad</th><th>Cantidad Total</th><th>Costo Total</th><th>Costo/Unidad</th><th>Acciones</th></tr>
          </thead>
          <tbody id="cuerpoUtensilios"></tbody>
        </table>

        <div id="modalUtensilio" className="modal" onClick={() => cerrarModal('modalUtensilio')}>
          <div className="contenidoModal" onClick={e => e.stopPropagation()}>
            <div className="encabezadoModal"><h3>Agregar Utensilio</h3><button className="cerrarModal" onClick={() => cerrarModal('modalUtensilio')}>&times;</button></div>
            <form id="formularioUtensilio" onSubmit={agregarUtensilio} className="cajaFormulario">
              <input id="codigoUtensilio" type="text" placeholder="Código" required />
              <input id="nombreUtensilio" type="text" placeholder="Nombre" required />
              <input id="proveedorUtensilio" type="text" placeholder="Proveedor" />
              <input id="unidadUtensilio" type="text" placeholder="Unidad" required />
              <input id="cantidadUtensilio" type="number" step="0.01" placeholder="Cantidad" required />
              <input id="costoUtensilio" type="number" step="0.01" placeholder="Costo" required />
              <button className="boton botonExito" type="submit">Guardar</button>
            </form>
          </div>
        </div>

        <div id="modalEditarUtensilio" className="modal" onClick={() => cerrarModal('modalEditarUtensilio')}>
          <div className="contenidoModal" onClick={e => e.stopPropagation()}>
            <div className="encabezadoModal"><h3>Editar Utensilio</h3><button className="cerrarModal" onClick={() => cerrarModal('modalEditarUtensilio')}>&times;</button></div>
            <form onSubmit={guardarEditarUtensilio} className="cajaFormulario">
              <input id="idEditUtensilio" type="hidden" />
              <input id="editCodigoUtensilio" type="text" readOnly />
              <input id="editNombreUtensilio" type="text" required />
              <input id="editProveedorUtensilio" type="text" placeholder="Proveedor" />
              <input id="editUnidadUtensilio" type="text" required />
              <input id="editCantidadUtensilio" type="number" step="0.01" required />
              <input id="editCostoUtensilio" type="number" step="0.01" required />
              <button className="boton botonExito" type="submit">Guardar cambios</button>
            </form>
          </div>
        </div>

        <div id="modalHistorialUtensilio" className="modal" onClick={() => cerrarModal('modalHistorialUtensilio')}>
          <div className="contenidoModal" onClick={e => e.stopPropagation()}>
            <div className="encabezadoModal"><h3 id="tituloHistorialUtensilio">Historial</h3><button className="cerrarModal" onClick={() => cerrarModal('modalHistorialUtensilio')}>&times;</button></div>
            <table>
              <thead><tr><th>Fecha</th><th>Cantidad</th><th>Costo</th></tr></thead>
              <tbody id="cuerpoHistorialUtensilio"></tbody>
            </table>
          </div>
        </div>

        <div id="modalHistorialAgregadoUtensilios" className="modal" onClick={() => cerrarModal('modalHistorialAgregadoUtensilios')}>
          <div className="contenidoModal" style={{ maxWidth: '980px' }} onClick={e => e.stopPropagation()}>
            <div className="encabezadoModal"><h3>Historial agrupado de utensilios</h3><button className="cerrarModal" onClick={() => cerrarModal('modalHistorialAgregadoUtensilios')}>&times;</button></div>
            <div id="listaHistorialAgregadoUtensilios" style={{ maxHeight: '65vh', overflowY: 'auto' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function cargarUtensilios() {
  try {
    const respuesta = await fetch(`${API}/utensilios`);
    if (!respuesta.ok) {
      if (respuesta.status === 401) {
        mostrarNotificacion('Sesión expirada. Vuelve a iniciar sesión.', 'error');
      }
      return;
    }
    const utensilios = await respuesta.json();
    if (!Array.isArray(utensilios)) {
      console.error('Respuesta inválida en utensilios:', utensilios);
      return;
    }

    const cuerpo = document.getElementById('cuerpoUtensilios');
    if (!cuerpo) return;

    if (utensilios.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="8" style="text-align:center">No hay utensilios</td></tr>';
      return;
    }

    const fragment = document.createDocumentFragment();
    const utensiliosOrdenados = [...utensilios].sort((a, b) => {
      const proveedorA = String(a?.proveedor || '').trim() || 'ZZZ';
      const proveedorB = String(b?.proveedor || '').trim() || 'ZZZ';
      const cmpProveedor = proveedorA.localeCompare(proveedorB, 'es', { sensitivity: 'base' });
      if (cmpProveedor !== 0) return cmpProveedor;
      return String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', { sensitivity: 'base' });
    });

    let proveedorActual = null;
    utensiliosOrdenados.forEach(utensilio => {
      const proveedorGrupo = String(utensilio?.proveedor || '').trim() || 'Sin proveedor';
      if (proveedorGrupo !== proveedorActual) {
        proveedorActual = proveedorGrupo;
        const filaGrupo = document.createElement('tr');
        filaGrupo.className = 'filaGrupoProveedorUtensilios';
        filaGrupo.innerHTML = `<td colspan="8">Proveedor: ${proveedorGrupo}</td>`;
        fragment.appendChild(filaGrupo);
      }

      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td>${utensilio.codigo}</td>
        <td>${utensilio.nombre}</td>
        <td>${utensilio.proveedor || '<span style="color:#999">Sin proveedor</span>'}</td>
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

async function cargarEstadisticasUtensilios() {
  try {
    const respuesta = await fetch(`${API}/utensilios/estadisticas`);
    if (!respuesta.ok) {
      if (respuesta.status === 401) {
        mostrarNotificacion('Sesión expirada. Vuelve a iniciar sesión.', 'error');
      }
      return;
    }
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

async function agregarUtensilio(event) {
  if (event) event.preventDefault();

  const codigo = document.getElementById('codigoUtensilio')?.value;
  const nombre = document.getElementById('nombreUtensilio')?.value;
  const proveedor = (document.getElementById('proveedorUtensilio')?.value || '').trim();
  const unidad = document.getElementById('unidadUtensilio')?.value;
  const cantidad = parseFloat(document.getElementById('cantidadUtensilio')?.value);
  const costo = parseFloat(document.getElementById('costoUtensilio')?.value);

  if (!codigo || !nombre || !unidad || isNaN(cantidad) || isNaN(costo)) {
    mostrarNotificacion('Por favor completa todos los campos', 'error');
    return;
  }

  try {
    const respuesta = await fetch(`${API}/utensilios/agregar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, nombre, proveedor, unidad, cantidad, costo })
    });

    if (respuesta.ok) {
      document.getElementById('formularioUtensilio')?.reset();
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

async function editarUtensilio(id) {
  try {
    const respuesta = await fetch(`${API}/utensilios/${id}`);
    const utensilio = await respuesta.json();

    document.getElementById('editCodigoUtensilio').value = utensilio.codigo;
    document.getElementById('editNombreUtensilio').value = utensilio.nombre;
    document.getElementById('editProveedorUtensilio').value = utensilio.proveedor || '';
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

async function guardarEditarUtensilio(event) {
  if (event) event.preventDefault();

  const id = document.getElementById('idEditUtensilio')?.value;
  const nombre = document.getElementById('editNombreUtensilio')?.value;
  const proveedor = (document.getElementById('editProveedorUtensilio')?.value || '').trim();
  const unidad = document.getElementById('editUnidadUtensilio')?.value;
  const cantidad_total = parseFloat(document.getElementById('editCantidadUtensilio')?.value);
  const costo_total = parseFloat(document.getElementById('editCostoUtensilio')?.value);

  if (!nombre || !unidad || isNaN(cantidad_total) || isNaN(costo_total)) {
    mostrarNotificacion('Por favor completa todos los campos', 'error');
    return;
  }

  try {
    const respuesta = await fetch(`${API}/utensilios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, proveedor, unidad, cantidad_total, costo_total })
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

async function eliminarUtensilio(id) {
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

async function mostrarHistorialUtensilio(id, nombre) {
  try {
    const respuesta = await fetch(`${API}/utensilios/${id}/historial`);
    const historial = await respuesta.json();
    const cuerpo = document.getElementById('cuerpoHistorialUtensilio');
    const titulo = document.getElementById('tituloHistorialUtensilio');
    if (!cuerpo || !titulo) return;

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

function filtrarUtensilios(termBusqueda) {
  const filas = document.querySelectorAll('#cuerpoUtensilios tr');
  const termino = normalizarTextoBusqueda(termBusqueda);

  filas.forEach(fila => {
    if (fila.cells.length < 2) return;
    const codigo = normalizarTextoBusqueda(fila.cells[0]?.textContent || '');
    const nombre = normalizarTextoBusqueda(fila.cells[1]?.textContent || '');
    const proveedor = normalizarTextoBusqueda(fila.cells[2]?.textContent || '');
    fila.style.display = (codigo.includes(termino) || nombre.includes(termino) || proveedor.includes(termino)) ? '' : 'none';
  });
}

async function mostrarHistorialAgregadoUtensilios() {
  try {
    const respuesta = await fetch(`${API}/utensilios/historial/agrupar/fechas`);
    const historialPorFecha = await respuesta.json();
    const listaDiv = document.getElementById('listaHistorialAgregadoUtensilios');
    if (!listaDiv) return;

    if (!historialPorFecha || historialPorFecha.length === 0) {
      listaDiv.innerHTML = '<p style="text-align:center;color:#999">No hay registros de inversión en utensilios</p>';
      abrirModal('modalHistorialAgregadoUtensilios');
      return;
    }

    let html = '';
    historialPorFecha.forEach(dia => {
      const fechaFormato = new Date(dia.fecha).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      html += `
        <div style="border:2px solid #ddd;border-radius:8px;margin-bottom:15px;overflow:hidden">
          <div onclick="window.utensilios.toggleHistorialUtensilioFecha('${dia.fecha}')" style="background:#f5f5f5;padding:15px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none">
            <div style="flex:1">
              <h4 style="margin:0;color:#333;font-size:16px;text-transform:capitalize">${fechaFormato}</h4>
              <p style="margin:5px 0 0 0;font-size:12px;color:#666">${dia.total_utensilios} utensilio(s) agregado(s) · Total: $${Number(dia.total_costo || 0).toFixed(2)}</p>
            </div>
            <button id="boton-ut-${dia.fecha}" style="background:none;border:none;font-size:18px;cursor:pointer;padding:0 10px">▶</button>
          </div>
          <div id="detalles-ut-${dia.fecha}" style="display:none;padding:12px;background:#fff">
            ${(dia.utensilios || []).map(utensilio => `
              <div style="display:grid;grid-template-columns:120px 1fr 120px 120px;gap:8px;padding:6px 0;border-bottom:1px solid #eee">
                <span>${utensilio.hora}</span>
                <span>${utensilio.codigo} - ${utensilio.nombre}</span>
                <span>${utensilio.cambio_cantidad} ${utensilio.unidad}</span>
                <span style="text-align:right">$${Number(utensilio.cambio_costo || 0).toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    listaDiv.innerHTML = html;
    abrirModal('modalHistorialAgregadoUtensilios');
  } catch (error) {
    console.error('Error cargando historial agrupado de utensilios:', error);
    mostrarNotificacion('No se pudo cargar el historial agrupado de utensilios', 'error');
  }
}

function toggleHistorialUtensilioFecha(fecha) {
  const detalles = document.getElementById(`detalles-ut-${fecha}`);
  const boton = document.getElementById(`boton-ut-${fecha}`);
  if (!detalles || !boton) return;

  if (detalles.style.display === 'none' || detalles.style.display === '') {
    detalles.style.display = 'block';
    boton.textContent = '▼';
  } else {
    detalles.style.display = 'none';
    boton.textContent = '▶';
  }
}
