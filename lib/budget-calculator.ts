import type { BudgetType } from '@/lib/budgets'

// ==================== TIPOS ====================

export type CalcUserShare = {
  id_user: string
  ds_user: string | null
  ft_amount_user: number
}

export type CalcTransaction = {
  id_transaction: string
  dt_date: string
  ds_month_declared: string // YYYY-MM
  ds_comments: string | null
  id_category: string | null
  ds_category: string
  id_subcategory: string | null
  ds_subcategory: string
  id_tag: string | null
  ds_tag: string | null
  type: 'Income' | 'Expense' | null
  /** Partida elegida al registrar el gasto (null en los históricos anteriores a los presupuestos) */
  id_budget_type: string | null
  ft_amount: number
  users: CalcUserShare[]
}

export type PeriodRow = {
  tx: CalcTransaction
  amount: number
}

export type StatMethod = 'avg' | 'median' | 'p75'

export type SeriesStats = {
  total: number
  avg: number
  median: number
  p75: number
  max: number
  monthsWithSpend: number
}

export type ExpenseGroup = {
  key: string
  idCategory: string | null
  dsCategory: string
  idSubcategory: string | null
  dsSubcategory: string
  series: number[]
  stats: SeriesStats
}

/** Presupuesto de una subcategoría (en la unidad de su partida: €/mes o €/año). */
export type GroupLine = {
  type: BudgetType | null
  suggestion: number
  amount: number
  /** Importe fijado a mano en esta subcategoría */
  overridden: boolean
  /** Su importe sale del reparto de un total fijado para la vertical (no está fijado a mano) */
  fromCategory?: boolean
}

/** Presupuesto final de una partida = suma de sus subcategorías. */
export type BudgetLine = {
  type: BudgetType
  stats: SeriesStats
  typeSuggestion: number // propuesta calculada sobre el total de la partida (referencia)
  amount: number
  wasOverridden: boolean
  monthlyEquivalent: number
}

export const METHOD_LABELS: Record<StatMethod, string> = {
  avg: 'la media',
  median: 'la mediana',
  p75: 'el percentil 75',
}

// ==================== UTILIDADES NUMÉRICAS ====================

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function parseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatMoney(value: number | null | undefined, decimals = 0): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value || 0)
}

/**
 * Reparte `total` entre varias partes en proporción a `weights` (a partes iguales si no hay pesos),
 * en céntimos y por el método del mayor resto para que la suma sea exactamente `total`.
 */
export function distributeAmount(total: number, weights: number[]): number[] {
  if (weights.length === 0) return []
  const cents = Math.max(0, Math.round(total * 100))
  const weightSum = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0)
  const shares = weights.map((weight) => (weightSum > 0 ? Math.max(0, weight) / weightSum : 1 / weights.length))
  const base = shares.map((share) => Math.floor(cents * share))
  let remainder = cents - base.reduce((sum, value) => sum + value, 0)
  const order = shares
    .map((share, index) => ({ index, fraction: cents * share - base[index] }))
    .sort((a, b) => b.fraction - a.fraction)
  for (const item of order) {
    if (remainder <= 0) break
    base[item.index] += 1
    remainder -= 1
  }
  return base.map((value) => value / 100)
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = (sorted.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

export function computeStats(series: number[]): SeriesStats {
  if (series.length === 0) {
    return { total: 0, avg: 0, median: 0, p75: 0, max: 0, monthsWithSpend: 0 }
  }
  const total = series.reduce((sum, value) => sum + value, 0)
  return {
    total,
    avg: total / series.length,
    median: percentile(series, 0.5),
    p75: percentile(series, 0.75),
    max: Math.max(...series),
    monthsWithSpend: series.filter((value) => value > 0).length,
  }
}

// ==================== MESES (YYYY-MM) ====================

export function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const total = year * 12 + (monthNumber - 1) + delta
  const newYear = Math.floor(total / 12)
  const newMonth = (total % 12) + 1
  return `${newYear}-${String(newMonth).padStart(2, '0')}`
}

export function monthRange(from: string, to: string): string[] {
  if (!from || !to || from > to) return []
  const months: string[] = []
  let cursor = from
  // Tope de seguridad para evitar bucles con rangos absurdos
  while (cursor <= to && months.length < 600) {
    months.push(cursor)
    cursor = addMonths(cursor, 1)
  }
  return months
}

/** Últimos N meses completos (excluye el mes en curso). */
export function lastCompleteMonths(count: number): { from: string; to: string } {
  const to = addMonths(currentMonthKey(), -1)
  return { from: addMonths(to, -(count - 1)), to }
}

// ==================== CARGA DE DATOS ====================

const PAGE_SIZE = 500

function mapRow(row: any): CalcTransaction {
  return {
    id_transaction: row.id_transaction,
    dt_date: row.dt_date,
    ds_month_declared: row.ds_month_declared,
    ds_comments: row.ds_comments ?? null,
    id_category: row.id_category ?? null,
    ds_category: row.category?.ds_category ?? 'Sin categoría',
    id_subcategory: row.id_subcategory ?? null,
    ds_subcategory: row.subcategory?.ds_subcategory ?? 'Sin subcategoría',
    id_tag: row.tag?.id_tag ?? null,
    ds_tag: row.tag?.ds_tag ?? null,
    type: row.transactionType ?? null,
    id_budget_type: row.id_budget_type ?? null,
    ft_amount: row.ft_amount ?? 0,
    users: (row.users || []).map((user: any) => ({
      id_user: user.id_user,
      ds_user: user.ds_user ?? null,
      ft_amount_user: user.ft_amount_user ?? 0,
    })),
  }
}

/**
 * Carga TODAS las transacciones de la familia paginando la API de analítica
 * (la API corta en 1000 filas si no se pagina).
 */
