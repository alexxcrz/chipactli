import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { normalizarPermisosUsuario } from "../../utils/permisos/index.js";
import { dbGet, dbRun } from "../../utils/db-adapter/index.js";

let authMailTransporter = null;

function obtenerConfigCorreo() {
  const mailEnabled = String(process.env.MAIL_ENABLED || '1').trim() !== '0';
  const host = String(process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || (port === 465 ? '1' : '0')).trim() !== '0';
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const from = String(process.env.SMTP_FROM || user || '').trim();

  return {
    MAIL_ENABLED: mailEnabled,
    SMTP_HOST: host,
    SMTP_PORT: port,
    SMTP_SECURE: secure,
    SMTP_USER: user,
    SMTP_PASS: pass,
    SMTP_FROM: from
  };
}

function correoConfigurado() {
  const cfg = obtenerConfigCorreo();
  return Boolean(cfg.MAIL_ENABLED && cfg.SMTP_HOST && cfg.SMTP_PORT && cfg.SMTP_USER && cfg.SMTP_PASS && cfg.SMTP_FROM);
}

function obtenerMailTransporter() {
  if (authMailTransporter) return authMailTransporter;
  const cfg = obtenerConfigCorreo();
  authMailTransporter = nodemailer.createTransport({
    host: cfg.SMTP_HOST,
    port: cfg.SMTP_PORT,
    secure: cfg.SMTP_SECURE,
    auth: {
      user: cfg.SMTP_USER,
      pass: cfg.SMTP_PASS
    }
  });
  return authMailTransporter;
}

function generarPasswordTemporal() {
  const base = crypto.randomBytes(7).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
  return `${base}A!`;
}

