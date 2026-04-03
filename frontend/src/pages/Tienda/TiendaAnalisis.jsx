import React, { useEffect, useMemo, useState } from 'react';
import { fetchAPIJSON } from '../../utils/api.jsx';
import './TiendaAnalisis.css';

function fechaLocalIsoHoy() {
  const ahora = new Date();
  const yyyy = ahora.getFullYear();
  const mm = String(ahora.getMonth() + 1).padStart(2, '0');
  const dd = String(ahora.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function obtenerMesActual() {
  return fechaLocalIsoHoy().slice(0, 7);
}

function parsearFechaIso(valor = '') {
  const txt = String(valor || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(txt)) return null;
  const fecha = new Date(`${txt}T12:00:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function formatearFechaIso(fecha) {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return '';
  return fecha.toISOString().slice(0, 10);
}

function sumarDiasIso(valor = '', dias = 0) {
  const fecha = parsearFechaIso(valor);
  if (!fecha) return '';
  fecha.setDate(fecha.getDate() + (Number(dias) || 0));
  return formatearFechaIso(fecha);
}

function obtenerRangoMes(valorMes = '') {
  const mes = /^\d{4}-\d{2}$/.test(String(valorMes || '').trim()) ? String(valorMes).trim() : obtenerMesActual();
  const desde = `${mes}-01`;
  const fechaInicio = parsearFechaIso(desde);
  const fin = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth() + 1, 0, 12, 0, 0, 0);
  return { desde, hasta: formatearFechaIso(fin) };
}

function obtenerDomingoSemana(valor = '') {
  const fecha = parsearFechaIso(valor);
  if (!fecha) return '';
  fecha.setDate(fecha.getDate() - fecha.getDay());
  return formatearFechaIso(fecha);
}

function obtenerSabadoSemana(valor = '') {
  const domingo = obtenerDomingoSemana(valor);
  return domingo ? sumarDiasIso(domingo, 6) : '';
}

function formatearNumero(valor = 0) {
  return new Intl.NumberFormat('es-MX').format(Number(valor) || 0);
}

function formatearDelta(valor = 0) {
  const numero = Number(valor) || 0;
  const base = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(Math.abs(numero));
  if (numero > 0) return `+${base}`;
  if (numero < 0) return `-${base}`;
  return '0';
}

function formatearMes(valorMes = '') {
  if (!/^\d{4}-\d{2}$/.test(String(valorMes || '').trim())) return valorMes;
  const [yyyy, mm] = String(valorMes).split('-');
  const fecha = new Date(Number(yyyy), Number(mm) - 1, 1, 12, 0, 0, 0);
  return fecha.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

function formatearFechaHumana(valor = '') {
  const fecha = parsearFechaIso(valor);
  if (!fecha) return valor || 'Sin fecha';
  return fecha.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function leerEstadoUrl() {
  if (typeof window === 'undefined') {
    return { tab: 'visitas', mes: obtenerMesActual() };
  }
  const hashRaw = String(window.location.hash || '');
  const idxQuery = hashRaw.indexOf('?');
  const paramsHash = new URLSearchParams(idxQuery >= 0 ? hashRaw.slice(idxQuery + 1) : '');
  const paramsSearch = new URLSearchParams(String(window.location.search || ''));
  const tab = String(paramsHash.get('tab') || paramsSearch.get('tab') || 'visitas').trim().toLowerCase();
  const mes = String(paramsHash.get('mes') || paramsSearch.get('mes') || obtenerMesActual()).trim();
  return {
    tab: tab === 'acciones' ? 'acciones' : 'visitas',
    mes: /^\d{4}-\d{2}$/.test(mes) ? mes : obtenerMesActual()
  };
}

function actualizarEstadoUrl({ tab, mes }) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const params = new URLSearchParams();
  params.set('tab', tab === 'acciones' ? 'acciones' : 'visitas');
  params.set('mes', /^\d{4}-\d{2}$/.test(String(mes || '').trim()) ? String(mes).trim() : obtenerMesActual());
  url.search = '';
  url.hash = `#/metricas-analisis?${params.toString()}`;
  window.history.replaceState({}, document.title, url.toString());
}

function agruparSemanas(porDia = []) {
  const mapa = new Map();
  (Array.isArray(porDia) ? porDia : []).forEach((item) => {
    const fecha = String(item?.fecha || '').trim();
    if (!fecha) return;
    const inicio = obtenerDomingoSemana(fecha);
    if (!inicio) return;
    if (!mapa.has(inicio)) {
      mapa.set(inicio, { inicio, fin: obtenerSabadoSemana(fecha), visitas: 0, eventos: 0, dias: [] });
    }
    const actual = mapa.get(inicio);
    actual.visitas += Number(item?.visitas) || 0;
    actual.eventos += Number(item?.eventos) || 0;
    actual.dias.push(item);
  });
  return Array.from(mapa.values()).sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
}

function construirRangoComparacion(tipo = 'mes', mes = '') {
  const rangoMes = obtenerRangoMes(mes);
  const hoy = fechaLocalIsoHoy();
  const ancla = rangoMes.hasta > hoy ? hoy : rangoMes.hasta;

  if (tipo === 'dia') {
    return {
      actual: { desde: ancla, hasta: ancla, label: ancla },
      previo: { desde: sumarDiasIso(ancla, -1), hasta: sumarDiasIso(ancla, -1), label: sumarDiasIso(ancla, -1) }
    };
  }

  if (tipo === 'semana') {
    const inicioActual = obtenerDomingoSemana(ancla);
    const finActual = obtenerSabadoSemana(ancla);
    const inicioPrevio = sumarDiasIso(inicioActual, -7);
    const finPrevio = sumarDiasIso(finActual, -7);
    return {
      actual: { desde: inicioActual, hasta: finActual, label: `${inicioActual} a ${finActual}` },
      previo: { desde: inicioPrevio, hasta: finPrevio, label: `${inicioPrevio} a ${finPrevio}` }
    };
  }

  if (tipo === 'anio') {
    const year = Number(String(mes || obtenerMesActual()).slice(0, 4)) || new Date().getFullYear();
    return {
      actual: { desde: `${year}-01-01`, hasta: `${year}-12-31`, label: String(year) },
      previo: { desde: `${year - 1}-01-01`, hasta: `${year - 1}-12-31`, label: String(year - 1) }
    };
  }

  const fechaInicio = parsearFechaIso(rangoMes.desde);
  const previo = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth() - 1, 1, 12, 0, 0, 0);
  const previoMes = `${previo.getFullYear()}-${String(previo.getMonth() + 1).padStart(2, '0')}`;
  const rangoPrevio = obtenerRangoMes(previoMes);
  return {
    actual: { ...rangoMes, label: formatearMes(mes) },
    previo: { ...rangoPrevio, label: formatearMes(previoMes) }
  };
}

function crearDraftComparacion(tipo = 'mes', mes = '') {
  const base = construirRangoComparacion(tipo, mes);
  return {
    actualDesde: String(base.actual?.desde || '').trim(),
    actualHasta: String(base.actual?.hasta || '').trim(),
    previoDesde: String(base.previo?.desde || '').trim(),
    previoHasta: String(base.previo?.hasta || '').trim()
  };
}

function obtenerClasesDelta(valor = 0) {
  const numero = Number(valor) || 0;
  if (numero > 0) return 'positivo';
  if (numero < 0) return 'negativo';
  return 'neutro';
}

export default function TiendaAnalisis() {
  const estadoInicialUrl = useMemo(() => leerEstadoUrl(), []);
  const [tabActiva, setTabActiva] = useState(estadoInicialUrl.tab);
  const [mesSeleccionado, setMesSeleccionado] = useState(estadoInicialUrl.mes);
  const [analisis, setAnalisis] = useState({
    cargando: true,
    error: '',
    desde: '',
    hasta: '',
    porDia: [],
    totalVisitas: 0,
    totalEventos: 0,
    promedioVisitasDia: 0,
    diaConMasVisitas: { fecha: '', visitas: 0, eventos: 0 },
    topUbicaciones: [],
    topAcciones: [],
    topProductos: []
  });
  const [comparacionAbierta, setComparacionAbierta] = useState(false);
  const [tipoComparacion, setTipoComparacion] = useState('mes');
  const [comparacionDraft, setComparacionDraft] = useState(() => crearDraftComparacion('mes', estadoInicialUrl.mes));
  const [comparando, setComparando] = useState(false);
  const [comparacion, setComparacion] = useState(null);

  useEffect(() => {
    const sincronizar = () => {
      const estado = leerEstadoUrl();
      setTabActiva(estado.tab);
      setMesSeleccionado(estado.mes);
    };
    window.addEventListener('hashchange', sincronizar);
    window.addEventListener('popstate', sincronizar);
    return () => {
      window.removeEventListener('hashchange', sincronizar);
      window.removeEventListener('popstate', sincronizar);
    };
  }, []);

  useEffect(() => {
    actualizarEstadoUrl({ tab: tabActiva, mes: mesSeleccionado });
  }, [tabActiva, mesSeleccionado]);

  useEffect(() => {
    if (!comparacionAbierta) return;
    setComparacionDraft(crearDraftComparacion(tipoComparacion, mesSeleccionado));
    setComparacion(null);
  }, [comparacionAbierta, tipoComparacion, mesSeleccionado]);

  useEffect(() => {
    let cancelado = false;
    const rango = obtenerRangoMes(mesSeleccionado);

    async function cargar() {
      setAnalisis((prev) => ({ ...prev, cargando: true, error: '' }));
      try {
        const data = await fetchAPIJSON(`/tienda/admin/visitas/analisis?desde=${encodeURIComponent(rango.desde)}&hasta=${encodeURIComponent(rango.hasta)}`);
        if (cancelado) return;
        setAnalisis({
          cargando: false,
          error: '',
          desde: String(data?.desde || rango.desde),
          hasta: String(data?.hasta || rango.hasta),
          porDia: Array.isArray(data?.porDia) ? data.porDia : [],
          totalVisitas: Number(data?.totalVisitas) || 0,
          totalEventos: Number(data?.totalEventos) || 0,
          promedioVisitasDia: Number(data?.promedioVisitasDia) || 0,
          diaConMasVisitas: {
            fecha: String(data?.diaConMasVisitas?.fecha || '').trim(),
            visitas: Number(data?.diaConMasVisitas?.visitas) || 0,
            eventos: Number(data?.diaConMasVisitas?.eventos) || 0
          },
          topUbicaciones: Array.isArray(data?.topUbicaciones) ? data.topUbicaciones : [],
          topAcciones: Array.isArray(data?.topAcciones) ? data.topAcciones : [],
          topProductos: Array.isArray(data?.topProductos) ? data.topProductos : []
        });
      } catch (error) {
        if (cancelado) return;
        setAnalisis((prev) => ({ ...prev, cargando: false, error: error?.message || 'No se pudo cargar el análisis' }));
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [mesSeleccionado]);

  const semanasMes = useMemo(() => agruparSemanas(analisis.porDia), [analisis.porDia]);
  const maximoDiaMes = useMemo(
    () => (analisis.porDia || []).reduce((max, item) => Math.max(max, Number(item?.visitas) || 0), 0),
    [analisis.porDia]
  );
  const maximoSemanaMes = useMemo(
    () => semanasMes.reduce((max, item) => Math.max(max, Number(item?.visitas) || 0), 0),
    [semanasMes]
  );

  const errorDraftComparacion = useMemo(() => {
    const actualDesde = parsearFechaIso(comparacionDraft.actualDesde);
    const actualHasta = parsearFechaIso(comparacionDraft.actualHasta);
    const previoDesde = parsearFechaIso(comparacionDraft.previoDesde);
    const previoHasta = parsearFechaIso(comparacionDraft.previoHasta);

    if (!actualDesde || !actualHasta || !previoDesde || !previoHasta) {
      return 'Debes elegir las cuatro fechas del comparador.';
    }
    if (actualDesde.getTime() > actualHasta.getTime()) {
      return 'El periodo actual tiene la fecha inicial mayor que la final.';
    }
    if (previoDesde.getTime() > previoHasta.getTime()) {
      return 'El periodo previo tiene la fecha inicial mayor que la final.';
    }
    return '';
  }, [comparacionDraft]);

  async function ejecutarComparacion() {
    if (errorDraftComparacion) {
      setComparacion({ error: errorDraftComparacion });
      return;
    }

    const rangos = {
      actual: {
        desde: comparacionDraft.actualDesde,
        hasta: comparacionDraft.actualHasta,
        label: `${comparacionDraft.actualDesde} a ${comparacionDraft.actualHasta}`
      },
      previo: {
        desde: comparacionDraft.previoDesde,
        hasta: comparacionDraft.previoHasta,
        label: `${comparacionDraft.previoDesde} a ${comparacionDraft.previoHasta}`
      }
    };
    setComparando(true);
    try {
      const [actual, previo] = await Promise.all([
        fetchAPIJSON(`/tienda/admin/visitas/analisis?desde=${encodeURIComponent(rangos.actual.desde)}&hasta=${encodeURIComponent(rangos.actual.hasta)}`),
        fetchAPIJSON(`/tienda/admin/visitas/analisis?desde=${encodeURIComponent(rangos.previo.desde)}&hasta=${encodeURIComponent(rangos.previo.hasta)}`)
      ]);
      setComparacion({ tipo: tipoComparacion, rangos, actual, previo });
    } catch (error) {
      setComparacion({ error: error?.message || 'No se pudo completar la comparación' });
    } finally {
      setComparando(false);
    }
  }

  const resumenComparacion = useMemo(() => {
    if (!comparacion || comparacion.error || !comparacion.actual || !comparacion.previo) return [];
    const actual = comparacion.actual;
    const previo = comparacion.previo;
    return [
      {
        label: 'Visitas únicas',
        actual: Number(actual?.totalVisitas) || 0,
        previo: Number(previo?.totalVisitas) || 0
      },
      {
        label: 'Eventos',
        actual: Number(actual?.totalEventos) || 0,
        previo: Number(previo?.totalEventos) || 0
      },
      {
        label: 'Promedio diario',
        actual: Number(actual?.promedioVisitasDia) || 0,
        previo: Number(previo?.promedioVisitasDia) || 0
      }
    ].map((item) => ({ ...item, delta: item.actual - item.previo }));
  }, [comparacion]);

  const tituloComparacion = useMemo(() => {
    if (!comparacion?.rangos) return 'Comparación';
    const mapa = { dia: 'Días', semana: 'Semanas', mes: 'Meses', anio: 'Años' };
    return `Comparación de ${mapa[comparacion.tipo] || 'periodos'}`;
  }, [comparacion]);

  return (
    <div className="tiendaAnalisisPantalla">
      <header className="tiendaAnalisisHero">
        <div>
          <span className="tiendaAnalisisEyebrow">Analítica completa</span>
          <h1>Centro de análisis de Tienda</h1>
          <p>
            Revisa el comportamiento mensual a detalle, compara periodos y alterna entre visitas y acciones sin salir de pantalla completa.
          </p>
        </div>
        <div className="tiendaAnalisisHeroAcciones">
          <label>
            Mes a revisar
            <input type="month" value={mesSeleccionado} onChange={(event) => setMesSeleccionado(String(event.target.value || '').trim() || obtenerMesActual())} />
          </label>
          <button type="button" className="boton" onClick={() => setComparacionAbierta(true)}>Comparar</button>
          <button
            type="button"
            className="boton botonSecundario"
            onClick={() => {
              if (window.opener) {
                window.close();
                return;
              }
              window.location.hash = '#/trastienda';
            }}
          >
            Cerrar análisis
          </button>
        </div>
      </header>

      <div className="tiendaAnalisisTabs" role="tablist" aria-label="Paneles de análisis">
        <button type="button" className={tabActiva === 'visitas' ? 'activa' : ''} onClick={() => setTabActiva('visitas')}>Visitas</button>
        <button type="button" className={tabActiva === 'acciones' ? 'activa' : ''} onClick={() => setTabActiva('acciones')}>Acciones</button>
      </div>

      {analisis.error && <div className="tiendaAnalisisError">{analisis.error}</div>}

      <section className="tiendaAnalisisResumen">
        <article className="tiendaAnalisisKpi">
          <span>Mes analizado</span>
          <strong>{formatearMes(mesSeleccionado)}</strong>
        </article>
        <article className="tiendaAnalisisKpi">
          <span>Total visitas únicas</span>
          <strong>{formatearNumero(analisis.totalVisitas)}</strong>
        </article>
        <article className="tiendaAnalisisKpi">
          <span>Total eventos</span>
          <strong>{formatearNumero(analisis.totalEventos)}</strong>
        </article>
        <article className="tiendaAnalisisKpi">
          <span>Promedio diario</span>
          <strong>{analisis.promedioVisitasDia}</strong>
        </article>
        <article className="tiendaAnalisisKpi">
          <span>Día más fuerte</span>
          <strong>{analisis.diaConMasVisitas?.fecha || 'N/A'}</strong>
          <small>{formatearNumero(analisis.diaConMasVisitas?.visitas)} visitas</small>
        </article>
      </section>

      {tabActiva === 'visitas' && (
        <div className="tiendaAnalisisGrid">
          <section className="tiendaAnalisisCard tiendaAnalisisCardAncha">
            <div className="tiendaAnalisisCardHead">
              <h2>Visitas por día del mes</h2>
              <span>{analisis.desde} a {analisis.hasta}</span>
            </div>
            <div className="tiendaAnalisisChartLista">
              {(analisis.porDia || []).map((item) => {
                const visitas = Number(item?.visitas) || 0;
                const ancho = maximoDiaMes > 0 ? Math.max(4, Math.round((visitas / maximoDiaMes) * 100)) : 0;
                return (
                  <div key={item?.fecha || 'sin-fecha'} className="tiendaAnalisisChartFila">
                    <span>{item?.fecha || 'Sin fecha'}</span>
                    <div className="tiendaAnalisisChartBarraWrap">
                      <div className="tiendaAnalisisChartBarra" style={{ width: `${ancho}%` }} />
                    </div>
                    <strong>{formatearNumero(visitas)}</strong>
                  </div>
                );
              })}
              {!analisis.cargando && !(analisis.porDia || []).length && <div className="tiendaAnalisisVacio">Sin datos para este mes.</div>}
            </div>
          </section>

          <section className="tiendaAnalisisCard">
            <div className="tiendaAnalisisCardHead">
              <h2>Semanas del mes</h2>
              <span>Domingo a sábado</span>
            </div>
            <div className="tiendaAnalisisChartLista compacta">
              {semanasMes.map((item) => {
                const visitas = Number(item?.visitas) || 0;
                const ancho = maximoSemanaMes > 0 ? Math.max(4, Math.round((visitas / maximoSemanaMes) * 100)) : 0;
                return (
                  <div key={item?.inicio || 'semana'} className="tiendaAnalisisChartFila">
                    <span>{item?.inicio} a {item?.fin}</span>
                    <div className="tiendaAnalisisChartBarraWrap">
                      <div className="tiendaAnalisisChartBarra" style={{ width: `${ancho}%` }} />
                    </div>
                    <strong>{formatearNumero(visitas)}</strong>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="tiendaAnalisisCard">
            <div className="tiendaAnalisisCardHead">
              <h2>Ubicaciones top</h2>
              <span>Rango mensual</span>
            </div>
            <ul className="tiendaAnalisisListaTop">
              {(analisis.topUbicaciones || []).map((item, idx) => (
                <li key={`ubicacion-${idx}-${item?.ubicacion || 'sin-ubi'}`}>
                  <span>{item?.ubicacion || item?.pais || 'Desconocido'}</span>
                  <strong>{formatearNumero(item?.total)}</strong>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tabActiva === 'acciones' && (
        <div className="tiendaAnalisisGrid">
          <section className="tiendaAnalisisCard">
            <div className="tiendaAnalisisCardHead">
              <h2>Acciones más realizadas</h2>
              <span>Mes actual</span>
            </div>
            <ul className="tiendaAnalisisListaTop">
              {(analisis.topAcciones || []).map((item, idx) => (
                <li key={`accion-${idx}-${item?.accion || 'accion'}`}>
                  <span>{String(item?.accion || 'accion').replace(/_/g, ' ')}</span>
                  <strong>{formatearNumero(item?.total)}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="tiendaAnalisisCard">
            <div className="tiendaAnalisisCardHead">
              <h2>Productos con más interés</h2>
              <span>Mes actual</span>
            </div>
            <ul className="tiendaAnalisisListaTop">
              {(analisis.topProductos || []).map((item, idx) => (
                <li key={`producto-${idx}-${item?.producto || 'producto'}`}>
                  <span>{item?.producto || 'Producto'}</span>
                  <strong>{formatearNumero(item?.total)}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="tiendaAnalisisCard tiendaAnalisisCardAncha">
            <div className="tiendaAnalisisCardHead">
              <h2>Resumen de acciones</h2>
              <span>Detalle mensual</span>
            </div>
            <div className="tiendaAnalisisNarrativa">
              <p>
                Durante {formatearMes(mesSeleccionado)}, la tienda acumuló <strong>{formatearNumero(analisis.totalEventos)}</strong> eventos.
              </p>
              <p>
                La acción principal fue <strong>{String(analisis.topAcciones?.[0]?.accion || 'sin datos').replace(/_/g, ' ')}</strong> y el producto con más interacciones fue <strong>{analisis.topProductos?.[0]?.producto || 'sin datos'}</strong>.
              </p>
            </div>
          </section>
        </div>
      )}

      {comparacionAbierta && (
        <div className="tiendaAnalisisModalBackdrop" onClick={() => setComparacionAbierta(false)}>
          <div className="tiendaAnalisisModal" onClick={(event) => event.stopPropagation()}>
            <div className="tiendaAnalisisModalHead">
              <div>
                <span className="tiendaAnalisisEyebrow">Comparador</span>
                <h2>{tituloComparacion}</h2>
              </div>
              <button type="button" className="cerrarModal" onClick={() => setComparacionAbierta(false)}>×</button>
            </div>

            <div className="tiendaAnalisisComparadorControles">
              <label>
                Tipo de comparación
                <select value={tipoComparacion} onChange={(event) => setTipoComparacion(String(event.target.value || 'mes'))}>
                  <option value="dia">Días</option>
                  <option value="semana">Semanas</option>
                  <option value="mes">Meses</option>
                  <option value="anio">Años</option>
                </select>
              </label>
              <div className="tiendaAnalisisComparadorFechas">
                <div className="tiendaAnalisisComparadorFechasGrupo">
                  <strong>Periodo actual</strong>
                  <label>
                    Desde
                    <input
                      type="date"
                      value={comparacionDraft.actualDesde}
                      onChange={(event) => setComparacionDraft((prev) => ({ ...prev, actualDesde: String(event.target.value || '').trim() }))}
                    />
                  </label>
                  <label>
                    Hasta
                    <input
                      type="date"
                      value={comparacionDraft.actualHasta}
                      onChange={(event) => setComparacionDraft((prev) => ({ ...prev, actualHasta: String(event.target.value || '').trim() }))}
                    />
                  </label>
                </div>
                <div className="tiendaAnalisisComparadorFechasGrupo">
                  <strong>Periodo previo</strong>
                  <label>
                    Desde
                    <input
                      type="date"
                      value={comparacionDraft.previoDesde}
                      onChange={(event) => setComparacionDraft((prev) => ({ ...prev, previoDesde: String(event.target.value || '').trim() }))}
                    />
                  </label>
                  <label>
                    Hasta
                    <input
                      type="date"
                      value={comparacionDraft.previoHasta}
                      onChange={(event) => setComparacionDraft((prev) => ({ ...prev, previoHasta: String(event.target.value || '').trim() }))}
                    />
                  </label>
                </div>
              </div>
              <button type="button" className="boton" onClick={ejecutarComparacion} disabled={comparando}>
                {comparando ? 'Comparando...' : 'Comparar'}
              </button>
            </div>

            {(errorDraftComparacion || comparacion?.error) && <div className="tiendaAnalisisError">{comparacion?.error || errorDraftComparacion}</div>}

            {comparacion?.rangos && !comparacion?.error && (
              <>
                <div className="tiendaAnalisisComparadorRangos">
                  <article>
                    <span>Periodo actual</span>
                    <strong>{formatearFechaHumana(comparacion.rangos.actual.desde)} al {formatearFechaHumana(comparacion.rangos.actual.hasta)}</strong>
                    <small>{comparacion.rangos.actual.desde} a {comparacion.rangos.actual.hasta}</small>
                  </article>
                  <article>
                    <span>Periodo previo</span>
                    <strong>{formatearFechaHumana(comparacion.rangos.previo.desde)} al {formatearFechaHumana(comparacion.rangos.previo.hasta)}</strong>
                    <small>{comparacion.rangos.previo.desde} a {comparacion.rangos.previo.hasta}</small>
                  </article>
                </div>

                <div className="tiendaAnalisisComparadorMetricas">
                  {resumenComparacion.map((item) => (
                    <article key={item.label} className="tiendaAnalisisComparadorCard">
                      <span>{item.label}</span>
                      <strong>{formatearNumero(item.actual)}</strong>
                      <small>Previo: {formatearNumero(item.previo)}</small>
                      <em className={obtenerClasesDelta(item.delta)}>{formatearDelta(item.delta)}</em>
                    </article>
                  ))}
                </div>

                <div className="tiendaAnalisisComparadorTablas">
                  <section>
                    <h3>Acciones destacadas</h3>
                    <ul className="tiendaAnalisisListaTop compacta">
                      {(comparacion.actual?.topAcciones || []).slice(0, 6).map((item, idx) => (
                        <li key={`cmp-acc-act-${idx}-${item?.accion || 'accion'}`}>
                          <span>{String(item?.accion || 'accion').replace(/_/g, ' ')}</span>
                          <strong>{formatearNumero(item?.total)}</strong>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h3>Productos destacados</h3>
                    <ul className="tiendaAnalisisListaTop compacta">
                      {(comparacion.actual?.topProductos || []).slice(0, 6).map((item, idx) => (
                        <li key={`cmp-prod-act-${idx}-${item?.producto || 'producto'}`}>
                          <span>{item?.producto || 'Producto'}</span>
                          <strong>{formatearNumero(item?.total)}</strong>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}