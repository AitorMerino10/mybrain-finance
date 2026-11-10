import { formatCurrency } from '@/lib/format'
import { sendPushToUser, type AdminClient, type PushPayload } from '@/lib/push'
import { projectMonth } from '@/lib/forecast-math'
import { upcomingOccurrences, type RecurringExpense } from '@/lib/recurring'

const TIME_ZONE = 'Europe/Madrid'
const DEFAULT_WARN_PERCENT = 80

/** Horas (Madrid) por defecto de los avisos programados; cada persona puede cambiarlas en Notificaciones */
export const DAILY_REMINDER_HOUR = 23
export const MONTH_CLOSE_HOUR = 9
export const PENDING_REMINDER_HOUR = 20
export const RECURRING_CREATE_HOUR = 8

/** Horas que dura la franja en la que un aviso sale en cuanto se ejecuta la tarea (por si alguna ejecución se retrasa) */
const WINDOW_HOURS = 3
const inWindow = (hour: number, start: number) => hour >= start && hour < start + WINDOW_HOURS
/** Día del mes desde el que se avisa de la previsión de fin de mes (antes hay poco gasto para extrapolar) */
const FORECAST_FROM_DAY = 7

type Alert = PushPayload & { idUser: string; key: string }

type Prefs = {
  dailyReminder: boolean
  pending: boolean
  forecast: boolean
  budget: boolean
  goals: boolean
  warnPercent: number
  close: boolean
  dailyHour: number
  pendingHour: number
  closeHour: number
}

type ShareRow = {
  month: string
  date: string
  idBudgetType: string | null
  idSubcategory: string | null
  idCategory: string | null
  amount: number
  idRecurring: string | null
}

// ---------------- fechas (siempre en hora de Madrid) ----------------

