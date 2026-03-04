import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './pages/App/App.jsx'

if (typeof window !== 'undefined' && !window.__chipactliFetchAuthPatched) {
  window.__chipactliFetchAuthPatched = true
  const nativeFetch = window.fetch.bind(window)

  window.fetch = (input, init = {}) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return nativeFetch(input, init)

      const isRequest = typeof Request !== 'undefined' && input instanceof Request
      const requestUrl = isRequest ? input.url : String(input)
      const isAbsoluteHttp = /^https?:\/\//i.test(requestUrl)
      const isSameOrigin = !isAbsoluteHttp || requestUrl.startsWith(window.location.origin)

      if (!isSameOrigin) return nativeFetch(input, init)

      const baseHeaders = isRequest ? input.headers : (init.headers || {})
      const headers = new Headers(baseHeaders)
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`)
      }

      if (isRequest) {
        const mergedRequest = new Request(input, { ...init, headers })
        return nativeFetch(mergedRequest)
      }

      return nativeFetch(input, { ...init, headers })
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
