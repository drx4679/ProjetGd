import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// ── Monitoring d'erreurs global ──────────────────────────────────────────────
// Capture les erreurs JS non gérées et les rejets de promesses.
// Les erreurs sont journalisées côté client (console) ; en production un service
// comme Sentry peut être branché ici en remplaçant le corps du handler.
if (typeof window !== 'undefined') {
  const MAX_ERRORS = 20
  let errorCount = 0

  window.addEventListener('error', (event) => {
    if (++errorCount > MAX_ERRORS) return
    console.error('[GD Error Monitor]', {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      col: event.colno,
      timestamp: new Date().toISOString(),
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    if (++errorCount > MAX_ERRORS) return
    console.error('[GD Error Monitor] Unhandled Promise:', {
      reason: event.reason?.message || String(event.reason),
      timestamp: new Date().toISOString(),
    })
  })
}

// Vie privée : purge l'ancienne position GPS client (composant carte supprimé)
try { localStorage.removeItem('gd_delivery_coords') } catch { /* stockage indisponible */ }

// PWA : Enregistrement du Service Worker pour le cache et mode hors-ligne
if ('serviceWorker' in navigator && !window.location.host.includes('localhost:8443')) {
  navigator.serviceWorker
    .register('/sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      reg.update().catch(() => {})
    })
    .catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
