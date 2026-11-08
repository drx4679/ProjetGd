import { useState, useEffect } from 'react'

export type Product = {
  id: string
  name: string
  description: string
  price: number
  maxPrice?: number | null
  variantPrices?: Record<string, number>
  sizesByColor?: Record<string, string[]>
  originalPrice: number | null
  promoBadge: string | null
  category: string
  images: { url: string }[]
  inStock: boolean
  isFeatured: boolean
  variantColors: string | null
  variantSizes: string | null
  sizesList: string[]
  colorsList: string[]
}

export function getAvailableSizesForColor(product: Product, color?: string): string[] {
  if (color && product.sizesByColor) {
    const trimmed = color.trim()
    if (product.sizesByColor[trimmed]?.length) return product.sizesByColor[trimmed]
    const matchKey = Object.keys(product.sizesByColor).find(
      k => k.toLowerCase() === trimmed.toLowerCase()
    )
    if (matchKey && product.sizesByColor[matchKey]?.length) return product.sizesByColor[matchKey]
  }
  return product.sizesList
}

export function resolveVariantPrice(product: Product, size?: string, color?: string): number {
  const map = product.variantPrices
  if (!map) return product.price
  const s = (size || '').trim().toUpperCase()
  const c = (color || '').trim().toUpperCase()
  if (s && c && map[`${s}|${c}`] > 0) return map[`${s}|${c}`]
  if (s && map[`S:${s}`] > 0) return map[`S:${s}`]
  if (c && map[`C:${c}`] > 0) return map[`C:${c}`]
  return product.price
}

function sanitizeImageUrl(raw: unknown): { url: string } | null {
  if (!raw) return null
  const u = typeof raw === 'string' ? raw.trim() : typeof (raw as any)?.url === 'string' ? (raw as any).url.trim() : ''
  if (!u) return null
  // Uniquement https:// ou chemin relatif du site ("//hote" = URL relative au protocole, refusée).
  // http:// (contenu mixte) et data: (SVG/HTML embarqué) sont refusés.
  if (/^https:\/\/[^\s]+$/i.test(u) || (u.startsWith('/') && !u.startsWith('//') && !u.includes('\\'))) {
    return { url: u }
  }
  return null
}

/**
 * Déduit la catégorie d'un article à partir de son nom quand la base renvoie
 * null / '' / 'Général'.  Les mots-clés sont tirés du catalogue GoodDoctor's Shop.
 */
function inferCategory(name: string, rawCategory: string | null | undefined): string {
  const cat = (rawCategory || '').trim()
  if (cat && cat !== 'Général') return cat

  const n = name.toUpperCase()

  // Uniformes : vêtements / chaussures médicaux
  if (/BLOUSE|CALOT|CHAUSSURE|SABOT|TUNIQUE|PANTALON/.test(n)) return 'Uniformes'

  // Accessoires : étuis, montres, gestogrammes, coiffes, littmann accessoires
  if (/ACCESSOIRE|ETUI|MONTRE|GESTOGRAMME|COIFFE/.test(n)) return 'Accessoires'

  // Tout le reste → Dispositifs (gants, masques, cache-nez, kits, instruments…)
  if (/GANT|CACHE[\s-]?NEZ|MASQUE|FIL DE SUTURE|KIT|BANDELETTE|STETHOSCOPE|TENSIOMETRE|THERMOMETRE|SPECULUM|OTOSCOPE|OXYMETRE|NEBULISATEUR|CATHETER|GARROT|LANCETTE|MARTEAU|MICROSCOPE|MONITEUR|DIAPASON|LAMPE|DETECTEUR|ECHO|RESPIRATEUR|PEAU DE SUTURE|CHRONOMETRE|GEL D|GLUCOMETRE|HEMOGLOBINOMETRE/.test(n)) return 'Dispositifs'

  return 'Général'
}

function enrichProduct(base: Omit<Product, 'sizesList' | 'colorsList'>): Product {
  let sizesList = base.variantSizes
    ? Array.from(new Set(base.variantSizes.split(', ').map(s => s.trim()).filter(Boolean)))
    : []
  let colorsList = base.variantColors
    ? Array.from(new Set(base.variantColors.split(', ').map(c => c.trim()).filter(c => c && c.toLowerCase() !== 'standard')))
    : []
  return { ...base, sizesList, colorsList }
}

