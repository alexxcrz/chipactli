import React, { useEffect } from 'react';
import './Recetas.css';
import { mostrarNotificacion } from '../../utils/notificaciones.jsx';
import { abrirModal, cerrarModal, mostrarConfirmacion } from '../../utils/modales.jsx';
import { API } from '../../utils/config.jsx';
import { importarDatos, exportarDatos } from '../../utils/importar-exportar.jsx';
import { normalizarTextoBusqueda } from '../../utils/texto.jsx';

const OC_SUGERIDOS_KEY = 'chipactli_oc_sugeridos';

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
      ,cargarOrdenesCompraRecetas
      ,cargarInsumosOrdenCompraRecetas
      ,seleccionarInsumoOrdenCompraRecetas
      ,agregarItemOrdenCompraRecetas
      ,eliminarItemOrdenCompraRecetas
      ,crearOrdenCompraRecetas
      ,aplicarSugerenciasAutomaticasOrdenCompraRecetas
      ,abrirFichaTiendaReceta
      ,guardarFichaTiendaReceta
      ,quitarImagenGaleriaTienda
      ,moverImagenGaleriaTienda
      ,iniciarArrastreImagenGaleria
      ,soltarImagenGaleria
      ,permitirDropImagenGaleria
    };

    window.agregarIngrediente = () => agregarIngrediente(false);

    cargarCategorias();
    cargarPestanasCategorias();
    cargarListadoRecetas();
    cambiarSubpestanaRecetas('recetas');

    const onSugeridosActualizados = () => {
      if (subpestanaRecetasActiva !== 'ordenes-compra') return;
      aplicarSugerenciasAutomaticasOrdenCompraRecetas();
    };
    window.addEventListener('chipactli:ordenes-compra-sugeridos-actualizados', onSugeridosActualizados);

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
      window.removeEventListener('chipactli:ordenes-compra-sugeridos-actualizados', onSugeridosActualizados);
    };
  }, []);

  return (
    <div className="tarjeta">
      <div className="encabezadoTarjeta">
        <h2>Gestión de Recetas</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <div className="botonesImportarExportar">
            <button className="botonImportar" onClick={() => document.getElementById('importarRecetas')?.click()}>📥 Importar</button>
            <input type="file" id="importarRecetas" className="inputArchivoOculto" accept=".json" onChange={e => importarDatos('recetas', e.target)} />
            <button className="botonExportar" onClick={() => exportarDatos('recetas')}>📤 Exportar</button>
          </div>
          <button className="boton" onClick={() => abrirModalEscaladoCategoria()}>📋 Escalar por categoría</button>
          <button className="boton" onClick={() => abrirModalArchivadoRecetas()}>🗂️ Archivar recetas</button>
          <button className="boton" onClick={() => abrirModal('modalCategoria')}>➕ Nueva Categoría</button>
          <button className="boton" onClick={() => abrirModal('modalReceta')}>➥ Nueva Receta</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
        <input type="text" className="cajaBusqueda" id="busquedaRecetas" placeholder="🔍 Buscar receta..." onChange={e => filtrarRecetas(e.target.value)} style={{ width: '220px' }} />
      </div>

      <div className="tabsSubseccionRecetas">
        <button id="btnSubTabRecetas" type="button" className="boton activo" onClick={() => cambiarSubpestanaRecetas('recetas')}>📚 Recetas</button>
      </div>

      <div id="panelSubpestanaRecetas">
        <div id="pestanasCategoriasRecetas" style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '15px', position: 'relative', overflow: 'visible' }}></div>
        <div id="cuerpoRecetas" className="gridRecetas"></div>
      </div>

      <div id="panelSubpestanaOrdenesCompra" style={{ display: 'none' }}>
        <div className="bloqueOrdenCompraRecetas">
          <h3>Crear orden de compra</h3>
          <div id="sugerenciasAutoOrdenCompraRecetas" className="listaOrdenesCompraRecetas" style={{ marginBottom: '10px' }}></div>
          <div className="filaOrdenCompraRecetas">
            <input id="busquedaOrdenesCompraRecetas" type="text" placeholder="Buscar por proveedor o insumo..." onChange={() => {
              renderListaPreciosOrdenCompraRecetas();
              cargarOrdenesCompraRecetas();
            }} />
          </div>
          <div className="filaOrdenCompraRecetas">
            <input id="proveedorOrdenCompraRecetas" type="text" placeholder="Proveedor" />
            <select id="insumoOrdenCompraRecetas" onChange={() => seleccionarInsumoOrdenCompraRecetas()}>
              <option value="">Selecciona un insumo</option>
            </select>
            <input id="cantidadOrdenCompraRecetas" type="number" step="0.01" min="0.01" placeholder="Cantidad" />
            <input id="unidadOrdenCompraRecetas" type="text" placeholder="Unidad" readOnly />
            <input id="precioOrdenCompraRecetas" type="number" step="0.01" min="0" placeholder="Precio unitario (opcional)" />
            <button className="boton" type="button" onClick={() => agregarItemOrdenCompraRecetas()}>+ Agregar</button>
          </div>

          <table>
            <thead>
              <tr><th>Insumo</th><th>Proveedor</th><th>Cantidad</th><th>Precio unitario</th><th></th></tr>
            </thead>
            <tbody id="tablaItemsOrdenCompraRecetas"></tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button className="boton botonExito" type="button" onClick={() => crearOrdenCompraRecetas()}>Guardar orden de compra</button>
          </div>
        </div>

        <div className="bloqueOrdenCompraRecetas" style={{ marginTop: '12px' }}>
          <h3>Órdenes registradas</h3>
          <div id="listaOrdenesCompraRecetas" className="listaOrdenesCompraRecetas"></div>
        </div>

        <div className="bloqueOrdenCompraRecetas" style={{ marginTop: '12px' }}>
          <h3>Lista de insumos y precios</h3>
          <div id="listaPreciosOrdenCompraRecetas" className="listaOrdenesCompraRecetas"></div>
        </div>
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

      <div id="modalReceta" className="modal" onClick={() => cerrarModal('modalReceta')}>
        <div className="contenidoModal" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal"><h3>Nueva Receta</h3><button className="cerrarModal" onClick={() => cerrarModal('modalReceta')}>&times;</button></div>
          <form id="formularioReceta" onSubmit={guardarReceta} className="cajaFormulario">
            <div className="recetaFilaDatosPrincipales">
              <input id="nombreReceta" type="text" placeholder="Nombre de receta" required />
              <select id="categoriaReceta" required></select>
              <input id="gramajeReceta" type="number" step="0.01" min="0" placeholder="Gramaje (opcional)" />
            </div>
            <div className="recetaFilaInsumo">
              <div className="recetaBusquedaInsumoWrap">
                <input id="insumoSeleccionado" type="text" placeholder="Buscar insumo..." onChange={e => buscarInsumoParaReceta(e.target.value)} autoComplete="off" />
                <input id="idInsumoSeleccionado" type="hidden" />
                <div id="listaBusquedaInsumos"></div>
              </div>
              <input id="cantidadIngrediente" type="number" step="0.01" placeholder="Cantidad" />
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
              <input id="proveedorIngrediente" type="text" placeholder="Proveedor (opcional)" />
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
              <input id="editNombreReceta" type="text" required />
              <select id="editCategoriaReceta" required></select>
              <input id="editGramajeReceta" type="number" step="0.01" min="0" />
            </div>
            <div className="recetaFilaInsumo">
              <div className="recetaBusquedaInsumoWrap">
                <input id="editInsumoSeleccionado" type="text" placeholder="Buscar insumo..." onChange={e => buscarInsumoParaReceta(e.target.value)} autoComplete="off" />
                <input id="editIdInsumoSeleccionado" type="hidden" />
                <div id="editListaBusquedaInsumos"></div>
              </div>
              <input id="editCantidadIngrediente" type="number" step="0.01" placeholder="Cantidad" />
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
              <input id="editProveedorIngrediente" type="text" placeholder="Proveedor (opcional)" />
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
        <div className="contenidoModal" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal"><h3>Ficha para tienda</h3><button className="cerrarModal" onClick={() => cerrarModal('modalFichaTiendaReceta')}>&times;</button></div>
          <div className="cajaFormulario">
            <input id="fichaTiendaNombreReceta" type="text" readOnly />
            <label>Imagen principal</label>
            <input id="fichaTiendaImagenPrincipal" type="file" accept="image/*" />
            <div id="fichaTiendaPreviewPrincipal" className="fichaTiendaPreviewPrincipal"></div>
            <label>Otras imágenes (galería)</label>
            <input id="fichaTiendaImagenesSecundarias" type="file" accept="image/*" multiple />
            <div id="fichaTiendaGaleria" className="fichaTiendaGaleria"></div>
            <textarea id="fichaTiendaDescripcion" rows="3" placeholder="Descripción (se comparte entre variantes)"></textarea>
            <input id="fichaTiendaPrecioPublico" type="number" min="0" step="0.01" placeholder="Precio venta público" />
            <textarea id="fichaTiendaModoUso" rows="3" placeholder="Modo de uso"></textarea>
            <textarea id="fichaTiendaCuidados" rows="3" placeholder="Cuidados del producto"></textarea>
            <textarea id="fichaTiendaIngredientes" rows="4" placeholder="Ingredientes para tienda (uno por línea)"></textarea>
            <button className="boton botonExito" type="button" onClick={() => guardarFichaTiendaReceta()}>Guardar ficha tienda</button>
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
                <label>Receta</label>
                <input id="nombreRecetaProducir" type="text" readOnly />
              </div>
              <div>
                <label>Cantidad</label>
                <input id="cantidadProducir" type="number" min="1" defaultValue="1" onChange={actualizarCostoProduccion} />
              </div>
              <div>
                <label>Costo por pieza</label>
                <input id="costoPorPiezaProducir" type="number" step="0.01" onChange={actualizarCostoProduccion} onBlur={normalizarCostoPorPieza} />
              </div>
            </div>
            <div className="filaProduccionRapida filaProduccionRapidaBottom">
              <div>
                <label>Costo producción</label>
                <input id="costoProducir" type="number" step="0.01" readOnly />
              </div>
              <div>
                <label>Precio venta</label>
                <input id="precioVentaProducir" type="number" step="0.01" />
              </div>
              <button className="boton botonExito" onClick={() => producirDesdeReceta()}>Registrar producción</button>
            </div>
          </div>
        </div>
      </div>

      <div id="modalEscalarReceta" className="modal" onClick={() => cerrarModal('modalEscalarReceta')}>
        <div className="contenidoModal" onClick={e => e.stopPropagation()}>
          <div className="encabezadoModal"><h3>Copiar receta escalada</h3><button className="cerrarModal" onClick={() => cerrarModal('modalEscalarReceta')}>&times;</button></div>
          <div className="cajaFormulario">
            <input id="idRecetaEscalar" type="hidden" />
            <label>Receta base</label>
            <input id="gramajeOriginal" type="text" readOnly />
            <label>Nuevo gramaje</label>
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
              <span>Seleccionar todas</span>
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
                <span>Seleccionar todas</span>
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
                <span>Seleccionar todas</span>
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

      <div id="menuCategoriaRecetas" className="menuCategoriaRecetas" onClick={e => e.stopPropagation()}>
        <button type="button" className="menuCategoriaBtn" onClick={() => editarCategoriaDesdeMenu()}>✏️ Editar categoría</button>
        <button type="button" className="menuCategoriaBtn menuCategoriaBtnDanger" onClick={() => eliminarCategoriaDesdeMenu()}>🗑️ Eliminar categoría</button>
      </div>
    </div>
  );
}

