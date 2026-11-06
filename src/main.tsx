import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Vie privée : purge l'ancienne position GPS client (composant carte supprimé)
try { localStorage.removeItem('gd_delivery_coords') } catch { /* stockage indisponible */ }

// PWA : Enregistrement du Service Worker pour le cache et mode hors-ligne
if ('serviceWorker' in navigator && !window.location.host.includes('localhost:8443')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