function transformCatalog2Product(item: any): Product {
  let price = item.price || 0
  let maxPrice: number | null = null
  const variantPrices: Record<string, number> = {}
  const sizesByColor: Record<string, string[]> = {}

  const applyPromo = (p: number): number => {
    if (item.promotion_type && item.promotion_value > 0 && p > 0) {
      if (item.promotion_type === 'percent') {
        return Math.round(p * (1 - item.promotion_value / 100))
      } else if (item.promotion_type === 'amount') {
        return Math.max(0, p - item.promotion_value)
      }
    }
    return p
  }

  // Filtrer les variantes retirées de la boutique (is_published === false) avec cascade
  const publishedModels = Array.isArray(item.models)
    ? item.models
        .filter((m: any) => m && m.is_published !== false)
        .map((m: any) => {
          const rawColors = Array.isArray(m.colors) ? m.colors : []
          const pubColors = rawColors
            .filter((c: any) => c && c.is_published !== false)
            .map((c: any) => {
              const rawSizes = Array.isArray(c.sizes) ? c.sizes : []
              const pubSizes = rawSizes.filter((s: any) => s && s.is_published !== false)
              if (rawSizes.length > 0 && pubSizes.length === 0) return null
              return { ...c, sizes: pubSizes }
            })
            .filter(Boolean)
          if (rawColors.length > 0 && pubColors.length === 0) return null
          return { ...m, colors: pubColors }
        })
        .filter(Boolean)
    : []

  if (!price && publishedModels.length) {
    const collectedPrices: number[] = []
    for (const m of publishedModels) {
      const mName = typeof m?.name === 'string' ? m.name.trim().toUpperCase() : ''
      const mPrice = m?.sale_price > 0 ? applyPromo(Number(m.sale_price)) : 0
      if (mPrice > 0) {
        collectedPrices.push(mPrice)
        if (mName) variantPrices[`S:${mName}`] = mPrice
      }
      for (const c of m?.colors || []) {
        const cName = typeof c?.name === 'string' ? c.name.trim().toUpperCase() : ''
        const cPrice = c?.sale_price > 0 ? applyPromo(Number(c.sale_price)) : mPrice
        if (c?.sale_price > 0) {
          collectedPrices.push(cPrice)
        }
        if (cPrice > 0 && cName) {
          variantPrices[`C:${cName}`] = cPrice
          if (mName) variantPrices[`${mName}|${cName}`] = cPrice
        }
        for (const s of c?.sizes || []) {
          const sName = typeof s?.name === 'string' ? s.name.trim().toUpperCase() : ''
          const sPrice = s?.sale_price > 0 ? applyPromo(Number(s.sale_price)) : cPrice
          if (s?.sale_price > 0) {
            collectedPrices.push(sPrice)
          }
          if (sPrice > 0 && sName) {
            variantPrices[`S:${sName}`] = sPrice
            if (cName) variantPrices[`${sName}|${cName}`] = sPrice
          }
        }
      }
    }
    if (collectedPrices.length > 0) {
      const minP = Math.min(...collectedPrices)
      const maxP = Math.max(...collectedPrices)
      price = minP
      if (maxP > minP) {
        maxPrice = maxP
      }
    }
  }

  let originalPrice: number | null = null
  let promoBadge: string | null = null
  if (item.promotion_type && item.promotion_value > 0 && price > 0) {
    if (item.price > 0) {
      originalPrice = item.price
      price = applyPromo(item.price)
    }
    if (item.promotion_type === 'percent') {
      promoBadge = `-${item.promotion_value}%`
    } else if (item.promotion_type === 'amount') {
      promoBadge = `-${item.promotion_value} FCFA`
    }
  }

  let images: { url: string }[] = []
  if (item.images && Array.isArray(item.images) && item.images.length > 0) {
    images = item.images.map(sanitizeImageUrl).filter((x: { url: string } | null): x is { url: string } => Boolean(x))
  } else if (item.image_url) {
    const clean = sanitizeImageUrl(item.image_url)
    if (clean) images = [clean]
  }

  const name = item.name || 'Article sans nom'
  const category = inferCategory(name, item.category)

  for (const m of publishedModels) {
    for (const c of m?.colors || []) {
      const cName = typeof c?.name === 'string' ? c.name.trim() : ''
      if (!cName || cName.toLowerCase() === 'standard') continue
      const cSizes = (c.sizes || [])
        .map((s: any) => (typeof s?.name === 'string' ? s.name.trim() : ''))
        .filter(Boolean) as string[]
      if (cSizes.length > 0) {
        const prev = sizesByColor[cName] || []
        sizesByColor[cName] = Array.from(new Set([...prev, ...cSizes]))
      }
    }
  }

  const modelColors = Array.from(
    new Set(
      publishedModels
        .flatMap((m: any) => (m.colors || []).map((c: any) => c.name))
        .filter(Boolean) as string[]
    )
  )
  const colorSizes = Array.from(
    new Set(
      publishedModels
        .flatMap((m: any) => (m.colors || []).flatMap((c: any) => (c.sizes || []).map((s: any) => s.name)))
        .filter(Boolean) as string[]
    )
  )
  const nonStandardModels = Array.from(
    new Set(
      publishedModels
        .map((m: any) => (typeof m?.name === 'string' ? m.name.trim() : ''))
        .filter((n: string) => n && n.toLowerCase() !== 'standard' && n.toLowerCase() !== 'sans') as string[]
    )
  )
  const combinedSizes = colorSizes.length > 0 ? colorSizes : nonStandardModels

  return enrichProduct({
    id: `C2-${item._original_id || item.id}`,
    name,
    description: (item.description || '').replace(/<[^>]*>/g, '').trim() || name,
    price,
    maxPrice,
    variantPrices: Object.keys(variantPrices).length > 0 ? variantPrices : undefined,
    sizesByColor: Object.keys(sizesByColor).length > 0 ? sizesByColor : undefined,
    originalPrice,
    promoBadge,
    category,
    images,
    inStock: item.in_stock ?? true,
    isFeatured: item.is_featured || false,
    variantColors: modelColors.join(', ') || null,
    variantSizes: combinedSizes.join(', ') || null,
  })
}

