import type { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  currentMonthKey,
  getScopedAmount,
  monthRange,
  round2,
  type CalcTransaction,
} from '@/lib/budget-calculator'

export type SpendingGoal = Database['public']['Tables']['pml_cfg_spending_goal']['Row']

export type SpendingGoalParams = {
  idFamily: string
  idUser: string
  idCategory: string | null
  idSubcategory: string | null
  periodicity: 'monthly' | 'annual'
  amount: number
  startMonth: string // YYYY-MM
  endMonth: string // YYYY-MM
  comments?: string | null
}

const monthToDate = (month: string) => `${month}-01`
export const dateToMonth = (date: string) => date.slice(0, 7)

export async function getSpendingGoals(
  supabase: SupabaseClient<Database>,
  params: { idFamily: string; idUser?: string }
): Promise<SpendingGoal[]> {
  let query = supabase
    .from('pml_cfg_spending_goal')
    .select('*')
    .eq('id_family', params.idFamily)
    .eq('is_active', true)

  if (params.idUser) query = query.eq('id_user', params.idUser)

  const { data, error } = await query.order('dt_start_month', { ascending: false })
  if (error) {
    console.error('Error al obtener objetivos de gasto:', error)
    throw error
  }
  return data || []
}

function toRow(params: SpendingGoalParams) {
  return {
    id_family: params.idFamily,
    id_user: params.idUser,
    id_category: params.idSubcategory ? null : params.idCategory,
    id_subcategory: params.idSubcategory,
    ds_periodicity: params.periodicity,
    ft_goal_amount: round2(params.amount),
    dt_start_month: monthToDate(params.startMonth),
    dt_end_month: monthToDate(params.endMonth),
    ds_comments: params.comments?.trim() || null,
  }
}

export async function createSpendingGoal(
  supabase: SupabaseClient<Database>,
  params: SpendingGoalParams
): Promise<void> {
  const { error } = await supabase.from('pml_cfg_spending_goal').insert(toRow(params))
  if (error) {
    console.error('Error al crear objetivo de gasto:', error)
    throw error
  }
}

export async function updateSpendingGoal(
  supabase: SupabaseClient<Database>,
  idSpendingGoal: string,
  params: SpendingGoalParams
): Promise<void> {
  const { error } = await supabase
    .from('pml_cfg_spending_goal')
    .update({ ...toRow(params), dt_updated: new Date().toISOString() })
    .eq('id_spending_goal', idSpendingGoal)
  if (error) {
    console.error('Error al actualizar objetivo de gasto:', error)
    throw error
  }
}

/** Baja lógica: el objetivo deja de mostrarse pero se conserva en base de datos. */
export async function deleteSpendingGoal(
  supabase: SupabaseClient<Database>,
  idSpendingGoal: string
): Promise<void> {
  const { error } = await supabase
    .from('pml_cfg_spending_goal')
    .update({ is_active: false, dt_updated: new Date().toISOString() })
    .eq('id_spending_goal', idSpendingGoal)
  if (error) {
    console.error('Error al eliminar objetivo de gasto:', error)
    throw error
  }
}

// ==================== SEGUIMIENTO ====================

export type GoalStatus = 'ok' | 'warning' | 'over'

export type GoalProgress = {
  totalMonths: number
  elapsedMonths: number
  isUpcoming: boolean
  isFinished: boolean
  /** Objetivo para todo el periodo */
  target: number
  /** Lo que "tocaría" llevar gastado a estas alturas del periodo */
  expectedToDate: number
  spent: number
  remaining: number
  /**
   * Proyección del gasto al cierre del periodo al ritmo actual (gastado / meses transcurridos × meses totales).
   * null si el periodo aún no ha empezado. En periodos cerrados es el gasto real.
   */
  projected: number | null
  projectedDelta: number | null // proyectado − objetivo (positivo = te pasas)
  projectedDeltaPct: number | null
  status: GoalStatus
  /** Solo objetivos mensuales cuyo periodo incluye el mes actual */
  currentMonth: { spent: number; target: number } | null
  monthlySpent: Array<{ month: string; spent: number }>
}

export function calculateGoalProgress(
  goal: SpendingGoal,
  transactions: CalcTransaction[],
  idUser: string,
  nowMonth: string = currentMonthKey()
): GoalProgress {
  const startMonth = dateToMonth(goal.dt_start_month)
  const endMonth = dateToMonth(goal.dt_end_month)
  const months = monthRange(startMonth, endMonth)
  const totalMonths = Math.max(1, months.length)
  const monthly = goal.ds_periodicity === 'monthly'

  const spentByMonth = new Map<string, number>(months.map((month) => [month, 0]))
  for (const tx of transactions) {
    if (tx.type !== 'Expense') continue
    if (!spentByMonth.has(tx.ds_month_declared)) continue
    const matches = goal.id_subcategory
      ? tx.id_subcategory === goal.id_subcategory
      : tx.id_category === goal.id_category
    if (!matches) continue
    const amount = getScopedAmount(tx, idUser)
    if (!amount) continue
    spentByMonth.set(tx.ds_month_declared, (spentByMonth.get(tx.ds_month_declared) || 0) + amount)
  }

  const monthlySpent = months.map((month) => ({ month, spent: spentByMonth.get(month) || 0 }))
  const spent = monthlySpent.reduce((sum, item) => sum + item.spent, 0)
  const target = monthly ? goal.ft_goal_amount * totalMonths : goal.ft_goal_amount

  const isUpcoming = nowMonth < startMonth
  const isFinished = nowMonth > endMonth
  const elapsedMonths = isUpcoming ? 0 : isFinished ? totalMonths : months.filter((m) => m <= nowMonth).length
  const expectedToDate = (target * elapsedMonths) / totalMonths

  const projected = isUpcoming
    ? null
    : isFinished
      ? spent
      : elapsedMonths > 0
        ? (spent / elapsedMonths) * totalMonths
        : null
  const projectedDelta = projected === null ? null : projected - target
  const projectedDeltaPct = projectedDelta === null || target <= 0 ? null : (projectedDelta / target) * 100

  const status: GoalStatus = spent > target ? 'over' : spent > expectedToDate ? 'warning' : 'ok'

  const inPeriod = !isUpcoming && !isFinished
  const currentMonth =
    monthly && inPeriod
      ? { spent: spentByMonth.get(nowMonth) || 0, target: goal.ft_goal_amount }
      : null

  return {
    totalMonths,
    elapsedMonths,
    isUpcoming,
    isFinished,
    target,
    expectedToDate,
    spent,
    remaining: target - spent,
    projected,
    projectedDelta,
    projectedDeltaPct,
    status,
    currentMonth,
    monthlySpent,
  }
}
