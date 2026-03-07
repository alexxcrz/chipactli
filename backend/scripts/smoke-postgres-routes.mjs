const BASE_URL = String(process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const USERNAME = String(process.env.SMOKE_USER || "").trim();
const PASSWORD = String(process.env.SMOKE_PASS || "").trim();
const ADMIN_TOKEN = String(process.env.SMOKE_ADMIN_TOKEN || "").trim();

async function fetchJson(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} en ${path}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function run() {
  console.log(`[smoke] Base URL: ${BASE_URL}`);

  if (!USERNAME || !PASSWORD) {
    throw new Error("Faltan SMOKE_USER y SMOKE_PASS para login");
  }

  const login = await fetchJson('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD })
  });

  if (!login?.token) {
    throw new Error('Login exitoso sin token de sesión');
  }

  const authHeaders = {
    'Authorization': `Bearer ${login.token}`,
    'Content-Type': 'application/json'
  };

  const checks = [
    ['/api/privado/usuarios', { headers: authHeaders }],
    ['/inventario', { headers: authHeaders }],
    ['/utensilios', { headers: authHeaders }],
    ['/recetas', { headers: authHeaders }],
    ['/produccion', { headers: authHeaders }],
    ['/ventas', { headers: authHeaders }],
    ['/tienda/catalogo', { headers: authHeaders }]
  ];

  for (const [path, options] of checks) {
    await fetchJson(path, options);
    console.log(`[smoke] OK ${path}`);
  }

  if (ADMIN_TOKEN) {
    const estado = await fetchJson('/api/backup/estado', {
      headers: {
        'x-admin-token': ADMIN_TOKEN
      }
    });
    console.log('[smoke] runtime_db:', JSON.stringify(estado?.runtime_db || {}, null, 2));
  } else {
    console.log('[smoke] SMOKE_ADMIN_TOKEN no definido; se omite verificación de /api/backup/estado');
  }

  console.log('[smoke] Prueba completada');
}

run().catch((error) => {
  console.error('[smoke] ERROR:', error.message);
  process.exit(1);
});
