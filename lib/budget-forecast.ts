import {
  buildPartidaStatus,
  resolveBudgetTypeId,
  NO_BUDGET_TYPE,
  type BudgetAnalyticsData,
  type Status,
} from '@/lib/budget-analytics'
import { addMonths, getScopedAmount } from '@/lib/budget-calculator'
import { addDaysTo, upcomingOccurrences, type RecurringExpense } from '@/lib/recurring'
import { forecastStatus, projectMonth } from '@/lib/forecast-math'

export { forecastStatus, projectMonth, type ProjectionInput } from '@/lib/forecast-math'

// ---------------- previsión en la web (por partida) ----------------

export type ForecastRow = {
  idBudgetType: string
  name: string
  budget: number
  spent: number
  projected: number
  upcomingFixed: number
  status: Status
}

export type UpcomingCharge = {
  rule: RecurringExpense
  date: string
  /** Importe que corresponde al alcance elegido (persona o familia) */
  amount: number
}

export type MonthForecast = {
  month: string
  dayOfMonth: number
  daysInMonth: number
  daysLeft: number
  budget: number
  spent: number
  projected: number
  upcomingFixed: number
  status: Status
  /** Lo que se puede gastar al día, de lo que queda de presupuesto una vez descontados los cobros recurrentes que faltan; null si ya no queda */
  dailyAllowance: number | null
  /** false al principio de mes sin histórico: la previsión sería puro ruido */
  hasEnoughData: boolean
  rows: ForecastRow[]
  upcoming: UpcomingCharge[]
}

function scopedRuleAmount(rule: RecurringExpense, scopeUserId: string | null): number {
  const amount = Number(rule.ft_amount)
  if (!scopeUserId) return amount
  const userIds = rule.ds_user_ids.length > 0 ? rule.ds_user_ids : rule.id_user_creator ? [rule.id_user_creator] : []
  if (userIds.length === 0) return amount
  return userIds.includes(scopeUserId) ? amount / userIds.length : 0
}

function ruleBudgetType(rule: RecurringExpense, data: BudgetAnalyticsData): string {
  if (rule.id_budget_type) return rule.id_budget_type
  if (rule.id_subcategory) return data.defaults.get(rule.id_subcategory) || NO_BUDGET_TYPE
  return NO_BUDGET_TYPE
}

function daysIn(month: string): number {
  const [year, m] = month.split('-').map(Number)
  return new Date(year, m, 0).getDate()
}

/** Pendiente creado por una regla recurrente que aún no se ha completado (el gasto todavía no cuenta en los números). */
export type PendingRecurring = { idRecurring: string; amount: number; date: string }

