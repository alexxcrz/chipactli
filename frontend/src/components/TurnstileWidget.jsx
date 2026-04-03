import React, { useEffect, useRef } from 'react';

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

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !containerRef.current || typeof window === 'undefined') return undefined;

    let cancelled = false;

    function renderizar() {
      if (cancelled || !containerRef.current || !window.turnstile?.render) return;
      containerRef.current.innerHTML = '';
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        action,
        theme,
        size,
        callback: (token) => {
          if (typeof onVerify === 'function') onVerify(String(token || ''));
        },
        'expired-callback': () => {
          if (typeof onExpire === 'function') onExpire();
        },
        'error-callback': () => {
          if (typeof onError === 'function') onError();
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
  }, [action, onVerify, onExpire, onError, size, theme]);

  if (!TURNSTILE_SITE_KEY) return null;

  return <div ref={containerRef} className="turnstileWidgetSlot" />;
}