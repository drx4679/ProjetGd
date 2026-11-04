import { useState, useEffect, useCallback } from 'react'
import { formatMoney } from './money'
import { sanitizeUserErrorMessage } from './errorSanitizer'
import {
  trackOrders,
  createOrder,
  getOrderStatus,
  type TrackedOrder,
} from './cashpay'
import type { Product } from './useProducts'

const COUNTRY_CODES = [
  { value: '+228', label: '🇹🇬 +228' },
  { value: '+229', label: '🇧🇯 +229' },
  { value: '+233', label: '🇬🇭 +233' },
  { value: '+234', label: '🇳🇬 +234' },
  { value: '+225', label: '🇨🇮 +225' },
  { value: '+226', label: '🇧🇫 +226' },
  { value: '+227', label: '🇳🇪 +227' },
  { value: '+221', label: '🇸🇳 +221' },
  { value: '+223', label: '🇲🇱 +223' },
  { value: '+241', label: '🇬🇦 +241' },
  { value: '+237', label: '🇨🇲 +237' },
  { value: '+242', label: '🇨🇬 +242' },
  { value: '+243', label: '🇨🇩 +243' },
  { value: '+33', label: '🇫🇷 +33' },
  { value: '+32', label: '🇧🇪 +32' },
  { value: '+41', label: '🇨🇭 +41' },
  { value: '+1', label: '🇺🇸 +1' },
]

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=300&q=80'

type StatusKey = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

const STATUS_CONFIG: Record<
  StatusKey,
  { label: string; badgeClass: string; stepIndex: number; desc: string }
> = {
  pending: {
    label: 'En attente',
    badgeClass: 'badge-pending',
    stepIndex: 0,
    desc: 'Votre commande a été reçue et est en cours de validation.',
  },
  confirmed: {
    label: 'Confirmée',
    badgeClass: 'badge-processing',
    stepIndex: 1,
    desc: 'Paiement et commande confirmés. Préparation imminente.',
  },
  processing: {
    label: 'En préparation',
    badgeClass: 'badge-processing',
    stepIndex: 1,
    desc: 'Vos articles médicaux sont en cours de conditionnement.',
  },
  shipped: {
    label: 'Expédiée',
    badgeClass: 'badge-shipped',
    stepIndex: 2,
    desc: 'Votre colis est en cours de livraison.',
  },
  delivered: {
    label: 'Livrée',
    badgeClass: 'badge-delivered',
    stepIndex: 3,
    desc: 'Colis remis en main propre. Merci pour votre confiance.',
  },
  cancelled: {
    label: 'Annulée',
    badgeClass: 'badge-cancelled',
    stepIndex: -1,
    desc: 'Cette commande a été annulée.',
  },
}

const TIMELINE_STEPS = [
  { title: 'Reçue', subtitle: 'Enregistrée' },
  { title: 'Préparation', subtitle: 'Contrôle' },
  { title: 'Expédition', subtitle: 'En route' },
  { title: 'Livrée', subtitle: 'Remis' },
]

function normalizePhoneInput(countryCode: string, rawPhone: string): string {
  const cleaned = rawPhone.trim().replace(/[\s\-().]/g, '')
  if (!cleaned) return ''
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.startsWith('00')) return `+${cleaned.slice(2)}`
  const codeDigits = countryCode.replace(/\D/g, '')
  if (cleaned.length >= 11 && cleaned.startsWith(codeDigits)) {
    return `+${cleaned}`
  }
  return `${countryCode}${cleaned.replace(/^0+/, '')}`
}

function getDerivedStatusKey(order: TrackedOrder): StatusKey {
  if (order.is_delivered) return 'delivered'
  if (order.is_shipped) return 'shipped'
  if (order.is_processing) return 'processing'
  const st = String(order.status || '').toLowerCase()
  if (st === 'cancelled' || st === 'canceled') return 'cancelled'
  if (st === 'delivered') return 'delivered'
  if (st === 'shipped') return 'shipped'
  if (st === 'processing') return 'processing'
  if (st === 'confirmed') return 'confirmed'
  return 'pending'
}