function transformPublicProduct(item: any): Product {
  let price = item.price || 0
  let originalPrice: number | null = null
  let promoBadge: string | null = null

  if (item.promo_price && item.promo_price > 0 && item.promo_price < price) {
    originalPrice = price
    price = item.promo_price
    if (item.promotion_type === 'percent') promoBadge = `-${item.promotion_value}%`
    else if (item.promotion_type === 'amount') promoBadge = `-${item.promotion_value} FCFA`
  } else if (item.promotion_type && item.promotion_value > 0 && price > 0) {
    originalPrice = price
    if (item.promotion_type === 'percent') {
      price = Math.round(price * (1 - item.promotion_value / 100))
      promoBadge = `-${item.promotion_value}%`
    } else if (item.promotion_type === 'amount') {
      price = Math.max(0, price - item.promotion_value)
      promoBadge = `-${item.promotion_value} FCFA`
    }
  }

  let images: { url: string }[] = []
  if (item.images && Array.isArray(item.images) && item.images.length > 0) {
    images = item.images.map(sanitizeImageUrl).filter((x: { url: string } | null): x is { url: string } => Boolean(x))
  } else if (item.image_url) {
    const clean = sanitizeImageUrl(item.image_url)
    if (clean) images = [clean]
  }

  const colors = Array.isArray(item.color) ? item.color.filter(Boolean) : []
  const sizes = Array.isArray(item.size) ? item.size.filter(Boolean) : []
  const name = item.name || 'Article sans nom'
  const category = inferCategory(name, item.category)

  return enrichProduct({
    id: `PB-${item.id}`,
    name,
    description: (item.description || '').replace(/<[^>]*>/g, '').trim() || name,
    price,
    originalPrice,
    promoBadge,
    category,
    images,
    inStock: item.in_stock ?? true,
    isFeatured: item.is_featured || false,
    variantColors: colors.length > 0 ? colors.join(', ') : null,
    variantSizes: sizes.length > 0 ? sizes.join(', ') : null,
  })
}

const CACHE_KEY = 'gds_products_cache_v5'

