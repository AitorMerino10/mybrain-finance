import { budgetMonthlyAmount, budgetTypeAppliesTo, type BudgetSubtype, type BudgetType, type CurrentUserBudget } from '@/lib/budgets'
import { planIncomeMonthly, planMonthsOf, type BudgetPlan, type BudgetPlanSnapshot } from '@/lib/budget-plans'
import type { BudgetAnalyticsData } from '@/lib/budget-analytics'
import { NO_BUDGET_TYPE, resolveBudgetTypeId } from '@/lib/budget-analytics'
import { addMonths, getScopedAmount, parseNumber, round2, type CalcTransaction } from '@/lib/budget-calculator'
import { monthOfClose, type BudgetClose } from '@/lib/budget-closes'
import {
  SAVINGS_ID,
  computeDefaultIncomeAllocation,
  parseAllocationAmount,
  type AllocationRow,
} from '@/lib/income-allocations'

export type PartidaBalance = {
  idBudgetType: string
  name: string
  /** Lo arrastrado del último cierre */
  opening: number
  /** Lo que han aportado los ingresos a la partida desde el último cierre */
  funded: number
  spent: number
  /** opening + funded - spent */
  balance: number
  /** Mes a mes desde el inicio del periodo: lo aportado y lo gastado */
  months: { month: string; funded: number; spent: number }[]
}

export type UserBalance = {
  idUser: string
  /** Primer mes que se está contando: el inicio del presupuesto vigente (o el del ciclo abierto si es posterior); null si no hay presupuesto */
  cycleStart: string | null
  /** Primer mes sin cerrar (último cierre + 1, o el inicio del primer presupuesto). Anterior a `cycleStart` si hay un periodo sin cerrar */
  openCycleStart: string | null
  /** Último mes incluido en el cálculo */
  asOfMonth: string
  lastClose: string | null
  incomeTotal: number
  partidas: PartidaBalance[]
  /** Gasto sin partida asignada */
  unassignedSpent: number
  /** Todo lo gastado en el periodo (en partidas y sin partida) */
  spentTotal: number
  /** Ingreso que no se ha llevado a ninguna partida */
  unallocatedIncome: number
  /** Gasto por encima de lo aportado, sumado por partida */
  overspent: number
  /** Ingresos que no han ido a ninguna partida, menos lo gastado por encima de lo aportado y el gasto sin partida */
  periodSavings: number
  /** Ahorro que ya se cerró en periodos anteriores */
  previousSavings: number
  /** Sobrante de las partidas en este ciclo (aportado - gastado, solo donde sobra): ahorrado "de más" pero aún dentro de la partida */
  surplus: number
  /** Ahorro real del ciclo: lo ahorrado por no estar en ninguna partida + el sobrante de las partidas */
  realSavings: number
}

export type BalanceInput = {
  idUser: string
  /** Último mes incluido (YYYY-MM) */
  asOfMonth: string
  transactions: CalcTransaction[]
  allocations: Map<string, AllocationRow[]>
  versions: CurrentUserBudget[]
  budgetTypes: BudgetType[]
  plans: BudgetPlan[]
  subtypes: BudgetSubtype[]
  defaults: Map<string, string>
  closes: BudgetClose[]
  /**
   * Empezar a contar en este mes (YYYY-MM) en lugar de en el primer mes sin cerrar: así se ve solo el presupuesto vigente.
   * Si es posterior al inicio del ciclo abierto, el periodo anterior queda pendiente de cerrar y no arrastra saldo.
   */
  periodStart?: string | null
}

/**
 * Saldo de cada partida de una persona en el ciclo abierto.
 * - Aportado: reparto de cada ingreso (el guardado, o el calculado con el presupuesto vigente de ese mes) por su parte del ingreso.
 * - Gastado: gastos con esa partida (o la de su subcategoría).
 * - Si en un cierre se dejó algo en la partida, el ciclo arranca con ese saldo.
 * El ahorro del periodo es lo que no fue a ninguna partida, descontando el exceso de gasto de cada una y el gasto sin partida.
 */
