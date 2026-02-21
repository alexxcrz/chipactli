import bcrypt from "bcrypt";

export function registrarRutasUsuarios(app, bdInventario) {
  // Listar usuarios (solo admin/ceo)
  app.get("/api/privado/usuarios", (req, res) => {
    if (!req.usuario || (req.usuario.rol !== 'ceo' && req.usuario.rol !== 'admin')) {
      return res.status(403).json({ exito: false, mensaje: "No autorizado" });
    }
    bdInventario.all("SELECT id, username, nombre, rol, debe_cambiar_password, creado_en, actualizado_en FROM usuarios", (err, rows) => {
      if (err) return res.status(500).json({ exito: false, mensaje: "Error al listar usuarios" });
      res.json({ exito: true, usuarios: rows });
    });
  });

  // Crear usuario
  app.post("/api/privado/usuarios", async (req, res) => {
    if (!req.usuario || (req.usuario.rol !== 'ceo' && req.usuario.rol !== 'admin')) {
      return res.status(403).json({ exito: false, mensaje: "No autorizado" });
    }
    const { username, nombre, rol } = req.body;
    if (!username || !rol) return res.status(400).json({ exito: false, mensaje: "Faltan datos" });
    const passwordTemporal = Math.random().toString(36).slice(-8) + "!";
    const hash = await bcrypt.hash(passwordTemporal, 10);
    bdInventario.run(
      "INSERT INTO usuarios (username, password_hash, nombre, rol, debe_cambiar_password) VALUES (?, ?, ?, ?, 1)",
      [username, hash, nombre || '', rol],
      function(err) {
        if (err) return res.status(400).json({ exito: false, mensaje: "Usuario ya existe" });
        res.json({ exito: true, id: this.lastID, username, passwordTemporal });
      }
    );
  });

  // Resetear contraseña
  app.post("/api/privado/usuarios/reset-password", async (req, res) => {
    if (!req.usuario || (req.usuario.rol !== 'ceo' && req.usuario.rol !== 'admin')) {
      return res.status(403).json({ exito: false, mensaje: "No autorizado" });
    }
    const { username } = req.body;
    if (!username) return res.status(400).json({ exito: false, mensaje: "Falta username" });
    const passwordTemporal = Math.random().toString(36).slice(-8) + "!";
    const hash = await bcrypt.hash(passwordTemporal, 10);
    bdInventario.run(
      "UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 1, actualizado_en = CURRENT_TIMESTAMP WHERE username = ?",
      [hash, username],
      function(err) {
        if (err || this.changes === 0) return res.status(400).json({ exito: false, mensaje: "Usuario no encontrado" });
        res.json({ exito: true, username, passwordTemporal });
      }
    );
  });

  // Eliminar usuario
  app.delete("/api/privado/usuarios/:username", (req, res) => {
    if (!req.usuario || (req.usuario.rol !== 'ceo' && req.usuario.rol !== 'admin')) {
      return res.status(403).json({ exito: false, mensaje: "No autorizado" });
    }
    const { username } = req.params;
    if (!username) return res.status(400).json({ exito: false, mensaje: "Falta username" });
    bdInventario.run(
      "DELETE FROM usuarios WHERE username = ? AND rol != 'ceo'",
      [username],
      function(err) {
        if (err) return res.status(500).json({ exito: false, mensaje: "Error al eliminar usuario" });
        if (this.changes === 0) return res.status(400).json({ exito: false, mensaje: "No se puede eliminar CEO o usuario no encontrado" });
        res.json({ exito: true, username });
      }
    );
  });
}
