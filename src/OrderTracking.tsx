import { useState, useEffect, useCallback } from 'react'
import { formatMoney } from './money'
import {
  trackOrders,
  deleteTrackedOrder,
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
    badgeClass: 'status-badge-pending',
    stepIndex: 0,
    desc: 'Votre commande a été reçue et est en cours de validation par notre équipe.',
  },
  confirmed: {
    label: 'Confirmée',
    badgeClass: 'status-badge-processing',
    stepIndex: 1,
    desc: 'Paiement et commande confirmés. Préparation imminente.',
  },
  processing: {
    label: 'En préparation',
    badgeClass: 'status-badge-processing',
    stepIndex: 1,
    desc: 'Nos préparateurs soignent le conditionnement de vos articles médicaux.',
  },
  shipped: {
    label: 'Expédiée',
    badgeClass: 'status-badge-shipped',
    stepIndex: 2,
    desc: 'Votre colis est entre les mains du livreur et en route vers votre adresse.',
  },
  delivered: {
    label: 'Livrée',
    badgeClass: 'status-badge-delivered',
    stepIndex: 3,
    desc: 'Colis remis en main propre. Merci pour votre confiance !',
  },
  cancelled: {
    label: 'Annulée',
    badgeClass: 'status-badge-cancelled',
    stepIndex: -1,
    desc: 'Cette commande a été annulée.',
  },
}

