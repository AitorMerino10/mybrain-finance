import { formatCurrency } from '@/lib/format'
import { sendPushToUser, type AdminClient, type PushPayload } from '@/lib/push'

const TIME_ZONE = 'Europe/Madrid'
const DEFAULT_WARN_PERCENT = 80

/** Hora (Madrid) a la que sale el recordatorio diario de gastos */
export const DAILY_REMINDER_HOUR = 23
/** Hora (Madrid) a partir de la cual sale, el día 1, el aviso de cerrar el mes */
export const MONTH_CLOSE_HOUR = 9

type Alert = PushPayload & { idUser: string; key: string }

type Prefs = {
  dailyReminder: boolean
  budget: boolean
  goals: boolean
  warnPercent: number
  close: boolean
}

type ShareRow = {
  month: string
  date: string
  idBudgetType: string | null
  idSubcategory: string | null
  idCategory: string | null
  amount: number
}

// ---------------- fechas (siempre en hora de Madrid) ----------------

function nowInMadrid(): { today: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '00'
  return { today: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}

function addMonthsTo(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, m - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthsBetween(startMonth: string, endMonthExclusive: string): number {
  const [y1, m1] = startMonth.split('-').map(Number)
  const [y2, m2] = endMonthExclusive.split('-').map(Number)
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1))
}

function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, m - 1, 1)))
}

// ---------------- cálculo de avisos ----------------

export type AlertScope = {
  idFamily: string
  /** Si se indica, solo se avisa a estas personas (por defecto, a todos los miembros de la familia) */
  idUsers?: string[]
  /** Avisos programados (recordatorio diario y cierre de mes) en vez de los de "al momento" */
  scheduled?: boolean
  /** Para pruebas: salta la comprobación de hora/día y de avisos ya enviados */
  force?: 'daily' | 'close'
}

