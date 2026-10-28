import { useState, useEffect, useRef, useCallback } from 'react'

const HQ_LAT = 6.193097
const HQ_LNG = 1.203188

// ── Haversine (fallback) ──
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Reverse geocoding Nominatim ──
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
  } catch {
    /* fallback ci-dessous */
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

// ── Distance et tracé OSRM ──
async function fetchRouteInfo(
  lat: number,
  lng: number
): Promise<{ distanceKm: number; geojson: any | null }> {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${HQ_LNG},${HQ_LAT};${lng},${lat}?overview=full&geometries=geojson`
    )
    const data = await res.json()
    if (data.routes?.[0]) {
      return {
        distanceKm: data.routes[0].distance / 1000,
        geojson: data.routes[0].geometry,
      }
    }
  } catch {
    /* fallback Haversine */
  }
  return {
    distanceKm: haversineKm(HQ_LAT, HQ_LNG, lat, lng),
    geojson: null,
  }
}

// ── Lazy load Leaflet ──
let leafletLoaded = false
function loadLeaflet(): Promise<void> {
  return new Promise(resolve => {
    if ((window as any).L) {
      leafletLoaded = true
      resolve()
      return
    }
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
      link.crossOrigin = ''
      document.head.appendChild(link)
    }
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
    script.crossOrigin = ''
    script.onload = () => {
      leafletLoaded = true
      resolve()
    }
    document.head.appendChild(script)
  })
}

type NominatimResult = { lat: string; lon: string; display_name: string }

async function searchNominatim(query: string, limit = 5): Promise<NominatimResult[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query + ' Togo'
      )}&limit=${limit}&addressdetails=1`,
      { headers: { 'Accept-Language': 'fr' } }
    )
    return await res.json()
  } catch {
    return []
  }
}

export function computeDeliveryFee(distKm: number): { fee: number; label: string } {
  if (distKm <= 10) return { fee: 1000, label: '1 000 FCFA' }
  if (distKm <= 15) return { fee: 1500, label: '1 500 FCFA' }
  if (distKm <= 20) return { fee: 2000, label: '2 000 FCFA' }
  return { fee: 0, label: "Défini à l'expédition" }
}

