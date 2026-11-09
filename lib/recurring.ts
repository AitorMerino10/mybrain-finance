import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { CalcTransaction } from '@/lib/budget-calculator'

export type RecurringExpense = Database['public']['Tables']['pml_cfg_recurring_expense']['Row']
type Schedule = Pick<RecurringExpense, 'dt_start' | 'nu_day_of_month' | 'nu_every_months'>

/** Opciones de "cada cuántos meses" que se ofrecen al configurar */
export const EVERY_MONTHS_OPTIONS = [1, 2, 3, 4, 6, 12]

export function describeSchedule(rule: Pick<RecurringExpense, 'nu_day_of_month' | 'nu_every_months'>): string {
  const day = `el día ${rule.nu_day_of_month}`
  if (rule.nu_every_months === 1) return `${day} de cada mes`
  if (rule.nu_every_months === 12) return `${day}, una vez al año`
  return `${day}, cada ${rule.nu_every_months} meses`
}

// ---------------- fechas (YYYY-MM-DD, en UTC para evitar saltos de hora) ----------------

function parseDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

export function addDaysTo(value: string, days: number): string {
  const date = parseDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return formatDate(date)
}

export function daysBetweenDates(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000)
}

/** Fecha de un día concreto de un mes (YYYY-MM); si el mes no tiene ese día (31 en febrero), el último. */
export function dateInMonth(month: string, day: number): string {
  const [year, m] = month.split('-').map(Number)
  return formatDate(new Date(Date.UTC(year, m - 1, Math.min(day, daysInMonth(year, m - 1)))))
}

/** Fecha del cobro número `n` (0 = el primero) de una regla. */
export function occurrenceDate(rule: Schedule, n: number): string {
  const first = parseDate(rule.dt_start)
  const totalMonths = first.getUTCFullYear() * 12 + first.getUTCMonth() + rule.nu_every_months * n
  const year = Math.floor(totalMonths / 12)
  const monthIndex = totalMonths % 12
  return formatDate(new Date(Date.UTC(year, monthIndex, Math.min(rule.nu_day_of_month, daysInMonth(year, monthIndex)))))
}

/** Primer cobro de la regla que cae en `date` o después. */
export function firstOccurrenceOnOrAfter(rule: Schedule, date: string): string {
  for (let n = 0; n < 2000; n += 1) {
    const candidate = occurrenceDate(rule, n)
    if (candidate >= date) return candidate
  }
  return date
}

/** Siguiente cobro de la regla estrictamente posterior a `date`. */
export function nextOccurrenceAfter(rule: Schedule, date: string): string {
  return firstOccurrenceOnOrAfter(rule, addDaysTo(date, 1))
}

/** Primer cobro de una regla recién configurada: el día elegido del mes de partida (`startMonth`, YYYY-MM). */
export function startDateFor(startMonth: string, day: number): string {
  return dateInMonth(startMonth, day)
}

/** Cobros pendientes de una regla (desde su próximo cobro) hasta `to`, ambos incluidos. */
export function upcomingOccurrences(
  rule: Schedule & Pick<RecurringExpense, 'dt_next' | 'dt_end' | 'is_active'>,
  to: string,
  limit = 60
): string[] {
  if (!rule.is_active) return []
  const result: string[] = []
  let current = rule.dt_next
  while (current <= to && result.length < limit) {
    if (rule.dt_end && current > rule.dt_end) break
    result.push(current)
    current = nextOccurrenceAfter(rule, current)
  }
  return result
}

/** Equivalente mensual de una regla (cuánto pesa cada gasto al mes). */
export function monthlyEquivalent(amount: number, everyMonths: number): number {
  return amount / Math.max(1, everyMonths)
}

// ---------------- acceso a datos ----------------