async function loadAlerts(admin: AdminClient, scope: AlertScope): Promise<Alert[]> {
  const { today, hour } = nowInMadrid()
  const nowMonth = today.slice(0, 7)
  const familyUrl = `/?family=${scope.idFamily}`

  const sendDaily = scope.scheduled && (scope.force === 'daily' || hour === DAILY_REMINDER_HOUR)
  const sendClose = scope.scheduled && (scope.force === 'close' || (today.slice(8, 10) === '01' && hour >= MONTH_CLOSE_HOUR))
  // Tarea programada fuera de hora: no hay nada que enviar
  if (scope.scheduled && !sendDaily && !sendClose) return []

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
  userIds.forEach((id) => prefs.set(id, { dailyReminder: true, budget: true, goals: true, warnPercent: DEFAULT_WARN_PERCENT, close: true }))
  ;(prefRows || []).forEach((row) =>
    prefs.set(row.id_user, {
      dailyReminder: row.is_daily_reminder ?? true,
      budget: row.is_budget_alerts,
      goals: row.is_goal_alerts ?? true,
      warnPercent: row.nu_warn_percent,
      close: row.is_close_alerts,
    })
  )

  const needBudget = !scope.scheduled || sendClose
  const needGoals = !scope.scheduled

  const [{ data: versionRows }, { data: typeRows }, { data: defaultRows }, { data: goalRows }] = await Promise.all([
    needBudget
      ? admin.from('pml_cfg_user_budget').select('*').eq('id_family', scope.idFamily).eq('is_active', true)
      : Promise.resolve({ data: [] as any[] }),
    needBudget ? admin.from('pml_dim_budget_type').select('id_budget_type, ds_periodicity') : Promise.resolve({ data: [] as any[] }),
    needBudget
      ? admin.from('pml_rel_subcategory_budget_type').select('id_subcategory, id_budget_type').eq('id_family', scope.idFamily)
      : Promise.resolve({ data: [] as any[] }),
    needGoals ? admin.from('pml_cfg_spending_goal').select('*').eq('id_family', scope.idFamily).eq('is_active', true) : Promise.resolve({ data: [] as any[] }),
  ])
  const versions = (versionRows || []) as Array<{
    id_user: string
    id_budget_type: string
    dt_start_month: string
    dt_end_month: string | null
    ft_budget_amount: number
    is_period_amount: boolean
  }>
  const typePeriodicity = new Map<string, string>((typeRows || []).map((type: any) => [type.id_budget_type, type.ds_periodicity]))
  const defaults = new Map<string, string>((defaultRows || []).map((item: any) => [item.id_subcategory, item.id_budget_type]))
  const goals = ((goalRows || []) as Array<{
    id_spending_goal: string
    id_user: string
    id_category: string | null
    id_subcategory: string | null
    ds_periodicity: string
    dt_start_month: string
    dt_end_month: string
    ft_goal_amount: number
  }>).filter((goal) => goal.dt_start_month.slice(0, 7) <= nowMonth && goal.dt_end_month.slice(0, 7) >= nowMonth)

  // Nombres de las categorías/subcategorías de los controles
  const goalNames = new Map<string, string>()
  if (goals.length > 0) {
    const categoryIds = Array.from(new Set(goals.map((goal) => goal.id_category).filter(Boolean))) as string[]
    const subcategoryIds = Array.from(new Set(goals.map((goal) => goal.id_subcategory).filter(Boolean))) as string[]
    const [{ data: categories }, { data: subcategories }] = await Promise.all([
      categoryIds.length > 0 ? admin.from('pml_dim_category').select('id_category, ds_category').in('id_category', categoryIds) : Promise.resolve({ data: [] as any[] }),
      subcategoryIds.length > 0
        ? admin.from('pml_dim_subcategory').select('id_subcategory, ds_subcategory').in('id_subcategory', subcategoryIds)
        : Promise.resolve({ data: [] as any[] }),
    ])
    ;(categories || []).forEach((row: any) => goalNames.set(`c:${row.id_category}`, row.ds_category))
    ;(subcategories || []).forEach((row: any) => goalNames.set(`s:${row.id_subcategory}`, row.ds_subcategory))
  }

  // Gastos desde el mes más antiguo que haga falta (como mínimo, el mes anterior al actual)
  const earliestGoal = goals.reduce<string>((min, goal) => (goal.dt_start_month.slice(0, 7) < min ? goal.dt_start_month.slice(0, 7) : min), addMonthsTo(nowMonth, -1))
  const shares = new Map<string, ShareRow[]>()
  if (scope.scheduled ? sendDaily || sendClose : true) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from('gnp_fct_transactions')
        .select(
          'id_budget_type, id_subcategory, id_category, ds_month_declared, dt_date, pml_dim_transaction_type(ds_type), pml_rel_transaction_user(id_user, ft_amount_user)'
        )
        .eq('id_family', scope.idFamily)
        .gte('ds_month_declared', earliestGoal)
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
            idCategory: row.id_category,
            amount: Number(rel.ft_amount_user) || 0,
          })
          shares.set(rel.id_user, list)
        })
      })
      if (rows.length < 1000) break
    }
  }

  /** Presupuesto del mes (suma de partidas vigentes, en equivalente mensual) y lo gastado en esas partidas. */
  const monthTotals = (idUser: string, month: string) => {
    const inForce = versions.filter(
      (version) => version.id_user === idUser && version.dt_start_month.slice(0, 7) <= month && (!version.dt_end_month || version.dt_end_month.slice(0, 7) > month)
    )
    const budget = inForce.reduce((sum, version) => {
      const annual = typePeriodicity.get(version.id_budget_type) === 'annual'
      if (!annual) return sum + version.ft_budget_amount
      const months = version.is_period_amount && version.dt_end_month ? monthsBetween(version.dt_start_month.slice(0, 7), version.dt_end_month.slice(0, 7)) : 12
      return sum + version.ft_budget_amount / months
    }, 0)
    const covered = new Set(inForce.map((version) => version.id_budget_type))
    const spent = (shares.get(idUser) || [])
      .filter((row) => {
        if (row.month !== month) return false
        const type = row.idBudgetType || (row.idSubcategory ? defaults.get(row.idSubcategory) : null)
        return Boolean(type && covered.has(type))
      })
      .reduce((sum, row) => sum + row.amount, 0)
    return { budget, spent }
  }

  // Gastos pendientes de completar (para recordarlos en el aviso diario)
  const pendingCount = new Map<string, number>()
  if (sendDaily) {
    const { data: pendingRows } = await admin.from('pml_pending_transaction').select('id_user').eq('id_family', scope.idFamily)
    ;(pendingRows || []).forEach((row) => pendingCount.set(row.id_user, (pendingCount.get(row.id_user) || 0) + 1))
  }

  const alerts: Alert[] = []

  for (const idUser of userIds) {
    const pref = prefs.get(idUser)!
    const userShares = shares.get(idUser) || []

    if (!scope.scheduled) {
      // 2) Presupuesto mensual al límite
      if (pref.budget) {
        const { budget, spent } = monthTotals(idUser, nowMonth)
        if (budget > 0) {
          const ratio = spent / budget
          const level = ratio >= 1 ? 'over' : ratio >= pref.warnPercent / 100 ? 'warn' : null
          if (level) {
            alerts.push({
              idUser,
              key: `monthly:${nowMonth}:${level}`,
              title: level === 'over' ? 'Te has pasado del presupuesto mensual' : `Presupuesto mensual al ${Math.floor(ratio * 100)} %`,
              body:
                level === 'over'
                  ? `Llevas ${formatCurrency(spent)} de ${formatCurrency(budget)} este mes.`
                  : `Llevas ${formatCurrency(spent)} de ${formatCurrency(budget)} este mes; te quedan ${formatCurrency(budget - spent)}.`,
              url: familyUrl,
              tag: 'budget-monthly',
            })
          }
        }
      }

      // 3) Controles de gasto al límite
      if (pref.goals) {
        for (const goal of goals.filter((item) => item.id_user === idUser)) {
          const monthly = goal.ds_periodicity === 'monthly'
          const startMonth = goal.dt_start_month.slice(0, 7)
          const spent = userShares
            .filter((row) => {
              if (monthly ? row.month !== nowMonth : row.month < startMonth || row.month > goal.dt_end_month.slice(0, 7)) return false
              return goal.id_subcategory ? row.idSubcategory === goal.id_subcategory : row.idCategory === goal.id_category
            })
            .reduce((sum, row) => sum + row.amount, 0)
          const limit = goal.ft_goal_amount
          if (limit <= 0) continue
          const ratio = spent / limit
          const level = ratio >= 1 ? 'over' : ratio >= pref.warnPercent / 100 ? 'warn' : null
          if (!level) continue
          const name = goalNames.get(goal.id_subcategory ? `s:${goal.id_subcategory}` : `c:${goal.id_category}`) || 'Control de gasto'
          const scopeLabel = monthly ? 'este mes' : 'en el periodo'
          alerts.push({
            idUser,
            key: `goal:${goal.id_spending_goal}:${monthly ? nowMonth : 'period'}:${level}`,
            title: level === 'over' ? `${name}: te has pasado` : `${name} al ${Math.floor(ratio * 100)} %`,
            body:
              level === 'over'
                ? `Llevas ${formatCurrency(spent)} de ${formatCurrency(limit)} ${scopeLabel}.`
                : `Llevas ${formatCurrency(spent)} de ${formatCurrency(limit)} ${scopeLabel}; te quedan ${formatCurrency(limit - spent)}.`,
            url: '/budgets',
            tag: `goal-${goal.id_spending_goal}`,
          })
        }
      }
      continue
    }

    // 1) Recordatorio diario para meter los gastos del día
    if (sendDaily && pref.dailyReminder) {
      const todays = userShares.filter((row) => row.date === today)
      const total = todays.reduce((sum, row) => sum + row.amount, 0)
      const pendingNote = pendingCount.get(idUser)
        ? ` Tienes ${pendingCount.get(idUser)} ${pendingCount.get(idUser) === 1 ? 'gasto pendiente' : 'gastos pendientes'} de completar.`
        : ''
      alerts.push({
        idUser,
        key: `daily:${today}`,
        title: '¿Has metido los gastos de hoy?',
        body:
          (todays.length > 0
            ? `Hoy llevas ${todays.length} ${todays.length === 1 ? 'gasto' : 'gastos'} (${formatCurrency(total)}). ¿Se te ha olvidado alguno?`
            : 'Hoy no has registrado ningún gasto. Añádelos antes de acostarte para que las cuentas cuadren.') + pendingNote,
        url: `/?family=${scope.idFamily}&action=new-transaction`,
        tag: 'daily-reminder',
      })
    }

    // 4) Día 1: toca cerrar el mes anterior
    if (sendClose && pref.close) {
      const previous = addMonthsTo(nowMonth, -1)
      const { budget, spent } = monthTotals(idUser, previous)
      const name = monthLabel(previous)
      alerts.push({
        idUser,
        key: `close:${nowMonth}`,
        title: `Toca cerrar ${name}`,
        body:
          budget > 0
            ? `En ${name} gastaste ${formatCurrency(spent)} de ${formatCurrency(budget)} (${Math.round((spent / budget) * 100)} %). Ciérralo y revisa qué tal ha ido.`
            : `Cierra ${name} y revisa qué tal ha ido el mes.`,
        url: '/budgets',
        tag: 'month-close',
      })
    }
  }

  return alerts
}

/** Calcula los avisos pendientes de una familia, descarta los ya enviados y envía el resto. Devuelve cuántos se enviaron. */
export async function processAlerts(admin: AdminClient, scope: AlertScope): Promise<number> {
  const alerts = await loadAlerts(admin, scope)
  if (alerts.length === 0) return 0

  const alreadySent = new Set<string>()
  if (!scope.force) {
    const keysByUser = new Map<string, string[]>()
    alerts.forEach((alert) => keysByUser.set(alert.idUser, [...(keysByUser.get(alert.idUser) || []), alert.key]))
    for (const [idUser, keys] of Array.from(keysByUser.entries())) {
      const { data } = await admin.from('pml_log_push_sent').select('ds_key').eq('id_user', idUser).in('ds_key', keys)
      ;(data || []).forEach((row) => alreadySent.add(`${idUser}|${row.ds_key}`))
    }
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
