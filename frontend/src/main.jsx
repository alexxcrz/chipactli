import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './pages/App/App.jsx'

function tokenPareceJwt(token) {
  return String(token || '').trim().split('.').length === 3
}

function decodificarPayloadJWT(token) {
  try {
    const partes = String(token || '').split('.')
    if (partes.length < 2) return null
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

function tokenJWTVigente(token) {
  const payload = decodificarPayloadJWT(token)
  if (!payload || typeof payload !== 'object') return false
  if (!payload.exp) return true
  const ahora = Math.floor(Date.now() / 1000)
  return Number(payload.exp) > ahora
}

if (typeof window !== 'undefined') {
  try {
    const tokenInterno = localStorage.getItem('token') || ''
    if (tokenPareceJwt(tokenInterno) && !tokenJWTVigente(tokenInterno)) {
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
    }
  } catch {
    // Ignorar errores de localStorage.
  }
}

if (typeof window !== 'undefined' && !window.__chipactliFetchAuthPatched) {
  window.__chipactliFetchAuthPatched = true
  const nativeFetch = window.fetch.bind(window)

  window.fetch = (input, init = {}) => {
    try {
      const isRequest = typeof Request !== 'undefined' && input instanceof Request
      const requestUrl = isRequest ? input.url : String(input)
      const isAbsoluteHttp = /^https?:\/\//i.test(requestUrl)
      const isSameOrigin = !isAbsoluteHttp || requestUrl.startsWith(window.location.origin)

      if (!isSameOrigin) return nativeFetch(input, init)

      const baseHeaders = isRequest ? input.headers : (init.headers || {})
      const headers = new Headers(baseHeaders)
      const authActual = String(headers.get('Authorization') || '')
      const tokenActual = authActual.startsWith('Bearer ')
        ? authActual.slice(7).trim()
        : ''
      if (tokenActual && !tokenPareceJwt(tokenActual)) {
        headers.delete('Authorization')
      }

      const token = localStorage.getItem('token')
      if (!headers.has('Authorization') && tokenPareceJwt(token)) {
        headers.set('Authorization', `Bearer ${token}`)
      }

      const credentials = typeof init.credentials === 'undefined'
        ? (isRequest ? input.credentials : 'include')
        : init.credentials

      if (isRequest) {
        const mergedRequest = new Request(input, { ...init, headers, credentials })
        return nativeFetch(mergedRequest)
      }

      return nativeFetch(input, { ...init, headers, credentials })
    } catch {
      return nativeFetch(input, init)
    }
  }
}

const root = createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// In development, clean up any old service worker/caches to avoid stale UI.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((reg) => reg.unregister())))
    .catch(() => {})

  if ('caches' in window) {
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {})
  }
}

// Register service worker only in production
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('SW registered:', reg.scope)
    }).catch(err => console.warn('SW registration failed:', err))
  })
}
