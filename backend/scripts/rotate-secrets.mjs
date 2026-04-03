import crypto from 'node:crypto';
import process from 'node:process';

function token(size = 48) {
  return crypto.randomBytes(size).toString('base64url');
}

const payload = {
  JWT_SECRET: token(48),
  TIENDA_JWT_SECRET: token(48),
  ADMIN_TOKEN: token(36)
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

console.log('# Rotacion sugerida de secretos');
for (const [key, value] of Object.entries(payload)) {
  console.log(`${key}=${value}`);
}
console.log('');
console.log('# Aplica primero en Render y luego reinicia el servicio.');
