// ============================================================
// CashPay API (SEMOA TOGO) — Client léger (tout passe par /api/cashpay-proxy)
// Aucun secret n'est stocké côté client.
// ============================================================

import { getJweRequestHeaders, parseAndDecryptJwe } from './jweClient'

const PROXY_URL = '/api/cashpay-proxy'

export type CashPayOrderItem = {
  id?: string
  name: string
  quantity: number
  price: number
  selectedColor?: string | null
  selectedSize?: string | null
}

export type CreateCashPayOrderInput = {
  amount: number
  phone: string
  firstname: string
  lastname: string
  address: string
  city?: string
  country?: string
  merchantRef: string
  description?: string
  items?: CashPayOrderItem[]
  deliveryCoords?: { lat: number; lng: number } | null
  deliveryFee?: number
  existingOrderNumber?: string | null
}

export type CashPayOrderResponse = {
  order_reference?: string
  bill_url?: string
  state?: string
  status?: string
  [key: string]: any
}

function createTimeout(ms = 20000) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => window.clearTimeout(timer) }
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json()
    return data.error || data.message || `Erreur ${response.status}`
  } catch {
    return `Erreur serveur (${response.status})`
  }
}

/**
 * Crée une commande Link2Pay via le proxy serveur (/api/cashpay-proxy)
 * et l'enregistre dans Supabase.
 */
export async function createOrder({
  amount,
  phone,
  firstname,
  lastname,
  address,
  city = 'Lomé',
  country = 'Togo',
  merchantRef,
  description,
  items,
  deliveryCoords,
  deliveryFee,
  existingOrderNumber,
}: CreateCashPayOrderInput): Promise<CashPayOrderResponse> {
  const orderPayload = {
    amount: Math.round(amount),
    currency: 'XOF',
    merchant_reference: merchantRef,
    description: description || "Commande GoodDoctor's Shop",
    type_notif: ['SMS'],
    client: {
      phone: String(phone || ''),
      firstname: firstname || '',
      lastname: lastname || '',
      address1: address || '',
      city,
      country,
    },
    items: items || [],
    delivery_lat: deliveryCoords?.lat ?? null,
    delivery_lng: deliveryCoords?.lng ?? null,
    delivery_fee: typeof deliveryFee === 'number' && deliveryFee > 0 ? Math.round(deliveryFee) : 0,
    existing_order_number: existingOrderNumber || null,
  }

  const timeout = createTimeout(20000)
  try {
    const headers = await getJweRequestHeaders({ 'Content-Type': 'application/json' })
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'create_order', payload: orderPayload }),
      signal: timeout.signal,
    })

    if (!response.ok) {
      const errMsg = await parseErrorMessage(response)
      const err = new Error(errMsg) as Error & { status?: number }
      err.status = response.status
      throw err
    }

    const raw = await response.json()
    return await parseAndDecryptJwe<CashPayOrderResponse>(raw)
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      const err = new Error('Le serveur ne répond pas. Vérifiez votre connexion et réessayez.') as Error & {
        status?: number
      }
      err.status = 408
      throw err
    }
    throw e
  } finally {
    timeout.clear()
  }
}

/**
 * Vérifie le statut d'une commande auprès de CashPay et Supabase via le proxy serveur.
 */
export async function getOrderStatus(orderReference: string, merchantRef?: string): Promise<any> {
  const timeout = createTimeout(15000)
  try {
    const headers = await getJweRequestHeaders({ 'Content-Type': 'application/json' })
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'check_status',
        orderReference,
        merchantRef: merchantRef || orderReference,
      }),
      signal: timeout.signal,
    })

    if (!response.ok) {
      const errMsg = await parseErrorMessage(response)
      throw new Error(errMsg)
    }

    const raw = await response.json()
    return await parseAndDecryptJwe<any>(raw)
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error('Vérification expirée — le serveur ne répond pas')
    }
    throw e
  } finally {
    timeout.clear()
  }
}

export type TrackedOrder = {
  id: number | string
  order_number: string
  merchant_reference?: string | null
  cashpay_order_ref?: string | null
  cashpay_bill_url?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_address?: string | null
  delivery_address?: string | null
  delivery_city?: string | null
  delivery_country?: string | null
  items?: Array<{
    id?: string
    name: string
    quantity: number
    price: number
    image_url?: string
    variant?: string | null
    selectedColor?: string | null
    selectedSize?: string | null
  }> | null
  total_amount?: number | null
  delivery_fee?: number | null
  final_amount?: number | null
  currency?: string | null
  status?: string | null
  payment_status?: string | null
  is_processing?: boolean | null
  is_shipped?: boolean | null
  is_delivered?: boolean | null
  created_at?: string | null
  updated_at?: string | null
  paid_at?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  delivery_lat?: number | null
  delivery_lng?: number | null
  delivery_latitude?: number | null
  delivery_longitude?: number | null
}

/**
 * Recherche les commandes d'un client par numéro de téléphone et/ou par référence de commande.
 */
export async function trackOrders(phone: string, orderRef?: string): Promise<TrackedOrder[]> {
  const timeout = createTimeout(15000)
  try {
    const headers = await getJweRequestHeaders({ 'Content-Type': 'application/json' })
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'track_orders',
        phone: phone.trim(),
        orderRef: (orderRef || '').trim(),
      }),
      signal: timeout.signal,
    })

    if (!response.ok) {
      const errMsg = await parseErrorMessage(response)
      throw new Error(errMsg)
    }

    const raw = await response.json()
    const data = await parseAndDecryptJwe<{ orders?: TrackedOrder[] }>(raw)
    return Array.isArray(data?.orders) ? data.orders : []
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error('Délai dépassé — vérifiez votre connexion et réessayez.')
    }
    throw e
  } finally {
    timeout.clear()
  }
}

/**
 * Supprime une commande depuis le suivi client.
 */
export async function deleteTrackedOrder(orderNumber: string, phone?: string): Promise<void> {
  const timeout = createTimeout(12000)
  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_order',
        orderNumber: orderNumber.trim(),
        phone: (phone || '').trim(),
      }),
      signal: timeout.signal,
    })

    if (!response.ok) {
      const errMsg = await parseErrorMessage(response)
      throw new Error(errMsg)
    }
  } finally {
    timeout.clear()
  }
}

/**
 * Génère une référence marchande unique (format GDS-TIMESTAMP-RAND).
 */
export function generateMerchantRef(): string {
  const ts = Date.now()
  const arr = new Uint8Array(6)
  window.crypto.getRandomValues(arr)
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let rand = ''
  for (let i = 0; i < arr.length; i++) {
    rand += chars[arr[i] % chars.length]
  }
  return `GDS-${ts}-${rand}`
}
