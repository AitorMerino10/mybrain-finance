import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient, isPushConfigured } from '@/lib/push'
import { processAlerts } from '@/lib/push-alerts'

export const dynamic = 'force-dynamic'

/** Tarea diaria: revisa todas las familias y envía los avisos pendientes (partidas, cierre, gastos sin partida). */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin || !isPushConfigured()) {
    return NextResponse.json({ error: 'Servidor sin configurar' }, { status: 500 })
  }

  const { data: families } = await admin.from('pml_dim_family').select('id_family')
  let sent = 0
  for (const family of families || []) {
    try {
      sent += await processAlerts(admin, { idFamily: family.id_family, includeCalendar: true })
    } catch (error) {
      console.error('Error en avisos de la familia', family.id_family, error)
    }
  }
  return NextResponse.json({ ok: true, sent })
}
