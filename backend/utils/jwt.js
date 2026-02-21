import jwt from "jsonwebtoken";

export function generarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, username: usuario.username, rol: usuario.rol },
    process.env.JWT_SECRET || "chipactli_jwt_secret",
    { expiresIn: "12h" }
  );
}

export function verificarToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET || "chipactli_jwt_secret");
}
