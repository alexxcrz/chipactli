import React, { useEffect } from 'react';
import './Produccion.css';
import { mostrarNotificacion } from '../../utils/notificaciones.jsx';
import { abrirModal, cerrarModal, mostrarConfirmacion } from '../../utils/modales.jsx';
import { fetchAPIJSON } from '../../utils/api.jsx';
import { normalizarTextoBusqueda } from '../../utils/texto.jsx';

export default function Produccion() {
  useEffect(() => {
    window.produccion = {
      cargarProduccion,
      eliminarProduccion,
      filtrarProduccion,
      abrirModalVenta,
      confirmarVentaPedido,
      registrarVenta,
      abrirModalCortesia,
      confirmarCortesia,
      registrarCortesia
    };

    cargarProduccion();
  }, []);

  return (
    <div>
      <div className="tarjeta">
        <div className="encabezadoTarjeta">
          <h2>Registro de Producción</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              className="cajaBusqueda"
              placeholder="🔍 Buscar producción..."
              onChange={e => filtrarProduccion(e.target.value)}
            />
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Receta</th><th>Cantidad</th><th>Costo</th><th>Precio</th><th>Ganancia</th><th>Fecha</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody id="cuerpoProduccion"></tbody>
        </table>
      </div>

      <div id="modalVentaPedido" className="modal" onClick={() => cerrarModal('modalVentaPedido')}>
        <div className="contenidoModal" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal">
            <h3>Registrar Venta</h3>
            <button className="cerrarModal" onClick={() => cerrarModal('modalVentaPedido')}>&times;</button>
          </div>
          <form onSubmit={confirmarVentaPedido} className="cajaFormulario">
            <label htmlFor="numeroPedidoVenta">Número de pedido</label>
            <input id="numeroPedidoVenta" type="text" required />
            <button className="boton botonExito" type="submit">Confirmar</button>
          </form>
        </div>
      </div>

      <div id="modalCortesia" className="modal" onClick={() => cerrarModal('modalCortesia')}>
        <div className="contenidoModal" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal">
            <h3>Registrar Cortesía</h3>
            <button className="cerrarModal" onClick={() => cerrarModal('modalCortesia')}>&times;</button>
          </div>
          <form onSubmit={confirmarCortesia} className="cajaFormulario">
            <label htmlFor="numeroPedidoCortesia">Número de pedido</label>
            <input id="numeroPedidoCortesia" type="text" required />
            <label htmlFor="motivoCortesia">Motivo</label>
            <input id="motivoCortesia" type="text" required />
            <label htmlFor="paraQuienCortesia">Para quién</label>
            <input id="paraQuienCortesia" type="text" />
            <button className="boton botonExito" type="submit">Confirmar</button>
          </form>
        </div>
      </div>
    </div>
  );
}

async function cargarProduccion() {
  try {
    const producciones = await fetchAPIJSON('/produccion');
    if (!Array.isArray(producciones)) {
      console.error('Respuesta inválida en producción:', producciones);
      return;
    }

    const cuerpo = document.getElementById('cuerpoProduccion');
    if (!cuerpo) return;

    cuerpo.innerHTML = '';

    if (producciones.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="7" style="text-align:center">No hay producción</td></tr>';
      return;
    }

    producciones.forEach(prod => {
      const fila = document.createElement('tr');
      const costo = Number(prod.costo_produccion) || 0;
      const precio = Number(prod.precio_venta) || 0;
      const cantidad = Number(prod.cantidad) || 0;
      const ganancia = (precio * cantidad) - costo;

      const celdaReceta = document.createElement('td');
      celdaReceta.textContent = String(prod.nombre_receta || '');
      fila.appendChild(celdaReceta);

      const celdaCantidad = document.createElement('td');
      celdaCantidad.textContent = String(cantidad);
      fila.appendChild(celdaCantidad);

      const celdaCosto = document.createElement('td');
      celdaCosto.textContent = `$${costo.toFixed(2)}`;
      fila.appendChild(celdaCosto);

      const celdaPrecio = document.createElement('td');
      celdaPrecio.textContent = `$${precio.toFixed(2)}`;
      fila.appendChild(celdaPrecio);

      const celdaGanancia = document.createElement('td');
      celdaGanancia.textContent = `$${ganancia.toFixed(2)}`;
      fila.appendChild(celdaGanancia);

      const celdaFecha = document.createElement('td');
      celdaFecha.textContent = prod.fecha_produccion ? new Date(prod.fecha_produccion).toLocaleDateString() : '-';
      fila.appendChild(celdaFecha);

      const celdaAcciones = document.createElement('td');

      const botonVender = document.createElement('button');
      botonVender.className = 'botonPequeno';
      botonVender.textContent = '✅ Vender';
      botonVender.addEventListener('click', () => abrirModalVenta(prod.id, prod.nombre_receta, cantidad, costo, precio));

      const botonCortesia = document.createElement('button');
      botonCortesia.className = 'botonPequeno';
      botonCortesia.style.background = '#9b59b6';
      botonCortesia.textContent = '🎁 Cortesía';
      botonCortesia.addEventListener('click', () => abrirModalCortesia(prod.id, prod.nombre_receta, cantidad));

      const botonEliminar = document.createElement('button');
      botonEliminar.className = 'botonPequeno botonDanger';
      botonEliminar.textContent = '🗑️';
      botonEliminar.addEventListener('click', () => eliminarProduccion(prod.id));

      celdaAcciones.appendChild(botonVender);
      celdaAcciones.appendChild(botonCortesia);
      celdaAcciones.appendChild(botonEliminar);
      fila.appendChild(celdaAcciones);

      cuerpo.appendChild(fila);
    });
  } catch (error) {
    console.error('Error cargando producción:', error);
    mostrarNotificacion(error?.message || 'Error al cargar producción', 'error');
  }
}

