# GoodDoctor's Shop

Site e-commerce d'uniformes et dispositifs médicaux de luxe avec React 19 + Vite + Tailwind CSS v4.

## Serveur de Développement

Un serveur Vite tourne sur le port `8443`.

- Port par défaut : `8443`
- Hot reload : Les modifications dans `src/` sont rechargées immédiatement

## Structure du Projet

- `src/main.tsx` - Point d'entrée React ; importe `src/index.css` et monte `src/App.tsx`
- `src/App.tsx` - Composant racine de l'application
- `src/Checkout.tsx` - Composant du tunnel de commande et paiement CashPay
- `src/index.css` - Point d'entrée CSS global et import Tailwind CSS v4
- `index.html` - Shell HTML Vite avec métadonnées SEO/OpenGraph et point de montage
- `package.json` - Dépendances et scripts Vite (`dev`, `build`, `preview`)
- `vite.config.ts` - Configuration Vite avec React, Tailwind CSS v4, middleware de sécurité CSP et proxy API local
- `netlify/functions/` - Fonctions serverless Netlify (produits, proxy CashPay, webhooks)
- `supabase/` - Migrations et schéma de base de données PostgreSQL

## Dépendances

- Runtime: React 19 et React DOM 19
- Styling: Tailwind CSS v4 avec le plugin `@tailwindcss/vite`
- Build tooling: Vite 8, TypeScript 5.7, et `@vitejs/plugin-react`

## Sécurité et API

- Pas de clé secrète exposée côté navigateur.
- Toutes les requêtes sensibles passent par les fonctions Edge / Netlify (`/api/products`, `/api/cashpay-proxy`).
- Les charges utiles API sont chiffrées en JWE (RSA-OAEP-256 + A256GCM).
