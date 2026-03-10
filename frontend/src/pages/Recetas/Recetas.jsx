import React, { useEffect } from 'react';
import './Recetas.css';
import { mostrarNotificacion } from '../../utils/notificaciones.jsx';
import { abrirModal, cerrarModal, mostrarConfirmacion } from '../../utils/modales.jsx';
import { API } from '../../utils/config.jsx';
import { normalizarTextoBusqueda } from '../../utils/texto.jsx';

function escaparParaInlineJs(valor) {
  return String(valor || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/[\u2028\u2029]/g, ' ')
    .replace(/\r?\n/g, ' ');
}

export default function Recetas() {
  useEffect(() => {
    window.recetas = {
      cargarCategorias,
      agregarCategoria,
      eliminarCategoria,
      editarCategoria,
      cargarPestanasCategorias,
      cargarListadoRecetas,
      guardarReceta,
      agregarReceta,
      editarReceta,
      guardarEditarReceta,
      eliminarReceta,
      filtrarRecetas,
      buscarInsumoParaReceta,
      agregarIngrediente,
      eliminarIngrediente,
      actualizarTablaIngredientes,
      mostrarIngredientes,
      guardarCantidadIngrediente,
      eliminarIngredienteDeReceta,
      abrirProduccionRapida,
      actualizarCostoProduccion,
      producirDesdeReceta,
      abrirEscalarReceta,
      copiarRecetaEscalada,
      abrirModalEscaladoCategoria,
      cargarRecetasEscaladoCategoria,
      copiarRecetasEscaladoCategoria,
      abrirModalArchivadoRecetas,
      cambiarPestanaArchivado,
      cargarRecetasArchivado,
      cargarRecetasArchivadas,
      archivarReceta,
      archivarRecetasSeleccionadas,
      desarchivarRecetasSeleccionadas,
      mostrarMenuCategoria,
      editarCategoriaDesdeMenu,
      eliminarCategoriaDesdeMenu
      ,cambiarSubpestanaRecetas
      ,abrirFichaTiendaReceta
      ,guardarFichaTiendaReceta
      ,agregarImagenesFichaTiendaDesdeInput
      ,abrirSelectorImagenFichaTienda
      ,quitarImagenGaleriaTienda
      ,moverImagenGaleriaTienda
      ,iniciarArrastreImagenGaleria
      ,soltarImagenGaleria
      ,permitirDropImagenGaleria
      ,cambiarVisibleRecetaTienda
      ,toggleIngredienteTiendaVisible
      ,cargarPaquetesRecetas
      ,abrirModalNuevoPaquete
      ,editarPaqueteReceta
      ,eliminarPaqueteReceta
      ,guardarPaqueteReceta
      ,agregarItemPaqueteTemporal
      ,quitarItemPaqueteTemporal
      ,abrirDetallePaqueteReceta
      ,abrirProduccionPaquete
      ,producirDesdePaquete
      ,renderResumenProduccionPaquete
      ,cambiarVisiblePaqueteReceta
      ,abrirAjustesProduccion
      ,guardarAjustesProduccion
      ,abrirFichaTiendaPaquete
    };

    setTimeout(() => {
      document.querySelectorAll('input, select, textarea').forEach((campo) => {
        if (!campo) return;
        if (!campo.getAttribute('name') && campo.id) {
          campo.setAttribute('name', campo.id);
        }
      });
    }, 0);

    window.agregarIngrediente = () => agregarIngrediente(false);

    cargarCategorias();
    cargarPestanasCategorias();
    cargarListadoRecetas();
    cargarPaquetesRecetas();
    cargarAjustesProduccion();
    cambiarSubpestanaRecetas('recetas');

    let timerRefrescoTiempoReal = null;
    const tiposRefrescar = new Set([
      'recetas_actualizado',
      'produccion_actualizado',
      'inventario_actualizado'
    ]);
    const onRealtime = (event) => {
      const tipo = String(event?.detail?.tipo || '').trim();
      if (!tiposRefrescar.has(tipo)) return;
      if (timerRefrescoTiempoReal) clearTimeout(timerRefrescoTiempoReal);
      timerRefrescoTiempoReal = setTimeout(() => {
        cargarListadoRecetas();
      }, 120);
    };
    window.addEventListener('chipactli:realtime', onRealtime);

    const onDocClick = (event) => {
      const menu = document.getElementById('menuCategoriaRecetas');
      if (!menu) return;
      if (!menu.contains(event.target)) {
        ocultarMenuCategoria();
      }
    };

    const onEsc = (event) => {
      if (event.key === 'Escape') ocultarMenuCategoria();
    };

    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onEsc);

    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('chipactli:realtime', onRealtime);
      if (timerRefrescoTiempoReal) clearTimeout(timerRefrescoTiempoReal);
    };
  }, []);

  return (
    <div className="tarjeta">
      <div className="encabezadoTarjeta">
        <h2>Gestión de Recetas</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="boton" onClick={() => abrirAjustesProduccion()}>% Producción</button>
          <button className="boton" onClick={() => abrirModalNuevoPaquete()}>📦 Nuevo Paquete</button>
          <button className="boton" onClick={() => abrirModalEscaladoCategoria()}>📋 Escalar por categoría</button>
          <button className="boton" onClick={() => abrirModalArchivadoRecetas()}>🗂️ Archivar recetas</button>
          <button className="boton" onClick={() => abrirModal('modalCategoria')}>➕ Nueva Categoría</button>
          <button className="boton" onClick={() => abrirModalNuevaReceta()}>➥ Nueva Receta</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
        <input type="text" className="cajaBusqueda" id="busquedaRecetas" placeholder="🔍 Buscar receta..." onChange={e => filtrarRecetas(e.target.value)} style={{ width: '220px' }} />
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <button id="btnSubTabRecetas" className="boton activo" onClick={() => cambiarSubpestanaRecetas('recetas')}>Recetas</button>
        <button id="btnSubTabPaquetes" className="boton" onClick={() => cambiarSubpestanaRecetas('paquetes')}>Paquetes</button>
      </div>

      <div id="panelSubpestanaRecetas">
        <div id="pestanasCategoriasRecetas" style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '15px', position: 'relative', overflow: 'visible' }}></div>
        <div id="cuerpoRecetas" className="gridRecetas"></div>
      </div>

      <div id="panelSubpestanaPaquetes" style={{ display: 'none' }}>
        <div id="cuerpoPaquetesRecetas" className="gridRecetas"></div>
      </div>

      <div id="modalCategoria" className="modal" onClick={() => cerrarModal('modalCategoria')}>
        <div className="contenidoModal" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal"><h3>Nueva Categoría</h3><button className="cerrarModal" onClick={() => cerrarModal('modalCategoria')}>&times;</button></div>
          <form onSubmit={agregarCategoria} className="cajaFormulario">
            <input id="nombreCategoria" type="text" placeholder="Nombre de categoría" required />
            <button className="boton botonExito" type="submit">Guardar</button>
          </form>
        </div>
      </div>

      <div id="modalReceta" className="modal" onClick={() => cerrarModalNuevaReceta()}>
        <div className="contenidoModal" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal"><h3>Nueva Receta</h3><button className="cerrarModal" onClick={() => cerrarModalNuevaReceta()}>&times;</button></div>
          <form id="formularioReceta" onSubmit={guardarReceta} className="cajaFormulario">
            <div className="recetaFilaDatosPrincipales">
              <input id="nombreReceta" type="text" placeholder="Nombre de receta" required onKeyDown={(e) => manejarEnterModalReceta(e, 'nombre', false)} />
              <select id="categoriaReceta" required onKeyDown={(e) => manejarEnterModalReceta(e, 'categoria', false)}></select>
              <input id="gramajeReceta" type="number" step="0.01" min="0" placeholder="Gramaje (opcional)" onKeyDown={(e) => manejarEnterModalReceta(e, 'gramaje', false)} />
            </div>
            <div className="recetaFilaInsumo">
              <div className="recetaBusquedaInsumoWrap">
                <input id="insumoSeleccionado" type="text" placeholder="Buscar insumo..." onChange={e => buscarInsumoParaReceta(e.target.value)} onKeyDown={(e) => manejarEnterModalReceta(e, 'busqueda', false)} autoComplete="off" />
                <input id="idInsumoSeleccionado" type="hidden" />
                <div id="listaBusquedaInsumos"></div>
              </div>
              <input id="cantidadIngrediente" type="number" step="0.01" placeholder="Cantidad" onKeyDown={(e) => manejarEnterModalReceta(e, 'cantidad', false)} />
              <select id="unidadIngrediente" disabled>
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
                <option value="gotas">Gotas (go)</option>
              </select>
              <input id="proveedorIngrediente" type="text" placeholder="Proveedor (opcional)" onKeyDown={(e) => manejarEnterModalReceta(e, 'proveedor', false)} />
              <button type="button" className="boton" onClick={() => agregarIngrediente(false)}>+ Ing.</button>
            </div>
            <table>
              <thead><tr><th>Ingrediente</th><th>Proveedor</th><th>Cantidad</th><th></th></tr></thead>
              <tbody id="tablaIngredientesTemporales"></tbody>
            </table>
            <button className="boton botonExito" type="submit">Guardar</button>
          </form>
        </div>
      </div>

      <div id="modalEditarReceta" className="modal" onClick={() => cerrarModal('modalEditarReceta')}>
        <div className="contenidoModal" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal"><h3>Editar Receta</h3><button className="cerrarModal" onClick={() => cerrarModal('modalEditarReceta')}>&times;</button></div>
          <form onSubmit={guardarEditarReceta} className="cajaFormulario">
            <input id="idEditReceta" type="hidden" />
            <div className="recetaFilaDatosPrincipales">
              <input id="editNombreReceta" type="text" required onKeyDown={(e) => manejarEnterModalReceta(e, 'nombre', true)} />
              <select id="editCategoriaReceta" required onKeyDown={(e) => manejarEnterModalReceta(e, 'categoria', true)}></select>
              <input id="editGramajeReceta" type="number" step="0.01" min="0" onKeyDown={(e) => manejarEnterModalReceta(e, 'gramaje', true)} />
            </div>
            <div className="recetaFilaInsumo">
              <div className="recetaBusquedaInsumoWrap">
                <input id="editInsumoSeleccionado" type="text" placeholder="Buscar insumo..." onChange={e => buscarInsumoParaReceta(e.target.value)} onKeyDown={(e) => manejarEnterModalReceta(e, 'busqueda', true)} autoComplete="off" />
                <input id="editIdInsumoSeleccionado" type="hidden" />
                <div id="editListaBusquedaInsumos"></div>
              </div>
              <input id="editCantidadIngrediente" type="number" step="0.01" placeholder="Cantidad" onKeyDown={(e) => manejarEnterModalReceta(e, 'cantidad', true)} />
              <select id="editUnidadIngrediente" disabled>
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
                <option value="gotas">Gotas (go)</option>
              </select>
              <input id="editProveedorIngrediente" type="text" placeholder="Proveedor (opcional)" onKeyDown={(e) => manejarEnterModalReceta(e, 'proveedor', true)} />
              <button type="button" className="boton" onClick={() => agregarIngrediente(true)}>+ Ing.</button>
            </div>
            <table>
              <thead><tr><th>Ingrediente</th><th>Proveedor</th><th>Cantidad</th><th></th></tr></thead>
              <tbody id="editTablaIngredientesTemporales"></tbody>
            </table>
            <button className="boton botonExito" type="submit">Guardar cambios</button>
          </form>
        </div>
      </div>

      <div id="modalIngredientes" className="modal" onClick={() => cerrarModal('modalIngredientes')}>
        <div className="contenidoModal" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal"><h3>Ingredientes de receta</h3><button className="cerrarModal" onClick={() => cerrarModal('modalIngredientes')}>&times;</button></div>
          <div id="detallesIngredientes"></div>
        </div>
      </div>

      <div id="modalFichaTiendaReceta" className="modal" onClick={() => cerrarModal('modalFichaTiendaReceta')}>
        <div className="contenidoModal modalFichaTiendaCompacta" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal"><h3 id="tituloModalFichaTienda">Ficha para tienda</h3><button className="cerrarModal" onClick={() => cerrarModal('modalFichaTiendaReceta')}>&times;</button></div>
          <div className="cajaFormulario fichaTiendaFormularioCompacta">
            <input id="fichaTiendaNombreReceta" type="text" readOnly />
            <div id="fichaTiendaPrecioWrap">
              <label htmlFor="fichaTiendaPrecioPublico">Precio público (opcional)</label>
              <input id="fichaTiendaPrecioPublico" type="number" min="0" step="0.01" placeholder="Ej. 120" />
            </div>
            <label className="fichaSpan2" htmlFor="fichaTiendaImagenes">Imágenes del producto (la primera será la principal)</label>
            <input
              id="fichaTiendaImagenes"
              className="fichaSpan2"
              type="file"
              accept="image/*"
              multiple
              onChange={() => agregarImagenesFichaTiendaDesdeInput()}
            />
            <button className="boton fichaSpan2" type="button" onClick={() => abrirSelectorImagenFichaTienda()}>
              + Agregar otra imagen
            </button>
            <div id="fichaTiendaGaleria" className="fichaTiendaGaleria fichaSpan2"></div>
            <textarea id="fichaTiendaDescripcion" className="fichaSpan2" rows="2" placeholder="Descripción (se comparte entre variantes)"></textarea>
            <textarea id="fichaTiendaModoUso" rows="4" placeholder="Modo de uso"></textarea>
            <textarea id="fichaTiendaCuidados" rows="4" placeholder="Cuidados del producto"></textarea>
            <div id="fichaTiendaIngredientesWrap" className="fichaSpan2 fichaIngredientesBloque">
              <div>Ingredientes para tienda</div>
              <div id="fichaTiendaListaIngredientes" className="fichaTiendaListaIngredientes"></div>
            </div>
            <button className="boton botonExito fichaSpan2" type="button" onClick={() => guardarFichaTiendaReceta()}>Guardar ficha tienda</button>
          </div>
        </div>
      </div>

      <div id="modalProduccionRapida" className="modal" onClick={() => cerrarModal('modalProduccionRapida')}>
        <div className="contenidoModal" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal"><h3>Producción rápida</h3><button className="cerrarModal" onClick={() => cerrarModal('modalProduccionRapida')}>&times;</button></div>
          <div className="cajaFormulario formularioProduccionRapida">
            <input id="idRecetaProducir" type="hidden" />
            <div className="filaProduccionRapida filaProduccionRapidaTop">
              <div>
                <label htmlFor="nombreRecetaProducir">Receta</label>
                <input id="nombreRecetaProducir" type="text" readOnly />
              </div>
              <div>
                <label htmlFor="cantidadProducir">Cantidad</label>
                <input id="cantidadProducir" type="number" min="1" defaultValue="1" onChange={actualizarCostoProduccion} />
              </div>
              <div>
                <label htmlFor="costoPorPiezaProducir">Costo por pieza</label>
                <input id="costoPorPiezaProducir" type="number" step="0.01" onChange={actualizarCostoProduccion} onBlur={normalizarCostoPorPieza} />
              </div>
            </div>
            <div className="filaProduccionRapida filaProduccionRapidaBottom">
              <div>
                <label htmlFor="costoProducir">Costo producción</label>
                <input id="costoProducir" type="number" step="0.01" readOnly />
              </div>
              <div>
                <label htmlFor="precioVentaProducir">Precio venta</label>
                <input id="precioVentaProducir" type="number" step="0.01" />
              </div>
              <button className="boton botonExito" onClick={() => producirDesdeReceta()}>Registrar producción</button>
            </div>
          </div>
        </div>
      </div>

      <div id="modalProduccionPaquete" className="modal" onClick={() => cerrarModal('modalProduccionPaquete')}>
        <div className="contenidoModal" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal"><h3>Producción de paquete</h3><button className="cerrarModal" onClick={() => cerrarModal('modalProduccionPaquete')}>&times;</button></div>
          <div className="cajaFormulario">
            <input id="idPaqueteProducir" type="hidden" />
            <label htmlFor="nombrePaqueteProducir">Paquete</label>
            <input id="nombrePaqueteProducir" type="text" readOnly />
            <label htmlFor="cantidadPaqueteProducir">Cantidad de paquetes</label>
            <input id="cantidadPaqueteProducir" type="number" min="1" step="1" defaultValue="1" onChange={() => renderResumenProduccionPaquete()} />
            <div id="resumenProduccionPaquete" className="fichaIngredientesBloque" style={{ marginTop: '8px' }}></div>
            <button className="boton botonExito" type="button" onClick={() => producirDesdePaquete()}>Registrar producción del paquete</button>
          </div>
        </div>
      </div>

      <div id="modalEscalarReceta" className="modal" onClick={() => cerrarModal('modalEscalarReceta')}>
        <div className="contenidoModal" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal"><h3>Copiar receta escalada</h3><button className="cerrarModal" onClick={() => cerrarModal('modalEscalarReceta')}>&times;</button></div>
          <div className="cajaFormulario">
            <input id="idRecetaEscalar" type="hidden" />
            <label htmlFor="gramajeOriginal">Receta base</label>
            <input id="gramajeOriginal" type="text" readOnly />
            <label htmlFor="nuevoGramaje">Nuevo gramaje</label>
            <input id="nuevoGramaje" type="number" step="0.01" min="0.01" placeholder="Ej. 250" />
            <button className="boton botonExito" onClick={() => copiarRecetaEscalada()}>Crear copia</button>
          </div>
        </div>
      </div>

      <div id="modalEscaladoCategoria" className="modal" onClick={() => cerrarModal('modalEscaladoCategoria')}>
        <div className="contenidoModal" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal"><h3>Escalado masivo por categoría</h3><button className="cerrarModal" onClick={() => cerrarModal('modalEscaladoCategoria')}>&times;</button></div>
          <div className="cajaFormulario">
            <div className="filaFormulario filaFormulario-NombreCategoria">
              <select id="categoriaEscaladoCategoria" onChange={() => cargarRecetasEscaladoCategoria()}></select>
              <input id="nuevoGramajeEscaladoCategoria" type="number" min="0.01" step="0.01" placeholder="Nuevo gramaje" />
            </div>
            <label className="selectorTodasEscalado">
              <span className="selectorTodasEscaladoTexto">Seleccionar todas</span>
              <span className="switchMini">
                <input id="seleccionarTodasEscalado" type="checkbox" onChange={toggleSeleccionTodasEscalado} />
                <span className="switchMiniSlider"></span>
              </span>
            </label>
            <div id="listaRecetasEscaladoCategoria" className="listaRecetasEscaladoCategoria"></div>
            <button className="boton botonExito" onClick={() => copiarRecetasEscaladoCategoria()}>Crear copias escaladas</button>
          </div>
        </div>
      </div>

      <div id="modalArchivarRecetas" className="modal" onClick={() => cerrarModal('modalArchivarRecetas')}>
        <div className="contenidoModal" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal"><h3>Archivar recetas</h3><button className="cerrarModal" onClick={() => cerrarModal('modalArchivarRecetas')}>&times;</button></div>
          <div className="cajaFormulario">
            <div className="tabsArchivadoRecetas">
              <button id="tabArchivarRecetas" type="button" className="boton" onClick={() => cambiarPestanaArchivado('archivar')}>Archivar</button>
              <button id="tabArchivadasRecetas" type="button" className="boton" onClick={() => cambiarPestanaArchivado('archivadas')}>Archivadas</button>
            </div>

            <div className="filtrosArchivadoRecetas">
              <select id="categoriaArchivadoRecetas" onChange={() => {
                if (tabArchivadoActiva === 'archivar') cargarRecetasArchivado();
                else cargarRecetasArchivadas();
              }}></select>
              <input id="busquedaArchivadoRecetas" type="text" placeholder="Buscar receta..." onChange={() => {
                if (tabArchivadoActiva === 'archivar') cargarRecetasArchivado();
                else cargarRecetasArchivadas();
              }} />
            </div>

            <div id="panelArchivarRecetas">
              <label className="selectorTodasEscalado">
                <span className="selectorTodasEscaladoTexto">Seleccionar todas</span>
                <span className="switchMini">
                  <input id="seleccionarTodasArchivar" type="checkbox" onChange={toggleSeleccionTodasArchivar} />
                  <span className="switchMiniSlider"></span>
                </span>
              </label>
              <div id="listaRecetasArchivar" className="listaRecetasEscaladoCategoria"></div>
              <button className="boton botonExito" onClick={() => archivarRecetasSeleccionadas()}>Archivar seleccionadas</button>
            </div>

            <div id="panelArchivadasRecetas" style={{ display: 'none' }}>
              <label className="selectorTodasEscalado">
                <span className="selectorTodasEscaladoTexto">Seleccionar todas</span>
                <span className="switchMini">
                  <input id="seleccionarTodasDesarchivar" type="checkbox" onChange={toggleSeleccionTodasArchivadas} />
                  <span className="switchMiniSlider"></span>
                </span>
              </label>
              <div id="listaRecetasArchivadas" className="listaRecetasEscaladoCategoria"></div>
              <button className="boton botonExito" onClick={() => desarchivarRecetasSeleccionadas()}>Desarchivar seleccionadas</button>
            </div>
          </div>
        </div>
      </div>

      <div id="modalPaqueteReceta" className="modal" onClick={() => cerrarModal('modalPaqueteReceta')}>
        <div className="contenidoModal" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal"><h3 id="tituloModalPaqueteReceta">Nuevo paquete</h3><button className="cerrarModal" onClick={() => cerrarModal('modalPaqueteReceta')}>&times;</button></div>
          <div className="cajaFormulario">
            <input id="idPaqueteReceta" type="hidden" />
            <input id="nombrePaqueteReceta" type="text" placeholder="Nombre del paquete" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '8px', marginBottom: '10px' }}>
              <select id="filtroCategoriaRecetaPaquete" onChange={() => filtrarRecetasPaquete()}>
                <option value="">Todas las categorías</option>
              </select>
              <input id="busquedaRecetaPaquete" type="text" placeholder="Buscar receta..." onChange={() => filtrarRecetasPaquete()} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: '8px', marginBottom: '10px' }}>
              <select id="selectRecetaPaquete"></select>
              <input id="cantidadRecetaPaquete" type="number" min="1" step="1" defaultValue="1" />
              <button className="boton" type="button" onClick={() => agregarItemPaqueteTemporal()}>+ Agregar</button>
            </div>
            <table>
              <thead><tr><th>Receta</th><th>Piezas</th><th></th></tr></thead>
              <tbody id="tablaItemsPaqueteReceta"></tbody>
            </table>
            <button className="boton botonExito" type="button" onClick={() => guardarPaqueteReceta()}>Guardar paquete</button>
          </div>
        </div>
      </div>

      <div id="modalDetallePaqueteReceta" className="modal" onClick={() => cerrarModal('modalDetallePaqueteReceta')}>
        <div className="contenidoModal" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal"><h3 id="tituloDetallePaqueteReceta">Detalle del paquete</h3><button className="cerrarModal" onClick={() => cerrarModal('modalDetallePaqueteReceta')}>&times;</button></div>
          <div className="cajaFormulario">
            <div id="tabsDetallePaqueteReceta" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}></div>
            <div id="contenidoDetallePaqueteReceta"></div>
          </div>
        </div>
      </div>

      <div id="modalAjustesProduccion" className="modal" onClick={() => cerrarModal('modalAjustesProduccion')}>
        <div className="contenidoModal" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal"><h3>Porcentajes de producción</h3><button className="cerrarModal" onClick={() => cerrarModal('modalAjustesProduccion')}>&times;</button></div>
          <div className="cajaFormulario">
            <label htmlFor="ajusteFactorCostoProduccion">Factor costo producción</label>
            <input id="ajusteFactorCostoProduccion" type="number" min="0.01" step="0.01" />
            <label htmlFor="ajusteFactorPrecioVenta">Factor precio venta</label>
            <input id="ajusteFactorPrecioVenta" type="number" min="0.01" step="0.01" />
            <label htmlFor="ajusteRedondeoPrecio">Redondeo de precio</label>
            <input id="ajusteRedondeoPrecio" type="number" min="0.01" step="0.01" />
            <button className="boton botonExito" type="button" onClick={() => guardarAjustesProduccion()}>Guardar ajustes</button>
          </div>
        </div>
      </div>

      <div id="menuCategoriaRecetas" className="menuCategoriaRecetas" onClick={e => e.stopPropagation()}>
        <button type="button" className="menuCategoriaBtn" onClick={() => editarCategoriaDesdeMenu()}>✏️ Editar categoría</button>
        <button type="button" className="menuCategoriaBtn menuCategoriaBtnDanger" onClick={() => eliminarCategoriaDesdeMenu()}>🗑️ Eliminar categoría</button>
      </div>
    </div>
  );
}