export default function OrderTracking({
  products = [],
  onBack,
}: {
  products?: Product[]
  onBack?: () => void
}) {
  const [countryCode, setCountryCode] = useState('+228')
  const [phone, setPhone] = useState('')
  const [reference, setReference] = useState('')
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [copiedRef, setCopiedRef] = useState<string | null>(null)
  const [payingOrderRef, setPayingOrderRef] = useState<string | null>(null)
  const [verifyingOrderRef, setVerifyingOrderRef] = useState<string | null>(null)

  // Raccourcis récents sauvegardés
  const [recentPhone, setRecentPhone] = useState<string>('')
  const [recentRef, setRecentRef] = useState<string>('')

  const executeSearch = useCallback(
    async (
      searchPhoneRaw: string,
      searchRefRaw: string,
      code = countryCode,
      silent = false
    ) => {
      const cleanRef = searchRefRaw.trim()
      const fullPhone = normalizePhoneInput(code, searchPhoneRaw)
      const phoneDigits = fullPhone.replace(/\D/g, '')

      if (phoneDigits.length < 8 && cleanRef.length < 8) {
        if (!silent) {
          setErrorMsg(
            'Veuillez saisir votre numéro de téléphone (au moins 8 chiffres) ou votre référence de commande.'
          )
        }
        return
      }

      setErrorMsg(null)
      if (!silent) {
        setLoading(true)
        setHasSearched(true)
      } else {
        setRefreshing(true)
      }

      try {
        const found = await trackOrders(phoneDigits.length >= 8 ? fullPhone : '', cleanRef)
        setOrders(found)
        setLastSyncTime(
          new Date().toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        )

        if (phoneDigits.length >= 8) {
          try {
            localStorage.setItem('gds_tracking_phone', fullPhone)
            setRecentPhone(fullPhone)
          } catch {}
        }
        if (cleanRef) {
          try {
            localStorage.setItem('gds_tracking_last_ref', cleanRef)
            setRecentRef(cleanRef)
          } catch {}
        }
      } catch (err: any) {
        if (!silent) {
          setErrorMsg(
            sanitizeUserErrorMessage(
              err,
              'Impossible de récupérer le suivi pour le moment. Veuillez vérifier vos informations ou réessayer.'
            )
          )
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [countryCode]
  )

  // Pré-remplissage et recherche automatique au chargement de la vue
  useEffect(() => {
    try {
      const savedPhone = localStorage.getItem('gds_tracking_phone') || ''
      const savedRef = localStorage.getItem('gds_tracking_last_ref') || ''
      setRecentPhone(savedPhone)
      setRecentRef(savedRef)

      const params = new URLSearchParams(window.location.search)
      const qPhone = params.get('phone') || params.get('tel') || ''
      const qRef = params.get('ref') || params.get('order') || ''

      const initPhone = qPhone || savedPhone
      const initRef = qRef || savedRef

      if (initPhone) {
        const matchedCode = COUNTRY_CODES.find(c => initPhone.startsWith(c.value))
        if (matchedCode) {
          setCountryCode(matchedCode.value)
          setPhone(initPhone.slice(matchedCode.value.length))
        } else {
          setPhone(initPhone)
        }
      }
      if (initRef) {
        setReference(initRef)
      }

      if (initPhone || initRef) {
        const matchedCode = COUNTRY_CODES.find(c => initPhone.startsWith(c.value))
        const codeToUse = matchedCode ? matchedCode.value : '+228'
        const localPhone = matchedCode ? initPhone.slice(matchedCode.value.length) : initPhone
        executeSearch(localPhone, initRef, codeToUse, false)
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Actualisation automatique toutes les 15 secondes lorsque des commandes sont affichées
  useEffect(() => {
    if (!hasSearched || orders.length === 0) return
    const interval = window.setInterval(() => {
      executeSearch(phone, reference, countryCode, true)
    }, 15000)
    return () => window.clearInterval(interval)
  }, [hasSearched, orders.length, phone, reference, countryCode, executeSearch])

  const handleCopyRef = (orderNumber: string) => {
    navigator.clipboard?.writeText(orderNumber).catch(() => {})
    setCopiedRef(orderNumber)
    window.setTimeout(() => {
      setCopiedRef(prev => (prev === orderNumber ? null : prev))
    }, 2000)
  }

  // Vérifier le statut CashPay d'une commande spécifique puis rafraîchir la liste
  const handleVerifyOrderPayment = async (order: TrackedOrder) => {
    setVerifyingOrderRef(order.order_number)
    try {
      await getOrderStatus(
        order.cashpay_order_ref || order.order_number,
        order.order_number
      )
      await executeSearch(phone, reference, countryCode, true)
    } catch {
      await executeSearch(phone, reference, countryCode, true)
    } finally {
      setVerifyingOrderRef(null)
    }
  }

  // Régénérer ou ouvrir le lien CashPay d'une commande en attente
  const handlePayOnCashPay = async (order: TrackedOrder) => {
    const orderNumber = order.order_number
    setPayingOrderRef(orderNumber)
    setErrorMsg(null)

    const totalAmount = Math.round(Number(order.total_amount || order.final_amount || 0))
    const existingBillUrl = String(order.cashpay_bill_url || '').trim()
    const isSandbox =
      existingBillUrl.toLowerCase().includes('sandbox') ||
      String(order.cashpay_order_ref || '').toLowerCase().includes('sandbox')

    if (existingBillUrl.startsWith('https://') && !isSandbox) {
      try {
        localStorage.setItem(
          'pendingPayment',
          JSON.stringify({
            orderRef: orderNumber,
            cashpayRef: order.cashpay_order_ref || orderNumber,
            billUrl: existingBillUrl,
            name: order.customer_name || 'Client',
            phone: order.customer_phone || '',
            address: order.customer_address || order.delivery_address || 'Lomé, Togo',
            total: totalAmount,
            _expires: Date.now() + 3600_000,
          })
        )
      } catch {}
      window.location.href = existingBillUrl
      return
    }

    try {
      const retryRef = `${orderNumber}-R${Date.now().toString().slice(-4)}`
      const items =
        Array.isArray(order.items) && order.items.length > 0
          ? order.items
          : [{ name: `Commande #${orderNumber}`, price: totalAmount, quantity: 1 }]

      const cpResp = await createOrder({
        amount: totalAmount,
        phone: order.customer_phone || normalizePhoneInput(countryCode, phone),
        firstname: order.customer_name || 'Client',
        lastname: '',
        address: order.customer_address || order.delivery_address || 'Lomé, Togo',
        merchantRef: retryRef,
        existingOrderNumber: orderNumber,
        description: `Règlement commande GoodDoctor's Shop #${orderNumber}`,
        items,
        deliveryCoords:
          order.delivery_latitude || order.delivery_lat
            ? {
                lat: Number(order.delivery_latitude || order.delivery_lat),
                lng: Number(order.delivery_longitude || order.delivery_lng),
              }
            : null,
      })

      const newBillUrl = String(cpResp?.bill_url || '').trim()
      if (newBillUrl.startsWith('https://')) {
        try {
          localStorage.setItem(
            'pendingPayment',
            JSON.stringify({
              orderRef: orderNumber,
              cashpayRef: cpResp.order_reference || retryRef,
              billUrl: newBillUrl,
              name: order.customer_name || 'Client',
              phone: order.customer_phone || '',
              address: order.customer_address || order.delivery_address || 'Lomé, Togo',
              total: totalAmount,
              _expires: Date.now() + 3600_000,
            })
          )
        } catch {}
        window.location.href = newBillUrl
        return
      }
      throw new Error('Lien CashPay non disponible.')
    } catch (err: any) {
      setPayingOrderRef(null)
      setErrorMsg(
        sanitizeUserErrorMessage(
          err,
          "Impossible d'ouvrir le portail CashPay pour le moment. Vous pouvez finaliser via l'assistance WhatsApp."
        )
      )
    }
  }

  return (
    <section className="track-view">
      <div className="track-container">
        {/* Navigation retour */}
        <div className="track-topbar">
          <button
            type="button"
            className="track-back-link"
            onClick={e => {
              if (onBack) {
                e.preventDefault()
                onBack()
              }
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Retour boutique</span>
          </button>

          {hasSearched && lastSyncTime && (
            <div className="track-sync-indicator">
              <span className="track-sync-dot" />
              <span>En direct ({lastSyncTime})</span>
              <button
                type="button"
                className="track-sync-btn"
                disabled={refreshing || loading}
                onClick={() => executeSearch(phone, reference, countryCode, true)}
                title="Actualiser le statut"
              >
                <svg
                  className={refreshing ? 'track-spin' : ''}
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* En-tête minimaliste */}
        <div className="track-header">
          <span className="track-eyebrow">Service Logistique</span>
          <h1 className="track-title">Suivi de commande</h1>
          <p className="track-subtitle">
            Renseignez votre numéro de téléphone ou votre référence pour suivre votre colis.
          </p>
        </div>

        {/* Barre de recherche unifiée minimaliste */}
        <form
          className="track-form"
          onSubmit={e => {
            e.preventDefault()
            executeSearch(phone, reference, countryCode, false)
          }}
        >
          <div className="track-form-grid">
            {/* Champ Téléphone */}
            <div className="track-input-wrapper">
              <label htmlFor="track-phone-input" className="track-input-label">Numéro de téléphone</label>
              <div className="track-phone-row">
                <select
                  id="track-country-code"
                  name="track_country_code"
                  aria-label="Indicatif pays"
                  value={countryCode}
                  onChange={e => setCountryCode(e.target.value)}
                  className="track-select"
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  id="track-phone-input"
                  name="track_phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={24}
                  placeholder="90 00 00 00"
                  value={phone}
                  onChange={e => {
                    setPhone(e.target.value)
                    setErrorMsg(null)
                  }}
                  className="track-input"
                />
                {phone && (
                  <button
                    type="button"
                    className="track-clear-btn"
                    aria-label="Effacer le numéro"
                    onClick={() => setPhone('')}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Champ Référence */}
            <div className="track-input-wrapper">
              <label htmlFor="track-ref-input" className="track-input-label">Référence de commande</label>
              <div className="track-ref-row">
                <input
                  id="track-ref-input"
                  name="track_reference"
                  type="text"
                  maxLength={60}
                  placeholder="Ex : GDS-1730..."
                  autoComplete="off"
                  value={reference}
                  onChange={e => {
                    setReference(e.target.value)
                    setErrorMsg(null)
                  }}
                  className="track-input font-mono"
                />
                {reference && (
                  <button
                    type="button"
                    className="track-clear-btn"
                    aria-label="Effacer la référence"
                    onClick={() => setReference('')}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Récents & Action */}
          <div className="track-form-bottom">
            {(recentPhone || recentRef) ? (
              <div className="track-recents">
                <span className="track-recents-title">Récents :</span>
                {recentPhone && (
                  <button
                    type="button"
                    className="track-recent-chip"
                    onClick={() => {
                      const matchedCode = COUNTRY_CODES.find(c => recentPhone.startsWith(c.value))
                      const codeToUse = matchedCode ? matchedCode.value : '+228'
                      const localNum = matchedCode
                        ? recentPhone.slice(matchedCode.value.length)
                        : recentPhone
                      setCountryCode(codeToUse)
                      setPhone(localNum)
                      setReference('')
                      executeSearch(localNum, '', codeToUse, false)
                    }}
                  >
                    {recentPhone}
                  </button>
                )}
                {recentRef && (
                  <button
                    type="button"
                    className="track-recent-chip font-mono"
                    onClick={() => {
                      setReference(recentRef)
                      executeSearch(phone, recentRef, countryCode, false)
                    }}
                  >
                    #{recentRef}
                  </button>
                )}
              </div>
            ) : <div />}

            <button type="submit" className="track-submit-btn" disabled={loading}>
              {loading ? (
                <span>Recherche…</span>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span>Rechercher</span>
                </>
              )}
            </button>
          </div>

          {errorMsg && (
            <div className="track-alert-banner" role="alert">
              <span>{errorMsg}</span>
            </div>
          )}
        </form>

        {/* ── ZONE DE RÉSULTATS ── */}
        <div className="track-results-area" aria-live="polite">
          {loading ? (
            <div className="track-empty-box">
              <div className="track-spinner" />
              <p className="track-empty-text">Recherche de vos commandes en cours…</p>
            </div>
          ) : !hasSearched ? (
            <div className="track-empty-box">
              <div className="track-empty-icon" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </div>
              <h3 className="track-empty-heading">Historique &amp; Livraison</h3>
              <p className="track-empty-sub">
                Indiquez vos identifiants pour afficher vos colis et l'avancement de la livraison.
              </p>
            </div>
          ) : orders.length === 0 ? (
            <div className="track-empty-box">
              <div className="track-empty-icon" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </div>
              <h3 className="track-empty-heading">Aucune commande trouvée</h3>
              <p className="track-empty-sub">
                Aucun résultat pour <span className="font-mono text-zinc-800">{phone ? normalizePhoneInput(countryCode, phone) : reference}</span>. Vérifiez les informations saisies lors de la commande.
              </p>
              <a
                href={`https://wa.me/22892733939?text=${encodeURIComponent(
                  "Bonjour GoodDoctor's Shop, j'ai besoin d'aide pour retrouver le suivi de ma commande."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="track-link-wa"
              >
                Contacter le support WhatsApp
              </a>
            </div>
          ) : (
            <div className="track-list">
              {orders.map(order => {
                const derivedKey = getDerivedStatusKey(order)
                const st = STATUS_CONFIG[derivedKey] || STATUS_CONFIG.pending
                const isPaid = String(order.payment_status || '').toLowerCase() === 'paid'
                const isFailed = String(order.payment_status || '').toLowerCase() === 'failed'
                const isCancelled = derivedKey === 'cancelled'
                const needsPayment = !isPaid && !isCancelled && !order.is_delivered

                const dateStr = order.created_at
                  ? new Date(order.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Récemment'

                const currentStep = st.stepIndex
                const progressWidth =
                  currentStep < 0
                    ? 100
                    : Math.min(100, (currentStep / (TIMELINE_STEPS.length - 1)) * 100)

                const orderItems = Array.isArray(order.items) ? order.items : []
                const totalAmount = Number(order.total_amount || order.final_amount || 0)
                const waMsg = `Bonjour GoodDoctor's Shop, je vous contacte au sujet de ma commande #${order.order_number}.`
                const waLink = `https://wa.me/22892733939?text=${encodeURIComponent(waMsg)}`

                return (
                  <article key={order.order_number || order.id} className="track-card">
                    {/* Carte En-tête */}
                    <div className="track-card-head">
                      <div className="track-card-ref-block">
                        <div className="track-ref-line">
                          <span className="track-ref-num font-mono">#{order.order_number}</span>
                          <button
                            type="button"
                            className="track-copy-btn"
                            onClick={() => handleCopyRef(order.order_number)}
                            title="Copier la référence"
                          >
                            {copiedRef === order.order_number ? 'Copié' : 'Copier'}
                          </button>
                        </div>
                        <span className="track-date">Passée le {dateStr}</span>
                      </div>

                      <div className="track-card-badge-row">
                        <span className={`track-status-badge ${st.badgeClass}`}>{st.label}</span>
                      </div>
                    </div>

                    <p className="track-status-desc">{st.desc}</p>

                    {/* Timeline Minimaliste */}
                    <div className="track-stepper-wrap">
                      <div className="track-stepper-line-bg" />
                      <div
                        className={`track-stepper-line-fill ${
                          isCancelled ? 'is-cancelled' : derivedKey === 'delivered' ? 'is-delivered' : ''
                        }`}
                        style={{ width: `${progressWidth}%` }}
                      />
                      <div className="track-stepper-nodes">
                        {TIMELINE_STEPS.map((stepItem, idx) => {
                          const isPast = currentStep >= idx
                          const isCurrent = currentStep === idx
                          return (
                            <div
                              key={stepItem.title}
                              className={`track-node ${isPast ? 'is-past' : ''} ${
                                isCurrent ? 'is-current' : ''
                              } ${isCancelled ? 'is-cancelled' : ''}`}
                            >
                              <div className="track-node-circle">
                                {isPast && !isCurrent ? (
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                ) : (
                                  idx + 1
                                )}
                              </div>
                              <span className="track-node-label">{stepItem.title}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Liste des articles */}
                    {orderItems.length > 0 && (
                      <div className="track-items-block">
                        <span className="track-section-label">Articles ({orderItems.length})</span>
                        <div className="track-items-rows">
                          {orderItems.map((item, idx) => {
                            const matchedProd = products.find(
                              p => p.name.toLowerCase() === String(item.name || '').toLowerCase()
                            )
                            const imgUrl =
                              item.image_url || matchedProd?.images?.[0]?.url || FALLBACK_IMG
                            const variants: string[] = []
                            if (item.variant) variants.push(item.variant)
                            if (item.selectedColor) variants.push(item.selectedColor)
                            if (item.selectedSize) variants.push(`Taille ${item.selectedSize}`)

                            return (
                              <div key={`${item.name}-${idx}`} className="track-item-row">
                                <img
                                  src={imgUrl}
                                  alt={item.name}
                                  className="track-item-img"
                                  loading="lazy"
                                />
                                <div className="track-item-info">
                                  <span className="track-item-name">{item.name}</span>
                                  {variants.length > 0 && (
                                    <span className="track-item-meta">{variants.join(' · ')}</span>
                                  )}
                                </div>
                                <div className="track-item-price-block">
                                  <span className="track-item-price">{formatMoney(Number(item.price || 0))}</span>
                                  <span className="track-item-qty">Qté : {item.quantity || 1}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Métadonnées minimalistes (Destinataire + Montant) */}
                    <div className="track-meta-row">
                      <div className="track-meta-col">
                        <span className="track-section-label">Destinataire &amp; Livraison</span>
                        <span className="track-meta-val font-semibold">{order.customer_name || 'Client'}</span>
                        <span className="track-meta-sub">
                          {order.customer_address || order.delivery_address || 'Lomé, Togo'}
                        </span>
                        {order.customer_phone && (
                          <span className="track-meta-sub font-mono">{order.customer_phone}</span>
                        )}
                      </div>

                      <div className="track-meta-col text-right">
                        <span className="track-section-label">Règlement</span>
                        <span className={`track-pay-status ${isPaid ? 'is-paid' : isFailed ? 'is-failed' : 'is-pending'}`}>
                          {isPaid ? 'Payé ✓' : isFailed ? 'Échec' : 'En attente'}
                        </span>
                        <span className="track-total-val">{formatMoney(totalAmount)}</span>
                      </div>
                    </div>

                    {/* Action Paiement si en attente */}
                    {needsPayment && (
                      <div className="track-pay-prompt">
                        <div className="track-pay-text">
                          <strong>Paiement en attente</strong>
                          <span>Réglez directement en ligne pour déclencher la livraison.</span>
                        </div>
                        <button
                          type="button"
                          className="track-pay-cta"
                          disabled={payingOrderRef === order.order_number}
                          onClick={() => handlePayOnCashPay(order)}
                        >
                          {payingOrderRef === order.order_number
                            ? 'Redirection…'
                            : `Régler ${formatMoney(totalAmount)}`}
                        </button>
                      </div>
                    )}

                    {/* Pied de carte : Liens discrets */}
                    <div className="track-card-footer">
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="track-footer-link"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                        <span>Assistance WhatsApp</span>
                      </a>

                      <button
                        type="button"
                        className="track-footer-btn"
                        disabled={verifyingOrderRef === order.order_number}
                        onClick={() => handleVerifyOrderPayment(order)}
                      >
                        {verifyingOrderRef === order.order_number ? 'Actualisation…' : 'Vérifier le statut'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        {/* Section FAQ discrète */}
        <div className="track-faq">
          <span className="track-faq-eyebrow">Aide &amp; Renseignements</span>
          <details className="track-faq-item">
            <summary>Comment suivre une commande sans le numéro de référence ?</summary>
            <p>
              Entrez simplement le numéro de téléphone utilisé lors de votre achat. L'ensemble des commandes associées à ce numéro s'affichera automatiquement.
            </p>
          </details>
          <details className="track-faq-item">
            <summary>Mon paiement a été effectué mais le statut n'a pas changé</summary>
            <p>
              Cliquez sur « Vérifier le statut » sur votre commande pour actualiser instantanément l'état auprès du serveur de paiement.
            </p>
          </details>
        </div>
      </div>
    </section>
  )
}
