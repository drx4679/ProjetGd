// ============================================================
// JWE Client (RFC 7516 : RSA-OAEP-256 + A256GCM)
// - Génère une paire de clés RSA-OAEP 2048 bits éphémère en mémoire RAM
// - La clé privée est NON-EXTRACTIBLE (extractable: false) : même depuis la
//   console F12, elle ne peut pas être exportée.
// - Le serveur chiffre les réponses API (/api/products, /api/cashpay-proxy)
//   en JWE compact : { success: true, encrypted: true, jwe: "eyJhbGci..." }
// ============================================================

type EphemeralSession = {
  publicKeyB64Url: string
  privateKey: CryptoKey
}

let sessionPromise: Promise<EphemeralSession> | null = null

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  const binary = atob(b64 + pad)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

async function getOrCreateSession(): Promise<EphemeralSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        false, // Clé privée non-extractible
        ['encrypt', 'decrypt']
      )
      const spkiBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey)
      const publicKeyB64Url = bytesToBase64Url(new Uint8Array(spkiBuffer))
      return {
        publicKeyB64Url,
        privateKey: keyPair.privateKey,
      }
    })()
  }
  return sessionPromise
}

export async function getJweRequestHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  try {
    const session = await getOrCreateSession()
    return {
      ...extra,
      'X-Pub-Key': session.publicKeyB64Url,
    }
  } catch {
    return extra
  }
}

export async function parseAndDecryptJwe<T = any>(payload: any): Promise<T> {
  if (!payload || typeof payload !== 'object' || !payload.encrypted || typeof payload.jwe !== 'string') {
    return payload as T
  }

  const parts = payload.jwe.split('.')
  if (parts.length !== 5) {
    throw new Error('Format JWE invalide')
  }

  const [headerB64, encryptedKeyB64, ivB64, ciphertextB64, tagB64] = parts
  const session = await getOrCreateSession()

  const encKeyBytes = base64UrlToBytes(encryptedKeyB64)
  const ivBytes = base64UrlToBytes(ivB64)
  const ciphertextBytes = base64UrlToBytes(ciphertextB64)
  const tagBytes = base64UrlToBytes(tagB64)

  // 1. Déchiffrer la clé AES-256 (CEK) avec la clé privée RSA-OAEP-256 non-extractible
  const cekBuffer = await window.crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    session.privateKey,
    encKeyBytes as BufferSource
  )

  // 2. Importer la CEK pour AES-256-GCM
  const aesKey = await window.crypto.subtle.importKey(
    'raw',
    cekBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  // 3. Recombiner ciphertext + tag (16 octets) pour WebCrypto AES-GCM
  const combined = new Uint8Array(ciphertextBytes.length + tagBytes.length)
  combined.set(ciphertextBytes, 0)
  combined.set(tagBytes, ciphertextBytes.length)

  const aad = new TextEncoder().encode(headerB64)
  const plainBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes as BufferSource,
      additionalData: aad,
      tagLength: 128,
    },
    aesKey,
    combined
  )

  const jsonText = new TextDecoder().decode(plainBuffer)
  return JSON.parse(jsonText) as T
}
