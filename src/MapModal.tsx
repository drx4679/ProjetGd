import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// Coordonnées du Siège GoodDoctor's Shop (Lomé, Togo) — exactement comme D:\Ecom site web
const HQ_LAT = 6.193097
const HQ_LNG = 1.203188

// Haversine fallback (vol d'oiseau)
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Géocodage inversé via Nominatim (OSM) — traduit lat/lng en adresse lisible (exactement comme D:\Ecom site web)
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr`,
      { headers: { 'Accept-Language': 'fr' } }
    )
    const data = await res.json()
    if (data?.display_name) {
      const addr = data.address || {}
      const parts = [
        addr.road || addr.pedestrian || '',
        addr.suburb || addr.neighbourhood || addr.village || addr.hamlet || '',
        addr.city || addr.town || addr.municipality || addr.county || '',
        addr.state || '',
      ].filter(Boolean)
      const unique = [...new Set(parts)]
      return unique.join(', ') || data.display_name
    }
  } catch (e: any) {
    console.warn('[Geocode] Erreur reverse geocoding:', e?.message)
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

// Charger Leaflet JS + CSS de façon lazy (exactement comme D:\Ecom site web)
function loadLeaflet(): Promise<void> {
  return new Promise(resolve => {
    if ((window as any).L) {
      resolve()
      return
    }
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = '/vendor/leaflet/leaflet.css'
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)
    }
    const existingScript = document.querySelector('script[src*="leaflet.js"]') as HTMLScriptElement | null
    if (existingScript) {
      if ((window as any).L) {
        resolve()
        return
      }
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => {
        existingScript.remove()
        resolve()
      }, { once: true })
      return
    }
    const script = document.createElement('script')
    // Leaflet 1.9.4 auto-hébergé (/public/vendor/leaflet) : plus de dépendance à un CDN tiers
    script.src = '/vendor/leaflet/leaflet.js'
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
    script.crossOrigin = 'anonymous'
    script.onload = () => resolve()
    script.onerror = () => {
      script.remove()
      resolve()
    }
    document.head.appendChild(script)
  })
}

type NominatimResult = { lat: string; lon: string; display_name: string }

export default function MapModal({
  open,
  initialCoords,
  subtotal = 0,
  onClose,
  onConfirm,
  onRealtimeUpdate,
}: {
  open: boolean
  initialCoords?: { lat: number; lng: number } | null
  subtotal?: number
  onClose: () => void
  onConfirm: (lat: number, lng: number, address: string, distKm: number) => void
  onRealtimeUpdate?: (lat: number, lng: number, address: string, distKm: number) => void
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const routeLayerRef = useRef<any>(null)

  const [addressText, setAddressText] = useState('')
  const [showAddressPreview, setShowAddressPreview] = useState(false)
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [distanceKm, setDistanceKm] = useState<number>(0)

  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const autoTimerRef = useRef<number | null>(null)

  // Mettre à jour l'aperçu adresse dans la modale ET tracer le trajet (exactement comme D:\Ecom site web)
  const updateMapAddressPreview = async (lat: number, lng: number) => {
    setSelectedCoords({ lat, lng })
    setShowAddressPreview(true)
    setAddressText('Localisation et calcul du trajet...')

    const addr = await reverseGeocode(lat, lng)
    setAddressText(addr)

    let dist = haversineKm(HQ_LAT, HQ_LNG, lat, lng)

    const L = (window as any).L
    if (L && mapInstanceRef.current) {
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${HQ_LNG},${HQ_LAT};${lng},${lat}?overview=full&geometries=geojson`
        )
        const data = await res.json()
        if (data.routes && data.routes.length > 0) {
          if (routeLayerRef.current) {
            mapInstanceRef.current.removeLayer(routeLayerRef.current)
          }
          routeLayerRef.current = L.geoJSON(data.routes[0].geometry, {
            style: {
              color: '#3b82f6', // bleu
              weight: 5,
              opacity: 0.7,
              dashArray: '10, 10',
            },
          }).addTo(mapInstanceRef.current)

          mapInstanceRef.current.fitBounds(routeLayerRef.current.getBounds(), {
            padding: [30, 30],
          })
          dist = data.routes[0].distance / 1000
        }
      } catch (e: any) {
        console.warn('[Map] Erreur tracé itinéraire:', e?.message)
      }
    }
    setDistanceKm(dist)
  }

  // Initialisation de la carte Leaflet (exactement comme initLeafletMap dans D:\Ecom site web)
  useEffect(() => {
    if (!open) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
        routeLayerRef.current = null
      }
      setShowAddressPreview(false)
      setAddressText('')
      setSelectedCoords(null)
      setShowSuggestions(false)
      setSearchQuery('')
      return
    }

    let cancelled = false

    const init = async () => {
      await loadLeaflet()
      if (cancelled || !mapContainerRef.current) return

      const L = (window as any).L
      if (!L) return

      const hasCoords = Boolean(initialCoords && initialCoords.lat && initialCoords.lng)
      const startLat = hasCoords ? (initialCoords as any).lat : HQ_LAT
      const startLng = hasCoords ? (initialCoords as any).lng : HQ_LNG

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([startLat, startLng], 15)

      L.control.zoom({ position: 'bottomright' }).addTo(map)
      L.control
        .attribution({ position: 'bottomleft', prefix: false })
        .addTo(map)
        .addAttribution('© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>')

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: 'abc',
      }).addTo(map)

      // Marqueur pour le Siège (HQ) — vert, animé
      const hqIcon = L.divIcon({
        className: '',
        html: `<div style="width:34px;height:34px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 14px rgba(16,185,129,.45);border:2.5px solid white;display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:10px;color:white;font-weight:800;letter-spacing:-.5px">GD</span></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -34],
      })
      const hq = L.marker([HQ_LAT, HQ_LNG], { icon: hqIcon, interactive: true }).addTo(map)
      hq.bindPopup(
        `<div style="text-align:center;font-family:system-ui"><b style="font-size:13px">GoodDoctor's Shop</b><br><span style="font-size:11px;color:#6b7280">Siège — Lomé, Togo</span></div>`
      )

      // Marqueur personnalisé bleu/violet pour la livraison — déplaçable, avec animation pulse
      const icon = L.divIcon({
        className: '',
        html: `<div style="position:relative">
          <div style="position:absolute;top:2px;left:2px;width:36px;height:36px;background:rgba(99,102,241,.3);border-radius:50%;animation:pulse 2s infinite"></div>
          <div style="position:relative;width:40px;height:40px;background:linear-gradient(135deg,#6366f1,#7c3aed);border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 14px rgba(99,102,241,.45);border:3px solid white;display:flex;align-items:center;justify-content:center">
            <svg style="transform:rotate(45deg)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      })

      const marker = L.marker([startLat, startLng], { icon, draggable: true }).addTo(map)
      markerRef.current = marker

      // Géocodage inversé quand on déplace le marqueur
      marker.on('dragend', async (e: any) => {
        const { lat, lng } = e.target.getLatLng()
        await updateMapAddressPreview(lat, lng)
      })

      // Clic sur la carte = déplacer le marqueur + fermer suggestions
      map.on('click', async (e: any) => {
        setShowSuggestions(false)
        const { lat, lng } = e.latlng
        marker.setLatLng([lat, lng])
        await updateMapAddressPreview(lat, lng)
      })

      mapInstanceRef.current = map

      // Invalider taille après affichage pour affichage correct
      map.invalidateSize()
      setTimeout(() => map.invalidateSize(), 150)

      // Aperçu initial uniquement si on a déjà des coordonnées sauvegardées
      if (hasCoords) {
        await updateMapAddressPreview(startLat, startLng)
      }
    }

    const timer = setTimeout(init, 100)
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onEsc, true)
    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('keydown', onEsc, true)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
        routeLayerRef.current = null
      }
    }
  }, [open, initialCoords])

  // Autocomplete : suggestions live (debounce 400ms)
  const handleMapAutocomplete = (value: string) => {
    setSearchQuery(value)
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    const query = value.trim()
    if (query.length < 3) {
      setShowSuggestions(false)
      setSuggestions([])
      return
    }
    autoTimerRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query + ' Togo'
          )}&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': 'fr' } }
        )
        const results = await res.json()
        setSuggestions(results || [])
        setShowSuggestions(true)
      } catch {
        setShowSuggestions(false)
      }
    }, 400)
  }

  // Sélectionner une suggestion autocomplete
  const selectMapSuggestion = async (lat: number, lon: number) => {
    setShowSuggestions(false)
    setSuggestions([])
    setSearchQuery('')
    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([lat, lon], 16)
      markerRef.current.setLatLng([lat, lon])
      await updateMapAddressPreview(lat, lon)
    }
  }

  // Recherche d'adresse via Nominatim (bouton / Enter)
  const searchMapAddress = async () => {
    const query = searchQuery.trim()
    if (!query || !mapInstanceRef.current) return
    setShowSuggestions(false)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query + ' Togo'
        )}&limit=1`,
        { headers: { 'Accept-Language': 'fr' } }
      )
      const results = await res.json()
      if (results && results.length > 0) {
        const lat = parseFloat(results[0].lat)
        const lon = parseFloat(results[0].lon)
        mapInstanceRef.current.setView([lat, lon], 16)
        if (markerRef.current) markerRef.current.setLatLng([lat, lon])
        await updateMapAddressPreview(lat, lon)
      }
    } catch (e: any) {
      console.warn('[Map] Erreur recherche adresse:', e?.message)
    }
  }

  // Utiliser la position GPS du navigateur (Me localiser)
  const useMyLocation = () => {
    setShowSuggestions(false)
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur.")
      return
    }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([lat, lng], 16)
          markerRef.current.setLatLng([lat, lng])
          await updateMapAddressPreview(lat, lng)
        }
      },
      () => {
        alert("Impossible d'obtenir votre position. Vérifiez les permissions GPS.")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Confirmer la localisation choisie (comme confirmMapLocation dans D:\Ecom site web)
  const confirmMapLocation = () => {
    if (!selectedCoords) {
      onClose()
      return
    }
    onConfirm(selectedCoords.lat, selectedCoords.lng, addressText, distanceKm)
    onClose()
  }

  if (!open) return null

  return createPortal(
    <div
      id="map-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Carte de localisation"
      className="fixed inset-0 z-[9999]"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      />

      {/* Panneau */}
      <div className="absolute inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center md:p-6 pointer-events-none">
        <div
          className="bg-white dark:bg-zinc-950 w-full md:max-w-2xl rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden"
          style={{ height: '85dvh', maxHeight: '700px' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header modale & Actions */}
          <div className="flex flex-col gap-4 px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0 relative z-10 bg-white dark:bg-zinc-950 rounded-t-3xl md:rounded-none">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Point de livraison</h3>
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-1">Ajustez le marqueur sur la carte</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-2 transition-colors cursor-pointer"
                aria-label="Fermer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Actions unifiées */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={useMyLocation}
                className="flex items-center justify-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors w-full sm:w-auto flex-shrink-0 border border-blue-100 dark:border-blue-800 cursor-pointer"
              >
                <svg className="w-4 h-4 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>Me localiser</span>
              </button>

              <div className="flex items-center gap-2 flex-1 relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  id="map-search-input"
                  name="map_search"
                  aria-label="Rechercher un quartier sur la carte"
                  type="text"
                  placeholder="Rechercher un quartier..."
                  autoComplete="off"
                  className="w-full pl-9 pr-12 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                  value={searchQuery}
                  onChange={e => handleMapAutocomplete(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      searchMapAddress()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={searchMapAddress}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg hover:opacity-80 transition-opacity flex items-center justify-center z-10 cursor-pointer"
                  aria-label="Rechercher"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>

                {/* Suggestions autocomplete */}
                {showSuggestions && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                    {suggestions.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-zinc-400 italic">Aucun résultat</p>
                    ) : (
                      suggestions.map((r, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`w-full text-left px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors flex items-start gap-3 cursor-pointer ${
                            i > 0 ? 'border-t border-zinc-100 dark:border-zinc-800' : ''
                          }`}
                          onClick={() => selectMapSuggestion(parseFloat(r.lat), parseFloat(r.lon))}
                        >
                          <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span className="line-clamp-2 text-xs">{r.display_name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Adresse trouvée (aperçu) */}
          {showAddressPreview && (
            <div className="px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900 flex-shrink-0 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium truncate">
                {addressText}
              </p>
            </div>
          )}

          {/* Carte Leaflet */}
          <div ref={mapContainerRef} className="flex-1 w-full relative z-0" style={{ minHeight: '300px' }} />

          {/* Footer modale */}
          <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-3 flex-shrink-0 bg-white dark:bg-zinc-950">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-sm font-semibold hover:border-zinc-400 rounded-xl transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmMapLocation}
              disabled={!selectedCoords}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/20"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Confirmer cette adresse</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