export async function getRecurringExpenses(supabase: SupabaseClient<Database>, idFamily: string): Promise<RecurringExpense[]> {
  const { data, error } = await supabase
    .from('pml_cfg_recurring_expense')
    .select('*')
    .eq('id_family', idFamily)
    .order('dt_next', { ascending: true })
  if (error) {
    // Si aún no se ha ejecutado la migración, simplemente no hay recurrentes
    console.warn('No se pudieron cargar los gastos recurrentes:', error.message)
    return []
  }
  return data || []
}

export type RecurringInput = Omit<Database['public']['Tables']['pml_cfg_recurring_expense']['Insert'], 'dt_created' | 'dt_last_generated'>

export async function createRecurringExpense(supabase: SupabaseClient<Database>, input: RecurringInput): Promise<void> {
  const { error } = await supabase.from('pml_cfg_recurring_expense').insert(input)
  if (error) throw error
}

export async function updateRecurringExpense(
  supabase: SupabaseClient<Database>,
  idRecurring: string,
  patch: Database['public']['Tables']['pml_cfg_recurring_expense']['Update']
): Promise<void> {
  const { error } = await supabase.from('pml_cfg_recurring_expense').update(patch).eq('id_recurring_expense', idRecurring)
  if (error) throw error
}

export async function deleteRecurringExpense(supabase: SupabaseClient<Database>, idRecurring: string): Promise<void> {
  const { error } = await supabase.from('pml_cfg_recurring_expense').delete().eq('id_recurring_expense', idRecurring)
  if (error) throw error
}

// ---------------- detección de suscripciones en el histórico ----------------

export type RecurringCandidate = {
  key: string
  name: string
  amount: number
  /** Cada cuántos meses se repite */
  everyMonths: number
  /** Día del mes en que suele cobrarse */
  dayOfMonth: number
  lastDate: string
  nextDate: string
  occurrences: number
  idCategory: string | null
  idSubcategory: string | null
  idBudgetType: string | null
  userIds: string[]
  /** Por qué se sugiere (para mostrarlo) */
  reason: string
  /** El importe cambia de un cobro a otro (se propone la media de los últimos) */
  variable: boolean
}

export function normalizeName(value: string | null | undefined): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[0-9]+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
}

function monthIndexOf(date: string): number {
  const [year, month] = date.slice(0, 7).split('-').map(Number)
  return year * 12 + (month - 1)
}

/** Palabras que no identifican un comercio ("pago", "compra"…) */
const GENERIC_WORDS = new Set([
  'pago', 'pagos', 'compra', 'compras', 'tarjeta', 'recibo', 'recibos', 'cuota', 'mes', 'mensual', 'anual', 'bizum', 'transferencia',
  'gasto', 'gastos', 'factura', 'facturas', 'cargo', 'cobro', 'del', 'las', 'los', 'una', 'uno', 'con', 'por', 'para', 'the', 'and', 'com',
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
])

/** Clave del comercio de un comentario: su primera palabra significativa ("Netflix nov", "NETFLIX.COM" → "netflix"). */
function merchantKey(comment: string | null | undefined): string {
  const tokens = normalizeName(comment)
    .split(' ')
    .filter((token) => token.length >= 3 && !GENERIC_WORDS.has(token))
  return tokens[0] || ''
}

type Detected = {
  everyMonths: number
  dayOfMonth: number
  last: CalcTransaction
  amount: number
  variable: boolean
  occurrences: number
}

/**
 * Analiza una serie de gastos de un mismo comercio / subcategoría y decide si es recurrente.
 * Se fija en los MESES en que ocurre (no en los días exactos), así que no importa si cada vez se apunta otro día.
 */
