/* ══════════════════════════════════════════════════════════════
   PRODUCTS API — Netlify Edge Function (runtime Deno)
   ──────────────────────────────────────────────────────────────
   ✅ Exécutée au plus près de l'utilisateur (latence minimale, pas de cold start)
   ✅ Aucune clé Supabase dans le bundle client : le navigateur appelle uniquement /api/products
   ✅ Accès base via SUPABASE_SERVICE_ROLE_KEY (variable serveur Netlify)
   ✅ Chiffrement de bout en bout JWE (RFC 7516 : RSA-OAEP-256 + A256GCM) :
      Dans F12 → Network → /api/products, la réponse est toujours chiffrée :
      { "success": true, "encrypted": true, "jwe": "eyJhbGciOiJSU0EtT0FFUC0yNTYiLCJlbmMiOiJBMjU2R0NNIn0..." }
   ✅ Noms de procédures fixes, aucune entrée utilisateur transmise à la base
   ✅ Rate limiting par IP (60 req/min, par instance edge)
   ✅ Méthode GET uniquement
   ══════════════════════════════════════════════════════════════ */

import type { Config, Context } from "https://edge.netlify.com"

export const config: Config = {
  path: "/api/products",
}

/**
 * Déduit la catégorie d'un article à partir de son nom quand la base renvoie
 * null / '' / 'Général'.  Même logique que côté client (useProducts.ts).
 */
function inferCategory(name: string, rawCategory: string | null | undefined): string {
  const cat = (rawCategory || "").trim()
  if (cat && cat !== "Général") return cat

  const n = name.toUpperCase()
  if (/BLOUSE|CALOT|CHAUSSURE|SABOT|TUNIQUE|PANTALON/.test(n)) return "Uniformes"
  if (/ACCESSOIRE|ETUI|MONTRE|GESTOGRAMME|COIFFE/.test(n)) return "Accessoires"
  if (/GANT|CACHE[\s-]?NEZ|MASQUE|FIL DE SUTURE|KIT|BANDELETTE|STETHOSCOPE|TENSIOMETRE|THERMOMETRE|SPECULUM|OTOSCOPE|OXYMETRE|NEBULISATEUR|CATHETER|GARROT|LANCETTE|MARTEAU|MICROSCOPE|MONITEUR|DIAPASON|LAMPE|DETECTEUR|ECHO|RESPIRATEUR|PEAU DE SUTURE|CHRONOMETRE|GEL D|GLUCOMETRE|HEMOGLOBINOMETRE/.test(n)) return "Dispositifs"
  return "Général"
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
  return entry.count <= 60
}

// Cache mémoire du catalogue nettoyé (60 s) pour éviter de solliciter Supabase à chaque chiffrement JWE
let cachedCatalogPayload: { catalog2: any[]; publicProducts: any[] } | null = null
let cachedCatalogExpiresAt = 0

// Clé publique RSA-OAEP-256 de secours côté serveur (utilisée si quelqu'un ouvre /api/products
// directement dans un onglet ou via curl sans en-tête X-Pub-Key : la réponse reste 100 % chiffrée en JWE)
let fallbackServerPubKeyPromise: Promise<CryptoKey> | null = null

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/")
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4))
  const binary = atob(b64 + pad)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

async function getFallbackServerPublicKey(): Promise<CryptoKey> {
  if (!fallbackServerPubKeyPromise) {
    fallbackServerPubKeyPromise = (async () => {
      const kp = await crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        false,
        ["encrypt", "decrypt"]
      )
      return kp.publicKey
    })()
  }
  return fallbackServerPubKeyPromise
}

async function resolveRecipientPublicKey(pubKeyB64Url: string | null): Promise<CryptoKey> {
  if (pubKeyB64Url && /^[A-Za-z0-9_-]{200,800}$/.test(pubKeyB64Url.trim())) {
    try {
      const spkiBytes = base64UrlToBytes(pubKeyB64Url.trim())
      return await crypto.subtle.importKey(
        "spki",
        spkiBytes as BufferSource,
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["encrypt"]
      )
    } catch {
      // Repli sur la clé serveur éphémère
    }
  }
  return getFallbackServerPublicKey()
}

/**
 * Chiffre un objet JSON au format JWE Compact Serialization (RFC 7516) :
 * Header protégé : {"alg":"RSA-OAEP-256","enc":"A256GCM"}
 * -> eyJhbGciOiJSU0EtT0FFUC0yNTYiLCJlbmMiOiJBMjU2R0NNIn0
 */
