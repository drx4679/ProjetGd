/* ══════════════════════════════════════════════════════════════════════════
   CASHPAY PROXY — Netlify Edge Function (runtime Deno)
   ──────────────────────────────────────────────────────────────────────────
   ✅ Toute l'authentification OAuth2 CashPay (SEMOA) reste 100 % côté serveur
   ✅ Le navigateur n'envoie que { action, payload, orderReference } à /api/cashpay-proxy
   ✅ Aucune clé CashPay ni Supabase n'est exposée au client
   ✅ Vérification des prix et sauvegarde immédiate de la commande dans Supabase
      via SUPABASE_SERVICE_ROLE_KEY
   ✅ Vérification croisée du statut (CashPay API + table `orders` Supabase)
   ══════════════════════════════════════════════════════════════════════════ */

import type { Config, Context } from "https://edge.netlify.com"

export const config: Config = {
  path: "/api/cashpay-proxy",
  method: ["POST", "OPTIONS"],
}

// Cache du token OAuth2 CashPay en mémoire de l'instance Edge
let cachedToken: string | null = null
let tokenExpiresAt = 0
let tokenPromise: Promise<string> | null = null

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

async function getServerToken(baseUrl: string): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken
  }
  if (tokenPromise) return tokenPromise

  tokenPromise = (async () => {
    try {
      const apiKey = getEnv("CASHPAY_API_KEY")
      const username = getEnv("CASHPAY_USERNAME")
      const password = getEnv("CASHPAY_PASSWORD")
      const clientId = getEnv("CASHPAY_CLIENT_ID")
      const clientSecret = getEnv("CASHPAY_CLIENT_SECRET")

      if (!username || !password || !clientId || !clientSecret) {
        throw new Error(
          "Identifiants CashPay incomplets côté serveur (CASHPAY_USERNAME, CASHPAY_PASSWORD, CASHPAY_CLIENT_ID, CASHPAY_CLIENT_SECRET)."
        )
      }

      const authHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (apiKey) {
        authHeaders["apikey"] = apiKey
        authHeaders["x-api-key"] = apiKey
      }

      const authBody: Record<string, string> = {
        username,
        password,
        client_id: clientId,
        client_secret: clientSecret,
      }
      if (apiKey) {
        authBody.apikey = apiKey
      }

      const resp = await fetch(`${baseUrl}/auth`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(authBody),
        signal: AbortSignal.timeout(12_000),
      })

      if (!resp.ok) {
        throw new Error(`Authentification CashPay échouée (HTTP ${resp.status})`)
      }

      const data = await resp.json()
      if (!data?.access_token) {
        throw new Error("Token CashPay manquant dans la réponse d'authentification")
      }
      cachedToken = data.access_token
      tokenExpiresAt = Date.now() + Number(data.expires_in || 300) * 1000
      return cachedToken as string
    } finally {
      tokenPromise = null
    }
  })()

  return tokenPromise
}

// Rate limiting en mémoire différencié par action
// create_order : 8 req/min | check_status : 30 req/min
const rateMap = new Map<string, { start: number; count: number }>()

function checkRateLimit(ip: string, action: string): boolean {
  const now = Date.now()
  const maxReqs = action === "check_status" ? 30 : 8
  const key = `${ip}:${action || "default"}`

  if (rateMap.size > 1000) {
    for (const [k, v] of rateMap) {
      if (now - v.start > 60_000) rateMap.delete(k)
    }
  }

  const entry = rateMap.get(key)
  if (!entry || now - entry.start > 60_000) {
    rateMap.set(key, { start: now, count: 1 })
    return true
  }
  entry.count++
  return entry.count <= maxReqs
}

