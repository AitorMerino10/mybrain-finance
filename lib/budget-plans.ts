import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/supabase'

export type PlanIncomeItem = { id: string; name: string; amount: string; months: string }

/** Todo lo que el usuario dejó configurado en la calculadora al guardar. */
export type BudgetPlanSnapshot = {
  version: 1
  period: { from: string; to: string }
  method: string
  planMonths: string
  recurring: PlanIncomeItem[]
  annualIncomes: PlanIncomeItem[]
  bonuses: PlanIncomeItem[]
  /** subcategoría/categoría → partida usada en el cálculo */
  assignments: Record<string, string>
  /** Importe fijado a mano por subcategoría */
  groupOverrides: Record<string, string>
  /** Total fijado por vertical y partida (`idCategoria|idPartida`) */
  categoryOverrides?: Record<string, string>
  /** Importe puesto directamente a una partida (sin relacionarlo con ninguna vertical), en la unidad de la partida */
  directAmounts?: Record<string, string>
  /** Importe de cada subpartida (clave = id de la subpartida), en la unidad de su partida */
  subAmounts?: Record<string, string>
  savingsMode: string
  savingsValue: string
  /** Importes finales retocados a mano por partida (solo los que difieren del calculado) */
  manualAmounts?: Record<string, string>
  /** @deprecated versión antigua: guardaba todos los importes, no solo los retocados. Se ignora */
  amountOverrides?: Record<string, string>
  /** Fecha límite (último mes vigente, inclusive) o '' */
  endMonth: string
}

export type BudgetPlan = {
  id_budget_plan: string
  id_user: string
  /** YYYY-MM-01 */
  dt_start_month: string
  plan: BudgetPlanSnapshot
}

/** Planes guardados de la familia. Si la tabla aún no existe devuelve `available: false`. */
export async function getBudgetPlans(
  supabase: SupabaseClient<Database>,
  idFamily: string
): Promise<{ plans: BudgetPlan[]; available: boolean }> {
  const { data, error } = await supabase.from('pml_cfg_budget_plan').select('*').eq('id_family', idFamily)
  if (error) {
    console.warn('Planes de presupuesto no disponibles:', error.message)
    return { plans: [], available: false }
  }
  const plans = (data || [])
    .filter((row) => row.js_plan && typeof row.js_plan === 'object' && (row.js_plan as { version?: number }).version === 1)
    .map((row) => ({
      id_budget_plan: row.id_budget_plan,
      id_user: row.id_user,
      dt_start_month: row.dt_start_month,
      plan: row.js_plan as unknown as BudgetPlanSnapshot,
    }))
  return { plans, available: true }
}

/** Guarda (o reemplaza) el plan de una persona para un mes de inicio. */
export async function saveBudgetPlan(
  supabase: SupabaseClient<Database>,
  params: { idFamily: string; idUser: string; startMonth: string; plan: BudgetPlanSnapshot }
): Promise<void> {
  const { error } = await supabase.from('pml_cfg_budget_plan').upsert(
    {
      id_family: params.idFamily,
      id_user: params.idUser,
      dt_start_month: params.startMonth,
      js_plan: params.plan as unknown as Json,
      dt_updated: new Date().toISOString(),
    },
    { onConflict: 'id_family,id_user,dt_start_month' }
  )
  if (error) {
    console.error('Error al guardar el plan de presupuesto:', error)
    throw error
  }
}

/** Plan vigente en un mes: el más reciente que empiece en ese mes o antes. */
export function planInForce(plans: BudgetPlan[], idUser: string, month: string): BudgetPlan | null {
  return (
    plans
      .filter((item) => item.id_user === idUser && item.dt_start_month.slice(0, 7) <= month)
      .sort((a, b) => b.dt_start_month.localeCompare(a.dt_start_month))[0] || null
  )
}

/** Meses que cubre el plan (por defecto 12). */
export function planMonthsOf(plan: BudgetPlanSnapshot): number {
  const months = Number(plan.planMonths)
  return Number.isFinite(months) && months > 0 ? months : 12
}

/** Ingreso mensual medio estimado en el plan (misma cuenta que hace la calculadora). */
export function planIncomeMonthly(plan: BudgetPlanSnapshot): number {
  const months = planMonthsOf(plan)
  const num = (value: string) => {
    const parsed = Number(String(value).replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
  }
  const monthsOf = (item: PlanIncomeItem) => (item.months !== '' ? num(item.months) : months)
  const recurring = plan.recurring.reduce((sum, item) => sum + num(item.amount) * monthsOf(item), 0)
  const annual = plan.annualIncomes.reduce((sum, item) => sum + num(item.amount) * (months / 12), 0)
  const bonuses = plan.bonuses.reduce((sum, item) => sum + num(item.amount) * monthsOf(item), 0)
  return (recurring + annual + bonuses) / months
}
