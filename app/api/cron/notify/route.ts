import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient, isPushConfigured } from '@/lib/push'
import { processAlerts } from '@/lib/push-alerts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Tarea que se lanza cada hora (ver .github/workflows/notify.yml). Según la hora de Madrid envía:
 * - el recordatorio diario de gastos (23:00)
 * - el aviso de cerrar el mes (día 1, a partir de las 9:00)
 * `?force=daily|close` fuerza ese aviso ahora (para probar).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin || !isPushConfigured()) {
    return NextResponse.json({ error: 'Servidor sin configurar' }, { status: 500 })
  }

  const forceParam = req.nextUrl.searchParams.get('force')
  const force = forceParam === 'daily' || forceParam === 'close' ? forceParam : undefined

  const { data: families } = await admin.from('pml_dim_family').select('id_family')
  let sent = 0
  for (const family of families || []) {
    try {
      sent += await processAlerts(admin, { idFamily: family.id_family, scheduled: true, force })
    } catch (error) {
      console.error('Error en avisos de la familia', family.id_family, error)
    }
  }
  return NextResponse.json({ ok: true, sent })
}
