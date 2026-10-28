/* ══════════════════════════════════════════════════════════════
   PRODUCTS API — Netlify Edge Function (runtime Deno)
   ──────────────────────────────────────────────────────────────
   ✅ Exécutée au plus près de l'utilisateur (latence minimale, pas de cold start)
   ✅ Aucune clé Supabase dans le bundle client : le navigateur appelle /api/products
   ✅ Moindre privilège : clé ANON côté edge (les RPC publiques n'exigent pas service_role)
   ✅ Rate limiting par IP (60 req/min, par instance edge)
   ✅ Méthode GET uniquement
   ✅ Headers de sécurité (nosniff, DENY framing, CSP restrictive pour du JSON)
   ✅ Cache CDN 2 min + stale-while-revalidate 5 min
   ✅ Aucune dépendance npm (appel REST direct, timeout 8 s)
   ══════════════════════════════════════════════════════════════ */

import type { Config, Context } from "https://edge.netlify.com"

export const config: Config = {
  path: "/api/products",
  method: "GET",
}

const rateMap = new Map<string, { start: number; count: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  // Nettoyage périodique pour éviter la fuite mémoire
  if (rateMap.size > 1000) {
    for (const [k, v] of rateMap) {
      if (now - v.start > 60000) rateMap.delete(k)
    }
  }
  const entry = rateMap.get(ip)
  if (!entry || now - entry.start > 60000) {
    rateMap.set(ip, { start: now, count: 1 })
    return true
  }
  entry.count++
  return entry.count <= 60
}

async function callRpc(url: string, key: string, fn: string): Promise<unknown[]> {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export default async (req: Request, context: Context) => {
  const secHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "0",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  }

  // Seules les requêtes GET sont autorisées (double garde avec config.method)
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...secHeaders, Allow: "GET" },
    })
  }

  // Rate limiting par IP
  if (!checkRateLimit(context.ip || "127.0.0.1")) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { ...secHeaders, "Retry-After": "60" },
    })
  }

  // Variables d'environnement Netlify (Dashboard). Clé anon en priorité (moindre privilège) ;
  // service_role n'est qu'un dernier recours de compatibilité.
  const env = (name: string) => Netlify.env.get(name)
  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL")
  const supabaseKey =
    env("SUPABASE_ANON_KEY") || env("VITE_SUPABASE_ANON_KEY") || env("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !supabaseKey || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl)) {
    return new Response(JSON.stringify({ error: "Configuration serveur manquante" }), {
      status: 500,
      headers: secHeaders,
    })
  }

  try {
    const [catalog2, publicProducts] = await Promise.all([
      callRpc(supabaseUrl, supabaseKey, "get_catalog2_articles").catch(() => []),
      callRpc(supabaseUrl, supabaseKey, "get_public_products").catch(() => []),
    ])

    return new Response(JSON.stringify({ catalog2, publicProducts }), {
      status: 200,
      headers: {
        ...secHeaders,
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Netlify-CDN-Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    })
  } catch {
    return new Response(JSON.stringify({ error: "Erreur lors du chargement des produits" }), {
      status: 502,
      headers: secHeaders,
    })
  }
}
