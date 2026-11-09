import { formatCurrency } from '@/lib/format'
import { sendPushToUser, type AdminClient, type PushPayload } from '@/lib/push'

const TIME_ZONE = 'Europe/Madrid'
const DEFAULT_WARN_PERCENT = 80

type Alert = PushPayload & { idUser: string; key: string }

type Prefs = {
  budget: boolean
  warnPercent: number
  close: boolean
  unassigned: boolean
}

type ShareRow = { month: string; date: string; idBudgetType: string | null; idSubcategory: string | null; amount: number }

// ---------------- fechas ----------------

function todayInMadrid(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function addMonthsTo(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, m - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function addDaysTo(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000)
}

/** Lunes de la semana de `day` (para avisar como mucho una vez por semana). */
function mondayOf(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay() // 0 = domingo
  return addDaysTo(day, -((weekday + 6) % 7))
}

// ---------------- cálculo de avisos ----------------

export type AlertScope = {
  idFamily: string
  /** Si se indica, solo se avisa a estas personas (por defecto, a todos los miembros de la familia) */
  idUsers?: string[]
  /** Avisos de calendario (cierre, fin de presupuesto, gastos sin partida): solo en la tarea diaria */
  includeCalendar?: boolean
}

async function loadAlerts(admin: AdminClient, scope: AlertScope): Promise<Alert[]> {
  const today = todayInMadrid()
  const nowMonth = today.slice(0, 7)
  const familyUrl = `/?family=${scope.idFamily}`

  const { data: members } = await admin.from('pml_rel_user_family').select('id_user').eq('id_family', scope.idFamily)
  const memberIds = (members || []).map((member) => member.id_user)
  const candidateIds = scope.idUsers ? memberIds.filter((id) => scope.idUsers!.includes(id)) : memberIds
  if (candidateIds.length === 0) return []

  // Solo personas con algún dispositivo suscrito
  const { data: subscriptions } = await admin.from('pml_cfg_push_subscription').select('id_user').in('id_user', candidateIds)
  const userIds = Array.from(new Set((subscriptions || []).map((item) => item.id_user)))
  if (userIds.length === 0) return []

  const { data: prefRows } = await admin.from('pml_cfg_notification_pref').select('*').in('id_user', userIds)
  const prefs = new Map<string, Prefs>()
  userIds.forEach((id) => prefs.set(id, { budget: true, warnPercent: DEFAULT_WARN_PERCENT, close: true, unassigned: true }))
  ;(prefRows || []).forEach((row) =>
    prefs.set(row.id_user, {
      budget: row.is_budget_alerts,
      warnPercent: row.nu_warn_percent,
      close: row.is_close_alerts,
      unassigned: row.is_unassigned_alerts,
    })
  )

  const [{ data: versionRows }, { data: typeRows }, { data: defaultRows }] = await Promise.all([
    admin.from('pml_cfg_user_budget').select('*').eq('id_family', scope.idFamily).eq('is_active', true),
    admin.from('pml_dim_budget_type').select('id_budget_type, ds_budget_type, ds_periodicity'),
    admin.from('pml_rel_subcategory_budget_type').select('id_subcategory, id_budget_type').eq('id_family', scope.idFamily),
  ])
  const versions = versionRows || []
  const typeInfo = new Map((typeRows || []).map((type) => [type.id_budget_type, type]))
  const defaults = new Map((defaultRows || []).map((item) => [item.id_subcategory, item.id_budget_type]))

  // Gastos del último año, repartidos por persona
  const shares = new Map<string, ShareRow[]>()
  const sinceMonth = addMonthsTo(nowMonth, -12)
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('gnp_fct_transactions')
      .select('id_budget_type, id_subcategory, ds_month_declared, dt_date, pml_dim_transaction_type(ds_type), pml_rel_transaction_user(id_user, ft_amount_user)')
      .eq('id_family', scope.idFamily)
      .gte('ds_month_declared', sinceMonth)
      .order('id_transaction', { ascending: true })
      .range(from, from + 999)
    if (error) {
      console.error('Error cargando gastos para avisos:', error.message)
      break
    }
    const rows = (data || []) as any[]
    rows.forEach((row) => {
      if (row.pml_dim_transaction_type?.ds_type !== 'Expense') return
      ;(row.pml_rel_transaction_user || []).forEach((rel: any) => {
        const list = shares.get(rel.id_user) || []
        list.push({
          month: row.ds_month_declared,
          date: row.dt_date,
          idBudgetType: row.id_budget_type,
          idSubcategory: row.id_subcategory,
          amount: Number(rel.ft_amount_user) || 0,
        })
        shares.set(rel.id_user, list)
      })
    })
    if (rows.length < 1000) break
  }

  const closeRows = scope.includeCalendar
    ? (await admin.from('pml_cfg_budget_close').select('id_user, dt_close_month').eq('id_family', scope.idFamily).in('id_user', userIds)).data || []
    : []

  const alerts: Alert[] = []

  for (const idUser of userIds) {
    const pref = prefs.get(idUser)!
    const userVersions = versions.filter((version) => version.id_user === idUser)
    const userShares = shares.get(idUser) || []
    const inForce = userVersions.filter(
      (version) => version.dt_start_month.slice(0, 7) <= nowMonth && (!version.dt_end_month || version.dt_end_month.slice(0, 7) > nowMonth)
    )

    // 1) Partidas al límite
    if (pref.budget) {
      for (const version of inForce) {
        const info = typeInfo.get(version.id_budget_type)
        if (!info || version.ft_budget_amount <= 0) continue
        const startMonth = version.dt_start_month.slice(0, 7)
        const annual = info.ds_periodicity === 'annual'

        const windowStart = !annual
          ? nowMonth
          : version.is_period_amount
            ? startMonth
            : [startMonth, addMonthsTo(nowMonth, -11)].sort().pop()!
        const spent = userShares
          .filter((row) => {
            const type = row.idBudgetType || (row.idSubcategory ? defaults.get(row.idSubcategory) : null)
            return type === version.id_budget_type && row.month >= windowStart && row.month <= nowMonth
          })
          .reduce((sum, row) => sum + row.amount, 0)

        const ratio = spent / version.ft_budget_amount
        const level = ratio >= 1 ? 'over' : ratio >= pref.warnPercent / 100 ? 'warn' : null
        if (!level) continue

        const scopeLabel = annual ? (version.is_period_amount ? 'en este periodo' : 'en los últimos 12 meses') : 'este mes'
        alerts.push({
          idUser,
          key: `budget:${version.id_budget_type}:${annual ? startMonth : nowMonth}:${level}`,
          title: level === 'over' ? `${info.ds_budget_type}: te has pasado` : `${info.ds_budget_type} al ${Math.floor(ratio * 100)} %`,
          body:
            level === 'over'
              ? `Llevas ${formatCurrency(spent)} de ${formatCurrency(version.ft_budget_amount)} ${scopeLabel}.`
              : `Llevas ${formatCurrency(spent)} de ${formatCurrency(version.ft_budget_amount)} ${scopeLabel}; te quedan ${formatCurrency(version.ft_budget_amount - spent)}.`,
          url: familyUrl,
          tag: `budget-${version.id_budget_type}`,
        })
      }
    }

    if (!scope.includeCalendar) continue

    // 2) Presupuesto a punto de acabar / pendiente de cerrar
    if (pref.close && userVersions.length > 0) {
      const lastEnd = userVersions.reduce<string | null>((max, version) => {
        if (!version.dt_end_month) return max
        return !max || version.dt_end_month > max ? version.dt_end_month : max
      }, null)

      if (inForce.length === 0 && lastEnd && lastEnd.slice(0, 7) <= nowMonth) {
        const lastMonthCovered = addMonthsTo(lastEnd.slice(0, 7), -1)
        const lastClose = closeRows
          .filter((row) => row.id_user === idUser)
          .reduce<string>((max, row) => (row.dt_close_month.slice(0, 7) > max ? row.dt_close_month.slice(0, 7) : max), '')
        if (lastClose < lastMonthCovered) {
          alerts.push({
            idUser,
            key: `close:${lastEnd.slice(0, 7)}`,
            title: 'Toca cerrar el presupuesto',
            body: 'Tu presupuesto ha terminado. Ciérralo para ver cuánto te ha sobrado o faltado y empezar el siguiente.',
            url: '/budgets',
            tag: 'budget-close',
          })
        }
      } else {
        const endingSoon = inForce
          .filter((version) => version.dt_end_month)
          .map((version) => ({ end: version.dt_end_month as string, days: daysBetween(today, version.dt_end_month as string) }))
          .filter((item) => item.days > 0 && item.days <= 7)
          .sort((a, b) => a.days - b.days)[0]
        if (endingSoon) {
          alerts.push({
            idUser,
            key: `ending:${endingSoon.end.slice(0, 7)}`,
            title: 'Tu presupuesto termina pronto',
            body: `Quedan ${endingSoon.days} ${endingSoon.days === 1 ? 'día' : 'días'}. Prepara el siguiente en la calculadora.`,
            url: '/budgets',
            tag: 'budget-ending',
          })
        }
      }
    }

    // 3) Gastos sin partida de la última semana
    if (pref.unassigned && userVersions.length > 0) {
      const weekAgo = addDaysTo(today, -7)
      const orphan = userShares.filter(
        (row) => row.date >= weekAgo && !row.idBudgetType && !(row.idSubcategory && defaults.get(row.idSubcategory))
      )
      if (orphan.length > 0) {
        alerts.push({
          idUser,
          key: `unassigned:${mondayOf(today)}`,
          title: 'Gastos sin partida',
          body: `Tienes ${orphan.length} ${orphan.length === 1 ? 'gasto' : 'gastos'} de esta semana sin partida (${formatCurrency(
            orphan.reduce((sum, row) => sum + row.amount, 0)
          )}). Asígnalos para que cuenten en tus presupuestos.`,
          url: '/transactions',
          tag: 'unassigned',
        })
      }
    }
  }

  return alerts
}

