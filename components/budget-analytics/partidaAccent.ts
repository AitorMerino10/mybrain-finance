import { NO_BUDGET_TYPE, type BudgetAnalyticsData } from '@/lib/budget-analytics'
import { accentForBudgetType, UNASSIGNED_ACCENT, type Accent } from './visuals'

export function accentForPartida(data: BudgetAnalyticsData, idBudgetType: string): Accent {
  if (idBudgetType === NO_BUDGET_TYPE) return UNASSIGNED_ACCENT
  const index = data.budgetTypes.findIndex((type) => type.id_budget_type === idBudgetType)
  return accentForBudgetType(data.budgetTypes[index]?.ds_budget_type_key, Math.max(index, 0))
}