let categoriaRecetaActual = null;
let ingredientesTemporales = [];
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
let insumosOrdenCompraRecetas = [];
let itemsOrdenCompraRecetasTemporales = [];
let sugerenciasAutoOrdenCompraRecetas = [];
let recetaTiendaEditando = null;
let fichaTiendaImagenPrincipalActual = '';
let fichaTiendaGaleriaActual = [];
let indiceDragGaleriaTienda = -1;

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
  subpestanaRecetasActiva = tab === 'ordenes-compra' ? 'ordenes-compra' : 'recetas';
  const panelRecetas = document.getElementById('panelSubpestanaRecetas');
  const panelOrdenes = document.getElementById('panelSubpestanaOrdenesCompra');
  const btnRecetas = document.getElementById('btnSubTabRecetas');
  const btnOrdenes = document.getElementById('btnSubTabOrdenesCompra');

  if (panelRecetas) panelRecetas.style.display = subpestanaRecetasActiva === 'recetas' ? '' : 'none';
  if (panelOrdenes) panelOrdenes.style.display = subpestanaRecetasActiva === 'ordenes-compra' ? '' : 'none';
  if (btnRecetas) btnRecetas.classList.toggle('activo', subpestanaRecetasActiva === 'recetas');
  if (btnOrdenes) btnOrdenes.classList.toggle('activo', subpestanaRecetasActiva === 'ordenes-compra');

  if (subpestanaRecetasActiva === 'ordenes-compra') {
    cargarInsumosOrdenCompraRecetas();
    aplicarSugerenciasAutomaticasOrdenCompraRecetas();
    renderItemsOrdenCompraRecetasTemporales();
    cargarOrdenesCompraRecetas();
    renderListaPreciosOrdenCompraRecetas();
  }
}

