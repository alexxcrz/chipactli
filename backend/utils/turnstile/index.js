const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function textoSeguroTurnstile(valor = '', max = 2048) {
  return String(valor || '').trim().slice(0, max);
}

export function turnstilePublicoConfigurado() {
  return Boolean(textoSeguroTurnstile(process.env.TURNSTILE_SECRET_KEY, 512));
}

export async function verificarTurnstile({ token = '', ip = '', action = '' } = {}) {
  const secret = textoSeguroTurnstile(process.env.TURNSTILE_SECRET_KEY, 512);
  if (!secret) {
    return { ok: true, skipped: true, action: '' };
  }

  const responseToken = textoSeguroTurnstile(token);
  if (!responseToken) {
    return {
      ok: false,
      skipped: false,
      status: 400,
      message: 'Completa la verificación de seguridad para continuar.'
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const payload = new URLSearchParams();
    payload.set('secret', secret);
    payload.set('response', responseToken);
    if (ip) payload.set('remoteip', textoSeguroTurnstile(ip, 120));

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload,
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));
    const success = Boolean(data?.success);
    const actionRecibida = textoSeguroTurnstile(data?.action, 120);
    const errorCodes = Array.isArray(data?.['error-codes'])
      ? data['error-codes'].map((item) => textoSeguroTurnstile(item, 120)).filter(Boolean)
      : [];

    if (!success) {
      return {
        ok: false,
        skipped: false,
        status: 400,
        message: 'No se pudo validar la verificación de seguridad. Intenta nuevamente.',
        errorCodes,
        action: actionRecibida
      };
    }

    if (action && actionRecibida && actionRecibida !== String(action).trim()) {
      return {
        ok: false,
        skipped: false,
        status: 400,
        message: 'La verificación de seguridad no coincide con la acción solicitada.',
        errorCodes,
        action: actionRecibida
      };
    }

    return {
      ok: true,
      skipped: false,
      action: actionRecibida,
      hostname: textoSeguroTurnstile(data?.hostname, 255)
    };
  } catch {
    return {
      ok: false,
      skipped: false,
      status: 502,
      message: 'No se pudo validar la verificación de seguridad en este momento.'
    };
  } finally {
    clearTimeout(timeoutId);
  }
}