async function encryptPayloadAsJwe(data: unknown, pubKeyB64Url: string | null): Promise<string> {
  const publicKey = await resolveRecipientPublicKey(pubKeyB64Url)

  const protectedHeaderB64 = "eyJhbGciOiJSU0EtT0FFUC0yNTYiLCJlbmMiOiJBMjU2R0NNIn0"
  const aad = new TextEncoder().encode(protectedHeaderB64)

  // 1. Générer une CEK AES-256-GCM aléatoire (32 octets) et un IV (12 octets)
  const cek = crypto.getRandomValues(new Uint8Array(32))
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // 2. Chiffrer la CEK avec la clé publique RSA-OAEP-256
  const encryptedKeyBuf = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    cek
  )
  const encryptedKeyB64 = bytesToBase64Url(new Uint8Array(encryptedKeyBuf))

  // 3. Chiffrer le JSON avec AES-256-GCM (tag 128 bits)
  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  )
  const plaintextBytes = new TextEncoder().encode(JSON.stringify(data))
  const encryptedBuf = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: aad,
      tagLength: 128,
    },
    aesKey,
    plaintextBytes
  )

  const encryptedBytes = new Uint8Array(encryptedBuf)
  const ciphertextBytes = encryptedBytes.slice(0, encryptedBytes.length - 16)
  const tagBytes = encryptedBytes.slice(encryptedBytes.length - 16)

  const ivB64 = bytesToBase64Url(iv)
  const ciphertextB64 = bytesToBase64Url(ciphertextBytes)
  const tagB64 = bytesToBase64Url(tagBytes)

  return `${protectedHeaderB64}.${encryptedKeyB64}.${ivB64}.${ciphertextB64}.${tagB64}`
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

function sanitizeCatalog2Item(item: any) {
  if (!item || typeof item !== "object") return null
  return {
    id: item._original_id || item.id,
    name: item.name || "",
    description: item.description || "",
    price: item.price || 0,
    category: inferCategory(item.name || "", item.category),
    in_stock: Boolean(item.in_stock),
    is_featured: Boolean(item.is_featured),
    promotion_type: item.promotion_type || null,
    promotion_value: item.promotion_value || 0,
    image_url: item.image_url || "",
    images: Array.isArray(item.images) ? item.images : [],
    models: Array.isArray(item.models)
      ? item.models.map((m: any) => ({
          name: m?.name || "",
          sale_price: m?.sale_price ?? null,
          colors: Array.isArray(m?.colors)
            ? m.colors.map((c: any) => ({
                name: c?.name || "",
                sale_price: c?.sale_price ?? null,
                sizes: Array.isArray(c?.sizes)
                  ? c.sizes.map((s: any) => ({
                      name: s?.name || "",
                      sale_price: s?.sale_price ?? null,
                    }))
                  : [],
              }))
            : [],
        }))
      : [],
  }
}

function sanitizePublicItem(item: any) {
  if (!item || typeof item !== "object") return null
  return {
    id: item.id,
    name: item.name || "",
    description: item.description || "",
    price: item.price || 0,
    promo_price: item.promo_price ?? null,
    promotion_type: item.promotion_type || null,
    promotion_value: item.promotion_value || 0,
    category: inferCategory(item.name || "", item.category),
    in_stock: Boolean(item.in_stock),
    is_featured: Boolean(item.is_featured),
    image_url: item.image_url || "",
    images: Array.isArray(item.images) ? item.images : [],
    color: Array.isArray(item.color) ? item.color : [],
    size: Array.isArray(item.size) ? item.size : [],
  }
}

export default async (req: Request, context: Context) => {
  const secHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "0",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cache-Control": "private, no-store, max-age=0",
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...secHeaders, Allow: "GET" },
    })
  }

  if (!checkRateLimit(context.ip || "127.0.0.1")) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { ...secHeaders, "Retry-After": "60" },
    })
  }

  const supabaseUrl = Netlify.env.get("SUPABASE_URL")
  const supabaseKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !supabaseKey || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl)) {
    return new Response(JSON.stringify({ error: "Configuration serveur manquante" }), {
      status: 500,
      headers: secHeaders,
    })
  }

  try {
    let payload = cachedCatalogPayload
    if (!payload || Date.now() >= cachedCatalogExpiresAt) {
      const [rawCatalog2, rawPublicProducts] = await Promise.all([
        callRpc(supabaseUrl, supabaseKey, "get_catalog2_articles").catch(() => []),
        callRpc(supabaseUrl, supabaseKey, "get_public_products").catch(() => []),
      ])

      const catalog2 = rawCatalog2.map(sanitizeCatalog2Item).filter(Boolean)
      const publicProducts = rawPublicProducts.map(sanitizePublicItem).filter(Boolean)
      payload = { catalog2, publicProducts }
      if (catalog2.length > 0 || publicProducts.length > 0) {
        cachedCatalogPayload = payload
        cachedCatalogExpiresAt = Date.now() + 60_000
      }
    }

    const clientPubKey = req.headers.get("x-pub-key")
    const jwe = await encryptPayloadAsJwe(payload, clientPubKey)

    return new Response(
      JSON.stringify(
        {
          success: true,
          encrypted: true,
          jwe,
        },
        null,
        4
      ),
      {
        status: 200,
        headers: secHeaders,
      }
    )
  } catch {
    return new Response(JSON.stringify({ error: "Erreur lors du chargement des produits" }), {
      status: 502,
      headers: secHeaders,
    })
  }
}