export function nowInMadrid(): { today: string; hour: number } {
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

function dayOfMonth(date: string): number {
  return Number(date.slice(8, 10))
}

function daysInMonthOf(month: string): number {
  const [year, m] = month.split('-').map(Number)
  return new Date(Date.UTC(year, m, 0)).getUTCDate()
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
  force?: 'daily' | 'close' | 'pending'
}

async function loadAlerts(admin: AdminClient, scope: AlertScope): Promise<Alert[]> {
  const { today, hour } = nowInMadrid()
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
  userIds.forEach((id) =>
    prefs.set(id, {
      dailyReminder: true,
      pending: true,
      forecast: true,
      budget: true,
      goals: true,
      warnPercent: DEFAULT_WARN_PERCENT,
      close: true,
      dailyHour: DAILY_REMINDER_HOUR,
      pendingHour: PENDING_REMINDER_HOUR,
      closeHour: MONTH_CLOSE_HOUR,
    })
  )
  ;(prefRows || []).forEach((row) =>
    prefs.set(row.id_user, {
      dailyReminder: row.is_daily_reminder ?? true,
      pending: row.is_pending_alerts ?? true,
      forecast: row.is_forecast_alerts ?? true,
      budget: row.is_budget_alerts,
      goals: row.is_goal_alerts ?? true,
      warnPercent: row.nu_warn_percent,
      close: row.is_close_alerts,
      dailyHour: row.nu_daily_hour ?? DAILY_REMINDER_HOUR,
      pendingHour: row.nu_pending_hour ?? PENDING_REMINDER_HOUR,
      closeHour: row.nu_close_hour ?? MONTH_CLOSE_HOUR,
    })
  )

  // Qué avisos programados le tocan a cada persona ahora, según la hora que ha elegido para cada uno
  const isFirstOfMonth = today.slice(8, 10) === '01'
  const due = (idUser: string) => {
    const pref = prefs.get(idUser)!
    return {
      daily: Boolean(scope.scheduled && (scope.force === 'daily' || inWindow(hour, pref.dailyHour))),
      close: Boolean(scope.scheduled && (scope.force === 'close' || (isFirstOfMonth && hour >= pref.closeHour))),
      pending: Boolean(scope.scheduled && (scope.force === 'pending' || inWindow(hour, pref.pendingHour))),
    }
  }
  const dueByUser = new Map(userIds.map((id) => [id, due(id)]))
  const sendDaily = Array.from(dueByUser.values()).some((item) => item.daily)
  const sendClose = Array.from(dueByUser.values()).some((item) => item.close)
  const sendPending = Array.from(dueByUser.values()).some((item) => item.pending)
  // Tarea programada sin nada que enviar a nadie ahora
  if (scope.scheduled && !sendDaily && !sendClose && !sendPending) return []

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
  const earliestGoal = goals.reduce<string>((min, goal) => (goal.dt_start_month.slice(0, 7) < min ? goal.dt_start_month.slice(0, 7) : min), addMonthsTo(nowMonth, -3))
  const shares = new Map<string, ShareRow[]>()
  if (scope.scheduled ? sendDaily || sendClose : true) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from('gnp_fct_transactions')
        .select(
          'id_budget_type, id_subcategory, id_category, ds_month_declared, dt_date, id_recurring_expense, pml_dim_transaction_type(ds_type), pml_rel_transaction_user(id_user, ft_amount_user)'
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
            idRecurring: row.id_recurring_expense ?? null,
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

  /** Previsión de cierre del mes de una persona (mismas partidas que monthTotals) con el ritmo del gasto variable. */
  const forecastForUser = (idUser: string, budget: number, spent: number) => {
    if (budget <= 0) return null
    const covered = new Set(
      versions
        .filter((version) => version.id_user === idUser && version.dt_start_month.slice(0, 7) <= nowMonth && (!version.dt_end_month || version.dt_end_month.slice(0, 7) > nowMonth))
        .map((version) => version.id_budget_type)
    )
    const inCovered = (row: ShareRow) => {
      const type = row.idBudgetType || (row.idSubcategory ? defaults.get(row.idSubcategory) : null)
      return Boolean(type && covered.has(type))
    }
    const rows = (shares.get(idUser) || []).filter(inCovered)
    const fixedSpentToDate = rows.filter((row) => row.month === nowMonth && row.idRecurring).reduce((sum, row) => sum + row.amount, 0)

    // Ritmo del gasto variable de los 3 meses anteriores (solo meses con gasto)
    const history = new Map<string, number>()
    rows.forEach((row) => {
      if (row.month < addMonthsTo(nowMonth, -3) || row.month >= nowMonth || row.idRecurring) return
      history.set(row.month, (history.get(row.month) || 0) + row.amount)
    })
    const historyMonths = Array.from(history.keys()).filter((month) => (history.get(month) || 0) > 0)
    const historyDailyRate =
      historyMonths.length > 0
        ? historyMonths.reduce((sum, month) => sum + (history.get(month) || 0), 0) / historyMonths.reduce((sum, month) => sum + daysInMonthOf(month), 0)
        : null

    // Recurrentes que faltan este mes
    const monthEnd = `${nowMonth}-${String(daysInMonthOf(nowMonth)).padStart(2, '0')}`
    let upcomingFixed = pendingRecurring.get(idUser) || 0
    recurringRules.forEach((rule) => {
      const owners = rule.ds_user_ids.length > 0 ? rule.ds_user_ids : rule.id_user_creator ? [rule.id_user_creator] : []
      if (!owners.includes(idUser)) return
      const type = rule.id_budget_type || (rule.id_subcategory ? defaults.get(rule.id_subcategory) : null)
      if (!type || !covered.has(type)) return
      upcomingFixed += (Number(rule.ft_amount) / owners.length) * upcomingOccurrences(rule, monthEnd).length
    })

    const { projected } = projectMonth({
      daysInMonth: daysInMonthOf(nowMonth),
      dayOfMonth: dayOfMonth(today),
      spentToDate: spent,
      fixedSpentToDate,
      upcomingFixed,
      historyDailyRate,
    })
    return { projected, upcomingFixed }
  }

  // Gastos pendientes de completar (aviso de pendientes olvidados)
  const pendingByUser = new Map<string, Array<{ amount: number; date: string }>>()
  if (sendPending) {
    const { data: pendingRows } = await admin.from('pml_pending_transaction').select('id_user, ft_amount, dt_date').eq('id_family', scope.idFamily)
    ;(pendingRows || []).forEach((row) =>
      pendingByUser.set(row.id_user, [...(pendingByUser.get(row.id_user) || []), { amount: Number(row.ft_amount), date: row.dt_date }])
    )
  }

  // Previsión de fin de mes: reglas recurrentes y pendientes recurrentes sin completar
  const forecastNeeded = !scope.scheduled && dayOfMonth(today) >= FORECAST_FROM_DAY
  let recurringRules: RecurringExpense[] = []
  const pendingRecurring = new Map<string, number>()
  if (forecastNeeded) {
    const [{ data: ruleRows }, { data: pendingRecurringRows }] = await Promise.all([
      admin.from('pml_cfg_recurring_expense').select('*').eq('id_family', scope.idFamily).eq('is_active', true),
      admin
        .from('pml_pending_transaction')
        .select('id_user, ft_amount, dt_date')
        .eq('id_family', scope.idFamily)
        .not('id_recurring_expense', 'is', null),
    ])
    recurringRules = ruleRows || []
    ;(pendingRecurringRows || []).forEach((row) => {
      if (row.dt_date.slice(0, 7) === nowMonth) pendingRecurring.set(row.id_user, (pendingRecurring.get(row.id_user) || 0) + Number(row.ft_amount))
    })
  }

  const alerts: Alert[] = []

  for (const idUser of userIds) {
    const pref = prefs.get(idUser)!
    const userShares = shares.get(idUser) || []
    const userDue = dueByUser.get(idUser)!

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

      // 2b) Previsión de fin de mes: a este ritmo te pasarías del presupuesto
      if (pref.forecast && forecastNeeded) {
        const { budget, spent } = monthTotals(idUser, nowMonth)
        if (budget > 0 && spent < budget) {
          const forecast = forecastForUser(idUser, budget, spent)
          if (forecast && forecast.projected > budget * 1.03) {
            const monthName = monthLabel(nowMonth)
            const daysLeft = daysInMonthOf(nowMonth) - dayOfMonth(today)
            const allowance = daysLeft > 0 ? (budget - spent - forecast.upcomingFixed) / daysLeft : 0
            alerts.push({
              idUser,
              key: `forecast:${nowMonth}`,
              title: 'A este ritmo te pasarás del presupuesto',
              body:
                `Cerrarías ${monthName} en unos ${formatCurrency(forecast.projected)} (presupuesto: ${formatCurrency(budget)}).` +
                (allowance > 0 ? ` Para no pasarte, gasta unos ${formatCurrency(allowance)} al día.` : ''),
              url: familyUrl,
              tag: 'budget-forecast',
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

    // 0) Gastos pendientes sin completar
    if (userDue.pending && pref.pending) {
      const mine = pendingByUser.get(idUser) || []
      if (mine.length > 0) {
        const total = mine.reduce((sum, item) => sum + item.amount, 0)
        const oldest = mine.reduce((min, item) => (item.date < min ? item.date : min), mine[0].date)
        const ageDays = Math.max(0, Math.round((Date.parse(today) - Date.parse(oldest)) / 86400000))
        alerts.push({
          idUser,
          key: `pending:${today}`,
          title: mine.length === 1 ? 'Tienes 1 gasto pendiente de completar' : `Tienes ${mine.length} gastos pendientes de completar`,
          body:
            `${formatCurrency(total)} sin asignar a ninguna partida.` +
            (ageDays >= 1 ? ` El más antiguo es de hace ${ageDays} ${ageDays === 1 ? 'día' : 'días'}.` : '') +
            ' Complétalos para que cuenten en tus números.',
          url: familyUrl,
          tag: 'pending-reminder',
        })
      }
    }

    // 1) Recordatorio diario para meter los gastos del día
    if (userDue.daily && pref.dailyReminder) {
      const todays = userShares.filter((row) => row.date === today)
      const total = todays.reduce((sum, row) => sum + row.amount, 0)
      alerts.push({
        idUser,
        key: `daily:${today}`,
        title: '¿Has metido los gastos de hoy?',
        body:
          (todays.length > 0
            ? `Hoy llevas ${todays.length} ${todays.length === 1 ? 'gasto' : 'gastos'} (${formatCurrency(total)}). ¿Se te ha olvidado alguno?`
            : 'Hoy no has registrado ningún gasto. Añádelos antes de acostarte para que las cuentas cuadren.'),
        url: `/?family=${scope.idFamily}&action=new-transaction`,
        tag: 'daily-reminder',
      })
    }

    // 4) Día 1: toca cerrar el mes anterior
    if (userDue.close && pref.close) {
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
