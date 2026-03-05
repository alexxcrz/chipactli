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

const approx = (a, b, eps = 1e-6) => Math.abs(Number(a) - Number(b)) <= eps;

async function jget(path) {
  const res = await fetch(`${API}${path}`, { headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${JSON.stringify(body)}`);
  return body;
}

async function jpost(path, body) {
  const res = await fetch(`${API}${path}`, { method: "POST", headers, body: JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function jpatch(path, body) {
  const res = await fetch(`${API}${path}`, { method: "PATCH", headers, body: JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PATCH ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}

const inv = await jget("/inventario");
if (!Array.isArray(inv) || inv.length < 2) {
  throw new Error("Se requieren al menos 2 insumos en inventario para prueba E2E");
}

const ins1 = inv[0];
const ins2 = inv[1];
const before = new Map(inv.map((i) => [Number(i.id), {
  cantidad_total: Number(i.cantidad_total || 0),
  cantidad_disponible: Number(i.cantidad_disponible || 0),
  costo_total: Number(i.costo_total || 0)
}]));

const h1Before = await jget(`/inventario/${Number(ins1.id)}/historial`);
const h1CountBefore = Array.isArray(h1Before) ? h1Before.length : 0;

const oc1Create = await jpost("/recetas/ordenes-compra", {
  proveedor: "QA Modal E2E",
  items: [{
    id_inventario: Number(ins1.id),
    codigo: ins1.codigo,
    nombre: ins1.nombre,
    unidad: ins1.unidad,
    cantidad_requerida: 0.33,
    precio_unitario: 12.34
  }]
});

if (!String(oc1Create?.numero_orden || "").startsWith("ORCHI")) {
  throw new Error(`Folio OC inválido: ${oc1Create?.numero_orden}`);
}

let ordenes = await jget("/recetas/ordenes-compra");
let oc1 = ordenes.find((o) => Number(o.id) === Number(oc1Create.id));
if (!oc1) throw new Error("No se encontró OC1 recién creada");
const oc1Item = (oc1.items || [])[0];
if (!oc1Item) throw new Error("OC1 sin items");

await jpatch(`/recetas/ordenes-compra/items/${Number(oc1Item.id)}/cantidad`, {
  cantidad_requerida: 0.44,
  precio_unitario: 13.21
});

ordenes = await jget("/recetas/ordenes-compra");
oc1 = ordenes.find((o) => Number(o.id) === Number(oc1Create.id));
const oc1ItemEdit = (oc1?.items || []).find((x) => Number(x.id) === Number(oc1Item.id));
if (!oc1ItemEdit) throw new Error("No se encontró item OC1 tras editar");
if (!approx(Number(oc1ItemEdit.cantidad_requerida), 0.44)) throw new Error("No persistió cantidad editada en OC1");
if (!approx(Number(oc1ItemEdit.precio_unitario), 13.21)) throw new Error("No persistió precio unitario editado en OC1");

await jpost(`/recetas/ordenes-compra/items/${Number(oc1Item.id)}/surtir`, {
  cantidad_surtida: 0.11,
  costo_total: 5.55
});

const invAfterSingle = await jget("/inventario");
const ins1AfterSingle = invAfterSingle.find((i) => Number(i.id) === Number(ins1.id));
if (!ins1AfterSingle) throw new Error("Insumo 1 no encontrado tras surtido individual");

const b1 = before.get(Number(ins1.id));
if (!approx(Number(ins1AfterSingle.cantidad_total), b1.cantidad_total + 0.11)) throw new Error("Cantidad total no actualizó correctamente en surtido individual");
if (!approx(Number(ins1AfterSingle.cantidad_disponible), b1.cantidad_disponible + 0.11)) throw new Error("Cantidad disponible no actualizó correctamente en surtido individual");
if (!approx(Number(ins1AfterSingle.costo_total), b1.costo_total + 5.55)) throw new Error("Costo total no actualizó correctamente en surtido individual");

const h1After = await jget(`/inventario/${Number(ins1.id)}/historial`);
const h1CountAfter = Array.isArray(h1After) ? h1After.length : 0;
if (!(h1CountAfter > h1CountBefore)) throw new Error("No se agregó historial al surtir item individual");

const oc2Create = await jpost("/recetas/ordenes-compra", {
  proveedor: "QA Modal Lote",
  items: [
    {
      id_inventario: Number(ins1.id),
      codigo: ins1.codigo,
      nombre: ins1.nombre,
      unidad: ins1.unidad,
      cantidad_requerida: 0.07,
      precio_unitario: 10
    },
    {
      id_inventario: Number(ins2.id),
      codigo: ins2.codigo,
      nombre: ins2.nombre,
      unidad: ins2.unidad,
      cantidad_requerida: 0.09,
      precio_unitario: 20
    }
  ]
});

ordenes = await jget("/recetas/ordenes-compra");
const oc2 = ordenes.find((o) => Number(o.id) === Number(oc2Create.id));
if (!oc2) throw new Error("No se encontró OC2 recién creada");
if (!Array.isArray(oc2.items) || oc2.items.length < 2) throw new Error("OC2 no tiene 2 items");

for (const it of oc2.items) {
  const faltante = Math.max(0, Number(it.cantidad_requerida || 0) - Number(it.cantidad_surtida || 0));
  await jpost(`/recetas/ordenes-compra/items/${Number(it.id)}/surtir`, {
    cantidad_surtida: faltante,
    costo_total: Number(it.precio_unitario || 0) * faltante
  });
}

const invAfterBatch = await jget("/inventario");
const ins1AfterBatch = invAfterBatch.find((i) => Number(i.id) === Number(ins1.id));
const ins2AfterBatch = invAfterBatch.find((i) => Number(i.id) === Number(ins2.id));
if (!ins1AfterBatch || !ins2AfterBatch) throw new Error("No se encontraron insumos tras surtido por lote");

if (!approx(Number(ins1AfterBatch.cantidad_total), b1.cantidad_total + 0.11 + 0.07)) throw new Error("Insumo 1 no acumuló correctamente en surtido por lote");
if (!approx(Number(ins2AfterBatch.cantidad_total), before.get(Number(ins2.id)).cantidad_total + 0.09)) throw new Error("Insumo 2 no acumuló correctamente en surtido por lote");

const ordenesFinal = await jget("/recetas/ordenes-compra");
const oc2Final = ordenesFinal.find((o) => Number(o.id) === Number(oc2Create.id));
if (!oc2Final) throw new Error("OC2 no encontrada al final");
if (String(oc2Final.estado || "").toLowerCase() !== "surtida") throw new Error("OC2 no quedó en estado surtida");
if ((oc2Final.items || []).some((it) => Number(it.surtido || 0) !== 1)) throw new Error("No todos los items de OC2 quedaron surtidos");

console.log(JSON.stringify({
  ok: true,
  folios: [oc1Create.numero_orden, oc2Create.numero_orden],
  verificaciones: {
    editar_item: true,
    surtir_individual: true,
    historial_individual: true,
    surtir_lote: true,
    cierre_orden: true,
    inventario_sync: true
  }
}, null, 2));