import { useEffect, useState, useCallback } from 'react'
import MapModal from './MapModal'
import { formatMoney as money, freeDeliveryThreshold } from './money'
import { createOrder, getOrderStatus, generateMerchantRef, type CashPayOrderItem } from './cashpay'

export type PendingPaymentInfo = {
  orderRef: string
  cashpayRef: string
  billUrl: string
  name: string
  phone: string
  address: string
  total?: number
  _expires?: number
}

const COUNTRY_CODES = [
  { value: '+228', label: '🇹🇬 +228', country: 'Togo', defaultCity: 'Lomé' },
  { value: '+229', label: '🇧🇯 +229', country: 'Bénin', defaultCity: 'Cotonou' },
  { value: '+233', label: '🇬🇭 +233', country: 'Ghana', defaultCity: 'Accra' },
  { value: '+234', label: '🇳🇬 +234', country: 'Nigéria', defaultCity: 'Lagos' },
  { value: '+225', label: '🇨🇮 +225', country: "Côte d'Ivoire", defaultCity: 'Abidjan' },
  { value: '+226', label: '🇧🇫 +226', country: 'Burkina Faso', defaultCity: 'Ouagadougou' },
  { value: '+227', label: '🇳🇪 +227', country: 'Niger', defaultCity: 'Niamey' },
  { value: '+221', label: '🇸🇳 +221', country: 'Sénégal', defaultCity: 'Dakar' },
  { value: '+223', label: '🇲🇱 +223', country: 'Mali', defaultCity: 'Bamako' },
  { value: '+241', label: '🇬🇦 +241', country: 'Gabon', defaultCity: 'Libreville' },
  { value: '+237', label: '🇨🇲 +237', country: 'Cameroun', defaultCity: 'Douala' },
  { value: '+242', label: '🇨🇬 +242', country: 'Congo', defaultCity: 'Brazzaville' },
  { value: '+243', label: '🇨🇩 +243', country: 'RD Congo', defaultCity: 'Kinshasa' },
  { value: '+250', label: '🇷🇼 +250', country: 'Rwanda', defaultCity: 'Kigali' },
  { value: '+33', label: '🇫🇷 +33', country: 'France', defaultCity: 'Paris' },
  { value: '+32', label: '🇧🇪 +32', country: 'Belgique', defaultCity: 'Bruxelles' },
  { value: '+41', label: '🇨🇭 +41', country: 'Suisse', defaultCity: 'Genève' },
  { value: '+49', label: '🇩🇪 +49', country: 'Allemagne', defaultCity: 'Berlin' },
  { value: '+44', label: '🇬🇧 +44', country: 'Royaume-Uni', defaultCity: 'Londres' },
  { value: '+1', label: '🇺🇸 +1', country: 'États-Unis', defaultCity: 'New York' },
  { value: '+86', label: '🇨🇳 +86', country: 'Chine', defaultCity: 'Pékin' },
  { value: '+91', label: '🇮🇳 +91', country: 'Inde', defaultCity: 'New Delhi' },
  { value: '+212', label: '🇲🇦 +212', country: 'Maroc', defaultCity: 'Casablanca' },
  { value: '+216', label: '🇹🇳 +216', country: 'Tunisie', defaultCity: 'Tunis' },
  { value: '+90', label: '🇹🇷 +90', country: 'Turquie', defaultCity: 'Istanbul' },
  { value: '+966', label: '🇸🇦 +966', country: 'Arabie Saoudite', defaultCity: 'Riyad' },
  { value: '+971', label: '🇦🇪 +971', country: 'Émirats Arabes Unis', defaultCity: 'Dubaï' },
  { value: '+55', label: '🇧🇷 +55', country: 'Brésil', defaultCity: 'São Paulo' },
  { value: '+81', label: '🇯🇵 +81', country: 'Japon', defaultCity: 'Tokyo' },
]

