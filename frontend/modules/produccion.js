// Módulo de Producción

import { mostrarNotificacion } from '../utils/notificaciones.js';
import { abrirModal, cerrarModal, mostrarConfirmacion } from '../utils/modales.js';
import { API } from '../config.js';

export async function cargarProduccion() {
  try {
    const respuesta = await fetch(`${API}/produccion`);
    const producciones = await respuesta.json();
    
    const cuerpo = document.getElementById('cuerpoProduccion');
    if(!cuerpo) return;
    
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
      fila.innerHTML = `
        <td>${prod.nombre_receta}</td>
        <td>${cantidad}</td>
        <td>$${costo.toFixed(2)}</td>
        <td>$${precio.toFixed(2)}</td>
        <td>$${ganancia.toFixed(2)}</td>
        <td>${new Date(prod.fecha_produccion).toLocaleDateString()}</td>
        <td>
          <button onclick="window.produccion.abrirModalVenta(${prod.id}, '${prod.nombre_receta}', ${cantidad}, ${costo}, ${precio})" class="botonPequeno">✅ Vender</button>
          <button onclick="window.produccion.abrirModalCortesia(${prod.id}, '${prod.nombre_receta}', ${cantidad})" class="botonPequeno" style="background: #9b59b6;">🎁 Cortesía</button>
          <button onclick="window.produccion.eliminarProduccion(${prod.id})" class="botonPequeno botonDanger">🗑️</button>
        </td>
      `;
      cuerpo.appendChild(fila);
    });
  } catch (error) {
    console.error('Error cargando producción:', error);
  }
}

export async function agregarProduccion() {
  const nombreReceta = document.getElementById('nombreRecetaProduccion').value;
  const cantidad = parseInt(document.getElementById('cantidadProduccion').value);
  const costoProduccion = parseFloat(document.getElementById('costoProduccion').value);
  const precioVenta = parseFloat(document.getElementById('precioVenta').value);
  
  if (!nombreReceta || isNaN(cantidad) || isNaN(costoProduccion) || isNaN(precioVenta)) {
    mostrarNotificacion('Por favor completa todos los campos', 'error');
    return;
  }
  
  try {
    const respuesta = await fetch(`${API}/produccion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre_receta: nombreReceta,
        cantidad,
        costo_produccion: costoProduccion,
        precio_venta: precioVenta
      })
    });
    
    if (respuesta.ok) {
      document.getElementById('formularioProduccion').reset();
      cargarProduccion();
      mostrarNotificacion('Producción registrada correctamente', 'exito');
    }
  } catch (error) {
    console.error('Error registrando producción:', error);
  }
}

export async function eliminarProduccion(id) {
  const ok = await mostrarConfirmacion('¿Eliminar este registro? Se devolverán los ingredientes al inventario.', 'Eliminar producción');
  if (!ok) return;
  
  try {
    const respuesta = await fetch(`${API}/produccion/${id}`, {
      method: 'DELETE'
    });
    
    if (respuesta.ok) {
      cargarProduccion();
    }
  } catch (error) {
    console.error('Error eliminando producción:', error);
  }
}

export function filtrarProduccion(termBusqueda) {
  const filas = document.querySelectorAll('#cuerpoProduccion tr');
  const termino = termBusqueda.toLowerCase();
  
  filas.forEach(fila => {
    const nombreReceta = fila.cells[0]?.textContent.toLowerCase() || '';
    if (nombreReceta.includes(termino)) {
      fila.style.display = '';
    } else {
      fila.style.display = 'none';
    }
  });
}

let ventaPendiente = null;
let cortesiaPendiente = null;

export function abrirModalVenta(idProduccion, nombreReceta, cantidad, costoProduccion, precioVenta) {
  ventaPendiente = { idProduccion, nombreReceta, cantidad, costoProduccion, precioVenta };
  const input = document.getElementById('numeroPedidoVenta');
  if (input) input.value = '';
  abrirModal('modalVentaPedido');
}

export async function confirmarVentaPedido(event) {
  if (event) event.preventDefault();
  if (!ventaPendiente) return;
  const numeroPedido = document.getElementById('numeroPedidoVenta').value.trim();
  if (!numeroPedido) {
    mostrarNotificacion('Por favor ingresa el numero de pedido', 'error');
    return;
  }
  cerrarModal('modalVentaPedido');
  const { idProduccion, nombreReceta, cantidad, costoProduccion, precioVenta } = ventaPendiente;
  ventaPendiente = null;
  await registrarVenta(idProduccion, nombreReceta, cantidad, costoProduccion, precioVenta, numeroPedido);
}

export async function registrarVenta(idProduccion, nombreReceta, cantidad, costoProduccion, precioVenta, numeroPedido) {
  try {
    const respuesta = await fetch(`${API}/ventas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre_receta: nombreReceta,
        cantidad: cantidad,
        fecha_produccion: new Date().toISOString(),
        costo_produccion: costoProduccion,
        precio_venta: precioVenta,
        id_produccion: idProduccion,
        numero_pedido: numeroPedido
      })
    });
    
    if (respuesta.ok) {
      cargarProduccion();
      // Notificar que se debe recargar ventas
      window.dispatchEvent(new CustomEvent('ventasActualizadas'));
      mostrarNotificacion('Venta registrada correctamente', 'exito');
    }
  } catch (error) {
    console.error('Error registrando venta:', error);
  }
}

export function abrirModalCortesia(idProduccion, nombreReceta, cantidad) {
  cortesiaPendiente = { idProduccion, nombreReceta, cantidad };
  const inputPedido = document.getElementById('numeroPedidoCortesia');
  const inputMotivo = document.getElementById('motivoCortesia');
  const inputPara = document.getElementById('paraQuienCortesia');
  if (inputPedido) inputPedido.value = '';
  if (inputMotivo) inputMotivo.value = '';
  if (inputPara) inputPara.value = '';
  abrirModal('modalCortesia');
}

export async function confirmarCortesia(event) {
  if (event) event.preventDefault();
  if (!cortesiaPendiente) return;
  const numeroPedido = document.getElementById('numeroPedidoCortesia').value.trim();
  const motivo = document.getElementById('motivoCortesia').value.trim();
  const paraQuien = document.getElementById('paraQuienCortesia').value.trim();
  if (!numeroPedido || !motivo) {
    mostrarNotificacion('Por favor completa numero de pedido y motivo', 'error');
    return;
  }
  cerrarModal('modalCortesia');
  const { idProduccion, nombreReceta, cantidad } = cortesiaPendiente;
  cortesiaPendiente = null;
  await registrarCortesia(idProduccion, nombreReceta, cantidad, numeroPedido, motivo, paraQuien);
}

export async function registrarCortesia(idProduccion, nombreReceta, cantidad, numeroPedido, motivo, paraQuien) {
  try {
    const respuesta = await fetch(`${API}/cortesia/${idProduccion}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre_receta: nombreReceta,
        cantidad: cantidad,
        numero_pedido: numeroPedido,
        motivo: motivo,
        para_quien: paraQuien
      })
    });
    
    if (respuesta.ok) {
      cargarProduccion();
      // Notificar que se debe recargar cortesias
      window.dispatchEvent(new CustomEvent('cortesiasActualizadas'));
      mostrarNotificacion('Cortesía registrada - ingredientes descontados, sin ganancia', 'exito');
    }
  } catch (error) {
    console.error('Error registrando cortesía:', error);
    mostrarNotificacion('Error al registrar cortesía', 'error');
  }
}
