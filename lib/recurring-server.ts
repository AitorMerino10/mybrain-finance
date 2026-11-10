import { formatCurrency } from '@/lib/format'
import { sendPushToUser, type AdminClient } from '@/lib/push'
import { nowInMadrid } from '@/lib/push-alerts'
import { nextOccurrenceAfter } from '@/lib/recurring'

/** Hora (Madrid) por defecto a partir de la cual la tarea programada crea los pendientes recurrentes del día */
export const RECURRING_MIN_HOUR = 8

/** Máximo de cobros atrasados que se crean de golpe para una regla (por si la tarea estuvo parada) */
const MAX_CATCH_UP = 6

/**
 * Crea un gasto PENDIENTE por cada cobro recurrente que ya toca (fecha de cobro hasta hoy, hora de Madrid),
 * avisa a la persona y avanza la regla a su siguiente cobro. No toca los números: el gasto cuenta cuando la persona
 * lo completa. Es idempotente: se puede lanzar tantas veces como se quiera.
 */
export async function generateRecurringPending(
  admin: AdminClient,
  options: { idFamily?: string; notify?: boolean; respectUserHours?: boolean } = {}
): Promise<{ created: number; notified: number }> {
  const { today, hour } = nowInMadrid()

  let query = admin.from('pml_cfg_recurring_expense').select('*').eq('is_active', true).lte('dt_next', today)
  if (options.idFamily) query = query.eq('id_family', options.idFamily)
  const { data: dueRules, error } = await query
  if (error) {
    console.error('Error cargando gastos recurrentes:', error.message)
    return { created: 0, notified: 0 }
  }
  if (!dueRules || dueRules.length === 0) return { created: 0, notified: 0 }

  // La tarea programada espera a la hora que cada persona ha elegido (por defecto, la mañana) para que el aviso no suene de madrugada
  let rules = dueRules
  if (options.respectUserHours) {
    const owners = Array.from(new Set(dueRules.map((rule) => rule.id_user_creator || rule.ds_user_ids[0]).filter(Boolean))) as string[]
    const { data: hourRows } = await admin.from('pml_cfg_notification_pref').select('id_user, nu_recurring_hour').in('id_user', owners)
    const hourByUser = new Map((hourRows || []).map((row) => [row.id_user, row.nu_recurring_hour]))
    rules = dueRules.filter((rule) => {
      const owner = rule.id_user_creator || rule.ds_user_ids[0]
      return hour >= (hourByUser.get(owner) ?? RECURRING_MIN_HOUR)
    })
    if (rules.length === 0) return { created: 0, notified: 0 }
  }

  type Created = { idUser: string; idFamily: string; idPending: string; name: string; amount: number }
  const created: Created[] = []

  for (const rule of rules) {
    // Persona a la que le llega el pendiente: quien creó la regla o, si ya no está, la primera persona afectada
    const owner = rule.id_user_creator || rule.ds_user_ids[0] || null
    let next = rule.dt_next
    let lastGenerated = rule.dt_last_generated
    let active = true
    let failed = false

    for (let i = 0; i < MAX_CATCH_UP && next <= today; i += 1) {
      if (rule.dt_end && next > rule.dt_end) {
        active = false
        break
      }
      if (!owner) {
        console.error('El gasto recurrente no tiene a quién avisar:', rule.ds_name)
        failed = true
        break
      }

      // Por si la tarea se lanzó dos veces a la vez: no se duplica el pendiente de ese cobro
      const { data: existing } = await admin
        .from('pml_pending_transaction')
        .select('id_pending_transaction')
        .eq('id_recurring_expense', rule.id_recurring_expense)
        .eq('dt_date', next)
        .limit(1)

      if (!existing || existing.length === 0) {
        const { data: pending, error: insertError } = await admin
          .from('pml_pending_transaction')
          .insert({
            id_user: owner,
            id_family: rule.id_family,
            ft_amount: rule.ft_amount,
            ds_merchant: rule.ds_name,
            ds_card: null,
            dt_date: next,
            ds_source: 'recurring',
            id_recurring_expense: rule.id_recurring_expense,
          })
          .select('id_pending_transaction')
          .single()
        if (insertError || !pending) {
          console.error('Error creando el pendiente recurrente', rule.ds_name, insertError?.message)
          failed = true
          break
        }
        created.push({ idUser: owner, idFamily: rule.id_family, idPending: pending.id_pending_transaction, name: rule.ds_name, amount: Number(rule.ft_amount) })
      }

      lastGenerated = next
      next = nextOccurrenceAfter(rule, next)
    }

    if (rule.dt_end && next > rule.dt_end) active = false
    if (failed && next === rule.dt_next) continue
    await admin
      .from('pml_cfg_recurring_expense')
      .update({ dt_next: next, dt_last_generated: lastGenerated, is_active: active })
      .eq('id_recurring_expense', rule.id_recurring_expense)
  }

  let notified = 0
  if (options.notify !== false && created.length > 0) {
    const byUser = new Map<string, Created[]>()
    created.forEach((item) => byUser.set(item.idUser, [...(byUser.get(item.idUser) || []), item]))
    const userIds = Array.from(byUser.keys())
    const { data: prefRows } = await admin.from('pml_cfg_notification_pref').select('id_user, is_recurring_alerts').in('id_user', userIds)
    const muted = new Set((prefRows || []).filter((row) => row.is_recurring_alerts === false).map((row) => row.id_user))

    for (const [idUser, items] of Array.from(byUser.entries())) {
      if (muted.has(idUser)) continue
      const single = items.length === 1 ? items[0] : null
      const total = items.reduce((sum, item) => sum + item.amount, 0)
      const delivered = await sendPushToUser(admin, idUser, {
        title: single ? `Hoy se cobra ${single.name}` : `Hoy se cobran ${items.length} gastos recurrentes`,
        body: single
          ? `${formatCurrency(single.amount)}. Toca para completarlo cuando se haya cobrado.`
          : `${formatCurrency(total)} en total: ${items.map((item) => item.name).join(', ')}. Complétalos cuando se cobren.`,
        url: single ? `/?family=${single.idFamily}&pending=${single.idPending}` : `/?family=${items[0].idFamily}`,
        tag: 'recurring-pending',
      })
      if (delivered > 0) notified += 1
    }
  }

  return { created: created.length, notified }
}
