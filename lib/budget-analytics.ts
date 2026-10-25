import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getFamilyMembers, type FamilyMember } from '@/lib/family'
import {
  getAllCategoriesByFamily,
  getSubcategoriesByCategory,
  type Category,
  type Subcategory,
} from '@/lib/categories'
import {
  getBudgetTypes,
  getSubcategoryBudgetDefaults,
  getUserBudgetHistory,
  type BudgetType,
  type CurrentUserBudget,
  budgetPeriodMonths,
} from '@/lib/budgets'
import {
  addMonths,
  fetchCalculatorTransactions,
  getScopedAmount,
  monthRange,
  type CalcTransaction,
} from '@/lib/budget-calculator'
import { calculateGoalProgress, dateToMonth, getSpendingGoals, type GoalProgress, type SpendingGoal } from '@/lib/goals'

// ==================== TIPOS ====================

export const NO_BUDGET_TYPE = '__none__'

export type Status = 'ok' | 'warning' | 'over'

export type BudgetAnalyticsData = {
  members: FamilyMember[]
  budgetTypes: BudgetType[]
  /** Histórico completo de versiones de presupuesto (por persona y partida) */
  budgets: CurrentUserBudget[]
  /** subcategoría → partida por defecto */
  defaults: Map<string, string>
  goals: SpendingGoal[]
  transactions: CalcTransaction[]
  categories: Category[]
  subcategories: Subcategory[]
}

// ==================== CARGA ====================

export async function loadBudgetAnalyticsData(
  supabase: SupabaseClient<Database>,
  idFamily: string
): Promise<BudgetAnalyticsData> {
  const [members, budgetTypes, budgets, defaultsList, goals, transactions, categories] = await Promise.all([
    getFamilyMembers(supabase, idFamily),
    getBudgetTypes(supabase, idFamily, { includeArchived: true }),
    getUserBudgetHistory(supabase, idFamily),
    getSubcategoryBudgetDefaults(supabase, idFamily),
    getSpendingGoals(supabase, { idFamily }),
    fetchCalculatorTransactions(idFamily),
    getAllCategoriesByFamily(supabase, idFamily),
  ])

  const subcategoryLists = await Promise.all(
    categories
      .filter((category) => category.is_expense)
      .map((category) => getSubcategoriesByCategory(supabase, category.id_category))
  )

  return {
    members,
    budgetTypes,
    budgets: budgets.filter((budget) => budget.is_active),
    defaults: new Map(defaultsList.map((item) => [item.id_subcategory, item.id_budget_type])),
    goals,
    transactions,
    categories,
    subcategories: subcategoryLists.flat(),
  }
}

// ==================== UTILIDADES ====================

export function monthLabel(month: string, long = false): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 1, 1)
  const label = date.toLocaleDateString('es-ES', {
    month: long ? 'long' : 'short',
    year: long ? 'numeric' : '2-digit',
  })
  return long ? label.charAt(0).toUpperCase() + label.slice(1) : label.replace('.', '')
}

export function memberName(members: FamilyMember[], idUser: string | null | undefined): string {
  if (!idUser) return 'Familia'
  const member = members.find((item) => item.id_user === idUser)
  return member?.ds_user || member?.ds_email || 'Persona'
}

export function statusFromRatio(ratio: number | null): Status {
  if (ratio === null) return 'ok'
  if (ratio > 1) return 'over'
  if (ratio >= 0.85) return 'warning'
  return 'ok'
}

export function monthlyEquivalent(amount: number, periodicity: string | null | undefined): number {
  return periodicity === 'annual' ? amount / 12 : amount
}

/** Partida real de un gasto: la elegida al registrarlo o, si no la tiene, la de su subcategoría. */
export function resolveBudgetTypeId(tx: CalcTransaction, defaults: Map<string, string>): string {
  if (tx.id_budget_type) return tx.id_budget_type
  if (tx.id_subcategory) {
    const fromDefault = defaults.get(tx.id_subcategory)
    if (fromDefault) return fromDefault
  }
  return NO_BUDGET_TYPE
}

