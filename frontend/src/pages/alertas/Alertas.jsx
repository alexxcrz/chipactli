import React, { useEffect } from 'react';
import './Alertas.css';
import {
  agregarAlerta,
  removerAlertaPorClave,
  moverAlertaAHistorial,
  cambiarPestanaAlertas,
  actualizarUIAlertas
} from '../../utils/notificaciones.jsx';

export default function Alertas() {
  useEffect(() => {
    window.alertasUI = {
      alternarAlertas,
      agregarAlerta,
      removerAlertaPorClave,
      moverAlertaAHistorial,
      cambiarPestanaAlertas,
      actualizarUIAlertas
    };
    actualizarUIAlertas();
    cambiarPestanaAlertas('activas');
  }, []);

  return (
    <div className="tarjeta">
      <div className="encabezadoTarjeta">
        <h2>Alertas</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button id="tabAlertasActivas" className="boton activa" onClick={() => cambiarPestanaAlertas('activas')}>Activas</button>
          <button id="tabAlertasHistorial" className="boton" onClick={() => cambiarPestanaAlertas('historial')}>Historial</button>
        </div>
      </div>
      <div id="listaAlertas" className="listaAlertas"></div>
      <div id="listaAlertasHistorial" className="listaAlertas oculto"></div>
    </div>
  );
}

export function alternarAlertas() {
  const desplegable = document.getElementById('desplegableAlertas');
  if (desplegable) {
    desplegable.classList.toggle('mostrado');
    cambiarPestanaAlertas('activas');
  }
}