function getInitialCache(): { products: Product[]; categories: string[]; ageMs: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    const ageMs = Date.now() - Number(ts || 0)
    if (Array.isArray(data) && data.length > 0 && ageMs < 60 * 60 * 1000) {
      const sanitized: Product[] = data
        .filter((p: any) => p && typeof p.id === 'string' && typeof p.name === 'string' && Number.isFinite(Number(p.price)) && Number(p.price) >= 0)
        .map((p: any) => ({
          ...p,
          name: String(p.name).replace(/[<>]/g, '').slice(0, 200),
          description: String(p.description || '').replace(/[<>]/g, '').slice(0, 1000),
          price: Math.round(Number(p.price)),
          maxPrice: Number.isFinite(Number(p.maxPrice)) && Number(p.maxPrice) > Number(p.price) ? Math.round(Number(p.maxPrice)) : null,
          variantPrices: p.variantPrices && typeof p.variantPrices === 'object' ? p.variantPrices : undefined,
          sizesByColor: p.sizesByColor && typeof p.sizesByColor === 'object' ? p.sizesByColor : undefined,
          images: Array.isArray(p.images)
            ? p.images.map(sanitizeImageUrl).filter((x: { url: string } | null): x is { url: string } => Boolean(x))
            : [],
          sizesList: Array.isArray(p.sizesList) ? p.sizesList.map((s: any) => String(s).slice(0, 40)) : [],
          colorsList: Array.isArray(p.colorsList) ? p.colorsList.map((c: any) => String(c).slice(0, 40)) : [],
        }))
      if (sanitized.length === 0) return null
      const cats = new Set(sanitized.map(p => p.category))
      return {
        products: sanitized,
        categories: ['Tout', ...(Array.from(cats).sort() as string[])],
        ageMs,
      }
    }
  } catch { /* ignore */ }
  return null
}

function parseSnapshotProducts(snap: any): Product[] {
  try {
    const c2 = (snap?.catalog2 || []).map(transformCatalog2Product)
    const pb = (snap?.public || snap?.publicProducts || []).map(transformPublicProduct)
    return [...pb, ...c2]
  } catch {
    return []
  }
}

export function useProducts() {
  const [initialCache] = useState(() => getInitialCache())
  const [products, setProducts] = useState<Product[]>(() => initialCache?.products || [])
  const [categories, setCategories] = useState<string[]>(() => initialCache?.categories || ['Tout'])
  const [loading, setLoading] = useState<boolean>(() => !initialCache || initialCache.products.length === 0)

  useEffect(() => {
    let cancelled = false
    let hasLiveProducts = false

    const applyProducts = (merged: Product[], persist = true) => {
      if (cancelled || merged.length === 0) return
      const cats = new Set(merged.map(p => p.category))
      setProducts(merged)
      setCategories(['Tout', ...(Array.from(cats).sort() as string[])])
      setLoading(false)
      if (persist) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: merged, ts: Date.now() }))
        } catch { /* storage full */ }
      }
    }

    // Si aucun cache localStorage n'est présent (1re visite), charge le chunk snapshot en ~15ms sans gonfler le bundle principal
    if (!initialCache || initialCache.products.length === 0) {
      import('./products-snapshot.json')
        .then((mod) => {
          if (cancelled || hasLiveProducts) return
          const snapProducts = parseSnapshotProducts(mod.default || mod)
          if (snapProducts.length > 0) {
            applyProducts(snapProducts, false)
          }
        })
        .catch(() => {})
    }

    async function loadFromApi() {
      try {
        let catalog2: any[] = []
        let publicData: any[] = []

        const { getJweRequestHeaders, parseAndDecryptJwe } = await import('./jweClient')
        const headers = await getJweRequestHeaders({ Accept: 'application/json' })
        const res = await fetch('/api/products', { headers })
        if (res.ok) {
          const rawJson = await res.json()
          const json = await parseAndDecryptJwe<{ catalog2?: any[]; publicProducts?: any[] }>(rawJson)
          catalog2 = Array.isArray(json?.catalog2) ? json.catalog2 : []
          publicData = Array.isArray(json?.publicProducts) ? json.publicProducts : []
        }

        const merged = [
          ...publicData.map(transformPublicProduct),
          ...catalog2.map(transformCatalog2Product),
        ]
        if (merged.length > 0) {
          hasLiveProducts = true
          applyProducts(merged, true)
        }
      } catch (err) {
        console.error('[Products] Erreur réseau:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    // Si le cache local est très récent (< 5 min), diffère le rafraîchissement JWE/RSA-2048 pour laisser la priorité totale au rendu et aux images
    const delayMs = initialCache && initialCache.ageMs < 5 * 60 * 1000 ? 2500 : 0
    const timer = window.setTimeout(loadFromApi, delayMs)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [initialCache])

  return { products, categories, loading }
}
