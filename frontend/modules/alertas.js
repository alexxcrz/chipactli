// Módulo de Alertas UI

import { agregarAlerta, removerAlertaPorClave, moverAlertaAHistorial, cambiarPestanaAlertas, actualizarUIAlertas } from '../utils/notificaciones.js';

export function alternarAlertas() {
  const desplegable = document.getElementById('desplegableAlertas');
  if (desplegable) {
    desplegable.classList.toggle('mostrado');
    cambiarPestanaAlertas('activas');
  }
}

export { agregarAlerta, removerAlertaPorClave, moverAlertaAHistorial, cambiarPestanaAlertas, actualizarUIAlertas };