// ==================== PRESUPUESTOS (PARTIDAS) ====================

/** `periodMonths`: meses que cubre el importe cuando es "de todo el periodo" (partida anual con fecha de fin); null si es por año */
type BudgetVersion = { start: string; end: string | null; amount: number; periodMonths: number | null }

/** Índice persona|partida → versiones, para saber qué presupuesto estaba vigente en cada mes. */
function buildBudgetIndex(budgets: CurrentUserBudget[]): Map<string, BudgetVersion[]> {
  const index = new Map<string, BudgetVersion[]>()
  for (const budget of budgets) {
    const key = `${budget.id_user}|${budget.id_budget_type}`
    const list = index.get(key) || []
    list.push({
      start: dateToMonth(budget.dt_start_month),
      end: budget.dt_end_month ? dateToMonth(budget.dt_end_month) : null,
      amount: budget.ft_budget_amount,
      periodMonths: budgetPeriodMonths(budget),
    })
    index.set(key, list)
  }
  index.forEach((list) => list.sort((a, b) => b.start.localeCompare(a.start)))
  return index
}

function activeVersion(index: Map<string, BudgetVersion[]>, idUser: string, idType: string, month: string) {
  const list = index.get(`${idUser}|${idType}`)
  if (!list) return null
  return list.find((version) => version.start <= month && (version.end === null || version.end > month)) || null
}

function scopeUserIds(data: BudgetAnalyticsData, scopeUserId: string | null): string[] {
  if (scopeUserId) return [scopeUserId]
  return Array.from(new Set(data.budgets.map((budget) => budget.id_user)))
}

/** Presupuesto vigente en un mes, en la unidad de la partida (€/mes o €/año). null si no hay ninguno. */
export function budgetAmountInMonth(
  data: BudgetAnalyticsData,
  index: Map<string, BudgetVersion[]>,
  scopeUserId: string | null,
  idType: string,
  month: string
): number | null {
  let total = 0
  let found = false
  for (const idUser of scopeUserIds(data, scopeUserId)) {
    const version = activeVersion(index, idUser, idType, month)
    if (version) {
      total += version.amount
      found = true
    }
  }
  return found ? total : null
}

/** Presupuesto vigente en un mes como equivalente mensual (anual ÷12; de todo el periodo ÷ sus meses). null si no hay ninguno. */
export function monthlyBudgetInMonth(
  data: BudgetAnalyticsData,
  index: Map<string, BudgetVersion[]>,
  scopeUserId: string | null,
  idType: string,
  periodicity: 'monthly' | 'annual' | null,
  month: string
): number | null {
  let total = 0
  let found = false
  for (const idUser of scopeUserIds(data, scopeUserId)) {
    const version = activeVersion(index, idUser, idType, month)
    if (version) {
      total += periodicity === 'annual' ? version.amount / (version.periodMonths ?? 12) : version.amount
      found = true
    }
  }
  return found ? total : null
}

/** Etiqueta de la naturaleza del presupuesto de una partida en un mes: Mensual, Anual o "Periodo · N meses". */
export function budgetPeriodLabel(
  data: BudgetAnalyticsData,
  scopeUserId: string | null,
  idType: string,
  periodicity: 'monthly' | 'annual' | null,
  month: string
): string | undefined {
  if (periodicity === 'monthly') return 'Mensual'
  if (periodicity !== 'annual') return undefined
  const index = buildBudgetIndex(data.budgets)
  for (const idUser of scopeUserIds(data, scopeUserId)) {
    const version = activeVersion(index, idUser, idType, month)
    if (version?.periodMonths) return `Periodo · ${version.periodMonths} ${version.periodMonths === 1 ? 'mes' : 'meses'}`
  }
  return 'Anual'
}

export type BudgetDeadline = {
  /** Último mes en el que el presupuesto sigue vigente (inclusive) */
  lastMonth: string
  /** Meses que quedan contando el actual (0 = ya terminó) */
  monthsLeft: number
  expired: boolean
}

function monthIndex(month: string): number {
  const [year, m] = month.split('-').map(Number)
  return year * 12 + (m - 1)
}

