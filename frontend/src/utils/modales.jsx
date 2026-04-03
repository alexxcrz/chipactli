// Gestión de Modales

function actualizarClaseModalAbierto() {
  if (typeof document === 'undefined') return;

  const esVisible = (elemento) => {
    if (!elemento) return false;
    const style = window.getComputedStyle(elemento);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };

  const hayModalAbierto = Boolean(
    document.querySelectorAll('.modal, .modalAdminUsuarios, .modalNotificacion, #modalCambiarPassword').length
      && Array.from(document.querySelectorAll('.modal, .modalAdminUsuarios, .modalNotificacion, #modalCambiarPassword')).some(esVisible)
  );

  document.body.classList.toggle('chipactli-modal-open', hayModalAbierto);
}

export function abrirModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  
  modal.style.display = 'flex';
  actualizarClaseModalAbierto();
  
  // Si es el modal de recetas, asegurarse de que el campo de unidad esté deshabilitado inicialmente
  if (id === 'modalReceta') {
    const unidadField = document.getElementById('unidadIngrediente');
    if (unidadField) unidadField.disabled = true;
    const unidadValue = document.getElementById('unidadIngrediente');
    if (unidadValue) unidadValue.value = '';
  } else if (id === 'modalEditarReceta') {
    const editUnidadField = document.getElementById('editUnidadIngrediente');
    if (editUnidadField) editUnidadField.disabled = true;
    const editUnidadValue = document.getElementById('editUnidadIngrediente');
    if (editUnidadValue) editUnidadValue.value = '';
  }
}

export function cerrarModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = 'none';
    window.requestAnimationFrame(() => actualizarClaseModalAbierto());
  }
}

export function obtenerModal(id) {
  return document.getElementById(id);
}

function obtenerElementosConfirmacion() {
  return {
    modal: document.getElementById('modalConfirmacion'),
    texto: document.getElementById('textoConfirmacion'),
    tituloEl: document.getElementById('tituloConfirmacion'),
    btnAceptar: document.getElementById('btnConfirmacionAceptar'),
    btnCancelar: document.getElementById('btnConfirmacionCancelar'),
    contenedorEntrada: document.getElementById('contenedorEntradaConfirmacion'),
    descripcionEntrada: document.getElementById('descripcionEntradaConfirmacion'),
    labelEntrada: document.getElementById('labelEntradaConfirmacion'),
    inputEntrada: document.getElementById('inputConfirmacion')
  };
}

function limpiarConfiguracionEntradaConfirmacion() {
  const {
    contenedorEntrada,
    descripcionEntrada,
    labelEntrada,
    inputEntrada,
    btnAceptar,
    btnCancelar
  } = obtenerElementosConfirmacion();

  if (contenedorEntrada) contenedorEntrada.style.display = 'none';
  if (descripcionEntrada) {
    descripcionEntrada.textContent = '';
    descripcionEntrada.style.display = 'none';
  }
  if (labelEntrada) labelEntrada.textContent = 'Escribe para continuar';
  if (inputEntrada) {
    inputEntrada.value = '';
    inputEntrada.placeholder = '';
    inputEntrada.type = 'text';
    inputEntrada.autocomplete = 'off';
  }
  if (btnAceptar) btnAceptar.textContent = 'Aceptar';
  if (btnCancelar) btnCancelar.textContent = 'Cancelar';
}

export function mostrarConfirmacion(mensaje, titulo = 'Confirmar') {
  return new Promise((resolve) => {
    const { modal, texto, tituloEl, btnAceptar, btnCancelar } = obtenerElementosConfirmacion();

    if (!modal || !texto || !tituloEl || !btnAceptar || !btnCancelar) {
      resolve(false);
      return;
    }

    limpiarConfiguracionEntradaConfirmacion();
    tituloEl.textContent = titulo;
    texto.textContent = mensaje;

    const limpiar = () => {
      btnAceptar.onclick = null;
      btnCancelar.onclick = null;
      limpiarConfiguracionEntradaConfirmacion();
    };

    btnAceptar.onclick = () => {
      limpiar();
      cerrarModal('modalConfirmacion');
      resolve(true);
    };

    btnCancelar.onclick = () => {
      limpiar();
      cerrarModal('modalConfirmacion');
      resolve(false);
    };

    abrirModal('modalConfirmacion');
  });
}