let categoriaRecetaActual = null;
let ingredientesTemporales = [];
let ultimoEnterNuevaRecetaMs = 0;
let ultimoEnterEditarRecetaMs = 0;
let cargandoRecetas = false;
let categoriaMenuActiva = null;
let nombreCategoriaMenuActivo = '';
let recetasEscaladoActual = [];
let botonCategoriaMenuActivo = null;
let categoriaEditandoId = null;
let nombreCategoriaEditandoTemporal = '';
let recetasArchivadoActual = [];
let recetasArchivadasActual = [];
let tabArchivadoActiva = 'archivar';
let subpestanaRecetasActiva = 'recetas';
let recetaTiendaEditando = null;
let fichaTiendaGaleriaActual = [];
let fichaTiendaIngredientesActual = [];
let indiceDragGaleriaTienda = -1;
let paquetesRecetasActual = [];
let productosTiendaAdminCache = [];
let itemsPaqueteTemporales = [];
let detallePaqueteActual = null;
let filtroCategoriaPaqueteActual = '';
let busquedaRecetaPaqueteActual = '';
let paqueteProduccionActual = null;
let ajustesProduccionActual = {
  factor_costo_produccion: 1.15,
  factor_precio_venta: 2.5,
  redondeo_precio: 5
};

function claveNombreReceta(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getAbrev(unidad) {
  if (!unidad) return '';
  const u = unidad.toLowerCase().trim();
  if (u === 'go' || u === 'gota' || u === 'gotas') return 'go';
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

function normalizarUnidadReceta(unidad) {
  const u = String(unidad || '').toLowerCase().trim();
  if (!u) return '';
  if (u === 'go' || u === 'gota' || u === 'gotas') return 'gotas';
  return u;
}

function ordenarTexto(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'es', { sensitivity: 'base' });
}

function agruparInsumosPorProveedor(insumos = []) {
  const grupos = new Map();
  (Array.isArray(insumos) ? insumos : []).forEach((insumo) => {
    const proveedor = String(insumo?.proveedor || 'Sin proveedor').trim() || 'Sin proveedor';
    if (!grupos.has(proveedor)) grupos.set(proveedor, []);
    grupos.get(proveedor).push(insumo);
  });

  return Array.from(grupos.entries())
    .sort((a, b) => ordenarTexto(a[0], b[0]))
    .map(([proveedor, items]) => ({
      proveedor,
      items: items.sort((a, b) => ordenarTexto(a?.nombre, b?.nombre))
    }));
}

function cambiarSubpestanaRecetas(tab) {
  if (tab === 'paquetes') subpestanaRecetasActiva = 'paquetes';
  else subpestanaRecetasActiva = 'recetas';
  const panelRecetas = document.getElementById('panelSubpestanaRecetas');
  const panelPaquetes = document.getElementById('panelSubpestanaPaquetes');
  const btnRecetas = document.getElementById('btnSubTabRecetas');
  const btnPaquetes = document.getElementById('btnSubTabPaquetes');

  if (panelRecetas) panelRecetas.style.display = subpestanaRecetasActiva === 'recetas' ? '' : 'none';
  if (panelPaquetes) panelPaquetes.style.display = subpestanaRecetasActiva === 'paquetes' ? '' : 'none';
  if (btnRecetas) btnRecetas.classList.toggle('activo', subpestanaRecetasActiva === 'recetas');
  if (btnPaquetes) btnPaquetes.classList.toggle('activo', subpestanaRecetasActiva === 'paquetes');
  if (subpestanaRecetasActiva === 'paquetes') {
    cargarPaquetesRecetas();
  }
}

async function cargarCategorias() {
  try {
    const respuesta = await fetch(`${API}/categorias`);
    if (!respuesta.ok) {
      if (respuesta.status === 401) {
        mostrarNotificacion('Sesión expirada. Vuelve a iniciar sesión.', 'error');
      }
      return;
    }
    const categorias = await respuesta.json();
    if (!Array.isArray(categorias)) {
      console.error('Respuesta inválida en categorías:', categorias);
      return;
    }

    const selectores = ['categoriaReceta', 'editCategoriaReceta'];
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
      if (actual) select.value = actual;
    });
  } catch (error) {
    console.error('Error cargando categorías:', error);
  }
}

