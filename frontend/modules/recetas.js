// Módulo de Recetas

import { mostrarNotificacion } from '../utils/notificaciones.js';
import { abrirModal, cerrarModal, mostrarConfirmacion } from '../utils/modales.js';
import { API } from '../config.js';

export let ingredientesTemporales = [];
export let categoriaRecetaActual = null;

export async function cargarCategorias() {
  try {
    const respuesta = await fetch(`${API}/categorias`);
    const categorias = await respuesta.json();
    
    const selectores = ['categoriaReceta', 'editCategoriaReceta', 'filtroCategoria'];
    selectores.forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;
      const actual = select.value;
      select.innerHTML = '<option value="">-- Selecciona una categoría --</option>';
      categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        select.appendChild(option);
      });
      select.value = actual;
    });
  } catch (error) {
    console.error('Error cargando categorías:', error);
  }
}

export async function agregarCategoria(event) {
  if (event) {
    event.preventDefault();
  }
  const nombre = document.getElementById('nombreCategoria').value;
  
  if (!nombre.trim()) {
    mostrarNotificacion('Por favor ingresa un nombre de categoría', 'error');
    return;
  }
  
  try {
    const respuesta = await fetch(`${API}/categorias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre })
    });
    
    if (respuesta.ok) {
      document.getElementById('nombreCategoria').value = '';
      cerrarModal('modalCategoria');
      await cargarCategorias();
      await cargarPestanasCategorias();
      mostrarNotificacion('Categoría agregada correctamente', 'exito');
    } else {
      mostrarNotificacion('Error al guardar la categoría', 'error');
    }
  } catch (error) {
    console.error('Error agregando categoría:', error);
    mostrarNotificacion('Error al agregar la categoría', 'error');
  }
}

export async function eliminarCategoria(id, nombre) {
  const confirmacion = await mostrarConfirmacion(
    `¿Estás seguro de eliminar la categoría "${nombre}"?`,
    'Esta acción no se puede deshacer.'
  );
  
  if (!confirmacion) return;
  
  try {
    const respuesta = await fetch(`${API}/categorias/${id}`, {
      method: 'DELETE'
    });
    
    if (respuesta.ok) {
      mostrarNotificacion('✅ Categoría eliminada correctamente', 'exito');
      await cargarCategorias();
      await cargarPestanasCategorias();
      categoriaRecetaActual = null;
      await cargarListadoRecetas();
    } else {
      const error = await respuesta.json();
      mostrarNotificacion(`❌ ${error.error || 'Error al eliminar categoría'}`, 'error');
    }
  } catch (error) {
    console.error('Error eliminando categoría:', error);
    mostrarNotificacion('❌ Error de conexión', 'error');
  }
}

export async function cargarPestanasCategorias() {
  try {
    const respuesta = await fetch(`${API}/categorias`);
    const categorias = await respuesta.json();
    
    const contenedorRecetas = document.getElementById('pestanasCategoriasRecetas');
    if (contenedorRecetas) {
      contenedorRecetas.innerHTML = '';
      
      const btnTodas = document.createElement('button');
      btnTodas.className = 'boton ' + (categoriaRecetaActual === null ? 'activo' : '');
      btnTodas.textContent = '📚 Todas';
      btnTodas.onclick = () => {
        categoriaRecetaActual = null;
        cargarListadoRecetas();
        cargarPestanasCategorias();
      };
      contenedorRecetas.appendChild(btnTodas);
      
      categorias.forEach(cat => {
        const wrapper = document.createElement('div');
        wrapper.className = 'btnCategoriaWrapper';
        
        const btn = document.createElement('button');
        btn.className = 'boton ' + (categoriaRecetaActual === cat.id ? 'activo' : '');
        btn.textContent = `📁 ${cat.nombre}`;
        btn.onclick = () => {
          categoriaRecetaActual = cat.id;
          cargarListadoRecetas();
          cargarPestanasCategorias();
        };
        
        const btnEliminar = document.createElement('button');
        btnEliminar.className = 'btnEliminarCategoria';
        btnEliminar.textContent = '🗑️';
        btnEliminar.onclick = (e) => {
          e.stopPropagation();
          eliminarCategoria(cat.id, cat.nombre);
        };
        
        wrapper.appendChild(btn);
        wrapper.appendChild(btnEliminar);
        contenedorRecetas.appendChild(wrapper);
      });
    }
  } catch (error) {
    console.error('Error cargando pestañas de categorías:', error);
  }
}

export async function cargarListadoRecetas() {
  try {
    let url = `${API}/recetas`;
    if (categoriaRecetaActual !== null) {
      url += `?categoria=${categoriaRecetaActual}`;
    }
    
    const respuesta = await fetch(url);
    const recetas = await respuesta.json();
    
    const cuerpo = document.getElementById('cuerpoRecetas');
    cuerpo.innerHTML = '';
    
    if (recetas.length === 0) {
      cuerpo.innerHTML = '<div style="text-align:center;padding:30px;color:#999">No hay recetas</div>';
      return;
    }
    
    for (const receta of recetas) {
      try {
        const respIngredientes = await fetch(`${API}/recetas/${receta.id}`);
        const detalleReceta = await respIngredientes.json();
        
        const respCapacidad = await fetch(`${API}/recetas/calcular`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_receta: receta.id })
        });
        const capacidad = await respCapacidad.json();
        
        const totalIngredientes = (detalleReceta.ingredientes || []).length;
        
        let totalGramos = 0;
        let totalMililitros = 0;
        (detalleReceta.ingredientes || []).forEach(ing => {
          let cantidad = ing.cantidad || 0;
          const unidad = (ing.unidad || '').toLowerCase();
          
          if (unidad === 'kg') {
            totalGramos += cantidad * 1000;
          } else if (unidad === 'g') {
            totalGramos += cantidad;
          }
          else if (unidad === 'l') {
            totalMililitros += cantidad * 1000;
          } else if (unidad === 'ml') {
            totalMililitros += cantidad;
          }
        });
        
        let textoTotal = '';
        if (totalGramos > 0 && totalMililitros > 0) {
          textoTotal = `${totalGramos.toFixed(0)}g + ${totalMililitros.toFixed(0)}ml`;
        } else if (totalGramos > 0) {
          textoTotal = `${totalGramos.toFixed(0)}g`;
        } else if (totalMililitros > 0) {
          textoTotal = `${totalMililitros.toFixed(0)}ml`;
        } else {
          textoTotal = 'N/A';
        }
        
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjetaReceta';
        tarjeta.innerHTML = `
          <div style="padding:18px">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
              <div style="flex:1">
                <h3 style="margin:0 0 5px 0;color:#1a1a1a;font-size:16px">${receta.nombre}</h3>
                <p style="margin:0;color:#666;font-size:11px">📁 ${receta.categoria || 'Sin categoría'} ${receta.gramaje ? `• ${receta.gramaje}g` : ''}</p>
              </div>
            </div>
            <div style="background:#f8f9fa;padding:10px;border-radius:8px;margin-bottom:12px">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px">
                <div style="display:flex;align-items:center;gap:5px">
                  <span style="font-weight:600;color:#333">🧪 Ingredientes:</span>
                  <span style="color:#666">${totalIngredientes}</span>
                </div>
                <div style="display:flex;align-items:center;gap:5px">
                  <span style="font-weight:600;color:#333">⚖️ Total:</span>
                  <span style="color:#666">${textoTotal}</span>
                </div>
                <div style="display:flex;align-items:center;gap:5px">
                  <span style="font-weight:600;color:#333">📦 Capacidad:</span>
                  <span style="color:#666">${capacidad.piezas_maximas || 0} pz</span>
                </div>
                <div style="display:flex;align-items:center;gap:5px">
                  <span style="font-weight:600;color:#333">💰 Costo/pz:</span>
                  <span style="color:#4a9b5e;font-weight:600">$${(capacidad.costo_por_pieza || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div style="display:flex;gap:5px;flex-wrap:wrap">
              <button onclick="window.recetas.abrirProduccionRapida(${receta.id}, '${receta.nombre.replace(/'/g, "\\'")}', ${(capacidad.costo_por_pieza || 0)})" class="botonPequeno" style="background:#ff9800" title="Producir">🎰</button>
              <button onclick="window.recetas.editarReceta(${receta.id})" class="botonPequeno" title="Editar receta">✏️</button>
              <button onclick="window.recetas.abrirEscalarReceta(${receta.id}, '${receta.nombre.replace(/'/g, "\\'")}', ${receta.gramaje || 0})" class="botonPequeno" style="background:#3498db" title="Copiar con escalado">📋</button>
              <button onclick="window.recetas.mostrarIngredientes(${receta.id})" class="botonPequeno" title="Ver ingredientes">👁️</button>
              <button onclick="window.recetas.eliminarReceta(${receta.id})" class="botonPequeno botonDanger" title="Eliminar receta">🗑️</button>
            </div>
          </div>
        `;
        cuerpo.appendChild(tarjeta);
      } catch (error) {
        console.error(`Error procesando receta ${receta.id}:`, error);
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjetaReceta';
        tarjeta.innerHTML = `
          <div style="padding:18px">
            <h3 style="margin:0 0 5px 0;color:#1a1a1a;font-size:16px">${receta.nombre}</h3>
            <p style="margin:0 0 12px 0;color:#666;font-size:11px">📁 ${receta.categoria || 'Sin categoría'} ${receta.gramaje ? `• ${receta.gramaje}g` : ''}</p>
            <div style="display:flex;gap:5px;flex-wrap:wrap">
              <button onclick="window.recetas.abrirProduccionRapida(${receta.id}, '${receta.nombre.replace(/'/g, "\\'")}', 0)" class="botonPequeno" style="background:#ff9800">🎰</button>
              <button onclick="window.recetas.editarReceta(${receta.id})" class="botonPequeno">✏️</button>
              <button onclick="window.recetas.abrirEscalarReceta(${receta.id}, '${receta.nombre.replace(/'/g, "\\'")}', ${receta.gramaje || 0})" class="botonPequeno" style="background:#3498db">📋</button>
              <button onclick="window.recetas.mostrarIngredientes(${receta.id})" class="botonPequeno">👁️</button>
              <button onclick="window.recetas.eliminarReceta(${receta.id})" class="botonPequeno botonDanger">🗑️</button>
            </div>
          </div>
        `;
        cuerpo.appendChild(tarjeta);
      }
    }
  } catch (error) {
    console.error('Error cargando recetas:', error);
  }
}

export async function agregarReceta(event) {
  if (event) {
    event.preventDefault();
  }
  const nombre = document.getElementById('nombreReceta').value;
  const idCategoria = document.getElementById('categoriaReceta').value;
  const gramaje = parseFloat(document.getElementById('gramajeReceta').value);
  
  if (!nombre || !idCategoria || isNaN(gramaje)) {
    mostrarNotificacion('Por favor completa los campos necesarios', 'error');
    return;
  }
  
  const ingredientes = ingredientesTemporales.map(ing => ({
    id_insumo: ing.id_insumo,
    cantidad: ing.cantidad,
    unidad: ing.unidad
  }));
  
  console.log('📝 Creando receta con ingredientes:', JSON.stringify(ingredientes, null, 2));
  
  try {
    const respuesta = await fetch(`${API}/recetas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        id_categoria: parseInt(idCategoria),
        gramaje,
        ingredientes
      })
    });
    
    if (respuesta.ok) {
      const resultado = await respuesta.json();
      console.log('✅ Receta creada:', resultado);
      
      document.getElementById('formularioReceta').reset();
      ingredientesTemporales = [];
      actualizarTablaIngredientes();
      cerrarModal('modalReceta');
      mostrarNotificacion('Receta creada correctamente', 'exito');
    } else {
      const error = await respuesta.json();
      mostrarNotificacion('Error: ' + error.error, 'error');
    }
  } catch (error) {
    console.error('Error creando receta:', error);
  }
}

