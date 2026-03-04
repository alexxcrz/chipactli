const lower = (value) => String(value || '').toLowerCase();

const checks = [
  { label: 'cwd', value: process.cwd() },
  { label: 'INIT_CWD', value: process.env.INIT_CWD },
  { label: 'npm_config_local_prefix', value: process.env.npm_config_local_prefix }
];

const hasOneDrive = checks.some((entry) => lower(entry.value).includes('\\onedrive\\'));

if (hasOneDrive) {
  console.error('❌ Ejecución bloqueada: detecté una ruta de OneDrive.');
  console.error('   Abre una terminal local y ejecuta el proyecto desde C:\\Users\\alexx\\Desktop\\CHIPACTLI');
  for (const entry of checks) {
    if (!entry.value) continue;
    console.error(`   - ${entry.label}: ${entry.value}`);
  }
  process.exit(1);
}

console.log('✅ Ruta local validada.');