function cargarSugerenciasAutomaticasOrdenCompraRecetas() {
  try {
    const raw = localStorage.getItem(OC_SUGERIDOS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    sugerenciasAutoOrdenCompraRecetas = Array.isArray(parsed) ? parsed : [];
  } catch {
    sugerenciasAutoOrdenCompraRecetas = [];
  }
}

function aplicarSugerenciasAutomaticasOrdenCompraRecetas() {
  cargarSugerenciasAutomaticasOrdenCompraRecetas();
  if (!Array.isArray(sugerenciasAutoOrdenCompraRecetas)) return;

  const idsSugeridos = new Set(sugerenciasAutoOrdenCompraRecetas.map((item) => Number(item.id_inventario)).filter((id) => Number.isFinite(id)));
  itemsOrdenCompraRecetasTemporales = itemsOrdenCompraRecetasTemporales.filter((item) => {
    if (!item?.automatico) return true;
    return idsSugeridos.has(Number(item.id_inventario));
  });

  sugerenciasAutoOrdenCompraRecetas.forEach((sugerido) => {
    const id = Number(sugerido.id_inventario);
    if (!Number.isFinite(id)) return;
    const existente = itemsOrdenCompraRecetasTemporales.find((item) => Number(item.id_inventario) === id);
    if (existente) {
      existente.automatico = true;
      existente.cantidad_requerida = Math.max(Number(existente.cantidad_requerida) || 0, Number(sugerido.cantidad_requerida) || 0);
      if (!existente.proveedor) existente.proveedor = sugerido.proveedor || '';
      if (!Number(existente.precio_unitario)) existente.precio_unitario = Number(sugerido.precio_unitario) || 0;
      return;
    }
    itemsOrdenCompraRecetasTemporales.push({
      id_inventario: id,
      codigo: sugerido.codigo || '',
      nombre: sugerido.nombre || '',
      unidad: sugerido.unidad || '',
      proveedor: sugerido.proveedor || '',
      cantidad_requerida: Number(sugerido.cantidad_requerida) || 0,
      precio_unitario: Number(sugerido.precio_unitario) || 0,
      automatico: true
    });
  });

  renderSugerenciasAutomaticasOrdenCompraRecetas();
  renderItemsOrdenCompraRecetasTemporales();
}

async function cargarInsumosOrdenCompraRecetas() {
  try {
    const respuesta = await fetch(`${API}/inventario`);
    if (!respuesta.ok) return;
    const insumos = await respuesta.json();
    insumosOrdenCompraRecetas = Array.isArray(insumos) ? insumos : [];

    const select = document.getElementById('insumoOrdenCompraRecetas');
    if (!select) return;

    const valorActual = select.value;
    select.innerHTML = '<option value="">Selecciona un insumo</option>';
    const grupos = agruparInsumosPorProveedor(insumosOrdenCompraRecetas);
    grupos.forEach((grupo) => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = grupo.proveedor;
      grupo.items.forEach((insumo) => {
        const option = document.createElement('option');
        option.value = String(insumo.id);
        option.textContent = `${insumo.nombre} (${insumo.codigo || 'SIN-COD'}${insumo.unidad ? ` • ${getAbrev(insumo.unidad)}` : ''})`;
        optgroup.appendChild(option);
      });
      select.appendChild(optgroup);
    });
    if (valorActual) select.value = valorActual;
    renderListaPreciosOrdenCompraRecetas();
  } catch (error) {
    console.error('Error cargando insumos para orden de compra:', error);
  }
}