export async function buscarInsumoParaReceta(termino) {
  const crearModal = document.getElementById('modalReceta');
  const editarModal = document.getElementById('modalEditarReceta');
  
  const esEdicion = editarModal && editarModal.style.display === 'block';
  
  const idListaBusqueda = esEdicion ? 'editListaBusquedaInsumos' : 'listaBusquedaInsumos';
  const idInsumoInput = esEdicion ? 'editInsumoSeleccionado' : 'insumoSeleccionado';
  const idInsumoId = esEdicion ? 'editIdInsumoSeleccionado' : 'idInsumoSeleccionado';
  
  const listaBusqueda = document.getElementById(idListaBusqueda);
  if (termino.length < 1) {
    listaBusqueda.innerHTML = '';
    listaBusqueda.style.display = 'none';
    return;
  }
  
  try {
    const respuesta = await fetch(`${API}/inventario?busqueda=${encodeURIComponent(termino)}`);
    const insumos = await respuesta.json();
    listaBusqueda.innerHTML = '';
    listaBusqueda.style.display = 'block';
    
    insumos.forEach(insumo => {
      const opcion = document.createElement('div');
      opcion.className = 'elementoSugerencia';
      opcion.textContent = `${insumo.nombre} (${insumo.codigo})`;
      opcion.onclick = () => {
        document.getElementById(idInsumoInput).value = insumo.nombre;
        document.getElementById(idInsumoId).value = insumo.id;
        
        const idUnidadField = esEdicion ? 'editUnidadIngrediente' : 'unidadIngrediente';
        const unidadSelect = document.getElementById(idUnidadField);
        unidadSelect.value = insumo.unidad || '';
        unidadSelect.disabled = true;
        
        listaBusqueda.innerHTML = '';
        listaBusqueda.style.display = 'none';
      };
      listaBusqueda.appendChild(opcion);
    });

    if (!insumos.length) {
      listaBusqueda.style.display = 'none';
    }
  } catch (error) {
    console.error('Error buscando insumo:', error);
  }
}

