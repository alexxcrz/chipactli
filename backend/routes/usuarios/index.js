import bcrypt from "bcrypt";
import { normalizarPermisosUsuario, serializarPermisos } from "../../utils/permisos/index.js";
import { dbAll, dbGet, dbRun } from "../../utils/db-adapter/index.js";

export function registrarRutasUsuarios(app, bdAdmin) {
  // Listar usuarios (solo admin/ceo)
  app.get("/api/privado/usuarios", async (req, res) => {
    if (!req.usuario) {
      return res.status(403).json({ exito: false, mensaje: "No autorizado" });
    }

    try {
      const rows = await dbAll(bdAdmin, "SELECT id, username, nombre, correo, rol, permisos, debe_cambiar_password, creado_en, actualizado_en FROM usuarios");
      const usuarios = (rows || []).map((u) => ({
        ...u,
        permisos: normalizarPermisosUsuario(u.permisos, u.rol)
      }));
      return res.json({ exito: true, usuarios });
    } catch {
      return res.status(500).json({ exito: false, mensaje: "Error al listar usuarios" });
    }
  });

  // Crear usuario
  app.post("/api/privado/usuarios", async (req, res) => {
    if (!req.usuario) {
      return res.status(403).json({ exito: false, mensaje: "No autorizado" });
    }
    const { username, nombre, correo, rol, permisos } = req.body;
    if (!username || !rol) return res.status(400).json({ exito: false, mensaje: "Faltan datos" });
    const correoNormalizado = String(correo || '').trim().toLowerCase();
    const passwordTemporal = Math.random().toString(36).slice(-8) + "!";
    const hash = await bcrypt.hash(passwordTemporal, 10);
    try {
      const resultado = await dbRun(
        bdAdmin,
        "INSERT INTO usuarios (username, password_hash, nombre, correo, rol, permisos, debe_cambiar_password) VALUES (?, ?, ?, ?, ?, ?, 1)",
        [username, hash, nombre || '', correoNormalizado, rol, serializarPermisos(permisos, rol)]
      );

      let idCreado = resultado?.lastID ?? null;
      if (idCreado == null) {
        const creado = await dbGet(bdAdmin, "SELECT id FROM usuarios WHERE username = ?", [username]);
        idCreado = creado?.id ?? null;
      }

      return res.json({ exito: true, id: idCreado, username, correo: correoNormalizado, passwordTemporal, permisos: normalizarPermisosUsuario(permisos, rol) });
    } catch {
      return res.status(400).json({ exito: false, mensaje: "Usuario ya existe" });
    }
  });

  // Editar datos generales de usuario
  app.patch("/api/privado/usuarios/:username", async (req, res) => {
    if (!req.usuario) {
      return res.status(403).json({ exito: false, mensaje: "No autorizado" });
    }

    const usernameActual = req.params.username;
    const { username: usernameNuevo, nombre, correo } = req.body;

    if (!usernameActual) {
      return res.status(400).json({ exito: false, mensaje: "Username inválido" });
    }

    try {
      const user = await dbGet(
        bdAdmin,
        "SELECT username, nombre, correo, rol, permisos, debe_cambiar_password, creado_en, actualizado_en FROM usuarios WHERE username = ?",
        [usernameActual]
      );

      if (!user) {
        return res.status(404).json({ exito: false, mensaje: "Usuario no encontrado" });
      }

      const usernameSolicitado = (usernameNuevo || '').trim();
      const usernameFinal = user.rol === 'ceo'
        ? usernameActual
        : (usernameSolicitado || usernameActual || '').trim();
      const nombreFinal = user.rol === 'ceo'
        ? (user.nombre || '')
        : (typeof nombre === 'string' ? nombre : (user.nombre || ''));
      const correoFinal = typeof correo === 'string' ? correo.trim().toLowerCase() : (user.correo || '');

      if (
        user.rol === 'ceo'
        && (
          (usernameSolicitado && usernameSolicitado !== usernameActual)
          || (typeof nombre === 'string' && nombre !== (user.nombre || ''))
        )
      ) {
        return res.status(400).json({ exito: false, mensaje: "Para CEO solo se puede editar el correo de recuperación" });
      }

      if (!usernameFinal) {
        return res.status(400).json({ exito: false, mensaje: "El username no puede estar vacío" });
      }

      const resultado = await dbRun(
        bdAdmin,
        "UPDATE usuarios SET username = ?, nombre = ?, correo = ?, actualizado_en = CURRENT_TIMESTAMP WHERE username = ?",
        [usernameFinal, nombreFinal, correoFinal, usernameActual]
      );

      if (!Number(resultado?.changes || 0)) {
        return res.status(404).json({ exito: false, mensaje: "Usuario no encontrado" });
      }

      return res.json({
        exito: true,
        usuario: {
          username: usernameFinal,
          nombre: nombreFinal,
          correo: correoFinal,
          rol: user.rol,
          permisos: normalizarPermisosUsuario(user.permisos, user.rol)
        }
      });
    } catch (error) {
      if (String(error?.message || '').toLowerCase().includes('unique')) {
        return res.status(400).json({ exito: false, mensaje: "El username ya existe" });
      }
      return res.status(500).json({ exito: false, mensaje: "No se pudo actualizar usuario" });
    }
  });

  // Actualizar permisos de usuario
  app.patch("/api/privado/usuarios/:username/permisos", async (req, res) => {
    if (!req.usuario) {
      return res.status(403).json({ exito: false, mensaje: "No autorizado" });
    }

    const { username } = req.params;
    const { permisos } = req.body;
    if (!username || !permisos || typeof permisos !== 'object') {
      return res.status(400).json({ exito: false, mensaje: "Datos de permisos inválidos" });
    }

    try {
      const user = await dbGet(bdAdmin, "SELECT username, rol FROM usuarios WHERE username = ?", [username]);
      if (!user) {
        return res.status(404).json({ exito: false, mensaje: "Usuario no encontrado" });
      }

      if (user.rol === 'ceo') {
        return res.status(400).json({ exito: false, mensaje: "No se pueden modificar permisos de CEO" });
      }

      const permisosSerializados = serializarPermisos(permisos, user.rol);
      const resultado = await dbRun(
        bdAdmin,
        "UPDATE usuarios SET permisos = ?, actualizado_en = CURRENT_TIMESTAMP WHERE username = ?",
        [permisosSerializados, username]
      );

      if (!Number(resultado?.changes || 0)) {
        return res.status(500).json({ exito: false, mensaje: "No se pudieron actualizar permisos" });
      }

      return res.json({
        exito: true,
        username,
        permisos: normalizarPermisosUsuario(permisosSerializados, user.rol)
      });
    } catch {
      return res.status(500).json({ exito: false, mensaje: "No se pudieron actualizar permisos" });
    }
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
    try {
      const resultado = await dbRun(
        bdAdmin,
        "UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 1, actualizado_en = CURRENT_TIMESTAMP WHERE username = ?",
        [hash, username]
      );
      if (!Number(resultado?.changes || 0)) return res.status(400).json({ exito: false, mensaje: "Usuario no encontrado" });
      return res.json({ exito: true, username, passwordTemporal });
    } catch {
      return res.status(400).json({ exito: false, mensaje: "Usuario no encontrado" });
    }
  });

  // Eliminar usuario
  app.delete("/api/privado/usuarios/:username", async (req, res) => {
    if (!req.usuario) {
      return res.status(403).json({ exito: false, mensaje: "No autorizado" });
    }
    const { username } = req.params;
    if (!username) return res.status(400).json({ exito: false, mensaje: "Falta username" });
    try {
      const resultado = await dbRun(
        bdAdmin,
        "DELETE FROM usuarios WHERE username = ? AND rol != 'ceo'",
        [username]
      );

      if (!Number(resultado?.changes || 0)) {
        return res.status(400).json({ exito: false, mensaje: "No se puede eliminar CEO o usuario no encontrado" });
      }
      return res.json({ exito: true, username });
    } catch {
      return res.status(500).json({ exito: false, mensaje: "Error al eliminar usuario" });
    }
  });
}
