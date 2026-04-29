import { createHmac } from 'crypto'

const SECRET = process.env.CALENDAR_SECRET ?? 'beeme-calendar-secret-change-in-prod'

export function generateCalendarToken(userId: string): string {
  const hmac = createHmac('sha256', SECRET).update(userId).digest('hex')
  return Buffer.from(`${userId}:${hmac}`).toString('base64url')
}

export function verifyCalendarToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const colonIdx = decoded.indexOf(':')
    if (colonIdx === -1) return null
    const userId = decoded.slice(0, colonIdx)
    const hmac   = decoded.slice(colonIdx + 1)
    const expected = createHmac('sha256', SECRET).update(userId).digest('hex')
    return hmac === expected ? userId : null
  } catch {
    return null
  }
}
