import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export type CardAssignment = Database['public']['Tables']['pml_cfg_card_assignment']['Row']

/** Nombre de tarjeta sin tildes, mayúsculas ni símbolos: "Visa •••• 1234" y "visa 1234" son la misma. */
export function cardKey(value: string | null | undefined): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Asignación que corresponde a una tarjeta: la misma, o (si se escribió algo más corto a mano) una contenida en ella. */
export function findCardAssignment(assignments: CardAssignment[], card: string | null | undefined): CardAssignment | null {
  const key = cardKey(card)
  if (!key) return null
  const exact = assignments.find((item) => item.ds_card_key === key)
  if (exact) return exact
  return assignments.find((item) => item.ds_card_key.length >= 3 && key.includes(item.ds_card_key)) || null
}

export async function getCardAssignments(supabase: SupabaseClient<Database>, idFamily: string): Promise<CardAssignment[]> {
  const { data, error } = await supabase.from('pml_cfg_card_assignment').select('*').eq('id_family', idFamily).order('ds_card', { ascending: true })
  if (error) {
    // Si aún no se ha ejecutado la migración, simplemente no hay asignaciones
    console.warn('No se pudieron cargar las tarjetas:', error.message)
    return []
  }
  return data || []
}

export async function saveCardAssignment(
  supabase: SupabaseClient<Database>,
  params: { idFamily: string; card: string; userIds: string[] }
): Promise<void> {
  const card = params.card.trim().slice(0, 60)
  const key = cardKey(card)
  if (!key) throw new Error('Escribe el nombre de la tarjeta')
  const { error } = await supabase
    .from('pml_cfg_card_assignment')
    .upsert({ id_family: params.idFamily, ds_card: card, ds_card_key: key, ds_user_ids: params.userIds }, { onConflict: 'id_family,ds_card_key' })
  if (error) throw error
}

export async function deleteCardAssignment(supabase: SupabaseClient<Database>, idCardAssignment: string): Promise<void> {
  const { error } = await supabase.from('pml_cfg_card_assignment').delete().eq('id_card_assignment', idCardAssignment)
  if (error) throw error
}
