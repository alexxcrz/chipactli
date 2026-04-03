import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { normalizarPermisosUsuario } from "../../utils/permisos/index.js";
import { dbGet, dbRun } from "../../utils/db-adapter/index.js";
import { resolveJwtSecret } from "../../utils/security-secrets/index.js";
import { createLoginAttemptManager } from "../../utils/login-protection/index.js";
import { validarPasswordSegura } from "../../utils/password-policy/index.js";

const AUTH_JWT_SECRET = resolveJwtSecret();
const AUTH_LOGIN_MAX_ATTEMPTS = Math.max(3, Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS || 5));
const AUTH_LOGIN_WINDOW_MS = Math.max(60_000, Number(process.env.AUTH_LOGIN_WINDOW_MS || (15 * 60 * 1000)));
const AUTH_LOGIN_LOCK_MS = Math.max(60_000, Number(process.env.AUTH_LOGIN_LOCK_MS || (15 * 60 * 1000)));
const ADMIN_AUTH_COOKIE = 'chipactli_admin_session';
const ADMIN_AUTH_COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const authLoginProtection = createLoginAttemptManager({
  scope: 'admin-auth',
  maxAttempts: AUTH_LOGIN_MAX_ATTEMPTS,
  windowMs: AUTH_LOGIN_WINDOW_MS,
  lockMs: AUTH_LOGIN_LOCK_MS
});