export function agregarIngrediente(esEdicion = false) {
  const prefijo = esEdicion ? 'edit' : '';
  const idFieldId = prefijo ? 'editIdInsumoSeleccionado' : 'idInsumoSeleccionado';
  const nombreFieldId = prefijo ? 'editInsumoSeleccionado' : 'insumoSeleccionado';
  const cantidadFieldId = prefijo ? 'editCantidadIngrediente' : 'cantidadIngrediente';
  const unidadFieldId = prefijo ? 'editUnidadIngrediente' : 'unidadIngrediente';
  
  const idInsumo = parseInt(document.getElementById(idFieldId).value);
  const nombreInsumo = document.getElementById(nombreFieldId).value;
  const cantidad = parseFloat(document.getElementById(cantidadFieldId).value);
  const unidad = document.getElementById(unidadFieldId).value;
  
  if (!idInsumo || !nombreInsumo || isNaN(cantidad) || !unidad) {
    mostrarNotificacion('Por favor completa todos los campos', 'error');
    return;
  }
  
  if (ingredientesTemporales.some(ing => ing.id_insumo === idInsumo)) {
    mostrarNotificacion('Este insumo ya está en la receta', 'error');
    return;
  }
  
  ingredientesTemporales.push({
    id_insumo: idInsumo,
    nombre: nombreInsumo,
    cantidad,
    unidad
  });
  
  console.log('✅ Ingrediente agregado:', { id_insumo: idInsumo, cantidad, unidad });
  console.log('📋 Total ingredientes:', ingredientesTemporales);
  
  document.getElementById(idFieldId).value = '';
  document.getElementById(nombreFieldId).value = '';
  document.getElementById(cantidadFieldId).value = '';
  document.getElementById(unidadFieldId).value = '';
  document.getElementById(unidadFieldId).disabled = true;
  
  actualizarTablaIngredientes();
}