async function agregarCategoria(event) {
  if (event) event.preventDefault();
  const nombre = document.getElementById('nombreCategoria')?.value;

  if (!nombre?.trim()) {
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

async function eliminarCategoria(id, nombre) {
  const confirmacion = await mostrarConfirmacion(`¿Estás seguro de eliminar la categoría "${nombre}"?`, 'Esta acción no se puede deshacer.');
  if (!confirmacion) return;

  try {
    const respuesta = await fetch(`${API}/categorias/${id}`, { method: 'DELETE' });
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

async function editarCategoria(id, nombreActual) {
  categoriaEditandoId = id;
  categoriaMenuActiva = id;
  nombreCategoriaMenuActivo = nombreActual || '';
  nombreCategoriaEditandoTemporal = nombreActual || '';
  ocultarMenuCategoria();
  await cargarPestanasCategorias();

  window.requestAnimationFrame(() => {
    const input = document.getElementById(`inputEditarCategoria-${id}`);
    if (input) {
      input.focus();
      input.select();
    }
  });
}

async function guardarEdicionCategoriaInline(id) {
  const input = document.getElementById(`inputEditarCategoria-${id}`);
  const nombre = (input?.value || nombreCategoriaEditandoTemporal || '').trim();
  if (!nombre) {
    mostrarNotificacion('Por favor ingresa un nombre de categoría', 'error');
    return;
  }

  try {
    const respuesta = await fetch(`${API}/categorias/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre })
    });
    if (respuesta.ok) {
      mostrarNotificacion('✅ Categoría actualizada', 'exito');
      categoriaEditandoId = null;
      nombreCategoriaEditandoTemporal = '';
      await cargarCategorias();
      await cargarPestanasCategorias();
      await cargarListadoRecetas();
    } else {
      const error = await respuesta.json();
      mostrarNotificacion(`❌ ${error.error || 'No se pudo actualizar categoría'}`, 'error');
    }
  } catch (error) {
    console.error('Error editando categoría:', error);
    mostrarNotificacion('❌ Error de conexión', 'error');
  }
}

function cancelarEdicionCategoriaInline() {
  categoriaEditandoId = null;
  nombreCategoriaEditandoTemporal = '';
  cargarPestanasCategorias();
}

function ocultarMenuCategoria() {
  const menu = document.getElementById('menuCategoriaRecetas');
  if (!menu) return;
  menu.style.display = 'none';
  menu.style.visibility = 'hidden';
  if (botonCategoriaMenuActivo) {
    botonCategoriaMenuActivo.classList.remove('categoriaMenuActiva');
    botonCategoriaMenuActivo = null;
  }
}

function mostrarMenuCategoria(event, idCategoria, nombreCategoria) {
  event.preventDefault();
  categoriaMenuActiva = idCategoria;
  nombreCategoriaMenuActivo = nombreCategoria;

  const menu = document.getElementById('menuCategoriaRecetas');
  if (!menu) return;

  const boton = event.currentTarget;
  const contenedor = document.getElementById('pestanasCategoriasRecetas');
  if (!contenedor) return;
  if (botonCategoriaMenuActivo && botonCategoriaMenuActivo !== boton) {
    botonCategoriaMenuActivo.classList.remove('categoriaMenuActiva');
  }
  botonCategoriaMenuActivo = boton;
  botonCategoriaMenuActivo.classList.add('categoriaMenuActiva');
  const rect = boton?.getBoundingClientRect ? boton.getBoundingClientRect() : null;
  const rectContenedor = contenedor?.getBoundingClientRect ? contenedor.getBoundingClientRect() : null;
  if (!rect) return;
  if (!rectContenedor) return;

  menu.style.display = 'flex';
  menu.style.visibility = 'hidden';

  let x = rect.left - rectContenedor.left;
  const y = rect.bottom - rectContenedor.top + 6;

  const menuRect = menu.getBoundingClientRect();
  if (x + menuRect.width > contenedor.clientWidth - 8) {
    x = Math.max(8, contenedor.clientWidth - menuRect.width - 8);
  }

  menu.style.left = `${Math.max(8, x)}px`;
  menu.style.top = `${Math.max(8, y)}px`;
  menu.style.visibility = 'visible';
}

async function editarCategoriaDesdeMenu() {
  ocultarMenuCategoria();
  if (!categoriaMenuActiva) return;
  await editarCategoria(categoriaMenuActiva, nombreCategoriaMenuActivo);
}

async function eliminarCategoriaDesdeMenu() {
  ocultarMenuCategoria();
  if (!categoriaMenuActiva) return;
  await eliminarCategoria(categoriaMenuActiva, nombreCategoriaMenuActivo);
}

async function cargarPestanasCategorias() {
  try {
    const [respCategorias, respRecetas] = await Promise.all([
      fetch(`${API}/categorias`),
      fetch(`${API}/recetas`)
    ]);
    if (!respCategorias.ok || !respRecetas.ok) {
      if (respCategorias.status === 401 || respRecetas.status === 401) {
        mostrarNotificacion('Sesión expirada. Vuelve a iniciar sesión.', 'error');
      }
      return;
    }
    const categorias = await respCategorias.json();
    const recetas = await respRecetas.json();
    if (!Array.isArray(categorias) || !Array.isArray(recetas)) {
      console.error('Respuesta inválida en pestañas de categorías:', { categorias, recetas });
      return;
    }

    const conteoPorCategoria = {};
    recetas.forEach(r => {
      if (r.id_categoria != null) conteoPorCategoria[r.id_categoria] = (conteoPorCategoria[r.id_categoria] || 0) + 1;
    });

    const contenedor = document.getElementById('pestanasCategoriasRecetas');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    const btnTodas = document.createElement('button');
    btnTodas.className = 'boton ' + (categoriaRecetaActual === null ? 'activo' : '');
    btnTodas.textContent = `📚 Todas (${recetas.length})`;
    btnTodas.onclick = () => {
      categoriaRecetaActual = null;
      cargarListadoRecetas();
      cargarPestanasCategorias();
    };
    contenedor.appendChild(btnTodas);

    categorias.forEach(cat => {
      const count = conteoPorCategoria[cat.id] || 0;

      if (categoriaEditandoId === cat.id) {
        const editor = document.createElement('div');
        editor.className = 'chipCategoriaEditor';
        editor.onclick = (event) => event.stopPropagation();
        editor.onmousedown = (event) => event.stopPropagation();

        const input = document.createElement('input');
        input.id = `inputEditarCategoria-${cat.id}`;
        input.className = 'chipCategoriaInput';
        input.value = nombreCategoriaEditandoTemporal || cat.nombre || '';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.oninput = (event) => {
          nombreCategoriaEditandoTemporal = event.target.value;
        };
        input.onclick = (event) => event.stopPropagation();
        input.onkeydown = (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            guardarEdicionCategoriaInline(cat.id);
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            cancelarEdicionCategoriaInline();
          }
        };

        const btnGuardar = document.createElement('button');
        btnGuardar.type = 'button';
        btnGuardar.className = 'chipCategoriaAccion chipCategoriaAccionOk';
        btnGuardar.title = 'Guardar';
        btnGuardar.textContent = '✓';
        btnGuardar.onmousedown = (event) => event.stopPropagation();
        btnGuardar.onclick = () => guardarEdicionCategoriaInline(cat.id);

        const btnCancelar = document.createElement('button');
        btnCancelar.type = 'button';
        btnCancelar.className = 'chipCategoriaAccion chipCategoriaAccionCancel';
        btnCancelar.title = 'Cancelar';
        btnCancelar.textContent = '✕';
        btnCancelar.onmousedown = (event) => event.stopPropagation();
        btnCancelar.onclick = () => cancelarEdicionCategoriaInline();

        editor.appendChild(input);
        editor.appendChild(btnGuardar);
        editor.appendChild(btnCancelar);
        contenedor.appendChild(editor);
        return;
      }

      const btn = document.createElement('button');
      btn.className = 'boton ' + (categoriaRecetaActual === cat.id ? 'activo' : '');
      btn.textContent = `🌿 ${cat.nombre} (${count})`;
      btn.title = 'Clic derecho para editar o eliminar categoría';
      btn.onclick = () => {
        categoriaRecetaActual = cat.id;
        cargarListadoRecetas();
        cargarPestanasCategorias();
      };
      btn.oncontextmenu = (event) => mostrarMenuCategoria(event, cat.id, cat.nombre);

      contenedor.appendChild(btn);
    });
  } catch (error) {
    console.error('Error cargando pestañas de categorías:', error);
  }
}

async function abrirModalEscaladoCategoria() {
  const select = document.getElementById('categoriaEscaladoCategoria');
  if (select) {
    select.innerHTML = '<option value="">Todas las categorías</option>';
    try {
      const respuesta = await fetch(`${API}/categorias`);
      const categorias = await respuesta.json();
      (categorias || []).forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        select.appendChild(option);
      });
      if (categoriaRecetaActual !== null) {
        select.value = String(categoriaRecetaActual);
      }
    } catch (error) {
      console.error('Error cargando categorías para escalado:', error);
    }
  }

  const gramaje = document.getElementById('nuevoGramajeEscaladoCategoria');
  if (gramaje) gramaje.value = '';
  const chk = document.getElementById('seleccionarTodasEscalado');
  if (chk) chk.checked = false;

  await cargarRecetasEscaladoCategoria();
  abrirModal('modalEscaladoCategoria');
}

async function cargarRecetasEscaladoCategoria() {
  const lista = document.getElementById('listaRecetasEscaladoCategoria');
  if (!lista) return;

  const categoria = document.getElementById('categoriaEscaladoCategoria')?.value;
  let url = `${API}/recetas`;
  if (categoria) url += `?categoria=${categoria}`;

  try {
    const respuesta = await fetch(url);
    const recetas = await respuesta.json();
    recetasEscaladoActual = Array.isArray(recetas) ? recetas : [];

    if (!recetasEscaladoActual.length) {
      lista.innerHTML = '<div class="mensajeSinRecetasEscalado">No hay recetas en esta categoría</div>';
      return;
    }

    lista.innerHTML = recetasEscaladoActual.map((receta) => `
      <label class="itemRecetaEscalado">
        <span class="itemRecetaEscaladoTexto">${receta.nombre} ${receta.gramaje ? `• ${receta.gramaje}g` : '• sin gramaje'}</span>
        <span class="switchMini">
          <input class="checkRecetaEscalado" type="checkbox" value="${receta.id}" />
          <span class="switchMiniSlider"></span>
        </span>
      </label>
    `).join('');
  } catch (error) {
    console.error('Error cargando recetas para escalado:', error);
    lista.innerHTML = '<div class="mensajeSinRecetasEscalado">Error al cargar recetas</div>';
  }
}

function toggleSeleccionTodasEscalado() {
  const checked = Boolean(document.getElementById('seleccionarTodasEscalado')?.checked);
  document.querySelectorAll('.checkRecetaEscalado').forEach((input) => {
    input.checked = checked;
  });
}

async function copiarRecetasEscaladoCategoria() {
  const nuevoGramaje = parseFloat(document.getElementById('nuevoGramajeEscaladoCategoria')?.value);
  if (!Number.isFinite(nuevoGramaje) || nuevoGramaje <= 0) {
    mostrarNotificacion('Ingresa un nuevo gramaje válido', 'error');
    return;
  }
          <h3>${receta.nombre} ${receta.gramaje ? `• ${receta.gramaje}g` : ''}</h3>
  const seleccionadas = Array.from(document.querySelectorAll('.checkRecetaEscalado:checked')).map((input) => Number(input.value));
  if (!seleccionadas.length) {
    mostrarNotificacion('Selecciona al menos una receta', 'error');
    return;
  }

  let creadas = 0;
  let omitidas = 0;

  for (const id of seleccionadas) {
    try {
      const respuestaDetalle = await fetch(`${API}/recetas/${id}`);
      if (!respuestaDetalle.ok) {
        omitidas += 1;
        continue;
      }

      const receta = await respuestaDetalle.json();
      const gramajeOriginal = Number(receta.gramaje || 0);
      if (gramajeOriginal <= 0) {
        omitidas += 1;
        continue;
      }

      const factor = nuevoGramaje / gramajeOriginal;
      const ingredientes = (receta.ingredientes || []).map((ing) => ({
        id_insumo: ing.id_insumo,
        nombre: ing.nombre,
        cantidad: Number(ing.cantidad || 0) * factor,
        unidad: ing.unidad
      }));

      const nombreNuevo = `${receta.nombre} (${nuevoGramaje}g)`;
      const respuestaCrear = await fetch(`${API}/recetas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreNuevo,
          id_categoria: receta.id_categoria,
          gramaje: nuevoGramaje,
          ingredientes
        })
      });

      if (respuestaCrear.ok) {
        creadas += 1;
      } else {
        omitidas += 1;
      }
    } catch (error) {
      console.error('Error escalando receta:', error);
      omitidas += 1;
    }
  }

  if (creadas > 0) {
    mostrarNotificacion(`✅ Se crearon ${creadas} receta(s) escalada(s)`, 'exito');
    await cargarListadoRecetas();
    await cargarPestanasCategorias();
  }

  if (omitidas > 0) {
    mostrarNotificacion(`⚠️ ${omitidas} receta(s) no se pudieron escalar`, 'advertencia');
  }

  if (creadas > 0) cerrarModal('modalEscaladoCategoria');
}

async function abrirModalArchivadoRecetas() {
  const select = document.getElementById('categoriaArchivadoRecetas');
  if (select) {
    select.innerHTML = '<option value="">Todas las categorías</option>';
    try {
      const respuesta = await fetch(`${API}/categorias`);
      const categorias = await respuesta.json();
      (categorias || []).forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        select.appendChild(option);
      });
      if (categoriaRecetaActual !== null) {
        select.value = String(categoriaRecetaActual);
      }
    } catch (error) {
      console.error('Error cargando categorías para archivado:', error);
    }
  }

  const busqueda = document.getElementById('busquedaArchivadoRecetas');
  if (busqueda) busqueda.value = '';
  const chkArchivar = document.getElementById('seleccionarTodasArchivar');
  if (chkArchivar) chkArchivar.checked = false;
  const chkDesarchivar = document.getElementById('seleccionarTodasDesarchivar');
  if (chkDesarchivar) chkDesarchivar.checked = false;

  tabArchivadoActiva = 'archivar';
  cambiarPestanaArchivado('archivar');
  abrirModal('modalArchivarRecetas');
}

function cambiarPestanaArchivado(tab) {
  tabArchivadoActiva = tab === 'archivadas' ? 'archivadas' : 'archivar';
  const btnArchivar = document.getElementById('tabArchivarRecetas');
  const btnArchivadas = document.getElementById('tabArchivadasRecetas');
  const panelArchivar = document.getElementById('panelArchivarRecetas');
  const panelArchivadas = document.getElementById('panelArchivadasRecetas');

  if (btnArchivar) btnArchivar.classList.toggle('activo', tabArchivadoActiva === 'archivar');
  if (btnArchivadas) btnArchivadas.classList.toggle('activo', tabArchivadoActiva === 'archivadas');
  if (panelArchivar) panelArchivar.style.display = tabArchivadoActiva === 'archivar' ? '' : 'none';
  if (panelArchivadas) panelArchivadas.style.display = tabArchivadoActiva === 'archivadas' ? '' : 'none';

  if (tabArchivadoActiva === 'archivar') {
    cargarRecetasArchivado();
  } else {
    cargarRecetasArchivadas();
  }
}

async function cargarRecetasArchivado() {
  const lista = document.getElementById('listaRecetasArchivar');
  if (!lista) return;

  const categoria = document.getElementById('categoriaArchivadoRecetas')?.value;
  const busqueda = normalizarTextoBusqueda(document.getElementById('busquedaArchivadoRecetas')?.value || '');
  let url = `${API}/recetas`;
  if (categoria) url += `?categoria=${categoria}`;

  try {
    const respuesta = await fetch(url);
    const recetas = await respuesta.json();
    const base = Array.isArray(recetas) ? recetas : [];
    recetasArchivadoActual = base.filter((receta) => normalizarTextoBusqueda(receta.nombre || '').includes(busqueda));

    if (!recetasArchivadoActual.length) {
      lista.innerHTML = '<div class="mensajeSinRecetasEscalado">No hay recetas para archivar</div>';
      return;
    }

    lista.innerHTML = recetasArchivadoActual.map((receta) => `
      <label class="itemRecetaEscalado">
        <span class="itemRecetaEscaladoTexto">${receta.nombre} ${receta.gramaje ? `• ${receta.gramaje}g` : '• sin gramaje'}</span>
        <span class="switchMini">
          <input class="checkRecetaArchivar" type="checkbox" value="${receta.id}" />
          <span class="switchMiniSlider"></span>
        </span>
      </label>
    `).join('');
  } catch (error) {
    console.error('Error cargando recetas para archivar:', error);
    lista.innerHTML = '<div class="mensajeSinRecetasEscalado">Error al cargar recetas</div>';
  }
}