export function registrarRutasAuth(app, bdAdmin) {
  // Login
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body || {};

    try {
      const user = await dbGet(bdAdmin, "SELECT * FROM usuarios WHERE username = ?", [username]);
      if (!user) {
        return res.status(401).json({ exito: false, mensaje: "Usuario o contraseña incorrectos" });
      }

      const match = await bcrypt.compare(String(password || ""), String(user.password_hash || ""));
      if (!match) {
        return res.status(401).json({ exito: false, mensaje: "Usuario o contraseña incorrectos" });
      }

      if (user.rol === "maestro") {
        const rowCount = await dbGet(bdAdmin, "SELECT COUNT(*) AS total FROM usuarios WHERE rol IN ('ceo','admin')");
        if (Number(rowCount?.total || 0) > 0) {
          return res.status(401).json({ exito: false, mensaje: "El usuario maestro ya no esta disponible" });
        }

        const tokenConfiguracion = jwt.sign(
          { id: user.id, username: user.username, tipo: "configuracion_inicial" },
          process.env.JWT_SECRET || "chipactli_jwt_secret",
          { expiresIn: "20m" }
        );

        return res.json({
          exito: true,
          requiere_configuracion_inicial: true,
          token_configuracion: tokenConfiguracion,
          usuario_maestro: user.username,
          mensaje: "Configura los usuarios CEO y administrador para continuar"
        });
      }

      const permisos = normalizarPermisosUsuario(user.permisos, user.rol);
      const token = jwt.sign(
        { id: user.id, username: user.username, rol: user.rol, permisos },
        process.env.JWT_SECRET || "chipactli_jwt_secret",
        { expiresIn: "12h" }
      );

      return res.json({
        exito: true,
        token,
        debe_cambiar_password: !!user.debe_cambiar_password,
        rol: user.rol,
        nombre: user.nombre,
        permisos
      });
    } catch {
      return res.status(500).json({ exito: false, mensaje: "No se pudo iniciar sesion" });
    }
  });

  app.post("/api/auth/configuracion-inicial", async (req, res) => {
    const {
      token_configuracion,
      ceo_username,
      ceo_nombre,
      ceo_password,
      admin_username,
      admin_nombre,
      admin_password
    } = req.body || {};

    if (!token_configuracion) {
      return res.status(400).json({ exito: false, mensaje: "Falta token de configuracion inicial" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token_configuracion, process.env.JWT_SECRET || "chipactli_jwt_secret");
    } catch {
      return res.status(401).json({ exito: false, mensaje: "Token de configuracion invalido o expirado" });
    }

    if (decoded?.tipo !== "configuracion_inicial" || !decoded?.username) {
      return res.status(401).json({ exito: false, mensaje: "Token de configuracion invalido" });
    }

    const ceoUsername = String(ceo_username || "").trim().toLowerCase();
    const adminUsername = String(admin_username || "").trim().toLowerCase();
    const ceoNombre = String(ceo_nombre || "").trim() || "CEO";
    const adminNombre = String(admin_nombre || "").trim() || "Administrador";
    const ceoPassword = String(ceo_password || "");
    const adminPassword = String(admin_password || "");
    const crearAdmin = Boolean(adminUsername || adminPassword || String(admin_nombre || "").trim());

    if (!ceoUsername || !ceoPassword) {
      return res.status(400).json({ exito: false, mensaje: "Completa usuario y contrasena del CEO" });
    }
    if (crearAdmin && (!adminUsername || !adminPassword)) {
      return res.status(400).json({ exito: false, mensaje: "Si capturas administrador, completa usuario y contrasena" });
    }
    if (crearAdmin && ceoUsername === adminUsername) {
      return res.status(400).json({ exito: false, mensaje: "CEO y administrador deben tener usuarios distintos" });
    }
    if (ceoPassword.length < 8 || (crearAdmin && adminPassword.length < 8)) {
      return res.status(400).json({ exito: false, mensaje: "Las contrasenas deben tener al menos 8 caracteres" });
    }

    try {
      const maestros = await dbGet(
        bdAdmin,
        "SELECT id, username FROM usuarios WHERE username = ? AND rol = 'maestro'",
        [decoded.username]
      );
      if (!maestros) {
        return res.status(401).json({ exito: false, mensaje: "El usuario maestro ya no esta disponible" });
      }

      const existentesPrivilegiados = await dbGet(
        bdAdmin,
        "SELECT COUNT(*) AS total FROM usuarios WHERE rol IN ('ceo','admin')"
      );
      if (Number(existentesPrivilegiados?.total || 0) > 0) {
        return res.status(409).json({ exito: false, mensaje: "La configuracion inicial ya fue completada" });
      }

      const ceoHash = await bcrypt.hash(ceoPassword, 10);
      const adminHash = crearAdmin ? await bcrypt.hash(adminPassword, 10) : null;

      await dbRun(bdAdmin, "BEGIN TRANSACTION");
      await dbRun(
        bdAdmin,
        `INSERT INTO usuarios (username, password_hash, nombre, rol, permisos, debe_cambiar_password)
         VALUES (?, ?, ?, 'ceo', ?, 0)`,
        [ceoUsername, ceoHash, ceoNombre, JSON.stringify(normalizarPermisosUsuario(null, 'ceo'))]
      );
      if (crearAdmin) {
        await dbRun(
          bdAdmin,
          `INSERT INTO usuarios (username, password_hash, nombre, rol, permisos, debe_cambiar_password)
           VALUES (?, ?, ?, 'admin', ?, 0)`,
          [adminUsername, adminHash, adminNombre, JSON.stringify(normalizarPermisosUsuario(null, 'admin'))]
        );
      }
      await dbRun(
        bdAdmin,
        "DELETE FROM usuarios WHERE username = ? AND rol = 'maestro'",
        [decoded.username]
      );
      await dbRun(bdAdmin, "COMMIT");

      return res.json({
        exito: true,
        mensaje: crearAdmin
          ? "Configuracion inicial completada. Usa tu usuario CEO o administrador para iniciar sesion."
          : "Configuracion inicial completada. Usa tu usuario CEO para iniciar sesion."
      });
    } catch (error) {
      try {
        await dbRun(bdAdmin, "ROLLBACK");
      } catch {
        // Ignorar rollback fallido.
      }

      if (String(error?.message || "").toLowerCase().includes("unique")) {
        return res.status(409).json({ exito: false, mensaje: "Uno de los usuarios ya existe" });
      }

      return res.status(500).json({ exito: false, mensaje: "No se pudo completar la configuracion inicial" });
    }
  });

  app.post("/api/auth/olvide-password", async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ exito: false, mensaje: "Debes capturar tu correo" });
    }

    try {
      const user = await dbGet(
        bdAdmin,
        `SELECT id, username, nombre, correo, password_hash, debe_cambiar_password
         FROM usuarios
         WHERE LOWER(COALESCE(correo, '')) = ? OR LOWER(COALESCE(username, '')) = ?
         LIMIT 1`,
        [email, email]
      );

      if (!user) {
        return res.status(404).json({ exito: false, mensaje: "El correo no está registrado" });
      }

      if (!correoConfigurado()) {
        return res.status(503).json({ exito: false, mensaje: "El servicio de correo no está configurado" });
      }

      const passwordTemporal = generarPasswordTemporal();
      const passwordHashTemporal = await bcrypt.hash(passwordTemporal, 10);
      const correoDestino = String(user.correo || email).trim().toLowerCase();
      const nombreUsuario = String(user.nombre || user.username || '').trim() || 'Usuario';

      await dbRun(
        bdAdmin,
        "UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 1, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?",
        [passwordHashTemporal, user.id]
      );

      try {
        const transporter = obtenerMailTransporter();
        const cfg = obtenerConfigCorreo();
        await transporter.sendMail({
          from: cfg.SMTP_FROM,
          to: correoDestino,
          subject: "CHIPACTLI | Recuperación de contraseña",
          text: [
            `Hola ${nombreUsuario},`,
            '',
            'Recibimos una solicitud para restablecer tu contraseña.',
            `Tu contraseña temporal es: ${passwordTemporal}`,
            '',
            'Inicia sesión con esa contraseña y el sistema te pedirá cambiarla de inmediato.',
            '',
            'Si no solicitaste este cambio, ignora este mensaje.'
          ].join('\n')
        });
      } catch (errorCorreo) {
        await dbRun(
          bdAdmin,
          "UPDATE usuarios SET password_hash = ?, debe_cambiar_password = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?",
          [user.password_hash, user.debe_cambiar_password ? 1 : 0, user.id]
        );
        return res.status(500).json({ exito: false, mensaje: "No se pudo enviar el correo de recuperación" });
      }

      return res.json({
        exito: true,
        mensaje: "Te enviamos una contraseña temporal a tu correo. Revisa tu bandeja y spam."
      });
    } catch {
      return res.status(500).json({ exito: false, mensaje: "No se pudo procesar la recuperación" });
    }
  });

  // Cambiar contraseña (requiere login)
  app.post("/api/auth/cambiar-password", async (req, res) => {
    const { username, password_actual, password_nueva } = req.body || {};

    try {
      const user = await dbGet(bdAdmin, "SELECT * FROM usuarios WHERE username = ?", [username]);
      if (!user) {
        return res.status(401).json({ exito: false, mensaje: "Usuario no encontrado" });
      }

      const match = await bcrypt.compare(String(password_actual || ""), String(user.password_hash || ""));
      if (!match) {
        return res.status(401).json({ exito: false, mensaje: "Contraseña actual incorrecta" });
      }

      const hash = await bcrypt.hash(String(password_nueva || ""), 10);
      await dbRun(
        bdAdmin,
        "UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 0, actualizado_en = CURRENT_TIMESTAMP WHERE username = ?",
        [hash, username]
      );

      return res.json({ exito: true });
    } catch {
      return res.status(500).json({ exito: false, mensaje: "Error al actualizar contraseña" });
    }
  });

  // Middleware para proteger rutas
  app.use("/api/privado", (req, res, next) => {
    const auth = req.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ exito: false, mensaje: "No autenticado" });
    }
    const token = auth.replace("Bearer ", "");
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "chipactli_jwt_secret");
      req.usuario = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ exito: false, mensaje: "Token inválido" });
    }
  });
}