const TIMELINE_STEPS = [
  { title: 'Reçue', subtitle: 'Commande enregistrée' },
  { title: 'Préparation', subtitle: 'Emballage & contrôle' },
  { title: 'Expédition', subtitle: 'En cours de livraison' },
  { title: 'Livrée', subtitle: 'Remis au destinataire' },
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
  const [confirmDeleteRef, setConfirmDeleteRef] = useState<string | null>(null)
  const [deletingRef, setDeletingRef] = useState<string | null>(null)

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

      if (phoneDigits.length < 6 && cleanRef.length < 4) {
        if (!silent) {
          setErrorMsg(
            'Veuillez saisir votre numéro de téléphone (ex: 90 00 00 00) ou votre référence de commande (ex: GDS-...).'
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
        const found = await trackOrders(phoneDigits.length >= 6 ? fullPhone : '', cleanRef)
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
          setErrorMsg(err?.message || 'Impossible de récupérer le suivi pour le moment.')
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
        // Extraire l'indicatif s'il correspond à notre liste
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

    // 1. Si un bill_url valide est déjà enregistré, rediriger immédiatement
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

    // 2. Sinon, régénérer un lien de paiement CashPay via le proxy serveur
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
        err?.message ||
          "Impossible d'ouvrir le portail CashPay pour le moment. Vous pouvez finaliser via l'assistance WhatsApp."
      )
    }
  }

  // Supprimer une commande
  const handleDeleteOrder = async (orderNumber: string) => {
    setDeletingRef(orderNumber)
    try {
      const targetOrder = orders.find(o => o.order_number === orderNumber)
      const verifyPhone =
        targetOrder?.customer_phone || normalizePhoneInput(countryCode, phone) || recentPhone
      await deleteTrackedOrder(orderNumber, verifyPhone)
      setOrders(prev => prev.filter(o => o.order_number !== orderNumber))
      setConfirmDeleteRef(null)
      if (recentRef === orderNumber) {
        try {
          localStorage.removeItem('gds_tracking_last_ref')
          setRecentRef('')
        } catch {}
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossible de supprimer cette commande.')
      setConfirmDeleteRef(null)
    } finally {
      setDeletingRef(null)
    }
  }

  return (
    <section className="tracking-page">
      <a
        className="text-link tracking-back"
        href="#"
        onClick={e => {
          if (onBack) {
            e.preventDefault()
            onBack()
          }
        }}
      >
        ← Retour à la boutique
      </a>

      <div className="tracking-intro">
        <span className="eyebrow">SUIVI LOGISTIQUE EN TEMPS RÉEL</span>
        <h1>Suivre ma commande</h1>
        <p>
          Retrouvez toutes vos commandes par <strong>numéro de téléphone</strong> ou par{' '}
          <strong>référence de commande</strong>, suivez l'acheminement en direct et réglez vos commandes en attente via CashPay.
        </p>
      </div>

      {/* ── CARTE DE RECHERCHE INTERACTIVE ── */}
      <div className="tracking-search-box">
        <form
          className="tracking-search-form"
          onSubmit={e => {
            e.preventDefault()
            executeSearch(phone, reference, countryCode, false)
          }}
        >
          <div className="tracking-inputs-grid">
            {/* Recherche par numéro de téléphone */}
            <div className="tracking-field">
              <label htmlFor="tracking-phone-input">
                Numéro de téléphone <span className="tracking-badge-hint">Suivi de toutes vos commandes</span>
              </label>
              <div className="tracking-phone-group">
                <select
                  aria-label="Indicatif pays"
                  value={countryCode}
                  onChange={e => setCountryCode(e.target.value)}
                  className="tracking-country-select"
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  id="tracking-phone-input"
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
                />
                {phone && (
                  <button
                    type="button"
                    className="tracking-input-clear"
                    aria-label="Effacer le numéro"
                    onClick={() => setPhone('')}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Recherche par référence de commande */}
            <div className="tracking-field">
              <label htmlFor="tracking-order-input">
                Référence de commande <span className="tracking-optional">(optionnel avec le téléphone)</span>
              </label>
              <div className="tracking-ref-group">
                <input
                  id="tracking-order-input"
                  type="text"
                  maxLength={60}
                  placeholder="Ex : GDS-1793284009576-YBF4Q8"
                  autoComplete="off"
                  value={reference}
                  onChange={e => {
                    setReference(e.target.value)
                    setErrorMsg(null)
                  }}
                />
                {reference && (
                  <button
                    type="button"
                    className="tracking-input-clear"
                    aria-label="Effacer la référence"
                    onClick={() => setReference('')}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="tracking-error-banner" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="tracking-search-footer">
            {(recentPhone || recentRef) && (
              <div className="tracking-quick-chips">
                <span className="tracking-quick-label">Récents :</span>
                {recentPhone && (
                  <button
                    type="button"
                    className="tracking-chip"
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
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <span>{recentPhone}</span>
                  </button>
                )}
                {recentRef && (
                  <button
                    type="button"
                    className="tracking-chip tracking-chip-mono"
                    onClick={() => {
                      setReference(recentRef)
                      executeSearch(phone, recentRef, countryCode, false)
                    }}
                  >
                    <span>#{recentRef}</span>
                  </button>
                )}
              </div>
            )}

            <button type="submit" className="primary tracking-submit-btn" disabled={loading}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>{loading ? 'Recherche en cours…' : 'Suivre ma commande'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* ── BARRE DE SYNCHRONISATION EN DIRECT ── */}
      {hasSearched && lastSyncTime && (
        <div className="tracking-sync-bar">
          <div className="tracking-sync-left">
            <span className="tracking-live-dot">
              <span className="tracking-live-ping" />
              <span className="tracking-live-core" />
            </span>
            <span>Connecté en direct · Actualisé à {lastSyncTime}</span>
          </div>
          <button
            type="button"
            className="tracking-refresh-btn"
            disabled={refreshing || loading}
            onClick={() => executeSearch(phone, reference, countryCode, true)}
          >
            <svg
              className={refreshing ? 'spin-icon' : ''}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>{refreshing ? 'Actualisation…' : 'Actualiser'}</span>
          </button>
        </div>
      )}

      {/* ── RÉSULTATS DU SUIVI ── */}
      <div className="tracking-results-container" aria-live="polite">
        {loading ? (
          <div className="tracking-state-card">
            <div className="tracking-spinner" />
            <h3>Recherche de vos commandes en direct…</h3>
            <p className="tracking-muted">Interrogation de la base logistique GoodDoctor's Shop</p>
          </div>
        ) : !hasSearched ? (
          <div className="tracking-state-card">
            <div className="tracking-empty-icon" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7 5l10 4" />
              </svg>
            </div>
            <h3>Entrez votre numéro de téléphone pour retrouver vos commandes</h3>
            <p className="tracking-muted">
              Saisissez le numéro de téléphone utilisé lors de votre achat (ex : <strong>90 00 00 00</strong>) ou votre référence <strong>GDS-...</strong> pour afficher l'état de préparation et de livraison en direct.
            </p>
          </div>
        ) : orders.length === 0 ? (
          <div className="tracking-state-card">
            <div className="tracking-empty-icon" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <h3>Aucune commande trouvée</h3>
            <p className="tracking-muted">
              Aucune commande ne correspond à votre recherche{' '}
              <strong>{phone ? normalizePhoneInput(countryCode, phone) : reference}</strong>. Vérifiez le numéro de téléphone renseigné lors de la validation du panier.
            </p>
            <a
              href={`https://wa.me/22892733939?text=${encodeURIComponent(
                "Bonjour GoodDoctor's Shop, j'ai besoin d'aide pour retrouver le suivi de ma commande."
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tracking-wa-support-btn"
            >
              Contacter le support WhatsApp
            </a>
          </div>
        ) : (
          <div className="tracking-orders-list">
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
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Date récente'

              const currentStep = st.stepIndex
              const progressPercent =
                currentStep < 0
                  ? 100
                  : Math.min(100, (currentStep / (TIMELINE_STEPS.length - 1)) * 100)

              const orderItems = Array.isArray(order.items) ? order.items : []
              const totalAmount = Number(order.total_amount || order.final_amount || 0)
              const waMsg = `Bonjour GoodDoctor's Shop, je vous contacte au sujet de ma commande #${order.order_number}. Pouvez-vous me renseigner sur l'état de livraison ?`
              const waLink = `https://wa.me/22892733939?text=${encodeURIComponent(waMsg)}`

              return (
                <article key={order.order_number || order.id} className="tracked-order-card">
                  {/* En-tête de la commande */}
                  <div className="tracked-order-header">
                    <div className="tracked-order-head-top">
                      <div>
                        <div className="tracked-order-ref-row">
                          <span className="tracked-order-label">COMMANDE</span>
                          <span className="tracked-order-number">#{order.order_number}</span>
                          <button
                            type="button"
                            className="tracked-copy-btn"
                            onClick={() => handleCopyRef(order.order_number)}
                            title="Copier la référence"
                          >
                            {copiedRef === order.order_number ? 'Copié ✓' : 'Copier'}
                          </button>
                        </div>
                        <p className="tracked-order-date">Passée le {dateStr}</p>
                      </div>

                      <div className="tracked-order-badges">
                        <span className={`tracked-status-pill ${st.badgeClass}`}>{st.label}</span>
                        <button
                          type="button"
                          className="tracked-delete-btn"
                          title="Supprimer cette commande"
                          aria-label={`Supprimer la commande ${order.order_number}`}
                          onClick={() => setConfirmDeleteRef(order.order_number)}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <p className="tracked-order-desc">{st.desc}</p>
                  </div>

                  {/* Timeline 4 paliers */}
                  <div className="tracked-timeline-box">
                    <div className="tracked-timeline-bar-wrap">
                      <div className="tracked-timeline-bar-bg" />
                      <div
                        className={`tracked-timeline-bar-fill ${
                          isCancelled ? 'cancelled' : derivedKey === 'delivered' ? 'delivered' : ''
                        }`}
                        style={{ width: `calc(${progressPercent}% * 0.88)` }}
                      />
                      <div className="tracked-timeline-steps">
                        {TIMELINE_STEPS.map((stepItem, idx) => {
                          const isPast = currentStep >= idx
                          const isCurrent = currentStep === idx
                          return (
                            <div
                              key={stepItem.title}
                              className={`tracked-step-node ${isPast ? 'past' : ''} ${
                                isCurrent ? 'current' : ''
                              } ${isCancelled ? 'cancelled' : ''}`}
                            >
                              <div className="tracked-step-circle">{idx + 1}</div>
                              <span className="tracked-step-title">{stepItem.title}</span>
                              <span className="tracked-step-sub">{stepItem.subtitle}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Corps de la commande : articles + livraison + paiement */}
                  <div className="tracked-order-body">
                    {orderItems.length > 0 && (
                      <div className="tracked-items-section">
                        <h4>Articles commandés ({orderItems.reduce((s, i) => s + (Number(i.quantity) || 1), 0)})</h4>
                        <div className="tracked-items-list">
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
                              <div key={`${item.name}-${idx}`} className="tracked-item-row">
                                <img
                                  src={imgUrl}
                                  alt={item.name}
                                  className="tracked-item-thumb"
                                  loading="lazy"
                                />
                                <div className="tracked-item-info">
                                  <b>{item.name}</b>
                                  {variants.length > 0 && (
                                    <div className="tracked-item-variants">
                                      {variants.map(v => (
                                        <span key={v}>{v}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="tracked-item-price">
                                  <b>{formatMoney(Number(item.price || 0))}</b>
                                  <span>Qté : {item.quantity || 1}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Grille Lieu de livraison & Règlement */}
                    <div className="tracked-meta-grid">
                      <div className="tracked-meta-card">
                        <span className="tracked-meta-label">Client &amp; Lieu de livraison</span>
                        <b>{order.customer_name || 'Client'}</b>
                        <p>
                          {order.customer_address ||
                            order.delivery_address ||
                            `${order.delivery_city || 'Lomé'}, ${order.delivery_country || 'Togo'}`}
                        </p>
                        {order.customer_phone && <small>{order.customer_phone}</small>}
                      </div>

                      <div className="tracked-meta-card tracked-meta-payment">
                        <div>
                          <span className="tracked-meta-label">Règlement</span>
                          <span
                            className={`tracked-pay-badge ${
                              isPaid ? 'paid' : isFailed ? 'failed' : 'pending'
                            }`}
                          >
                            {isPaid
                              ? 'Payé en ligne ✓'
                              : isFailed
                              ? 'Paiement échoué'
                              : 'Paiement en attente'}
                          </span>
                        </div>
                        <div className="tracked-total-col">
                          <span className="tracked-meta-label">Total</span>
                          <b className="tracked-total-amount">{formatMoney(totalAmount)}</b>
                        </div>
                      </div>
                    </div>

                    {/* Bandeau d'alerte si paiement en attente */}
                    {needsPayment && (
                      <div className="tracked-payment-alert">
                        <div>
                          <h5>Paiement en attente de validation</h5>
                          <p>
                            Votre commande est enregistrée. Pour déclencher immédiatement la préparation et l'expédition, validez votre règlement en ligne via <strong>CashPay</strong> (Moov Money, Mixx, Coris Money ou Carte bancaire Visa / Mastercard).
                          </p>
                        </div>
                        <button
                          type="button"
                          className="tracked-pay-now-btn"
                          disabled={payingOrderRef === order.order_number}
                          onClick={() => handlePayOnCashPay(order)}
                        >
                          {payingOrderRef === order.order_number
                            ? 'Redirection CashPay…'
                            : `Payer sur CashPay (${formatMoney(totalAmount)})`}
                        </button>
                      </div>
                    )}

                    {/* Actions bas de carte */}
                    <div className="tracked-actions-bar">
                      <div className="tracked-actions-left">
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tracked-wa-btn"
                        >
                          Assistance WhatsApp
                        </a>
                      </div>

                      <button
                        type="button"
                        className="tracked-verify-btn"
                        disabled={verifyingOrderRef === order.order_number}
                        onClick={() => handleVerifyOrderPayment(order)}
                      >
                        {verifyingOrderRef === order.order_number
                          ? 'Vérification…'
                          : "Vérifier l'état"}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {/* Modale de confirmation de suppression */}
      {confirmDeleteRef && (
        <div
          className="tracking-delete-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => !deletingRef && setConfirmDeleteRef(null)}
        >
          <div className="tracking-delete-modal" onClick={e => e.stopPropagation()}>
            <h3>Supprimer la commande #{confirmDeleteRef} ?</h3>
            <p>
              Cette action retirera définitivement cette commande de votre historique de suivi.
            </p>
            <div className="tracking-delete-modal-actions">
              <button
                type="button"
                className="tracking-cancel-btn"
                disabled={Boolean(deletingRef)}
                onClick={() => setConfirmDeleteRef(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="tracking-confirm-delete-btn"
                disabled={Boolean(deletingRef)}
                onClick={() => handleDeleteOrder(confirmDeleteRef)}
              >
                {deletingRef ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tracking-help">
        <h2>Questions fréquentes sur le suivi</h2>
        <details>
          <summary>Comment retrouver ma commande sans son numéro de référence ?</summary>
          <p>
            Saisissez simplement le numéro de téléphone utilisé lors de votre commande (ex : 90 00 00 00). Toutes les commandes associées à votre numéro s'afficheront automatiquement.
          </p>
        </details>
        <details>
          <summary>J'ai payé sur CashPay mais le statut indique encore « Paiement en attente »</summary>
          <p>
            Cliquez sur le bouton « Vérifier l'état » sur la carte de votre commande : notre serveur interroge directement CashPay en temps réel et met à jour votre commande instantanément.
          </p>
        </details>
      </div>
    </section>
  )
}