async function cargarRecetasArchivadas() {
  const lista = document.getElementById('listaRecetasArchivadas');
  if (!lista) return;

  const categoria = document.getElementById('categoriaArchivadoRecetas')?.value;
  const busqueda = normalizarTextoBusqueda(document.getElementById('busquedaArchivadoRecetas')?.value || '');
  let url = `${API}/recetas?archivadas=1`;
  if (categoria) url += `&categoria=${categoria}`;

  try {
    const respuesta = await fetch(url);
    const recetas = await respuesta.json();
    const base = Array.isArray(recetas) ? recetas : [];
    recetasArchivadasActual = base.filter((receta) => normalizarTextoBusqueda(receta.nombre || '').includes(busqueda));

    if (!recetasArchivadasActual.length) {
      lista.innerHTML = '<div class="mensajeSinRecetasEscalado">No hay recetas archivadas</div>';
      return;
    }

    lista.innerHTML = recetasArchivadasActual.map((receta) => `
      <label class="itemRecetaEscalado">
        <span class="itemRecetaEscaladoTexto">${receta.nombre} ${receta.gramaje ? `• ${receta.gramaje}g` : '• sin gramaje'}</span>
        <span class="switchMini">
          <input class="checkRecetaDesarchivar" type="checkbox" value="${receta.id}" />
          <span class="switchMiniSlider"></span>
        </span>
      </label>
    `).join('');
  } catch (error) {
    console.error('Error cargando recetas archivadas:', error);
    lista.innerHTML = '<div class="mensajeSinRecetasEscalado">Error al cargar recetas</div>';
  }
}

function toggleSeleccionTodasArchivar() {
  const checked = Boolean(document.getElementById('seleccionarTodasArchivar')?.checked);
  document.querySelectorAll('.checkRecetaArchivar').forEach((input) => {
    input.checked = checked;
  });
}

function toggleSeleccionTodasArchivadas() {
  const checked = Boolean(document.getElementById('seleccionarTodasDesarchivar')?.checked);
  document.querySelectorAll('.checkRecetaDesarchivar').forEach((input) => {
    input.checked = checked;
  });
}

async function archivarRecetasSeleccionadas() {
  const ids = Array.from(document.querySelectorAll('.checkRecetaArchivar:checked')).map((input) => Number(input.value));
  if (!ids.length) {
    mostrarNotificacion('Selecciona al menos una receta para archivar', 'error');
    return;
  }

  try {
    const respuesta = await fetch(`${API}/recetas/archivar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });

    if (respuesta.ok) {
      mostrarNotificacion('Recetas archivadas correctamente', 'exito');
      await cargarRecetasArchivado();
      await cargarRecetasArchivadas();
      await cargarListadoRecetas();
      await cargarPestanasCategorias();
      const chk = document.getElementById('seleccionarTodasArchivar');
      if (chk) chk.checked = false;
    } else {
      const err = await respuesta.json();
      mostrarNotificacion(err.error || 'No se pudieron archivar recetas', 'error');
    }
  } catch (error) {
    console.error('Error archivando recetas:', error);
    mostrarNotificacion('Error al archivar recetas', 'error');
  }
}

async function desarchivarRecetasSeleccionadas() {
  const ids = Array.from(document.querySelectorAll('.checkRecetaDesarchivar:checked')).map((input) => Number(input.value));
  if (!ids.length) {
    mostrarNotificacion('Selecciona al menos una receta para desarchivar', 'error');
    return;
  }

  try {
    const respuesta = await fetch(`${API}/recetas/desarchivar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });

    if (respuesta.ok) {
      mostrarNotificacion('Recetas desarchivadas correctamente', 'exito');
      await cargarRecetasArchivado();
      await cargarRecetasArchivadas();
      await cargarListadoRecetas();
      await cargarPestanasCategorias();
      const chk = document.getElementById('seleccionarTodasDesarchivar');
      if (chk) chk.checked = false;
    } else {
      const err = await respuesta.json();
      mostrarNotificacion(err.error || 'No se pudieron desarchivar recetas', 'error');
    }
  } catch (error) {
    console.error('Error desarchivando recetas:', error);
    mostrarNotificacion('Error al desarchivar recetas', 'error');
  }
}

async function archivarReceta(id, nombreReceta) {
  const ok = await mostrarConfirmacion(`¿Archivar "${nombreReceta}"?`, 'La receta dejará de mostrarse en el listado principal.');
  if (!ok) return;

  try {
    const respuesta = await fetch(`${API}/recetas/archivar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] })
    });

    if (respuesta.ok) {
      mostrarNotificacion('Receta archivada', 'exito');
      await cargarListadoRecetas();
      await cargarPestanasCategorias();
    }
  } catch (error) {
    console.error('Error archivando receta:', error);
    mostrarNotificacion('Error al archivar receta', 'error');
  }
}

async function cargarListadoRecetas(opciones = {}) {
  const preservarScroll = opciones?.preservarScroll !== false;
  if (cargandoRecetas) return;
  cargandoRecetas = true;
  const scrollYAntes = preservarScroll ? (window.scrollY || window.pageYOffset || 0) : 0;
  try {
    let url = `${API}/recetas`;
    if (categoriaRecetaActual !== null) url += `?categoria=${categoriaRecetaActual}`;

    const respuesta = await fetch(url);
    if (!respuesta.ok) {
      if (respuesta.status === 401) {
        mostrarNotificacion('Sesión expirada. Vuelve a iniciar sesión.', 'error');
      }
      return;
    }
    const recetas = await respuesta.json();
    if (!Array.isArray(recetas)) {
      console.error('Respuesta inválida en listado de recetas:', recetas);
      return;
    }

    const token = localStorage.getItem('token') || '';
    const visibilidadTienda = new Map();
    try {
      const respProductosAdmin = await fetch(`${API}/tienda/admin/productos`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      if (respProductosAdmin.ok) {
        const productosAdmin = await respProductosAdmin.json();
        if (Array.isArray(productosAdmin)) {
          productosAdmin.forEach((producto) => {
            const variantes = Array.isArray(producto?.variantes) ? producto.variantes : [];
            variantes.forEach((variante) => {
              const clave = claveNombreReceta(variante?.receta_nombre || variante?.nombre || '');
              if (clave) visibilidadTienda.set(clave, Boolean(variante?.visible_publico));
            });

            const claveProducto = claveNombreReceta(producto?.nombre_receta || '');
            if (claveProducto && !visibilidadTienda.has(claveProducto)) {
              visibilidadTienda.set(claveProducto, Boolean(producto?.visible_publico));
            }
          });
        }
      }
    } catch (errorVisibilidad) {
      console.warn('No se pudo cargar visibilidad de tienda para recetas:', errorVisibilidad);
    }

    const cuerpo = document.getElementById('cuerpoRecetas');
    if (!cuerpo) return;
    cuerpo.innerHTML = '';

    if (recetas.length === 0) {
      cuerpo.innerHTML = '<div style="text-align:center;padding:30px;color:#999">No hay recetas</div>';
      return;
    }

    for (const receta of recetas) {
      const nombreRecetaSeguro = escaparParaInlineJs(receta?.nombre);
      const visibleRecetaTienda = Boolean(visibilidadTienda.get(claveNombreReceta(receta?.nombre)));
      const respDetalle = await fetch(`${API}/recetas/${receta.id}`);
      const detalle = await respDetalle.json();
      const respCapacidad = await fetch(`${API}/recetas/calcular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_receta: receta.id })
      });
      const capacidad = await respCapacidad.json();

      const totalIngredientes = (detalle.ingredientes || []).length;
      let totalGramos = 0;
      let totalMililitros = 0;
      (detalle.ingredientes || []).forEach(ing => {
        const cantidad = ing.cantidad || 0;
        const unidad = (ing.unidad || '').toLowerCase();
        if (unidad === 'kg') totalGramos += cantidad * 1000;
        else if (unidad === 'g') totalGramos += cantidad;
        else if (unidad === 'l') totalMililitros += cantidad * 1000;
        else if (unidad === 'ml') totalMililitros += cantidad;
        else if (unidad === 'gotas') {
          totalMililitros += (cantidad / 10) * 0.5;
          totalGramos += (cantidad / 10) * 0.5;
        }
      });
      let textoTotal = 'N/A';
      if (totalGramos > 0 && totalMililitros > 0) textoTotal = `${totalGramos.toFixed(0)}g + ${totalMililitros.toFixed(0)}ml`;
      else if (totalGramos > 0) textoTotal = `${totalGramos.toFixed(0)}g`;
      else if (totalMililitros > 0) textoTotal = `${totalMililitros.toFixed(0)}ml`;

      let hayPendientes = false;
      (detalle.ingredientes || []).forEach(ing => {
        if (ing.pendiente === true || ing.pendiente === 1) hayPendientes = true;
      });

      const tarjeta = document.createElement('div');
      tarjeta.className = 'tarjetaReceta';
      if (hayPendientes) {
        tarjeta.style.border = '2px solid #d32f2f';
        tarjeta.style.boxShadow = '0 0 0 2px rgba(211, 47, 47, 0.12)';
      }
      tarjeta.innerHTML = `
        <div style="padding:18px">
          ${hayPendientes ? '<div style="color:#d32f2f;font-size:12px;margin-bottom:6px;display:flex;align-items:center;gap:4px"><span style="font-size:15px">⚠️</span> Receta con insumo faltante o eliminado</div>' : ''}
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
            <div style="flex:1">
              <h3 style="margin:0 0 5px 0;color:#1a1a1a;font-size:16px">${receta.nombre}</h3>
              <p style="margin:0;color:#666;font-size:11px">🌿 ${receta.categoria || 'Sin categoría'} ${receta.gramaje ? `• ${receta.gramaje}g` : ''}</p>
            </div>
            <div class="recetaAccionesTop">
              <label class="switchMini" title="Mostrar en tienda">
                <input
                  type="checkbox"
                  ${visibleRecetaTienda ? 'checked' : ''}
                  onchange="window.recetas.cambiarVisibleRecetaTienda(${receta.id}, '${nombreRecetaSeguro}', this.checked, this)"
                />
                <span class="switchMiniSlider"></span>
              </label>
              <button onclick="window.recetas.eliminarReceta(${receta.id})" class="botonPequeno botonDanger" title="Eliminar receta">🗑️</button>
            </div>
          </div>
          <div style="background:#f8f9fa;padding:10px;border-radius:8px;margin-bottom:12px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px">
              <div style="display:flex;align-items:center;gap:5px"><span style="font-weight:600;color:#333">🧪 Ingredientes:</span><span style="color:#666">${totalIngredientes}</span></div>
              <div style="display:flex;align-items:center;gap:5px"><span style="font-weight:600;color:#333">⚖️ Total:</span><span style="color:#666">${textoTotal}</span></div>
              <div style="display:flex;align-items:center;gap:5px"><span style="font-weight:600;color:#333">📦 Capacidad:</span><span style="color:#666">${capacidad.piezas_maximas || 0} pz</span></div>
              <div style="display:flex;align-items:center;gap:5px"><span style="font-weight:600;color:#333">💰 Costo/pz:</span><span style="color:#4a9b5e;font-weight:600">$${(capacidad.costo_por_pieza || 0).toFixed(2)}</span></div>
            </div>
          </div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            <button onclick="window.recetas.abrirProduccionRapida(${receta.id}, '${nombreRecetaSeguro}', ${(capacidad.costo_por_pieza || 0)})" class="botonPequeno" style="background:#ff9800" title="Producir">🎰</button>
            <button onclick="window.recetas.editarReceta(${receta.id})" class="botonPequeno" title="Editar receta">✏️</button>
            <button onclick="window.recetas.abrirFichaTiendaReceta(${receta.id})" class="botonPequeno" style="background:#4a7c59" title="Editar ficha de tienda">🛍️</button>
            <button onclick="window.recetas.abrirEscalarReceta(${receta.id}, '${nombreRecetaSeguro}', ${receta.gramaje || 0})" class="botonPequeno" style="background:#3498db" title="Copiar con escalado">📋</button>
            <button onclick="window.recetas.archivarReceta(${receta.id}, '${nombreRecetaSeguro}')" class="botonPequeno" style="background:#607d8b" title="Archivar receta">🗂️</button>
            <button onclick="window.recetas.mostrarIngredientes(${receta.id})" class="botonPequeno" title="Ver ingredientes">👁️</button>
          </div>
        </div>
      `;
      cuerpo.appendChild(tarjeta);
    }

    if (preservarScroll) {
      window.requestAnimationFrame(() => {
        const topMax = Math.max(0, (document.documentElement?.scrollHeight || 0) - (window.innerHeight || 0));
        const topObjetivo = Math.min(scrollYAntes, topMax);
        window.scrollTo({ top: topObjetivo, behavior: 'auto' });
      });
    }
  } catch (error) {
    console.error('Error cargando recetas:', error);
  } finally {
    cargandoRecetas = false;
  }
}

