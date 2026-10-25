import type { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { round2 } from '@/lib/budget-calculator'

export type BudgetClose = Database['public']['Tables']['pml_cfg_budget_close']['Row']

/** Una línea del cierre: `idBudgetType = null` es el ahorro generado en el periodo. */
export type CloseRowInput = {
  idBudgetType: string | null
  balance: number
  carried: number
  toSavings: number
}

export const monthOfClose = (close: Pick<BudgetClose, 'dt_close_month'>) => close.dt_close_month.slice(0, 7)

/** Cierres de la familia. Si la tabla aún no existe devuelve `available: false`. */
export async function getBudgetCloses(
  supabase: SupabaseClient<Database>,
  idFamily: string
): Promise<{ closes: BudgetClose[]; available: boolean }> {
  const { data, error } = await supabase
    .from('pml_cfg_budget_close')
    .select('*')
    .eq('id_family', idFamily)
    .order('dt_close_month', { ascending: true })
  if (error) {
    console.warn('Cierres de presupuesto no disponibles:', error.message)
    return { closes: [], available: false }
  }
  return { closes: data || [], available: true }
}

/** Último mes cerrado de una persona (YYYY-MM) o null. */
export function lastCloseMonth(closes: BudgetClose[], idUser: string): string | null {
  const months = closes.filter((close) => close.id_user === idUser).map(monthOfClose).sort()
  return months[months.length - 1] || null
}

/** Guarda el cierre de una persona hasta `closeMonth` (YYYY-MM). */
export async function saveBudgetClose(
  supabase: SupabaseClient<Database>,
  params: { idFamily: string; idUser: string; closeMonth: string; rows: CloseRowInput[] }
): Promise<void> {
  const { error } = await supabase.from('pml_cfg_budget_close').insert(
    params.rows.map((row) => ({
      id_family: params.idFamily,
      id_user: params.idUser,
      dt_close_month: `${params.closeMonth}-01`,
      id_budget_type: row.idBudgetType,
      ft_balance: round2(row.balance),
      ft_carried: round2(row.carried),
      ft_to_savings: round2(row.toSavings),
    }))
  )
  if (error) throw error
}

/** Deshace el último cierre de una persona. */
export async function undoLastBudgetClose(
  supabase: SupabaseClient<Database>,
  params: { idFamily: string; idUser: string; closeMonth: string }
): Promise<void> {
  const { error } = await supabase
    .from('pml_cfg_budget_close')
    .delete()
    .eq('id_family', params.idFamily)
    .eq('id_user', params.idUser)
    .eq('dt_close_month', `${params.closeMonth}-01`)
  if (error) throw error
}
