// admin-usuarios.js - Panel de administración de usuarios
export function crearPanelAdminUsuarios() {
  const root = document.getElementById('admin-usuarios') || document.body;
  root.innerHTML = `
    <div class="contenidoAdmin">
      <h2>Administración de Usuarios</h2>
      <form id="form-nuevo-usuario" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:18px;">
        <input name="username" placeholder="Usuario" required style="flex:1 1 120px;padding:8px 10px;border-radius:7px;border:1.2px solid #bdbdbd;">
        <input name="nombre" placeholder="Nombre" style="flex:2 1 180px;padding:8px 10px;border-radius:7px;border:1.2px solid #bdbdbd;">
        <select name="rol" required style="flex:1 1 100px;padding:8px 10px;border-radius:7px;border:1.2px solid #bdbdbd;">
          <option value="usuario">Usuario</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" style="background:linear-gradient(90deg,#4a7c59 60%,#8b7355 100%);color:white;font-weight:bold;padding:8px 18px;border:none;border-radius:7px;cursor:pointer;">Agregar</button>
      </form>
      <div id="usuarios-lista"></div>
      <button onclick="window.location.reload()" style="margin-top:18px;background:#eee;color:#4a7c59;border:none;padding:7px 18px;border-radius:7px;cursor:pointer;">Volver</button>
    </div>
    <style>@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&display=swap');</style>
  `;
  cargarUsuarios();
  document.getElementById('form-nuevo-usuario').onsubmit = async function(e) {
    e.preventDefault();
    const username = this.username.value.trim();
    const nombre = this.nombre.value.trim();
    const rol = this.rol.value;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/privado/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ username, nombre, rol })
      });
      const data = await res.json();
      if (!data.exito) throw new Error(data.mensaje);
      alert('Usuario creado. Contraseña temporal: ' + data.passwordTemporal);
      cargarUsuarios();
      this.reset();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };
}

async function cargarUsuarios() {
  const token = localStorage.getItem('token');
  const listaDiv = document.getElementById('usuarios-lista');
  listaDiv.innerHTML = 'Cargando...';
  try {
    const res = await fetch('/api/privado/usuarios', { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    if (!data.exito) throw new Error(data.mensaje);
    listaDiv.innerHTML = '<table style="width:100%;margin-top:10px;border-collapse:collapse;"><thead><tr style="background:#e8f5e9;"><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Acciones</th></tr></thead><tbody>' +
      data.usuarios.map(u => `<tr><td>${u.username}</td><td>${u.nombre||''}</td><td>${u.rol}</td><td>` +
        (u.rol !== 'ceo' ? `<button onclick="resetearUsuario('${u.username}')" style="background:#d4a574;color:#fff;border:none;padding:4px 10px;border-radius:5px;margin-right:6px;">Reset</button><button onclick="eliminarUsuario('${u.username}')" style="background:#c75550;color:#fff;border:none;padding:4px 10px;border-radius:5px;">Eliminar</button>` : '') +
      `</td></tr>`).join('') + '</tbody></table>';
  } catch (err) {
    listaDiv.innerHTML = '<div style="color:#c75550;">' + err.message + '</div>';
  }
}

window.resetearUsuario = async function(username) {
  if (!confirm('¿Resetear contraseña de ' + username + '?')) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch('/api/privado/usuarios/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (!data.exito) throw new Error(data.mensaje);
    alert('Contraseña temporal: ' + data.passwordTemporal);
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

window.eliminarUsuario = async function(username) {
  if (!confirm('¿Eliminar usuario ' + username + '?')) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch('/api/privado/usuarios/' + username, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (!data.exito) throw new Error(data.mensaje);
    alert('Usuario eliminado');
    cargarUsuarios();
  } catch (err) {
    alert('Error: ' + err.message);
  }
};
