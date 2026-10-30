import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Vite config — https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const emitSourcemaps = mode === 'development'

  return {
    base: '/',
    build: {
      sourcemap: emitSourcemaps ? 'inline' : false,
      minify: !emitSourcemaps,
    },
    plugins: [
      react(),
      tailwindcss(),
      gdSecurityPlugin(),
      gdLocalApiPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: parseInt(process.env.PORT || '8443'),
      strictPort: true,
      fs: {
        // Interdit la lecture de fichiers sensibles via /@fs/ même hors racine du projet
        strict: true,
        deny: ['.env', '.env.*', '*.{crt,pem,key}', '**/.git/**', 'netlify.toml'],
      },
    },
    preview: {
      host: '0.0.0.0',
      port: parseInt(process.env.PORT || '8443'),
    },
  }
})

/**
 * API locale (dev uniquement) : sert /api/products et /api/cashpay-proxy avec LE MÊME code
 * que les Netlify Edge Functions (netlify/edge-functions/*.ts). Les variables du fichier .env
 * (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CASHPAY_*...) sont lues ici, côté Node :
 * elles ne sont jamais envoyées au navigateur (seules les variables préfixées VITE_ le sont).
 * En production, c'est Netlify qui exécute les Edge Functions.
 */
function gdLocalApiPlugin(): Plugin {
  return {
    name: 'gd-local-api',
    apply: 'serve',
    configureServer(server) {
      // Simule le global `Netlify` du runtime Deno de Netlify (rechargé à chaque appel pour prendre en compte les modifs de .env)
      ;(globalThis as any).Netlify = {
        env: {
          get: (key: string) => {
            const env = loadEnv(server.config.mode, server.config.root, '')
            return env[key] || process.env[key]
          },
        },
      }

      const mountEdgeFunction = (routePath: string, modulePath: string) => {
        server.middlewares.use(routePath, async (req, res, next) => {
          try {
            const mod = await server.ssrLoadModule(modulePath)
            const method = req.method || 'GET'
            const proto = (req.headers['x-forwarded-proto'] as string) || 'http'
            const host = req.headers.host || 'localhost:8443'
            const url = `${proto}://${host}${routePath}`

            const chunks: Buffer[] = []
            if (method !== 'GET' && method !== 'HEAD') {
              for await (const chunk of req) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
              }
            }
            const bodyBuf = chunks.length > 0 ? Buffer.concat(chunks) : undefined

            const headers = new Headers()
            for (const [k, v] of Object.entries(req.headers)) {
              if (typeof v === 'string') headers.set(k, v)
              else if (Array.isArray(v)) headers.set(k, v.join(', '))
            }

            const request = new Request(url, {
              method,
              headers,
              body: bodyBuf && bodyBuf.length > 0 ? bodyBuf : undefined,
            })
            const response: Response = await mod.default(request, { ip: req.socket.remoteAddress })
            res.statusCode = response.status
            response.headers.forEach((value, key) => res.setHeader(key, value))
            res.end(Buffer.from(await response.arrayBuffer()))
          } catch (err) {
            next(err as Error)
          }
        })
      }

      mountEdgeFunction('/api/products', '/netlify/edge-functions/products.ts')
      mountEdgeFunction('/api/cashpay-proxy', '/netlify/edge-functions/cashpay-proxy.ts')
    },
  }
}

/**
 * Sécurité GoodDoctor's Shop — source unique de la Content-Security-Policy.
 * - Build : injecte une balise <meta> CSP stricte (sans 'unsafe-inline' pour les scripts),
 *   valable quel que soit l'hébergeur (Netlify...).
 * - Preview (`vite preview`) : envoie aussi les en-têtes HTTP de production.
 * - Dev : seuls les en-têtes inoffensifs sont posés (le HMR de Vite a besoin de scripts inline).
 * Garder en cohérence avec les en-têtes de netlify.toml.
 */
function gdSecurityPlugin(): Plugin {
  const SUPABASE = 'https://jhybjpetiotzbtkfbxkr.supabase.co'
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: blob: ${SUPABASE} https://images.unsplash.com https://*.tile.openstreetmap.org https://unpkg.com`,
    `connect-src 'self' https://nominatim.openstreetmap.org https://router.project-osrm.org`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  const baseHeaders: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()',
  }
  const strictHeaders: Record<string, string> = {
    ...baseHeaders,
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy': `${csp}; frame-ancestors 'none'`,
  }
  const apply = (headers: Record<string, string>) =>
    (_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
      next()
    }

  return {
    name: 'gd-security',
    configureServer(server) {
      server.middlewares.use(apply(baseHeaders))
    },
    configurePreviewServer(server) {
      server.middlewares.use(apply(strictHeaders))
    },
    transformIndexHtml(_html, ctx) {
      // ctx.bundle n'existe qu'au build : pas de CSP stricte en dev.
      if (!ctx.bundle) return
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}
