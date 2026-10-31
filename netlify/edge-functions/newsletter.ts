/* ══════════════════════════════════════════════════════════════
   NEWSLETTER API — Netlify Edge Function (runtime Deno)
   ──────────────────────────────────────────────────────────────
   ✅ Réception sécurisée de l'e-mail depuis la section "Restez informés"
   ✅ Aucune clé Supabase exposée côté client
   ✅ Enregistrement direct dans la table public.newsletter_subscribers (colonne: email)
   ✅ Protection anti-spam par rate limiting (10 req/min/IP)
   ══════════════════════════════════════════════════════════════ */

import type { Config, Context } from "https://edge.netlify.com"

export const config: Config = {
  path: "/api/newsletter",
}

function getEnv(key: string): string | undefined {
  try {
    const val = (globalThis as any).Netlify?.env?.get?.(key)
    if (val) return val
  } catch {}
  try {
    const val = (globalThis as any).Deno?.env?.get?.(key)
    if (val) return val
  } catch {}
  try {
    const val = (globalThis as any).process?.env?.[key]
    if (val) return val
  } catch {}
  return undefined
}

const rateMap = new Map<string, { start: number; count: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
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
  return entry.count <= 10
}

export default async (req: Request, context: Context) => {
  const secHeaders: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...secHeaders,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
      status: 405,
      headers: secHeaders,
    })
  }

  const clientIp = context?.ip || "127.0.0.1"
  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({ error: "Trop de tentatives. Veuillez patienter une minute." }),
      { status: 429, headers: secHeaders }
    )
  }

  try {
    const raw = await req.text()
    const body = raw ? JSON.parse(raw) : {}
    const rawEmail = String(body?.email || "").trim().toLowerCase()

    if (!rawEmail || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(rawEmail)) {
      return new Response(
        JSON.stringify({ error: "Veuillez saisir une adresse e-mail valide." }),
        { status: 400, headers: secHeaders }
      )
    }

    const supabaseUrl = (getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL") || "").replace(/\/+$/, "")
    const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY")

    if (supabaseUrl && supabaseKey) {
      const sbResp = await fetch(`${supabaseUrl}/rest/v1/newsletter_subscribers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ email: rawEmail }),
      })

      // Code 409 : L'e-mail existe déjà dans la table
      if (sbResp.status === 409) {
        return new Response(
          JSON.stringify({ success: true, message: "Vous êtes déjà inscrit aux actualités !" }),
          { status: 200, headers: secHeaders }
        )
      }

      if (!sbResp.ok && sbResp.status !== 201) {
        const errText = await sbResp.text()
        console.error("[Newsletter Edge] Erreur Supabase:", sbResp.status, errText)
        return new Response(
          JSON.stringify({ error: "Impossible d'enregistrer l'adresse pour le moment." }),
          { status: 500, headers: secHeaders }
        )
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Merci ! Votre inscription a bien été prise en compte." }),
      { status: 200, headers: secHeaders }
    )
  } catch (err: any) {
    console.error("[Newsletter Edge] Exception:", err)
    return new Response(
      JSON.stringify({ error: "Une erreur est survenue lors de l'enregistrement." }),
      { status: 500, headers: secHeaders }
    )
  }
}
