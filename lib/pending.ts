import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export type PendingTransaction = Database['public']['Tables']['pml_pending_transaction']['Row']

/** Gastos pendientes de completar de una persona en una familia (los más recientes primero). */
export async function getPendingTransactions(
  supabase: SupabaseClient<Database>,
  idFamily: string,
  idUser: string
): Promise<PendingTransaction[]> {
  const { data, error } = await supabase
    .from('pml_pending_transaction')
    .select('*')
    .eq('id_family', idFamily)
    .eq('id_user', idUser)
    .order('dt_created', { ascending: false })
  if (error) {
    // Si aún no se ha ejecutado la migración, simplemente no hay pendientes
    console.warn('No se pudieron cargar los gastos pendientes:', error.message)
    return []
  }
  return data || []
}

export async function deletePendingTransaction(supabase: SupabaseClient<Database>, idPending: string): Promise<void> {
  const { error } = await supabase.from('pml_pending_transaction').delete().eq('id_pending_transaction', idPending)
  if (error) throw error
}
