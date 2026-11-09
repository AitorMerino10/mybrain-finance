import type { BudgetType, CurrentUserBudget } from '@/lib/budgets'
import { computeDefaultIncomeAllocation } from '@/lib/income-allocations'

/** ¿Alguna de estas personas tiene ya algún presupuesto creado? Si no, no se exige asociar la transacción a uno. */
export function usersHaveBudgets(versions: CurrentUserBudget[], userIds: string[]): boolean {
  return versions.some((version) => version.is_active && userIds.includes(version.id_user))
}

/**
 * Un ingreso queda sin asociar a ningún presupuesto cuando nadie lo reparte (ni tú, ni el reparto por defecto)
 * porque en ese mes no había presupuesto vigente. Mandarlo todo a ahorro sí cuenta como repartido.
 * `month`: YYYY-MM del mes declarado.
 */
export function incomeHasNoDefaultBudget(params: {
  amount: number
  userIds: string[]
  month: string
  versions: CurrentUserBudget[]
  budgetTypes: BudgetType[]
}): boolean {
  return computeDefaultIncomeAllocation(params).length === 0
}