export function eliminarIngrediente(indice) {
  ingredientesTemporales.splice(indice, 1);
  actualizarTablaIngredientes();
}

export function actualizarTablaIngredientes() {
  const tabla = document.getElementById('tablaIngredientesTemporales');
  if (!tabla) return;
  tabla.innerHTML = '';
  
  ingredientesTemporales.forEach((ing, idx) => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${ing.nombre}</td>
      <td>${parseFloat(ing.cantidad).toFixed(2)} ${ing.unidad}</td>
      <td><button onclick="window.recetas.eliminarIngrediente(${idx})" class="botonPequeno botonDanger">×</button></td>
    `;
    tabla.appendChild(fila);
  });
}

export async function mostrarIngredientes(idReceta) {
  try {
    const respuesta = await fetch(`${API}/recetas/${idReceta}`);
    if (!respuesta.ok) {
      mostrarNotificacion('Error al cargar la receta', 'error');
      return;
    }
    const receta = await respuesta.json();
    
    let html = `<h3 style="margin-bottom:12px;color:#1a1a1a;font-size:16px">${receta.nombre}</h3><ul style="list-style:none;padding:0" id="listaIngredientesModal">`;
    
    if (!receta.ingredientes || receta.ingredientes.length === 0) {
      html += '<li style="padding:10px;color:#999">Sin ingredientes agregados</li>';
    } else {
      receta.ingredientes.forEach((ing, idx) => {
        html += `<li style="padding:8px;background:#f5f5f5;margin-bottom:6px;border-radius:6px;border-left:4px solid #4a9b5e;display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span style="flex:1;font-size:13px">${ing.nombre}</span>
          <input type="number" id="cantidad_${ing.id}" value="${parseFloat(ing.cantidad).toFixed(2)}" step="0.01" style="width:70px;padding:4px;border:1px solid #ddd;border-radius:4px;text-align:center;font-size:12px">
          <span style="min-width:35px;font-size:12px">${ing.unidad}</span>
          <div style="display:flex;gap:4px">
            <button onclick="window.recetas.guardarCantidadIngrediente(${idReceta}, ${ing.id})" class="botonPequeno" style="background:#4a9b5e;padding:4px 10px">💾</button>
            <button onclick="window.recetas.eliminarIngredienteDeReceta(${idReceta}, ${ing.id}, '${ing.nombre.replace(/'/g, "\\'")}')" class="botonPequeno botonDanger" style="padding:4px 10px">×</button>
          </div>
        </li>`;
      });
    }
    html += '</ul>';
    
    const detalles = document.getElementById('detallesIngredientes');
    detalles.innerHTML = html;
    abrirModal('modalIngredientes');
  } catch (error) {
    console.error('Error cargando ingredientes:', error);
    mostrarNotificacion('Error al cargar los ingredientes', 'error');
  }
}

export async function guardarCantidadIngrediente(idReceta, idIngrediente) {
  const nuevaCantidad = parseFloat(document.getElementById(`cantidad_${idIngrediente}`).value);
  
  if (isNaN(nuevaCantidad) || nuevaCantidad <= 0) {
    mostrarNotificacion('Por favor ingresa una cantidad válida', 'error');
    return;
  }
  
  try {
    const respuesta = await fetch(`${API}/recetas/${idReceta}`);
    const receta = await respuesta.json();
    
    const ingredientesActualizados = (receta.ingredientes || []).map(ing => {
      if (ing.id === idIngrediente) {
        return {
          id_insumo: ing.id_insumo,
          cantidad: nuevaCantidad,
          unidad: ing.unidad
        };
      }
      return {
        id_insumo: ing.id_insumo,
        cantidad: ing.cantidad,
        unidad: ing.unidad
      };
    });
    
    const respuestaActualizar = await fetch(`${API}/recetas/${idReceta}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: receta.nombre,
        id_categoria: receta.id_categoria,
        gramaje: receta.gramaje,
        ingredientes: ingredientesActualizados
      })
    });
    
    if (respuestaActualizar.ok) {
      mostrarNotificacion('Cantidad actualizada correctamente', 'exito');
      mostrarIngredientes(idReceta);
    }
  } catch (error) {
    console.error('Error actualizando cantidad:', error);
    mostrarNotificacion('Error al actualizar la cantidad', 'error');
  }
}

