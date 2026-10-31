import { useState, useEffect } from 'react'
import defaultSnapshot from './products-snapshot.json'
import { getJweRequestHeaders, parseAndDecryptJwe } from './jweClient'

export type Product = {
  id: string
  name: string
  description: string
  price: number
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
  if (!price && item.models?.length) {
    const m = item.models[0]
    price = m.sale_price || 0
    if (!price && m.colors?.length) {
      const c = m.colors[0]
      price = c.sale_price || 0
      if (!price && c.sizes?.length) price = c.sizes[0].sale_price || 0
    }
  }

  let originalPrice: number | null = null
  let promoBadge: string | null = null
  if (item.promotion_type && item.promotion_value > 0 && price > 0) {
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

  const name = item.name || 'Article sans nom'
  const category = inferCategory(name, item.category)

  const modelColors = Array.from(
    new Set(
      (item.models || [])
        .flatMap((m: any) => (m.colors || []).map((c: any) => c.name))
        .filter(Boolean) as string[]
    )
  )
  const colorSizes = Array.from(
    new Set(
      (item.models || [])
        .flatMap((m: any) => (m.colors || []).flatMap((c: any) => (c.sizes || []).map((s: any) => s.name)))
        .filter(Boolean) as string[]
    )
  )
  const nonStandardModels = Array.from(
    new Set(
      (item.models || [])
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

const CACHE_KEY = 'gds_products_cache_v2'

function getInitialCache(): { products: Product[]; categories: string[] } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Array.isArray(data) && data.length > 0 && Date.now() - ts < 30 * 60 * 1000) {
      const sanitized: Product[] = data
        .filter((p: any) => p && typeof p.id === 'string' && typeof p.name === 'string' && Number.isFinite(Number(p.price)) && Number(p.price) >= 0)
        .map((p: any) => ({
          ...p,
          name: String(p.name).replace(/[<>]/g, '').slice(0, 200),
          description: String(p.description || '').replace(/[<>]/g, '').slice(0, 1000),
          price: Math.round(Number(p.price)),
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
      }
    }
  } catch { /* ignore */ }
  return null
}

function getBundledSnapshotProducts(): Product[] {
  try {
    const snap = defaultSnapshot as any
    const c2 = (snap.catalog2 || []).map(transformCatalog2Product)
    const pb = (snap.public || snap.publicProducts || []).map(transformPublicProduct)
    return [...pb, ...c2]
  } catch {
    return []
  }
}

const BUNDLED_PRODUCTS: Product[] = getBundledSnapshotProducts()

function getInitialProducts(): { products: Product[]; categories: string[] } {
  const cached = getInitialCache()
  if (cached && cached.products.length > 0) return cached
  const cats = new Set(BUNDLED_PRODUCTS.map(p => p.category))
  return {
    products: BUNDLED_PRODUCTS,
    categories: ['Tout', ...(Array.from(cats).sort() as string[])],
  }
}

export function useProducts() {
  const initial = getInitialProducts()
  const [products, setProducts] = useState<Product[]>(() => initial.products)
  const [categories, setCategories] = useState<string[]>(() => initial.categories)
  const [loading, setLoading] = useState<boolean>(() => initial.products.length === 0)

  useEffect(() => {
    let cancelled = false

    const applyProducts = (merged: Product[]) => {
      if (cancelled || merged.length === 0) return
      const cats = new Set(merged.map(p => p.category))
      setProducts(merged)
      setCategories(['Tout', ...(Array.from(cats).sort() as string[])])
      setLoading(false)
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: merged, ts: Date.now() }))
      } catch { /* storage full */ }
    }

    async function load() {
      // Rafraîchissement en arrière-plan.
      // Le navigateur ne parle JAMAIS à Supabase : il appelle uniquement /api/products
      // (Netlify Edge Function en production, même fonction servie par Vite en dev local).
      // La clé SUPABASE_SERVICE_ROLE_KEY reste côté serveur.
      try {
        let catalog2: any[] = []
        let publicData: any[] = []

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
          applyProducts(merged)
        }
      } catch (err) {
        console.error('[Products] Erreur réseau:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { products, categories, loading }
}
