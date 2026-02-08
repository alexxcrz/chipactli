// Gestión de Modales

export function abrirModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  
  modal.style.display = 'block';
  
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
  }
}

export function obtenerModal(id) {
  return document.getElementById(id);
}

export function mostrarConfirmacion(mensaje, titulo = 'Confirmar') {
  return new Promise((resolve) => {
    const modal = document.getElementById('modalConfirmacion');
    const texto = document.getElementById('textoConfirmacion');
    const tituloEl = document.getElementById('tituloConfirmacion');
    const btnAceptar = document.getElementById('btnConfirmacionAceptar');
    const btnCancelar = document.getElementById('btnConfirmacionCancelar');

    if (!modal || !texto || !tituloEl || !btnAceptar || !btnCancelar) {
      resolve(false);
      return;
    }

    tituloEl.textContent = titulo;
    texto.textContent = mensaje;

    const limpiar = () => {
      btnAceptar.onclick = null;
      btnCancelar.onclick = null;
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