async function checkDuplicateOrder(
  supabaseUrl: string | undefined,
  supabaseKey: string | undefined,
  merchantRef: string
): Promise<boolean> {
  if (!supabaseUrl || !supabaseKey || !merchantRef) return false
  try {
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/orders?order_number=eq.${encodeURIComponent(merchantRef)}&select=id&limit=1`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        signal: AbortSignal.timeout(6000),
      }
    )
    if (resp.ok) {
      const rows = await resp.json()
      return Array.isArray(rows) && rows.length > 0
    }
  } catch {
    // Mode dégradé silencieux
  }
  return false
}

export default async (req: Request, context: Context) => {
  const reqOrigin = (() => {
    try {
      return new URL(req.url).origin
    } catch {
      return ""
    }
  })()
  const configuredSiteUrl = (getEnv("SITE_URL") || "https://gooddoctorsshop.com").replace(/\/+$/, "")

  const secHeaders: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...secHeaders,
        "Access-Control-Allow-Origin": reqOrigin || configuredSiteUrl,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...secHeaders, Allow: "POST, OPTIONS" },
    })
  }

  try {
    const body = await req.json()
    const { action, payload, orderReference, merchantRef: statusMerchantRef } = body || {}
    const baseUrl = (getEnv("CASHPAY_BASE_URL") || "https://api.semoa-payments.ovh/prod").replace(/\/+$/, "")
    const supabaseUrl = (getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL") || "").replace(/\/+$/, "")
    const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY")
    const apiKey = getEnv("CASHPAY_API_KEY")

    const clientIp = context?.ip || "127.0.0.1"
    if (!checkRateLimit(clientIp, String(action || ""))) {
      return new Response(
        JSON.stringify({ error: "Trop de requêtes. Patientez 1 minute avant de réessayer." }),
        { status: 429, headers: secHeaders }
      )
    }

    // ══════════════════════════════════════════════════════════════
    // ACTION 1 : CRÉER UNE COMMANDE CASHPAY (Link2Pay) + SUPABASE
    // ══════════════════════════════════════════════════════════════
    if (action === "create_order") {
      if (!payload || typeof payload !== "object") {
        return new Response(JSON.stringify({ error: "Payload invalide" }), {
          status: 400,
          headers: secHeaders,
        })
      }

      const { amount, merchant_reference, client } = payload
      if (!amount || typeof amount !== "number" || amount <= 0 || amount > 10_000_000) {
        return new Response(JSON.stringify({ error: "Montant invalide" }), {
          status: 400,
          headers: secHeaders,
        })
      }

      if (!merchant_reference || typeof merchant_reference !== "string" || !/^[\w-]+$/.test(merchant_reference)) {
        return new Response(JSON.stringify({ error: "Référence de commande invalide" }), {
          status: 400,
          headers: secHeaders,
        })
      }

      if (client) {
        const cleanedPhone = String(client.phone || "").replace(/[\s\-().]/g, "")
        if (!/^\+?\d{8,15}$/.test(cleanedPhone)) {
          return new Response(JSON.stringify({ error: "Numéro de téléphone invalide" }), {
            status: 400,
            headers: secHeaders,
          })
        }
        client.phone = cleanedPhone.startsWith("+") ? cleanedPhone : `+${cleanedPhone}`
        if (client.firstname) client.firstname = String(client.firstname).substring(0, 100)
        if (client.lastname) client.lastname = String(client.lastname).substring(0, 100)
        if (client.address1) client.address1 = String(client.address1).substring(0, 300)
      }

      if (payload.description) {
        payload.description = String(payload.description).substring(0, 200)
      }

      // Paralléliser l'obtention du token OAuth2 CashPay et la vérification anti-doublon
      const [token, isDuplicate] = await Promise.all([
        getServerToken(baseUrl),
        checkDuplicateOrder(supabaseUrl, supabaseKey, merchant_reference),
      ])

      if (isDuplicate) {
        return new Response(JSON.stringify({ error: "Commande déjà enregistrée" }), {
          status: 409,
          headers: secHeaders,
        })
      }

      // Vérification du prix côté serveur (articles catalog2 + products)
      let verifiedAmount = Math.round(amount)
      if (supabaseUrl && supabaseKey && Array.isArray(payload.items) && payload.items.length > 0) {
        try {
          const [cat2Res, pubRes] = await Promise.all([
            fetch(`${supabaseUrl}/rest/v1/rpc/get_catalog2_articles`, {
              method: "POST",
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
              },
              body: "{}",
              signal: AbortSignal.timeout(6000),
            }).catch(() => null),
            fetch(`${supabaseUrl}/rest/v1/rpc/get_public_products`, {
              method: "POST",
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
              },
              body: "{}",
              signal: AbortSignal.timeout(6000),
            }).catch(() => null),
          ])

          const priceMap = new Map<string, number>()
          if (cat2Res?.ok) {
            const cat2 = await cat2Res.json()
            if (Array.isArray(cat2)) {
              for (const row of cat2) {
                const name = String(row.title || row.name || "").trim().toLowerCase()
                const price = Number(row.promo_price || row.price || row.unit_price || 0)
                if (name && price > 0) priceMap.set(name, price)
              }
            }
          }
          if (pubRes?.ok) {
            const pub = await pubRes.json()
            if (Array.isArray(pub)) {
              for (const row of pub) {
                const name = String(row.name || row.title || "").trim().toLowerCase()
                const price = Number(row.promo_price || row.price || 0)
                if (name && price > 0) priceMap.set(name, price)
              }
            }
          }

          if (priceMap.size > 0) {
            let serverItemsTotal = 0
            let allFound = true
            for (const item of payload.items) {
              const itemName = String(item?.name || "").trim().toLowerCase()
              const dbPrice = priceMap.get(itemName)
              if (dbPrice !== undefined) {
                const qty = Math.min(99, Math.max(1, Math.round(Number(item.quantity) || 1)))
                serverItemsTotal += dbPrice * qty
              } else {
                allFound = false
                break
              }
            }
            if (allFound && serverItemsTotal > 0 && verifiedAmount < serverItemsTotal) {
              verifiedAmount = Math.round(serverItemsTotal)
            }
          }
        } catch {
          // On conserve verifiedAmount si la vérification échoue
        }
      }

      // Déterminer l'URL de redirection après paiement (privilégie le domaine HTTPS courant)
      const redirectOrigin =
        reqOrigin && reqOrigin.startsWith("https://") ? reqOrigin : configuredSiteUrl

      const safePayload = {
        ...payload,
        amount: verifiedAmount,
        currency: "XOF",
        callback_url: supabaseUrl
          ? `${supabaseUrl}/functions/v1/cashpay-callback`
          : `${configuredSiteUrl}/api/cashpay-callback`,
        redirect_url: `${redirectOrigin}/success`,
      }

      const orderHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
      if (apiKey) {
        orderHeaders["apikey"] = apiKey
        orderHeaders["x-api-key"] = apiKey
      }

      const cpResponse = await fetch(`${baseUrl}/orders`, {
        method: "POST",
        headers: orderHeaders,
        body: JSON.stringify(safePayload),
        signal: AbortSignal.timeout(15_000),
      })

      const responseText = await cpResponse.text()

      // Si CashPay a créé la commande, l'enregistrer immédiatement dans Supabase
      if (cpResponse.ok && supabaseUrl && supabaseKey) {
        try {
          const cashpayData = JSON.parse(responseText)
          const existingOrderNumber =
            payload.existing_order_number && /^[\w-]+$/.test(String(payload.existing_order_number))
              ? String(payload.existing_order_number)
              : null

          if (existingOrderNumber) {
            const encExisting = encodeURIComponent(existingOrderNumber)
            const checkResp = await fetch(
              `${supabaseUrl}/rest/v1/orders?or=(order_number.eq.${encExisting},merchant_reference.eq.${encExisting})&select=id,customer_phone&limit=1`,
              {
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                },
              }
            )
            const existingRows = checkResp.ok ? await checkResp.json() : []
            const existingOrder = Array.isArray(existingRows) ? existingRows[0] : null
            const callerDigits = String(client?.phone || "").replace(/\D/g, "")
            const ownerDigits = String(existingOrder?.customer_phone || "").replace(/\D/g, "")

            if (
              existingOrder &&
              callerDigits.length >= 8 &&
              ownerDigits.length >= 8 &&
              callerDigits.slice(-8) === ownerDigits.slice(-8)
            ) {
              await fetch(
                `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(existingOrder.id)}`,
                {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    Prefer: "return=minimal",
                  },
                  body: JSON.stringify({
                    cashpay_bill_url: cashpayData.bill_url || "",
                    cashpay_order_ref: cashpayData.order_reference || merchant_reference,
                  }),
                }
              )
            }
          } else {
            const customerName =
              `${client?.firstname || ""} ${client?.lastname || ""}`.trim() || "Client"
            const deliveryFeeVal =
              typeof payload.delivery_fee === "number" && payload.delivery_fee > 0
                ? Math.round(payload.delivery_fee)
                : 0

            const orderRecord = {
              order_number: merchant_reference,
              customer_name: customerName,
              customer_phone: client?.phone || "",
              customer_address: client?.address1 || "",
              delivery_address: client?.address1 || "",
              delivery_city: client?.city || "Lomé",
              delivery_country: client?.country || "Togo",
              items: payload.items || [],
              total_amount: verifiedAmount,
              delivery_fee: deliveryFeeVal,
              final_amount: verifiedAmount,
              currency: "XOF",
              payment_method: "cash",
              cashpay_order_ref: cashpayData.order_reference || merchant_reference,
              cashpay_bill_url: cashpayData.bill_url || "",
              merchant_reference: merchant_reference,
              payment_status: "pending",
              status: "pending",
              delivery_latitude: payload.delivery_lat || null,
              delivery_longitude: payload.delivery_lng || null,
              delivery_lat: payload.delivery_lat || null,
              delivery_lng: payload.delivery_lng || null,
            }

            await fetch(`${supabaseUrl}/rest/v1/orders`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                Prefer: "return=minimal",
              },
              body: JSON.stringify(orderRecord),
            })
          }
        } catch (sbErr) {
          console.error("[CashPay Proxy] Erreur sauvegarde Supabase:", sbErr)
        }
      }

      return new Response(responseText, {
        status: cpResponse.status,
        headers: secHeaders,
      })
    }

    // ══════════════════════════════════════════════════════════════
    // ACTION 2 : VÉRIFIER LE STATUT D'UNE COMMANDE (CashPay + Supabase)
    // ══════════════════════════════════════════════════════════════
    if (action === "check_status") {
      const ref = String(orderReference || statusMerchantRef || "").trim()
      if (!ref || !/^[\w-]+$/.test(ref)) {
        return new Response(JSON.stringify({ error: "Référence invalide" }), {
          status: 400,
          headers: secHeaders,
        })
      }

      let cpData: Record<string, any> = {}
      let cpPaid = false

      // 1. Vérifier auprès de l'API CashPay si les identifiants sont présents
      try {
        const token = await getServerToken(baseUrl)
        const statusHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        }
        if (apiKey) {
          statusHeaders["apikey"] = apiKey
          statusHeaders["x-api-key"] = apiKey
        }

        const cpResp = await fetch(`${baseUrl}/orders/${encodeURIComponent(ref)}`, {
          method: "GET",
          headers: statusHeaders,
          signal: AbortSignal.timeout(10_000),
        })

        if (cpResp.ok) {
          cpData = await cpResp.json()
          const obj = cpData?.order || cpData || {}
          const st = String(obj.state || obj.status || obj.payment_status || "").toLowerCase()
          if (["paid", "excess", "completed", "success", "approved", "confirmed", "validated"].includes(st)) {
            cpPaid = true
          }
        }
      } catch {
        // Fallback sur la vérification Supabase ci-dessous
      }

      // 2. Vérifier (et synchroniser si payé) dans Supabase
      let dbPaid = false
      let dbPaymentStatus = "pending"
      if (supabaseUrl && supabaseKey) {
        try {
          const encRef = encodeURIComponent(ref)
          const encMerch =
            statusMerchantRef && /^[\w-]+$/.test(String(statusMerchantRef))
              ? encodeURIComponent(String(statusMerchantRef))
              : encRef

          const sbResp = await fetch(
            `${supabaseUrl}/rest/v1/orders?or=(cashpay_order_ref.eq.${encRef},order_number.eq.${encMerch},merchant_reference.eq.${encMerch})&select=id,order_number,payment_status,status&limit=1`,
            {
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
              },
              signal: AbortSignal.timeout(6000),
            }
          )
          if (sbResp.ok) {
            const rows = await sbResp.json()
            const order = Array.isArray(rows) ? rows[0] : null
            if (order) {
              dbPaymentStatus = String(order.payment_status || "pending")
              if (dbPaymentStatus.toLowerCase() === "paid") {
                dbPaid = true
              } else if (cpPaid && order.id) {
                // CashPay confirme le paiement : synchroniser immédiatement Supabase
                dbPaid = true
                dbPaymentStatus = "paid"
                await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}`, {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    Prefer: "return=minimal",
                  },
                  body: JSON.stringify({
                    payment_status: "paid",
                    cashpay_callback_received_at: new Date().toISOString(),
                  }),
                })
              }
            }
          }
        } catch {}
      }

      const isPaid = cpPaid || dbPaid
      return new Response(
        JSON.stringify({
          ...cpData,
          paid: isPaid,
          payment_status: isPaid ? "paid" : dbPaymentStatus,
        }),
        { status: 200, headers: secHeaders }
      )
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), {
      status: 400,
      headers: secHeaders,
    })
  } catch (err: any) {
    console.error("[CashPay Proxy] Erreur:", err?.message || err)
    return new Response(
      JSON.stringify({
        error: err?.message || "Erreur interne du serveur de paiement",
      }),
      { status: 500, headers: secHeaders }
    )
  }
}
