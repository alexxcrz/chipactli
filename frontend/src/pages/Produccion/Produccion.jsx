import React, { useEffect, useMemo, useState } from 'react';
import './Produccion.css';
import { mostrarNotificacion } from '../../utils/notificaciones.jsx';
import { abrirModal, cerrarModal } from '../../utils/modales.jsx';
import { fetchAPIJSON } from '../../utils/api.jsx';
import { normalizarTextoBusqueda } from '../../utils/texto.jsx';

let ventaPendiente = null;
let cortesiaPendiente = null;

function formatearFechaCorta(fechaIso) {
  if (!fechaIso) return '-';
  const d = new Date(fechaIso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-MX');
}

function formatearMoneda(valor) {
  return `$${Number(valor || 0).toFixed(2)}`;
}

export default function Produccion() {
  const [produccionData, setProduccionData] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [modalHistorialAbierto, setModalHistorialAbierto] = useState(false);
  const [historialData, setHistorialData] = useState({ produccion: [], ventasCortesias: [] });
  const [pestanaHistorial, setPestanaHistorial] = useState('produccion');
  const [modalEliminar, setModalEliminar] = useState({
    abierto: false,
    receta: null,
    cantidad: ''
  });

  async function cargarProduccion() {
    try {
      const resumen = await fetchAPIJSON('/produccion/resumen-recetas');
      setProduccionData(Array.isArray(resumen) ? resumen : []);
    } catch (error) {
      mostrarNotificacion(error?.message || 'Error al cargar producción', 'error');
    }
  }

  useEffect(() => {
    window.produccion = {
      cargarProduccion,
      eliminarProduccion,
      abrirModalVenta,
      confirmarVentaPedido,
      registrarVenta,
      abrirModalCortesia,
      confirmarCortesia,
      registrarCortesia,
      filtrarProduccion: (term) => setBusqueda(String(term || ''))
    };

    cargarProduccion();

    const onRealtime = (event) => {
      const tipo = String(event?.detail?.tipo || '').trim();
      if ([
        'produccion_actualizado',
        'ventas_actualizado',
        'cortesias_actualizado',
        'tienda_orden_nueva'
      ].includes(tipo)) {
        cargarProduccion();
      }
    };

    window.addEventListener('chipactli:realtime', onRealtime);
    return () => {
      delete window.produccion;
      window.removeEventListener('chipactli:realtime', onRealtime);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function obtenerLotesReceta(receta) {
    return (Array.isArray(receta?.historial) ? receta.historial : [])
      .filter((l) => Number(l?.cantidad || 0) > 0)
      .sort((a, b) => String(a?.fecha_produccion || '').localeCompare(String(b?.fecha_produccion || '')) || (Number(a?.id || 0) - Number(b?.id || 0)));
  }

  function abrirModalEliminar(receta) {
    const totalPiezas = Number(receta?.piezas_producidas || 0);
    const lotes = obtenerLotesReceta(receta);

    if (!lotes.length || totalPiezas <= 0) {
      mostrarNotificacion('No hay producción disponible para eliminar', 'advertencia');
      return;
    }

    setModalEliminar({
      abierto: true,
      receta,
      cantidad: String(totalPiezas.toFixed(2))
    });
  }

  function cerrarModalEliminar() {
    setModalEliminar({ abierto: false, receta: null, cantidad: '' });
  }

  async function ejecutarEliminacion(receta, cantidadEliminar) {
    const totalPiezas = Number(receta?.piezas_producidas || 0);
    const lotes = obtenerLotesReceta(receta);

    if (!lotes.length || totalPiezas <= 0) {
      mostrarNotificacion('No hay producción disponible para eliminar', 'advertencia');
      return;
    }

    if (!Number.isFinite(cantidadEliminar) || cantidadEliminar <= 0) {
      mostrarNotificacion('Cantidad inválida', 'error');
      return;
    }

    if (cantidadEliminar > totalPiezas) {
      mostrarNotificacion('La cantidad excede las piezas producidas', 'error');
      return;
    }

    try {
      let restante = cantidadEliminar;
      for (const lote of lotes) {
        if (restante <= 0) break;
        const cantidadLote = Number(lote?.cantidad || 0);
        if (cantidadLote <= 0) continue;

        if (cantidadLote <= restante + 1e-9) {
          await fetchAPIJSON(`/produccion/${Number(lote?.id || 0)}`, { method: 'DELETE' });
          restante -= cantidadLote;
        } else {
          await fetchAPIJSON(`/produccion/${Number(lote?.id || 0)}/parcial`, {
            method: 'DELETE',
            body: { cantidad: restante }
          });
          restante = 0;
        }
      }

      await cargarProduccion();
      mostrarNotificacion('Producción eliminada correctamente', 'exito');
      cerrarModalEliminar();
    } catch (error) {
      mostrarNotificacion(error?.message || 'Error eliminando producción', 'error');
    }
  }

  async function eliminarProduccion(receta) {
    abrirModalEliminar(receta);
  }

  async function confirmarEliminarTodo() {
    const receta = modalEliminar?.receta;
    const total = Number(receta?.piezas_producidas || 0);
    if (!receta || total <= 0) return;
    await ejecutarEliminacion(receta, total);
  }

  async function confirmarEliminarCantidad() {
    const receta = modalEliminar?.receta;
    const cantidad = Number(modalEliminar?.cantidad || 0);
    if (!receta) return;
    await ejecutarEliminacion(receta, cantidad);
  }

  function abrirModalVenta(receta) {
    const historial = (Array.isArray(receta?.historial) ? receta.historial : [])
      .filter((l) => Number(l?.cantidad || 0) > 0)
      .sort((a, b) => String(a?.fecha_produccion || '').localeCompare(String(b?.fecha_produccion || '')) || (Number(a?.id || 0) - Number(b?.id || 0)));

    const disponibles = Number(receta?.piezas_disponibles || 0);
    if (!historial.length || disponibles <= 0) {
      mostrarNotificacion('No hay piezas disponibles para vender', 'advertencia');
      return;
    }

    ventaPendiente = { receta, historial, disponibles };
    const input = document.getElementById('numeroPedidoVenta');
    if (input) input.value = '';
    const inputCantidad = document.getElementById('cantidadVentaPiezas');
    if (inputCantidad) inputCantidad.value = String(Math.min(1, disponibles));
    abrirModal('modalVentaPedido');
  }

  async function confirmarVentaPedido(event) {
    if (event) event.preventDefault();
    if (!ventaPendiente) return;

    const numeroPedido = String(document.getElementById('numeroPedidoVenta')?.value || '').trim();
    const cantidadSolicitada = Number(document.getElementById('cantidadVentaPiezas')?.value || 0);
    cerrarModal('modalVentaPedido');

    const { receta, historial, disponibles } = ventaPendiente;
    ventaPendiente = null;

    if (!Number.isFinite(cantidadSolicitada) || cantidadSolicitada <= 0) {
      mostrarNotificacion('Cantidad inválida para venta', 'error');
      return;
    }
    if (cantidadSolicitada > disponibles) {
      mostrarNotificacion('La cantidad supera las piezas disponibles', 'error');
      return;
    }

    let restante = cantidadSolicitada;
    for (const lote of historial) {
      if (restante <= 0) break;
      const cantidadLote = Number(lote?.cantidad || 0);
      if (cantidadLote <= 0) continue;
      const usar = Math.min(restante, cantidadLote);
      await registrarVenta(
        Number(lote?.id || 0),
        String(receta?.nombre_receta || ''),
        usar,
        Number(lote?.costo_produccion || 0),
        Number(lote?.precio_venta || receta?.precio_sugerido || 0),
        numeroPedido
      );
      restante -= usar;
    }

    await cargarProduccion();
    mostrarNotificacion('Venta registrada correctamente', 'exito');
  }

  async function registrarVenta(idProduccion, nombreReceta, cantidad, costoProduccion, precioVenta, numeroPedido) {
    try {
      await fetchAPIJSON('/ventas', {
        method: 'POST',
        body: {
          id_produccion: idProduccion,
          nombre_receta: nombreReceta,
          cantidad,
          costo_produccion: costoProduccion,
          precio_venta: precioVenta,
          numero_pedido: numeroPedido
        }
      });
    } catch (error) {
      mostrarNotificacion(error?.message || 'Error al registrar venta', 'error');
      throw error;
    }
  }

  function abrirModalCortesia(receta) {
    const historial = (Array.isArray(receta?.historial) ? receta.historial : [])
      .filter((l) => Number(l?.cantidad || 0) > 0)
      .sort((a, b) => String(a?.fecha_produccion || '').localeCompare(String(b?.fecha_produccion || '')) || (Number(a?.id || 0) - Number(b?.id || 0)));

    const disponibles = Number(receta?.piezas_disponibles || 0);
    if (!historial.length || disponibles <= 0) {
      mostrarNotificacion('No hay piezas disponibles para cortesía', 'advertencia');
      return;
    }

    cortesiaPendiente = { receta, historial, disponibles };
    const pedido = document.getElementById('numeroPedidoCortesia');
    const cantidad = document.getElementById('cantidadCortesiaPiezas');
    const motivo = document.getElementById('motivoCortesia');
    const paraQuien = document.getElementById('paraQuienCortesia');
    if (pedido) pedido.value = '';
    if (cantidad) cantidad.value = String(Math.min(1, disponibles));
    if (motivo) motivo.value = '';
    if (paraQuien) paraQuien.value = '';
    abrirModal('modalCortesia');
  }

  async function confirmarCortesia(event) {
    if (event) event.preventDefault();
    if (!cortesiaPendiente) return;

    const numeroPedido = String(document.getElementById('numeroPedidoCortesia')?.value || '').trim();
    const cantidadSolicitada = Number(document.getElementById('cantidadCortesiaPiezas')?.value || 0);
    const motivo = String(document.getElementById('motivoCortesia')?.value || '').trim();
    const paraQuien = String(document.getElementById('paraQuienCortesia')?.value || '').trim();

    if (!numeroPedido || !motivo) {
      mostrarNotificacion('Por favor completa número de pedido y motivo', 'error');
      return;
    }

    const { receta, historial, disponibles } = cortesiaPendiente;
    if (!Number.isFinite(cantidadSolicitada) || cantidadSolicitada <= 0) {
      mostrarNotificacion('Cantidad inválida para cortesía', 'error');
      return;
    }
    if (cantidadSolicitada > disponibles) {
      mostrarNotificacion('La cantidad supera las piezas disponibles', 'error');
      return;
    }

    cerrarModal('modalCortesia');
    cortesiaPendiente = null;

    let restante = cantidadSolicitada;
    for (const lote of historial) {
      if (restante <= 0) break;
      const cantidadLote = Number(lote?.cantidad || 0);
      if (cantidadLote <= 0) continue;
      const usar = Math.min(restante, cantidadLote);
      await registrarCortesia(
        Number(lote?.id || 0),
        String(receta?.nombre_receta || ''),
        usar,
        numeroPedido,
        motivo,
        paraQuien
      );
      restante -= usar;
    }

    await cargarProduccion();
    mostrarNotificacion('Cortesía registrada correctamente', 'exito');
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
      window.dispatchEvent(new CustomEvent('cortesiasActualizadas'));
    } catch (error) {
      mostrarNotificacion(error?.message || 'Error al registrar cortesía', 'error');
      throw error;
    }
  }

  async function abrirHistorialReceta(idReceta) {
    try {
      const resp = await fetchAPIJSON(`/produccion/historial/${idReceta}`);
      setHistorialData(resp || { produccion: [], ventasCortesias: [] });
      setPestanaHistorial('produccion');
      setModalHistorialAbierto(true);
    } catch (error) {
      mostrarNotificacion(error?.message || 'Error al cargar historial', 'error');
    }
  }

  const recetasFiltradas = useMemo(() => {
    const term = normalizarTextoBusqueda(busqueda);
    return (Array.isArray(produccionData) ? produccionData : []).filter((item) => {
      const nombre = normalizarTextoBusqueda(item?.nombre_receta || '');
      const categoria = normalizarTextoBusqueda(item?.categoria || '');
      return !term || nombre.includes(term) || categoria.includes(term);
    });
  }, [produccionData, busqueda]);

  const estadisticasGenerales = useMemo(() => {
    const base = {
      piezas: 0,
      costoProduccion: 0,
      valorVenta: 0,
      utilidad: 0
    };

    const lista = Array.isArray(produccionData) ? produccionData : [];
    for (const receta of lista) {
      const historial = Array.isArray(receta?.historial) ? receta.historial : [];
      if (historial.length > 0) {
        for (const lote of historial) {
          const cantidad = Number(lote?.cantidad || 0);
          if (cantidad <= 0) continue;
          const costo = Number(lote?.costo_produccion || 0);
          const precio = Number(lote?.precio_venta || 0);
          base.piezas += cantidad;
          base.costoProduccion += costo;
          base.valorVenta += (precio * cantidad);
        }
      } else {
        const cantidad = Number(receta?.piezas_producidas || 0);
        const precio = Number(receta?.precio_sugerido || 0);
        if (cantidad > 0) {
          base.piezas += cantidad;
          base.valorVenta += (precio * cantidad);
        }
      }
    }

    base.utilidad = base.valorVenta - base.costoProduccion;
    return base;
  }, [produccionData]);

  return (
    <>
      <div className="tarjeta">
        <div className="encabezadoTarjeta">
          <h2>Registro de Producción</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              className="cajaBusqueda"
              placeholder="Buscar producción..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        <div className="produccionStatsGrid">
          <article className="produccionStatCard">
            <h4>Piezas en producción</h4>
            <p>{estadisticasGenerales.piezas.toFixed(2)}</p>
          </article>
          <article className="produccionStatCard">
            <h4>Costo de producción</h4>
            <p>{formatearMoneda(estadisticasGenerales.costoProduccion)}</p>
          </article>
          <article className="produccionStatCard">
            <h4>Valor a precio de venta</h4>
            <p>{formatearMoneda(estadisticasGenerales.valorVenta)}</p>
          </article>
          <article className="produccionStatCard">
            <h4>Utilidad estimada</h4>
            <p>{formatearMoneda(estadisticasGenerales.utilidad)}</p>
          </article>
        </div>

        <div className="produccionCardsGrid">
          {!recetasFiltradas.length ? (
            <div className="produccionCardVacia">No hay recetas que coincidan con la búsqueda.</div>
          ) : (
            recetasFiltradas.map((receta) => {
              const idReceta = Number(receta?.id_receta || 0);
              const nombreReceta = String(receta?.nombre_receta || '').trim();
              const categoria = String(receta?.categoria || '').trim();
              const gramaje = Number(receta?.gramaje || 0);
              const precioSugerido = Number(receta?.precio_sugerido || 0);
              const piezasProducidas = Number(receta?.piezas_producidas || 0);
              const piezasFaltantesPedido = Number(receta?.piezas_faltantes_pedido || 0);
              const piezasDisponibles = Number(receta?.piezas_disponibles || 0);
              const loteVenta = receta?.lote_venta || null;

              return (
                <article className="produccionCard" key={idReceta}>
                  <header className="produccionCardHeader">
                    <div>
                      <h3>{nombreReceta || 'Receta sin nombre'}</h3>
                      <p>{categoria || 'Sin categoría'}{gramaje > 0 ? ` • ${gramaje}g` : ''}</p>
                    </div>
                    <span className="badgeDisponibles">Disponibles: {piezasDisponibles.toFixed(2)}</span>
                  </header>

                  <div className="produccionCardStats">
                    <div><strong>Producidas</strong><span>{piezasProducidas.toFixed(2)}</span></div>
                    <div><strong>Faltantes pedido</strong><span>{piezasFaltantesPedido.toFixed(2)}</span></div>
                    <div><strong>Precio sugerido</strong><span>{formatearMoneda(precioSugerido)}</span></div>
                    <div><strong>Caducidad lote activo</strong><span>{loteVenta?.fecha_caducidad ? formatearFechaCorta(loteVenta.fecha_caducidad) : '-'}</span></div>
                  </div>

                  <div className="produccionCardAcciones">
                    <button
                      className="botonPequeno botonVender"
                      disabled={!loteVenta}
                      onClick={() => abrirModalVenta(receta)}
                    >
                      Vender
                    </button>

                    <button
                      className="botonPequeno botonCortesiaProduccion"
                      disabled={!loteVenta}
                      onClick={() => abrirModalCortesia(receta)}
                    >
                      Cortesía
                    </button>

                    <button
                      className="botonPequeno botonDanger"
                      disabled={!loteVenta}
                      onClick={() => eliminarProduccion(receta)}
                    >
                      Eliminar
                    </button>

                    <button
                      className="botonPequeno botonHistorial"
                      onClick={() => abrirHistorialReceta(idReceta)}
                    >
                      Ver historial
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>

      <div id="modalVentaPedido" className="modal" onClick={() => cerrarModal('modalVentaPedido')}>
        <div className="contenidoModal" onClick={(e) => e.stopPropagation()}>
          <div className="encabezadoModal">
            <h3>Registrar Venta</h3>
            <button className="cerrarModal" onClick={() => cerrarModal('modalVentaPedido')}>&times;</button>
          </div>
          <form onSubmit={confirmarVentaPedido} className="cajaFormulario">
            <label htmlFor="cantidadVentaPiezas">Piezas a vender</label>
            <input id="cantidadVentaPiezas" type="number" min="0.01" step="0.01" required />
            <label htmlFor="numeroPedidoVenta">Número de pedido</label>
            <input id="numeroPedidoVenta" type="text" placeholder="Opcional, si se deja vacío se genera VECHI..." />
            <button className="boton botonExito" type="submit">Confirmar</button>
          </form>
        </div>
      </div>

      <div id="modalCortesia" className="modal" onClick={() => cerrarModal('modalCortesia')}>
        <div className="contenidoModal" onClick={(e) => e.stopPropagation()}>
          <div className="encabezadoModal">
            <h3>Registrar Cortesía</h3>
            <button className="cerrarModal" onClick={() => cerrarModal('modalCortesia')}>&times;</button>
          </div>
          <form onSubmit={confirmarCortesia} className="cajaFormulario">
            <label htmlFor="cantidadCortesiaPiezas">Piezas a cortesía</label>
            <input id="cantidadCortesiaPiezas" type="number" min="0.01" step="0.01" required />
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

      {modalEliminar.abierto && (
        <div
          id="modalEliminarProduccion"
          className="modal"
          style={{ display: 'flex' }}
          onClick={cerrarModalEliminar}
        >
          <div className="contenidoModal" onClick={(e) => e.stopPropagation()}>
            <div className="encabezadoModal">
              <h3>Eliminar producción</h3>
              <button className="cerrarModal" onClick={cerrarModalEliminar}>&times;</button>
            </div>

            <div className="cajaFormulario modalEliminarContenido">
              <p>
                Receta: <strong>{String(modalEliminar?.receta?.nombre_receta || '-')}</strong>
              </p>
              <p>
                Producidas: <strong>{Number(modalEliminar?.receta?.piezas_producidas || 0).toFixed(2)}</strong> pzas
              </p>

              <label htmlFor="cantidadEliminarProduccion">Cantidad a eliminar</label>
              <input
                id="cantidadEliminarProduccion"
                type="number"
                min="0.01"
                step="0.01"
                max={Number(modalEliminar?.receta?.piezas_producidas || 0).toFixed(2)}
                value={modalEliminar.cantidad}
                onChange={(e) => setModalEliminar((prev) => ({ ...prev, cantidad: e.target.value }))}
              />

              <div className="modalEliminarAcciones">
                <button className="boton" type="button" onClick={cerrarModalEliminar}>Cancelar</button>
                <button className="boton botonDanger" type="button" onClick={confirmarEliminarCantidad}>Eliminar cantidad</button>
                <button className="boton botonExito" type="button" onClick={confirmarEliminarTodo}>Eliminar todo</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalHistorialAbierto && (
        <div
          id="modalHistorialProduccion"
          className="modal"
          style={{ display: 'flex' }}
          onClick={() => setModalHistorialAbierto(false)}
        >
          <div className="contenidoModal" onClick={(e) => e.stopPropagation()}>
            <div className="encabezadoModal">
              <h3>Historial de receta</h3>
              <button className="cerrarModal" onClick={() => setModalHistorialAbierto(false)}>&times;</button>
            </div>

            <div className="produccionHistorialTabs">
              <button
                className={`produccionHistorialTab${pestanaHistorial === 'produccion' ? ' activa' : ''}`}
                onClick={() => setPestanaHistorial('produccion')}
              >
                Producción
              </button>
              <button
                className={`produccionHistorialTab${pestanaHistorial === 'ventas' ? ' activa' : ''}`}
                onClick={() => setPestanaHistorial('ventas')}
              >
                Ventas/Cortesías
              </button>
            </div>

            <div className="produccionHistorialContenido">
              {pestanaHistorial === 'produccion' ? (
                Array.isArray(historialData?.produccion) && historialData.produccion.length > 0 ? (
                  <ul>
                    {historialData.produccion.map((h, idx) => {
                      const cantidad = Number(h?.cantidad || 0);
                      const costo = Number(h?.costo_produccion || 0);
                      const precio = Number(h?.precio_venta || 0);
                      const ganancia = (precio * cantidad) - costo;
                      return (
                        <li key={`prod-${idx}`}>
                          <span>
                            {formatearFechaCorta(h?.fecha_produccion)} · {cantidad.toFixed(2)} pzas
                          </span>
                          <span>
                            Costo {formatearMoneda(costo)} · Precio {formatearMoneda(precio)} · Ganancia {formatearMoneda(ganancia)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="historialVacio">Sin producciones registradas</p>
                )
              ) : (
                Array.isArray(historialData?.ventasCortesias) && historialData.ventasCortesias.length > 0 ? (
                  <ul>
                    {historialData.ventasCortesias.map((v, idx) => (
                      <li key={`vent-${idx}`}>
                        <span>
                          {formatearFechaCorta(v?.fecha_venta)} · {Number(v?.cantidad || 0).toFixed(2)} pzas · {v?.tipo_baja || '-'}
                        </span>
                        <span>
                          Usuario: {v?.usuario || '-'}
                          {v?.numero_pedido ? ` · Pedido: ${v.numero_pedido}` : ''}
                          {v?.motivo ? ` · Motivo: ${v.motivo}` : ''}
                          {v?.para_quien ? ` · Para: ${v.para_quien}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="historialVacio">Sin ventas/cortesías registradas</p>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