/** Calcula los avisos pendientes de una familia, descarta los ya enviados y envía el resto. Devuelve cuántos se enviaron. */
export async function processAlerts(admin: AdminClient, scope: AlertScope): Promise<number> {
  const alerts = await loadAlerts(admin, scope)
  if (alerts.length === 0) return 0

  const keysByUser = new Map<string, string[]>()
  alerts.forEach((alert) => keysByUser.set(alert.idUser, [...(keysByUser.get(alert.idUser) || []), alert.key]))

  const alreadySent = new Set<string>()
  for (const [idUser, keys] of Array.from(keysByUser.entries())) {
    const { data } = await admin.from('pml_log_push_sent').select('ds_key').eq('id_user', idUser).in('ds_key', keys)
    ;(data || []).forEach((row) => alreadySent.add(`${idUser}|${row.ds_key}`))
  }

  let sent = 0
  for (const alert of alerts) {
    if (alreadySent.has(`${alert.idUser}|${alert.key}`)) continue
    const delivered = await sendPushToUser(admin, alert.idUser, { title: alert.title, body: alert.body, url: alert.url, tag: alert.tag })
    if (delivered > 0) {
      sent += 1
      await admin.from('pml_log_push_sent').upsert({ id_user: alert.idUser, ds_key: alert.key })
    }
  }
  return sent
}
