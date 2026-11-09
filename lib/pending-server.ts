import { createHash, randomBytes } from 'crypto'

/** Clave personal del atajo: se enseña una sola vez y en la base de datos solo se guarda su hash. */
export function generateApiToken(): string {
  return `mbp_${randomBytes(24).toString('hex')}`
}

export function hashApiToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Convierte el importe que manda el móvil en número: admite "12,50", "12.50", "12,50 €", "1.234,56", "-12,5"...
 * Devuelve null si no hay un importe válido.
 */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw !== 0 ? Math.round(Math.abs(raw) * 100) / 100 : null
  if (typeof raw !== 'string') return null
  let text = raw.replace(/[^\d.,-]/g, '').replace(/-/g, '')
  if (!text) return null

  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    // El separador que va el último es el decimal
    const decimal = lastComma > lastDot ? ',' : '.'
    const thousands = decimal === ',' ? '.' : ','
    text = text.split(thousands).join('').replace(decimal, '.')
  } else if (lastComma >= 0) {
    text = /^\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, '') : text.replace(',', '.')
  } else if (lastDot >= 0 && /^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '')
  }

  const value = Number(text)
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100) / 100
}

/** Fecha en formato AAAA-MM-DD a partir de "2026-11-09", "09/11/2026", "9 nov 2026"... Si no se entiende, la de hoy (Madrid). */
export function parseDate(raw: unknown): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  if (typeof raw !== 'string' || !raw.trim()) return today
  const text = raw.trim()
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const european = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/)
  if (european) return `${european[3]}-${european[2].padStart(2, '0')}-${european[1].padStart(2, '0')}`
  return today
}

export function cleanText(raw: unknown, max = 120): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, max) : null
}

/** Latitud/longitud que manda el móvil ("41,3874", "41.3874"...). null si no es válida o vale 0 en ambas. */
export function parseCoordinate(raw: unknown, limit: number): number | null {
  const cleaned = typeof raw === 'string' ? raw.replace(/[^\d.,-]/g, '').replace(',', '.') : ''
  const value = typeof raw === 'number' ? raw : cleaned ? Number(cleaned) : NaN
  if (!Number.isFinite(value) || Math.abs(value) > limit) return null
  return Math.round(value * 1e6) / 1e6
}