export function computeUserBalance(input: BalanceInput): UserBalance {
  const { idUser, asOfMonth, transactions, allocations, versions, budgetTypes, plans, subtypes, defaults, closes, periodStart } = input
  const userCloses = closes.filter((close) => close.id_user === idUser)
  const lastClose = userCloses.map(monthOfClose).sort().pop() || null

  const firstBudget = versions
    .filter((version) => version.id_user === idUser && version.is_active)
    .map((version) => version.dt_start_month.slice(0, 7))
    .sort()[0]
  const openCycleStart = lastClose ? addMonths(lastClose, 1) : firstBudget || null
  const skipsPreviousPeriod = Boolean(openCycleStart && periodStart && periodStart > openCycleStart)
  const cycleStart = skipsPreviousPeriod ? (periodStart as string) : openCycleStart

  const previousSavings = round2(userCloses.reduce((sum, close) => sum + (close.ft_to_savings || 0), 0))
  const empty: UserBalance = {
    idUser,
    cycleStart,
    openCycleStart,
    asOfMonth,
    lastClose,
    incomeTotal: 0,
    partidas: [],
    unassignedSpent: 0,
    spentTotal: 0,
    unallocatedIncome: 0,
    overspent: 0,
    periodSavings: 0,
    previousSavings,
    surplus: 0,
    realSavings: 0,
  }
  if (!cycleStart || cycleStart > asOfMonth) return { ...empty, partidas: skipsPreviousPeriod ? [] : openingOnly(userCloses, lastClose, budgetTypes) }

  const funded = new Map<string, number>()
  const spent = new Map<string, number>()
  const fundedByMonth = new Map<string, number>()
  const spentByMonth = new Map<string, number>()
  let incomeTotal = 0
  let unassignedSpent = 0

  for (const tx of transactions) {
    if (tx.ds_month_declared < cycleStart || tx.ds_month_declared > asOfMonth) continue
    const share = getScopedAmount(tx, idUser)
    if (!share) continue

    if (tx.type === 'Income') {
      incomeTotal += share
      const stored = allocations.get(tx.id_transaction)
      const rows: AllocationRow[] = stored
        ? stored.map((row) => ({ ...row, amount: String(round2((parseAllocationAmount(row.amount) * share) / (tx.ft_amount || share))) }))
        : computeDefaultIncomeAllocation({
            amount: share,
            userIds: [idUser],
            month: tx.ds_month_declared,
            versions,
            budgetTypes,
            plans,
            subtypes,
          })
      for (const row of rows) {
        if (row.id_budget_type === SAVINGS_ID) continue
        const amount = parseAllocationAmount(row.amount)
        funded.set(row.id_budget_type, (funded.get(row.id_budget_type) || 0) + amount)
        const key = `${row.id_budget_type}|${tx.ds_month_declared}`
        fundedByMonth.set(key, (fundedByMonth.get(key) || 0) + amount)
      }
    } else if (tx.type === 'Expense') {
      const idType = resolveBudgetTypeId(tx, defaults)
      if (idType === NO_BUDGET_TYPE) unassignedSpent += share
      else {
        spent.set(idType, (spent.get(idType) || 0) + share)
        const key = `${idType}|${tx.ds_month_declared}`
        spentByMonth.set(key, (spentByMonth.get(key) || 0) + share)
      }
    }
  }

  const monthList: string[] = []
  for (let cursor = cycleStart; cursor <= asOfMonth; cursor = addMonths(cursor, 1)) monthList.push(cursor)
  const openings = skipsPreviousPeriod ? new Map<string, number>() : openingByType(userCloses, lastClose)
  const ids = new Set<string>([...Array.from(funded.keys()), ...Array.from(spent.keys()), ...Array.from(openings.keys())])
  const partidas: PartidaBalance[] = budgetTypes
    .filter((type) => ids.has(type.id_budget_type) || (!type.is_archived && budgetTypeAppliesTo(type, idUser)))
    .map((type) => {
      const opening = openings.get(type.id_budget_type) || 0
      const fundedAmount = funded.get(type.id_budget_type) || 0
      const spentAmount = spent.get(type.id_budget_type) || 0
      return {
        idBudgetType: type.id_budget_type,
        name: type.ds_budget_type,
        opening: round2(opening),
        funded: round2(fundedAmount),
        spent: round2(spentAmount),
        balance: round2(opening + fundedAmount - spentAmount),
        months: monthList.map((month) => ({
          month,
          funded: round2(fundedByMonth.get(`${type.id_budget_type}|${month}`) || 0),
          spent: round2(spentByMonth.get(`${type.id_budget_type}|${month}`) || 0),
        })),
      }
    })

  const totalFunded = Array.from(funded.values()).reduce((sum, value) => sum + value, 0)
  const overdraft = partidas.reduce((sum, partida) => sum + Math.max(0, -partida.balance), 0)
  const periodSavings = round2(incomeTotal - totalFunded - overdraft - unassignedSpent)
  const surplus = round2(
    partidas.reduce((sum, partida) => sum + Math.max(0, Math.min(partida.balance, partida.funded - partida.spent)), 0)
  )

  return {
    idUser,
    cycleStart,
    openCycleStart,
    asOfMonth,
    lastClose,
    incomeTotal: round2(incomeTotal),
    partidas,
    unassignedSpent: round2(unassignedSpent),
    spentTotal: round2(unassignedSpent + Array.from(spent.values()).reduce((sum, value) => sum + value, 0)),
    unallocatedIncome: round2(incomeTotal - totalFunded),
    overspent: round2(overdraft),
    periodSavings,
    previousSavings,
    surplus,
    realSavings: round2(periodSavings + surplus),
  }
}

