
export function crearPantallaLogin() {
  document.body.innerHTML = `
    <div id="login-bg" style="min-height:100vh;width:100vw;display:flex;align-items:center;justify-content:center;background:url('images/fondos.png') center center/cover no-repeat fixed,#e8d7b1;position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;">
      <div id="login-card" style="border-radius:18px;box-shadow:0 8px 32px rgba(0,0,0,0.18);padding:22px 12px;width:320px;max-width:95vw;text-align:center;z-index:2;position:relative;backdrop-filter:blur(10px);background:rgba(255,255,255,0.92);margin:0 auto;border:1.5px solid rgba(200,200,200,0.18);box-sizing:border-box;">
        <img src="images/logo.png" alt="Logo Chipactli" style="width:60px;height:60px;margin-bottom:12px;border-radius:50%;box-shadow:0 2px 8px #4a7c59;object-fit:cover;">
        <h2 style="font-family:'Cinzel',serif;color:#4a7c59;margin-bottom:6px;font-size:1.2em;">Chipactli</h2>
        <div style="color:#8b7355;font-size:0.95em;margin-bottom:12px;">Gestión Botánica y Herbolaria</div>
        <form id="login-form" autocomplete="off">
          <input type="text" name="username" placeholder="Usuario" required autocomplete="username" style="width:100%;padding:8px 8px;margin-bottom:8px;border-radius:7px;border:1.2px solid #bdbdbd;font-size:0.98em;background:rgba(255,255,255,0.18);">
          <input type="password" name="password" placeholder="Contraseña" required autocomplete="current-password" style="width:100%;padding:8px 8px;margin-bottom:12px;border-radius:7px;border:1.2px solid #bdbdbd;font-size:0.98em;background:rgba(255,255,255,0.18);">
          <button type="submit" style="width:100%;background:linear-gradient(90deg,#4a7c59 60%,#8b7355 100%);color:white;font-weight:bold;padding:8px 0;border:none;border-radius:7px;font-size:1em;box-shadow:0 2px 6px #c8e6c9;cursor:pointer;">Entrar</button>
        </form>
        <div id="login-error" style="color:#c75550;margin-top:10px;display:none;font-size:0.95em;"></div>
      </div>
    </div>
    <style>@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&display=swap');</style>
  `;

  document.getElementById('login-form').onsubmit = async function(e) {
    e.preventDefault();
    const username = this.username.value.trim();
    const password = this.password.value;
    const errorDiv = document.getElementById('login-error');
    errorDiv.style.display = 'none';
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!data.exito) throw new Error(data.mensaje || 'Error de autenticación');
      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify({ username, rol: data.rol, nombre: data.nombre }));
      if (data.debe_cambiar_password) {
        import('./modal-cambiar-password.js').then(mod => {
          setTimeout(() => mod.mostrarModalCambiarPassword(username), 200);
        });
      } else {
        window.location.reload();
      }
    } catch (err) {
      // Mostrar error en consola de CMD (Node.js backend)
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message })
      });
      errorDiv.textContent = 'Error de autenticación. Revisa la consola del servidor.';
      errorDiv.style.display = 'block';
    }
  };
}

// Global error handler for all frontend errors
window.addEventListener('error', function(event) {
  fetch('/api/log-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: event.message, source: event.filename, lineno: event.lineno, colno: event.colno })
  });
});
window.addEventListener('unhandledrejection', function(event) {
  fetch('/api/log-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: event.reason && event.reason.message ? event.reason.message : String(event.reason) })
  });
});



