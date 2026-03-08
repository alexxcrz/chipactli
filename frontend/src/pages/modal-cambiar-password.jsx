// modal-cambiar-password.js
import { mostrarNotificacion } from '../utils/notificaciones.jsx';

export function mostrarModalCambiarPassword(username) {
  if (document.getElementById('modalCambiarPassword')) return;
  const modal = document.createElement('div');
  modal.id = 'modalCambiarPassword';
  modal.className = 'modal modalCambiarPassword chipactli-modal-top';
  modal.innerHTML = `
    <div class="contenidoModal contenidoModalPassword chipactli-modal-top-content">
      <div class="encabezadoModal">
        <h3>Cambia tu contraseña</h3>
        <button type="button" class="cerrarModal" onclick="document.getElementById('modalCambiarPassword').remove()">&times;</button>
      </div>
      <form id="formCambiarPassword" class="cajaFormulario">
        <div class="grupoFormulario">
          <label for="cambiarPasswordActual">Contraseña actual</label>
          <div class="passwordInputWrap">
            <input id="cambiarPasswordActual" class="passwordInputField" type="password" name="password_actual" placeholder="Contraseña actual" required>
            <button type="button" class="passwordToggleBtn" data-password-toggle="password_actual" aria-label="Mostrar contraseña" title="Mostrar contraseña">
              &#128065;
            </button>
          </div>
        </div>
        <div class="grupoFormulario">
          <label for="cambiarPasswordNueva">Nueva contraseña</label>
          <div class="passwordInputWrap">
            <input id="cambiarPasswordNueva" class="passwordInputField" type="password" name="password_nueva" placeholder="Nueva contraseña" required>
            <button type="button" class="passwordToggleBtn" data-password-toggle="password_nueva" aria-label="Mostrar contraseña" title="Mostrar contraseña">
              &#128065;
            </button>
          </div>
        </div>
        <div class="grupoFormulario">
          <label for="cambiarPasswordNueva2">Repite nueva contraseña</label>
          <div class="passwordInputWrap">
            <input id="cambiarPasswordNueva2" class="passwordInputField" type="password" name="password_nueva2" placeholder="Repite nueva contraseña" required>
            <button type="button" class="passwordToggleBtn" data-password-toggle="password_nueva2" aria-label="Mostrar contraseña" title="Mostrar contraseña">
              &#128065;
            </button>
          </div>
        </div>
        <button type="submit" class="boton botonCambioPassword">Guardar</button>
      </form>
      <div id="cambiarPasswordError" class="errorCambioPassword"></div>
    </div>
  `;
  document.body.appendChild(modal);

  Array.from(modal.querySelectorAll('[data-password-toggle]')).forEach((btn) => {
    btn.addEventListener('click', () => {
      const inputName = btn.getAttribute('data-password-toggle');
      if (!inputName) return;
      const input = modal.querySelector(`input[name="${inputName}"]`);
      if (!input) return;

      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
      btn.setAttribute('title', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });

  document.getElementById('formCambiarPassword').onsubmit = async function(e) {
    e.preventDefault();
    const password_actual = this.password_actual.value;
    const password_nueva = this.password_nueva.value;
    const password_nueva2 = this.password_nueva2.value;
    const errorDiv = document.getElementById('cambiarPasswordError');
    errorDiv.style.display = 'none';
    if (password_nueva !== password_nueva2) {
      errorDiv.textContent = 'Las contraseñas no coinciden';
      errorDiv.style.display = 'block';
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/cambiar-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ username, password_actual, password_nueva })
      });
      const data = await res.json();
      if (!data.exito) throw new Error(data.mensaje);
      mostrarNotificacion('Contraseña cambiada.', 'exito');
      document.getElementById('modalCambiarPassword').remove();
      window.dispatchEvent(new CustomEvent('chipactli:password-actualizada', { detail: { username } }));
    } catch (err) {
      errorDiv.textContent = err.message;
      errorDiv.style.display = 'block';
    }
  };
}
