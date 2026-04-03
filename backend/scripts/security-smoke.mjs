import process from 'node:process';

const baseUrl = String(process.env.SECURITY_SMOKE_BASE_URL || process.env.APP_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const adminToken = String(process.env.ADMIN_TOKEN || '');

const checks = [
  {
    name: 'health endpoint',
    path: '/api/health',
    method: 'GET',
    expected: [200, 503]
  },
  {
    name: 'import total requiere auth',
    path: '/api/importar/todo',
    method: 'POST',
    body: {},
    expected: [401]
  },
  {
    name: 'export total requiere auth',
    path: '/api/exportar/todo',
    method: 'GET',
    expected: [401]
  },
  {
    name: 'backup listar requiere admin token',
    path: '/api/backup/listar',
    method: 'GET',
    expected: [401]
  },
  {
    name: 'security estado requiere admin token',
    path: '/api/admin/security/estado',
    method: 'GET',
    expected: [401]
  },
  {
    name: 'security logs rechaza token invalido',
    path: '/api/admin/security/logs?limit=5',
    method: 'GET',
    headers: { 'x-admin-token': 'token-invalido-smoke' },
    expected: [401]
  }
];

if (adminToken) {
  checks.push({
    name: 'security estado con admin token',
    path: '/api/admin/security/estado',
    method: 'GET',
    headers: { 'x-admin-token': adminToken },
    expected: [200]
  });
}

async function runCheck(check) {
  const url = `${baseUrl}${check.path}`;
  const response = await fetch(url, {
    method: check.method,
    headers: {
      'Content-Type': 'application/json',
      ...(check.headers || {})
    },
    body: check.body !== undefined ? JSON.stringify(check.body) : undefined
  }).catch((error) => ({ ok: false, status: 0, error }));

  if (response.status === 0) {
    return {
      ok: false,
      message: `${check.name}: sin respuesta (${response.error?.message || 'error de red'})`
    };
  }

  const ok = check.expected.includes(response.status);
  return {
    ok,
    message: `${check.name}: HTTP ${response.status} ${ok ? 'OK' : `esperado ${check.expected.join('/')}`}`
  };
}

const results = [];
for (const check of checks) {
  results.push(await runCheck(check));
}

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.message}`);
}

if (results.some((result) => !result.ok)) {
  process.exitCode = 1;
}