async function cambiarVisibleRecetaTienda(idReceta, nombreReceta, visible, inputEl = null) {
  try {
    const respuestaDetalle = await fetch(`${API}/recetas/${idReceta}`);
    if (!respuestaDetalle.ok) throw new Error('No se pudo leer la receta');

    const receta = await respuestaDetalle.json();
    const recetaNombre = String(nombreReceta || receta?.nombre || '').trim();
    if (!recetaNombre) throw new Error('Receta inválida');

    const respuesta = await fetch(`${API}/tienda/catalogo/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receta_nombre: recetaNombre, activo: Boolean(visible) })
    });

    if (!respuesta.ok) {
      const err = await respuesta.json().catch(() => ({}));
      throw new Error(err?.error || 'No se pudo actualizar visibilidad en tienda');
    }

    mostrarNotificacion(`Receta ${visible ? 'visible' : 'oculta'} en tienda`, 'exito');
  } catch (error) {
    console.error('Error actualizando visibilidad de receta en tienda:', error);
    if (inputEl) inputEl.checked = !Boolean(visible);
    mostrarNotificacion(error?.message || 'Error al actualizar visibilidad', 'error');
  }
}

function headersConToken(extra = {}) {
  const token = localStorage.getItem('token') || '';
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra
  };
}

async function cargarAjustesProduccion() {
  try {
    const respuesta = await fetch(`${API}/api/recetas/ajustes-produccion`, { headers: headersConToken() });
    if (!respuesta.ok) return;
    const data = await respuesta.json();
    ajustesProduccionActual = {
      factor_costo_produccion: Number(data?.factor_costo_produccion) || 1.15,
      factor_precio_venta: Number(data?.factor_precio_venta) || 2.5,
      redondeo_precio: Number(data?.redondeo_precio) || 5
    };
  } catch {
    ajustesProduccionActual = { factor_costo_produccion: 1.15, factor_precio_venta: 2.5, redondeo_precio: 5 };
  }
}

function abrirAjustesProduccion() {
  const f1 = document.getElementById('ajusteFactorCostoProduccion');
  const f2 = document.getElementById('ajusteFactorPrecioVenta');
  const f3 = document.getElementById('ajusteRedondeoPrecio');
  if (f1) f1.value = Number(ajustesProduccionActual.factor_costo_produccion || 1.15).toFixed(2);
  if (f2) f2.value = Number(ajustesProduccionActual.factor_precio_venta || 2.5).toFixed(2);
  if (f3) f3.value = Number(ajustesProduccionActual.redondeo_precio || 5).toFixed(2);
  abrirModal('modalAjustesProduccion');
}

async function guardarAjustesProduccion() {
  const factorCosto = Number(document.getElementById('ajusteFactorCostoProduccion')?.value);
  const factorVenta = Number(document.getElementById('ajusteFactorPrecioVenta')?.value);
  const redondeo = Number(document.getElementById('ajusteRedondeoPrecio')?.value);
  if (!Number.isFinite(factorCosto) || factorCosto <= 0 || !Number.isFinite(factorVenta) || factorVenta <= 0 || !Number.isFinite(redondeo) || redondeo <= 0) {
    mostrarNotificacion('Completa valores válidos para porcentajes de producción', 'error');
    return;
  }

  try {
    const respuesta = await fetch(`${API}/api/recetas/ajustes-produccion`, {
      method: 'PUT',
      headers: headersConToken({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ factor_costo_produccion: factorCosto, factor_precio_venta: factorVenta, redondeo_precio: redondeo })
    });
    const data = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(data?.error || 'No se pudieron guardar ajustes');
    ajustesProduccionActual = {
      factor_costo_produccion: factorCosto,
      factor_precio_venta: factorVenta,
      redondeo_precio: redondeo
    };
    actualizarCostoProduccion();
    cerrarModal('modalAjustesProduccion');
    mostrarNotificacion('Ajustes de producción guardados', 'exito');
  } catch (error) {
    mostrarNotificacion(error?.message || 'Error guardando ajustes', 'error');
  }
}

async function cargarProductosTiendaAdminCache() {
  try {
    const respuesta = await fetch(`${API}/tienda/admin/productos`, { headers: headersConToken() });
    if (!respuesta.ok) return;
    const data = await respuesta.json();
    productosTiendaAdminCache = Array.isArray(data) ? data : [];
  } catch {
    productosTiendaAdminCache = [];
  }
}

function renderSelectRecetasPaquete() {
  renderFiltrosRecetasPaquete();
  const sel = document.getElementById('selectRecetaPaquete');
  if (!sel) return;
  const actual = String(sel.value || '').trim();
  sel.innerHTML = '<option value="">Selecciona receta</option>';

  const categoriaFiltro = String(filtroCategoriaPaqueteActual || '').trim().toLowerCase();
  const busquedaFiltro = normalizarTextoBusqueda(busquedaRecetaPaqueteActual || '');

  const opciones = (productosTiendaAdminCache || [])
    .filter((p) => String(p?.tipo_producto || '').trim().toLowerCase() !== 'paquete')
    .filter((p) => {
      const categoria = String(p?.categoria_nombre || '').trim().toLowerCase();
      if (categoriaFiltro && categoria !== categoriaFiltro) return false;

      if (!busquedaFiltro) return true;
      const nombre = normalizarTextoBusqueda(p?.nombre_receta || '');
      const categoriaNorm = normalizarTextoBusqueda(p?.categoria_nombre || '');
      return nombre.includes(busquedaFiltro) || categoriaNorm.includes(busquedaFiltro);
    })
    .sort((a, b) => ordenarTexto(a?.nombre_receta, b?.nombre_receta));

  opciones.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = String(p?.nombre_receta || '').trim();
    opt.textContent = `${p?.nombre_receta || 'Sin nombre'}${p?.categoria_nombre ? ` (${p.categoria_nombre})` : ''}`;
    sel.appendChild(opt);
  });

  if (actual && opciones.some((p) => String(p?.nombre_receta || '').trim() === actual)) {
    sel.value = actual;
  }
}

function renderFiltrosRecetasPaquete() {
  const selCategoria = document.getElementById('filtroCategoriaRecetaPaquete');
  if (!selCategoria) return;
  const actual = String(selCategoria.value || '').trim().toLowerCase();

  const categorias = Array.from(new Set(
    (productosTiendaAdminCache || [])
      .filter((p) => String(p?.tipo_producto || '').trim().toLowerCase() !== 'paquete')
      .map((p) => String(p?.categoria_nombre || '').trim())
      .filter(Boolean)
  )).sort((a, b) => ordenarTexto(a, b));

  selCategoria.innerHTML = '<option value="">Todas las categorías</option>';
  categorias.forEach((nombre) => {
    const opt = document.createElement('option');
    opt.value = String(nombre || '').trim().toLowerCase();
    opt.textContent = nombre;
    selCategoria.appendChild(opt);
  });

  if (actual && categorias.some((c) => c.toLowerCase() === actual)) {
    selCategoria.value = actual;
  } else {
    selCategoria.value = filtroCategoriaPaqueteActual || '';
  }
}

function filtrarRecetasPaquete() {
  filtroCategoriaPaqueteActual = String(document.getElementById('filtroCategoriaRecetaPaquete')?.value || '').trim().toLowerCase();
  busquedaRecetaPaqueteActual = String(document.getElementById('busquedaRecetaPaquete')?.value || '').trim();
  renderSelectRecetasPaquete();
}

function renderItemsPaqueteTemporal() {
  const tbody = document.getElementById('tablaItemsPaqueteReceta');
  if (!tbody) return;
  if (!itemsPaqueteTemporales.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#777">Sin recetas agregadas</td></tr>';
    return;
  }
  tbody.innerHTML = itemsPaqueteTemporales.map((item, idx) => `
    <tr>
      <td>${item.receta_nombre}</td>
      <td>${Number(item.cantidad) || 1}</td>
      <td><button type="button" class="botonPequeno botonDanger" onclick="window.recetas.quitarItemPaqueteTemporal(${idx})">×</button></td>
    </tr>
  `).join('');
}

function agregarItemPaqueteTemporal() {
  const recetaNombre = String(document.getElementById('selectRecetaPaquete')?.value || '').trim();
  const cantidad = Math.max(1, Number(document.getElementById('cantidadRecetaPaquete')?.value) || 1);
  if (!recetaNombre) {
    mostrarNotificacion('Selecciona una receta para agregar al paquete', 'error');
    return;
  }
  const existe = itemsPaqueteTemporales.find((it) => String(it.receta_nombre || '').trim() === recetaNombre);
  if (existe) existe.cantidad = Math.max(1, Number(existe.cantidad || 1) + cantidad);
  else itemsPaqueteTemporales.push({ receta_nombre: recetaNombre, cantidad });
  renderItemsPaqueteTemporal();
}

function quitarItemPaqueteTemporal(index) {
  const idx = Number(index);
  if (!Number.isFinite(idx) || idx < 0 || idx >= itemsPaqueteTemporales.length) return;
  itemsPaqueteTemporales.splice(idx, 1);
  renderItemsPaqueteTemporal();
}

function abrirModalNuevoPaquete() {
  document.getElementById('idPaqueteReceta').value = '';
  document.getElementById('nombrePaqueteReceta').value = '';
  const inputBuscar = document.getElementById('busquedaRecetaPaquete');
  if (inputBuscar) inputBuscar.value = '';
  const inputCategoria = document.getElementById('filtroCategoriaRecetaPaquete');
  if (inputCategoria) inputCategoria.value = '';
  filtroCategoriaPaqueteActual = '';
  busquedaRecetaPaqueteActual = '';
  const titulo = document.getElementById('tituloModalPaqueteReceta');
  if (titulo) titulo.textContent = 'Nuevo paquete';
  itemsPaqueteTemporales = [];
  renderItemsPaqueteTemporal();
  renderSelectRecetasPaquete();
  abrirModal('modalPaqueteReceta');
}

async function editarPaqueteReceta(idPaquete) {
  const id = Number(idPaquete);
  const paquete = paquetesRecetasActual.find((p) => Number(p?.id) === id);
  if (!paquete) return;
  document.getElementById('idPaqueteReceta').value = String(paquete.id || '');
  document.getElementById('nombrePaqueteReceta').value = String(paquete.nombre || '');
  const inputBuscar = document.getElementById('busquedaRecetaPaquete');
  if (inputBuscar) inputBuscar.value = '';
  const inputCategoria = document.getElementById('filtroCategoriaRecetaPaquete');
  if (inputCategoria) inputCategoria.value = '';
  filtroCategoriaPaqueteActual = '';
  busquedaRecetaPaqueteActual = '';
  const titulo = document.getElementById('tituloModalPaqueteReceta');
  if (titulo) titulo.textContent = 'Editar paquete';
  itemsPaqueteTemporales = Array.isArray(paquete?.items)
    ? paquete.items.map((it) => ({ receta_nombre: String(it?.receta_nombre || '').trim(), cantidad: Math.max(1, Number(it?.cantidad) || 1) }))
    : [];
  renderItemsPaqueteTemporal();
  renderSelectRecetasPaquete();
  abrirModal('modalPaqueteReceta');
}

async function guardarPaqueteReceta() {
  const id = Number(document.getElementById('idPaqueteReceta')?.value || 0);
  const nombre = String(document.getElementById('nombrePaqueteReceta')?.value || '').trim();
  const paqueteExistente = Number.isFinite(id) && id > 0
    ? paquetesRecetasActual.find((p) => Number(p?.id) === id)
    : null;
  if (!nombre) {
    mostrarNotificacion('El nombre del paquete es obligatorio', 'error');
    return;
  }
  if (!itemsPaqueteTemporales.length) {
    mostrarNotificacion('Agrega al menos una receta al paquete', 'error');
    return;
  }

  const payload = {
    nombre,
    descripcion: String(paqueteExistente?.descripcion || '').trim(),
    image_url: String(paqueteExistente?.image_url || '').trim(),
    activo: paqueteExistente ? Number(paqueteExistente?.activo) === 1 : true,
    items: itemsPaqueteTemporales.map((it) => ({ receta_nombre: String(it.receta_nombre || '').trim(), cantidad: Math.max(1, Number(it.cantidad) || 1) }))
  };

  try {
    const ruta = Number.isFinite(id) && id > 0 ? `${API}/tienda/admin/paquetes/${id}` : `${API}/tienda/admin/paquetes`;
    const metodo = Number.isFinite(id) && id > 0 ? 'PATCH' : 'POST';
    const respuesta = await fetch(ruta, {
      method: metodo,
      headers: headersConToken({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(data?.error || 'No se pudo guardar el paquete');

    cerrarModal('modalPaqueteReceta');
    mostrarNotificacion('Paquete guardado correctamente', 'exito');
    await cargarPaquetesRecetas();
  } catch (error) {
    mostrarNotificacion(error?.message || 'Error guardando paquete', 'error');
  }
}

async function eliminarPaqueteReceta(idPaquete) {
  const id = Number(idPaquete);
  if (!Number.isFinite(id) || id <= 0) return;
  const ok = await mostrarConfirmacion('¿Eliminar este paquete?', 'Esta acción no se puede deshacer.');
  if (!ok) return;
  try {
    const respuesta = await fetch(`${API}/tienda/admin/paquetes/${id}`, {
      method: 'DELETE',
      headers: headersConToken()
    });
    const data = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(data?.error || 'No se pudo eliminar paquete');
    mostrarNotificacion('Paquete eliminado', 'exito');
    await cargarPaquetesRecetas();
  } catch (error) {
    mostrarNotificacion(error?.message || 'Error eliminando paquete', 'error');
  }
}

async function cambiarVisiblePaqueteReceta(idPaquete, visible, inputEl = null) {
  const id = Number(idPaquete);
  if (!Number.isFinite(id) || id <= 0) return;
  const paquete = paquetesRecetasActual.find((p) => Number(p?.id) === id);
  if (!paquete) return;
  try {
    const respuesta = await fetch(`${API}/tienda/admin/paquetes/${id}`, {
      method: 'PATCH',
      headers: headersConToken({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ activo: Boolean(visible), nombre: paquete.nombre, descripcion: paquete.descripcion || '', image_url: paquete.image_url || '', items: paquete.items || [] })
    });
    const data = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(data?.error || 'No se pudo actualizar visibilidad');
    paquete.activo = Boolean(visible) ? 1 : 0;
    renderPaquetesRecetas();
    mostrarNotificacion(`Paquete ${visible ? 'visible' : 'oculto'} en tienda`, 'exito');
  } catch (error) {
    if (inputEl) inputEl.checked = !Boolean(visible);
    mostrarNotificacion(error?.message || 'Error al actualizar visibilidad', 'error');
  }
}

function renderDetallePaqueteContenido(paquete, indexActivo = 0) {
  const tabs = document.getElementById('tabsDetallePaqueteReceta');
  const cont = document.getElementById('contenidoDetallePaqueteReceta');
  if (!tabs || !cont) return;
  const detalles = Array.isArray(paquete?.detalle_producto) ? paquete.detalle_producto : [];
  if (!detalles.length) {
    tabs.innerHTML = '';
    cont.innerHTML = '<div style="color:#777">Sin detalle disponible para este paquete.</div>';
    return;
  }

  const idx = Math.max(0, Math.min(Number(indexActivo) || 0, detalles.length - 1));
  const actual = detalles[idx] || {};

  tabs.innerHTML = detalles.map((item, i) => (
    `<button class="boton ${i === idx ? 'activo' : ''}" onclick="window.recetas.abrirDetallePaqueteReceta(${Number(paquete?.id)}, ${i})">${String(item?.receta_nombre || 'Receta')} x${Number(item?.cantidad) || 1}</button>`
  )).join('');

  const ingredientes = Array.isArray(actual?.ingredientes) ? actual.ingredientes.map((x) => String(x || '').trim()).filter(Boolean) : [];
  cont.innerHTML = `
    <div style="display:grid;grid-template-columns:120px 1fr;gap:12px;align-items:start;">
      <div>${actual?.image_url ? `<img src="${actual.image_url}" alt="${String(actual?.receta_nombre || '')}" style="width:120px;height:120px;object-fit:cover;border-radius:12px;border:1px solid #ddd;" />` : '<div style="width:120px;height:120px;border-radius:12px;background:#f1f1f1;display:flex;align-items:center;justify-content:center;color:#777;">Sin imagen</div>'}</div>
      <div>
        <h4 style="margin:0 0 6px 0;">${String(actual?.receta_nombre || '')}</h4>
        <div style="font-size:12px;color:#555;margin-bottom:6px;">Piezas en paquete: ${Number(actual?.cantidad) || 1}</div>
        <div style="font-size:12px;color:#555;margin-bottom:6px;">Precio unitario: $${(Number(actual?.precio_unitario) || 0).toFixed(2)}</div>
        <div style="font-size:12px;color:#555;margin-bottom:10px;">Subtotal: $${(Number(actual?.subtotal) || 0).toFixed(2)}</div>
        <p style="margin:0 0 8px 0;">${String(actual?.descripcion || '').trim() || 'Sin descripción'}</p>
        <div style="font-size:12px;color:#333;"><strong>Ingredientes:</strong> ${ingredientes.join(', ') || 'N/D'}</div>
      </div>
    </div>
  `;
}

function abrirDetallePaqueteReceta(idPaquete, tabIndex = 0) {
  const id = Number(idPaquete);
  const paquete = paquetesRecetasActual.find((p) => Number(p?.id) === id);
  if (!paquete) return;
  detallePaqueteActual = paquete;
  const titulo = document.getElementById('tituloDetallePaqueteReceta');
  if (titulo) titulo.textContent = `Detalle: ${paquete.nombre || 'Paquete'}`;
  renderDetallePaqueteContenido(paquete, tabIndex);
  abrirModal('modalDetallePaqueteReceta');
}

function renderPaquetesRecetas() {
  const cont = document.getElementById('cuerpoPaquetesRecetas');
  if (!cont) return;
  if (!paquetesRecetasActual.length) {
    cont.innerHTML = '<div style="text-align:center;padding:30px;color:#999">No hay paquetes registrados</div>';
    return;
  }

  cont.innerHTML = paquetesRecetasActual.map((p) => `
    <div class="tarjetaReceta">
      <div style="padding:18px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
          <div style="flex:1">
            <h3 style="margin:0 0 5px 0;color:#1a1a1a;font-size:16px">📦 ${String(p?.nombre || 'Paquete')}</h3>
            <p style="margin:0;color:#666;font-size:11px">${(Array.isArray(p?.items) ? p.items.length : 0)} receta(s) • Total: $${(Number(p?.precio_total) || 0).toFixed(2)}</p>
          </div>
          <div style="font-size:11px;color:${Number(p?.activo) === 1 ? '#2e7d32' : '#6b7280'};font-weight:600">${Number(p?.activo) === 1 ? 'Visible en tienda' : 'Archivado en tienda'}</div>
        </div>
        <p style="margin:0 0 10px 0;color:#444;font-size:12px">${String(p?.descripcion || '').trim() || 'Sin descripción'}</p>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          <button onclick="window.recetas.abrirProduccionPaquete(${Number(p?.id)})" class="botonPequeno" style="background:#ff9800" title="Producción">🎰</button>
          <button onclick="window.recetas.abrirDetallePaqueteReceta(${Number(p?.id)}, 0)" class="botonPequeno" style="background:#3b82f6" title="Detalle del paquete">👁️</button>
          <button onclick="window.recetas.editarPaqueteReceta(${Number(p?.id)})" class="botonPequeno" title="Editar paquete">✏️</button>
          <button onclick="window.recetas.abrirFichaTiendaPaquete(${Number(p?.id)})" class="botonPequeno" style="background:#4a7c59" title="Editar ficha de tienda">🛍️</button>
          <label class="switchMini" title="Visible en tienda" style="align-self:center;">
            <input
              type="checkbox"
              ${Number(p?.activo) === 1 ? 'checked' : ''}
              onchange="window.recetas.cambiarVisiblePaqueteReceta(${Number(p?.id)}, this.checked, this)"
            />
            <span class="switchMiniSlider"></span>
          </label>
          <button onclick="window.recetas.eliminarPaqueteReceta(${Number(p?.id)})" class="botonPequeno botonDanger" title="Eliminar paquete">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function abrirFichaTiendaPaquete(idPaquete) {
  const id = Number(idPaquete);
  const paquete = paquetesRecetasActual.find((p) => Number(p?.id) === id);
  if (!paquete) return;

  recetaTiendaEditando = {
    id: id,
    nombre: String(paquete?.nombre || ''),
    __tipo: 'paquete',
    activo: Number(paquete?.activo) === 1,
    descripcion: String(paquete?.descripcion || ''),
    image_url: String(paquete?.image_url || ''),
    items: Array.isArray(paquete?.items) ? paquete.items : []
  };
  fichaTiendaGaleriaActual = String(paquete?.image_url || '').trim() ? [String(paquete.image_url).trim()] : [];
  fichaTiendaIngredientesActual = [];

  const titulo = document.getElementById('tituloModalFichaTienda');
  if (titulo) titulo.textContent = 'Ficha para tienda (Paquete)';
  const precioWrap = document.getElementById('fichaTiendaPrecioWrap');
  if (precioWrap) precioWrap.style.display = 'none';
  const modoUso = document.getElementById('fichaTiendaModoUso');
  if (modoUso) modoUso.style.display = 'none';
  const cuidados = document.getElementById('fichaTiendaCuidados');
  if (cuidados) cuidados.style.display = 'none';
  const ingredientesWrap = document.getElementById('fichaTiendaIngredientesWrap');
  if (ingredientesWrap) ingredientesWrap.style.display = 'none';

  const campoNombre = document.getElementById('fichaTiendaNombreReceta');
  const campoImagenes = document.getElementById('fichaTiendaImagenes');
  const campoDescripcion = document.getElementById('fichaTiendaDescripcion');
  const campoPrecioPublico = document.getElementById('fichaTiendaPrecioPublico');
  if (campoNombre) campoNombre.value = String(paquete?.nombre || '');
  if (campoImagenes) campoImagenes.value = '';
  if (campoDescripcion) campoDescripcion.value = String(paquete?.descripcion || '');
  if (campoPrecioPublico) campoPrecioPublico.value = '';

  renderFichaTiendaPreviews();
  renderFichaTiendaIngredientes();
  abrirModal('modalFichaTiendaReceta');
}

async function cargarPaquetesRecetas() {
  try {
    await cargarProductosTiendaAdminCache();

    const respuesta = await fetch(`${API}/tienda/admin/paquetes`, { headers: headersConToken() });
    const paquetes = await respuesta.json().catch(() => []);
    if (!respuesta.ok) throw new Error('No se pudieron cargar paquetes');

    const mapaProducto = new Map((productosTiendaAdminCache || []).map((p) => [String(p?.nombre_receta || '').trim(), p]));
    paquetesRecetasActual = (Array.isArray(paquetes) ? paquetes : []).map((paquete) => {
      const items = Array.isArray(paquete?.items) ? paquete.items : [];
      const detalle = items.map((it) => {
        const nombre = String(it?.receta_nombre || '').trim();
        const producto = mapaProducto.get(nombre) || {};
        const cantidad = Math.max(1, Number(it?.cantidad) || 1);
        const precioUnit = Number(producto?.precio_original ?? producto?.precio_venta) || 0;
        return {
          receta_nombre: nombre,
          cantidad,
          image_url: String(producto?.image_url || ''),
          descripcion: String(producto?.descripcion || ''),
          ingredientes: Array.isArray(producto?.ingredientes) ? producto.ingredientes : [],
          precio_unitario: precioUnit,
          subtotal: precioUnit * cantidad
        };
      });
      const precioTotal = detalle.reduce((sum, d) => sum + (Number(d?.subtotal) || 0), 0);
      return { ...paquete, items, detalle_producto: detalle, precio_total: precioTotal };
    });

    renderPaquetesRecetas();
    renderSelectRecetasPaquete();
  } catch (error) {
    console.error('Error cargando paquetes:', error);
  }
}

async function agregarReceta(event) {
  return guardarReceta(event);
}

function limpiarFormularioNuevaReceta() {
  const formulario = document.getElementById('formularioReceta');
  formulario?.reset();

  const unidad = document.getElementById('unidadIngrediente');
  if (unidad) {
    unidad.value = '';
    unidad.disabled = true;
  }

  const idInsumo = document.getElementById('idInsumoSeleccionado');
  if (idInsumo) idInsumo.value = '';

  const listaBusqueda = document.getElementById('listaBusquedaInsumos');
  if (listaBusqueda) listaBusqueda.innerHTML = '';

  ingredientesTemporales = [];
  actualizarTablaIngredientes();
}

function abrirModalNuevaReceta() {
  limpiarFormularioNuevaReceta();
  abrirModal('modalReceta');
  setTimeout(() => {
    const campoNombre = document.getElementById('nombreReceta');
    campoNombre?.focus();
    campoNombre?.select?.();
  }, 30);
}

function cerrarModalNuevaReceta() {
  limpiarFormularioNuevaReceta();
  cerrarModal('modalReceta');
}

async function guardarReceta(event) {
  if (event) event.preventDefault();
  const nombre = document.getElementById('nombreReceta')?.value;
  const id_categoria = parseInt(document.getElementById('categoriaReceta')?.value);
  const gramaje = parseFloat(document.getElementById('gramajeReceta')?.value || '0');

  if (!nombre || !id_categoria || isNaN(gramaje)) {
    mostrarNotificacion('Completa nombre y categoría', 'error');
    return;
  }

  const ingredientes = ingredientesTemporales.map(ing => ({
    id_insumo: ing.id_insumo,
    nombre: ing.nombre,
    proveedor: ing.proveedor || '',
    cantidad: ing.cantidad,
    unidad: ing.unidad
  }));

  try {
    const respuesta = await fetch(`${API}/recetas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, id_categoria, gramaje, ingredientes })
    });

    if (respuesta.ok) {
      cerrarModalNuevaReceta();
      mostrarNotificacion('Receta guardada', 'exito');
      await cargarListadoRecetas();
      await cargarPestanasCategorias();
    } else {
      const err = await respuesta.json();
      mostrarNotificacion(err.error || 'No se pudo guardar', 'error');
    }
  } catch (error) {
    console.error(error);
    mostrarNotificacion('Error al guardar receta', 'error');
  }
}

async function editarReceta(id) {
  try {
    const respuesta = await fetch(`${API}/recetas/${id}`);
    if (!respuesta.ok) return;
    const receta = await respuesta.json();
    document.getElementById('idEditReceta').value = receta.id;
    document.getElementById('editNombreReceta').value = receta.nombre || '';
    document.getElementById('editCategoriaReceta').value = receta.id_categoria || '';
    document.getElementById('editGramajeReceta').value = receta.gramaje || 0;

    ingredientesTemporales = (receta.ingredientes || []).map(ing => ({
      id_insumo: ing.id_insumo,
      nombre: ing.nombre,
      proveedor: ing.proveedor || '',
      cantidad: ing.cantidad,
      unidad: ing.unidad,
      pendiente: ing.pendiente === true || ing.pendiente === 1
    }));
    actualizarTablaIngredientes();

    abrirModal('modalEditarReceta');
    setTimeout(() => {
      const campoBuscar = document.getElementById('editInsumoSeleccionado');
      campoBuscar?.focus();
      campoBuscar?.select?.();
    }, 30);
  } catch (error) {
    console.error(error);
  }
}

function intentarGuardarConDobleEnter(esEdicion = false) {
  const ahora = Date.now();
  const ultimo = esEdicion ? ultimoEnterEditarRecetaMs : ultimoEnterNuevaRecetaMs;
  if (ahora - ultimo <= 800) {
    if (esEdicion) {
      guardarEditarReceta();
      ultimoEnterEditarRecetaMs = 0;
    } else {
      guardarReceta();
      ultimoEnterNuevaRecetaMs = 0;
    }
    return true;
  }
  if (esEdicion) ultimoEnterEditarRecetaMs = ahora;
  else ultimoEnterNuevaRecetaMs = ahora;
  return false;
}

function manejarEnterModalReceta(event, campo, esEdicion = false) {
  if (event.key !== 'Enter') return;
  if (event.shiftKey) return;

  const prefijo = esEdicion ? 'edit' : '';
  const idBusqueda = esEdicion ? 'editInsumoSeleccionado' : 'insumoSeleccionado';
  const idInsumo = esEdicion ? 'editIdInsumoSeleccionado' : 'idInsumoSeleccionado';
  const idCantidad = esEdicion ? 'editCantidadIngrediente' : 'cantidadIngrediente';
  const idProveedor = esEdicion ? 'editProveedorIngrediente' : 'proveedorIngrediente';

  const moverFoco = (id) => {
    event.preventDefault();
    setTimeout(() => {
      const el = document.getElementById(id);
      el?.focus();
      if (el && (el.tagName === 'INPUT')) el.select?.();
    }, 0);
  };

  if (campo === 'nombre') {
    moverFoco(`${prefijo}CategoriaReceta`);
    return;
  }

  if (campo === 'categoria') {
    moverFoco(`${prefijo}GramajeReceta`);
    return;
  }

  if (campo === 'gramaje') {
    moverFoco(idBusqueda);
    return;
  }

  if (campo === 'busqueda') {
    event.preventDefault();
    const textoBusqueda = String(document.getElementById(idBusqueda)?.value || '').trim();
    const insumoSeleccionado = String(document.getElementById(idInsumo)?.value || '').trim();

    // Doble Enter en búsqueda vacía guarda receta.
    if (!textoBusqueda && !insumoSeleccionado) {
      if (ingredientesTemporales.length > 0) {
        intentarGuardarConDobleEnter(esEdicion);
      }
      return;
    }

    moverFoco(idCantidad);
    return;
  }

  if (campo === 'cantidad') {
    event.preventDefault();
    agregarIngrediente(esEdicion);
    moverFoco(idBusqueda);
    return;
  }

  if (campo === 'proveedor') {
    event.preventDefault();
    agregarIngrediente(esEdicion);
    moverFoco(idBusqueda);
  }
}

async function guardarEditarReceta(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('idEditReceta')?.value;
  const nombre = document.getElementById('editNombreReceta')?.value;
  const id_categoria = parseInt(document.getElementById('editCategoriaReceta')?.value);
  const gramaje = parseFloat(document.getElementById('editGramajeReceta')?.value || '0');

  if (!id || !nombre || !id_categoria) {
    mostrarNotificacion('Completa nombre y categoría', 'error');
    return;
  }

  const ingredientes = ingredientesTemporales.map(ing => ({
    id_insumo: ing.id_insumo,
    nombre: ing.nombre,
    proveedor: ing.proveedor || '',
    cantidad: ing.cantidad,
    unidad: ing.unidad
  }));

  try {
    const respuesta = await fetch(`${API}/recetas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, id_categoria, gramaje, ingredientes })
    });

    if (respuesta.ok) {
      cerrarModal('modalEditarReceta');
      ingredientesTemporales = [];
      actualizarTablaIngredientes();
      mostrarNotificacion('Receta actualizada', 'exito');
      await cargarListadoRecetas();
      await cargarPestanasCategorias();
    }
  } catch (error) {
    console.error(error);
    mostrarNotificacion('Error al actualizar receta', 'error');
  }
}

