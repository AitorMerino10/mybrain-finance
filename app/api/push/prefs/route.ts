import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export type NotificationPrefs = {
  budgetAlerts: boolean
  warnPercent: number
  closeAlerts: boolean
  unassignedAlerts: boolean
}

const DEFAULTS: NotificationPrefs = { budgetAlerts: true, warnPercent: 80, closeAlerts: true, unassignedAlerts: true }

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data } = await supabase.from('pml_cfg_notification_pref').select('*').eq('id_user', user.id).maybeSingle()
  const prefs: NotificationPrefs = data
    ? {
        budgetAlerts: data.is_budget_alerts,
        warnPercent: data.nu_warn_percent,
        closeAlerts: data.is_close_alerts,
        unassignedAlerts: data.is_unassigned_alerts,
      }
    : DEFAULTS
  return NextResponse.json({ prefs })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { prefs } = (await req.json()) as { prefs?: Partial<NotificationPrefs> }
  if (!prefs) return NextResponse.json({ error: 'Faltan preferencias' }, { status: 400 })
  const merged = { ...DEFAULTS, ...prefs }
  const warnPercent = Math.min(99, Math.max(10, Math.round(Number(merged.warnPercent) || DEFAULTS.warnPercent)))

  const { error } = await supabase.from('pml_cfg_notification_pref').upsert({
    id_user: user.id,
    is_budget_alerts: Boolean(merged.budgetAlerts),
    nu_warn_percent: warnPercent,
    is_close_alerts: Boolean(merged.closeAlerts),
    is_unassigned_alerts: Boolean(merged.unassignedAlerts),
    dt_updated: new Date().toISOString(),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