export async function eliminarIngredienteDeReceta(idReceta, idIngrediente, nombreIngrediente) {
  const ok = await mostrarConfirmacion(`¿Eliminar "${nombreIngrediente}" de esta receta?`, 'Eliminar ingrediente');
  if (!ok) return;
  
  try {
    const respuesta = await fetch(`${API}/recetas/${idReceta}`);
    const receta = await respuesta.json();
    
    const ingredientesFiltrados = (receta.ingredientes || []).filter(ing => ing.id !== idIngrediente);
    
    const respuestaActualizar = await fetch(`${API}/recetas/${idReceta}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: receta.nombre,
        id_categoria: receta.id_categoria,
        gramaje: receta.gramaje,
        ingredientes: ingredientesFiltrados.map(ing => ({
          id_insumo: ing.id_insumo,
          cantidad: ing.cantidad,
          unidad: ing.unidad
        }))
      })
    });
    
    if (respuestaActualizar.ok) {
      mostrarIngredientes(idReceta);
      mostrarNotificacion('Ingrediente eliminado correctamente', 'exito');
    }
  } catch (error) {
    console.error('Error eliminando ingrediente:', error);
    mostrarNotificacion('Error al eliminar el ingrediente', 'error');
  }
}

export async function editarReceta(id) {
  try {
    const respuesta = await fetch(`${API}/recetas/${id}`);
    const receta = await respuesta.json();
    
    document.getElementById('editNombreReceta').value = receta.nombre;
    document.getElementById('editCategoriaReceta').value = receta.id_categoria || '';
    document.getElementById('editGramajeReceta').value = receta.gramaje || 0;
    document.getElementById('idEditReceta').value = receta.id;
    
    ingredientesTemporales = (receta.ingredientes || []).map(ing => ({
      id_insumo: ing.id_insumo,
      nombre: ing.nombre,
      cantidad: ing.cantidad,
      unidad: ing.unidad
    }));
    actualizarTablaIngredientes();
    
    abrirModal('modalEditarReceta');
  } catch (error) {
    console.error('Error cargando receta:', error);
    mostrarNotificacion('Error al cargar la receta', 'error');
  }
}

export async function guardarEditarReceta(event) {
  if (event) event.preventDefault();
  
  const id = document.getElementById('idEditReceta').value;
  const nombre = document.getElementById('editNombreReceta').value;
  const id_categoria = document.getElementById('editCategoriaReceta').value;
  const gramaje = parseFloat(document.getElementById('editGramajeReceta').value);
  
  if (!nombre || !id_categoria || isNaN(gramaje)) {
    mostrarNotificacion('Por favor completa los campos necesarios', 'error');
    return;
  }
  
  const ingredientes = ingredientesTemporales.map(ing => ({
    id_insumo: ing.id_insumo,
    cantidad: ing.cantidad,
    unidad: ing.unidad
  }));
  
  try {
    const respuesta = await fetch(`${API}/recetas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        id_categoria: parseInt(id_categoria),
        gramaje,
        ingredientes
      })
    });
    
    if (respuesta.ok) {
      document.getElementById('editNombreReceta').value = '';
      document.getElementById('editCategoriaReceta').value = '';
      ingredientesTemporales = [];
      actualizarTablaIngredientes();
      cerrarModal('modalEditarReceta');
      mostrarNotificacion('Receta actualizada correctamente', 'exito');
    }
  } catch (error) {
    console.error('Error actualizando receta:', error);
    mostrarNotificacion('Error al actualizar la receta', 'error');
  }
}