/** Extras (además de las transacciones y presupuestos de la analítica) necesarios para calcular saldos. */
export type BalanceExtras = {
  allocations: Map<string, AllocationRow[]>
  closes: BudgetClose[]
  plans: BudgetPlan[]
  subtypes: BudgetSubtype[]
}

/** Saldo de una persona a partir de los datos de la analítica de presupuestos. */
export function balanceFromAnalytics(
  data: BudgetAnalyticsData,
  extras: BalanceExtras,
  idUser: string,
  asOfMonth: string,
  /** true (por defecto): solo el presupuesto vigente. false: todo el ciclo sin cerrar (para cerrar un periodo anterior) */
  currentPeriodOnly = true
): UserBalance {
  return computeUserBalance({
    periodStart: currentPeriodOnly ? currentBudgetStart(data.budgets, idUser, asOfMonth) : null,
    idUser,
    asOfMonth,
    transactions: data.transactions,
    allocations: extras.allocations,
    versions: data.budgets,
    budgetTypes: data.budgetTypes,
    plans: extras.plans,
    subtypes: extras.subtypes,
    defaults: data.defaults,
    closes: extras.closes,
  })
}

export type SavingsGoalProgress = {
  mode: 'percent' | 'amount' | 'auto'
  /** % o €/mes del objetivo (en modo automático, el ahorro mensual que salía en la calculadora) */
  value: number
  /** Ingresado en el ciclo hasta hoy */
  incomeSoFar: number
  /** Ahorrado de verdad hasta hoy (suma de lo ahorrado sin partida y del sobrante de las partidas) */
  saved: number
  savedUnallocated: number
  savedSurplus: number
  /** Gastado en el ciclo hasta hoy */
  spent: number
  /** Ingreso que no se llevó a ninguna partida */
  unallocatedIncome: number
  /** Gasto por encima de lo aportado a las partidas */
  overspent: number
  /** Gasto sin partida */
  unassignedSpent: number
  /** Lo que tocaría llevar ahorrado hasta hoy para cumplir el objetivo */
  targetToDate: number
  /** Objetivo de todo el periodo del presupuesto (null si no se puede estimar) */
  targetTotal: number | null
  /** saved / targetToDate */
  ratio: number | null
  monthsElapsed: number
  periodMonths: number
}

/**
 * Objetivo de ahorro del presupuesto (el % o la cantidad mensual fijados en la calculadora) frente a lo ahorrado hasta hoy
 * en el ciclo: no solo el mes, sino el agregado. null si no hay objetivo (sin plan o modo automático).
 */
