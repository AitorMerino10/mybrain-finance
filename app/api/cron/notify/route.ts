import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient, isPushConfigured } from '@/lib/push'
import { processAlerts } from '@/lib/push-alerts'
import { generateRecurringPending, RECURRING_MIN_HOUR } from '@/lib/recurring-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Tarea que se lanza cada hora (ver .github/workflows/notify.yml). Según la hora de Madrid:
 * - crea los gastos pendientes de los gastos recurrentes que toca cobrar hoy (a partir de las 8:00) y avisa
 * - envía el aviso de gastos pendientes sin completar (20:00)
 * - envía el recordatorio diario de gastos (23:00)
 * - envía el aviso de cerrar el mes (día 1, a partir de las 9:00)
 * `?force=daily|close|pending` fuerza ese aviso ahora (para probar).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Servidor sin configurar' }, { status: 500 })
  }

  const forceParam = req.nextUrl.searchParams.get('force')
  const force = forceParam === 'daily' || forceParam === 'close' || forceParam === 'pending' ? forceParam : undefined

  // Los recurrentes se generan aunque las notificaciones no estén configuradas
  let recurring = { created: 0, notified: 0 }
  try {
    recurring = await generateRecurringPending(admin, { minHour: force ? undefined : RECURRING_MIN_HOUR })
  } catch (error) {
    console.error('Error generando gastos recurrentes', error)
  }

  if (!isPushConfigured()) {
    return NextResponse.json({ ok: true, sent: 0, recurring })
  }

  const { data: families } = await admin.from('pml_dim_family').select('id_family')
  let sent = 0
  for (const family of families || []) {
    try {
      sent += await processAlerts(admin, { idFamily: family.id_family, scheduled: true, force })
    } catch (error) {
      console.error('Error en avisos de la familia', family.id_family, error)
    }
  }
  return NextResponse.json({ ok: true, sent, recurring })
}