export function solicitarTextoModal({
  titulo = 'Confirmar',
  mensaje = '',
  descripcion = '',
  etiqueta = 'Escribe para continuar',
  placeholder = '',
  valorInicial = '',
  tipo = 'text',
  aceptarLabel = 'Aceptar',
  cancelarLabel = 'Cancelar',
  autocomplete = 'off'
} = {}) {
  return new Promise((resolve) => {
    const {
      modal,
      texto,
      tituloEl,
      btnAceptar,
      btnCancelar,
      contenedorEntrada,
      descripcionEntrada,
      labelEntrada,
      inputEntrada
    } = obtenerElementosConfirmacion();

    if (!modal || !texto || !tituloEl || !btnAceptar || !btnCancelar || !contenedorEntrada || !labelEntrada || !inputEntrada) {
      resolve(null);
      return;
    }

    limpiarConfiguracionEntradaConfirmacion();
    tituloEl.textContent = titulo;
    texto.textContent = mensaje;
    contenedorEntrada.style.display = 'block';
    labelEntrada.textContent = etiqueta;
    inputEntrada.type = tipo === 'password' ? 'password' : 'text';
    inputEntrada.placeholder = placeholder;
    inputEntrada.value = String(valorInicial || '');
    inputEntrada.autocomplete = autocomplete;
    btnAceptar.textContent = aceptarLabel;
    btnCancelar.textContent = cancelarLabel;

    if (descripcionEntrada) {
      descripcionEntrada.textContent = descripcion;
      descripcionEntrada.style.display = descripcion ? 'block' : 'none';
    }

    const limpiar = () => {
      btnAceptar.onclick = null;
      btnCancelar.onclick = null;
      limpiarConfiguracionEntradaConfirmacion();
    };

    btnAceptar.onclick = () => {
      const valor = String(inputEntrada.value || '');
      limpiar();
      cerrarModal('modalConfirmacion');
      resolve(valor);
    };

    btnCancelar.onclick = () => {
      limpiar();
      cerrarModal('modalConfirmacion');
      resolve(null);
    };

    abrirModal('modalConfirmacion');
    window.requestAnimationFrame(() => {
      inputEntrada.focus();
      inputEntrada.select();
    });
  });
}

// Cerrar modal al hacer clic fuera (delegado)
export function inicializarCierreModalPorFondo() {
  document.addEventListener('click', (evento) => {
    if (evento.target.classList.contains('modal')) {
      if (evento.target.id === 'modalConfirmacion') {
        const btnCancelar = document.getElementById('btnConfirmacionCancelar');
        if (btnCancelar) btnCancelar.click();
        return;
      }
      evento.target.style.display = 'none';
    }
  });
}

