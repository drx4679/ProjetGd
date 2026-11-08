import { useEffect, useState, useMemo, useCallback, useRef, useDeferredValue, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
const OrderTracking = lazy(() => import('./OrderTracking'))
const About = lazy(() => import('./About'))
const Privacy = lazy(() => import('./Privacy'))
const Cgv = lazy(() => import('./Cgv'))
import ModalShell from './ModalShell'
const Checkout = lazy(() => import('./Checkout').then(m => ({ default: m.default })))
import type { PendingPaymentInfo } from './Checkout'
import { formatMoney, formatPriceRange } from './money'
import { useProducts, resolveVariantPrice, getAvailableSizesForColor, type Product } from './useProducts'
// MedicalNeuralCanvas retiré du rendu (display: none partout) — conservé dans le repo pour réactivation future

const photos = {
  hero: '/IMG_8380.jpeg',
  heroDesktop: '/a.jpg',
}

const placeholder = '/no-image.svg'

const MEDICAL_PARTNERS = [
  { src: '/partenaires/3M_Littmann_Logo.webp', alt: 'Littmann', scale: 1.8 },
  { src: '/partenaires/OMRON_Logo.svg.webp', alt: 'Omron' },
  { src: '/partenaires/Spengler-logo-transparenten.webp', alt: 'Spengler' },
  { src: '/partenaires/Yuwell-Anytime-Yuwell-Logo.webp', alt: 'Yuwell' },
  { src: '/partenaires/e436c027861786cd61b21afafc52aa13.webp', alt: 'Partner' },
  { src: '/partenaires/png-clipart-b-braun-melsungen-company-health-care-chief-executive-others-miscellaneous-company.webp', alt: 'B. Braun' },
  { src: '/partenaires/60c01030-3dea-457c-bfce-b84bb463ba3c.__CR0,0,600,180_PT0_SX600_V1___.webp', alt: 'Partner' },
  { src: '/partenaires/MEDICA-2025-Sonowied-Vertriebs-und-Beratungsgesellschaft-fur-Sonographische-Systeme-mbH-Image-medica2025.3036738-M7h9vupRSbS5iZStEjNuIg-image.webp', alt: 'Sonowied' },
  { src: '/partenaires/anno.webp', alt: 'Anno', scale: 1.8 },
  { src: '/partenaires/leinaike.webp', alt: 'Leinaike', scale: 2 },
  { src: '/partenaires/gdshp.webp', alt: 'GoodDoctor', scale: 3 },
]

type CartItem = { productId: string; size: string; color: string; quantity: number; confirmed: boolean }

function getProductObjectPosition(name: string): string | undefined {
  const n = name.toUpperCase()
  if (n.includes('BLOUSE CHIRURGICALE')) return 'center 12%'
  if (n.includes('BLOUSE MANTEAU MANCHES COURTES')) return 'center 15%'
  if (n.includes('BLOUSE MANTEAU')) return 'center 20%'
  return undefined
}

function checkImgBrightness(imgEl: HTMLImageElement, setLight: (v: boolean) => void) {
  try {
    // Évite la relecture canvas sur les images externes (déjà en cache mémoire sans CORS)
    if (imgEl.src && !imgEl.src.startsWith(window.location.origin) && !imgEl.src.startsWith('data:')) {
      setLight(true)
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 16
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(imgEl, 0, 0, 16, 16)
    const imgData = ctx.getImageData(0, 0, 16, 16).data
    let total = 0
    let count = 0
    for (let i = 0; i < imgData.length; i += 4) {
      if (imgData[i + 3] > 30) {
        total += 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2]
        count++
      }
    }
    if (count > 0) setLight(total / count > 125)
  } catch {
    setLight(true)
  }
}

function ProductGallery({
  images,
  name,
  onOpenLightbox,
  objectPosition,
  priority = false,
}: {
  images: { url: string }[]
  name: string
  onOpenLightbox: (images: string[], index: number, title: string) => void
  objectPosition?: string
  priority?: boolean
}) {
  const [view, setView] = useState(0)
  const [mainLoaded, setMainLoaded] = useState(false)
  const views = images.length > 0 ? images.map(i => i.url) : [placeholder]
  const current = views[view] || views[0]
  return <div className="article-gallery">
    <img
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={'gallery-main view-' + view}
      src={current}
      alt={`${name} — vue ${view + 1}`}
      onLoad={() => { if (!mainLoaded) setMainLoaded(true) }}
      onClick={() => onOpenLightbox(views, view, name)}
      style={{
        cursor: 'zoom-in',
        ...(objectPosition ? { objectPosition } : {})
      }}
    />
    {views.length > 1 && mainLoaded && <div className="gallery-thumbnails" aria-label={`Vues de ${name}`}>
      {views.slice(0, 4).map((src, i) => <button key={i} type="button" aria-label={`Vue ${i + 1}`} aria-pressed={view === i} onClick={() => setView(i)}><img loading="lazy" decoding="async" width="30" height="32" src={src} alt="" /><span>Vue {i + 1}</span></button>)}
    </div>}
  </div>
}

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name === 'search' ? <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></> : name === 'bag' ? <><path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></> : name === 'heart' ? <path d="m20.8 4.6 0 0a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/> : name === 'user' ? <><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></> : name === 'truck' ? <><path d="M2 5h12v12H2zM14 9h4l4 4v4h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></> : name === 'return' ? <><path d="M4 10a8 8 0 1 1 1 9M4 4v6h6"/></> : name === 'lock' ? <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/></> : name === 'close' ? <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></> : name === 'maximize' ? <><path d="M15 3h6v6m0-6L14 10M9 21H3v-6m0 6 7-7"/></> : name === 'arrowLeft' ? <path d="M20 12H4m6-6-6 6 6 6"/> : name === 'arrowRight' ? <path d="M4 12h16m-6-6 6 6-6 6"/> : name === 'plus' ? <path d="M12 5v14m-7-7h14"/> : name === 'share' ? <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></> : <path d="M4 12h16m-6-6 6 6-6 6"/>}</svg>
}

type ActiveView = 'home' | 'tracking' | 'about' | 'privacy' | 'cgv'