export function savingsGoalProgress(
  balance: UserBalance,
  plan: BudgetPlanSnapshot | null,
  nowMonth: string,
  /** Presupuesto mensual vigente (suma de las partidas en equivalente mensual): da el objetivo en modo automático */
  monthlyBudget = 0
): SavingsGoalProgress | null {
  if (!plan || !balance.cycleStart) return null
  if (plan.savingsMode !== 'percent' && plan.savingsMode !== 'amount' && plan.savingsMode !== 'auto') return null
  const mode = plan.savingsMode
  // Automático: lo que sale de restar el presupuesto a los ingresos estimados en la calculadora
  const value = mode === 'auto' ? Math.max(0, planIncomeMonthly(plan) - monthlyBudget) : parseNumber(plan.savingsValue)
  if (value <= 0) return null
  const monthsElapsed = Math.max(1, monthsBetween(balance.cycleStart, nowMonth) + 1)
  const periodMonths = planMonthsOf(plan)
  const targetToDate = mode === 'percent' ? (balance.incomeTotal * value) / 100 : value * monthsElapsed
  const planIncome = planIncomeMonthly(plan)
  const targetTotal = mode === 'percent' ? (planIncome > 0 ? (planIncome * periodMonths * value) / 100 : null) : value * periodMonths
  return {
    mode,
    value,
    incomeSoFar: balance.incomeTotal,
    saved: balance.realSavings,
    savedUnallocated: balance.periodSavings,
    savedSurplus: balance.surplus,
    spent: balance.spentTotal,
    unallocatedIncome: balance.unallocatedIncome,
    overspent: balance.overspent,
    unassignedSpent: balance.unassignedSpent,
    targetToDate: round2(targetToDate),
    targetTotal: targetTotal === null ? null : round2(targetTotal),
    ratio: targetToDate > 0 ? balance.realSavings / targetToDate : null,
    monthsElapsed,
    periodMonths,
  }
}

function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  return (toYear - fromYear) * 12 + (toMonth - fromMonth)
}

function openingByType(userCloses: BudgetClose[], lastClose: string | null): Map<string, number> {
  const map = new Map<string, number>()
  if (!lastClose) return map
  userCloses
    .filter((close) => monthOfClose(close) === lastClose && close.id_budget_type)
    .forEach((close) => map.set(close.id_budget_type as string, close.ft_carried || 0))
  return map
}

function openingOnly(userCloses: BudgetClose[], lastClose: string | null, budgetTypes: BudgetType[]): PartidaBalance[] {
  const openings = openingByType(userCloses, lastClose)
  return budgetTypes
    .filter((type) => openings.has(type.id_budget_type))
    .map((type) => {
      const opening = round2(openings.get(type.id_budget_type) || 0)
      return { idBudgetType: type.id_budget_type, name: type.ds_budget_type, opening, funded: 0, spent: 0, balance: opening, months: [] }
    })
}

function activeVersionsOf(versions: CurrentUserBudget[], idUser: string) {
  return versions.filter((version) => version.id_user === idUser && version.is_active)
}

/** Inicio del presupuesto vigente de la persona en ese mes (el más reciente entre los vigentes), o null. */
/** Presupuesto mensual vigente de la persona en un mes: suma de sus partidas en equivalente mensual. */
export function monthlyBudgetTotal(versions: CurrentUserBudget[], budgetTypes: BudgetType[], idUser: string, month: string): number {
  const byType = new Map<string, CurrentUserBudget>()
  activeVersionsOf(versions, idUser)
    .filter((version) => version.dt_start_month.slice(0, 7) <= month && (!version.dt_end_month || version.dt_end_month.slice(0, 7) > month))
    .sort((a, b) => a.dt_start_month.localeCompare(b.dt_start_month))
    .forEach((version) => byType.set(version.id_budget_type, version))
  let total = 0
  byType.forEach((version, idBudgetType) => {
    const type = budgetTypes.find((item) => item.id_budget_type === idBudgetType)
    total += budgetMonthlyAmount(version, type?.ds_periodicity)
  })
  return round2(total)
}

