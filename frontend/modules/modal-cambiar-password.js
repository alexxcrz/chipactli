// modal-cambiar-password.js
export function mostrarModalCambiarPassword(username) {
  if (document.getElementById('modalCambiarPassword')) return;
  const modal = document.createElement('div');
  modal.id = 'modalCambiarPassword';
  modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.32);z-index:3000;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:white;padding:32px 28px;border-radius:18px;box-shadow:0 8px 32px #4a7c59cc;max-width:350px;width:100%;text-align:center;position:relative;">
      <button onclick="document.getElementById('modalCambiarPassword').remove()" style="position:absolute;top:10px;right:10px;background:none;border:none;font-size:1.5em;color:#4a7c59;cursor:pointer;">&times;</button>
      <h3 style="color:#4a7c59;font-family:'Cinzel',serif;margin-bottom:10px;">Cambia tu contraseña</h3>
      <form id="formCambiarPassword">
        <input type="password" name="password_actual" placeholder="Contraseña actual" required style="width:100%;padding:10px 8px;margin-bottom:10px;border-radius:7px;border:1.2px solid #bdbdbd;">
        <input type="password" name="password_nueva" placeholder="Nueva contraseña" required style="width:100%;padding:10px 8px;margin-bottom:10px;border-radius:7px;border:1.2px solid #bdbdbd;">
        <input type="password" name="password_nueva2" placeholder="Repite nueva contraseña" required style="width:100%;padding:10px 8px;margin-bottom:14px;border-radius:7px;border:1.2px solid #bdbdbd;">
        <button type="submit" style="width:100%;background:linear-gradient(90deg,#4a7c59 60%,#8b7355 100%);color:white;font-weight:bold;padding:10px 0;border:none;border-radius:7px;font-size:1.1em;box-shadow:0 2px 8px #c8e6c9;cursor:pointer;">Guardar</button>
      </form>
      <div id="cambiarPasswordError" style="color:#c75550;margin-top:10px;display:none;"></div>
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
