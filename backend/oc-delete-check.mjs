import jwt from "jsonwebtoken";

const API = "http://localhost:3001";
const token = jwt.sign(
  { id: 1, username: "alecruz", rol: "ceo" },
  process.env.JWT_SECRET || "chipactli_jwt_secret",
  { expiresIn: "2h" }
);
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`
};

async function j(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const inv = await j("GET", "/inventario");
if (!inv.ok || !Array.isArray(inv.data) || !inv.data.length) throw new Error("Inventario no disponible para pruebas");
const ins = inv.data[0];

const crearPendiente = await j("POST", "/recetas/ordenes-compra", {
  proveedor: "QA Delete Pending",
  items: [{
    id_inventario: Number(ins.id),
    codigo: ins.codigo,
    nombre: ins.nombre,
    unidad: ins.unidad,
    cantidad_requerida: 0.03,
    precio_unitario: 1.11
  }]
});
if (!crearPendiente.ok) throw new Error(`No se pudo crear orden pendiente: ${JSON.stringify(crearPendiente.data)}`);

const delPendiente = await j("DELETE", `/recetas/ordenes-compra/${crearPendiente.data.id}`);
if (!delPendiente.ok) throw new Error(`No se pudo eliminar orden pendiente: ${JSON.stringify(delPendiente.data)}`);

const crearConSurtido = await j("POST", "/recetas/ordenes-compra", {
  proveedor: "QA Delete Protected",
  items: [{
    id_inventario: Number(ins.id),
    codigo: ins.codigo,
    nombre: ins.nombre,
    unidad: ins.unidad,
    cantidad_requerida: 0.05,
    precio_unitario: 2.22
  }]
});
if (!crearConSurtido.ok) throw new Error(`No se pudo crear orden surtida: ${JSON.stringify(crearConSurtido.data)}`);

const ordenes = await j("GET", "/recetas/ordenes-compra");
if (!ordenes.ok) throw new Error("No se pudieron listar órdenes");
const orden = (ordenes.data || []).find((o) => Number(o.id) === Number(crearConSurtido.data.id));
const item = orden?.items?.[0];
if (!item?.id) throw new Error("No se encontró item para surtir");

const surtir = await j("POST", `/recetas/ordenes-compra/items/${Number(item.id)}/surtir`, {
  cantidad_surtida: 0.01,
  costo_total: 0.99
});
if (!surtir.ok) throw new Error(`No se pudo surtir item: ${JSON.stringify(surtir.data)}`);

const delProtegida = await j("DELETE", `/recetas/ordenes-compra/${crearConSurtido.data.id}`);
if (delProtegida.ok) throw new Error("Se eliminó una orden con surtidos y no debía ocurrir");

console.log(JSON.stringify({
  ok: true,
  pendiente_eliminada: true,
  surtida_protegida: delProtegida.status === 400,
  mensaje_proteccion: delProtegida.data?.error || ""
}, null, 2));