export async function fetchCalculatorTransactions(
  idFamily: string
): Promise<CalcTransaction[]> {
  const all = new Map<string, CalcTransaction>()
  let offset = 0

  while (true) {
    const response = await fetch('/api/analytics/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idFamily, limit: PAGE_SIZE, offset }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Error al cargar transacciones')
    }

    const rows = (data.transactions || []) as any[]
    for (const row of rows) {
      all.set(row.id_transaction, mapRow(row))
    }

    if (rows.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return Array.from(all.values())
}

// ==================== CÁLCULOS ====================

/** Importe de una transacción para el alcance elegido (persona o familia). */
export function getScopedAmount(tx: CalcTransaction, idUser: string | null): number {
  if (!idUser) return tx.ft_amount
  return tx.users
    .filter((user) => user.id_user === idUser)
    .reduce((sum, user) => sum + (user.ft_amount_user || 0), 0)
}

/** Gastos (o ingresos) del periodo y alcance, con el importe que corresponde al alcance. */
export function buildPeriodRows(
  transactions: CalcTransaction[],
  from: string,
  to: string,
  idUser: string | null,
  type: 'Income' | 'Expense' = 'Expense'
): PeriodRow[] {
  const rows: PeriodRow[] = []
  for (const tx of transactions) {
    if (tx.type !== type) continue
    if (tx.ds_month_declared < from || tx.ds_month_declared > to) continue
    const amount = getScopedAmount(tx, idUser)
    if (!amount) continue
    rows.push({ tx, amount })
  }
  return rows
}

/** Clave de asignación: por subcategoría, o por categoría si no tiene subcategoría. */
export function groupKeyFor(tx: CalcTransaction): string {
  return tx.id_subcategory ? `sub:${tx.id_subcategory}` : `cat:${tx.id_category ?? 'none'}`
}

export function buildExpenseGroups(rows: PeriodRow[], months: string[]): ExpenseGroup[] {
  const monthIndex = new Map(months.map((month, index) => [month, index]))
  const groups = new Map<string, ExpenseGroup>()

  for (const { tx, amount } of rows) {
    const key = groupKeyFor(tx)
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        idCategory: tx.id_category,
        dsCategory: tx.ds_category,
        idSubcategory: tx.id_subcategory,
        dsSubcategory: tx.ds_subcategory,
        series: new Array(months.length).fill(0),
        stats: computeStats([]),
      }
      groups.set(key, group)
    }
    const index = monthIndex.get(tx.ds_month_declared)
    if (index !== undefined) group.series[index] += amount
  }

  const result = Array.from(groups.values())
  for (const group of result) {
    group.stats = computeStats(group.series)
  }
  return result.sort((a, b) => b.stats.total - a.stats.total)
}

export function sumSeries(seriesList: number[][], length: number): number[] {
  const result = new Array(length).fill(0)
  for (const series of seriesList) {
    for (let i = 0; i < length; i++) result[i] += series[i] || 0
  }
  return result
}

export type TypeStatsResult = {
  byType: Record<string, SeriesStats>
  unassigned: SeriesStats
}

/** Estadísticas mensuales por partida a partir de las asignaciones subcategoría → partida. */
export function buildTypeStats(
  groups: ExpenseGroup[],
  assignments: Record<string, string>,
  budgetTypes: BudgetType[],
  monthsCount: number
): TypeStatsResult {
  const byType: Record<string, SeriesStats> = {}
  for (const budgetType of budgetTypes) {
    const series = groups
      .filter((group) => assignments[group.key] === budgetType.id_budget_type)
      .map((group) => group.series)
    byType[budgetType.id_budget_type] = computeStats(sumSeries(series, monthsCount))
  }

  const validTypeIds = new Set(budgetTypes.map((item) => item.id_budget_type))
  const unassignedSeries = groups
    .filter((group) => !validTypeIds.has(assignments[group.key]))
    .map((group) => group.series)

  return {
    byType,
    unassigned: computeStats(sumSeries(unassignedSeries, monthsCount)),
  }
}

/**
 * Valor propuesto por la calculadora: mensual para partidas mensuales; para las anuales, el de todo el periodo
 * del presupuesto (`annualMonths` meses: 12 si no tiene fecha de fin).
 */
export function suggestedAmount(
  stats: SeriesStats | undefined,
  method: StatMethod,
  periodicity: string,
  annualMonths = 12
): number {
  if (!stats) return 0
  const monthly = stats[method]
  // Euros enteros: los presupuestos no necesitan céntimos
  return Math.round(periodicity === 'monthly' ? monthly : monthly * annualMonths)
}

export function buildBudgetComment(params: {
  method: StatMethod
  from: string
  to: string
  monthsCount: number
  stats: SeriesStats | undefined
  amount: number
  periodicity: string
  wasOverridden: boolean
  note?: string
}): string {
  const { method, from, to, monthsCount, stats, amount, periodicity, wasOverridden, note } = params
  const parts: string[] = []

  if (stats) {
    parts.push(
      `Histórico ${from} a ${to} (${monthsCount} meses): media ${formatMoney(stats.avg)}, ` +
        `mediana ${formatMoney(stats.median)}, P75 ${formatMoney(stats.p75)} al mes.`
    )
  }

  const unit = periodicity === 'monthly' ? 'al mes' : 'al año'
  parts.push(
    wasOverridden
      ? `Presupuesto de ${formatMoney(amount)} ${unit}: suma de subcategorías con ${METHOD_LABELS[method]} como base y ajustes manuales en alguna.`
      : `Presupuesto de ${formatMoney(amount)} ${unit}: suma de subcategorías calculada con ${METHOD_LABELS[method]}.`
  )

  if (note && note.trim()) parts.push(note.trim())
  return parts.join(' ')
}
