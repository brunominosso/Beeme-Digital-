/**
 * Rate limiter em memória por IP.
 * Limita chamadas por janela de tempo.
 * Nota: em serverless cada instância tem seu próprio estado.
 * Para produção de escala, usar Vercel KV ou Upstash Redis.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Limpa entradas expiradas a cada 5 minutos
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

export interface RateLimitOptions {
  /** Máximo de requisições na janela */
  limit: number
  /** Janela em segundos */
  windowSec: number
}

export function rateLimit(
  identifier: string,
  opts: RateLimitOptions
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const windowMs = opts.windowSec * 1000
  const entry = store.get(identifier)

  if (!entry || entry.resetAt < now) {
    const resetAt = now + windowMs
    store.set(identifier, { count: 1, resetAt })
    return { success: true, remaining: opts.limit - 1, resetAt }
  }

  if (entry.count >= opts.limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { success: true, remaining: opts.limit - entry.count, resetAt: entry.resetAt }
}

export function getIP(req: Request): string {
  const forwarded = req instanceof Request
    ? req.headers.get('x-forwarded-for')
    : null
  return forwarded?.split(',')[0]?.trim() ?? 'unknown'
}
