import bcrypt from "bcrypt";
import { normalizarPermisosUsuario, serializarPermisos } from "../../utils/permisos/index.js";

export function registrarRutasUsuarios(app, bdAdmin) {
  // Listar usuarios (solo admin/ceo)
  app.get("/api/privado/usuarios", (req, res) => {
    if (!req.usuario) {
      return res.status(403).json({ exito: false, mensaje: "No autorizado" });
    }
    bdAdmin.all("SELECT id, username, nombre, rol, permisos, debe_cambiar_password, creado_en, actualizado_en FROM usuarios", (err, rows) => {
      if (err) return res.status(500).json({ exito: false, mensaje: "Error al listar usuarios" });
      const usuarios = (rows || []).map((u) => ({
        ...u,
        permisos: normalizarPermisosUsuario(u.permisos, u.rol)
      }));
      res.json({ exito: true, usuarios });
    });
  });

  // Crear usuario
  app.post("/api/privado/usuarios", async (req, res) => {
    if (!req.usuario) {
      return res.status(403).json({ exito: false, mensaje: "No autorizado" });
    }
    const { username, nombre, rol, permisos } = req.body;
    if (!username || !rol) return res.status(400).json({ exito: false, mensaje: "Faltan datos" });
    const passwordTemporal = Math.random().toString(36).slice(-8) + "!";
    const hash = await bcrypt.hash(passwordTemporal, 10);
    bdAdmin.run(
      "INSERT INTO usuarios (username, password_hash, nombre, rol, permisos, debe_cambiar_password) VALUES (?, ?, ?, ?, ?, 1)",
      [username, hash, nombre || '', rol, serializarPermisos(permisos, rol)],
      function(err) {
        if (err) return res.status(400).json({ exito: false, mensaje: "Usuario ya existe" });
        res.json({ exito: true, id: this.lastID, username, passwordTemporal, permisos: normalizarPermisosUsuario(permisos, rol) });
      }
    );
  });

  // Editar datos generales de usuario
  app.patch("/api/privado/usuarios/:username", (req, res) => {
    if (!req.usuario) {
      return res.status(403).json({ exito: false, mensaje: "No autorizado" });
    }

    const usernameActual = req.params.username;
    const { username: usernameNuevo, nombre } = req.body;

    if (!usernameActual) {
      return res.status(400).json({ exito: false, mensaje: "Username inválido" });
    }

    bdAdmin.get(
      "SELECT username, nombre, rol, permisos, debe_cambiar_password, creado_en, actualizado_en FROM usuarios WHERE username = ?",
      [usernameActual],
      (errGet, user) => {
        if (errGet || !user) {
          return res.status(404).json({ exito: false, mensaje: "Usuario no encontrado" });
        }

        if (user.rol === 'ceo') {
          return res.status(400).json({ exito: false, mensaje: "No se puede modificar el usuario CEO" });
        }

        const usernameFinal = (usernameNuevo || usernameActual || '').trim();
        const nombreFinal = typeof nombre === 'string' ? nombre : (user.nombre || '');

        if (!usernameFinal) {
          return res.status(400).json({ exito: false, mensaje: "El username no puede estar vacío" });
        }

        bdAdmin.run(
          "UPDATE usuarios SET username = ?, nombre = ?, actualizado_en = CURRENT_TIMESTAMP WHERE username = ?",
          [usernameFinal, nombreFinal, usernameActual],
          function(errUpd) {
            if (errUpd) {
              if (String(errUpd.message || '').includes('UNIQUE')) {
                return res.status(400).json({ exito: false, mensaje: "El username ya existe" });
              }
              return res.status(500).json({ exito: false, mensaje: "No se pudo actualizar usuario" });
            }

            if (this.changes === 0) {
              return res.status(404).json({ exito: false, mensaje: "Usuario no encontrado" });
            }

            return res.json({
              exito: true,
              usuario: {
                username: usernameFinal,
                nombre: nombreFinal,
                rol: user.rol,
                permisos: normalizarPermisosUsuario(user.permisos, user.rol)
              }
            });
          }
        );
      }
    );
  });

  // Actualizar permisos de usuario
  app.patch("/api/privado/usuarios/:username/permisos", (req, res) => {
    if (!req.usuario) {
      return res.status(403).json({ exito: false, mensaje: "No autorizado" });
    }

    const { username } = req.params;
    const { permisos } = req.body;
    if (!username || !permisos || typeof permisos !== 'object') {
      return res.status(400).json({ exito: false, mensaje: "Datos de permisos inválidos" });
    }

    bdAdmin.get("SELECT username, rol FROM usuarios WHERE username = ?", [username], (errGet, user) => {
      if (errGet || !user) {
        return res.status(404).json({ exito: false, mensaje: "Usuario no encontrado" });
      }

      if (user.rol === 'ceo') {
        return res.status(400).json({ exito: false, mensaje: "No se pueden modificar permisos de CEO" });
      }

      const permisosSerializados = serializarPermisos(permisos, user.rol);
      bdAdmin.run(
        "UPDATE usuarios SET permisos = ?, actualizado_en = CURRENT_TIMESTAMP WHERE username = ?",
        [permisosSerializados, username],
        function(errUpd) {
          if (errUpd || this.changes === 0) {
            return res.status(500).json({ exito: false, mensaje: "No se pudieron actualizar permisos" });
          }
          return res.json({
            exito: true,
            username,
            permisos: normalizarPermisosUsuario(permisosSerializados, user.rol)
          });
        }
      );
    });
  });

  // Resetear contraseña
  app.post("/api/privado/usuarios/reset-password", async (req, res) => {
    if (!req.usuario) {
      return res.status(403).json({ exito: false, mensaje: "No autorizado" });
    }
    const { username, passwordTemporal: passwordTemporalEntrada } = req.body;
    if (!username) return res.status(400).json({ exito: false, mensaje: "Falta username" });
    const passwordTemporal = (typeof passwordTemporalEntrada === 'string' && passwordTemporalEntrada.trim())
      ? passwordTemporalEntrada.trim()
      : (Math.random().toString(36).slice(-8) + "!");

    if (passwordTemporal.length < 6) {
      return res.status(400).json({ exito: false, mensaje: "La contraseña temporal debe tener al menos 6 caracteres" });
    }

    const hash = await bcrypt.hash(passwordTemporal, 10);
    bdAdmin.run(
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
    if (!req.usuario) {
      return res.status(403).json({ exito: false, mensaje: "No autorizado" });
    }
    const { username } = req.params;
    if (!username) return res.status(400).json({ exito: false, mensaje: "Falta username" });
    bdAdmin.run(
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
