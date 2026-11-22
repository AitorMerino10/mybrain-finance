import { formatCurrency } from '@/lib/format'
import { sendPushToUser, type AdminClient } from '@/lib/push'
import { nowInMadrid } from '@/lib/push-alerts'
import { firstOccurrenceOnOrAfter, materializePlan, type RecurringExpense } from '@/lib/recurring'

/** Hora (Madrid) por defecto a partir de la cual la tarea programada crea los pendientes recurrentes del día */
export const RECURRING_MIN_HOUR = 8

function isDuplicateInsert(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '23505' || /duplicate key/i.test(error.message || '')
}

function isChargeDate(rule: Pick<RecurringExpense, 'dt_start' | 'dt_end' | 'nu_day_of_month' | 'nu_every_months'>, date: string): boolean {
  const day = date.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  if (day < rule.dt_start.slice(0, 10)) return false
  if (rule.dt_end && day > rule.dt_end.slice(0, 10)) return false
  return firstOccurrenceOnOrAfter(rule, day) === day
}

type PendingRow = { id_pending_transaction: string; id_recurring_expense: string | null; dt_date: string; dt_created: string }

/** Quita copias de más de un mismo cobro. La tarea corre cada 10 minutos y, si no, un solo gasto acaba en decenas de pendientes. */
async function removeExtraRecurringPending(admin: AdminClient, today: string, idFamily?: string) {
  let query = admin
    .from('pml_pending_transaction')
    .select('id_pending_transaction, id_recurring_expense, dt_date, dt_created')
    .not('id_recurring_expense', 'is', null)
  if (idFamily) query = query.eq('id_family', idFamily)
  const { data: rows, error } = await query.limit(2000)
  if (error || !rows || rows.length === 0) {
    if (error) console.error('Error revisando pendientes recurrentes:', error.message)
    return
  }

  const ruleIds = Array.from(new Set(rows.map((row) => row.id_recurring_expense).filter((id): id is string => Boolean(id))))
  const { data: rules, error: ruleError } = await admin.from('pml_cfg_recurring_expense').select('*').in('id_recurring_expense', ruleIds)
  if (ruleError || !rules) {
    if (ruleError) console.error('Error cargando reglas para limpiar pendientes:', ruleError.message)
    return
  }
  const byId = new Map(rules.map((rule) => [rule.id_recurring_expense, rule]))
  const grouped = new Map<string, PendingRow[]>()
  for (const row of rows) {
    if (!row.id_recurring_expense) continue
    const list = grouped.get(row.id_recurring_expense) || []
    list.push(row)
    grouped.set(row.id_recurring_expense, list)
  }

  const drop = new Set<string>()
  for (const [ruleId, list] of Array.from(grouped.entries())) {
    const rule = byId.get(ruleId)
    if (!rule) continue
    let keep = list
    try {
      const real = list.filter((row) => isChargeDate(rule, row.dt_date))
      const bogus = list.filter((row) => !real.includes(row))
      // Si el cobro de verdad sigue pendiente de generarse, se tiran las fechas que no tocan.
      // Si la regla ya avanzó y ninguna fecha cuadra, se deja la más reciente por si el cálculo no coincide.
      if (real.length > 0 || rule.dt_next.slice(0, 10) <= today) {
        bogus.forEach((row) => drop.add(row.id_pending_transaction))
        if (real.length === 0) continue
        keep = real
      }
    } catch (cause) {
      console.error('No se pudo revisar el recurrente', rule.ds_name, cause)
      continue
    }

    const byDate = new Map<string, PendingRow>()
    for (const row of keep) {
      const date = row.dt_date.slice(0, 10)
      const current = byDate.get(date)
      if (!current || row.dt_created < current.dt_created) byDate.set(date, row)
    }
    for (const row of keep) {
      const keeper = byDate.get(row.dt_date.slice(0, 10))
      if (keeper && keeper.id_pending_transaction !== row.id_pending_transaction) drop.add(row.id_pending_transaction)
    }
    const dates = Array.from(byDate.keys()).sort()
    if (dates.length > 6) {
      const keepDate = dates[dates.length - 1]
      Array.from(byDate.entries()).forEach(([date, row]) => {
        if (date !== keepDate) drop.add(row.id_pending_transaction)
      })
    }
  }

  const ids = Array.from(drop)
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const { error: deleteError } = await admin.from('pml_pending_transaction').delete().in('id_pending_transaction', chunk)
    if (deleteError) console.error('Error borrando pendientes recurrentes duplicados:', deleteError.message)
  }
}

/**
 * Crea el gasto PENDIENTE del cobro recurrente que ya toca (solo el más reciente, a la hora de Madrid),
 * avisa a la persona y avanza la regla a su siguiente cobro. No toca los números: el gasto cuenta cuando la persona
 * lo completa. Es idempotente: se puede lanzar cada 10 minutos sin duplicar el pendiente.
 */
export async function generateRecurringPending(
  admin: AdminClient,
  options: { idFamily?: string; notify?: boolean; respectUserHours?: boolean } = {}
): Promise<{ created: number; notified: number }> {
  const { today, hour } = nowInMadrid()
  try {
    await removeExtraRecurringPending(admin, today, options.idFamily)
  } catch (cause) {
    console.error('Error limpiando pendientes recurrentes duplicados:', cause)
  }

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
    let plan: ReturnType<typeof materializePlan>
    try {
      plan = materializePlan(rule, today)
    } catch (error) {
      console.error('No se pudo calcular el próximo cobro de', rule.ds_name, error)
      continue
    }

    let lastGenerated = rule.dt_last_generated
    if (plan.due) {
      if (!owner) {
        console.error('El gasto recurrente no tiene a quién avisar:', rule.ds_name)
        continue
      }
      const { data: existing, error: existingError } = await admin
        .from('pml_pending_transaction')
        .select('id_pending_transaction')
        .eq('id_recurring_expense', rule.id_recurring_expense)
        .eq('dt_date', plan.due)
        .limit(1)
      if (existingError) {
        console.error('Error comprobando el pendiente recurrente', rule.ds_name, existingError.message)
        continue
      }
      if (!existing || existing.length === 0) {
        const { data: pending, error: insertError } = await admin
          .from('pml_pending_transaction')
          .insert({
            id_user: owner,
            id_family: rule.id_family,
            ft_amount: rule.ft_amount,
            ds_merchant: rule.ds_name,
            ds_card: null,
            dt_date: plan.due,
            ds_source: 'recurring',
            id_recurring_expense: rule.id_recurring_expense,
          })
          .select('id_pending_transaction')
          .maybeSingle()
        if (insertError && !isDuplicateInsert(insertError)) {
          // Sin avanzar la regla: el siguiente pase lo reintenta, y el índice único impide duplicados
          console.error('Error creando el pendiente recurrente', rule.ds_name, insertError.message)
          continue
        }
        if (pending) {
          created.push({
            idUser: owner,
            idFamily: rule.id_family,
            idPending: pending.id_pending_transaction,
            name: rule.ds_name,
            amount: Number(rule.ft_amount),
          })
        }
      }
      lastGenerated = plan.due
    }

    if (plan.next === rule.dt_next.slice(0, 10) && plan.ended === !rule.is_active) continue
    const { error: updateError } = await admin
      .from('pml_cfg_recurring_expense')
      .update({ dt_next: plan.next, dt_last_generated: lastGenerated, is_active: !plan.ended })
      .eq('id_recurring_expense', rule.id_recurring_expense)
    if (updateError) console.error('Error avanzando el gasto recurrente', rule.ds_name, updateError.message)
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