export function inicializarCierreModalConEsc() {
  if (typeof window !== 'undefined' && window.__chipactliEscModalInit) {
    return;
  }

  if (typeof window !== 'undefined') {
    window.__chipactliEscModalInit = true;
  }

  const esVisible = (elemento) => {
    if (!elemento) return false;
    const style = window.getComputedStyle(elemento);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };

  const obtenerZIndex = (elemento) => {
    if (!elemento) return 0;
    const value = Number.parseInt(window.getComputedStyle(elemento).zIndex, 10);
    return Number.isFinite(value) ? value : 0;
  };

  const obtenerModalSuperior = () => {
    const candidatos = [];

    const modalCambiarPassword = document.getElementById('modalCambiarPassword');
    if (esVisible(modalCambiarPassword)) candidatos.push(modalCambiarPassword);

    const modalNotificacion = document.getElementById('modalNotificacion');
    if (esVisible(modalNotificacion)) candidatos.push(modalNotificacion);

    const modalAdminUsuarios = Array.from(document.querySelectorAll('.modalAdminUsuarios')).filter(esVisible);
    candidatos.push(...modalAdminUsuarios);

    const modalesLegacy = Array.from(document.querySelectorAll('.modal')).filter(esVisible);
    candidatos.push(...modalesLegacy);

    if (!candidatos.length) return null;

    let superior = candidatos[0];
    for (let i = 1; i < candidatos.length; i += 1) {
      const actual = candidatos[i];
      const zSuperior = obtenerZIndex(superior);
      const zActual = obtenerZIndex(actual);
      if (zActual >= zSuperior) {
        superior = actual;
      }
    }

    return superior;
  };

  let ultimoModalSuperior = null;

  const limpiarIndicadorModalSuperior = () => {
    document.querySelectorAll('.chipactli-modal-top').forEach((el) => el.classList.remove('chipactli-modal-top'));
    document.querySelectorAll('.chipactli-modal-top-content').forEach((el) => el.classList.remove('chipactli-modal-top-content'));
  };

  const actualizarIndicadorModalSuperior = () => {
    const modalActivo = obtenerModalSuperior();
    if (!modalActivo) {
      if (ultimoModalSuperior) {
        limpiarIndicadorModalSuperior();
        ultimoModalSuperior = null;
      }
      return;
    }

    if (modalActivo === ultimoModalSuperior) return;

    limpiarIndicadorModalSuperior();
    ultimoModalSuperior = modalActivo;

    modalActivo.classList.add('chipactli-modal-top');

    if (modalActivo.id === 'modalCambiarPassword') {
      const contenido = modalActivo.firstElementChild;
      if (contenido) contenido.classList.add('chipactli-modal-top-content');
      return;
    }

    if (modalActivo.classList.contains('modalAdminUsuarios')) {
      const contenido = modalActivo.querySelector('.contenidoModalAdminUsuarios');
      if (contenido) contenido.classList.add('chipactli-modal-top-content');
      return;
    }

    if (modalActivo.classList.contains('modal')) {
      const contenido = modalActivo.querySelector('.contenidoModal');
      if (contenido) contenido.classList.add('chipactli-modal-top-content');
    }
  };

  const actualizarEnSiguienteFrame = () => {
    window.requestAnimationFrame(() => actualizarIndicadorModalSuperior());
  };

  actualizarIndicadorModalSuperior();
  actualizarClaseModalAbierto();

  document.addEventListener('click', actualizarEnSiguienteFrame);

  const observadorModales = new MutationObserver(() => {
    actualizarEnSiguienteFrame();
    actualizarClaseModalAbierto();
  });
  observadorModales.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style']
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') {
      const modalActivo = obtenerModalSuperior();
      if (!modalActivo) return;

      if (modalActivo.id === 'modalNotificacion') {
        evento.preventDefault();
        if (typeof window.cerrarNotificacion === 'function') {
          window.cerrarNotificacion();
        } else {
          const fondoNotificacion = document.getElementById('fondoNotificacion');
          modalActivo.style.display = 'none';
          if (fondoNotificacion) fondoNotificacion.style.display = 'none';
        }
        actualizarEnSiguienteFrame();
        actualizarClaseModalAbierto();
        return;
      }

      if (modalActivo.id === 'modalConfirmacion') {
        const btnAceptar = document.getElementById('btnConfirmacionAceptar');
        if (btnAceptar) {
          evento.preventDefault();
          btnAceptar.click();
          actualizarEnSiguienteFrame();
        }
      }
      return;
    }

    if (evento.key !== 'Escape') return;

    const modalActivo = obtenerModalSuperior();
    if (!modalActivo) return;

    if (modalActivo.id === 'modalCambiarPassword') {
      modalActivo.remove();
      actualizarClaseModalAbierto();
      return;
    }

    if (modalActivo.id === 'modalNotificacion') {
      if (typeof window.cerrarNotificacion === 'function') {
        window.cerrarNotificacion();
      } else {
        const fondoNotificacion = document.getElementById('fondoNotificacion');
        modalActivo.style.display = 'none';
        if (fondoNotificacion) fondoNotificacion.style.display = 'none';
      }
      actualizarEnSiguienteFrame();
      actualizarClaseModalAbierto();
      return;
    }

    if (modalActivo.id === 'modalConfirmacion') {
      const btnCancelar = document.getElementById('btnConfirmacionCancelar');
      if (btnCancelar) {
        btnCancelar.click();
        actualizarEnSiguienteFrame();
        return;
      }
    }

    modalActivo.style.display = 'none';
    actualizarEnSiguienteFrame();
    actualizarClaseModalAbierto();
  });
}
