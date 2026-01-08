import type { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

type Tag = Database['public']['Tables']['pml_dim_tag']['Row']

/**
 * Obtiene todas las tags de una familia
 * @param supabase - Cliente de Supabase
 * @param idFamily - ID de la familia
 * @returns Array de tags
 */
export async function getTagsByFamily(
  supabase: SupabaseClient<Database>,
  idFamily: string
): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('pml_dim_tag')
    .select('*')
    .eq('id_family', idFamily)
    .order('ds_tag', { ascending: true })

  if (error) {
    console.error('Error al obtener tags:', error)
    throw error
  }

  return data || []
}

/**
 * Crea una nueva tag
 * @param supabase - Cliente de Supabase
 * @param tagData - Datos de la tag
 * @returns Tag creada
 */
export async function createTag(
  supabase: SupabaseClient<Database>,
  tagData: {
    ds_tag: string
    id_family: string
    ds_color?: string | null
    ds_icon?: string | null
  }
): Promise<Tag> {
  const { data, error } = await supabase
    .from('pml_dim_tag')
    .insert({
      ds_tag: tagData.ds_tag,
      id_family: tagData.id_family,
      ds_color: tagData.ds_color ?? null,
      ds_icon: tagData.ds_icon ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error al crear tag:', error)
    throw error
  }

  return data
}

/**
 * Asocia una tag a una transacción
 * @param supabase - Cliente de Supabase
 * @param idTransaction - ID de la transacción
 * @param idTag - ID de la tag
 */
export async function associateTagToTransaction(
  supabase: SupabaseClient<Database>,
  idTransaction: string,
  idTag: string
): Promise<void> {
  const { error } = await supabase
    .from('pml_rel_transaction_tag')
    .insert({
      id_transaction: idTransaction,
      id_tag: idTag,
    })

  if (error) {
    console.error('Error al asociar tag a transacción:', error)
    throw error
  }
}


