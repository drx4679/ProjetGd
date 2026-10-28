import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Vie privée : purge l'ancienne position GPS client (composant carte supprimé)
try { localStorage.removeItem('gd_delivery_coords') } catch { /* stockage indisponible */ }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