function crearTokenSesionAdmin(user = {}) {
  return jwt.sign(
    {
      tipo: 'admin_auth',
      id: Number(user?.id) || 0,
      token_version: Number(user?.token_version || 0)
    },
    AUTH_JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function crearTokenConfiguracionInicial(user = {}) {
  return jwt.sign(
    {
      tipo: 'configuracion_inicial',
      id: Number(user?.id) || 0
    },
    AUTH_JWT_SECRET,
    { expiresIn: '20m' }
  );
}

let authMailTransporter = null;

function textoSeguro(valor, max = 160) {
  return String(valor || '').trim().slice(0, max);
}

function usernameSeguro(valor) {
  return /^[a-z0-9._-]{3,40}$/i.test(String(valor || '').trim());
}

function obtenerIpSolicitud(req) {
  const forwarded = String(req.get('x-forwarded-for') || '').split(',')[0].trim();
  return forwarded || String(req.ip || req.socket?.remoteAddress || '').trim();
}

function responderBloqueoLogin(res, retryAfterSec) {
  if (retryAfterSec > 0) {
    res.set('Retry-After', String(retryAfterSec));
  }
  return res.status(429).json({
    exito: false,
    mensaje: 'Demasiados intentos fallidos. Espera unos minutos e intenta nuevamente.',
    retry_after_sec: retryAfterSec
  });
}

function aplicarNoStorePrivado(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

function parsearCookies(req) {
  const raw = String(req.get('cookie') || '').trim();
  if (!raw) return {};

  return raw.split(';').reduce((acc, item) => {
    const [claveRaw, ...resto] = String(item || '').split('=');
    const clave = String(claveRaw || '').trim();
    if (!clave) return acc;
    const valor = resto.join('=').trim();
    try {
      acc[clave] = decodeURIComponent(valor);
    } catch {
      acc[clave] = valor;
    }
    return acc;
  }, {});
}

function opcionesCookieAuth() {
  const secure = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/'
  };
}

function obtenerTokenSesionAdmin(req) {
  const auth = String(req.get('Authorization') || '').trim();
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }

  const cookies = parsearCookies(req);
  return String(cookies?.[ADMIN_AUTH_COOKIE] || '').trim();
}

function establecerCookieSesionAdmin(res, token) {
  res.cookie(ADMIN_AUTH_COOKIE, String(token || ''), {
    ...opcionesCookieAuth(),
    maxAge: ADMIN_AUTH_COOKIE_MAX_AGE_MS
  });
}

function limpiarCookieSesionAdmin(res) {
  res.clearCookie(ADMIN_AUTH_COOKIE, opcionesCookieAuth());
}

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

function respuestaRecuperacionGenerica() {
  return {
    exito: true,
    mensaje: 'Si la cuenta existe y el correo está habilitado, te enviaremos una contraseña temporal. Revisa tu bandeja y spam.'
  };
}

export function registrarRutasAuth(app, bdAdmin) {
  app.get('/api/auth/validar', async (req, res) => {
    aplicarNoStorePrivado(res);
    const token = obtenerTokenSesionAdmin(req);
    if (!token) {
      return res.status(401).json({ exito: false, mensaje: 'No autenticado' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, AUTH_JWT_SECRET);
    } catch {
      limpiarCookieSesionAdmin(res);
      return res.status(401).json({ exito: false, mensaje: 'Token inválido' });
    }

    if (decoded?.tipo !== 'admin_auth' || !decoded?.id) {
      limpiarCookieSesionAdmin(res);
      return res.status(401).json({ exito: false, mensaje: 'Token inválido' });
    }

    try {
      const user = await dbGet(bdAdmin, 'SELECT id, username, nombre, rol, permisos, debe_cambiar_password, COALESCE(token_version, 0) AS token_version FROM usuarios WHERE id = ?', [decoded?.id]);
      if (!user) {
        limpiarCookieSesionAdmin(res);
        return res.status(401).json({ exito: false, mensaje: 'Usuario no encontrado' });
      }

      if (Number(decoded?.token_version || 0) !== Number(user?.token_version || 0)) {
        limpiarCookieSesionAdmin(res);
        return res.status(401).json({ exito: false, mensaje: 'Sesión expirada. Inicia sesión nuevamente.' });
      }

      const permisos = normalizarPermisosUsuario(user.permisos, user.rol);
      return res.json({
        exito: true,
        usuario: {
          id: user.id,
          username: user.username,
          nombre: user.nombre,
          rol: user.rol,
          permisos,
          debe_cambiar_password: !!user.debe_cambiar_password
        }
      });
    } catch {
      return res.status(500).json({ exito: false, mensaje: 'No se pudo validar la sesión' });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    aplicarNoStorePrivado(res);
    const username = textoSeguro(req.body?.username, 60).toLowerCase();
    const password = String(req.body?.password || '').slice(0, 160);
    const clientIp = obtenerIpSolicitud(req);

    if (!username || !password) {
      return res.status(400).json({ exito: false, mensaje: "Usuario y contraseña son obligatorios" });
    }
    if (!usernameSeguro(username)) {
      return res.status(400).json({ exito: false, mensaje: "El formato de usuario no es válido" });
    }

    const bloqueoActual = authLoginProtection.getStatus({ identifier: username, ip: clientIp });
    if (bloqueoActual.blocked) {
      return responderBloqueoLogin(res, bloqueoActual.retryAfterSec);
    }

    try {
      const user = await dbGet(bdAdmin, "SELECT * FROM usuarios WHERE username = ?", [username]);
      if (!user) {
        const bloqueo = authLoginProtection.registerFailure({ identifier: username, ip: clientIp });
        if (bloqueo.blocked) {
          return responderBloqueoLogin(res, bloqueo.retryAfterSec);
        }
        return res.status(401).json({ exito: false, mensaje: "Usuario o contraseña incorrectos" });
      }

      const match = await bcrypt.compare(String(password || ""), String(user.password_hash || ""));
      if (!match) {
        const bloqueo = authLoginProtection.registerFailure({ identifier: username, ip: clientIp });
        if (bloqueo.blocked) {
          return responderBloqueoLogin(res, bloqueo.retryAfterSec);
        }
        return res.status(401).json({ exito: false, mensaje: "Usuario o contraseña incorrectos" });
      }

      authLoginProtection.reset({ identifier: username, ip: clientIp });

      if (user.rol === "maestro") {
        const rowCount = await dbGet(bdAdmin, "SELECT COUNT(*) AS total FROM usuarios WHERE rol IN ('ceo','admin')");
        if (Number(rowCount?.total || 0) > 0) {
          return res.status(401).json({ exito: false, mensaje: "El usuario maestro ya no esta disponible" });
        }

        const tokenConfiguracion = crearTokenConfiguracionInicial(user);

        return res.json({
          exito: true,
          requiere_configuracion_inicial: true,
          token_configuracion: tokenConfiguracion,
          usuario_maestro: user.username,
          mensaje: "Configura los usuarios CEO y administrador para continuar"
        });
      }

      const permisos = normalizarPermisosUsuario(user.permisos, user.rol);
      const token = crearTokenSesionAdmin(user);
      establecerCookieSesionAdmin(res, token);

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

  app.post('/api/auth/logout', (_req, res) => {
    aplicarNoStorePrivado(res);
    limpiarCookieSesionAdmin(res);
    return res.json({ exito: true });
  });

  app.post("/api/auth/configuracion-inicial", async (req, res) => {
    aplicarNoStorePrivado(res);
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
      decoded = jwt.verify(token_configuracion, AUTH_JWT_SECRET);
    } catch {
      return res.status(401).json({ exito: false, mensaje: "Token de configuracion invalido o expirado" });
    }

    if (decoded?.tipo !== "configuracion_inicial" || !decoded?.id) {
      return res.status(401).json({ exito: false, mensaje: "Token de configuracion invalido" });
    }

    const ceoUsername = textoSeguro(ceo_username, 60).toLowerCase();
    const adminUsername = textoSeguro(admin_username, 60).toLowerCase();
    const ceoNombre = String(ceo_nombre || "").trim() || "CEO";
    const adminNombre = String(admin_nombre || "").trim() || "Administrador";
    const ceoPassword = String(ceo_password || "");
    const adminPassword = String(admin_password || "");
    const crearAdmin = Boolean(adminUsername || adminPassword || String(admin_nombre || "").trim());

    if (!ceoUsername || !ceoPassword) {
      return res.status(400).json({ exito: false, mensaje: "Completa usuario y contrasena del CEO" });
    }
    if (!usernameSeguro(ceoUsername) || (crearAdmin && !usernameSeguro(adminUsername))) {
      return res.status(400).json({ exito: false, mensaje: "Usa solo letras, números, punto, guion o guion bajo en los usuarios" });
    }
    if (crearAdmin && (!adminUsername || !adminPassword)) {
      return res.status(400).json({ exito: false, mensaje: "Si capturas administrador, completa usuario y contrasena" });
    }
    if (crearAdmin && ceoUsername === adminUsername) {
      return res.status(400).json({ exito: false, mensaje: "CEO y administrador deben tener usuarios distintos" });
    }
    const validacionCeo = validarPasswordSegura(ceoPassword);
    const validacionAdmin = crearAdmin ? validarPasswordSegura(adminPassword) : { ok: true, mensaje: '' };
    if (!validacionCeo.ok) {
      return res.status(400).json({ exito: false, mensaje: validacionCeo.mensaje });
    }
    if (!validacionAdmin.ok) {
      return res.status(400).json({ exito: false, mensaje: validacionAdmin.mensaje });
    }

    try {
      const maestros = await dbGet(
        bdAdmin,
        "SELECT id, username FROM usuarios WHERE id = ? AND rol = 'maestro'",
        [decoded.id]
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
        "DELETE FROM usuarios WHERE id = ? AND rol = 'maestro'",
        [decoded.id]
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
    aplicarNoStorePrivado(res);
    const email = textoSeguro(req.body?.email, 160).toLowerCase();
    if (!email) {
      return res.status(400).json({ exito: false, mensaje: "Debes capturar tu correo" });
    }

    if (!correoConfigurado()) {
      return res.status(503).json({ exito: false, mensaje: "El servicio de correo no está configurado" });
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
        return res.json(respuestaRecuperacionGenerica());
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
        ...respuestaRecuperacionGenerica()
      });
    } catch {
      return res.status(500).json({ exito: false, mensaje: "No se pudo procesar la recuperación" });
    }
  });

  // Cambiar contraseña (requiere login)
  app.post("/api/auth/cambiar-password", async (req, res) => {
    aplicarNoStorePrivado(res);
    const username = textoSeguro(req.body?.username, 60).toLowerCase();
    const password_actual = String(req.body?.password_actual || '').slice(0, 160);
    const password_nueva = String(req.body?.password_nueva || '').slice(0, 160);

    if (!usernameSeguro(username)) {
      return res.status(400).json({ exito: false, mensaje: "El formato de usuario no es válido" });
    }
    const validacionPassword = validarPasswordSegura(password_nueva);
    if (!password_actual || !password_nueva || !validacionPassword.ok) {
      return res.status(400).json({ exito: false, mensaje: validacionPassword.ok ? "La nueva contraseña es obligatoria" : validacionPassword.mensaje });
    }

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
      const tokenVersionNuevo = Number(user?.token_version || 0) + 1;
      await dbRun(
        bdAdmin,
        "UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 0, token_version = ?, actualizado_en = CURRENT_TIMESTAMP WHERE username = ?",
        [hash, tokenVersionNuevo, username]
      );

      const tokenRefrescado = crearTokenSesionAdmin({
        id: user.id,
        token_version: tokenVersionNuevo
      });
      establecerCookieSesionAdmin(res, tokenRefrescado);

      return res.json({ exito: true, token: tokenRefrescado });
    } catch {
      return res.status(500).json({ exito: false, mensaje: "Error al actualizar contraseña" });
    }
  });

  // Middleware para proteger rutas
  app.use("/api/privado", (req, res, next) => {
    aplicarNoStorePrivado(res);
    const token = obtenerTokenSesionAdmin(req);
    if (!token) {
      return res.status(401).json({ exito: false, mensaje: "No autenticado" });
    }
    try {
      const decoded = jwt.verify(token, AUTH_JWT_SECRET);
      if (decoded?.tipo !== 'admin_auth' || !decoded?.id) {
        limpiarCookieSesionAdmin(res);
        return res.status(401).json({ exito: false, mensaje: "Token inválido" });
      }
      req.usuario = decoded;
      next();
    } catch (err) {
      limpiarCookieSesionAdmin(res);
      return res.status(401).json({ exito: false, mensaje: "Token inválido" });
    }
  });
}
