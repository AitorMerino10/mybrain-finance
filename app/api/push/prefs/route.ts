import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export type NotificationPrefs = {
  dailyReminder: boolean
  budgetAlerts: boolean
  goalAlerts: boolean
  warnPercent: number
  closeAlerts: boolean
  pendingAlerts: boolean
  forecastAlerts: boolean
  recurringAlerts: boolean
  /** Horas (de Madrid, 0-23) de los avisos programados */
  dailyHour: number
  pendingHour: number
  closeHour: number
  recurringHour: number
}

const DEFAULTS: NotificationPrefs = { dailyReminder: true, budgetAlerts: true, goalAlerts: true, warnPercent: 80,
  closeAlerts: true,
  pendingAlerts: true,
  forecastAlerts: true,
  recurringAlerts: true,
  dailyHour: 23,
  pendingHour: 20,
  closeHour: 9,
  recurringHour: 8,
}

function clampHour(value: unknown, fallback: number): number {
  const hour = Math.round(Number(value))
  return Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : fallback
}

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data } = await supabase.from('pml_cfg_notification_pref').select('*').eq('id_user', user.id).maybeSingle()
  const prefs: NotificationPrefs = data
    ? {
        dailyReminder: data.is_daily_reminder ?? true,
        budgetAlerts: data.is_budget_alerts,
        goalAlerts: data.is_goal_alerts ?? true,
        warnPercent: data.nu_warn_percent,
        closeAlerts: data.is_close_alerts,
        pendingAlerts: data.is_pending_alerts ?? true,
        forecastAlerts: data.is_forecast_alerts ?? true,
        recurringAlerts: data.is_recurring_alerts ?? true,
        dailyHour: data.nu_daily_hour ?? 23,
        pendingHour: data.nu_pending_hour ?? 20,
        closeHour: data.nu_close_hour ?? 9,
        recurringHour: data.nu_recurring_hour ?? 8,
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

  const row = {
    id_user: user.id,
    is_daily_reminder: Boolean(merged.dailyReminder),
    is_budget_alerts: Boolean(merged.budgetAlerts),
    is_goal_alerts: Boolean(merged.goalAlerts),
    nu_warn_percent: warnPercent,
    is_close_alerts: Boolean(merged.closeAlerts),
    is_pending_alerts: Boolean(merged.pendingAlerts),
    is_forecast_alerts: Boolean(merged.forecastAlerts),
    is_recurring_alerts: Boolean(merged.recurringAlerts),
    nu_daily_hour: clampHour(merged.dailyHour, DEFAULTS.dailyHour),
    nu_pending_hour: clampHour(merged.pendingHour, DEFAULTS.pendingHour),
    nu_close_hour: clampHour(merged.closeHour, DEFAULTS.closeHour),
    nu_recurring_hour: clampHour(merged.recurringHour, DEFAULTS.recurringHour),
    dt_updated: new Date().toISOString(),
  }
  let { error } = await supabase.from('pml_cfg_notification_pref').upsert(row)
  if (error && /nu_(daily|pending|close|recurring)_hour/.test(error.message)) {
    // Aún no se ha ejecutado la migración de las horas: se guarda el resto igualmente
    const { nu_daily_hour, nu_pending_hour, nu_close_hour, nu_recurring_hour, ...withoutHours } = row
    void nu_daily_hour, void nu_pending_hour, void nu_close_hour, void nu_recurring_hour
    ;({ error } = await supabase.from('pml_cfg_notification_pref').upsert(withoutHours))
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