/**
 * Fecha límite del presupuesto de una partida en el mes dado. null si no tiene fecha límite (o nunca tuvo presupuesto).
 * Si el presupuesto ya terminó y no hay otro vigente, devuelve la fecha en la que terminó (expired).
 */
export function budgetDeadline(
  data: BudgetAnalyticsData,
  scopeUserId: string | null,
  idType: string,
  nowMonth: string
): BudgetDeadline | null {
  const userIds = scopeUserIds(data, scopeUserId)
  let lastMonth: string | null = null
  let anyOpenEnded = false
  let lastEndedMonth: string | null = null

  for (const budget of data.budgets) {
    if (budget.id_budget_type !== idType || !userIds.includes(budget.id_user)) continue
    const start = dateToMonth(budget.dt_start_month)
    const end = budget.dt_end_month ? dateToMonth(budget.dt_end_month) : null
    if (start <= nowMonth && (end === null || end > nowMonth)) {
      if (end === null) anyOpenEnded = true
      else {
        const last = addMonthsKey(end, -1)
        if (lastMonth === null || last < lastMonth) lastMonth = last
      }
    } else if (end !== null && end <= nowMonth) {
      const last = addMonthsKey(end, -1)
      if (lastEndedMonth === null || last > lastEndedMonth) lastEndedMonth = last
    }
  }

  if (lastMonth && !anyOpenEnded) {
    return { lastMonth, monthsLeft: monthIndex(lastMonth) - monthIndex(nowMonth) + 1, expired: false }
  }
  const hasActive = lastMonth !== null || anyOpenEnded
  if (!hasActive && lastEndedMonth) return { lastMonth: lastEndedMonth, monthsLeft: 0, expired: true }
  return null
}