async function eliminarReceta(id) {
  const ok = await mostrarConfirmacion('¿Eliminar esta receta?', 'Eliminar receta');
  if (!ok) return;

  try {
    const respuesta = await fetch(`${API}/recetas/${id}`, { method: 'DELETE' });
    if (respuesta.ok) {
      mostrarNotificacion('Receta eliminada', 'exito');
      await cargarListadoRecetas();
      await cargarPestanasCategorias();
    }
  } catch (error) {
    console.error(error);
    mostrarNotificacion('Error al eliminar receta', 'error');
  }
}

function filtrarRecetas(termBusqueda) {
  const tarjetas = document.querySelectorAll('#cuerpoRecetas .tarjetaReceta');
  const termino = normalizarTextoBusqueda(termBusqueda);
  tarjetas.forEach(tarjeta => {
    const nombre = normalizarTextoBusqueda(tarjeta.querySelector('h3')?.textContent || '');
    tarjeta.style.display = nombre.includes(termino) ? '' : 'none';
  });
}

async function buscarInsumoParaReceta(termino) {
  const editarModal = document.getElementById('modalEditarReceta');
  const esEdicion = editarModal && window.getComputedStyle(editarModal).display !== 'none';
  const idListaBusqueda = esEdicion ? 'editListaBusquedaInsumos' : 'listaBusquedaInsumos';
  const idInsumoInput = esEdicion ? 'editInsumoSeleccionado' : 'insumoSeleccionado';
  const idInsumoId = esEdicion ? 'editIdInsumoSeleccionado' : 'idInsumoSeleccionado';
  const idUnidadField = esEdicion ? 'editUnidadIngrediente' : 'unidadIngrediente';
  const idProveedorField = esEdicion ? 'editProveedorIngrediente' : 'proveedorIngrediente';

  const listaBusqueda = document.getElementById(idListaBusqueda);
  if (!listaBusqueda) return;

  if ((termino || '').length < 1) {
    listaBusqueda.innerHTML = '';
    listaBusqueda.style.display = 'none';
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
      opcion.textContent = `${insumo.nombre} (${insumo.codigo}${insumo.unidad ? ` • ${getAbrev(insumo.unidad)}` : ''})`;
      opcion.onclick = () => {
        document.getElementById(idInsumoInput).value = insumo.nombre;
        document.getElementById(idInsumoId).value = insumo.id;
        const unidadSelect = document.getElementById(idUnidadField);
        if (unidadSelect) {
          unidadSelect.value = normalizarUnidadReceta(insumo.unidad || '');
          unidadSelect.disabled = true;
        }
        const proveedorInput = document.getElementById(idProveedorField);
        if (proveedorInput) {
          proveedorInput.value = insumo.proveedor || '';
        }
        listaBusqueda.innerHTML = '';
        listaBusqueda.style.display = 'none';
      };
      listaBusqueda.appendChild(opcion);
    });

    if (!encontrado) {
      const opcionPendiente = document.createElement('div');
      opcionPendiente.className = 'elementoSugerencia elementoPendiente';
      opcionPendiente.style.color = 'red';
      opcionPendiente.textContent = `➕ Agregar "${termino}" como insumo pendiente`;
      opcionPendiente.onclick = async () => {
        const resp = await fetch(`${API}/inventario/agregar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: termino, pendiente: true })
        });
        if (resp.ok) {
          const data = await resp.json();
          document.getElementById(idInsumoInput).value = termino;
          document.getElementById(idInsumoId).value = data.id;
          const unidadSelect = document.getElementById(idUnidadField);
          if (unidadSelect) {
            unidadSelect.value = '';
            unidadSelect.disabled = false;
          }
          const proveedorInput = document.getElementById(idProveedorField);
          if (proveedorInput) proveedorInput.value = '';
          listaBusqueda.innerHTML = '';
          listaBusqueda.style.display = 'none';
          if (window.agregarAlerta) window.agregarAlerta(`pendiente:${data.id}`, `Insumo pendiente: ${termino}`, 'advertencia');
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

function agregarIngrediente(esEdicion = false) {
  const idFieldId = esEdicion ? 'editIdInsumoSeleccionado' : 'idInsumoSeleccionado';
  const nombreFieldId = esEdicion ? 'editInsumoSeleccionado' : 'insumoSeleccionado';
  const cantidadFieldId = esEdicion ? 'editCantidadIngrediente' : 'cantidadIngrediente';
  const unidadFieldId = esEdicion ? 'editUnidadIngrediente' : 'unidadIngrediente';
  const proveedorFieldId = esEdicion ? 'editProveedorIngrediente' : 'proveedorIngrediente';

  const idInsumo = parseInt(document.getElementById(idFieldId)?.value);
  const nombreInsumo = document.getElementById(nombreFieldId)?.value;
  const cantidad = parseFloat(document.getElementById(cantidadFieldId)?.value);
  const unidad = normalizarUnidadReceta(document.getElementById(unidadFieldId)?.value);
  const proveedor = (document.getElementById(proveedorFieldId)?.value || '').trim();

  if (!idInsumo || !nombreInsumo || isNaN(cantidad) || !unidad) {
    mostrarNotificacion('Por favor completa todos los campos', 'error');
    return;
  }

  if (ingredientesTemporales.some(ing => ing.id_insumo === idInsumo)) {
    mostrarNotificacion('Este insumo ya está en la receta', 'error');
    return;
  }

  ingredientesTemporales.push({ id_insumo: idInsumo, nombre: nombreInsumo, proveedor, cantidad, unidad, pendiente: false });

  document.getElementById(idFieldId).value = '';
  document.getElementById(nombreFieldId).value = '';
  document.getElementById(cantidadFieldId).value = '';
  document.getElementById(unidadFieldId).value = '';
  document.getElementById(proveedorFieldId).value = '';
  document.getElementById(unidadFieldId).disabled = true;
  actualizarTablaIngredientes();
}

function eliminarIngrediente(indice) {
  ingredientesTemporales.splice(indice, 1);
  actualizarTablaIngredientes();
}

function actualizarTablaIngredientes() {
  const tabla = document.getElementById('tablaIngredientesTemporales');
  const editTabla = document.getElementById('editTablaIngredientesTemporales');

  const render = (target) => {
    if (!target) return;
    target.innerHTML = '';
    ingredientesTemporales.forEach((ing, idx) => {
      const fila = document.createElement('tr');
      if (ing.pendiente) fila.style.color = '#d32f2f';
      fila.innerHTML = `
        <td>${ing.nombre}</td>
        <td>${ing.proveedor || '<span style="color:#999">Sin proveedor</span>'}</td>
        <td>${parseFloat(ing.cantidad).toFixed(2)} ${getAbrev(ing.unidad)}</td>
        <td><button onclick="window.recetas.eliminarIngrediente(${idx})" class="botonPequeno botonDanger">×</button></td>
      `;
      target.appendChild(fila);
    });
  };

  render(tabla);
  render(editTabla);
}

async function mostrarIngredientes(idReceta) {
  try {
    const respuesta = await fetch(`${API}/recetas/${idReceta}`);
    if (!respuesta.ok) {
      mostrarNotificacion('Error al cargar la receta', 'error');
      return;
    }
    const receta = await respuesta.json();

    let html = `<h3 class="tituloIngredientesRecetaModal">${receta.nombre}</h3><ul id="listaIngredientesModal" class="listaIngredientesRecetaModal">`;
    if (!receta.ingredientes || receta.ingredientes.length === 0) {
      html += '<li class="itemIngredienteRecetaVacio">Sin ingredientes agregados</li>';
    } else {
      receta.ingredientes.forEach(ing => {
        const pendiente = ing.pendiente === true || ing.pendiente === 1;
        const nombreIngredienteSeguro = escaparParaInlineJs(ing?.nombre);
        html += `<li class="itemIngredienteRecetaModal ${pendiente ? 'itemIngredienteRecetaPendiente' : ''}">
          <div class="itemIngredienteRecetaInfo itemIngredienteRecetaLineaPrincipal">
            <span class="itemIngredienteRecetaNombre"><strong>${ing.nombre}</strong>: ${parseFloat(ing.cantidad).toFixed(2)} ${getAbrev(ing.unidad)}${ing.proveedor ? ` (${ing.proveedor})` : ''}</span>
          </div>
          <div class="itemIngredienteRecetaFilaEdicion">
            <div class="itemIngredienteRecetaControles">
              <span class="itemIngredienteRecetaEditarTexto">Editar:</span>
              <input type="number" id="cantidad_${ing.id}" value="${parseFloat(ing.cantidad).toFixed(2)}" step="0.01" class="inputCantidadIngredienteRecetaModal">
              <span class="unidadIngredienteRecetaModal">${getAbrev(ing.unidad)}</span>
            </div>
            <div class="itemIngredienteRecetaAcciones">
              <button onclick="window.recetas.guardarCantidadIngrediente(${idReceta}, ${ing.id})" class="botonPequeno botonGuardarIngredienteReceta" title="Guardar cantidad">💾</button>
              <button onclick="window.recetas.eliminarIngredienteDeReceta(${idReceta}, ${ing.id}, '${nombreIngredienteSeguro}')" class="botonPequeno botonDanger" title="Eliminar ingrediente">×</button>
            </div>
          </div>
        </li>`;
      });
    }
    html += '</ul>';
    const detalles = document.getElementById('detallesIngredientes');
    if (!detalles) return;
    detalles.innerHTML = html;
    abrirModal('modalIngredientes');
  } catch (error) {
    console.error('Error cargando ingredientes:', error);
    mostrarNotificacion('Error al cargar los ingredientes', 'error');
  }
}

async function abrirFichaTiendaReceta(idReceta) {
  try {
    const respuesta = await fetch(`${API}/recetas/${idReceta}`);
    if (!respuesta.ok) {
      mostrarNotificacion('No se pudo cargar la receta', 'error');
      return;
    }

    const receta = await respuesta.json();
    recetaTiendaEditando = { ...receta, __tipo: 'receta' };
    const titulo = document.getElementById('tituloModalFichaTienda');
    if (titulo) titulo.textContent = 'Ficha para tienda (Receta)';
    const precioWrap = document.getElementById('fichaTiendaPrecioWrap');
    if (precioWrap) precioWrap.style.display = '';
    const modoUso = document.getElementById('fichaTiendaModoUso');
    if (modoUso) modoUso.style.display = '';
    const cuidados = document.getElementById('fichaTiendaCuidados');
    if (cuidados) cuidados.style.display = '';
    const ingredientesWrap = document.getElementById('fichaTiendaIngredientesWrap');
    if (ingredientesWrap) ingredientesWrap.style.display = '';
    const ingredientesOrdenados = (Array.isArray(receta.ingredientes) ? receta.ingredientes : [])
      .map((ing) => ({
        nombre: String(ing?.nombre || '').trim(),
        cantidad: Number.parseFloat(String(ing?.cantidad ?? 0).replace(',', '.')) || 0
      }))
      .filter((item) => Boolean(item.nombre))
      .sort((a, b) => {
        if (b.cantidad !== a.cantidad) return b.cantidad - a.cantidad;
        return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
      });

    const ingredientesAuto = [];
    const vistosIngredientes = new Set();
    ingredientesOrdenados.forEach((item) => {
      const clave = item.nombre.toLowerCase();
      if (vistosIngredientes.has(clave)) return;
      vistosIngredientes.add(clave);
      ingredientesAuto.push(item.nombre);
    });
    const ingredientesVisibles = new Set(
      String(receta?.tienda_ingredientes || '')
        .split(/\r?\n|,/) 
        .map((linea) => String(linea || '').trim())
        .filter(Boolean)
    );

    const baseIngredientes = ingredientesAuto.length
      ? ingredientesAuto
      : Array.from(ingredientesVisibles);

    const hayCoincidenciaVisible = baseIngredientes.some((nombre) => ingredientesVisibles.has(nombre));

    fichaTiendaIngredientesActual = baseIngredientes.map((nombre) => ({
      nombre,
      visible: (ingredientesVisibles.size && hayCoincidenciaVisible)
        ? ingredientesVisibles.has(nombre)
        : true
    }));

    const galeriaReceta = Array.isArray(receta?.tienda_galeria)
      ? receta.tienda_galeria
      : (() => {
          try {
            const parsed = JSON.parse(String(receta?.tienda_galeria || '[]'));
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })();

    const principal = String(receta?.tienda_image_url || '').trim();
    const sec = galeriaReceta.map((item) => String(item || '').trim()).filter(Boolean);
    const combinada = [];
    if (principal) combinada.push(principal);
    sec.forEach((url) => {
      if (!combinada.includes(url)) combinada.push(url);
    });
    fichaTiendaGaleriaActual = combinada;

    const campoNombre = document.getElementById('fichaTiendaNombreReceta');
    const campoImagenes = document.getElementById('fichaTiendaImagenes');
    const campoDescripcion = document.getElementById('fichaTiendaDescripcion');
    const campoPrecioPublico = document.getElementById('fichaTiendaPrecioPublico');
    const campoModoUso = document.getElementById('fichaTiendaModoUso');
    const campoCuidados = document.getElementById('fichaTiendaCuidados');

    if (campoNombre) campoNombre.value = receta?.nombre || '';
    if (campoImagenes) campoImagenes.value = '';
    if (campoDescripcion) campoDescripcion.value = receta?.tienda_descripcion || '';
    if (campoPrecioPublico) {
      const precio = Number(receta?.tienda_precio_publico) || 0;
      campoPrecioPublico.value = precio > 0 ? precio : '';
    }
    if (campoModoUso) campoModoUso.value = receta?.tienda_modo_uso || '';
    if (campoCuidados) campoCuidados.value = receta?.tienda_cuidados || '';

    renderFichaTiendaPreviews();
    renderFichaTiendaIngredientes();

    abrirModal('modalFichaTiendaReceta');
  } catch (error) {
    console.error('Error abriendo ficha de tienda:', error);
    mostrarNotificacion('No se pudo abrir la ficha de tienda', 'error');
  }
}

async function guardarFichaTiendaReceta() {
  if (!recetaTiendaEditando?.id) return;
  try {
    const inputImagenes = document.getElementById('fichaTiendaImagenes');
    const archivosNuevos = Array.from(inputImagenes?.files || []);
    if (archivosNuevos.length) {
      for (const archivo of archivosNuevos) {
        const url = await subirImagenTienda(archivo);
        if (url) fichaTiendaGaleriaActual.push(url);
      }
      fichaTiendaGaleriaActual = Array.from(new Set(fichaTiendaGaleriaActual));
    }

    const galeriaOrdenada = fichaTiendaGaleriaActual
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    const imagenPrincipal = galeriaOrdenada[0] || '';
    const galeriaSecundaria = galeriaOrdenada.slice(1);

    if (recetaTiendaEditando.__tipo === 'paquete') {
      const payloadPaquete = {
        nombre: String(recetaTiendaEditando?.nombre || '').trim(),
        descripcion: String(document.getElementById('fichaTiendaDescripcion')?.value || '').trim(),
        image_url: imagenPrincipal,
        activo: Boolean(recetaTiendaEditando?.activo),
        items: Array.isArray(recetaTiendaEditando?.items) ? recetaTiendaEditando.items : []
      };

      const respPaquete = await fetch(`${API}/tienda/admin/paquetes/${recetaTiendaEditando.id}`, {
        method: 'PATCH',
        headers: headersConToken({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payloadPaquete)
      });
      if (!respPaquete.ok) {
        const errPaquete = await respPaquete.json().catch(() => ({}));
        throw new Error(errPaquete?.error || 'No se pudo guardar ficha de paquete');
      }

      cerrarModal('modalFichaTiendaReceta');
      mostrarNotificacion('Ficha de tienda guardada en el paquete', 'exito');
      await cargarPaquetesRecetas();
      return;
    }

    const ingredientesVisibles = fichaTiendaIngredientesActual
      .filter((item) => Boolean(item?.visible))
      .map((item) => String(item?.nombre || '').trim())
      .filter(Boolean);

    const payload = {
      nombre: recetaTiendaEditando.nombre,
      id_categoria: recetaTiendaEditando.id_categoria,
      gramaje: recetaTiendaEditando.gramaje,
      ingredientes: (recetaTiendaEditando.ingredientes || []).map((ing) => ({
        id_insumo: ing.id_insumo,
        nombre: ing.nombre,
        proveedor: ing.proveedor || '',
        cantidad: ing.cantidad,
        unidad: ing.unidad
      })),
      tienda_image_url: imagenPrincipal,
      tienda_galeria: galeriaSecundaria,
      tienda_descripcion: document.getElementById('fichaTiendaDescripcion')?.value || '',
      tienda_precio_publico: Number(document.getElementById('fichaTiendaPrecioPublico')?.value) || 0,
      tienda_modo_uso: document.getElementById('fichaTiendaModoUso')?.value || '',
      tienda_cuidados: document.getElementById('fichaTiendaCuidados')?.value || '',
      tienda_ingredientes: ingredientesVisibles.join('\n')
    };

    const respuesta = await fetch(`${API}/recetas/${recetaTiendaEditando.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!respuesta.ok) {
      const err = await respuesta.json().catch(() => ({}));
      throw new Error(err?.error || 'No se pudo guardar ficha tienda');
    }

    cerrarModal('modalFichaTiendaReceta');
    mostrarNotificacion('Ficha de tienda guardada en la receta', 'exito');
    await cargarListadoRecetas();
  } catch (error) {
    console.error('Error guardando ficha tienda:', error);
    mostrarNotificacion(error?.message || 'Error al guardar ficha de tienda', 'error');
  }
}

function abrirSelectorImagenFichaTienda() {
  const inputImagenes = document.getElementById('fichaTiendaImagenes');
  if (!inputImagenes) return;
  inputImagenes.click();
}

async function persistirFichaTiendaImagenesActual() {
  if (!recetaTiendaEditando?.id) return;

  const galeriaOrdenada = fichaTiendaGaleriaActual
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  const imagenPrincipal = galeriaOrdenada[0] || '';
  const galeriaSecundaria = galeriaOrdenada.slice(1);

  if (recetaTiendaEditando.__tipo === 'paquete') {
    const payloadPaquete = {
      nombre: String(recetaTiendaEditando?.nombre || '').trim(),
      descripcion: String(document.getElementById('fichaTiendaDescripcion')?.value || '').trim(),
      image_url: imagenPrincipal,
      activo: Boolean(recetaTiendaEditando?.activo),
      items: Array.isArray(recetaTiendaEditando?.items) ? recetaTiendaEditando.items : []
    };

    const respPaquete = await fetch(`${API}/tienda/admin/paquetes/${recetaTiendaEditando.id}`, {
      method: 'PATCH',
      headers: headersConToken({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payloadPaquete)
    });
    if (!respPaquete.ok) {
      const errPaquete = await respPaquete.json().catch(() => ({}));
      throw new Error(errPaquete?.error || 'No se pudo guardar imágenes del paquete');
    }
    return;
  }

  const ingredientesVisibles = fichaTiendaIngredientesActual
    .filter((item) => Boolean(item?.visible))
    .map((item) => String(item?.nombre || '').trim())
    .filter(Boolean);

  const payload = {
    nombre: recetaTiendaEditando.nombre,
    id_categoria: recetaTiendaEditando.id_categoria,
    gramaje: recetaTiendaEditando.gramaje,
    ingredientes: (recetaTiendaEditando.ingredientes || []).map((ing) => ({
      id_insumo: ing.id_insumo,
      nombre: ing.nombre,
      proveedor: ing.proveedor || '',
      cantidad: ing.cantidad,
      unidad: ing.unidad
    })),
    tienda_image_url: imagenPrincipal,
    tienda_galeria: galeriaSecundaria,
    tienda_descripcion: document.getElementById('fichaTiendaDescripcion')?.value || '',
    tienda_precio_publico: Number(document.getElementById('fichaTiendaPrecioPublico')?.value) || 0,
    tienda_modo_uso: document.getElementById('fichaTiendaModoUso')?.value || '',
    tienda_cuidados: document.getElementById('fichaTiendaCuidados')?.value || '',
    tienda_ingredientes: ingredientesVisibles.join('\n')
  };

  const respuesta = await fetch(`${API}/recetas/${recetaTiendaEditando.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!respuesta.ok) {
    const err = await respuesta.json().catch(() => ({}));
    throw new Error(err?.error || 'No se pudo guardar imágenes de la ficha');
  }
}

async function agregarImagenesFichaTiendaDesdeInput() {
  const inputImagenes = document.getElementById('fichaTiendaImagenes');
  const archivosNuevos = Array.from(inputImagenes?.files || []);
  if (!archivosNuevos.length) return;

  try {
    for (const archivo of archivosNuevos) {
      const url = await subirImagenTienda(archivo);
      if (url) fichaTiendaGaleriaActual.push(url);
    }
    fichaTiendaGaleriaActual = Array.from(new Set(fichaTiendaGaleriaActual));
    renderFichaTiendaPreviews();
    await persistirFichaTiendaImagenesActual();
    mostrarNotificacion('Imagen agregada y guardada automáticamente', 'exito');
  } catch (error) {
    console.error('Error subiendo imagen de ficha:', error);
    mostrarNotificacion(error?.message || 'No se pudo subir la imagen', 'error');
  } finally {
    if (inputImagenes) inputImagenes.value = '';
  }
}

function quitarImagenGaleriaTienda(indice) {
  fichaTiendaGaleriaActual.splice(indice, 1);
  renderFichaTiendaPreviews();
}

function moverImagenGaleriaTienda(indice, direccion) {
  const origen = Number(indice);
  const destino = direccion === 'izq' ? origen - 1 : origen + 1;
  if (origen < 0 || origen >= fichaTiendaGaleriaActual.length) return;
  if (destino < 0 || destino >= fichaTiendaGaleriaActual.length) return;
  const copia = [...fichaTiendaGaleriaActual];
  const [movida] = copia.splice(origen, 1);
  copia.splice(destino, 0, movida);
  fichaTiendaGaleriaActual = copia;
  renderFichaTiendaPreviews();
}

function iniciarArrastreImagenGaleria(indice) {
  indiceDragGaleriaTienda = Number(indice);
}

function permitirDropImagenGaleria(event) {
  if (!event) return;
  event.preventDefault();
}

function soltarImagenGaleria(indiceDestino) {
  const destino = Number(indiceDestino);
  const origen = Number(indiceDragGaleriaTienda);
  if (!Number.isFinite(origen) || !Number.isFinite(destino)) return;
  if (origen < 0 || destino < 0) return;
  if (origen >= fichaTiendaGaleriaActual.length || destino >= fichaTiendaGaleriaActual.length) return;
  if (origen === destino) return;

  const copia = [...fichaTiendaGaleriaActual];
  const [movida] = copia.splice(origen, 1);
  copia.splice(destino, 0, movida);
  fichaTiendaGaleriaActual = copia;
  indiceDragGaleriaTienda = -1;
  renderFichaTiendaPreviews();
}

function renderFichaTiendaPreviews() {
  const contGaleria = document.getElementById('fichaTiendaGaleria');
  if (contGaleria) {
    if (!fichaTiendaGaleriaActual.length) {
      contGaleria.innerHTML = '<span style="color:#777;font-size:12px">Sin imágenes todavía</span>';
      return;
    }
    contGaleria.innerHTML = fichaTiendaGaleriaActual.map((url, idx) => `
      <div class="fichaTiendaGaleriaItem" draggable="true" ondragstart="window.recetas.iniciarArrastreImagenGaleria(${idx})" ondragover="window.recetas.permitirDropImagenGaleria(event)" ondrop="window.recetas.soltarImagenGaleria(${idx})">
        <img src="${url}" alt="Galería ${idx + 1}" />
        ${idx === 0 ? '<div class="fichaTiendaBadgePrincipal">Principal</div>' : ''}
        <div class="fichaTiendaGaleriaAcciones">
          <button type="button" class="botonPequeno" onclick="window.recetas.moverImagenGaleriaTienda(${idx}, 'izq')" title="Mover a la izquierda">←</button>
          <button type="button" class="botonPequeno" onclick="window.recetas.moverImagenGaleriaTienda(${idx}, 'der')" title="Mover a la derecha">→</button>
          <button type="button" class="botonPequeno botonDanger" onclick="window.recetas.quitarImagenGaleriaTienda(${idx})" title="Eliminar">×</button>
        </div>
      </div>
    `).join('');
  }
}

function toggleIngredienteTiendaVisible(indice) {
  const idx = Number(indice);
  if (!Number.isFinite(idx) || idx < 0 || idx >= fichaTiendaIngredientesActual.length) return;
  fichaTiendaIngredientesActual[idx].visible = !Boolean(fichaTiendaIngredientesActual[idx].visible);
  renderFichaTiendaIngredientes();
}

function renderFichaTiendaIngredientes() {
  const cont = document.getElementById('fichaTiendaListaIngredientes');
  if (!cont) return;

  if (!Array.isArray(fichaTiendaIngredientesActual) || !fichaTiendaIngredientesActual.length) {
    cont.innerHTML = '<div class="fichaIngredienteVacio">Esta receta no tiene ingredientes registrados.</div>';
    return;
  }

  cont.innerHTML = fichaTiendaIngredientesActual.map((item, idx) => `
    <label class="fichaIngredienteItem">
      <span class="fichaIngredienteNombre">${String(item?.nombre || '').trim()}</span>
      <span class="fichaIngredienteSwitchWrap">
        <span class="switchMini">
          <input type="checkbox" ${Boolean(item?.visible) ? 'checked' : ''} onchange="window.recetas.toggleIngredienteTiendaVisible(${idx})" />
          <span class="switchMiniSlider"></span>
        </span>
      </span>
    </label>
  `).join('');
}

async function subirImagenTienda(archivo) {
  const token = localStorage.getItem('token') || '';
  const formData = new FormData();
  formData.append('imagen', archivo);

  const respuesta = await fetch(`${API}/api/uploads/tienda-imagen`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData
  });

  const data = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(data?.mensaje || data?.error || 'No se pudo subir la imagen');
  }
  return String(data?.url || '').trim();
}

async function guardarCantidadIngrediente(idReceta, idIngrediente) {
  const nuevaCantidad = parseFloat(document.getElementById(`cantidad_${idIngrediente}`)?.value);
  if (isNaN(nuevaCantidad) || nuevaCantidad <= 0) {
    mostrarNotificacion('Por favor ingresa una cantidad válida', 'error');
    return;
  }

  try {
    const respuesta = await fetch(`${API}/recetas/${idReceta}`);
    const receta = await respuesta.json();
    const ingredientesActualizados = (receta.ingredientes || []).map(ing => {
      if (ing.id === idIngrediente) return { id_insumo: ing.id_insumo, nombre: ing.nombre, proveedor: ing.proveedor || '', cantidad: nuevaCantidad, unidad: ing.unidad };
      return { id_insumo: ing.id_insumo, nombre: ing.nombre, proveedor: ing.proveedor || '', cantidad: ing.cantidad, unidad: ing.unidad };
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
      cargarListadoRecetas();
    }
  } catch (error) {
    console.error('Error actualizando cantidad:', error);
    mostrarNotificacion('Error al actualizar la cantidad', 'error');
  }
}

async function eliminarIngredienteDeReceta(idReceta, idIngrediente, nombreIngrediente) {
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
        ingredientes: ingredientesFiltrados.map(ing => ({ id_insumo: ing.id_insumo, nombre: ing.nombre, proveedor: ing.proveedor || '', cantidad: ing.cantidad, unidad: ing.unidad }))
      })
    });

    if (respuestaActualizar.ok) {
      mostrarIngredientes(idReceta);
      cargarListadoRecetas();
      mostrarNotificacion('Ingrediente eliminado correctamente', 'exito');
    }
  } catch (error) {
    console.error('Error eliminando ingrediente:', error);
    mostrarNotificacion('Error al eliminar el ingrediente', 'error');
  }
}

async function abrirProduccionRapida(idReceta, nombreReceta, costoPorPieza = 0) {
  document.getElementById('idRecetaProducir').value = idReceta;
  document.getElementById('nombreRecetaProducir').value = nombreReceta;
  document.getElementById('cantidadProducir').value = 1;
  document.getElementById('costoPorPiezaProducir').value = Number(costoPorPieza || 0).toFixed(2);
  actualizarCostoProduccion();
  abrirModal('modalProduccionRapida');
}

function normalizarCostoPorPieza() {
  const input = document.getElementById('costoPorPiezaProducir');
  if (!input) return;
  const valor = parseFloat(input.value);
  if (!Number.isFinite(valor)) {
    input.value = '0.00';
  } else {
    input.value = valor.toFixed(2);
  }
  actualizarCostoProduccion();
}

function actualizarCostoProduccion() {
  const costoPorPieza = parseFloat(document.getElementById('costoPorPiezaProducir')?.value) || 0;
  const factorCosto = Number(ajustesProduccionActual?.factor_costo_produccion) || 1.15;
  const factorVenta = Number(ajustesProduccionActual?.factor_precio_venta) || 2.5;
  const redondeo = Number(ajustesProduccionActual?.redondeo_precio) || 5;
  const costoProduccionCalculado = costoPorPieza * factorCosto;
  const out = document.getElementById('costoProducir');
  if (out) out.value = costoProduccionCalculado.toFixed(2);

  const precioVenta = document.getElementById('precioVentaProducir');
  if (precioVenta) {
    const ventaCalculada = costoProduccionCalculado * factorVenta;
    const ventaRedondeada = redondeo > 0 ? (Math.ceil(ventaCalculada / redondeo) * redondeo) : ventaCalculada;
    precioVenta.value = ventaRedondeada.toFixed(2);
  }
}

async function producirDesdeReceta() {
  const nombreReceta = document.getElementById('nombreRecetaProducir')?.value;
  const idReceta = parseInt(document.getElementById('idRecetaProducir')?.value, 10);
  const cantidad = parseInt(document.getElementById('cantidadProducir')?.value, 10);
  const costoProduccion = parseFloat(document.getElementById('costoProducir')?.value);
  const precioVenta = parseFloat(document.getElementById('precioVentaProducir')?.value);

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
      window.dispatchEvent(new CustomEvent('produccionActualizada'));
    }
  } catch (error) {
    console.error('Error registrando producción:', error);
    mostrarNotificacion('Error al registrar la producción', 'error');
  }
}

function renderResumenProduccionPaquete() {
  const cont = document.getElementById('resumenProduccionPaquete');
  if (!cont) return;
  const cantidadPaquetes = Math.max(1, Number(document.getElementById('cantidadPaqueteProducir')?.value) || 1);
  const items = Array.isArray(paqueteProduccionActual?.items) ? paqueteProduccionActual.items : [];
  if (!items.length) {
    cont.innerHTML = '<div style="color:#777">Este paquete no tiene recetas configuradas.</div>';
    return;
  }
  const filas = items.map((it) => {
    const piezas = Math.max(1, Number(it?.cantidad) || 1) * cantidadPaquetes;
    return `<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;"><span>${String(it?.receta_nombre || 'Receta')}</span><strong>${piezas} pza(s)</strong></div>`;
  }).join('');
  cont.innerHTML = `<label>Resumen por receta</label><div style="display:grid;gap:6px">${filas}</div>`;
}

function abrirProduccionPaquete(idPaquete) {
  const id = Number(idPaquete);
  const paquete = paquetesRecetasActual.find((p) => Number(p?.id) === id);
  if (!paquete) return;
  paqueteProduccionActual = paquete;
  document.getElementById('idPaqueteProducir').value = String(id);
  document.getElementById('nombrePaqueteProducir').value = String(paquete?.nombre || '');
  document.getElementById('cantidadPaqueteProducir').value = '1';
  renderResumenProduccionPaquete();
  abrirModal('modalProduccionPaquete');
}

async function producirDesdePaquete() {
  const idPaquete = Number(document.getElementById('idPaqueteProducir')?.value || 0);
  const cantidadPaquetes = Math.max(1, Number(document.getElementById('cantidadPaqueteProducir')?.value) || 1);
  const paquete = paquetesRecetasActual.find((p) => Number(p?.id) === idPaquete) || paqueteProduccionActual;
  const items = Array.isArray(paquete?.items) ? paquete.items : [];
  if (!idPaquete || !items.length) {
    mostrarNotificacion('El paquete no tiene recetas configuradas', 'error');
    return;
  }

  try {
    const resp = await fetch(`${API}/produccion/paquete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_paquete: idPaquete,
        nombre_paquete: String(paquete?.nombre || ''),
        cantidad_paquetes: cantidadPaquetes,
        items
      })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error || 'No se pudo registrar producción del paquete');

    cerrarModal('modalProduccionPaquete');
    mostrarNotificacion(
      `Producción registrada: ${Number(data?.total_producciones) || 0} receta(s), ${Number(data?.total_piezas) || 0} pieza(s)`,
      'exito'
    );
    window.dispatchEvent(new CustomEvent('produccionActualizada'));
  } catch (error) {
    console.error('Error produciendo paquete:', error);
    mostrarNotificacion(error?.message || 'Error al producir paquete', 'error');
  }
}

async function abrirEscalarReceta(idReceta, nombreReceta, gramajeOriginal) {
  document.getElementById('idRecetaEscalar').value = idReceta;
  document.getElementById('gramajeOriginal').value = `${gramajeOriginal}g (${nombreReceta})`;
  document.getElementById('nuevoGramaje').value = '';
  abrirModal('modalEscalarReceta');
}

async function copiarRecetaEscalada() {
  const idRecetaOriginal = document.getElementById('idRecetaEscalar')?.value;
  const nuevoGramaje = parseFloat(document.getElementById('nuevoGramaje')?.value);

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
      nombre: ing.nombre,
      proveedor: ing.proveedor || '',
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
      cargarListadoRecetas();
      cargarPestanasCategorias();
    }
  } catch (error) {
    console.error('Error escalando receta:', error);
    mostrarNotificacion('Error al escalar la receta', 'error');
  }
}