function seleccionarInsumoOrdenCompraRecetas() {
  const id = Number(document.getElementById('insumoOrdenCompraRecetas')?.value || 0);
  const insumo = insumosOrdenCompraRecetas.find((item) => Number(item.id) === id);
  const inputUnidad = document.getElementById('unidadOrdenCompraRecetas');
  const inputProveedor = document.getElementById('proveedorOrdenCompraRecetas');

  if (inputUnidad) inputUnidad.value = insumo?.unidad ? getAbrev(insumo.unidad) : '';
  if (inputProveedor && !inputProveedor.value.trim() && insumo?.proveedor) {
    inputProveedor.value = insumo.proveedor;
  }
}

function agregarItemOrdenCompraRecetas() {
  const id = Number(document.getElementById('insumoOrdenCompraRecetas')?.value || 0);
  const cantidad = Number(document.getElementById('cantidadOrdenCompraRecetas')?.value || 0);
  const precioUnitario = Number(document.getElementById('precioOrdenCompraRecetas')?.value || 0);
  const proveedor = String(document.getElementById('proveedorOrdenCompraRecetas')?.value || '').trim();
  const insumo = insumosOrdenCompraRecetas.find((item) => Number(item.id) === id);

  if (!insumo || !Number.isFinite(cantidad) || cantidad <= 0) {
    mostrarNotificacion('Selecciona un insumo y una cantidad válida', 'error');
    return;
  }

  const existente = itemsOrdenCompraRecetasTemporales.find((item) => Number(item.id_inventario) === Number(insumo.id));
  if (existente) {
    existente.cantidad_requerida = Number(existente.cantidad_requerida) + Number(cantidad);
    existente.proveedor = proveedor || existente.proveedor || '';
    if (Number.isFinite(precioUnitario) && precioUnitario > 0) existente.precio_unitario = precioUnitario;
  } else {
    itemsOrdenCompraRecetasTemporales.push({
      id_inventario: insumo.id,
      codigo: insumo.codigo || '',
      nombre: insumo.nombre || '',
      unidad: normalizarUnidadReceta(insumo.unidad || ''),
      proveedor: proveedor || (insumo.proveedor || ''),
      cantidad_requerida: Number(cantidad),
      precio_unitario: Number.isFinite(precioUnitario) ? precioUnitario : 0
    });
  }

  document.getElementById('cantidadOrdenCompraRecetas').value = '';
  document.getElementById('precioOrdenCompraRecetas').value = '';
  document.getElementById('insumoOrdenCompraRecetas').value = '';
  document.getElementById('unidadOrdenCompraRecetas').value = '';
  renderItemsOrdenCompraRecetasTemporales();
}