export default function Checkout({
  subtotal,
  items = [],
  initialPendingOrder = null,
  onBack,
  onClearCart,
  onOpenLegal,
}: {
  subtotal: number
  items?: CashPayOrderItem[]
  initialPendingOrder?: PendingPaymentInfo | null
  onBack: () => void
  onClearCart?: () => void
  onOpenLegal?: (view: 'privacy' | 'cgv') => void
}) {
  const [step, setStep] = useState(initialPendingOrder ? 3 : 1)
  const [clientName, setClientName] = useState(initialPendingOrder?.name || '')
  const [phoneCountryCode, setPhoneCountryCode] = useState('+228')
  const [clientPhone, setClientPhone] = useState('')
  const [clientAddress, setClientAddress] = useState(initialPendingOrder?.address || '')
  const [mapOpen, setMapOpen] = useState(false)
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState<number | null>(null)
  const [acceptOutOfZone, setAcceptOutOfZone] = useState(false)
  const [agreeLegal, setAgreeLegal] = useState(true)
  const [legalWarning, setLegalWarning] = useState(false)
  const [outOfZoneWarning, setOutOfZoneWarning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState("Validation en cours…")
  const [submitError, setSubmitError] = useState<string | null>(null)

  // État de la commande CashPay (étape 3 / retour de paiement)
  const [orderInfo, setOrderInfo] = useState<PendingPaymentInfo | null>(initialPendingOrder)
  const [checkingPayment, setCheckingPayment] = useState(Boolean(initialPendingOrder))
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)

  const handleMapConfirm = (lat: number, lng: number, addr: string, distKm: number) => {
    setDeliveryCoords({ lat, lng })
    setDeliveryDistanceKm(distKm)
    setClientAddress(addr)
    setAcceptOutOfZone(false)
    setMapOpen(false)
  }

  const isTogoOrder = phoneCountryCode === '+228'
  const isOutOfZone = isTogoOrder && deliveryDistanceKm !== null && deliveryDistanceKm > 20

  // Calcul des frais de livraison selon la distance (OSRM / Haversine) ou international
  let deliveryFee = 0
  let deliveryLabel = '—'

  if (subtotal === 0) {
    deliveryFee = 0
    deliveryLabel = '—'
  } else if (!isTogoOrder) {
    deliveryFee = 0
    deliveryLabel = "Défini à l'expédition"
  } else if (subtotal >= freeDeliveryThreshold) {
    deliveryFee = 0
    deliveryLabel = 'Offerte'
  } else if (deliveryDistanceKm !== null) {
    if (deliveryDistanceKm <= 10) {
      deliveryFee = 1000
      deliveryLabel = '1 000 FCFA'
    } else if (deliveryDistanceKm <= 15) {
      deliveryFee = 1500
      deliveryLabel = '1 500 FCFA'
    } else if (deliveryDistanceKm <= 20) {
      deliveryFee = 2000
      deliveryLabel = '2 000 FCFA'
    } else {
      deliveryFee = 0
      deliveryLabel = "Défini à l'expédition"
    }
  } else {
    // Tarif de base Lomé avant sélection GPS
    deliveryFee = 1000
    deliveryLabel = '1 000 FCFA'
  }

  const operatorFee = subtotal === 0 ? 0 : Math.round((subtotal + deliveryFee) * 0.015)
  const total = subtotal === 0 ? 0 : subtotal + deliveryFee + operatorFee

  // Vérification du statut de paiement auprès de CashPay & Supabase
  const verifyPaymentStatus = useCallback(
    async (info: PendingPaymentInfo, showLoader = false): Promise<boolean> => {
      if (!info.cashpayRef && !info.orderRef) return false
      if (showLoader) setCheckingPayment(true)
      try {
        const result = await getOrderStatus(info.cashpayRef || info.orderRef, info.orderRef)
        const obj = result?.order || result || {}
        const st = String(obj.status || obj.payment_status || obj.state || '').toLowerCase()
        const isPaid =
          result?.paid === true ||
          ['paid', 'completed', 'success', 'approved', 'validated', 'confirmed', 'excess', '1', 'true'].includes(st)

        if (isPaid) {
          setPaymentConfirmed(true)
          try {
            localStorage.removeItem('pendingPayment')
            sessionStorage.removeItem('gds_cart_pending')
          } catch {}
          onClearCart?.()
          return true
        }
      } catch {
        // Ignorer silencieusement pendant le polling
      } finally {
        if (showLoader) setCheckingPayment(false)
      }
      return false
    },
    [onClearCart]
  )

  // Polling automatique lorsque l'utilisateur revient de CashPay (étape 3)
  useEffect(() => {
    if (step !== 3 || !orderInfo || paymentConfirmed) return

    let cancelled = false
    let attempts = 0
    let timer: number | null = null

    const runCheck = async (firstRun: boolean) => {
      if (cancelled) return
      const paid = await verifyPaymentStatus(orderInfo, firstRun)
      if (!paid && !cancelled && attempts < 15) {
        attempts++
        timer = window.setTimeout(() => runCheck(false), 3500)
      }
    }

    runCheck(true)

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [step, orderInfo, paymentConfirmed, verifyPaymentStatus])

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (!agreeLegal) {
      setLegalWarning(true)
      return
    }
    setLegalWarning(false)

    if (isOutOfZone && !acceptOutOfZone) {
      setOutOfZoneWarning(true)
      return
    }
    setOutOfZoneWarning(false)

    // Normalisation du téléphone
    const rawDigits = clientPhone.replace(/[\s\-().]/g, '').replace(/^0+/, '')
    if (!/^\d{6,15}$/.test(rawDigits)) {
      setSubmitError('Veuillez saisir un numéro de téléphone valide (chiffres uniquement).')
      return
    }
    const fullPhone = `${phoneCountryCode}${rawDigits}`

    // Séparation nom / prénom
    const nameParts = clientName.trim().split(/\s+/)
    const firstname = nameParts[0] || 'Client'
    const lastname = nameParts.slice(1).join(' ') || ''

    const countryMeta = COUNTRY_CODES.find(c => c.value === phoneCountryCode)
    const countryName = countryMeta?.country || 'Togo'
    const cityName = countryMeta?.defaultCity || 'Lomé'

    setLoading(true)
    setLoadingLabel('Génération de la facture CashPay…')

    try {
      const merchantRef = generateMerchantRef()
      const itemsDesc =
        items.length > 0
          ? items.map(i => `${i.name} x${i.quantity}`).join(', ')
          : "Articles GoodDoctor's Shop"
      const description = `Commande GoodDoctor's Shop: ${itemsDesc}`.substring(0, 200)

      const cashpayResponse = await createOrder({
        amount: total,
        phone: fullPhone,
        firstname,
        lastname,
        address: clientAddress.trim(),
        city: cityName,
        country: countryName,
        merchantRef,
        description,
        items,
        deliveryCoords,
        deliveryFee,
      })

      const billUrl = String(cashpayResponse?.bill_url || '').trim()
      const cashpayRef = String(cashpayResponse?.order_reference || merchantRef).trim()

      const pendingData: PendingPaymentInfo = {
        orderRef: merchantRef,
        cashpayRef,
        billUrl,
        name: clientName.trim(),
        phone: fullPhone,
        address: clientAddress.trim(),
        total,
        _expires: Date.now() + 3600_000,
      }

      setOrderInfo(pendingData)

      try {
        localStorage.setItem('pendingPayment', JSON.stringify(pendingData))
        localStorage.setItem('gds_tracking_phone', fullPhone)
        localStorage.setItem('gds_tracking_last_ref', merchantRef)
      } catch {}

      // Rediriger vers le portail de paiement sécurisé CashPay
      if (billUrl && billUrl.startsWith('https://')) {
        setLoadingLabel('Redirection vers CashPay…')
        window.location.href = billUrl
        return
      }

      // Si pas d'URL de redirection (paiement direct), afficher l'écran de confirmation
      setLoading(false)
      setStep(3)
    } catch (error: any) {
      setLoading(false)
      setLoadingLabel("Confirmer l'achat")

      let errorMsg = 'Erreur lors de la connexion à CashPay. Veuillez réessayer.'
      if (error?.status === 409) {
        errorMsg = 'Cette commande a déjà été envoyée. Actualisez la page.'
      } else if (error?.status === 429) {
        errorMsg = 'Trop de tentatives. Patientez 1 minute avant de réessayer.'
      } else if (error?.status === 408 || error?.name === 'AbortError') {
        errorMsg = 'Le serveur de paiement met trop de temps à répondre. Vérifiez votre connexion.'
      } else if (error?.message && !String(error.message).includes('fetch')) {
        errorMsg = String(error.message)
      } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
        errorMsg = 'Pas de connexion internet. Vérifiez votre réseau.'
      }
      setSubmitError(errorMsg)
    }
  }

  return (
    <div className="checkout">
      <button className="text-link" onClick={onBack}>← Retour au panier</button>
      <div className="eyebrow">COMMANDE &amp; LIVRAISON</div>
      <h2>
        {step === 3
          ? paymentConfirmed
            ? 'Commande Validée !'
            : checkingPayment
            ? 'Vérification du paiement…'
            : 'En attente de paiement'
          : 'Finaliser votre commande'}
      </h2>

      {step === 1 && (
        <form id="checkout-form" onSubmit={handleFormSubmit}>
          {/* ═══ CADRE INFORMATIONS DE LIVRAISON (Copie textuelle D:\Ecom site web) ═══ */}
          <div className="ecom-delivery-wrapper">
            <div className="ecom-delivery-header">
              <div className="ecom-delivery-icon-pill">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <h2 className="ecom-delivery-title">Informations de livraison</h2>
            </div>

            <div className="ecom-delivery-grid">
              {/* Nom */}
              <div className="ecom-field-group">
                <label htmlFor="client-name" className="ecom-field-label">Nom complet</label>
                <input
                  required
                  id="client-name"
                  name="client_name"
                  autoComplete="name"
                  type="text"
                  maxLength={150}
                  placeholder="Nom et Prénom"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  className="ecom-input-underline"
                />
              </div>

              {/* Téléphone avec sélecteur d'indicatif */}
              <div className="ecom-field-group">
                <label htmlFor="client-phone" className="ecom-field-label">Téléphone</label>
                <div className="ecom-phone-row">
                  <select
                    id="phone-country-code"
                    name="phone_country_code"
                    aria-label="Indicatif téléphonique du pays"
                    autoComplete="tel-country-code"
                    value={phoneCountryCode}
                    onChange={e => {
                      setPhoneCountryCode(e.target.value)
                      if (e.target.value !== '+228') {
                        setDeliveryCoords(null)
                        setDeliveryDistanceKm(null)
                      }
                    }}
                    className="ecom-phone-select"
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    id="client-phone"
                    name="client_phone"
                    autoComplete="tel-national"
                    type="tel"
                    maxLength={20}
                    pattern="[0-9 \-]{6,20}"
                    title="Numéro de téléphone (chiffres et espaces uniquement)"
                    placeholder="90 00 00 00"
                    value={clientPhone}
                    onChange={e => setClientPhone(e.target.value)}
                    className="ecom-input-underline"
                  />
                </div>
              </div>

              {/* Adresse de livraison */}
              <div className="ecom-field-group full-width">
                <label htmlFor="client-address" className="ecom-field-label">Adresse de livraison</label>

                {/* Zone Togo : carte interactive */}
                {isTogoOrder ? (
                  <>
                    <div className="ecom-address-row">
                      <input
                        required
                        id="client-address"
                        name="client_address"
                        type="text"
                        maxLength={200}
                        placeholder="Saisissez votre quartier..."
                        autoComplete="street-address"
                        value={clientAddress}
                        onChange={e => {
                          setClientAddress(e.target.value)
                          if (deliveryCoords) {
                            setDeliveryCoords(null)
                            setDeliveryDistanceKm(null)
                          }
                        }}
                        onFocus={() => setMapOpen(true)}
                        className="ecom-input-underline"
                        style={deliveryCoords ? { borderBottomColor: '#10b981' } : undefined}
                      />
                      <button
                        type="button"
                        onClick={() => setMapOpen(true)}
                        className="ecom-map-btn"
                        aria-label="Ouvrir la carte de localisation"
                      >
                        <span className="ecom-ping-dot">
                          <span className="ecom-ping-animation"></span>
                          <span className="ecom-ping-circle"></span>
                        </span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>Carte</span>
                      </button>
                    </div>

                    {/* Indicateur distance (Togo uniquement) */}
                    {deliveryCoords && deliveryDistanceKm !== null && (
                      <div className="ecom-distance-info">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>Distance route : {deliveryDistanceKm.toFixed(1)} km{isOutOfZone ? ' (hors zone directe)' : ''}</span>
                      </div>
                    )}
                  </>
                ) : (
                  /* Zone internationale : champ texte libre */
                  <div>
                    <input
                      required
                      id="client-address-intl"
                      name="client_address_intl"
                      aria-label="Adresse internationale complète"
                      type="text"
                      maxLength={200}
                      placeholder="Adresse complète (ville, pays...)"
                      autoComplete="street-address"
                      value={clientAddress}
                      onChange={e => setClientAddress(e.target.value)}
                      className="ecom-input-underline"
                    />
                    <div className="ecom-intl-notice">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                      <span>Les frais de livraison seront définis une fois le colis arrivé à la gare d'expédition.</span>
                    </div>
                  </div>
                )}

                {/* Avertissement hors zone de livraison (affiché dynamiquement si > 20 km) */}
                {isOutOfZone && (
                  <div className="ecom-outofzone-card">
                    <div className="ecom-outofzone-heading">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <div>
                        <strong>Adresse hors zone de livraison directe</strong>
                        <p>Votre adresse se situe à plus de 20 km du siège ({deliveryDistanceKm?.toFixed(1)} km). Les frais de livraison seront définis une fois le colis déposé en gare pour expédition.</p>
                      </div>
                    </div>
                    <label className="ecom-outofzone-label">
                      <input
                        type="checkbox"
                        checked={acceptOutOfZone}
                        onChange={e => {
                          setAcceptOutOfZone(e.target.checked)
                          if (e.target.checked) setOutOfZoneWarning(false)
                        }}
                      />
                      <span>J'accepte que les frais de livraison soient définis à l'expédition</span>
                    </label>
                  </div>
                )}

                {outOfZoneWarning && (
                  <div style={{ marginTop: '6px', padding: '8px 12px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '11px', fontWeight: 600 }}>
                    Veuillez accepter que les frais soient définis à l'expédition pour continuer.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Case à cocher CGV & Politique de confidentialité */}
          <div style={{ margin: '14px 0 6px', fontSize: '12px', display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#475569' }}>
            <input
              type="checkbox"
              id="agree-legal"
              checked={agreeLegal}
              onChange={e => {
                setAgreeLegal(e.target.checked)
                if (e.target.checked) setLegalWarning(false)
              }}
              style={{ marginTop: '3px' }}
            />
            <label htmlFor="agree-legal" style={{ margin: 0, fontWeight: 400, fontSize: '12px', cursor: 'pointer' }}>
              J'ai lu et j'accepte la{' '}
              <button
                type="button"
                onClick={() => onOpenLegal && onOpenLegal('privacy')}
                style={{ textDecoration: 'underline', color: 'var(--color-accent, #087fb5)', background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 600, cursor: 'pointer' }}
              >
                Politique de confidentialité
              </button>{' '}
              et les{' '}
              <button
                type="button"
                onClick={() => onOpenLegal && onOpenLegal('cgv')}
                style={{ textDecoration: 'underline', color: 'var(--color-accent, #087fb5)', background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 600, cursor: 'pointer' }}
              >
                Conditions Générales de Vente
              </button>.
            </label>
          </div>

          {legalWarning && (
            <div style={{ marginTop: '4px', marginBottom: '10px', padding: '10px 12px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontSize: '11.5px', fontWeight: 600 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Veuillez cocher cette case pour accepter la Politique de confidentialité et les CGV avant de confirmer votre achat.</span>
            </div>
          )}

          {/* ═══ CADRE RÉSUMÉ & PAIEMENT CASHPAY (Copie textuelle D:\Ecom site web) ═══ */}
          <div className="ecom-summary-wrapper">
            {/* Résumé financier */}
            <div className="ecom-summary-card">
              <h2 className="ecom-summary-title">Résumé</h2>

              <div className="ecom-summary-rows">
                <div className="ecom-summary-row">
                  <span className="label">Sous-total</span>
                  <span className="val">{subtotal === 0 ? '0 FCFA' : money(subtotal)}</span>
                </div>
                <div className="ecom-summary-row">
                  <span className="label">Livraison</span>
                  <span className="val">{deliveryLabel}</span>
                </div>
                <div className="ecom-summary-row">
                  <div className="ecom-summary-fee-group">
                    <span className="fee-label">Frais d'opérateur (1,5%)</span>
                    <span className="fee-sub">Mobile money / Carte bancaire</span>
                  </div>
                  <span className="val">{subtotal === 0 ? '0 FCFA' : money(operatorFee)}</span>
                </div>
              </div>

              <div className="ecom-summary-total-border">
                <div className="ecom-summary-total-row">
                  <span className="ecom-summary-total-label">Total</span>
                  <span className="ecom-summary-total-val">
                    {subtotal === 0 ? (
                      <>0 <span>FCFA</span></>
                    ) : (
                      <>{total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} <span>FCFA</span></>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Paiement sécurisé */}
            <div className="ecom-security-card">
              <div className="ecom-security-heading">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Paiement sécurisé</span>
              </div>
              <p>Moov Money · Mixx · Coris Money · Carte bancaire (Visa, Mastercard)</p>
            </div>

            {/* Message d'erreur CashPay éventuel */}
            {submitError && (
              <div
                role="alert"
                style={{
                  marginBottom: '12px',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '12px',
                  fontWeight: 600,
                  lineHeight: 1.45,
                }}
              >
                {submitError}
              </div>
            )}

            {/* Bouton Confirmer l'achat */}
            <button
              id="checkout-submit-btn"
              type="submit"
              form="checkout-form"
              className="ecom-confirm-btn"
              disabled={loading}
            >
              <span>{loading ? loadingLabel : "Confirmer l'achat"}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>

            {/* Badge sécurité CashPay */}
            <div className="ecom-cashpay-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Paiement crypté &amp; sécurisé via CashPay</span>
            </div>
          </div>
        </form>
      )}

      {step === 3 && (
        <div className="checkout-result">
          {orderInfo?.orderRef && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#64748b', fontWeight: 700 }}>
                Référence commande
              </span>
              <p style={{ fontSize: '16px', fontFamily: 'monospace', fontWeight: 800, color: '#0f172a', margin: '4px 0 0' }}>
                {orderInfo.orderRef}
              </p>
            </div>
          )}

          {paymentConfirmed ? (
            <>
              <h3>Merci {orderInfo?.name || clientName} ! Votre paiement est confirmé.</h3>
              <p>
                Votre commande a été enregistrée et payée avec succès via CashPay. Notre équipe prépare vos articles pour l'expédition.
              </p>
              <button className="primary" onClick={onBack}>
                Retour à la boutique
              </button>
            </>
          ) : (
            <>
              <h3>
                {checkingPayment
                  ? 'Confirmation de votre règlement auprès de CashPay…'
                  : 'Votre commande est enregistrée.'}
              </h3>
              <p>
                {checkingPayment
                  ? 'Un instant, nous vérifions le statut de votre transaction.'
                  : 'Veuillez finaliser le règlement sur CashPay pour déclencher la préparation de votre commande.'}
              </p>

              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '18px',
                  fontSize: '12px',
                  color: '#92400e',
                  lineHeight: 1.5,
                }}
              >
                Si vous avez déjà validé le paiement sur votre téléphone, patientez quelques instants.{' '}
                <strong>Ne payez pas à nouveau</strong> pour éviter un double débit.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {orderInfo?.billUrl && orderInfo.billUrl.startsWith('https://') && (
                  <a
                    href={orderInfo.billUrl}
                    className="ecom-confirm-btn"
                    style={{ textDecoration: 'none', textAlign: 'center', justifyContent: 'center' }}
                  >
                    <span>Payer maintenant sur CashPay</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </a>
                )}

                {orderInfo && (
                  <button
                    type="button"
                    className="primary"
                    disabled={checkingPayment}
                    onClick={() => verifyPaymentStatus(orderInfo, true)}
                    style={{ width: '100%' }}
                  >
                    {checkingPayment ? 'Vérification en cours…' : "J'ai payé · Vérifier mon statut"}
                  </button>
                )}

                <button
                  type="button"
                  className="text-link"
                  onClick={onBack}
                  style={{ alignSelf: 'center', marginTop: '6px' }}
                >
                  Retour à la boutique
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modale Carte interactive Leaflet */}
      <MapModal
        open={mapOpen}
        initialCoords={deliveryCoords}
        onClose={() => setMapOpen(false)}
        onConfirm={handleMapConfirm}
      />
    </div>
  )
}
