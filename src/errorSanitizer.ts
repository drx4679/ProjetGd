/**
 * Masque et filtre toutes les erreurs techniques pour les utilisateurs en mode production.
 * Remplace tout message contenant du jargon de développement (TypeError, Cannot read properties,
 * undefined, generateKey, NetworkError, failed to fetch, etc.) par un message élégant et compréhensible.
 */
export function sanitizeUserErrorMessage(
  err: unknown,
  fallback = 'Une erreur temporaire est survenue. Veuillez vérifier vos informations ou réessayer dans un instant.'
): string {
  if (!err) return fallback
  const raw = String((err as any)?.message || err || '').trim()
  if (!raw) return fallback

  const technicalKeywords = [
    'cannot read',
    'undefined',
    'null is not',
    'generatekey',
    'typeerror',
    'syntaxerror',
    'referenceerror',
    'subtle',
    'crypto',
    'failed to fetch',
    'networkerror',
    'fetch failed',
    'json.parse',
    'unexpected token',
    'jwt',
    'jwe',
    'internal server error',
    'bad gateway',
    '[object object]',
    'status code',
    'at ',
    'anonymous',
  ]

  const lower = raw.toLowerCase()
  const isTechnical = technicalKeywords.some(kw => lower.includes(kw))

  if (isTechnical) {
    if (lower.includes('fetch') || lower.includes('network') || lower.includes('timeout') || lower.includes('abort')) {
      return 'Problème de connexion au serveur. Veuillez vérifier votre réseau internet et réessayer.'
    }
    return fallback
  }

  return raw
}