export default function MapModal({
  open,
  initialCoords,
  onClose,
  onConfirm,
}: {
  open: boolean
  initialCoords?: { lat: number; lng: number } | null
  onClose: () => void
  onConfirm: (lat: number, lng: number, address: string, distKm: number) => void
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const routeLayerRef = useRef<any>(null)

  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [distKm, setDistKm] = useState<number | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [locating, setLocating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const autoTimerRef = useRef<number | null>(null)

  const updatePosition = useCallback(async (lat: number, lng: number) => {
    setCoords({ lat, lng })
    setCalculating(true)
    setAddress("Localisation et calcul de l'itinéraire…")

    try {
      const [addr, routeInfo] = await Promise.all([
        reverseGeocode(lat, lng),
        fetchRouteInfo(lat, lng),
      ])

      setAddress(addr)
      setDistKm(routeInfo.distanceKm)

      const L = (window as any).L
      if (L && mapInstanceRef.current) {
        if (routeLayerRef.current) {
          mapInstanceRef.current.removeLayer(routeLayerRef.current)
          routeLayerRef.current = null
        }
        if (routeInfo.geojson) {
          routeLayerRef.current = L.geoJSON(routeInfo.geojson, {
            style: {
              color: '#0284c7',
              weight: 5,
              opacity: 0.85,
              dashArray: '8, 8',
            },
          }).addTo(mapInstanceRef.current)

          mapInstanceRef.current.fitBounds(routeLayerRef.current.getBounds(), {
            padding: [45, 45],
            maxZoom: 16,
          })
        }
      }
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    } finally {
      setCalculating(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
        routeLayerRef.current = null
      }
      return
    }

    let cancelled = false

    const init = async () => {
      await loadLeaflet()
      if (cancelled || !mapContainerRef.current) return

      const L = (window as any).L
      if (!L) return

      const startLat = initialCoords?.lat || HQ_LAT
      const startLng = initialCoords?.lng || HQ_LNG

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([startLat, startLng], initialCoords ? 15 : 14)

      L.control.zoom({ position: 'bottomright' }).addTo(map)
      L.control
        .attribution({ position: 'bottomleft', prefix: false })
        .addTo(map)
        .addAttribution('© <a href="https://www.openstreetmap.org/" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>')

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: 'abc',
      }).addTo(map)

      // Marqueur Siège GD (vert)
      const hqIcon = L.divIcon({
        className: '',
        html: '<div style="width:32px;height:32px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 12px rgba(16,185,129,.45);border:2.5px solid white;display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:10px;color:white;font-weight:800;letter-spacing:-.5px">GD</span></div>',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      })
      L.marker([HQ_LAT, HQ_LNG], { icon: hqIcon })
        .addTo(map)
        .bindPopup(
          "<div style=\"text-align:center;font-family:system-ui;padding:2px\"><strong style=\"font-size:12px;color:#0f172a\">GoodDoctor's Shop</strong><br><span style=\"font-size:10px;color:#64748b\">Siège — Lomé, Togo</span></div>"
        )

      // Marqueur livraison (bleu indigo avec aura animée)
      const deliveryIcon = L.divIcon({
        className: '',
        html: '<div style="position:relative"><div style="position:absolute;top:2px;left:2px;width:36px;height:36px;background:rgba(2,132,199,.25);border-radius:50%;animation:pulse 2s infinite"></div><div style="position:relative;width:40px;height:40px;background:linear-gradient(135deg,#0284c7,#0369a1);border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 14px rgba(2,132,199,.4);border:2.5px solid white;display:flex;align-items:center;justify-content:center"><svg style="transform:rotate(45deg)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div></div>',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      })
      const marker = L.marker([startLat, startLng], { icon: deliveryIcon, draggable: true }).addTo(map)
      markerRef.current = marker

      marker.on('dragend', (e: any) => {
        const { lat, lng } = e.target.getLatLng()
        updatePosition(lat, lng)
      })

      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng
        marker.setLatLng([lat, lng])
        updatePosition(lat, lng)
        setShowSuggestions(false)
      })

      mapInstanceRef.current = map

      map.invalidateSize()
      setTimeout(() => map.invalidateSize(), 150)

      updatePosition(startLat, startLng)
    }

    const timer = setTimeout(init, 100)
    return () => {
      cancelled = true
      clearTimeout(timer)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
        routeLayerRef.current = null
      }
    }
  }, [open, initialCoords, updatePosition])

  const handleSearchInput = (val: string) => {
    setSearchQuery(val)
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    if (val.trim().length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    autoTimerRef.current = window.setTimeout(async () => {
      const results = await searchNominatim(val)
      setSuggestions(results)
      setShowSuggestions(results.length > 0)
    }, 350)
  }

  const selectSuggestion = (r: NominatimResult) => {
    setShowSuggestions(false)
    setSuggestions([])
    setSearchQuery('')
    const lat = parseFloat(r.lat)
    const lng = parseFloat(r.lon)
    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([lat, lng], 16)
      markerRef.current.setLatLng([lat, lng])
    }
    updatePosition(lat, lng)
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setShowSuggestions(false)
    const results = await searchNominatim(searchQuery, 1)
    if (results.length > 0) selectSuggestion(results[0])
  }

  const handleGPS = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    setShowSuggestions(false)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([lat, lng], 16)
          markerRef.current.setLatLng([lat, lng])
        }
        updatePosition(lat, lng)
        setLocating(false)
      },
      () => {
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  if (!open) return null

  const currentFee = distKm !== null ? computeDeliveryFee(distKm) : null

  return (
    <div className="map-modal-overlay" onClick={onClose}>
      <div className="map-modal-panel" onClick={e => e.stopPropagation()}>
        {/* Poignée mobile */}
        <div className="map-modal-handle" />

        {/* En-tête */}
        <div className="map-modal-header">
          <div>
            <div className="map-modal-eyebrow">LIVRAISON À LOMÉ &amp; TOGO</div>
            <h3>Point de livraison</h3>
            <p className="map-modal-subtitle">Déplacez le marqueur bleu pour ajuster votre adresse</p>
          </div>
          <button
            type="button"
            className="map-modal-close"
            onClick={onClose}
            aria-label="Fermer la carte"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Barre GPS & Recherche */}
        <div className="map-modal-actions">
          <button
            type="button"
            className={`map-btn-gps ${locating ? 'loading' : ''}`}
            onClick={handleGPS}
            disabled={locating}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {locating ? 'Localisation…' : 'Me localiser'}
          </button>

          <div className="map-search-box">
            <svg
              className="map-search-icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="map-search-input"
              placeholder="Rechercher un quartier (Tokoin, Bè, Hedzranawoé…)"
              value={searchQuery}
              onChange={e => handleSearchInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSearch()
                }
              }}
              autoComplete="off"
            />
            {searchQuery && (
              <button
                type="button"
                className="map-search-clear"
                onClick={() => {
                  setSearchQuery('')
                  setSuggestions([])
                  setShowSuggestions(false)
                }}
                aria-label="Effacer la recherche"
              >
                ✕
              </button>
            )}
            <button
              type="button"
              className="map-search-submit"
              onClick={handleSearch}
              aria-label="Rechercher"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {/* Suggestions auto */}
            {showSuggestions && (
              <div className="map-suggestions">
                {suggestions.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    className="map-suggestion-item"
                    onClick={() => selectSuggestion(r)}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{r.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Aperçu adresse sélectionnée */}
        {address && (
          <div className="map-address-preview">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <p>{address}</p>
          </div>
        )}

        {/* Conteneur Leaflet */}
        <div ref={mapContainerRef} className="map-leaflet-container" />

        {/* Pied de page */}
        <div className="map-modal-footer">
          <button type="button" className="map-btn-cancel" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="map-btn-confirm"
            disabled={!coords || calculating}
            onClick={() => {
              if (coords && distKm !== null) {
                onConfirm(coords.lat, coords.lng, address, distKm)
              } else {
                onClose()
              }
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>
              Confirmer cette adresse
              {currentFee && currentFee.fee > 0 ? ` · ${currentFee.label}` : ''}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
