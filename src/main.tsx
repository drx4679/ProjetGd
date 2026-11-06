import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Vie privée : purge l'ancienne position GPS client (composant carte supprimé)
try { localStorage.removeItem('gd_delivery_coords') } catch { /* stockage indisponible */ }

// PWA : Enregistrement du Service Worker pour le cache et mode hors-ligne
if ('serviceWorker' in navigator && !window.location.host.includes('localhost:8443')) {
  let retried = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (retried) return
    retried = true
    document.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      if (!img.complete || img.naturalWidth === 0) {
        const src = img.getAttribute('src')
        if (src) {
          img.src = ''
          img.src = src
        }
      }
    })
  })

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