export async function eliminarReceta(id) {
  const ok = await mostrarConfirmacion('¿Eliminar esta receta?', 'Eliminar receta');
  if (!ok) return;
  
  try {
    const respuesta = await fetch(`${API}/recetas/${id}`, {
      method: 'DELETE'
    });
    
    if (respuesta.ok) {
      mostrarNotificacion('Receta eliminada correctamente', 'exito');
    }
  } catch (error) {
    console.error('Error eliminando receta:', error);
  }
}

export function filtrarRecetas(termBusqueda) {
  const tarjetas = document.querySelectorAll('#cuerpoRecetas .tarjetaReceta');
  const termino = termBusqueda.toLowerCase();
  
  tarjetas.forEach(tarjeta => {
    const nombre = tarjeta.querySelector('h3')?.textContent.toLowerCase() || '';
    if (nombre.includes(termino)) {
      tarjeta.style.display = '';
    } else {
      tarjeta.style.display = 'none';
    }
  });
}

export async function abrirProduccionRapida(idReceta, nombreReceta, costoPorPieza = 0) {
  document.getElementById('idRecetaProducir').value = idReceta;
  document.getElementById('nombreRecetaProducir').value = nombreReceta;
  document.getElementById('cantidadProducir').value = 1;
  document.getElementById('costoPorPiezaProducir').value = costoPorPieza;
  actualizarCostoProduccion();
  document.getElementById('precioVentaProducir').value = '';
  abrirModal('modalProduccionRapida');
}

