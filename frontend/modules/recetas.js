let cargandoRecetas = false;
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
    // Obtener categorías y recetas
    const [respCategorias, respRecetas] = await Promise.all([
      fetch(`${API}/categorias`),
      fetch(`${API}/recetas`)
    ]);
    const categorias = await respCategorias.json();
    const recetas = await respRecetas.json();

    // Calcular conteos por categoría
    const conteoPorCategoria = {};
    let totalRecetas = 0;
    recetas.forEach(r => {
      if (r.id_categoria != null) {
        conteoPorCategoria[r.id_categoria] = (conteoPorCategoria[r.id_categoria] || 0) + 1;
      }
      totalRecetas++;
    });

    const contenedorRecetas = document.getElementById('pestanasCategoriasRecetas');
    if (contenedorRecetas) {
      contenedorRecetas.innerHTML = '';

      // Botón "Todas" con total
      const btnTodas = document.createElement('button');
      btnTodas.className = 'boton ' + (categoriaRecetaActual === null ? 'activo' : '');
      btnTodas.textContent = `📚 Todas (${totalRecetas})`;
      btnTodas.onclick = () => {
        // Si hay edición abierta, no recargar
        if (contenedorRecetas.querySelector('.inputCategoriaEditWrapper')) return;
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
        const count = conteoPorCategoria[cat.id] || 0;
        btn.textContent = `📁 ${cat.nombre} (${count})`;
        btn.onclick = () => {
          // Si hay edición abierta, no recargar
          if (contenedorRecetas.querySelector('.inputCategoriaEditWrapper')) return;
          categoriaRecetaActual = cat.id;
          cargarListadoRecetas();
          cargarPestanasCategorias();
        };

        // Menú contextual (click derecho)
        btn.oncontextmenu = (e) => {
          e.preventDefault();
          // Eliminar menú anterior si existe
          const oldMenu = document.getElementById('menuCategoriaContextual');
          if (oldMenu) oldMenu.remove();

          // Crear menú contextual
          const menu = document.createElement('div');
          menu.id = 'menuCategoriaContextual';
          menu.style.position = 'fixed';
          menu.style.zIndex = '9999';
          menu.style.background = '#fff';
          menu.style.border = '1px solid #aaa';
          menu.style.borderRadius = '8px';
          menu.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)';
          menu.style.padding = '6px 0';
          menu.style.minWidth = '120px';
          menu.style.fontSize = '13px';
          menu.style.left = `${e.clientX}px`;
          menu.style.top = `${e.clientY}px`;

          // Opción editar
          const itemEditar = document.createElement('div');
          itemEditar.textContent = '✏️ Editar nombre';
          itemEditar.style.padding = '6px 16px';
          itemEditar.style.cursor = 'pointer';
          itemEditar.onmouseover = () => itemEditar.style.background = '#f0f0f0';
          itemEditar.onmouseout = () => itemEditar.style.background = '';
          itemEditar.onclick = () => {
            menu.remove();
            // Mostrar input editable
            if (wrapper.querySelector('.inputCategoriaEditWrapper')) return;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = cat.nombre;
            input.className = 'inputCategoriaEdit';
            input.style.width = (cat.nombre.length + 6) + 'ch';
            input.style.fontSize = '11px';
            input.style.padding = '2px 28px 2px 6px';
            input.style.borderRadius = '10px';
            input.style.border = '1px solid #aaa';
            input.style.marginRight = '3px';
            input.style.outline = 'none';
            input.autocomplete = 'off';
            let original = cat.nombre;

            // Contenedor relativo para superponer botones
            const contenedorEdicion = document.createElement('span');
            contenedorEdicion.className = 'inputCategoriaEditWrapper';
            contenedorEdicion.style.position = 'relative';
            contenedorEdicion.style.display = 'inline-block';
            contenedorEdicion.appendChild(input);

            // Botón guardar (solo texto, sin fondo)
            const btnGuardar = document.createElement('button');
            btnGuardar.innerHTML = '✔️';
            btnGuardar.title = 'Guardar';
            btnGuardar.style.position = 'absolute';
            btnGuardar.style.right = '22px';
            btnGuardar.style.top = '50%';
            btnGuardar.style.transform = 'translateY(-50%)';
            btnGuardar.style.fontSize = '13px';
            btnGuardar.style.background = 'none';
            btnGuardar.style.color = '#4a9b5e';
            btnGuardar.style.border = 'none';
            btnGuardar.style.padding = '0';
            btnGuardar.style.cursor = 'pointer';
            btnGuardar.style.lineHeight = '1';
            btnGuardar.onclick = async (ev) => {
              ev.preventDefault();
              if (input.value.trim() && input.value.trim() !== original.trim()) {
                await guardarEdicionCategoria(cat.id, input.value, wrapper, btn, count);
                // Actualizar el texto del botón
                btn.textContent = `📁 ${input.value.trim()} (${count})`;
              }
              // Volver a la pestaña normal
              wrapper.replaceChild(btn, contenedorEdicion);
            };

            // Botón cancelar (solo texto, sin fondo)
            const btnCancelar = document.createElement('button');
            btnCancelar.innerHTML = '✖️';
            btnCancelar.title = 'Cancelar';
            btnCancelar.style.position = 'absolute';
            btnCancelar.style.right = '2px';
            btnCancelar.style.top = '50%';
            btnCancelar.style.transform = 'translateY(-50%)';
            btnCancelar.style.fontSize = '13px';
            btnCancelar.style.background = 'none';
            btnCancelar.style.color = '#d32f2f';
            btnCancelar.style.border = 'none';
            btnCancelar.style.padding = '0';
            btnCancelar.style.cursor = 'pointer';
            btnCancelar.style.lineHeight = '1';
            btnCancelar.onclick = (ev) => {
              ev.preventDefault();
              wrapper.replaceChild(btn, contenedorEdicion);
            };

            contenedorEdicion.appendChild(btnGuardar);
            contenedorEdicion.appendChild(btnCancelar);

            wrapper.replaceChild(contenedorEdicion, btn);
            setTimeout(() => {
              input.focus();
              input.select();
            }, 0);
          };

          // Opción eliminar
          const itemEliminar = document.createElement('div');
          itemEliminar.textContent = '🗑️ Eliminar categoría';
          itemEliminar.style.padding = '6px 16px';
          itemEliminar.style.cursor = 'pointer';
          itemEliminar.onmouseover = () => itemEliminar.style.background = '#f0f0f0';
          itemEliminar.onmouseout = () => itemEliminar.style.background = '';
          itemEliminar.onclick = () => {
            menu.remove();
            eliminarCategoria(cat.id, cat.nombre);
          };

          menu.appendChild(itemEditar);
          menu.appendChild(itemEliminar);
          document.body.appendChild(menu);

          // Cerrar menú contextual al hacer click fuera
          document.addEventListener('mousedown', function cerrarMenu(ev) {
            if (!menu.contains(ev.target)) {
              menu.remove();
              document.removeEventListener('mousedown', cerrarMenu);
            }
          });
        };

        // Botón eliminar más pequeño y mejor posicionado
        const btnEliminar = document.createElement('button');
        btnEliminar.className = 'btnEliminarCategoria';
        btnEliminar.textContent = '🗑️';
        btnEliminar.style.fontSize = '10px';
        btnEliminar.style.width = '16px';
        btnEliminar.style.height = '16px';
        btnEliminar.style.padding = '0 2px';
        btnEliminar.style.position = 'absolute';
        btnEliminar.style.right = '4px';
        btnEliminar.style.top = '50%';
        btnEliminar.style.transform = 'translateY(-50%)';
        btnEliminar.style.background = '#d32f2f';
        btnEliminar.style.color = 'white';
        btnEliminar.style.border = 'none';
        btnEliminar.style.display = 'flex';
        btnEliminar.style.alignItems = 'center';
        btnEliminar.style.justifyContent = 'center';
        btnEliminar.style.zIndex = '2';
        btnEliminar.onclick = (e) => {
          e.stopPropagation();
          eliminarCategoria(cat.id, cat.nombre);
        };

        wrapper.appendChild(btn);
        // Eliminar botón eliminar de la pestaña
        wrapper.style.position = 'relative';
        contenedorRecetas.appendChild(wrapper);
      });
    // Función auxiliar para guardar edición de nombre de categoría
    async function guardarEdicionCategoria(idCategoria, nuevoNombre, wrapper, btn, count) {
      const nombreLimpio = (nuevoNombre || '').trim();
      if (!nombreLimpio) {
        window.mostrarNotificacion('El nombre no puede estar vacío', 'error');
        return;
      }
      try {
        const resp = await fetch(`${API}/categorias/${idCategoria}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: nombreLimpio })
        });
        if (resp.ok) {
          // Actualizar el placeholder y valor del input, pero NO reemplazar el input por el botón
          const input = wrapper.querySelector('input');
          if (input) {
            input.value = nombreLimpio;
            input.placeholder = nombreLimpio;
            // Opcional: feedback visual
            input.style.background = '#eaffea';
            setTimeout(() => { input.style.background = ''; }, 600);
          }
          window.mostrarNotificacion('Nombre de categoría actualizado', 'exito');
        } else {
          window.mostrarNotificacion('Error al actualizar la categoría', 'error');
        }
      } catch (e) {
        window.mostrarNotificacion('Error de conexión', 'error');
      }
    }
    }
  } catch (error) {
    console.error('Error cargando pestañas de categorías:', error);
  }
}

export async function cargarListadoRecetas() {
  if (cargandoRecetas) {
    // Evitar duplicación silenciosamente
    return;
  }
  cargandoRecetas = true;
  try {
    let url = `${API}/recetas`;
    if (categoriaRecetaActual !== null) {
      url += `?categoria=${categoriaRecetaActual}`;
    }
    const respuesta = await fetch(url);
    const recetas = await respuesta.json();
    const cuerpo = document.getElementById('cuerpoRecetas');
    if (!cuerpo) {
      console.error('❌ No se encontró elemento #cuerpoRecetas');
      cargandoRecetas = false;
      return;
    }
    cuerpo.innerHTML = '';
    if (recetas.length === 0) {
      cuerpo.innerHTML = '<div style="text-align:center;padding:30px;color:#999">No hay recetas</div>';
      cargandoRecetas = false;
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
          } else if (unidad === 'l') {
            totalMililitros += cantidad * 1000;
          } else if (unidad === 'ml') {
            totalMililitros += cantidad;
          } else if (unidad === 'gotas') {
            // Cada 10 Gotas = 0.5 ml y 0.5 g
            totalMililitros += (cantidad / 10) * 0.5;
            totalGramos += (cantidad / 10) * 0.5;
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
        // Detectar pendientes
        let hayPendientes = false;
        (detalleReceta.ingredientes || []).forEach(ing => {
          if (ing.pendiente === true || ing.pendiente === 1) hayPendientes = true;
        });
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjetaReceta';
        tarjeta.innerHTML = `
          <div style="padding:18px">
            ${hayPendientes ? '<div style="color:#d32f2f;font-size:12px;margin-bottom:6px;display:flex;align-items:center;gap:4px"><span style="font-size:15px">⚠️</span> Faltan ingredientes por comprar</div>' : ''}
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
    console.error('❌ Error en cargarListadoRecetas:', error);
  }
  cargandoRecetas = false;
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
      // Limpiar formulario y todos los campos del modal
      document.getElementById('formularioReceta').reset();
      ingredientesTemporales = [];
      actualizarTablaIngredientes();
      // Limpiar campos de insumo manualmente por si quedan residuos
      const campos = [
        'insumoSeleccionado',
        'idInsumoSeleccionado',
        'cantidadIngrediente',
        'unidadIngrediente',
        'listaBusquedaInsumos'
      ];
      campos.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          if (el.tagName === 'INPUT' || el.tagName === 'SELECT') el.value = '';
          if (el.tagName === 'SELECT') el.disabled = true;
          if (el.tagName === 'DIV') el.innerHTML = '';
        }
      });
      cerrarModal('modalReceta');
      mostrarNotificacion('Receta creada correctamente', 'exito');
      // Recargar la lista de recetas al instante, sin duplicar
      await cargarListadoRecetas();
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
    // Forzar regeneración de opciones de unidad en edición
    if (esEdicion) {
      const unidadSelect = document.getElementById('editUnidadIngrediente');
      unidadSelect.innerHTML = `
        <option value="">Seleccionar</option>
        <option value="g">Gramos (g)</option>
        <option value="ml">Mililitros (ml)</option>
        <option value="kg">Kilogramos (kg)</option>
        <option value="l">Litros (l)</option>
        <option value="pz">Piezas (pz)</option>
        <option value="cda">Cucharadas (cda)</option>
        <option value="cdta">Cucharaditas (cdta)</option>
        <option value="taza">Tazas</option>
        <option value="oz">Onzas (oz)</option>
        <option value="Gotas">Gotas</option>
      `;
    }
    return;
  }
  
  try {
    const respuesta = await fetch(`${API}/inventario?busqueda=${encodeURIComponent(termino)}`);
    const insumos = await respuesta.json();
    listaBusqueda.innerHTML = '';
    listaBusqueda.style.display = 'block';

    let encontrado = false;
    insumos.forEach(insumo => {
      encontrado = true;
      const opcion = document.createElement('div');
      opcion.className = 'elementoSugerencia';
      // Mostrar la unidad abreviada en la sugerencia
      let unidadMostrar = '';
      if (insumo.unidad) {
        const u = insumo.unidad.toLowerCase();
        if (u === 'gotas') unidadMostrar = 'go';
        else if (u === 'ml') unidadMostrar = 'ml';
        else if (u === 'g') unidadMostrar = 'g';
        else if (u === 'kg') unidadMostrar = 'kg';
        else if (u === 'l') unidadMostrar = 'l';
        else if (u === 'pz') unidadMostrar = 'pz';
        else if (u === 'cda') unidadMostrar = 'cda';
        else if (u === 'cdta') unidadMostrar = 'cdta';
        else if (u === 'taza') unidadMostrar = 'taza';
        else if (u === 'oz') unidadMostrar = 'oz';
        else unidadMostrar = u;
      }
      opcion.textContent = `${insumo.nombre} (${insumo.codigo}${unidadMostrar ? ' • ' + unidadMostrar : ''})`;
      opcion.onclick = () => {
        document.getElementById(idInsumoInput).value = insumo.nombre;
        document.getElementById(idInsumoId).value = insumo.id;
        const idUnidadField = esEdicion ? 'editUnidadIngrediente' : 'unidadIngrediente';
        const unidadSelect = document.getElementById(idUnidadField);
        // Seleccionar correctamente la opción de gotas (go)
        if (insumo.unidad && insumo.unidad.toLowerCase() === 'gotas') {
          // Buscar la opción que contenga 'Gotas' y seleccionarla
          let found = false;
          for (let i = 0; i < unidadSelect.options.length; i++) {
            if (unidadSelect.options[i].value.toLowerCase() === 'gotas' || unidadSelect.options[i].textContent.toLowerCase().includes('gotas')) {
              unidadSelect.selectedIndex = i;
              found = true;
              break;
            }
          }
          if (!found) unidadSelect.value = 'gotas';
        } else {
          unidadSelect.value = insumo.unidad || '';
        }
        unidadSelect.disabled = true;
        listaBusqueda.innerHTML = '';
        listaBusqueda.style.display = 'none';
        // Foco automático a cantidad solo en modal de nueva receta
        if (!esEdicion) {
          setTimeout(() => {
            const cantidadInput = document.getElementById('cantidadIngrediente');
            if (cantidadInput) cantidadInput.focus();
          }, 50);
        }
      };
      listaBusqueda.appendChild(opcion);
    });

    if (!encontrado) {
      // Si no existe, mostrar opción para agregar como pendiente
      const opcionPendiente = document.createElement('div');
      opcionPendiente.className = 'elementoSugerencia elementoPendiente';
      opcionPendiente.style.color = 'red';
      opcionPendiente.textContent = `➕ Agregar "${termino}" como insumo pendiente`;
      opcionPendiente.onclick = async () => {
        // Crear insumo pendiente en inventario
        const resp = await fetch(`${API}/inventario/agregar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: termino, pendiente: true })
        });
        if (resp.ok) {
          const data = await resp.json();
          document.getElementById(idInsumoInput).value = termino;
          document.getElementById(idInsumoId).value = data.id;
          const idUnidadField = esEdicion ? 'editUnidadIngrediente' : 'unidadIngrediente';
          const unidadSelect = document.getElementById(idUnidadField);
          unidadSelect.value = '';
          unidadSelect.disabled = false;
          listaBusqueda.innerHTML = '';
          listaBusqueda.style.display = 'none';
          // Notificación persistente en campanita
          if (window.agregarAlerta) {
            window.agregarAlerta(`pendiente:${data.id}`, `Insumo pendiente: ${termino}`, 'advertencia');
          }
        } else {
          mostrarNotificacion('Error al crear insumo pendiente', 'error');
        }
      };
      listaBusqueda.appendChild(opcionPendiente);
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
  
  // Buscar si el insumo es pendiente en el inventario global (si existe en DOM)
  let pendiente = false;
  const inventario = window.inventario && window.inventario.ultimoInventario;
  if (inventario && Array.isArray(inventario)) {
    const ins = inventario.find(i => i.id === idInsumo);
    if (ins && (ins.pendiente === true || ins.pendiente === 1)) pendiente = true;
  }
  ingredientesTemporales.push({
    id_insumo: idInsumo,
    nombre: nombreInsumo,
    cantidad,
    unidad,
    pendiente
  });
  
  
  document.getElementById(idFieldId).value = '';
  document.getElementById(nombreFieldId).value = '';
  document.getElementById(cantidadFieldId).value = '';
  document.getElementById(unidadFieldId).value = '';
  document.getElementById(unidadFieldId).disabled = true;
  
  actualizarTablaIngredientes();
  // Después de agregar, enfocar de nuevo a código/ingrediente solo en modal de nueva receta
  if (!esEdicion) {
    setTimeout(() => {
      const insumoInput = document.getElementById('insumoSeleccionado');
      if (insumoInput) insumoInput.focus();
    }, 50);
  }
// --- Eventos para foco y enter en modal de nueva receta ---
if (typeof window !== 'undefined') {
  function setearEventosIngredienteModal() {
    const cantidadInput = document.getElementById('cantidadIngrediente');
    if (cantidadInput) {
      cantidadInput.onkeydown = null;
      cantidadInput.addEventListener('keydown', function handlerCantidad(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          window.agregarIngrediente();
        }
      }, { once: false });
    }
    const insumoInput = document.getElementById('insumoSeleccionado');
    if (insumoInput) {
      insumoInput.onkeydown = null;
      insumoInput.addEventListener('keydown', function handlerInsumo(e) {
        if (e.key === 'Enter') {
          const lista = document.getElementById('listaBusquedaInsumos');
          if (lista && lista.firstChild) {
            lista.firstChild.click();
            e.preventDefault();
          }
        }
      }, { once: false });
    }
    // Prevenir submit por Enter en cualquier campo del modal
    const form = document.getElementById('formularioReceta');
    if (form) {
      form.onkeydown = function(e) {
        // Si el foco está en cantidad y se presiona Enter, ya lo maneja el handler de cantidad
        // Si el foco está en otro campo y se presiona Enter, prevenir submit
        if (e.key === 'Enter') {
          const active = document.activeElement;
          if (active && active.id !== 'cantidadIngrediente') {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      };
    }
  }
  window.addEventListener('DOMContentLoaded', setearEventosIngredienteModal);
  // También al abrir el modal de receta, para asegurar que los campos existen
  if (window.abrirModal) {
    const originalAbrirModal = window.abrirModal;
    window.abrirModal = function(id) {
      originalAbrirModal.apply(this, arguments);
      if (id === 'modalReceta') setTimeout(setearEventosIngredienteModal, 50);
    };
  }
}
}

export function eliminarIngrediente(indice) {
  ingredientesTemporales.splice(indice, 1);
  actualizarTablaIngredientes();
}

export function actualizarTablaIngredientes() {
  const tabla = document.getElementById('tablaIngredientesTemporales');
  const editTabla = document.getElementById('editTablaIngredientesTemporales');
  function getAbrev(unidad) {
    if (!unidad) return '';
    const u = unidad.toLowerCase();
    if (u === 'gotas') return 'go';
    if (u === 'ml') return 'ml';
    if (u === 'g') return 'g';
    if (u === 'kg') return 'kg';
    if (u === 'l') return 'l';
    if (u === 'pz') return 'pz';
    if (u === 'cda') return 'cda';
    if (u === 'cdta') return 'cdta';
    if (u === 'taza') return 'taza';
    if (u === 'oz') return 'oz';
    return u;
  }
  if (tabla) {
    tabla.innerHTML = '';
    ingredientesTemporales.forEach((ing, idx) => {
      const fila = document.createElement('tr');
      const pendiente = ing.pendiente === true || ing.pendiente === 1;
      if (pendiente) fila.style.color = '#d32f2f';
      fila.innerHTML = `
        <td>${ing.nombre}</td>
        <td>${parseFloat(ing.cantidad).toFixed(2)} ${getAbrev(ing.unidad)}</td>
        <td><button onclick="window.recetas.eliminarIngrediente(${idx})" class="botonPequeno botonDanger">×</button></td>
      `;
      tabla.appendChild(fila);
    });
  }
  if (editTabla) {
    editTabla.innerHTML = '';
    ingredientesTemporales.forEach((ing, idx) => {
      const fila = document.createElement('tr');
      const pendiente = ing.pendiente === true || ing.pendiente === 1;
      if (pendiente) fila.style.color = '#d32f2f';
      fila.innerHTML = `
        <td>${ing.nombre}</td>
        <td>${parseFloat(ing.cantidad).toFixed(2)} ${getAbrev(ing.unidad)}</td>
        <td><button onclick="window.recetas.eliminarIngrediente(${idx})" class="botonPequeno botonDanger">×</button></td>
      `;
      editTabla.appendChild(fila);
    });
  }
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
    let hayPendientes = false;
    if (!receta.ingredientes || receta.ingredientes.length === 0) {
      html += '<li style="padding:10px;color:#999">Sin ingredientes agregados</li>';
    } else {
      receta.ingredientes.forEach((ing, idx) => {
        let abrev = '';
        if (ing.unidad) {
          const u = ing.unidad.toLowerCase();
          if (u === 'gota' || u === 'gotas') abrev = 'go';
          else if (u === 'ml') abrev = 'ml';
          else if (u === 'g') abrev = 'g';
          else if (u === 'kg') abrev = 'kg';
          else if (u === 'l') abrev = 'l';
          else if (u === 'pz') abrev = 'pz';
          else if (u === 'cda') abrev = 'cda';
          else if (u === 'cdta') abrev = 'cdta';
          else if (u === 'taza') abrev = 'taza';
          else if (u === 'oz') abrev = 'oz';
          else abrev = u;
        }
        // Resaltar en rojo si es pendiente
        const pendiente = ing.pendiente === true || ing.pendiente === 1;
        if (pendiente) hayPendientes = true;
        html += `<li style="padding:8px;background:#f5f5f5;margin-bottom:6px;border-radius:6px;border-left:4px solid ${pendiente ? '#d32f2f' : '#4a9b5e'};display:flex;justify-content:space-between;align-items:center;gap:8px${pendiente ? ';color:#d32f2f;font-weight:bold' : ''}">
          <span style="flex:1;font-size:13px">${ing.nombre}</span>
          <input type="number" id="cantidad_${ing.id}" value="${parseFloat(ing.cantidad).toFixed(2)}" step="0.01" style="width:70px;padding:4px;border:1px solid #ddd;border-radius:4px;text-align:center;font-size:12px">
          <span style="min-width:35px;font-size:12px">${abrev}</span>
          <div style="display:flex;gap:4px">
            <button onclick="window.recetas.guardarCantidadIngrediente(${idReceta}, ${ing.id})" class="botonPequeno" style="background:#4a9b5e;padding:4px 10px">💾</button>
            <button onclick="window.recetas.eliminarIngredienteDeReceta(${idReceta}, ${ing.id}, '${ing.nombre.replace(/'/g, "\\'")}")" class="botonPequeno botonDanger" style="padding:4px 10px">×</button>
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
      unidad: ing.unidad,
      pendiente: ing.pendiente === true || ing.pendiente === 1
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
