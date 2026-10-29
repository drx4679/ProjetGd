// ============================================================
// CashPay API (SEMOA TOGO) — Client léger (tout passe par /api/cashpay-proxy)
// Aucun secret n'est stocké côté client.
// ============================================================

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
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_order', payload: orderPayload }),
      signal: timeout.signal,
    })

    if (!response.ok) {
      const errMsg = await parseErrorMessage(response)
      const err = new Error(errMsg) as Error & { status?: number }
      err.status = response.status
      throw err
    }

    return await response.json()
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
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    return await response.json()
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error('Vérification expirée — le serveur ne répond pas')
    }
    throw e
  } finally {
    timeout.clear()
  }
}

/**
 * Génère une référence marchande unique (format GDS-TIMESTAMP-RAND).
 */
export function generateMerchantRef(): string {
  const ts = Date.now()
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `GDS-${ts}-${rand}`
}