function eliminarItemOrdenCompraRecetas(index) {
  itemsOrdenCompraRecetasTemporales.splice(index, 1);
  renderItemsOrdenCompraRecetasTemporales();
}

function renderItemsOrdenCompraRecetasTemporales() {
  const tbody = document.getElementById('tablaItemsOrdenCompraRecetas');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!itemsOrdenCompraRecetasTemporales.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#777">Agrega insumos para crear la orden</td></tr>';
    return;
  }

  const ordenados = [...itemsOrdenCompraRecetasTemporales]
    .sort((a, b) => {
      const cmpProv = ordenarTexto(a.proveedor || 'Sin proveedor', b.proveedor || 'Sin proveedor');
      if (cmpProv !== 0) return cmpProv;
      return ordenarTexto(a.nombre || '', b.nombre || '');
    });

  ordenados.forEach((item) => {
    const index = itemsOrdenCompraRecetasTemporales.indexOf(item);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.nombre} <small style="color:#666">(${item.codigo || 'SIN-COD'}${item.unidad ? ` • ${getAbrev(item.unidad)}` : ''})</small></td>
      <td>${item.proveedor || '<span style="color:#999">Sin proveedor</span>'}</td>
      <td>${Number(item.cantidad_requerida).toFixed(2)}${item.automatico ? ' <small style="color:#607d8b">(auto ≤20%)</small>' : ''}</td>
      <td>${Number(item.precio_unitario || 0) > 0 ? `$${Number(item.precio_unitario).toFixed(2)}` : '-'}</td>
      <td><button class="botonPequeno botonDanger" onclick="window.recetas.eliminarItemOrdenCompraRecetas(${index})">×</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderSugerenciasAutomaticasOrdenCompraRecetas() {
  const contenedor = document.getElementById('sugerenciasAutoOrdenCompraRecetas');
  if (!contenedor) return;

  if (!sugerenciasAutoOrdenCompraRecetas.length) {
    contenedor.innerHTML = '<div class="mensajeSinRecetasEscalado">Sin sugerencias automáticas por stock ≤20%</div>';
    return;
  }

  const grupos = agruparInsumosPorProveedor(sugerenciasAutoOrdenCompraRecetas);
  contenedor.innerHTML = grupos.map((grupo) => {
    const items = (grupo.items || []).map((item) => (
      `<li>${item.nombre} • ${Number(item.cantidad_requerida || 0).toFixed(2)} ${getAbrev(item.unidad || '') || ''}</li>`
    )).join('');

    return `
      <div class="itemOrdenCompraRecetas">
        <div class="itemOrdenCompraRecetasHeader">
          <strong>${grupo.proveedor}</strong>
          <span>${(grupo.items || []).length} sugerido(s)</span>
          <span>Auto ≤20%</span>
        </div>
        <ul>${items}</ul>
      </div>
    `;
  }).join('');
}

async function crearOrdenCompraRecetas() {
  if (!itemsOrdenCompraRecetasTemporales.length) {
    mostrarNotificacion('Agrega al menos un insumo a la orden de compra', 'error');
    return;
  }

  const proveedor = String(document.getElementById('proveedorOrdenCompraRecetas')?.value || '').trim();

  try {
    const respuesta = await fetch(`${API}/recetas/ordenes-compra`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proveedor,
        items: itemsOrdenCompraRecetasTemporales
      })
    });

    if (!respuesta.ok) {
      const err = await respuesta.json().catch(() => ({}));
      mostrarNotificacion(err.error || 'No se pudo guardar la orden de compra', 'error');
      return;
    }

    const resultado = await respuesta.json();
    itemsOrdenCompraRecetasTemporales = [];
    renderItemsOrdenCompraRecetasTemporales();
    document.getElementById('proveedorOrdenCompraRecetas').value = '';
    mostrarNotificacion(`Orden creada (${resultado.numero_orden || 'sin folio'})`, 'exito');
    await cargarOrdenesCompraRecetas();
  } catch (error) {
    console.error('Error creando orden de compra:', error);
    mostrarNotificacion('Error al crear la orden de compra', 'error');
  }
}

