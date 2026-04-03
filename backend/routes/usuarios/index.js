import bcrypt from "bcrypt";
import crypto from "crypto";
import { normalizarPermisosUsuario, serializarPermisos } from "../../utils/permisos/index.js";
import { dbAll, dbGet, dbRun } from "../../utils/db-adapter/index.js";
import { registrarAuditoriaAdmin, listarAuditoriaAdmin } from "../../utils/admin-audit/index.js";
import { validarPasswordSegura } from "../../utils/password-policy/index.js";

function usernameSeguro(valor) {
  return /^[a-z0-9._-]{3,40}$/i.test(String(valor || '').trim());
}

function textoSeguro(valor, max = 120) {
  return String(valor || '').trim().slice(0, max);
}

function correoSeguro(valor) {
  return String(valor || '').trim().toLowerCase().slice(0, 160);
}

function passwordTemporalSegura() {
  return `${crypto.randomBytes(9).toString('base64url')}A7`;
}

export function registrarRutasUsuarios(app, bdAdmin) {
  app.get("/api/privado/usuarios/auditoria", async (req, res) => {
    if (!req.usuario) {
      return res.status(403).json({ exito: false, mensaje: "No autorizado" });
    }

    try {
      const eventos = await listarAuditoriaAdmin(bdAdmin, Number(req.query?.limit) || 80);
      return res.json({ exito: true, eventos, total: eventos.length });
    } catch {
      return res.status(500).json({ exito: false, mensaje: "No se pudo cargar la auditoría" });
    }
  });

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
    const usernameNormalizado = textoSeguro(username, 60).toLowerCase();
    if (!usernameSeguro(usernameNormalizado)) {
      return res.status(400).json({ exito: false, mensaje: "El username no es válido" });
    }
    const correoNormalizado = correoSeguro(correo);
    const passwordTemporal = passwordTemporalSegura();
    const hash = await bcrypt.hash(passwordTemporal, 10);
    try {
      const resultado = await dbRun(
        bdAdmin,
        "INSERT INTO usuarios (username, password_hash, nombre, correo, rol, permisos, debe_cambiar_password) VALUES (?, ?, ?, ?, ?, ?, 1)",
        [usernameNormalizado, hash, textoSeguro(nombre, 120), correoNormalizado, rol, serializarPermisos(permisos, rol)]
      );

      let idCreado = resultado?.lastID ?? null;
      if (idCreado == null) {
        const creado = await dbGet(bdAdmin, "SELECT id FROM usuarios WHERE username = ?", [usernameNormalizado]);
        idCreado = creado?.id ?? null;
      }

      await registrarAuditoriaAdmin(bdAdmin, 'usuario_creado', {
        objetivo: usernameNormalizado,
        rol,
        correo: correoNormalizado,
        id: idCreado
      }, req.usuario?.username || req.usuario?.id || '');

      return res.json({ exito: true, id: idCreado, username: usernameNormalizado, correo: correoNormalizado, passwordTemporal, permisos: normalizarPermisosUsuario(permisos, rol) });
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

      const usernameSolicitado = textoSeguro(usernameNuevo, 60).toLowerCase();
      const usernameFinal = user.rol === 'ceo'
        ? usernameActual
        : (usernameSolicitado || usernameActual || '').trim();
      const nombreFinal = user.rol === 'ceo'
        ? (user.nombre || '')
        : (typeof nombre === 'string' ? textoSeguro(nombre, 120) : (user.nombre || ''));
      const correoFinal = typeof correo === 'string' ? correoSeguro(correo) : (user.correo || '');

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
      if (!usernameSeguro(usernameFinal)) {
        return res.status(400).json({ exito: false, mensaje: "El username no es válido" });
      }

      const forzarRotacion = usernameFinal !== usernameActual;

      const resultado = await dbRun(
        bdAdmin,
        "UPDATE usuarios SET username = ?, nombre = ?, correo = ?, token_version = CASE WHEN ? = 1 THEN COALESCE(token_version, 0) + 1 ELSE COALESCE(token_version, 0) END, actualizado_en = CURRENT_TIMESTAMP WHERE username = ?",
        [usernameFinal, nombreFinal, correoFinal, forzarRotacion ? 1 : 0, usernameActual]
      );

      if (!Number(resultado?.changes || 0)) {
        return res.status(404).json({ exito: false, mensaje: "Usuario no encontrado" });
      }

      await registrarAuditoriaAdmin(bdAdmin, 'usuario_actualizado', {
        objetivo_anterior: usernameActual,
        objetivo_nuevo: usernameFinal,
        cambio_username: forzarRotacion ? 'si' : 'no',
        cambio_correo: correoFinal !== String(user.correo || '') ? 'si' : 'no',
        cambio_nombre: nombreFinal !== String(user.nombre || '') ? 'si' : 'no'
      }, req.usuario?.username || req.usuario?.id || '');

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
        "UPDATE usuarios SET permisos = ?, token_version = COALESCE(token_version, 0) + 1, actualizado_en = CURRENT_TIMESTAMP WHERE username = ?",
        [permisosSerializados, username]
      );

      if (!Number(resultado?.changes || 0)) {
        return res.status(500).json({ exito: false, mensaje: "No se pudieron actualizar permisos" });
      }

      await registrarAuditoriaAdmin(bdAdmin, 'usuario_permisos_actualizados', {
        objetivo: username,
        rol: user.rol
      }, req.usuario?.username || req.usuario?.id || '');

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
      : passwordTemporalSegura();

    const validacionPassword = validarPasswordSegura(passwordTemporal);
    if (!validacionPassword.ok) {
      return res.status(400).json({ exito: false, mensaje: validacionPassword.mensaje });
    }

    const hash = await bcrypt.hash(passwordTemporal, 10);
    try {
      const resultado = await dbRun(
        bdAdmin,
        "UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 1, token_version = COALESCE(token_version, 0) + 1, actualizado_en = CURRENT_TIMESTAMP WHERE username = ?",
        [hash, username]
      );
      if (!Number(resultado?.changes || 0)) return res.status(400).json({ exito: false, mensaje: "Usuario no encontrado" });

      await registrarAuditoriaAdmin(bdAdmin, 'usuario_password_reseteado', {
        objetivo: username,
        requiere_cambio_password: 'si'
      }, req.usuario?.username || req.usuario?.id || '');

      return res.json({ exito: true, username, passwordTemporal });
    } catch {
      return res.status(400).json({ exito: false, mensaje: "Usuario no encontrado" });
    }
  });

  app.post("/api/privado/usuarios/revocar-sesiones", async (req, res) => {
    if (!req.usuario) {
      return res.status(403).json({ exito: false, mensaje: "No autorizado" });
    }

    const username = textoSeguro(req.body?.username, 60).toLowerCase();
    if (!username) {
      return res.status(400).json({ exito: false, mensaje: "Falta username" });
    }

    try {
      const objetivo = await dbGet(
        bdAdmin,
        "SELECT username, rol, COALESCE(token_version, 0) AS token_version FROM usuarios WHERE username = ?",
        [username]
      );

      if (!objetivo) {
        return res.status(404).json({ exito: false, mensaje: "Usuario no encontrado" });
      }

      const resultado = await dbRun(
        bdAdmin,
        "UPDATE usuarios SET token_version = COALESCE(token_version, 0) + 1, actualizado_en = CURRENT_TIMESTAMP WHERE username = ?",
        [username]
      );

      if (!Number(resultado?.changes || 0)) {
        return res.status(500).json({ exito: false, mensaje: "No se pudieron revocar las sesiones" });
      }

      await registrarAuditoriaAdmin(bdAdmin, 'usuario_sesiones_revocadas', {
        objetivo: username,
        rol: objetivo.rol,
        token_version_anterior: Number(objetivo.token_version || 0),
        token_version_nueva: Number(objetivo.token_version || 0) + 1
      }, req.usuario?.username || req.usuario?.id || '');

      return res.json({ exito: true, username, sesionesRevocadas: true });
    } catch {
      return res.status(500).json({ exito: false, mensaje: "No se pudieron revocar las sesiones" });
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
      const objetivo = await dbGet(
        bdAdmin,
        "SELECT username, rol FROM usuarios WHERE username = ?",
        [username]
      );

      const resultado = await dbRun(
        bdAdmin,
        "DELETE FROM usuarios WHERE username = ? AND rol != 'ceo'",
        [username]
      );

      if (!Number(resultado?.changes || 0)) {
        return res.status(400).json({ exito: false, mensaje: "No se puede eliminar CEO o usuario no encontrado" });
      }

      await registrarAuditoriaAdmin(bdAdmin, 'usuario_eliminado', {
        objetivo: username,
        rol: objetivo?.rol || ''
      }, req.usuario?.username || req.usuario?.id || '');

      return res.json({ exito: true, username });
    } catch {
      return res.status(500).json({ exito: false, mensaje: "Error al eliminar usuario" });
    }
  });
}