export function buildMonthForecast(
  data: BudgetAnalyticsData,
  scopeUserId: string | null,
  rules: RecurringExpense[],
  pending: PendingRecurring[] = [],
  now: Date = new Date()
): MonthForecast {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const today = `${month}-${String(now.getDate()).padStart(2, '0')}`
  const daysInMonth = daysIn(month)
  const dayOfMonth = now.getDate()
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, '0')}`

  const { rows: statusRows } = buildPartidaStatus(data, scopeUserId, now)
  const monthly = statusRows.filter((row) => row.periodicity === 'monthly' && row.hasBudget && !row.isUnassigned)

  // Gasto de este mes (fijo y total) y gasto variable de los 3 meses anteriores, por partida
  const previousMonths = [addMonths(month, -3), addMonths(month, -2), addMonths(month, -1)]
  const fixedNow = new Map<string, number>()
  const variableHistory = new Map<string, Map<string, number>>()
  for (const tx of data.transactions) {
    if (tx.type !== 'Expense') continue
    const amount = getScopedAmount(tx, scopeUserId)
    if (!amount) continue
    const idType = resolveBudgetTypeId(tx, data.defaults)
    if (tx.ds_month_declared === month) {
      if (tx.id_recurring_expense) fixedNow.set(idType, (fixedNow.get(idType) || 0) + amount)
    } else if (previousMonths.includes(tx.ds_month_declared) && !tx.id_recurring_expense) {
      const byMonth = variableHistory.get(idType) || new Map<string, number>()
      byMonth.set(tx.ds_month_declared, (byMonth.get(tx.ds_month_declared) || 0) + amount)
      variableHistory.set(idType, byMonth)
    }
  }

  // Cobros recurrentes que faltan hasta fin de mes, por partida, y próximos cobros (30 días)
  const upcomingFixedByType = new Map<string, number>()
  const upcoming: UpcomingCharge[] = []
  const horizon = addDaysTo(today, 30)
  for (const rule of rules) {
    const amount = scopedRuleAmount(rule, scopeUserId)
    if (amount <= 0) continue
    const idType = ruleBudgetType(rule, data)
    for (const date of upcomingOccurrences(rule, horizon)) {
      upcoming.push({ rule, date, amount })
      if (date <= monthEnd) upcomingFixedByType.set(idType, (upcomingFixedByType.get(idType) || 0) + amount)
    }
  }
  // Pendientes recurrentes de este mes sin completar: seguirán llegando como gasto
  const monthStart = `${month}-01`
  const rulesById = new Map(rules.map((rule) => [rule.id_recurring_expense, rule]))
  for (const item of pending) {
    if (item.date < monthStart || item.date > monthEnd) continue
    const rule = rulesById.get(item.idRecurring)
    if (!rule) continue
    const total = Number(rule.ft_amount)
    const share = total > 0 ? scopedRuleAmount(rule, scopeUserId) / total : 1
    const amount = item.amount * share
    if (amount <= 0) continue
    const idType = ruleBudgetType(rule, data)
    upcomingFixedByType.set(idType, (upcomingFixedByType.get(idType) || 0) + amount)
    upcoming.push({ rule, date: item.date, amount })
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date))

  let hasHistory = false
  const rows: ForecastRow[] = monthly.map((row) => {
    const byMonth = variableHistory.get(row.idBudgetType)
    const monthsWithData = byMonth ? Array.from(byMonth.values()).filter((value) => value > 0) : []
    let historyDailyRate: number | null = null
    if (byMonth && monthsWithData.length > 0) {
      hasHistory = true
      const totalDays = Array.from(byMonth.keys()).reduce((sum, key) => sum + daysIn(key), 0)
      historyDailyRate = monthsWithData.reduce((sum, value) => sum + value, 0) / totalDays
    }
    const upcomingFixed = upcomingFixedByType.get(row.idBudgetType) || 0
    const { projected } = projectMonth({
      daysInMonth,
      dayOfMonth,
      spentToDate: row.spent,
      fixedSpentToDate: fixedNow.get(row.idBudgetType) || 0,
      upcomingFixed,
      historyDailyRate,
    })
    return {
      idBudgetType: row.idBudgetType,
      name: row.name,
      budget: row.budget,
      spent: row.spent,
      projected,
      upcomingFixed,
      status: forecastStatus(projected, row.budget),
    }
  })

  const budget = rows.reduce((sum, row) => sum + row.budget, 0)
  const spent = rows.reduce((sum, row) => sum + row.spent, 0)
  const projected = rows.reduce((sum, row) => sum + row.projected, 0)
  const upcomingFixed = rows.reduce((sum, row) => sum + row.upcomingFixed, 0)
  const daysLeft = Math.max(0, daysInMonth - dayOfMonth)
  const left = budget - spent - upcomingFixed

  return {
    month,
    dayOfMonth,
    daysInMonth,
    daysLeft,
    budget,
    spent,
    projected,
    upcomingFixed,
    status: forecastStatus(projected, budget),
    dailyAllowance: daysLeft > 0 && left > 0 ? left / daysLeft : null,
    hasEnoughData: dayOfMonth >= 3 || hasHistory,
    rows: rows.sort((a, b) => b.projected - b.budget - (a.projected - a.budget)),
    upcoming,
  }
}

