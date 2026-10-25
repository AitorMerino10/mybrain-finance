import type { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { budgetMonthlyAmount, type BudgetSubtype, type BudgetType, type CurrentUserBudget } from '@/lib/budgets'
import { planInForce, type BudgetPlan } from '@/lib/budget-plans'
import { parseNumber, round2 } from '@/lib/budget-calculator'

/** Línea de reparto de un ingreso: cuánto va a una partida (y, opcionalmente, a una de sus subpartidas). */
export type AllocationRow = {
  key: string
  id_budget_type: string
  id_budget_subtype: string | null
  /** Texto del input */
  amount: string
}

/** Valor de `id_budget_type` en una línea que va explícitamente a ahorro (en BD es NULL). */
export const SAVINGS_ID = 'savings'

export const parseAllocationAmount = (value: string): number => parseNumber(value)

export const newAllocationKey = () => Math.random().toString(36).slice(2, 10)

/**
 * Reparto por defecto de un ingreso: a cada partida su parte mensual según el presupuesto vigente en ese mes.
 * Si el ingreso no llega para todas, se reparte en proporción. Lo que sobra es ahorro (no es una fila).
 * Con varias personas, el ingreso se divide a partes iguales y se aplica el presupuesto de cada una.
 */
export function computeDefaultIncomeAllocation(params: {
  amount: number
  userIds: string[]
  /** YYYY-MM */
  month: string
  versions: CurrentUserBudget[]
  budgetTypes: BudgetType[]
  /** Planes guardados y subpartidas: permiten desglosar cada partida entre sus subpartidas */
  plans?: BudgetPlan[]
  subtypes?: BudgetSubtype[]
}): AllocationRow[] {
  const { amount, userIds, month, versions, budgetTypes, plans = [], subtypes = [] } = params
  if (amount <= 0 || userIds.length === 0) return []

  const byType = new Map<string, number>()
  const bySub = new Map<string, number>()
  const share = amount / userIds.length

  for (const idUser of userIds) {
    const inForce = new Map<string, CurrentUserBudget>()
    versions
      .filter(
        (version) =>
          version.id_user === idUser &&
          version.is_active &&
          version.dt_start_month.slice(0, 7) <= month &&
          (!version.dt_end_month || version.dt_end_month.slice(0, 7) > month)
      )
      .sort((a, b) => a.dt_start_month.localeCompare(b.dt_start_month))
      .forEach((version) => inForce.set(version.id_budget_type, version))

    const monthly = new Map<string, number>()
    inForce.forEach((version, idBudgetType) => {
      const type = budgetTypes.find((item) => item.id_budget_type === idBudgetType)
      if (!type) return
      monthly.set(idBudgetType, budgetMonthlyAmount(version, type.ds_periodicity))
    })
    const total = Array.from(monthly.values()).reduce((sum, value) => sum + value, 0)
    if (total <= 0) continue
    const scale = Math.min(1, share / total)
    const plan = planInForce(plans, idUser, month)
    monthly.forEach((value, idBudgetType) => {
      const scaled = value * scale
      byType.set(idBudgetType, (byType.get(idBudgetType) || 0) + scaled)

      // Subpartidas: sus importes están en la unidad de la partida; se pasan a mensual en la misma proporción
      const version = inForce.get(idBudgetType)
      if (!plan || !version || version.ft_budget_amount <= 0) return
      const factor = (value / version.ft_budget_amount) * scale
      const subs = subtypes
        .filter((sub) => sub.id_budget_type === idBudgetType)
        .map((sub) => ({
          id: sub.id_budget_subtype,
          monthly: (Number(plan.plan.subAmounts?.[sub.id_budget_subtype]) || 0) * factor,
        }))
        .filter((item) => item.monthly > 0)
      const subTotal = subs.reduce((sum, item) => sum + item.monthly, 0)
      const cap = subTotal > scaled && subTotal > 0 ? scaled / subTotal : 1
      subs.forEach((item) => bySub.set(item.id, (bySub.get(item.id) || 0) + item.monthly * cap))
    })
  }

  // Por partida: una línea por subpartida con importe y, si queda algo, una línea de la partida "a secas"
  const rows: AllocationRow[] = []
  for (const type of budgetTypes) {
    const typeTotal = byType.get(type.id_budget_type) || 0
    if (typeTotal < 0.005) continue
    let assigned = 0
    subtypes
      .filter((sub) => sub.id_budget_type === type.id_budget_type)
      .forEach((sub) => {
        const value = round2(bySub.get(sub.id_budget_subtype) || 0)
        if (value < 0.005) return
        assigned += value
        rows.push({
          key: `default-${sub.id_budget_subtype}`,
          id_budget_type: type.id_budget_type,
          id_budget_subtype: sub.id_budget_subtype,
          amount: String(value),
        })
      })
    const rest = round2(typeTotal - assigned)
    if (rest >= 0.005) {
      rows.push({
        key: `default-${type.id_budget_type}`,
        id_budget_type: type.id_budget_type,
        id_budget_subtype: null,
        amount: String(rest),
      })
    }
  }
  return rows
}

/** Suma de las líneas y lo que queda sin repartir (ahorro). */
export function summarizeAllocation(rows: AllocationRow[], amount: number) {
  const assigned = round2(rows.reduce((sum, row) => sum + parseNumber(row.amount), 0))
  const explicitSavings = round2(
    rows.filter((row) => row.id_budget_type === SAVINGS_ID).reduce((sum, row) => sum + parseNumber(row.amount), 0)
  )
  const remainder = round2(amount - assigned)
  return {
    assigned,
    remainder,
    over: assigned > amount + 0.009,
    /** A partidas (sin contar lo que va a ahorro) */
    toBudgets: round2(assigned - explicitSavings),
    /** Ahorro total: líneas marcadas como ahorro + lo que no se ha repartido */
    savings: round2(Math.max(0, remainder) + explicitSavings),
  }
}

export async function getIncomeAllocations(
  supabase: SupabaseClient<Database>,
  idTransaction: string
): Promise<AllocationRow[] | null> {
  const { data, error } = await supabase
    .from('gnp_fct_income_allocation')
    .select('*')
    .eq('id_transaction', idTransaction)
  if (error) {
    // Tabla sin crear (migración pendiente): se trabaja con el reparto por defecto
    console.warn('Repartos de ingresos no disponibles:', error.message)
    return null
  }
  if (!data || data.length === 0) return null
  return data.map((row) => ({
    key: row.id_income_allocation,
    id_budget_type: row.id_budget_type ?? SAVINGS_ID,
    id_budget_subtype: row.id_budget_subtype,
    amount: String(row.ft_amount),
  }))
}

/** Sustituye el reparto guardado de un ingreso. `rows = null` borra el guardado (vuelve al reparto por defecto). */
export async function replaceIncomeAllocations(
  supabase: SupabaseClient<Database>,
  params: { idFamily: string; idTransaction: string; rows: AllocationRow[] | null }
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('gnp_fct_income_allocation')
    .delete()
    .eq('id_transaction', params.idTransaction)
  if (deleteError) throw deleteError

  const rows = (params.rows || []).filter((row) => parseNumber(row.amount) > 0)
  if (rows.length === 0) return

  const { error } = await supabase.from('gnp_fct_income_allocation').insert(
    rows.map((row) => ({
      id_family: params.idFamily,
      id_transaction: params.idTransaction,
      id_budget_type: row.id_budget_type === SAVINGS_ID ? null : row.id_budget_type,
      id_budget_subtype: row.id_budget_type === SAVINGS_ID ? null : row.id_budget_subtype,
      ft_amount: round2(parseNumber(row.amount)),
    }))
  )
  if (error) throw error
}

/** Repartos guardados de todos los ingresos de la familia (por transacción). Sin tabla: mapa vacío. */
export async function getFamilyIncomeAllocations(
  supabase: SupabaseClient<Database>,
  idFamily: string
): Promise<Map<string, AllocationRow[]>> {
  const result = new Map<string, AllocationRow[]>()
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('gnp_fct_income_allocation')
      .select('*')
      .eq('id_family', idFamily)
      .order('id_income_allocation', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (error) {
      console.warn('Repartos de ingresos no disponibles:', error.message)
      return result
    }
    for (const row of data || []) {
      const list = result.get(row.id_transaction) || []
      list.push({
        key: row.id_income_allocation,
        id_budget_type: row.id_budget_type ?? SAVINGS_ID,
        id_budget_subtype: row.id_budget_subtype,
        amount: String(row.ft_amount),
      })
      result.set(row.id_transaction, list)
    }
    if (!data || data.length < pageSize) break
  }
  return result
}