function addMonthsKey(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Gasto del alcance, por partida y mes. */
export function spendByTypeAndMonth(
  data: BudgetAnalyticsData,
  scopeUserId: string | null
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>()
  for (const tx of data.transactions) {
    if (tx.type !== 'Expense') continue
    const amount = getScopedAmount(tx, scopeUserId)
    if (!amount) continue
    const idType = resolveBudgetTypeId(tx, data.defaults)
    const byMonth = result.get(idType) || new Map<string, number>()
    byMonth.set(tx.ds_month_declared, (byMonth.get(tx.ds_month_declared) || 0) + amount)
    result.set(idType, byMonth)
  }
  return result
}

export type BudgetMonthPoint = {
  month: string
  /** Equivalente mensual (las partidas anuales se dividen entre 12, o entre los meses del periodo si tienen fecha de fin) */
  budget: number
  spent: number
  hasBudget: boolean
}

export type PartidaSeries = {
  idBudgetType: string
  name: string
  periodicity: 'monthly' | 'annual' | null
  isUnassigned: boolean
  points: BudgetMonthPoint[]
  totalBudget: number
  totalSpent: number
}

export function buildPartidaSeries(
  data: BudgetAnalyticsData,
  scopeUserId: string | null,
  months: string[]
): PartidaSeries[] {
  const index = buildBudgetIndex(data.budgets)
  const spend = spendByTypeAndMonth(data, scopeUserId)

  const build = (
    idBudgetType: string,
    name: string,
    periodicity: 'monthly' | 'annual' | null,
    isUnassigned: boolean
  ): PartidaSeries => {
    const points: BudgetMonthPoint[] = months.map((month) => {
      const monthly = isUnassigned ? null : monthlyBudgetInMonth(data, index, scopeUserId, idBudgetType, periodicity, month)
      return {
        month,
        budget: monthly === null ? 0 : monthly,
        spent: spend.get(idBudgetType)?.get(month) || 0,
        hasBudget: monthly !== null,
      }
    })
    return {
      idBudgetType,
      name,
      periodicity,
      isUnassigned,
      points,
      totalBudget: points.reduce((sum, point) => sum + point.budget, 0),
      totalSpent: points.reduce((sum, point) => sum + point.spent, 0),
    }
  }

  const rows = data.budgetTypes.map((type) =>
    build(type.id_budget_type, type.ds_budget_type, type.ds_periodicity as 'monthly' | 'annual', false)
  )
  const unassigned = build(NO_BUDGET_TYPE, 'Sin partida', null, true)
  if (unassigned.totalSpent > 0) rows.push(unassigned)
  return rows
}

/** Suma de series (agregado de varias partidas, controles, etc.). */
export function sumPoints(series: Array<{ points: BudgetMonthPoint[] }>, months: string[]): BudgetMonthPoint[] {
  return months.map((month, i) => ({
    month,
    budget: series.reduce((sum, item) => sum + item.points[i].budget, 0),
    spent: series.reduce((sum, item) => sum + item.points[i].spent, 0),
    hasBudget: series.some((item) => item.points[i].hasBudget),
  }))
}

// ---------- Estado actual (Home) ----------

export type PartidaStatus = {
  idBudgetType: string
  name: string
  periodicity: 'monthly' | 'annual' | null
  isUnassigned: boolean
  hasBudget: boolean
  /** Presupuesto en su unidad: del mes (mensuales) o del año (anuales) */
  budget: number
  /** Gastado en el mes (mensuales) o en el año (anuales) */
  spent: number
  monthSpent: number
  ratio: number | null
  status: Status
  /** Fracción del periodo transcurrida (para la marca de ritmo) */
  paceFraction: number
  windowLabel: string
  /** month: este mes · year: año natural · period: periodo completo del presupuesto (partida anual con fecha de fin) */
  periodKind: 'month' | 'year' | 'period'
  /** Meses de la ventana de gasto cuando periodKind es 'period' */
  windowMonths: string[]
  periodicityLabel?: string
}

function daysFraction(now: Date): number {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return Math.min(1, now.getDate() / daysInMonth)
}

export function buildPartidaStatus(
  data: BudgetAnalyticsData,
  scopeUserId: string | null,
  now: Date = new Date()
): { rows: PartidaStatus[]; monthlyBudget: number; monthlySpent: number } {
  const nowMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const year = String(now.getFullYear())
  const index = buildBudgetIndex(data.budgets)
  const spend = spendByTypeAndMonth(data, scopeUserId)
  const rows: PartidaStatus[] = []

  const candidates: Array<{ id: string; name: string; periodicity: 'monthly' | 'annual' | null; unassigned: boolean }> = [
    ...data.budgetTypes.map((type) => ({
      id: type.id_budget_type,
      name: type.ds_budget_type,
      periodicity: type.ds_periodicity as 'monthly' | 'annual',
      unassigned: false,
    })),
    { id: NO_BUDGET_TYPE, name: 'Sin partida', periodicity: null, unassigned: true },
  ]

  for (const item of candidates) {
    const byMonth = spend.get(item.id) || new Map<string, number>()
    const monthSpent = byMonth.get(nowMonth) || 0
    const amount = item.unassigned ? null : budgetAmountInMonth(data, index, scopeUserId, item.id, nowMonth)

    if (item.periodicity === 'annual') {
      // Importe "de todo el periodo" (partida anual con fecha de fin): se compara el gasto desde el inicio con el total
      const periodVersions = scopeUserIds(data, scopeUserId)
        .map((idUser) => activeVersion(index, idUser, item.id, nowMonth))
        .filter((version): version is BudgetVersion => version !== null && version.periodMonths !== null && version.end !== null)
      if (periodVersions.length > 0) {
        const start = periodVersions.map((version) => version.start).sort()[0]
        const lastMonth = addMonthsKey(periodVersions.map((version) => version.end as string).sort().reverse()[0], -1)
        const total = periodVersions.reduce((sum, version) => sum + version.amount, 0)
        const periodLength = monthRange(start, lastMonth).length
        const windowMonths = monthRange(start, nowMonth)
        const spent = windowMonths.reduce((sum, month) => sum + (byMonth.get(month) || 0), 0)
        const ratio = total > 0 ? spent / total : null
        rows.push({
          idBudgetType: item.id,
          name: item.name,
          periodicity: 'annual',
          isUnassigned: false,
          hasBudget: true,
          budget: total,
          spent,
          monthSpent,
          ratio,
          status: statusFromRatio(ratio),
          paceFraction: Math.min(1, (monthIndex(nowMonth) - monthIndex(start) + daysFraction(now)) / periodLength),
          windowLabel: `${monthLabel(start)} – ${monthLabel(lastMonth)}`,
          periodKind: 'period',
          windowMonths,
          periodicityLabel: `Periodo · ${periodLength} ${periodLength === 1 ? 'mes' : 'meses'}`,
        })
        continue
      }

      // Anuales: gasto acumulado del año (desde que existe presupuesto este año) frente al total anual
      const yearMonths = monthRange(`${year}-01`, nowMonth)
      const firstCovered = yearMonths.find(
        (month) => budgetAmountInMonth(data, index, scopeUserId, item.id, month) !== null
      )
      const windowStart = firstCovered || `${year}-01`
      const spent = monthRange(windowStart, nowMonth).reduce((sum, month) => sum + (byMonth.get(month) || 0), 0)
      if (amount === null && spent === 0) continue
      const ratio = amount && amount > 0 ? spent / amount : null
      rows.push({
        idBudgetType: item.id,
        name: item.name,
        periodicity: 'annual',
        isUnassigned: false,
        hasBudget: amount !== null,
        budget: amount || 0,
        spent,
        monthSpent,
        ratio,
        status: statusFromRatio(ratio),
        paceFraction: (now.getMonth() + daysFraction(now)) / 12,
        windowLabel: `Año ${year}`,
        periodKind: 'year',
        windowMonths: [],
        periodicityLabel: 'Anual',
      })
      continue
    }

    if (amount === null && monthSpent === 0) continue
    const ratio = amount && amount > 0 ? monthSpent / amount : null
    rows.push({
      idBudgetType: item.id,
      name: item.name,
      periodicity: item.periodicity,
      isUnassigned: item.unassigned,
      hasBudget: amount !== null,
      budget: amount || 0,
      spent: monthSpent,
      monthSpent,
      ratio,
      status: item.unassigned ? 'warning' : statusFromRatio(ratio),
      paceFraction: daysFraction(now),
      windowLabel: monthLabel(nowMonth, true),
      periodKind: 'month',
      windowMonths: [nowMonth],
      periodicityLabel: item.periodicity === 'monthly' ? 'Mensual' : undefined,
    })
  }

  const monthlyRows = rows.filter((row) => row.periodicity === 'monthly')
  return {
    rows,
    monthlyBudget: monthlyRows.reduce((sum, row) => sum + row.budget, 0),
    monthlySpent: monthlyRows.reduce((sum, row) => sum + row.spent, 0),
  }
}

// ---------- Desglose partida → vertical → subvertical ----------

export type BreakdownNode = {
  key: string
  label: string
  series: number[]
  total: number
  children: BreakdownNode[]
}

export function buildPartidaBreakdown(
  data: BudgetAnalyticsData,
  scopeUserId: string | null,
  months: string[]
): BreakdownNode[] {
  const monthIndex = new Map(months.map((month, i) => [month, i]))
  const typeNames = new Map(data.budgetTypes.map((type) => [type.id_budget_type, type.ds_budget_type]))
  const order = new Map(data.budgetTypes.map((type, i) => [type.id_budget_type, i]))

  type Acc = { label: string; series: number[]; children: Map<string, Acc> }
  const makeAcc = (label: string): Acc => ({ label, series: new Array(months.length).fill(0), children: new Map() })
  const root = new Map<string, Acc>()

  for (const tx of data.transactions) {
    if (tx.type !== 'Expense') continue
    const i = monthIndex.get(tx.ds_month_declared)
    if (i === undefined) continue
    const amount = getScopedAmount(tx, scopeUserId)
    if (!amount) continue

    const idType = resolveBudgetTypeId(tx, data.defaults)
    const level1 = root.get(idType) || makeAcc(typeNames.get(idType) || 'Sin partida')
    root.set(idType, level1)
    const catKey = tx.id_category || 'none'
    const level2 = level1.children.get(catKey) || makeAcc(tx.ds_category)
    level1.children.set(catKey, level2)
    const subKey = tx.id_subcategory || 'none'
    const level3 = level2.children.get(subKey) || makeAcc(tx.id_subcategory ? tx.ds_subcategory : 'Sin subcategoría')
    level2.children.set(subKey, level3)

    level1.series[i] += amount
    level2.series[i] += amount
    level3.series[i] += amount
  }

  const toNodes = (map: Map<string, Acc>, prefix: string): BreakdownNode[] =>
    Array.from(map.entries())
      .map(([key, acc]) => ({
        key: `${prefix}/${key}`,
        label: acc.label,
        series: acc.series,
        total: acc.series.reduce((sum, value) => sum + value, 0),
        children: toNodes(acc.children, `${prefix}/${key}`),
      }))
      .sort((a, b) => b.total - a.total)

  return Array.from(root.entries())
    .sort(([a], [b]) => {
      const oa = a === NO_BUDGET_TYPE ? 999 : order.get(a) ?? 998
      const ob = b === NO_BUDGET_TYPE ? 999 : order.get(b) ?? 998
      return oa - ob
    })
    .map(([key, acc]) => ({
      key,
      label: acc.label,
      series: acc.series,
      total: acc.series.reduce((sum, value) => sum + value, 0),
      children: toNodes(acc.children, key),
    }))
}

// ==================== CONTROLES DE GASTO ====================

export type GoalView = {
  goal: SpendingGoal
  kind: 'cat' | 'sub'
  label: string
  categoryLabel: string | null
  userName: string
  progress: GoalProgress
}

export function goalTargetLabel(data: BudgetAnalyticsData, goal: SpendingGoal) {
  if (goal.id_subcategory) {
    const sub = data.subcategories.find((item) => item.id_subcategory === goal.id_subcategory)
    const cat = sub ? data.categories.find((item) => item.id_category === sub.id_category) : null
    return { kind: 'sub' as const, label: sub?.ds_subcategory || 'Subcategoría', categoryLabel: cat?.ds_category || null }
  }
  const cat = data.categories.find((item) => item.id_category === goal.id_category)
  return { kind: 'cat' as const, label: cat?.ds_category || 'Categoría', categoryLabel: null }
}

export function buildGoalViews(
  data: BudgetAnalyticsData,
  scopeUserId: string | null,
  nowMonth: string
): GoalView[] {
  return data.goals
    .filter((goal) => !scopeUserId || goal.id_user === scopeUserId)
    .map((goal) => {
      const target = goalTargetLabel(data, goal)
      return {
        goal,
        ...target,
        userName: memberName(data.members, goal.id_user),
        progress: calculateGoalProgress(goal, data.transactions, goal.id_user, nowMonth),
      }
    })
}

export type GoalMonthPoint = { month: string; target: number; spent: number; inPeriod: boolean }

function goalMatches(goal: SpendingGoal, tx: CalcTransaction): boolean {
  return goal.id_subcategory ? tx.id_subcategory === goal.id_subcategory : tx.id_category === goal.id_category
}

export function goalMonthlySeries(
  data: BudgetAnalyticsData,
  goal: SpendingGoal,
  months: string[]
): GoalMonthPoint[] {
  const start = dateToMonth(goal.dt_start_month)
  const end = dateToMonth(goal.dt_end_month)
  const totalMonths = Math.max(1, monthRange(start, end).length)
  const perMonthTarget = goal.ds_periodicity === 'monthly' ? goal.ft_goal_amount : goal.ft_goal_amount / totalMonths
  const spentByMonth = new Map<string, number>()
  for (const tx of data.transactions) {
    if (tx.type !== 'Expense' || !goalMatches(goal, tx)) continue
    const amount = getScopedAmount(tx, goal.id_user)
    if (!amount) continue
    spentByMonth.set(tx.ds_month_declared, (spentByMonth.get(tx.ds_month_declared) || 0) + amount)
  }
  return months.map((month) => {
    const inPeriod = month >= start && month <= end
    return { month, inPeriod, target: inPeriod ? perMonthTarget : 0, spent: spentByMonth.get(month) || 0 }
  })
}

/** Gasto mensual de una vertical o subvertical, con el objetivo que tenga fijado (si lo hay). */
export function verticalMonthlySeries(
  data: BudgetAnalyticsData,
  scopeUserId: string | null,
  months: string[],
  target: { kind: 'cat' | 'sub'; id: string }
): BudgetMonthPoint[] {
  const spent = new Map<string, number>()
  for (const tx of data.transactions) {
    if (tx.type !== 'Expense') continue
    const matches = target.kind === 'sub' ? tx.id_subcategory === target.id : tx.id_category === target.id
    if (!matches) continue
    const amount = getScopedAmount(tx, scopeUserId)
    if (!amount) continue
    spent.set(tx.ds_month_declared, (spent.get(tx.ds_month_declared) || 0) + amount)
  }

  const goals = data.goals.filter(
    (goal) =>
      (!scopeUserId || goal.id_user === scopeUserId) &&
      (target.kind === 'sub' ? goal.id_subcategory === target.id : goal.id_category === target.id && !goal.id_subcategory)
  )
  const goalSeries = goals.map((goal) => goalMonthlySeries(data, goal, months))

  return months.map((month, i) => ({
    month,
    spent: spent.get(month) || 0,
    budget: goalSeries.reduce((sum, series) => sum + series[i].target, 0),
    hasBudget: goalSeries.some((series) => series[i].inPeriod),
  }))
}

/** Primer mes con presupuesto de la persona (o de cualquiera de la familia). Antes no hay nada con qué comparar. */
export function budgetCoverageStart(data: BudgetAnalyticsData, scopeUserId: string | null): string | null {
  const months = data.budgets
    .filter((budget) => !scopeUserId || budget.id_user === scopeUserId)
    .map((budget) => dateToMonth(budget.dt_start_month))
    .sort()
  return months[0] || null
}

// ==================== RANGO DE MESES ====================

export type RangePreset = '6m' | '12m' | 'year' | 'all' | 'custom'

export function monthsForPreset(preset: RangePreset, nowMonth: string, earliest: string | null): string[] {
  if (preset === '6m') return monthRange(addMonths(nowMonth, -5), nowMonth)
  if (preset === '12m') return monthRange(addMonths(nowMonth, -11), nowMonth)
  if (preset === 'year') {
    const year = nowMonth.slice(0, 4)
    return monthRange(`${year}-01`, nowMonth)
  }
  return monthRange(earliest || addMonths(nowMonth, -11), nowMonth)
}

export function earliestMonth(data: BudgetAnalyticsData): string | null {
  const months: string[] = []
  data.transactions.forEach((tx) => months.push(tx.ds_month_declared))
  data.budgets.forEach((budget) => months.push(dateToMonth(budget.dt_start_month)))
  data.goals.forEach((goal) => months.push(dateToMonth(goal.dt_start_month)))
  const valid = months.filter(Boolean).sort()
  return valid[0] || null
}


// ==================== DESGLOSE DE UNA PARTIDA: ¿POR QUÉ ME HE PASADO O QUEDADO CORTO? ====================

export type SpendTx = {
  id: string
  date: string
  comment: string | null
  tag: string | null
  amount: number
}

export type SpendTreeNode = {
  key: string
  level: 'cat' | 'sub'
  label: string
  idCategory: string | null
  idSubcategory: string | null
  total: number
  /** Parte del gasto total de la partida */
  share: number
  /** Gasto medio mensual en el periodo */
  monthlyAvg: number
  /** Gasto medio mensual en los meses previos de referencia */
  baselineMonthly: number
  /** monthlyAvg − baselineMonthly (positivo = gastas más de lo habitual) */
  delta: number
  children: SpendTreeNode[]
  transactions: SpendTx[]
}

export type SpendTree = {
  total: number
  monthlyAvg: number
  baselineMonthly: number
  baselineMonths: number
  nodes: SpendTreeNode[]
  txCount: number
}

/**
 * Gasto de una partida (o de todas si idBudgetType es null) por vertical → subvertical → gasto concreto,
 * comparado con la media mensual de los 3 meses anteriores al periodo.
 */
export function buildSpendTree(
  data: BudgetAnalyticsData,
  scopeUserId: string | null,
  params: { months: string[]; idBudgetType: string | null; baselineCount?: number }
): SpendTree {
  const { months, idBudgetType } = params
  const baselineCount = params.baselineCount ?? 3
  const monthSet = new Set(months)
  const baselineMonths = months.length > 0 ? monthRange(addMonths(months[0], -baselineCount), addMonths(months[0], -1)) : []
  const baselineSet = new Set(baselineMonths)

  type Acc = {
    key: string
    level: 'cat' | 'sub'
    label: string
    idCategory: string | null
    idSubcategory: string | null
    total: number
    baseline: number
    children: Map<string, Acc>
    transactions: SpendTx[]
  }
  const makeAcc = (key: string, level: 'cat' | 'sub', label: string, idCategory: string | null, idSubcategory: string | null): Acc => ({
    key, level, label, idCategory, idSubcategory, total: 0, baseline: 0, children: new Map(), transactions: [],
  })

  const roots = new Map<string, Acc>()
  let total = 0
  let baselineTotal = 0
  let txCount = 0

  for (const tx of data.transactions) {
    if (tx.type !== 'Expense') continue
    const inWindow = monthSet.has(tx.ds_month_declared)
    const inBaseline = baselineSet.has(tx.ds_month_declared)
    if (!inWindow && !inBaseline) continue
    if (idBudgetType !== null && resolveBudgetTypeId(tx, data.defaults) !== idBudgetType) continue
    const amount = getScopedAmount(tx, scopeUserId)
    if (!amount) continue

    const catKey = tx.id_category || 'none'
    const cat = roots.get(catKey) || makeAcc(`cat:${catKey}`, 'cat', tx.ds_category, tx.id_category, null)
    roots.set(catKey, cat)
    const subKey = tx.id_subcategory || 'none'
    const sub =
      cat.children.get(subKey) ||
      makeAcc(`sub:${catKey}:${subKey}`, 'sub', tx.id_subcategory ? tx.ds_subcategory : 'Sin subcategoría', tx.id_category, tx.id_subcategory)
    cat.children.set(subKey, sub)

    if (inWindow) {
      cat.total += amount
      sub.total += amount
      total += amount
      txCount++
      const spendTx = { id: tx.id_transaction, date: tx.dt_date, comment: tx.ds_comments, tag: tx.ds_tag, amount }
      sub.transactions.push(spendTx)
    } else {
      cat.baseline += amount
      sub.baseline += amount
      baselineTotal += amount
    }
  }

  const windowCount = Math.max(1, months.length)
  const baseCount = Math.max(1, baselineMonths.length)

  const toNode = (acc: Acc): SpendTreeNode => {
    const monthlyAvg = acc.total / windowCount
    const baselineMonthly = acc.baseline / baseCount
    return {
      key: acc.key,
      level: acc.level,
      label: acc.label,
      idCategory: acc.idCategory,
      idSubcategory: acc.idSubcategory,
      total: acc.total,
      share: total > 0 ? acc.total / total : 0,
      monthlyAvg,
      baselineMonthly,
      delta: monthlyAvg - baselineMonthly,
      children: Array.from(acc.children.values())
        .map(toNode)
        .filter((node) => node.total > 0)
        .sort((a, b) => b.total - a.total),
      transactions: acc.transactions.sort((a, b) => b.amount - a.amount),
    }
  }

  const nodes = Array.from(roots.values())
    .map(toNode)
    .filter((node) => node.total > 0)
    .sort((a, b) => b.total - a.total)

  return {
    total,
    monthlyAvg: total / windowCount,
    baselineMonthly: baselineTotal / baseCount,
    baselineMonths: baselineMonths.length,
    nodes,
    txCount,
  }
}
