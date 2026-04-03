import React, { useEffect, useRef, useState } from 'react';

const TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();

export function turnstileFrontendActivo() {
  return Boolean(TURNSTILE_SITE_KEY);
}

export default function TurnstileWidget({
  action = 'submit',
  onVerify,
  onExpire,
  onError,
  theme = 'light',
  size = 'normal'
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  const [estadoWidget, setEstadoWidget] = useState('idle');
  const [intentoRender, setIntentoRender] = useState(0);

  useEffect(() => {
    onVerifyRef.current = onVerify;
  }, [onVerify]);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !containerRef.current || typeof window === 'undefined') return undefined;

    let cancelled = false;
    setEstadoWidget('idle');

    function renderizar() {
      if (cancelled || !containerRef.current || !window.turnstile?.render) return;
      containerRef.current.innerHTML = '';
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        action,
        theme,
        size,
        retry: 'never',
        'refresh-expired': 'manual',
        'refresh-timeout': 'manual',
        callback: (token) => {
          setEstadoWidget('verified');
          if (typeof onVerifyRef.current === 'function') onVerifyRef.current(String(token || ''));
        },
        'expired-callback': () => {
          setEstadoWidget('expired');
          if (typeof onExpireRef.current === 'function') onExpireRef.current();
        },
        'error-callback': () => {
          setEstadoWidget('error');
          if (typeof onErrorRef.current === 'function') onErrorRef.current();
        },
        'unsupported-callback': () => {
          setEstadoWidget('error');
          if (typeof onErrorRef.current === 'function') onErrorRef.current();
        }
      });
    }

    if (window.turnstile?.render) {
      renderizar();
      return () => {
        cancelled = true;
        if (widgetIdRef.current !== null && window.turnstile?.remove) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }

    const timerId = window.setInterval(() => {
      if (window.turnstile?.render) {
        window.clearInterval(timerId);
        renderizar();
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
      if (widgetIdRef.current !== null && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, size, theme, intentoRender]);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <div>
      <div ref={containerRef} className="turnstileWidgetSlot" />
      {(estadoWidget === 'error' || estadoWidget === 'expired') && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#7a2f2f' }}>
            {estadoWidget === 'expired'
              ? 'La verificación expiró. Intenta nuevamente.'
              : 'La verificación no se pudo completar. Intenta nuevamente.'}
          </span>
          <button
            type="button"
            className="botonPequeno"
            onClick={() => {
              setEstadoWidget('idle');
              setIntentoRender((prev) => prev + 1);
            }}
          >
            Reintentar verificación
          </button>
        </div>
      )}
    </div>
  );
}