export function actualizarCostoProduccion() {
  const costoPorPieza = parseFloat(document.getElementById('costoPorPiezaProducir').value) || 0;
  const cantidad = parseFloat(document.getElementById('cantidadProducir').value) || 0;
  const total = costoPorPieza * cantidad;
  document.getElementById('costoProducir').value = total.toFixed(2);
}

export async function producirDesdeReceta() {
  const nombreReceta = document.getElementById('nombreRecetaProducir').value;
  const idReceta = parseInt(document.getElementById('idRecetaProducir').value, 10);
  const cantidad = parseInt(document.getElementById('cantidadProducir').value);
  const costoProduccion = parseFloat(document.getElementById('costoProducir').value);
  const precioVenta = parseFloat(document.getElementById('precioVentaProducir').value);
  
  if (!nombreReceta || isNaN(cantidad) || cantidad <= 0 || isNaN(costoProduccion) || isNaN(precioVenta)) {
    mostrarNotificacion('Por favor completa todos los campos correctamente', 'error');
    return;
  }
  
  try {
    const respuesta = await fetch(`${API}/produccion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_receta: Number.isFinite(idReceta) ? idReceta : null,
        nombre_receta: nombreReceta,
        cantidad,
        costo_produccion: costoProduccion,
        precio_venta: precioVenta
      })
    });
    
    if (respuesta.ok) {
      cerrarModal('modalProduccionRapida');
      mostrarNotificacion('Producción registrada correctamente', 'exito');
      // activarPestana('produccion');
    }
  } catch (error) {
    console.error('Error registrando producción:', error);
    mostrarNotificacion('Error al registrar la producción', 'error');
  }
}

export async function abrirEscalarReceta(idReceta, nombreReceta, gramajeOriginal) {
  document.getElementById('idRecetaEscalar').value = idReceta;
  document.getElementById('gramajeOriginal').value = `${gramajeOriginal}g (${nombreReceta})`;
  document.getElementById('nuevoGramaje').value = '';
  abrirModal('modalEscalarReceta');
}

export async function copiarRecetaEscalada() {
  const idRecetaOriginal = document.getElementById('idRecetaEscalar').value;
  const nuevoGramaje = parseFloat(document.getElementById('nuevoGramaje').value);
  
  if (isNaN(nuevoGramaje) || nuevoGramaje <= 0) {
    mostrarNotificacion('Por favor ingresa un gramaje válido', 'error');
    return;
  }
  
  try {
    const respuesta = await fetch(`${API}/recetas/${idRecetaOriginal}`);
    const recetaOriginal = await respuesta.json();
    
    const gramajeOriginal = recetaOriginal.gramaje || 0;
    
    if (gramajeOriginal === 0) {
      mostrarNotificacion('La receta original no tiene gramaje definido', 'error');
      return;
    }
    
    const factor = nuevoGramaje / gramajeOriginal;
    
    const ingredientesEscalados = (recetaOriginal.ingredientes || []).map(ing => ({
      id_insumo: ing.id_insumo,
      cantidad: ing.cantidad * factor,
      unidad: ing.unidad
    }));
    
    const respuestaCrear = await fetch(`${API}/recetas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: `${recetaOriginal.nombre} (${nuevoGramaje}g)`,
        id_categoria: recetaOriginal.id_categoria,
        gramaje: nuevoGramaje,
        ingredientes: ingredientesEscalados
      })
    });
    
    if (respuestaCrear.ok) {
      cerrarModal('modalEscalarReceta');
      mostrarNotificacion(`Receta escalada creada correctamente (factor: ${factor.toFixed(2)}x)`, 'exito');
    }
  } catch (error) {
    console.error('Error escalando receta:', error);
    mostrarNotificacion('Error al escalar la receta', 'error');
  }
}
