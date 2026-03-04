// modal-cambiar-password.js
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
          <label>Contraseña actual</label>
          <input type="password" name="password_actual" placeholder="Contraseña actual" required>
        </div>
        <div class="grupoFormulario">
          <label>Nueva contraseña</label>
          <input type="password" name="password_nueva" placeholder="Nueva contraseña" required>
        </div>
        <div class="grupoFormulario">
          <label>Repite nueva contraseña</label>
          <input type="password" name="password_nueva2" placeholder="Repite nueva contraseña" required>
        </div>
        <button type="submit" class="boton botonCambioPassword">Guardar</button>
      </form>
      <div id="cambiarPasswordError" class="errorCambioPassword"></div>
    </div>
  `;
  document.body.appendChild(modal);
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
      alert('Contraseña cambiada.');
      document.getElementById('modalCambiarPassword').remove();
      window.location.reload();
    } catch (err) {
      errorDiv.textContent = err.message;
      errorDiv.style.display = 'block';
    }
  };
}
