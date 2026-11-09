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

export type RecurringInput = Omit<Database['public']['Tables']['pml_cfg_recurring_expense']['Insert'], 'id_recurring_expense' | 'dt_created' | 'dt_last_generated'>

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

/**
 * Busca gastos que se repiten con el mismo nombre (comentario), un importe parecido y un ritmo regular.
 * Ignora los que ya vienen de una regla y los que ya tienen una regla con el mismo nombre.
 */
export function detectRecurringCandidates(
  transactions: CalcTransaction[],
  existingNames: string[],
  today: string
): RecurringCandidate[] {
  const existing = new Set(existingNames.map((name) => normalizeName(name)).filter(Boolean))
  const since = addDaysTo(today, -430)
  const groups = new Map<string, CalcTransaction[]>()

  for (const tx of transactions) {
    if (tx.type !== 'Expense' || tx.id_recurring_expense) continue
    if (tx.dt_date < since || tx.ft_amount <= 0) continue
    const key = normalizeName(tx.ds_comments)
    if (key.length < 3 || existing.has(key)) continue
    const list = groups.get(key) || []
    list.push(tx)
    groups.set(key, list)
  }

  const candidates: RecurringCandidate[] = []
  groups.forEach((list, key) => {
    const sorted = [...list].sort((a, b) => a.dt_date.localeCompare(b.dt_date))
    if (sorted.length < 2) return

    // Importe parecido: la mayoría dentro de ±20 % de la mediana
    const typical = median(sorted.map((tx) => tx.ft_amount))
    const similar = sorted.filter((tx) => Math.abs(tx.ft_amount - typical) <= typical * 0.2)
    if (similar.length < 2 || similar.length / sorted.length < 0.7) return

    const gaps: number[] = []
    for (let i = 1; i < similar.length; i += 1) gaps.push(daysBetweenDates(similar[i - 1].dt_date, similar[i].dt_date))
    const typicalGap = median(gaps)

    let everyMonths = 0
    if (similar.length >= 3 && typicalGap >= 26 && typicalGap <= 35) everyMonths = 1
    else if (similar.length >= 3 && typicalGap >= 55 && typicalGap <= 66) everyMonths = 2
    else if (similar.length >= 3 && typicalGap >= 84 && typicalGap <= 97) everyMonths = 3
    else if (similar.length >= 2 && typicalGap >= 350 && typicalGap <= 380) everyMonths = 12
    if (!everyMonths) return

    // Que el ritmo sea regular: casi todos los intervalos, cerca del típico
    const regular = gaps.filter((gap) => Math.abs(gap - typicalGap) <= Math.max(5, typicalGap * 0.2)).length
    if (regular / gaps.length < 0.75) return

    const last = similar[similar.length - 1]
    // Si el último cobro es muy antiguo, la suscripción probablemente ya no existe
    if (daysBetweenDates(last.dt_date, today) > typicalGap * 1.6) return

    const names = new Map<string, number>()
    similar.forEach((tx) => names.set((tx.ds_comments || '').trim(), (names.get((tx.ds_comments || '').trim()) || 0) + 1))
    const name = Array.from(names.entries()).sort((a, b) => b[1] - a[1])[0][0]

    candidates.push({
      key,
      name,
      amount: Math.round(last.ft_amount * 100) / 100,
      everyMonths,
      dayOfMonth: Number(last.dt_date.slice(8, 10)),
      lastDate: last.dt_date,
      nextDate: nextOccurrenceAfter(
        { dt_start: last.dt_date, nu_day_of_month: Number(last.dt_date.slice(8, 10)), nu_every_months: everyMonths },
        today > last.dt_date ? addDaysTo(today, -1) : last.dt_date
      ),
      occurrences: similar.length,
      idCategory: last.id_category,
      idSubcategory: last.id_subcategory,
      idBudgetType: last.id_budget_type,
      userIds: last.users.map((user) => user.id_user),
    })
  })

  return candidates.sort((a, b) => monthlyEquivalent(b.amount, b.everyMonths) - monthlyEquivalent(a.amount, a.everyMonths))
}