export function currentBudgetStart(versions: CurrentUserBudget[], idUser: string, month: string): string | null {
  const starts = activeVersionsOf(versions, idUser)
    .filter((version) => version.dt_start_month.slice(0, 7) <= month && (!version.dt_end_month || version.dt_end_month.slice(0, 7) > month))
    .map((version) => version.dt_start_month.slice(0, 7))
    .sort()
  return starts.pop() || null
}

/**
 * Mes en el que se puede cerrar un periodo: acabó y todavía no se ha cerrado.
 * - Si ya empezó otro presupuesto, el anterior acabó el mes antes de que empezara el nuevo.
 * - Si no hay ninguno vigente, acabó en el último mes del último presupuesto.
 * `openCycleStart` es el primer mes sin cerrar. Devuelve una lista (vacía si no hay nada que cerrar).
 */
export function closableMonths(versions: CurrentUserBudget[], idUser: string, openCycleStart: string | null, nowMonth: string): string[] {
  if (!openCycleStart) return []
  const blockStart = currentBudgetStart(versions, idUser, nowMonth)
  if (blockStart) {
    const lastMonth = addMonths(blockStart, -1)
    return blockStart > openCycleStart && lastMonth < nowMonth ? [lastMonth] : []
  }
  const lastMonth = activeVersionsOf(versions, idUser)
    .filter((version) => version.dt_end_month)
    .map((version) => addMonths(version.dt_end_month!.slice(0, 7), -1))
    .sort()
    .pop()
  return lastMonth && lastMonth >= openCycleStart && lastMonth < nowMonth ? [lastMonth] : []
}

/** Fin (último mes incluido) del periodo actual, o null si el presupuesto vigente no tiene fecha de fin. */
export function upcomingPeriodEnd(versions: CurrentUserBudget[], idUser: string, nowMonth: string): string | null {
  const ends = activeVersionsOf(versions, idUser)
    .filter(
      (version) =>
        version.dt_start_month.slice(0, 7) <= nowMonth && version.dt_end_month && version.dt_end_month.slice(0, 7) > nowMonth
    )
    .map((version) => addMonths(version.dt_end_month!.slice(0, 7), -1))
    .sort()
  return ends.pop() || null
}

export type UnassignedRow = {
  tx: CalcTransaction
  /** Importe que corresponde al alcance elegido (persona o familia) */
  amount: number
  type: 'Income' | 'Expense'
  reason: string
}

/**
 * Movimientos que no están asociados a ninguna partida ni a ahorro:
 * - Gastos sin partida (ni propia ni heredada de su subcategoría).
 * - Ingresos sin reparto guardado y sin presupuesto vigente ese mes (el reparto por defecto no los lleva a ninguna partida).
 */
export function buildUnassignedRows(
  data: BudgetAnalyticsData,
  extras: Pick<BalanceExtras, 'allocations' | 'plans' | 'subtypes'>,
  scopeUserId: string | null,
  months: string[]
): UnassignedRow[] {
  const monthSet = new Set(months)
  const rows: UnassignedRow[] = []
  for (const tx of data.transactions) {
    if (!monthSet.has(tx.ds_month_declared)) continue
    const amount = getScopedAmount(tx, scopeUserId)
    if (!amount) continue

    if (tx.type === 'Expense') {
      if (resolveBudgetTypeId(tx, data.defaults) === NO_BUDGET_TYPE) {
        rows.push({ tx, amount, type: 'Expense', reason: 'Sin partida' })
      }
    } else if (tx.type === 'Income') {
      if (extras.allocations.has(tx.id_transaction)) continue
      const userIds = scopeUserId ? [scopeUserId] : tx.users.map((user) => user.id_user)
      const rowsByDefault = computeDefaultIncomeAllocation({
        amount,
        userIds,
        month: tx.ds_month_declared,
        versions: data.budgets,
        budgetTypes: data.budgetTypes,
        plans: extras.plans,
        subtypes: extras.subtypes,
      })
      if (rowsByDefault.length === 0) {
        rows.push({ tx, amount, type: 'Income', reason: 'Sin reparto ni presupuesto vigente' })
      }
    }
  }
  return rows.sort((a, b) => b.tx.dt_date.localeCompare(a.tx.dt_date))
}