function parseHashView(hash: string): ActiveView {
  const h = hash.replace(/^#/, '').toLowerCase().trim()
  if (h === 'suivi-commande' || h === 'tracking' || h === 'suivre-ma-commande') return 'tracking'
  if (h === 'a-propos' || h === 'about' || h === 'apropos') return 'about'
  if (h === 'politique-de-confidentialite' || h === 'privacy' || h === 'confidentialite') return 'privacy'
  if (h === 'cgv' || h === 'conditions-generales' || h === 'conditions-generales-de-vente') return 'cgv'
  return 'home'
}

export default function App() {
  const { products, categories, loading } = useProducts()
  const [currentView, setCurrentView] = useState<ActiveView>(() => parseHashView(window.location.hash))
  const tracking = currentView === 'tracking'

  useEffect(() => {
    const onHashChange = () => {
      setCurrentView(parseHashView(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigateToView = useCallback((v: ActiveView) => {
    // Sécurité : retirer inert du root si aucun modal n'est supposé être ouvert
    const rootEl = document.getElementById('root')
    if (rootEl && rootEl.inert) rootEl.inert = false
    document.body.style.overflow = ''

    setCurrentView(v)
    if (v === 'home') {
      if (window.location.hash) {
        try {
          history.pushState(null, '', window.location.pathname + window.location.search)
        } catch {
          window.location.hash = ''
        }
      }
    } else if (v === 'about') {
      if (window.location.hash !== '#a-propos') window.location.hash = '#a-propos'
    } else if (v === 'privacy') {
      if (window.location.hash !== '#politique-de-confidentialite') window.location.hash = '#politique-de-confidentialite'
    } else if (v === 'cgv') {
      if (window.location.hash !== '#cgv') window.location.hash = '#cgv'
    } else if (v === 'tracking') {
      if (window.location.hash !== '#suivi-commande') window.location.hash = '#suivi-commande'
    }

    // Scroll immédiat et sécurisé en haut de page pour éviter tout atterrissage sur le footer
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    })
  }, [])

  // Garantie que tout changement de vue (via menu, retour ou hash) place l'utilisateur en haut de page
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    const t1 = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }, 15)
    const t2 = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }, 80)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [currentView])
  const [filter, setFilter] = useState('')

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem('gd_favorites')
      return s ? JSON.parse(s) : []
    } catch { return [] }
  })
  useEffect(() => {
    try { localStorage.setItem('gd_favorites', JSON.stringify(favorites)) } catch {}
  }, [favorites])

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const savedCart = localStorage.getItem('gd_cart')
      return savedCart ? JSON.parse(savedCart) : []
    } catch {
      return []
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('gd_cart', JSON.stringify(cart))
    } catch {}
  }, [cart])

  const [pendingOrder, setPendingOrder] = useState<PendingPaymentInfo | null>(null)

  // ── DÉTECTION HORS-LIGNE (PWA & RÉSILIENCE RÉSEAU TOGO) ──
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // ── GESTION DU THÈME (CLAIR / SOMBRE HOSPITALIER) ──
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('gd_theme')
      if (saved === 'dark' || saved === 'light') return saved
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    try { localStorage.setItem('gd_theme', theme) } catch {}
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else {
      root.classList.add('light')
      root.classList.remove('dark')
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  // ── RESTAURATION ET SAUVEGARDE DE LA POSITION AU RECHARGEMENT DU SITE ──
  const restoredScrollRef = useRef(false)
  useEffect(() => {
    let scrollTimer: number | null = null
    const handleScroll = () => {
      if (scrollTimer) return
      scrollTimer = window.setTimeout(() => {
        scrollTimer = null
        if (!window.location.hash || window.location.hash === '#') {
          sessionStorage.setItem('gd_scroll_position', String(Math.round(window.scrollY)))
        }
      }, 100)
    }
    const handleBeforeUnload = () => {
      if (!window.location.hash || window.location.hash === '#') {
        sessionStorage.setItem('gd_scroll_position', String(Math.round(window.scrollY)))
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (scrollTimer) window.clearTimeout(scrollTimer)
    }
  }, [])

  useEffect(() => {
    if (loading || products.length === 0 || restoredScrollRef.current) return
    if (window.location.hash && window.location.hash !== '#') return

    const saved = sessionStorage.getItem('gd_scroll_position')
    if (saved) {
      const targetY = parseInt(saved, 10)
      if (targetY > 0) {
        restoredScrollRef.current = true
        if ('scrollRestoration' in history) {
          try { history.scrollRestoration = 'manual' } catch {}
        }
        requestAnimationFrame(() => {
          window.scrollTo({ top: targetY, behavior: 'instant' })
          setTimeout(() => {
            window.scrollTo({ top: targetY, behavior: 'instant' })
          }, 120)
        })
      }
    }
  }, [loading, products.length])

  // ── ÉTAT FICHE DÉTAIL PRODUIT ──
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  const [detailImgIdx, setDetailImgIdx] = useState(0)
  const [isDetailImgLight, setIsDetailImgLight] = useState(true)
  const detailTouchStartX = useRef<number | null>(null)
  const detailTouchStartY = useRef<number | null>(null)
  const detailWheelThrottle = useRef(0)
  const detailDragStartX = useRef<number | null>(null)
  const detailSwipedTime = useRef(0)
  const detailImgRef = useRef<HTMLImageElement>(null)
  const thumbsRef = useRef<HTMLDivElement>(null)

  const handleOpenDetails = useCallback((product: Product, imgIdx = 0) => {
    setDetailProduct(product)
    setDetailImgIdx(imgIdx)
    setIsDetailImgLight(true)
  }, [])

  // ── OUVERTURE AUTOMATIQUE D'UN ARTICLE VIA LIEN DE PARTAGE (?product=...) ──
  useEffect(() => {
    if (products.length === 0) return
    try {
      const params = new URLSearchParams(window.location.search)
      const target = params.get('product') || params.get('p') || params.get('id') || params.get('article')
      if (!target) return

      const clean = decodeURIComponent(target).trim()
      const rawNum = clean.replace(/^(C2-|PB-)/i, '')
      const found = products.find(p =>
        p.id === clean ||
        p.id.toLowerCase() === clean.toLowerCase() ||
        p.id.replace(/^(C2-|PB-)/i, '') === rawNum ||
        p.name.toLowerCase().includes(clean.toLowerCase())
      )

      if (found) {
        handleOpenDetails(found)
        setCurrentView('home')
        const cleanUrl = window.location.pathname + (window.location.hash || '')
        window.history.replaceState({}, '', cleanUrl)
      }
    } catch {
      // Ignorer les erreurs d'URL invalide
    }
  }, [products, handleOpenDetails])

  // Titre d'onglet dynamique quand un article est ouvert
  useEffect(() => {
    if (!detailProduct) return
    const prevTitle = document.title
    document.title = `${detailProduct.name} | GoodDoctor's Shop`
    return () => {
      document.title = prevTitle
    }
  }, [detailProduct])

  const handleDetailWheel = useCallback((e: React.WheelEvent) => {
    if (!detailProduct || detailProduct.images.length <= 1) return
    const now = Date.now()
    if (now - detailWheelThrottle.current < 250) return
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (Math.abs(delta) > 15) {
      detailWheelThrottle.current = now
      const tot = detailProduct.images.length
      if (delta > 0) setDetailImgIdx(prev => (prev + 1) % tot)
      else setDetailImgIdx(prev => (prev - 1 + tot) % tot)
    }
  }, [detailProduct])

  const handleDetailMouseDown = (e: React.MouseEvent) => {
    detailDragStartX.current = e.clientX
  }
  const handleDetailMouseUp = (e: React.MouseEvent) => {
    if (detailDragStartX.current === null || !detailProduct) return
    const dx = e.clientX - detailDragStartX.current
    detailDragStartX.current = null
    const tot = detailProduct.images.length
    if (Math.abs(dx) > 30 && tot > 1) {
      detailSwipedTime.current = Date.now()
      if (dx < 0) setDetailImgIdx(prev => (prev + 1) % tot)
      else setDetailImgIdx(prev => (prev - 1 + tot) % tot)
    }
  }

  const handleDetailTouchStart = (e: React.TouchEvent) => {
    if (e.touches?.[0]) {
      detailTouchStartX.current = e.touches[0].clientX
      detailTouchStartY.current = e.touches[0].clientY
    }
  }

  const handleDetailTouchMove = (e: React.TouchEvent) => {
    if (detailTouchStartX.current === null || !e.touches?.[0] || !detailProduct || detailProduct.images.length <= 1) return
    const dx = e.touches[0].clientX - detailTouchStartX.current
    const dy = e.touches[0].clientY - (detailTouchStartY.current || 0)
    // Swipe horizontal prioritaire : empêche le scroll vertical du drawer pendant le swipe
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      if (e.cancelable) e.preventDefault()
    }
  }

  const handleDetailTouchEnd = (e: React.TouchEvent) => {
    if (detailTouchStartX.current === null || !e.changedTouches?.[0] || !detailProduct) {
      detailTouchStartX.current = null
      detailTouchStartY.current = null
      return
    }
    const dx = e.changedTouches[0].clientX - detailTouchStartX.current
    const dy = e.changedTouches[0].clientY - (detailTouchStartY.current || 0)
    detailTouchStartX.current = null
    detailTouchStartY.current = null
    const tot = detailProduct.images.length
    if (Math.abs(dx) > 25 && Math.abs(dx) > Math.abs(dy) && tot > 1) {
      detailSwipedTime.current = Date.now()
      if (dx < 0) {
        setDetailImgIdx(prev => (prev + 1) % tot)
      } else {
        setDetailImgIdx(prev => (prev - 1 + tot) % tot)
      }
    }
  }

  const handleDetailTouchCancel = () => {
    detailTouchStartX.current = null
    detailTouchStartY.current = null
  }

  // Auto-scroll miniature active dans le bandeau
  useEffect(() => {
    if (!thumbsRef.current) return
    const activeThumb = thumbsRef.current.querySelector<HTMLElement>('.detail-thumb.active')
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [detailImgIdx])

  useEffect(() => {
    if (detailImgRef.current && detailImgRef.current.complete && detailImgRef.current.naturalWidth > 0) {
      checkImgBrightness(detailImgRef.current, setIsDetailImgLight)
    }
  }, [detailImgIdx, detailProduct])

  // ── ÉTAT LIGHTBOX PLEIN ÉCRAN ──
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number; title?: string } | null>(null)
  const [isLightboxImgLight, setIsLightboxImgLight] = useState(true)
  const lbTouchStartX = useRef<number | null>(null)
  const lbTouchStartY = useRef<number | null>(null)
  const lbWheelThrottle = useRef(0)
  const lbDragStartX = useRef<number | null>(null)
  const lbSwipedTime = useRef(0)
  const lightboxImgRef = useRef<HTMLImageElement>(null)

  const handleOpenLightbox = useCallback((images: string[], index = 0, title?: string) => {
    if (!images || images.length === 0) return
    setLightbox({ images, index: Math.min(Math.max(0, index), images.length - 1), title })
    setIsLightboxImgLight(true)
  }, [])

  const closeLightbox = useCallback(() => setLightbox(null), [])

  const nextLightbox = useCallback(() => {
    setLightbox(prev => (prev && prev.images.length > 1 ? { ...prev, index: (prev.index + 1) % prev.images.length } : prev))
  }, [])

  const prevLightbox = useCallback(() => {
    setLightbox(prev =>
      prev && prev.images.length > 1
        ? { ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length }
        : prev
    )
  }, [])

  const handleLightboxWheel = useCallback((e: React.WheelEvent) => {
    if (!lightbox || lightbox.images.length <= 1) return
    const now = Date.now()
    if (now - lbWheelThrottle.current < 250) return
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (Math.abs(delta) > 15) {
      lbWheelThrottle.current = now
      if (delta > 0) nextLightbox()
      else prevLightbox()
    }
  }, [lightbox, nextLightbox, prevLightbox])

  const handleLightboxMouseDown = (e: React.MouseEvent) => {
    lbDragStartX.current = e.clientX
  }
  const handleLightboxMouseUp = (e: React.MouseEvent) => {
    if (lbDragStartX.current === null || !lightbox) return
    const dx = e.clientX - lbDragStartX.current
    lbDragStartX.current = null
    if (Math.abs(dx) > 30 && lightbox.images.length > 1) {
      lbSwipedTime.current = Date.now()
      if (dx < 0) nextLightbox()
      else prevLightbox()
    }
  }

  const handleLightboxTouchStart = (e: React.TouchEvent) => {
    if (e.touches?.[0]) {
      lbTouchStartX.current = e.touches[0].clientX
      lbTouchStartY.current = e.touches[0].clientY
    }
  }

  const handleLightboxTouchMove = (e: React.TouchEvent) => {
    if (lbTouchStartX.current === null || !e.touches?.[0] || !lightbox || lightbox.images.length <= 1) return
    const dx = e.touches[0].clientX - lbTouchStartX.current
    const dy = e.touches[0].clientY - (lbTouchStartY.current || 0)
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      if (e.cancelable) e.preventDefault()
    }
  }

  const handleLightboxTouchEnd = (e: React.TouchEvent) => {
    if (lbTouchStartX.current === null || !e.changedTouches?.[0] || !lightbox) {
      lbTouchStartX.current = null
      lbTouchStartY.current = null
      return
    }
    const dx = e.changedTouches[0].clientX - lbTouchStartX.current
    const dy = e.changedTouches[0].clientY - (lbTouchStartY.current || 0)
    lbTouchStartX.current = null
    lbTouchStartY.current = null
    if (Math.abs(dx) > 25 && Math.abs(dx) > Math.abs(dy) && lightbox.images.length > 1) {
      lbSwipedTime.current = Date.now()
      if (dx < 0) nextLightbox()
      else prevLightbox()
    }
  }

  const handleLightboxTouchCancel = () => {
    lbTouchStartX.current = null
    lbTouchStartY.current = null
  }

  useEffect(() => {
    if (lightboxImgRef.current && lightboxImgRef.current.complete && lightboxImgRef.current.naturalWidth > 0) {
      checkImgBrightness(lightboxImgRef.current, setIsLightboxImgLight)
    }
  }, [lightbox?.index])

  // Clavier pour Lightbox et Fiche Détail
  useEffect(() => {
    if (!lightbox && !detailProduct) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (lightbox) {
        if (event.key === 'Escape') closeLightbox()
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === ' ') nextLightbox()
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') prevLightbox()
        return
      }
      if (detailProduct) {
        if (event.key === 'Escape') {
          setDetailProduct(null)
          return
        }
        const tot = detailProduct.images.length
        if (tot > 1) {
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') setDetailImgIdx(prev => (prev + 1) % tot)
          if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') setDetailImgIdx(prev => (prev - 1 + tot) % tot)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightbox, detailProduct, closeLightbox, nextLightbox, prevLightbox])

  // Verrouillage du scroll quand lightbox ouvert
  useEffect(() => {
    if (lightbox) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [lightbox])

  const addToCart = (product: Product) => {
    const colors = product.colorsList
    const defaultColor = colors[0] || 'Standard'
    const sizes = getAvailableSizesForColor(product, defaultColor)
    setCart(items => [...items, {
      productId: product.id,
      size: sizes.includes('M') ? 'M' : sizes[0] || 'Unique',
      color: defaultColor,
      quantity: 1,
      confirmed: false,
    }])
    setPanel('cart')
  }

  const updateCartItem = (index: number, changes: Partial<CartItem>) => {
    setCart(items => items.map((item, i) => {
      if (i !== index) return item
      const p = products.find(p => p.id === item.productId)
      if (!p) return item
      const next = { ...item, confirmed: false, ...changes, productId: item.productId }
      const allowedSizes = getAvailableSizesForColor(p, next.color)
      if (allowedSizes.length > 0 && !allowedSizes.includes(next.size)) {
        next.size = allowedSizes.includes('M') ? 'M' : allowedSizes[0]
      }
      if (!Number.isInteger(next.quantity) || next.quantity < 1 || next.quantity > 99) return item
      return next
    }))
  }

  const [lastRemovedItem, setLastRemovedItem] = useState<{ item: CartItem; index: number; name: string } | null>(null)
  const undoTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
    }
  }, [])

  const handleRemoveCartItem = useCallback((index: number) => {
    const itemToRemove = cart[index]
    if (!itemToRemove) return
    const p = products.find(prod => prod.id === itemToRemove.productId)
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
    setLastRemovedItem({ item: itemToRemove, index, name: p?.name || 'Article' })
    setCart(items => items.filter((_, j) => j !== index))
    undoTimeoutRef.current = window.setTimeout(() => {
      setLastRemovedItem(null)
    }, 6000)
  }, [cart, products])

  const handleUndoRemove = useCallback(() => {
    if (!lastRemovedItem) return
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
    setCart(items => {
      const next = [...items]
      const insertIdx = Math.min(lastRemovedItem.index, next.length)
      next.splice(insertIdx, 0, lastRemovedItem.item)
      return next
    })
    setLastRemovedItem(null)
  }, [lastRemovedItem])

  const [panel, setPanel] = useState('')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const hasScrolledSearchRef = useRef(false)
  const [subscribed, setSubscribed] = useState(false)
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterLoading, setNewsletterLoading] = useState(false)
  const [newsletterMessage, setNewsletterMessage] = useState<{ text: string; isError?: boolean } | null>(null)
  const [catalog, setCatalog] = useState(false)
  const [sort, setSort] = useState('featured')
  const [visibleCount, setVisibleCount] = useState(() => (!filter || filter === 'Tout' ? Infinity : 5))

  useEffect(() => {
    setVisibleCount(!filter || filter === 'Tout' ? Infinity : 5)
  }, [filter, deferredSearch, panel, sort, catalog])

  useEffect(() => {
    if (panel === 'search') {
      hasScrolledSearchRef.current = false
      requestAnimationFrame(() => {
        searchInputRef.current?.focus({ preventScroll: true })
      })
    }
  }, [panel])

  // Détection du retour depuis le portail de paiement CashPay (/success ou bfcache)
  useEffect(() => {
    const checkReturnFromCashPay = (fromBfCache = false) => {
      try {
        const raw = localStorage.getItem('pendingPayment')
        if (!raw) return
        const parsed = JSON.parse(raw) as PendingPaymentInfo
        if (parsed._expires && Date.now() > parsed._expires) {
          localStorage.removeItem('pendingPayment')
          return
        }
        const path = window.location.pathname.replace(/\/+$/, '')
        const isSuccessRoute = path === '/success' || window.location.hash === '#success'
        if (isSuccessRoute || fromBfCache) {
          setPendingOrder(parsed)
          setPanel('checkout')
          if (path === '/success') {
            window.history.replaceState({}, '', '/')
          }
        }
      } catch {
        try {
          localStorage.removeItem('pendingPayment')
        } catch {}
      }
    }

    checkReturnFromCashPay(false)

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        checkReturnFromCashPay(true)
      }
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  const subtotal = cart.reduce((sum, item) => {
    const p = products.find(p => p.id === item.productId)
    return sum + (p ? resolveVariantPrice(p, item.size, item.color) * item.quantity : 0)
  }, 0)

  const scrollToSelection = useCallback(() => {
    const doScroll = () => {
      const el = document.getElementById('selection')
      if (!el) return false
      const headerOffset = 85
      const rect = el.getBoundingClientRect()
      const targetPos = Math.max(0, rect.top + window.pageYOffset - headerOffset)
      window.scrollTo({
        top: targetPos,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
      return true
    }
    requestAnimationFrame(() => {
      if (!doScroll()) {
        setTimeout(doScroll, 40)
        setTimeout(doScroll, 120)
      }
    })
  }, [])

  const go = useCallback((category = 'Tout') => {
    setFilter(category)
    if (currentView !== 'home') {
      navigateToView('home')
      setTimeout(() => {
        scrollToSelection()
      }, 70)
    } else {
      scrollToSelection()
    }
  }, [currentView, navigateToView, scrollToSelection])

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimeoutRef = useRef<number | null>(null)

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToastMessage(msg)
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null)
      toastTimeoutRef.current = null
    }, 2800)
  }, [])

  const handleShare = useCallback((product: Product) => {
    const origin = window.location.origin
    const shareUrl = `${origin}/p/${encodeURIComponent(product.id)}`
    const priceStr = product.price > 0 ? ` — ${formatPriceRange(product.price, product.maxPrice)}` : ''
    const shareText = `${product.name} — Certifié disponible sur GoodDoctor's Shop${priceStr}`
    const fullMessage = `${shareText}\n${shareUrl}`

    if (navigator.share) {
      navigator.share({
        title: `${product.name} | GoodDoctor's Shop`,
        text: shareText,
        url: shareUrl,
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          navigator.clipboard?.writeText(fullMessage)
          showToast("Lien de l'article copié !")
        }
      })
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(fullMessage)
      showToast("Lien de l'article copié !")
    } else {
      showToast("Lien de l'article prêt")
    }
  }, [showToast])

  const shown = useMemo(() => {
    const normalize = (str: string) =>
      str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const q = normalize(deferredSearch.trim())
    return products
      .filter(p => p.price > 0)
      .filter(p => {
        const matchesCat = !filter
          ? (q || panel === 'favorites' ? true : p.isFeatured)
          : filter === 'Tout' || p.category === filter
        const matchesQuery =
          !q ||
          normalize(p.name).includes(q) ||
          normalize(p.category).includes(q) ||
          normalize(p.description || '').includes(q)
        const matchesFav = panel !== 'favorites' || favorites.includes(p.id)
        return matchesCat && matchesQuery && matchesFav
      })
      .sort((a, b) => sort === 'ascending' ? a.price - b.price : sort === 'descending' ? b.price - a.price : (a.isFeatured === b.isFeatured ? 0 : a.isFeatured ? -1 : 1))
  }, [products, filter, deferredSearch, panel, favorites, sort])

  const filterCategories = useMemo(() => {
    return categories.filter(c => c === 'Tout' || products.some(p => p.category === c && p.price > 0))
  }, [categories, products])

  return <div>
    <a className="skip-link" href="#main-content">Aller au contenu</a>
    <div className="sticky-header">
      {isOffline && (
        <div className="offline-banner" role="status" aria-live="polite">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <span>Mode hors-ligne · Catalogue enregistré disponible</span>
        </div>
      )}
      <div className="announcement">LIVRAISON EXPRESS DISPONIBLE</div>
    <header className="header">
      <a href="#" className="logo shop-logo" aria-label="GoodDoctor's Shop accueil" onClick={(e) => { e.preventDefault(); setFilter(''); navigateToView('home'); }}>
        <img src="/logo.webp" alt="Logo GoodDoctor's Shop" className="header-logo" width="36" height="36" />
        GoodDoctor's <span className="shop-word">Shop</span>
      </a>
      <nav>
        <button
          type="button"
          className={currentView === 'home' ? 'active' : ''}
          onClick={() => { setCatalog(true); setSearch(''); setPanel(''); go('Tout'); }}
        >
          Catalogue
        </button>
        <button
          type="button"
          className={currentView === 'tracking' ? 'active' : ''}
          onClick={() => { setPanel(''); setDetailProduct(null); navigateToView('tracking'); }}
        >
          Suivre ma commande
        </button>
        <div className="nav-about-group">
          <button
            type="button"
            className={currentView === 'about' ? 'active' : ''}
            onClick={() => { setPanel(''); setDetailProduct(null); navigateToView('about'); }}
          >
            À Propos
          </button>
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? "Basculer vers le thème clair" : "Basculer vers le thème sombre"}
            title={theme === 'dark' ? "Activer le thème clair" : "Activer le thème sombre"}
          >
            {theme === 'dark' ? (
              <svg
                className="theme-svg-icon"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4.25" fill="currentColor" fillOpacity="0.2" />
                <path d="M12 2v2.2M12 19.8v2.2M4.93 4.93l1.56 1.56M17.51 17.51l1.56 1.56M2 12h2.2M19.8 12h2.2M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" />
              </svg>
            ) : (
              <svg
                className="theme-svg-icon"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path
                  d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
                  fill="currentColor"
                  fillOpacity="0.14"
                />
                <path d="M19 2.5v3M20.5 4h-3" strokeWidth="1.5" />
              </svg>
            )}
          </button>
        </div>
      </nav>
      <div className="header-actions">
        <button
          type="button"
          aria-label="Rechercher"
          aria-expanded={panel === 'search'}
          className={`header-search-btn ${panel === 'search' ? 'active' : ''}`}
          onClick={() => setPanel(panel === 'search' ? '' : 'search')}
        >
          <Icon name="search"/>
        </button>
        <button
          type="button"
          aria-label={favorites.length > 0 ? `Favoris (${favorites.length})` : "Favoris"}
          className={`favorites-header-btn ${panel === 'favorites' ? 'active' : ''} ${favorites.length > 0 ? 'has-favorites' : ''}`}
          onClick={() => { setPanel(panel === 'favorites' ? '' : 'favorites'); go(); }}
        >
          <span className="fav-icon-wrap">
            <Icon name="heart"/>
            {favorites.length > 0 && <span className="fav-counter">{favorites.length}</span>}
          </span>
        </button>
        <button aria-label="Ouvrir le panier" className="cart-button" onClick={() => setPanel('cart')}><Icon name="bag"/><span aria-live="polite" aria-atomic="true">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span></button>
      </div>
    </header>
    {panel === 'search' && (
      <div className="searchbar" role="search">
        <div className="searchbar-field">
          <span className="searchbar-icon" aria-hidden="true">
            <Icon name="search" size={17} />
          </span>
          <input
            ref={searchInputRef}
            id="catalog-search-input"
            name="catalog_search"
            aria-label="Rechercher dans le catalogue"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={120}
            placeholder="Rechercher un uniforme, un dispositif, un accessoire…"
            value={search}
            onChange={e => {
              const val = e.target.value
              setSearch(val)
              if (currentView !== 'home') {
                navigateToView('home')
              }
              if (val.trim().length > 0 && filter !== 'Tout') {
                setFilter('Tout')
              }
              if (val.trim().length > 0 && !hasScrolledSearchRef.current) {
                hasScrolledSearchRef.current = true
                const sel = document.getElementById('selection')
                if (sel) {
                  const rect = sel.getBoundingClientRect()
                  if (rect.top > window.innerHeight * 0.55 || rect.bottom < 0) {
                    scrollToSelection()
                  }
                }
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.currentTarget.blur()
                scrollToSelection()
              } else if (e.key === 'Escape') {
                setSearch('')
                setPanel('')
              }
            }}
          />
          {search.trim().length > 0 && (
            <button
              type="button"
              className="searchbar-count"
              onClick={() => {
                searchInputRef.current?.blur()
                scrollToSelection()
              }}
              title="Voir les résultats"
            >
              {shown.length} résultat{shown.length > 1 ? 's' : ''}
            </button>
          )}
          {search.length > 0 && (
            <button
              type="button"
              className="searchbar-clear"
              aria-label="Effacer la recherche"
              onClick={() => {
                setSearch('')
                searchInputRef.current?.focus({ preventScroll: true })
              }}
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="button"
          className="searchbar-close"
          onClick={() => {
            setSearch('')
            setPanel('')
          }}
        >
          Fermer
        </button>
      </div>
    )}
    </div>
    <main id="main-content" tabIndex={-1}>
      {currentView === 'tracking' && <Suspense fallback={null}><OrderTracking products={products} onBack={() => navigateToView('home')} /></Suspense>}
      {currentView === 'about' && <Suspense fallback={null}><About onBack={() => navigateToView('home')} /></Suspense>}
      {currentView === 'privacy' && <Suspense fallback={null}><Privacy onBack={() => navigateToView('home')} /></Suspense>}
      {currentView === 'cgv' && <Suspense fallback={null}><Cgv onBack={() => navigateToView('home')} /></Suspense>}
      <div hidden={currentView !== 'home'}>
      <section className="hero">
        <picture className="hero-picture">
          <source media="(min-width: 641px)" srcSet={photos.heroDesktop} />
          <img className="hero-photo" src={photos.hero} alt="Équipements et matériel médical GoodDoctor's Shop" fetchPriority="high" />
        </picture>
        {/* MedicalNeuralCanvas: masqué par CSS à toutes les tailles, rendu conditionnel supprimé pour perf */}
        <div className="hero-shade"/>
        <div className="hero-content"><h1>L'empreinte<br/>de la Qualité.</h1><p>Uniformes, dispositifs et accessoires médicaux.<br/>Pour tous les professionnels de santé.</p><div className="hero-cta"><button className="primary" onClick={() => go()}>Découvrir le catalogue <Icon name="arrow"/></button><a className="tracking-link" href="#suivi-commande" onClick={(e) => { e.preventDefault(); setPanel(''); setDetailProduct(null); navigateToView('tracking'); }}><Icon name="truck" size={19}/>Suivre ma commande</a></div></div>
        <div className="hero-bottom"><button className="ml-auto" aria-label="Découvrir nos gammes" onClick={() => go()}>↓</button></div>
        <div className="hero-sticker">PROMO<br/><b>EXCLUSIF</b></div>
      </section>
      <section className="benefits benefits-trio">
        <div>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z"/>
            <path d="m8 12 3 3 5-6"/>
          </svg>
          <p><b>Articles</b><span>Certifiés</span></p>
        </div>
        <div>
          <Icon name="truck"/>
          <p><b>Livraison</b><span>24-48h</span></p>
        </div>
        <div>
          <Icon name="heart"/>
          <p><b>Satisfaction</b><span>Garantie</span></p>
        </div>
      </section>

      {/* ── PARTENAIRES MÉDICAUX MARQUEE (comme sur l'ancien site) ── */}
      <section className="brands-marquee" aria-label="Nos partenaires médicaux officiels">
        <div className="brands-header">
          <div className="brands-title-row">
            <div className="brands-line"></div>
            <p className="brands-eyebrow">
              <svg className="brands-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>Nos marques partenaires</span>
            </p>
            <div className="brands-line"></div>
          </div>
          <p className="brands-subtitle">Des marques de référence mondiale, disponibles chez nous</p>
        </div>
        <div className="marquee-track">
          {[0, 1].map(i => (
            <div className="marquee-content" key={i} aria-hidden={i > 0 ? 'true' : undefined}>
              {MEDICAL_PARTNERS.map((partner, pIdx) => (
                <span key={`${partner.alt}-${pIdx}`} className="brand-logo">
                  <img
                    src={partner.src}
                    alt={partner.alt}
                    loading="lazy"
                    decoding="async"
                    style={partner.scale ? { transform: `scale(${partner.scale})` } : undefined}
                  />
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>
      <section className="section selection" id="selection"><div className="section-title"><div><h2>{panel === 'favorites' ? 'Vos équipements favoris.' : catalog ? 'Notre catalogue médical.' : 'Notre sélection pour les soignants.'}</h2></div><button className="text-link" onClick={() => { setPanel('search'); requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true })) }}>Rechercher un article <Icon name="search" size={17}/></button></div><div className="filters" role="tablist" aria-label="Filtrer par catégorie">{filterCategories.map(f => <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>{f}</button>)}</div>{catalog && <div className="catalog-toolbar"><label htmlFor="catalog-sort-select">Trier par <select id="catalog-sort-select" name="catalog_sort" value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Notre sélection</option><option value="ascending">Prix croissant</option><option value="descending">Prix décroissant</option></select></label><button onClick={() => { setFilter(''); setSearch(''); setSort('featured') }}>Réinitialiser les filtres</button></div>}

      {loading ? <div className="product-grid" aria-busy="true" aria-label="Chargement du catalogue">
        {[1,2,3,4].map(i => <div className="skeleton-card" key={i}>
          <div className="skeleton-image" />
          <div className="skeleton-body">
            <div className="skeleton-line skeleton-line--short" />
            <div className="skeleton-line" />
            <div className="skeleton-line skeleton-line--medium" />
          </div>
        </div>)}
      </div> : <>
      <div className="product-grid" aria-live="polite">{(filter === 'Tout' || !filter ? shown : shown.slice(0, visibleCount)).map((p, idx) => <article className="product modern-card" key={p.id} data-product-name={p.name}>
        <div className="product-image"><ProductGallery images={p.images} name={p.name} onOpenLightbox={handleOpenLightbox} objectPosition={getProductObjectPosition(p.name)} priority={idx < 2}/>{p.promoBadge && <span className="badge promo-badge">{p.promoBadge}</span>}{!p.inStock && <span className="badge out-of-stock-badge">Rupture</span>}{p.isFeatured && p.inStock && !p.promoBadge && <span className="badge">NOTRE SÉLECTION</span>}<button className={'favorite ' + (favorites.includes(p.id) ? 'liked' : '')} aria-label={`Favori : ${p.name}`} aria-pressed={favorites.includes(p.id)} onClick={() => setFavorites(items => items.includes(p.id) ? items.filter(id => id !== p.id) : [...items, p.id])}><Icon name="heart" size={18}/></button></div>
        <div className="card-body"><span className="card-category">{p.category}</span><div className="product-info"><h3>{p.name}</h3><div className="price-row-container"><div className="price-block">{p.originalPrice && <span className="original-price">{formatMoney(p.originalPrice)}</span>}<b className={p.promoBadge ? 'promo-price' : ''}>{formatPriceRange(p.price, p.maxPrice)}</b></div><button type="button" className="card-share-btn" aria-label={`Partager ${p.name}`} title="Partager cet article" onClick={(e) => { e.stopPropagation(); handleShare(p); }}><Icon name="share" size={15}/></button></div></div><div className="card-options">{p.colorsList.length > 0 && <span>{p.colorsList.length} coloris</span>}{p.sizesList.length > 0 && <span>{p.sizesList.length} tailles</span>}{!p.inStock && <span className="stock-out">Indisponible</span>}</div><div className="card-actions"><button className="card-details" onClick={() => handleOpenDetails(p)}>Détails</button><button className="card-add" disabled={!p.inStock} onClick={() => addToCart(p)}><Icon name="bag" size={15}/><span>{p.inStock ? 'Ajouter' : 'Indisponible'}</span></button></div></div>
      </article>)}</div>
      {filter && filter !== 'Tout' && visibleCount < shown.length && (
        <div className="load-more-container">
          <button
            type="button"
            className="load-more-btn"
            onClick={() => setVisibleCount(prev => prev + 5)}
          >
            <span className="load-more-icon-wrap" aria-hidden="true">
              <Icon name="plus" size={15} />
            </span>
            <span className="load-more-label">Charger plus d'articles</span>
          </button>
        </div>
      )}
      {shown.length === 0 && <p className="empty">Aucun équipement ne correspond à votre recherche. Explorez les autres catégories du catalogue.</p>}</>}
      </section>

      {/* ── COMMENT COMMANDER : 3 ÉTAPES CLAIRES ET RASSURANTES ── */}
      <section className="order-steps" aria-labelledby="order-steps-title">
        <div className="order-steps-container">
          <div className="section-title">
            <div>
              <h2 id="order-steps-title">Commander en toute simplicité.</h2>
            </div>
          </div>
          <div className="order-steps-grid">
            <div className="order-step-card">
              <span className="order-step-badge" aria-hidden="true">01</span>
              <h3>Choisissez vos articles</h3>
              <p>Sélectionnez vos uniformes et dispositifs médicaux certifiés avec vos variantes de tailles et de couleurs.</p>
            </div>
            <div className="order-step-card">
              <span className="order-step-badge" aria-hidden="true">02</span>
              <h3>Validez votre panier</h3>
              <p>Confirmez votre sélection en un instant. Réglez en toute sécurité via CashPay (Mixx by Yas, Moov Money) ou à la livraison.</p>
            </div>
            <div className="order-step-card">
              <span className="order-step-badge" aria-hidden="true">03</span>
              <h3>Livraison express à Lomé</h3>
              <p>Recevez vos équipements directement à votre clinique, cabinet médical ou à domicile sous 24 à 48 heures.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="newsletter">
        <div>
          <h2>Restez informés, équipez-vous mieux.</h2>
          <p>Nouveaux uniformes, dispositifs, accessoires et offres pour les professionnels de santé.</p>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const email = newsletterEmail.trim()
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
              setNewsletterMessage({ text: 'Veuillez saisir une adresse e-mail valide.', isError: true })
              return
            }

            setNewsletterLoading(true)
            setNewsletterMessage(null)

            try {
              const resp = await fetch('/api/newsletter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
              })
              const data = await resp.json()
              if (resp.ok && data?.success) {
                setNewsletterEmail('')
                setNewsletterMessage({ text: data.message || 'Merci ! Votre inscription a bien été prise en compte.' })
                setSubscribed(true)
              } else {
                setNewsletterMessage({ text: data?.error || "Erreur lors de l'enregistrement. Réessayez.", isError: true })
              }
            } catch {
              setNewsletterMessage({ text: 'Erreur réseau. Vérifiez votre connexion et réessayez.', isError: true })
            } finally {
              setNewsletterLoading(false)
            }
          }}
        >
          <div className="newsletter-field-wrap">
            <input
              id="newsletter-email-input"
              name="newsletter_email"
              autoComplete="email"
              maxLength={254}
              type="email"
              required
              aria-label="Votre adresse e-mail"
              placeholder="Votre adresse e-mail"
              value={newsletterEmail}
              onChange={(e) => {
                setNewsletterEmail(e.target.value)
                if (newsletterMessage) setNewsletterMessage(null)
              }}
              disabled={newsletterLoading}
            />
            <button
              type="submit"
              aria-label="S'inscrire à la newsletter"
              disabled={newsletterLoading || !newsletterEmail.trim()}
              className="newsletter-submit-btn"
            >
              {newsletterLoading ? (
                <span className="newsletter-spinner" aria-hidden="true" />
              ) : (
                <Icon name="arrow" />
              )}
            </button>
          </div>
          {newsletterMessage ? (
            <small
              role="alert"
              style={{
                color: newsletterMessage.isError ? 'var(--color-error, #dc2626)' : 'var(--color-success, #15803d)',
                fontWeight: 600,
                display: 'block',
                marginTop: '10px',
                fontSize: '12px',
              }}
            >
              {newsletterMessage.text}
            </small>
          ) : (
            <small>
              {subscribed ? (
                "Merci ! Votre inscription a bien été prise en compte."
              ) : (
                <>
                  En vous inscrivant, vous acceptez notre{' '}
                  <button
                    type="button"
                    className="inline-link"
                    onClick={() => { setPanel(''); setDetailProduct(null); navigateToView('privacy'); }}
                  >
                    politique de confidentialité
                  </button>.
                </>
              )}
            </small>
          )}
        </form>
      </section>
      </div>
    </main>
    <footer className="site-footer">
      <div className="footer-container">
        {/* Grille principale */}
        <div className="footer-grid">
          {/* Col 1 : Marque */}
          <div className="footer-col">
            <a className="logo shop-logo" href="#" onClick={(e) => { e.preventDefault(); setPanel(''); setDetailProduct(null); setFilter(''); navigateToView('home'); }}>
              <img src="/logo.webp" alt="Logo GoodDoctor's Shop" className="footer-logo-img" width="36" height="36" loading="lazy" />
              GoodDoctor's <span className="shop-word">Shop</span>
            </a>
            <p className="footer-brand-desc">
              <span className="brand-highlight">L'empreinte de la qualité</span>. La référence en Afrique pour des équipements médicaux certifiés.
            </p>
            <div className="footer-address">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>Siège social : Rue 206, AGP-Lomé, Togo</span>
            </div>
          </div>

          {/* Col 2 : Navigation rapide */}
          <div className="footer-col">
            <h5 className="footer-col-title">Navigation rapide</h5>
            <ul className="footer-links">
              <li>
                <button type="button" onClick={() => { setPanel(''); setDetailProduct(null); setFilter(''); navigateToView('home'); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  <span>Accueil</span>
                </button>
              </li>
              <li>
                <button type="button" onClick={() => { setPanel(''); setDetailProduct(null); navigateToView('tracking'); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span>Suivre ma commande</span>
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setPanel('cart')}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                  <span>Panier</span>
                </button>
              </li>
              <li>
                <button type="button" onClick={() => { setPanel(''); setDetailProduct(null); navigateToView('about'); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  <span>À propos</span>
                </button>
              </li>
              <li>
                <button type="button" onClick={() => { setPanel(''); setDetailProduct(null); navigateToView('privacy'); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span>Politique de confidentialité</span>
                </button>
              </li>
              <li>
                <button type="button" onClick={() => { setPanel(''); setDetailProduct(null); navigateToView('cgv'); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  <span>Conditions Générales de Vente (CGV)</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3 : Contact */}
          <div className="footer-col">
            <h5 className="footer-col-title">Contact</h5>
            <ul className="footer-links">
              <li>
                <a href="tel:+22892733939">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <span>+228 92 73 39 39</span>
                </a>
              </li>
              <li>
                <a href="mailto:gooddoctorshops@gmail.com">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <span>gooddoctorshops@gmail.com</span>
                </a>
              </li>
              <li>
                <a href="https://g.co/kgs/2btSkT9" target="_blank" rel="noopener noreferrer">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>Voir sur Google Maps</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4 : Réseaux */}
          <div className="footer-col">
            <h5 className="footer-col-title">Suivez-nous</h5>
            <div className="footer-socials">
              <a href="https://www.instagram.com/gooddoctors_shop?igsh=bTV0bjhtd2xja3Nw" target="_blank" rel="noopener noreferrer" aria-label="Suivez-nous sur Instagram">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
              <a href="https://www.facebook.com/share/1CSDKnLU8Z/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" aria-label="Suivez-nous sur Facebook">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-4h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a href="https://www.tiktok.com/@gooddoctors_shop?_t=ZM-90aGB4aQlq7&_r=1" target="_blank" rel="noopener noreferrer" aria-label="Suivez-nous sur TikTok">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
              </a>
              <a href="https://wa.me/22892733939" target="_blank" rel="noopener noreferrer" aria-label="Contactez-nous sur WhatsApp">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
              </a>
            </div>
            <p className="footer-socials-note">
              Retrouvez nos dernières offres et nouveautés sur nos plateformes.
            </p>
          </div>
        </div>

        {/* Copyright */}
        <div className="footer-bottom">
          <p className="footer-copy">
            &copy; 2026 GoodDoctor's Shop — Tous droits réservés.
          </p>
          <p className="footer-location">
            Lomé, Togo
          </p>
        </div>
      </div>
    </footer>

    {/* ── FICHE DÉTAIL PRODUIT ── */}
    {detailProduct && (
      <ModalShell label={detailProduct.name} onClose={() => setDetailProduct(null)}>
        <div className="detail-panel">
          {/* Header sticky avec bouton Fermer bien visible et accessible à tout moment */}
          <div className="detail-header-sticky">
            <span className="card-category" style={{ margin: 0 }}>{detailProduct.category}</span>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={() => setDetailProduct(null)}
              aria-label="Fermer la fiche produit"
              title="Fermer"
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          <h2 className="detail-title">{detailProduct.name}</h2>

          {/* Carrousel d'images avec swipe tactile, flèches, zoom et compteur */}
          {detailProduct.images.length > 0 ? (
            <div className="detail-images-section">
              <div
                className={`detail-carousel-container ${isDetailImgLight ? 'theme-light-bg' : 'theme-dark-bg'}`}
                onWheel={handleDetailWheel}
                onMouseDown={handleDetailMouseDown}
                onMouseUp={handleDetailMouseUp}
                onTouchStart={handleDetailTouchStart}
                onTouchMove={handleDetailTouchMove}
                onTouchEnd={handleDetailTouchEnd}
                onTouchCancel={handleDetailTouchCancel}
                style={{ cursor: detailProduct.images.length > 1 ? 'grab' : 'default' }}
              >
                <button
                  type="button"
                  className="detail-zoom-trigger"
                  onClick={() => handleOpenLightbox(detailProduct.images.map(img => img.url), detailImgIdx, detailProduct.name)}
                  aria-label="Agrandir en plein écran"
                  title="Agrandir en plein écran"
                >
                  <Icon name="maximize" size={17} />
                </button>

                {detailProduct.images.length > 1 && (
                  <button
                    type="button"
                    className="detail-nav-btn detail-nav-prev"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDetailImgIdx(prev => (prev - 1 + detailProduct.images.length) % detailProduct.images.length)
                    }}
                    aria-label="Photo précédente"
                    title="Photo précédente"
                  >
                    <Icon name="arrowLeft" size={18} />
                  </button>
                )}

                <img
                  ref={detailImgRef}
                  className="detail-carousel-img"
                  src={detailProduct.images[detailImgIdx]?.url || detailProduct.images[0]?.url || placeholder}
                  alt={`${detailProduct.name} - vue ${detailImgIdx + 1}`}
                  decoding="async"
                  draggable={false}
                  onLoad={e => checkImgBrightness(e.currentTarget, setIsDetailImgLight)}
                  onClick={(e) => {
                    if (Date.now() - detailSwipedTime.current < 400) {
                      e.stopPropagation()
                      return
                    }
                    handleOpenLightbox(detailProduct.images.map(img => img.url), detailImgIdx, detailProduct.name)
                  }}
                  title="Cliquer pour agrandir l'image"
                />

                {detailProduct.images.length > 1 && (
                  <button
                    type="button"
                    className="detail-nav-btn detail-nav-next"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDetailImgIdx(prev => (prev + 1) % detailProduct.images.length)
                    }}
                    aria-label="Photo suivante"
                    title="Photo suivante"
                  >
                    <Icon name="arrowRight" size={18} />
                  </button>
                )}

                {detailProduct.images.length > 1 && (
                  <div className="detail-badge-counter">
                    {detailImgIdx + 1} / {detailProduct.images.length}
                  </div>
                )}
              </div>

              {detailProduct.images.length > 1 && (
                <div ref={thumbsRef} className="detail-thumbs" role="tablist" aria-label="Miniatures photos">
                  {detailProduct.images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      role="tab"
                      aria-selected={i === detailImgIdx}
                      className={`detail-thumb ${i === detailImgIdx ? 'active' : ''}`}
                      onClick={() => setDetailImgIdx(i)}
                      aria-label={`Afficher la photo ${i + 1}`}
                    >
                      <img src={img.url} alt={`${detailProduct.name} vue ${i + 1}`} loading="lazy" decoding="async" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="detail-carousel-container">
              <img className="detail-carousel-img" src={placeholder} alt={detailProduct.name} />
            </div>
          )}

          <div className="detail-price-wrapper">
            <div className="detail-price-row">
              {detailProduct.originalPrice && <span className="original-price">{formatMoney(detailProduct.originalPrice)}</span>}
              <b className={detailProduct.promoBadge ? 'promo-price' : ''}>{formatPriceRange(detailProduct.price, detailProduct.maxPrice)}</b>
              {detailProduct.promoBadge && <span className="badge promo-badge" style={{ position: 'static' }}>{detailProduct.promoBadge}</span>}
              {!detailProduct.inStock && <span className="badge out-of-stock-badge" style={{ position: 'static' }}>Rupture</span>}
            </div>
            <button
              type="button"
              className="card-share-btn detail-share-btn"
              aria-label={`Partager ${detailProduct.name}`}
              title="Partager cet article"
              onClick={() => handleShare(detailProduct)}
            >
              <Icon name="share" size={18} />
            </button>
          </div>

          <p className="detail-description">{detailProduct.description}</p>

          {(detailProduct.colorsList.length > 0 || detailProduct.sizesList.length > 0) && (() => {
            const byColor = detailProduct.sizesByColor
            const colorEntries = byColor ? Object.entries(byColor) : []
            const hasPerColorDiff =
              colorEntries.length > 1 &&
              colorEntries.some(([, sz]) => sz.join('|') !== colorEntries[0][1].join('|'))
            return (
              <div className="detail-variants">
                {detailProduct.colorsList.length > 0 && <div><b>Coloris :</b> {detailProduct.colorsList.join(', ')}</div>}
                {detailProduct.sizesList.length > 0 && (
                  <div>
                    <b>Tailles :</b>{' '}
                    {hasPerColorDiff
                      ? colorEntries.map(([col, sz]) => `${col} (${sz.join(', ')})`).join(' · ')
                      : detailProduct.sizesList.join(', ')}
                  </div>
                )}
              </div>
            )
          })()}

          <div className="detail-actions-bottom">
            <button
              className="primary detail-add-btn"
              disabled={!detailProduct.inStock}
              onClick={() => { addToCart(detailProduct); setDetailProduct(null) }}
            >
              {detailProduct.inStock ? 'Ajouter au panier' : 'Indisponible'} <Icon name="bag" size={17}/>
            </button>
            <button
              type="button"
              className="detail-close-secondary-btn"
              onClick={() => setDetailProduct(null)}
            >
              Fermer la fiche
            </button>
          </div>
        </div>
      </ModalShell>
    )}

    {/* ── LIGHTBOX PLEIN ÉCRAN (PORTAL VERS BODY POUR RESTER ACTIF MÊME SUR MOBILE ET DÉTAILS) ── */}
    {lightbox && createPortal(
      <div
        className={`image-lightbox ${isLightboxImgLight ? 'theme-light-bg' : 'theme-dark-bg'}`}
        role="dialog"
        aria-modal="true"
        aria-label="Aperçu agrandi de l'image"
        onClick={() => {
          if (Date.now() - lbSwipedTime.current < 400) return
          closeLightbox()
        }}
        onWheel={handleLightboxWheel}
        onMouseDown={handleLightboxMouseDown}
        onMouseUp={handleLightboxMouseUp}
        onTouchStart={handleLightboxTouchStart}
        onTouchMove={handleLightboxTouchMove}
        onTouchEnd={handleLightboxTouchEnd}
        onTouchCancel={handleLightboxTouchCancel}
      >
        <button
          type="button"
          className="lightbox-btn lightbox-close"
          onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
          aria-label="Fermer le plein écran"
          title="Fermer (Échap)"
        >
          <Icon name="close" size={22} />
        </button>

        {lightbox.images.length > 1 && (
          <button
            type="button"
            className="lightbox-btn lightbox-prev"
            onClick={e => { e.stopPropagation(); prevLightbox(); }}
            aria-label="Image précédente"
            title="Précédente (← ou glisser)"
          >
            <Icon name="arrowLeft" size={24} />
          </button>
        )}

        <div className="lightbox-content" onClick={e => e.stopPropagation()}>
          <img
            ref={lightboxImgRef}
            src={lightbox.images[lightbox.index]}
            alt={lightbox.title || "Photo du produit agrandie"}
            className="lightbox-img"
            decoding="async"
            draggable={false}
            onLoad={e => checkImgBrightness(e.currentTarget, setIsLightboxImgLight)}
            style={{ cursor: lightbox.images.length > 1 ? 'grab' : 'default' }}
          />
        </div>

        {lightbox.images.length > 1 && (
          <button
            type="button"
            className="lightbox-btn lightbox-next"
            onClick={e => { e.stopPropagation(); nextLightbox(); }}
            aria-label="Image suivante"
            title="Suivante (→ ou glisser)"
          >
            <Icon name="arrowRight" size={24} />
          </button>
        )}

        {lightbox.images.length > 1 && (
          <div className="lightbox-counter">
            <span>{lightbox.index + 1}</span> / <span>{lightbox.images.length}</span>
          </div>
        )}
      </div>,
      document.body
    )}

    {panel === 'checkout' && (cart.length > 0 || pendingOrder) && (
      <ModalShell
        label="Paiement"
        onClose={() => {
          setPendingOrder(null)
          setPanel(cart.length > 0 ? 'cart' : '')
        }}
      >
        <Suspense fallback={null}>
        <Checkout
          subtotal={subtotal}
          items={cart.map(item => {
            const p = products.find(pr => pr.id === item.productId)
            return {
              id: item.productId,
              name: p?.name || 'Article',
              quantity: item.quantity,
              price: p ? resolveVariantPrice(p, item.size, item.color) : 0,
              selectedColor: item.color || null,
              selectedSize: item.size || null,
            }
          })}
          initialPendingOrder={pendingOrder}
          onClearCart={() => setCart([])}
          onBack={() => {
            setPendingOrder(null)
            setPanel(cart.length > 0 ? 'cart' : '')
          }}
          onOpenLegal={(view) => {
            setPanel('')
            navigateToView(view)
          }}
        />
        </Suspense>
      </ModalShell>
    )}
    {panel === 'cart' && (
      <ModalShell label="Votre panier" onClose={() => setPanel('')}>
        <div className="drawer-heading">
          <h2>Votre panier ({cart.reduce((sum, item) => sum + item.quantity, 0)})</h2>
          <button onClick={() => setPanel('')} aria-label="Fermer">×</button>
        </div>

        {lastRemovedItem && (
          <div className="cart-undo-banner" role="status" aria-live="polite">
            <span className="cart-undo-text">« {lastRemovedItem.name} » retiré du panier.</span>
            <button type="button" onClick={handleUndoRemove} className="cart-undo-action">
              Annuler
            </button>
          </div>
        )}

        {cart.length ? (
          <>
            {cart.map((item, i) => {
              const p = products.find(p => p.id === item.productId)
              if (!p) return null
              const unitPrice = resolveVariantPrice(p, item.size, item.color)
              const availableSizes = getAvailableSizesForColor(p, item.color)
              return (
                <div className="cart-item" key={i}>
                  <img src={p.images[0]?.url || placeholder} alt={p.name} loading="lazy" decoding="async" />
                  <div className="cart-item-content">
                    <b>{p.name}</b>
                    <p>{formatMoney(unitPrice)} / pièce</p>
                    <div className="variant-fields">
                      <label htmlFor={`cart-size-${i}`}>
                        Taille/Format
                        <select
                          id={`cart-size-${i}`}
                          name={`cart_size_${i}`}
                          aria-label={`Format de ${p.name}, article ${i + 1}`}
                          value={item.size}
                          onChange={e => updateCartItem(i, { size: e.target.value })}
                        >
                          {(availableSizes.length > 0 ? availableSizes : ['Unique']).map(size => (
                            <option key={size}>{size}</option>
                          ))}
                        </select>
                      </label>
                      <label htmlFor={`cart-color-${i}`}>
                        Couleur
                        <select
                          id={`cart-color-${i}`}
                          name={`cart_color_${i}`}
                          aria-label={`Couleur de ${p.name}, article ${i + 1}`}
                          value={item.color}
                          onChange={e => updateCartItem(i, { color: e.target.value })}
                        >
                          {(p.colorsList.length > 0 ? p.colorsList : ['Standard']).map(color => (
                            <option key={color}>{color}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="cart-item-bottom">
                      <div className="quantity-control">
                        <button
                          aria-label={`Diminuer la quantité de ${p.name}`}
                          disabled={item.quantity === 1}
                          onClick={() => updateCartItem(i, { quantity: item.quantity - 1 })}
                        >
                          −
                        </button>
                        <output aria-live="polite">{item.quantity}</output>
                        <button
                          aria-label={`Augmenter la quantité de ${p.name}`}
                          disabled={item.quantity === 99}
                          onClick={() => updateCartItem(i, { quantity: item.quantity + 1 })}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="cart-remove-btn"
                        onClick={() => handleRemoveCartItem(i)}
                      >
                        Retirer
                      </button>
                      <b>{formatMoney(unitPrice * item.quantity)}</b>
                    </div>
                    <div className="variant-actions">
                      <button
                        className={item.confirmed ? 'variant-confirmed' : 'variant-confirm'}
                        onClick={() => updateCartItem(i, { confirmed: !item.confirmed })}
                      >
                        {item.confirmed ? 'Sélection validée · Modifier' : 'Valider cette sélection'}
                      </button>
                      {item.confirmed && (
                        <button
                          className="variant-add"
                          onClick={() => setCart(items => [...items, { ...item, quantity: 1, confirmed: false }])}
                        >
                          + Ajouter une autre variante
                        </button>
                      )}
                      <span className="variant-summary" role="status">
                        {item.confirmed
                          ? `${item.color} · ${item.size} · Quantité : ${item.quantity}`
                          : 'Choisissez le format, la couleur et la quantité, puis validez.'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
            <div className="total">
              <b>{cart.some(item => !item.confirmed) ? 'Total provisoire' : 'Total validé'}</b>
              <b>{formatMoney(subtotal)}</b>
            </div>
            <button
              className="primary checkout-button"
              disabled={cart.some(item => !item.confirmed)}
              onClick={() => { setPendingOrder(null); setPanel('checkout'); }}
            >
              Continuer vers le paiement
            </button>
            <p className="demo-note">
              {cart.some(item => !item.confirmed)
                ? 'Certaines sélections restent à valider.'
                : 'Toutes vos variantes sont validées.'}
            </p>
          </>
        ) : (
          <p className="empty">Votre panier est vide. Découvrez nos uniformes, dispositifs et accessoires médicaux.</p>
        )}
        <button className="primary" onClick={() => { setPanel(''); go() }}>
          Continuer mes achats <Icon name="arrow" />
        </button>
      </ModalShell>
    )}
    {toastMessage && (
      <div className="share-toast" role="status" aria-live="polite">
        <Icon name="share" size={16} />
        <span>{toastMessage}</span>
      </div>
    )}

    {/* Bouton WhatsApp flottant officiel */}
    <a
      href="https://wa.me/22892733939?text=Bonjour%20GoodDoctor%27s%20Shop%2C%20j%27ai%20une%20question%20concernant%20un%20article%20ou%20une%20commande."
      className="floating-whatsapp-btn"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactez GoodDoctor's Shop sur WhatsApp (+228 92 73 39 39)"
      title="Discuter avec nous sur WhatsApp"
    >
      <span className="floating-whatsapp-pulse" aria-hidden="true" />
      <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
      </svg>
      <span className="floating-whatsapp-tooltip">Besoin d'aide ? Écrivez-nous</span>
    </a>
  </div>
}
