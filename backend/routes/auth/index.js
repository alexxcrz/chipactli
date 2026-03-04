import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { normalizarPermisosUsuario } from "../../utils/permisos/index.js";

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
        const permisos = normalizarPermisosUsuario(user.permisos, user.rol);
        // Generar JWT
        const token = jwt.sign(
          { id: user.id, username: user.username, rol: user.rol, permisos },
          process.env.JWT_SECRET || "chipactli_jwt_secret",
          { expiresIn: "12h" }
        );
        res.json({ exito: true, token, debe_cambiar_password: !!user.debe_cambiar_password, rol: user.rol, nombre: user.nombre, permisos });
      }
    );
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
