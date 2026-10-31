import type { Config, Context } from "https://edge.netlify.com"

export const config: Config = {
  path: "/p/*",
}

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
}

export default async (request: Request, context: Context): Promise<Response> => {
  const url = new URL(request.url)

  // Extraire le productId (/p/C2-138 -> C2-138)
  const cleanPath = url.pathname.replace(/\/+$/, "")
  const pathParts = cleanPath.split("/")
  const rawProductId = pathParts[pathParts.length - 1]

  // Sanitize: n'autoriser que lettres, chiffres, tirets et underscores
  const productId = (rawProductId || "").replace(/[^a-zA-Z0-9\-_]/g, "")

  if (!productId || productId === "p") {
    return new Response(null, { status: 302, headers: { ...SECURITY_HEADERS, Location: "/" } })
  }

  const baseUrl = url.origin
  const redirectUrl = `${baseUrl}/?product=${encodeURIComponent(productId)}`

  // Détecter si la requête provient d'un robot / crawler de prévisualisation (WhatsApp, Facebook, Twitter, Telegram...)
  const ua = request.headers.get("user-agent") || ""
  const isBot =
    /facebookexternalhit|facebot|telegrambot|twitterbot|linkedinbot|slackbot|discordbot|googlebot|bingbot|pinterest|embedly|quora link preview|yandex|duckduckbot/i.test(
      ua
    ) || (/^WhatsApp\//i.test(ua.trim()) && !ua.includes("Mozilla"))

  // Si c'est un visiteur humain (navigateur classique), redirection 302 instantanée vers l'article
  if (!isBot && ua.length > 0) {
    return new Response(null, {
      status: 302,
      headers: {
        ...SECURITY_HEADERS,
        Location: redirectUrl,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  }

  try {
    let product: any = null

    // 1. Chercher dans le snapshot pré-compilé (très rapide, sur le CDN)
    try {
      const res = await fetch(`${baseUrl}/products-snapshot.json`)
      if (res.ok) {
        const snapshot = await res.json()
        const catalog2Items = snapshot.catalog2 || []
        const publicItems = snapshot.public || snapshot.publicProducts || []

        const isCatalog2 = productId.startsWith("C2-")
        const isPublic = productId.startsWith("PB-")
        const rawId = parseInt(productId.replace(/^(C2-|PB-)/i, ""), 10)

        if (isCatalog2) {
          product = catalog2Items.find(
            (p: any) =>
              p.id === rawId ||
              p._original_id === rawId ||
              (p.id >= 1000000 && p.id - 1000000 === rawId) ||
              (rawId >= 1000000 && p.id === rawId - 1000000)
          )
        } else if (isPublic) {
          product = publicItems.find((p: any) => p.id === rawId || p._original_id === rawId)
        } else {
          const all = [...catalog2Items, ...publicItems]
          product = all.find(
            (p: any) =>
              p.id === rawId ||
              p._original_id === rawId ||
              String(p.id) === productId ||
              String(p._original_id) === productId
          )
        }

        // Repli par slug (nom slugifié)
        if (!product) {
          const all = [...catalog2Items, ...publicItems]
          const slug = productId.toLowerCase()
          product = all.find((p: any) => {
            const pSlug = (p.name || "")
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "")
            return pSlug === slug
          })
        }
      }
    } catch {
      // Ignorer l'erreur réseau snapshot et continuer
    }

    // 2. Si non trouvé dans le snapshot, interroger la base Supabase (si configurée)
    if (!product) {
      try {
        const supabaseUrl =
          (globalThis as any).Netlify?.env?.get?.("SUPABASE_URL") ||
          (globalThis as any).Deno?.env?.get?.("SUPABASE_URL")
        const supabaseKey =
          (globalThis as any).Netlify?.env?.get?.("SUPABASE_SERVICE_ROLE_KEY") ||
          (globalThis as any).Deno?.env?.get?.("SUPABASE_SERVICE_ROLE_KEY")

        if (supabaseUrl && supabaseKey) {
          const rawId = parseInt(productId.replace(/^(C2-|PB-)/i, ""), 10)
          const [c2Res, pbRes] = await Promise.all([
            fetch(`${supabaseUrl}/rest/v1/rpc/get_catalog2_articles`, {
              method: "POST",
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({}),
            }).catch(() => null),
            fetch(`${supabaseUrl}/rest/v1/rpc/get_public_products`, {
              method: "POST",
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({}),
            }).catch(() => null),
          ])

          if (c2Res && c2Res.ok) {
            const items = await c2Res.json()
            product = items.find((p: any) => p.id === rawId || String(p.id) === productId)
          }
          if (!product && pbRes && pbRes.ok) {
            const items = await pbRes.json()
            product = items.find((p: any) => p.id === rawId || String(p.id) === productId)
          }
        }
      } catch {
        // Ignorer l'erreur Supabase
      }
    }

    if (!product) {
      return new Response(null, { status: 302, headers: { ...SECURITY_HEADERS, Location: redirectUrl } })
    }

    // Formater les données de partage Open Graph
    const price = Number(product.price) || 0
    const priceText = price > 0 ? `${price.toLocaleString("fr-FR")} FCFA` : ""
    const title = priceText
      ? `${product.name} — ${priceText} | GoodDoctor's Shop`
      : `${product.name} | GoodDoctor's Shop`

    const rawDesc = (product.description || "").replace(/<[^>]*>/g, "").trim()
    const description = rawDesc
      ? rawDesc.substring(0, 200)
      : `${product.name} — Uniformes, dispositifs et accessoires médicaux certifiés sur GoodDoctor's Shop.`

    let imageUrl = ""
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      const first = product.images[0]
      imageUrl = typeof first === "string" ? first : first?.url || ""
    } else if (typeof product.image_url === "string") {
      imageUrl = product.image_url
    }

    // Optimisation d'image avec wsrv.nl :
    // - Recadre en 800x800 sur fond blanc
    // - Convertit en JPEG ultra-léger (~50 KB)
    // - Compatible à 100% avec les exigences strictes de WhatsApp (taille < 300 KB, format JPEG)
    const ogImageUrl = imageUrl
      ? `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&w=800&h=800&fit=contain&bg=ffffff&output=jpg&q=80`
      : `${baseUrl}/logo.png`

    const shareUrl = `${baseUrl}/p/${productId}`
    const safeTitle = title.replace(/"/g, "&quot;").replace(/</g, "&lt;")
    const safeDesc = description.substring(0, 200).replace(/"/g, "&quot;").replace(/</g, "&lt;")

    const html = `<!DOCTYPE html>
<html lang="fr" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>

  <!-- Balises Open Graph pour WhatsApp, Facebook, LinkedIn, Telegram -->
  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="GoodDoctor's Shop" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:secure_url" content="${ogImageUrl}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="800" />
  <meta property="og:image:height" content="800" />
  <meta property="og:image:alt" content="${safeTitle}" />
  <meta property="og:url" content="${shareUrl}" />
  <meta property="og:locale" content="fr_FR" />
  ${
    price > 0
      ? `<meta property="product:price:amount" content="${price}" />
  <meta property="product:price:currency" content="XOF" />`
      : ""
  }

  <!-- Twitter Cards -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${ogImageUrl}">

  <!-- Redirection pour navigateurs humains -->
  <script>window.location.replace("${redirectUrl}");</script>
  <noscript><meta http-equiv="refresh" content="0; url=${redirectUrl}"></noscript>
</head>
<body>
  <p>Redirection vers l'article... <a href="${redirectUrl}">Cliquez ici si la redirection ne démarre pas</a>.</p>
</body>
</html>`

    return new Response(html, {
      headers: {
        ...SECURITY_HEADERS,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (err) {
    console.error("[OG-Preview] Erreur:", err)
    return new Response(null, { status: 302, headers: { ...SECURITY_HEADERS, Location: redirectUrl } })
  }
}