async function eliminarProduccion(id) {
  const ok = await mostrarConfirmacion('¿Eliminar este registro? Se devolverán los ingredientes al inventario.', 'Eliminar producción');
  if (!ok) return;

  try {
    await fetchAPIJSON(`/produccion/${id}`, { method: 'DELETE' });
    cargarProduccion();
  } catch (error) {
    console.error('Error eliminando producción:', error);
  }
}

function filtrarProduccion(termBusqueda) {
  const filas = document.querySelectorAll('#cuerpoProduccion tr');
  const termino = normalizarTextoBusqueda(termBusqueda);

  filas.forEach(fila => {
    const nombreReceta = normalizarTextoBusqueda(fila.cells[0]?.textContent || '');
    fila.style.display = nombreReceta.includes(termino) ? '' : 'none';
  });
}

let ventaPendiente = null;
let cortesiaPendiente = null;

function abrirModalVenta(idProduccion, nombreReceta, cantidad, costoProduccion, precioVenta) {
  ventaPendiente = { idProduccion, nombreReceta, cantidad, costoProduccion, precioVenta };
  const input = document.getElementById('numeroPedidoVenta');
  if (input) input.value = '';
  abrirModal('modalVentaPedido');
}

async function confirmarVentaPedido(event) {
  if (event) event.preventDefault();
  if (!ventaPendiente) return;
  const numeroPedido = document.getElementById('numeroPedidoVenta')?.value.trim();
  if (!numeroPedido) {
    mostrarNotificacion('Por favor ingresa el numero de pedido', 'error');
    return;
  }
  cerrarModal('modalVentaPedido');
  const { idProduccion, nombreReceta, cantidad, costoProduccion, precioVenta } = ventaPendiente;
  ventaPendiente = null;
  await registrarVenta(idProduccion, nombreReceta, cantidad, costoProduccion, precioVenta, numeroPedido);
}

async function registrarVenta(idProduccion, nombreReceta, cantidad, costoProduccion, precioVenta, numeroPedido) {
  try {
    await fetchAPIJSON('/ventas', {
      method: 'POST',
      body: {
        nombre_receta: nombreReceta,
        cantidad,
        fecha_produccion: new Date().toISOString(),
        costo_produccion: costoProduccion,
        precio_venta: precioVenta,
        id_produccion: idProduccion,
        numero_pedido: numeroPedido
      }
    });
    cargarProduccion();
    window.dispatchEvent(new CustomEvent('ventasActualizadas'));
    mostrarNotificacion('Venta registrada correctamente', 'exito');
  } catch (error) {
    console.error('Error registrando venta:', error);
  }
}

function abrirModalCortesia(idProduccion, nombreReceta, cantidad) {
  cortesiaPendiente = { idProduccion, nombreReceta, cantidad };
  const inputPedido = document.getElementById('numeroPedidoCortesia');
  const inputMotivo = document.getElementById('motivoCortesia');
  const inputPara = document.getElementById('paraQuienCortesia');
  if (inputPedido) inputPedido.value = '';
  if (inputMotivo) inputMotivo.value = '';
  if (inputPara) inputPara.value = '';
  abrirModal('modalCortesia');
}

async function confirmarCortesia(event) {
  if (event) event.preventDefault();
  if (!cortesiaPendiente) return;
  const numeroPedido = document.getElementById('numeroPedidoCortesia')?.value.trim();
  const motivo = document.getElementById('motivoCortesia')?.value.trim();
  const paraQuien = document.getElementById('paraQuienCortesia')?.value.trim();
  if (!numeroPedido || !motivo) {
    mostrarNotificacion('Por favor completa numero de pedido y motivo', 'error');
    return;
  }
  cerrarModal('modalCortesia');
  const { idProduccion, nombreReceta, cantidad } = cortesiaPendiente;
  cortesiaPendiente = null;
  await registrarCortesia(idProduccion, nombreReceta, cantidad, numeroPedido, motivo, paraQuien);
}

async function registrarCortesia(idProduccion, nombreReceta, cantidad, numeroPedido, motivo, paraQuien) {
  try {
    await fetchAPIJSON(`/cortesia/${idProduccion}`, {
      method: 'POST',
      body: {
        nombre_receta: nombreReceta,
        cantidad,
        numero_pedido: numeroPedido,
        motivo,
        para_quien: paraQuien
      }
    });
    cargarProduccion();
    window.dispatchEvent(new CustomEvent('cortesiasActualizadas'));
    mostrarNotificacion('Cortesía registrada - ingredientes descontados, sin ganancia', 'exito');
  } catch (error) {
    console.error('Error registrando cortesía:', error);
    mostrarNotificacion('Error al registrar cortesía', 'error');
  }
}