function analyzeSeries(items: CalcTransaction[], today: string, tolerance: 'fixed' | 'variable'): Detected | null {
  if (items.length < 2) return null
  const tol = tolerance === 'fixed' ? 0.15 : 0.5

  // Nos quedamos con el grupo de importes parecidos más numeroso (el resto son gastos sueltos del mismo sitio)
  let cluster: CalcTransaction[] = []
  if (tolerance === 'fixed') {
    for (const anchor of items) {
      const close = items.filter((tx) => Math.abs(tx.ft_amount - anchor.ft_amount) <= anchor.ft_amount * tol)
      if (close.length > cluster.length || (close.length === cluster.length && close.length > 0 && anchor.dt_date > cluster[cluster.length - 1].dt_date)) {
        cluster = close
      }
    }
  } else {
    const typical = median(items.map((tx) => tx.ft_amount))
    cluster = items.filter((tx) => Math.abs(tx.ft_amount - typical) <= typical * tol)
  }

  // Un cobro por mes: si en un mismo mes hay muchos, es un gasto frecuente (supermercado, café…), no un cobro fijo
  const byMonth = new Map<number, CalcTransaction[]>()
  cluster.forEach((tx) => byMonth.set(monthIndexOf(tx.dt_date), [...(byMonth.get(monthIndexOf(tx.dt_date)) || []), tx]))
  const months = Array.from(byMonth.keys()).sort((a, b) => a - b)
  if (months.length < 2) return null
  if (cluster.length / months.length > 1.5) return null

  const gaps: number[] = []
  for (let i = 1; i < months.length; i += 1) gaps.push(months[i] - months[i - 1])
  const typicalGap = median(gaps)
  if (!EVERY_MONTHS_OPTIONS.includes(typicalGap)) return null

  const regular = gaps.filter((gap) => gap === typicalGap || (typicalGap === 1 && gap === 2)).length
  if (regular / gaps.length < 0.75) return null

  // Mínimo de apariciones: más exigente cuanto más frecuente (y con importe variable)
  const minOccurrences = tolerance === 'variable' ? 4 : typicalGap >= 6 ? 2 : 3
  if (months.length < minOccurrences) return null

  // Si hace tiempo que no se repite, ya no existe
  const nowIndex = monthIndexOf(today)
  const lastIndex = months[months.length - 1]
  if (nowIndex - lastIndex > typicalGap + (typicalGap === 1 ? 1 : 0)) return null

  const lastList = (byMonth.get(lastIndex) || []).sort((a, b) => a.dt_date.localeCompare(b.dt_date))
  const last = lastList[lastList.length - 1]
  const recent = months.slice(-3).map((index) => (byMonth.get(index) || [])[0].ft_amount)
  const days = months.map((index) => Number((byMonth.get(index) || [])[0].dt_date.slice(8, 10)))

  return {
    everyMonths: typicalGap,
    dayOfMonth: Math.round(median(days)),
    last,
    amount: Math.round((tolerance === 'variable' ? mean(recent) : median(recent)) * 100) / 100,
    variable: tolerance === 'variable',
    occurrences: months.length,
  }
}

export type ExistingRule = Pick<RecurringExpense, 'ds_name' | 'id_category' | 'id_subcategory' | 'ft_amount'>

/**
 * Busca gastos que se repiten, con dos pistas:
 *  1. el mismo comercio en el comentario (aunque cambie un poco: "Netflix", "Netflix nov"),
 *  2. la misma subcategoría (o categoría, si no tiene subcategoría) cada mes / cada pocos meses.
 * Funciona con importes fijos y con importes que varían (luz, agua…). Ignora lo que ya tiene regla.
 */