async function cargarOrdenesCompraRecetas() {
  const contenedor = document.getElementById('listaOrdenesCompraRecetas');
  if (!contenedor) return;
  renderSugerenciasAutomaticasOrdenCompraRecetas();
  renderListaPreciosOrdenCompraRecetas();

  try {
    const respuesta = await fetch(`${API}/recetas/ordenes-compra`);
    if (!respuesta.ok) {
      contenedor.innerHTML = '<div class="mensajeSinRecetasEscalado">No se pudo cargar el historial de órdenes</div>';
      return;
    }

    const ordenesCrudas = await respuesta.json();
    const busqueda = normalizarTextoBusqueda(document.getElementById('busquedaOrdenesCompraRecetas')?.value || '');
    const ordenes = (Array.isArray(ordenesCrudas) ? ordenesCrudas : []).map((orden) => ({
      ...orden,
      proveedor: String(orden?.proveedor || 'Sin proveedor').trim() || 'Sin proveedor',
      items: (Array.isArray(orden?.items) ? orden.items : []).sort((a, b) => ordenarTexto(a?.nombre, b?.nombre))
    })).sort((a, b) => ordenarTexto(a.proveedor, b.proveedor));

    const ordenesFiltradas = !busqueda
      ? ordenes
      : ordenes.filter((orden) => {
        const proveedor = normalizarTextoBusqueda(orden.proveedor);
        if (proveedor.includes(busqueda)) return true;
        return (orden.items || []).some((item) => normalizarTextoBusqueda(item?.nombre).includes(busqueda));
      });

    if (!ordenesFiltradas.length) {
      contenedor.innerHTML = '<div class="mensajeSinRecetasEscalado">Aún no hay órdenes de compra registradas</div>';
      return;
    }

    contenedor.innerHTML = ordenesFiltradas.map((orden) => {
      const itemsHtml = (orden.items || []).map((item) => (
        `<li>${item.nombre} • ${Number(item.cantidad_requerida || 0).toFixed(2)} ${getAbrev(item.unidad || '') || ''}</li>`
      )).join('');

      return `
        <div class="itemOrdenCompraRecetas">
          <div class="itemOrdenCompraRecetasHeader">
            <strong>${orden.numero_orden || 'Sin folio'}</strong>
            <span>${orden.proveedor || 'Sin proveedor'}</span>
            <span>${orden.fecha_creacion ? new Date(orden.fecha_creacion).toLocaleString() : ''}</span>
          </div>
          <ul>${itemsHtml || '<li>Sin insumos</li>'}</ul>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error cargando órdenes de compra:', error);
    contenedor.innerHTML = '<div class="mensajeSinRecetasEscalado">Error al cargar órdenes de compra</div>';
  }
}

function renderListaPreciosOrdenCompraRecetas() {
  const contenedor = document.getElementById('listaPreciosOrdenCompraRecetas');
  if (!contenedor) return;

  const busqueda = normalizarTextoBusqueda(document.getElementById('busquedaOrdenesCompraRecetas')?.value || '');
  const grupos = agruparInsumosPorProveedor(insumosOrdenCompraRecetas);

  const gruposFiltrados = grupos
    .map((grupo) => ({
      ...grupo,
      items: grupo.items.filter((item) => {
        if (!busqueda) return true;
        const nombre = normalizarTextoBusqueda(item?.nombre);
        const proveedor = normalizarTextoBusqueda(grupo.proveedor);
        return nombre.includes(busqueda) || proveedor.includes(busqueda);
      })
    }))
    .filter((grupo) => grupo.items.length > 0);

  if (!gruposFiltrados.length) {
    contenedor.innerHTML = '<div class="mensajeSinRecetasEscalado">No hay insumos para mostrar</div>';
    return;
  }

  contenedor.innerHTML = gruposFiltrados.map((grupo) => {
    const itemsHtml = grupo.items.map((item) => `
      <li>
        <span>${item.nombre} ${item.unidad ? `(${getAbrev(item.unidad)})` : ''}</span>
        <strong>$${Number(item.costo_por_unidad || 0).toFixed(2)}</strong>
      </li>
    `).join('');

    return `
      <div class="itemOrdenCompraRecetas">
        <div class="itemOrdenCompraRecetasHeader">
          <strong>${grupo.proveedor}</strong>
          <span>${grupo.items.length} insumo(s)</span>
          <span></span>
        </div>
        <ul class="listaPreciosProveedor">${itemsHtml}</ul>
      </div>
    `;
  }).join('');
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
        <span>${receta.nombre} ${receta.gramaje ? `• ${receta.gramaje}g` : '• sin gramaje'}</span>
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
        <span>${receta.nombre} ${receta.gramaje ? `• ${receta.gramaje}g` : '• sin gramaje'}</span>
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
        <span>${receta.nombre} ${receta.gramaje ? `• ${receta.gramaje}g` : '• sin gramaje'}</span>
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

async function cargarListadoRecetas() {
  if (cargandoRecetas) return;
  cargandoRecetas = true;
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

    const cuerpo = document.getElementById('cuerpoRecetas');
    if (!cuerpo) return;
    cuerpo.innerHTML = '';

    if (recetas.length === 0) {
      cuerpo.innerHTML = '<div style="text-align:center;padding:30px;color:#999">No hay recetas</div>';
      return;
    }

    for (const receta of recetas) {
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
            <button onclick="window.recetas.eliminarReceta(${receta.id})" class="botonPequeno botonDanger" title="Eliminar receta" style="margin-left:8px">🗑️</button>
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
            <button onclick="window.recetas.abrirProduccionRapida(${receta.id}, '${receta.nombre.replace(/'/g, "\\'")}', ${(capacidad.costo_por_pieza || 0)})" class="botonPequeno" style="background:#ff9800" title="Producir">🎰</button>
            <button onclick="window.recetas.editarReceta(${receta.id})" class="botonPequeno" title="Editar receta">✏️</button>
            <button onclick="window.recetas.abrirFichaTiendaReceta(${receta.id})" class="botonPequeno" style="background:#4a7c59" title="Editar ficha de tienda">🛍️</button>
            <button onclick="window.recetas.abrirEscalarReceta(${receta.id}, '${receta.nombre.replace(/'/g, "\\'")}', ${receta.gramaje || 0})" class="botonPequeno" style="background:#3498db" title="Copiar con escalado">📋</button>
            <button onclick="window.recetas.archivarReceta(${receta.id}, '${receta.nombre.replace(/'/g, "\\'")}')" class="botonPequeno" style="background:#607d8b" title="Archivar receta">🗂️</button>
            <button onclick="window.recetas.mostrarIngredientes(${receta.id})" class="botonPequeno" title="Ver ingredientes">👁️</button>
          </div>
        </div>
      `;
      cuerpo.appendChild(tarjeta);
    }
  } catch (error) {
    console.error('Error cargando recetas:', error);
  } finally {
    cargandoRecetas = false;
  }
}

async function agregarReceta(event) {
  return guardarReceta(event);
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
      document.getElementById('formularioReceta')?.reset();
      ingredientesTemporales = [];
      actualizarTablaIngredientes();
      cerrarModal('modalReceta');
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
  } catch (error) {
    console.error(error);
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

    let html = `<h3 style="margin-bottom:12px;color:#1a1a1a;font-size:16px">${receta.nombre}</h3><ul style="list-style:none;padding:0" id="listaIngredientesModal">`;
    if (!receta.ingredientes || receta.ingredientes.length === 0) {
      html += '<li style="padding:10px;color:#999">Sin ingredientes agregados</li>';
    } else {
      receta.ingredientes.forEach(ing => {
        const pendiente = ing.pendiente === true || ing.pendiente === 1;
        html += `<li style="padding:8px;background:#f5f5f5;margin-bottom:6px;border-radius:6px;border-left:4px solid ${pendiente ? '#d32f2f' : '#4a9b5e'};display:flex;justify-content:space-between;align-items:center;gap:8px${pendiente ? ';color:#d32f2f;font-weight:bold' : ''}">
          <span style="flex:1;font-size:13px">${ing.nombre}${ing.proveedor ? ` <small style='color:#666'>(Proveedor: ${ing.proveedor})</small>` : ''}</span>
          <input type="number" id="cantidad_${ing.id}" value="${parseFloat(ing.cantidad).toFixed(2)}" step="0.01" style="width:70px;padding:4px;border:1px solid #ddd;border-radius:4px;text-align:center;font-size:12px">
          <span style="min-width:35px;font-size:12px">${getAbrev(ing.unidad)}</span>
          <div style="display:flex;gap:4px">
            <button onclick="window.recetas.guardarCantidadIngrediente(${idReceta}, ${ing.id})" class="botonPequeno" style="background:#4a9b5e;padding:4px 10px">💾</button>
            <button onclick="window.recetas.eliminarIngredienteDeReceta(${idReceta}, ${ing.id}, '${String(ing.nombre || '').replace(/'/g, "\\'")}')" class="botonPequeno botonDanger" style="padding:4px 10px">×</button>
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
    recetaTiendaEditando = receta;
    const ingredientesAuto = Array.isArray(receta.ingredientes)
      ? receta.ingredientes.map((ing) => String(ing?.nombre || '').trim()).filter(Boolean)
      : [];

    const ingredientesTexto = String(receta?.tienda_ingredientes || '').trim()
      || Array.from(new Set(ingredientesAuto)).join('\n');

    fichaTiendaImagenPrincipalActual = String(receta?.tienda_image_url || '').trim();
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
    fichaTiendaGaleriaActual = galeriaReceta.map((item) => String(item || '').trim()).filter(Boolean);

    const campoNombre = document.getElementById('fichaTiendaNombreReceta');
    const campoImagenPrincipal = document.getElementById('fichaTiendaImagenPrincipal');
    const campoImagenesSecundarias = document.getElementById('fichaTiendaImagenesSecundarias');
    const campoDescripcion = document.getElementById('fichaTiendaDescripcion');
    const campoPrecioPublico = document.getElementById('fichaTiendaPrecioPublico');
    const campoModoUso = document.getElementById('fichaTiendaModoUso');
    const campoCuidados = document.getElementById('fichaTiendaCuidados');
    const campoIngredientes = document.getElementById('fichaTiendaIngredientes');

    if (campoNombre) campoNombre.value = receta?.nombre || '';
    if (campoImagenPrincipal) campoImagenPrincipal.value = '';
    if (campoImagenesSecundarias) campoImagenesSecundarias.value = '';
    if (campoDescripcion) campoDescripcion.value = receta?.tienda_descripcion || '';
    if (campoPrecioPublico) campoPrecioPublico.value = Number(receta?.tienda_precio_publico) || 0;
    if (campoModoUso) campoModoUso.value = receta?.tienda_modo_uso || '';
    if (campoCuidados) campoCuidados.value = receta?.tienda_cuidados || '';
    if (campoIngredientes) campoIngredientes.value = ingredientesTexto;

    renderFichaTiendaPreviews();

    abrirModal('modalFichaTiendaReceta');
  } catch (error) {
    console.error('Error abriendo ficha de tienda:', error);
    mostrarNotificacion('No se pudo abrir la ficha de tienda', 'error');
  }
}

async function guardarFichaTiendaReceta() {
  if (!recetaTiendaEditando?.id) return;
  try {
    const inputPrincipal = document.getElementById('fichaTiendaImagenPrincipal');
    const inputSecundarias = document.getElementById('fichaTiendaImagenesSecundarias');

    const archivoPrincipal = inputPrincipal?.files?.[0] || null;
    if (archivoPrincipal) {
      fichaTiendaImagenPrincipalActual = await subirImagenTienda(archivoPrincipal);
    }

    const archivosSecundarios = Array.from(inputSecundarias?.files || []);
    if (archivosSecundarios.length) {
      for (const archivo of archivosSecundarios) {
        const url = await subirImagenTienda(archivo);
        if (url) fichaTiendaGaleriaActual.push(url);
      }
      fichaTiendaGaleriaActual = Array.from(new Set(fichaTiendaGaleriaActual));
    }

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
      tienda_image_url: fichaTiendaImagenPrincipalActual,
      tienda_galeria: fichaTiendaGaleriaActual,
      tienda_descripcion: document.getElementById('fichaTiendaDescripcion')?.value || '',
      tienda_precio_publico: Number(document.getElementById('fichaTiendaPrecioPublico')?.value) || 0,
      tienda_modo_uso: document.getElementById('fichaTiendaModoUso')?.value || '',
      tienda_cuidados: document.getElementById('fichaTiendaCuidados')?.value || '',
      tienda_ingredientes: document.getElementById('fichaTiendaIngredientes')?.value || ''
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
  const contPrincipal = document.getElementById('fichaTiendaPreviewPrincipal');
  if (contPrincipal) {
    contPrincipal.innerHTML = fichaTiendaImagenPrincipalActual
      ? `<img src="${fichaTiendaImagenPrincipalActual}" alt="Principal" />`
      : '<span style="color:#777;font-size:12px">Sin imagen principal</span>';
  }

  const contGaleria = document.getElementById('fichaTiendaGaleria');
  if (contGaleria) {
    if (!fichaTiendaGaleriaActual.length) {
      contGaleria.innerHTML = '<span style="color:#777;font-size:12px">Sin imágenes secundarias</span>';
      return;
    }
    contGaleria.innerHTML = fichaTiendaGaleriaActual.map((url, idx) => `
      <div class="fichaTiendaGaleriaItem" draggable="true" ondragstart="window.recetas.iniciarArrastreImagenGaleria(${idx})" ondragover="window.recetas.permitirDropImagenGaleria(event)" ondrop="window.recetas.soltarImagenGaleria(${idx})">
        <img src="${url}" alt="Galería ${idx + 1}" />
        <div class="fichaTiendaGaleriaAcciones">
          <button type="button" class="botonPequeno" onclick="window.recetas.moverImagenGaleriaTienda(${idx}, 'izq')" title="Mover a la izquierda">←</button>
          <button type="button" class="botonPequeno" onclick="window.recetas.moverImagenGaleriaTienda(${idx}, 'der')" title="Mover a la derecha">→</button>
          <button type="button" class="botonPequeno botonDanger" onclick="window.recetas.quitarImagenGaleriaTienda(${idx})" title="Eliminar">×</button>
        </div>
      </div>
    `).join('');
  }
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
  const costoProduccionCalculado = costoPorPieza * 1.15;
  const out = document.getElementById('costoProducir');
  if (out) out.value = costoProduccionCalculado.toFixed(2);

  const precioVenta = document.getElementById('precioVentaProducir');
  if (precioVenta) {
    const ventaCalculada = costoProduccionCalculado * 2.5;
    const ventaRedondeada = Math.ceil(ventaCalculada / 5) * 5;
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
