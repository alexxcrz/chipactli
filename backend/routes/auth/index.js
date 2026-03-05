import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { normalizarPermisosUsuario } from "../../utils/permisos/index.js";

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      return resolve(this);
    });
  });
}

export function registrarRutasAuth(app, bdAdmin) {
  // Login
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    bdAdmin.get(
      "SELECT * FROM usuarios WHERE username = ?",
      [username],
      async (err, user) => {
        if (err || !user) {
          return res.status(401).json({ exito: false, mensaje: "Usuario o contraseña incorrectos" });
        }
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
          return res.status(401).json({ exito: false, mensaje: "Usuario o contraseña incorrectos" });
        }
        if (user.rol === "maestro") {
          bdAdmin.get(
            "SELECT COUNT(*) AS total FROM usuarios WHERE rol IN ('ceo','admin')",
            [],
            (countErr, rowCount) => {
              if (countErr) {
                return res.status(500).json({ exito: false, mensaje: "No se pudo validar estado del usuario maestro" });
              }

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
          );
          return;
        }

        const permisos = normalizarPermisosUsuario(user.permisos, user.rol);
        const token = jwt.sign(
          { id: user.id, username: user.username, rol: user.rol, permisos },
          process.env.JWT_SECRET || "chipactli_jwt_secret",
          { expiresIn: "12h" }
        );
        res.json({ exito: true, token, debe_cambiar_password: !!user.debe_cambiar_password, rol: user.rol, nombre: user.nombre, permisos });
      }
    );
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

    if (!ceoUsername || !adminUsername || !ceoPassword || !adminPassword) {
      return res.status(400).json({ exito: false, mensaje: "Completa todos los campos requeridos" });
    }
    if (ceoUsername === adminUsername) {
      return res.status(400).json({ exito: false, mensaje: "CEO y administrador deben tener usuarios distintos" });
    }
    if (ceoPassword.length < 8 || adminPassword.length < 8) {
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
      const adminHash = await bcrypt.hash(adminPassword, 10);

      await dbRun(bdAdmin, "BEGIN TRANSACTION");
      await dbRun(
        bdAdmin,
        `INSERT INTO usuarios (username, password_hash, nombre, rol, permisos, debe_cambiar_password)
         VALUES (?, ?, ?, 'ceo', ?, 0)`,
        [ceoUsername, ceoHash, ceoNombre, JSON.stringify(normalizarPermisosUsuario(null, 'ceo'))]
      );
      await dbRun(
        bdAdmin,
        `INSERT INTO usuarios (username, password_hash, nombre, rol, permisos, debe_cambiar_password)
         VALUES (?, ?, ?, 'admin', ?, 0)`,
        [adminUsername, adminHash, adminNombre, JSON.stringify(normalizarPermisosUsuario(null, 'admin'))]
      );
      await dbRun(
        bdAdmin,
        "DELETE FROM usuarios WHERE username = ? AND rol = 'maestro'",
        [decoded.username]
      );
      await dbRun(bdAdmin, "COMMIT");

      return res.json({
        exito: true,
        mensaje: "Configuracion inicial completada. Usa tu usuario CEO o administrador para iniciar sesion."
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

  // Cambiar contraseña (requiere login)
  app.post("/api/auth/cambiar-password", (req, res) => {
    const { username, password_actual, password_nueva } = req.body;
    bdAdmin.get(
      "SELECT * FROM usuarios WHERE username = ?",
      [username],
      async (err, user) => {
        if (err || !user) {
          return res.status(401).json({ exito: false, mensaje: "Usuario no encontrado" });
        }
        const match = await bcrypt.compare(password_actual, user.password_hash);
        if (!match) {
          return res.status(401).json({ exito: false, mensaje: "Contraseña actual incorrecta" });
        }
        const hash = await bcrypt.hash(password_nueva, 10);
        bdAdmin.run(
          "UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 0, actualizado_en = CURRENT_TIMESTAMP WHERE username = ?",
          [hash, username],
          (err2) => {
            if (err2) return res.status(500).json({ exito: false, mensaje: "Error al actualizar contraseña" });
            res.json({ exito: true });
          }
        );
      }
    );
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