export function detectRecurringCandidates(transactions: CalcTransaction[], existing: ExistingRule[], today: string): RecurringCandidate[] {
  const existingNames = new Set(existing.map((rule) => normalizeName(rule.ds_name)).filter(Boolean))
  const existingMerchants = new Set(existing.map((rule) => merchantKey(rule.ds_name)).filter(Boolean))
  const since = addDaysTo(today, -640)

  const expenses = transactions.filter((tx) => tx.type === 'Expense' && !tx.id_recurring_expense && tx.dt_date >= since && tx.ft_amount > 0)

  const covered = (candidateAmount: number, idCategory: string | null, idSubcategory: string | null, name: string) => {
    if (existingNames.has(normalizeName(name))) return true
    const merchant = merchantKey(name)
    if (merchant && existingMerchants.has(merchant)) return true
    return existing.some((rule) => {
      const sameWhere = idSubcategory ? rule.id_subcategory === idSubcategory : idCategory ? rule.id_category === idCategory && !rule.id_subcategory : false
      return sameWhere && Math.abs(Number(rule.ft_amount) - candidateAmount) <= Number(rule.ft_amount) * 0.25
    })
  }

  const build = (key: string, name: string, detected: Detected, reason: string): RecurringCandidate => {
    const { last } = detected
    const rule = {
      dt_start: dateInMonth(last.dt_date.slice(0, 7), detected.dayOfMonth),
      nu_day_of_month: detected.dayOfMonth,
      nu_every_months: detected.everyMonths,
    }
    return {
      key,
      name,
      amount: detected.amount,
      everyMonths: detected.everyMonths,
      dayOfMonth: detected.dayOfMonth,
      lastDate: last.dt_date,
      nextDate: nextOccurrenceAfter(rule, addDaysTo(today, -1)),
      occurrences: detected.occurrences,
      idCategory: last.id_category,
      idSubcategory: last.id_subcategory,
      idBudgetType: last.id_budget_type,
      userIds: last.users.map((user) => user.id_user),
      reason,
      variable: detected.variable,
    }
  }

  const candidates: RecurringCandidate[] = []

  // 1) Mismo comercio en el comentario
  const byMerchant = new Map<string, CalcTransaction[]>()
  for (const tx of expenses) {
    const key = merchantKey(tx.ds_comments)
    if (!key) continue
    byMerchant.set(key, [...(byMerchant.get(key) || []), tx])
  }
  byMerchant.forEach((list, key) => {
    const detected = analyzeSeries(list, today, 'fixed') || analyzeSeries(list, today, 'variable')
    if (!detected) return
    const names = new Map<string, number>()
    list.forEach((tx) => names.set((tx.ds_comments || '').trim(), (names.get((tx.ds_comments || '').trim()) || 0) + 1))
    const name = Array.from(names.entries()).sort((a, b) => b[1] - a[1])[0][0]
    if (covered(detected.amount, detected.last.id_category, detected.last.id_subcategory, name)) return
    candidates.push(build(`m:${key}`, name, detected, 'Mismo comentario cada vez'))
  })

  // 2) Misma subcategoría (o categoría) que se repite
  const bySubcategory = new Map<string, CalcTransaction[]>()
  for (const tx of expenses) {
    const key = tx.id_subcategory ? `s:${tx.id_subcategory}` : tx.id_category ? `c:${tx.id_category}` : ''
    if (!key) continue
    bySubcategory.set(key, [...(bySubcategory.get(key) || []), tx])
  }
  bySubcategory.forEach((list, key) => {
    const detected = analyzeSeries(list, today, 'fixed') || analyzeSeries(list, today, 'variable')
    if (!detected) return
    const label = detected.last.ds_subcategory && detected.last.id_subcategory ? detected.last.ds_subcategory : detected.last.ds_category
    const name = detected.last.ds_comments?.trim() && list.filter((tx) => tx.ds_comments?.trim() === detected.last.ds_comments?.trim()).length >= 2 ? (detected.last.ds_comments as string).trim() : label
    if (covered(detected.amount, detected.last.id_category, detected.last.id_subcategory, name)) return
    // Si ya se ha sugerido por comentario lo mismo (misma subcategoría, ritmo e importe parecido), no se repite
    const duplicate = candidates.some(
      (candidate) =>
        candidate.idSubcategory === detected.last.id_subcategory &&
        candidate.idCategory === detected.last.id_category &&
        candidate.everyMonths === detected.everyMonths &&
        Math.abs(candidate.amount - detected.amount) <= candidate.amount * 0.2
    )
    if (duplicate) return
    candidates.push(
      build(key, name, detected, detected.last.id_subcategory ? 'Misma subcategoría' : 'Misma categoría')
    )
  })

  return candidates.sort((a, b) => monthlyEquivalent(b.amount, b.everyMonths) - monthlyEquivalent(a.amount, a.everyMonths))
}
