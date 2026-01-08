import type { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

type User = Database['public']['Tables']['pml_dim_user']['Row']

export interface FamilyMember {
  id_user: string
  ds_user: string | null
  ds_email: string
}

/**
 * Obtiene todos los usuarios de una familia
 * @param supabase - Cliente de Supabase
 * @param idFamily - ID de la familia
 * @returns Array de miembros de la familia con sus datos
 */
export async function getFamilyMembers(
  supabase: SupabaseClient<Database>,
  idFamily: string
): Promise<FamilyMember[]> {
  const { data, error } = await supabase
    .from('pml_rel_user_family')
    .select(`
      id_user,
      pml_dim_user (
        id_user,
        ds_user,
        ds_email
      )
    `)
    .eq('id_family', idFamily)

  if (error) {
    console.error('Error al obtener miembros de la familia:', error)
    throw error
  }

  if (!data) {
    return []
  }

  // Transformar los datos para que sean más fáciles de usar
  return data
    .map((item: any) => {
      const user = item.pml_dim_user
      if (!user) return null
      return {
        id_user: item.id_user,
        ds_user: user.ds_user || null,
        ds_email: user.ds_email || '',
      }
    })
    .filter((item): item is FamilyMember => item !== null)
}

/**
 * Asocia usuarios a una transacción
 * @param supabase - Cliente de Supabase
 * @param idTransaction - ID de la transacción
 * @param userIds - Array de IDs de usuarios
 * @param amountPerUser - Importe por usuario (normalmente el importe total de la transacción)
 */
export async function associateUsersToTransaction(
  supabase: SupabaseClient<Database>,
  idTransaction: string,
  userIds: string[],
  amountPerUser: number
): Promise<void> {
  if (userIds.length === 0) {
    throw new Error('Debe haber al menos un usuario asociado')
  }

  const relations = userIds.map((id_user) => ({
    id_transaction: idTransaction,
    id_user: id_user,
    ft_amount_user: amountPerUser,
  }))

  const { error } = await supabase
    .from('pml_rel_transaction_user')
    .insert(relations)

  if (error) {
    console.error('Error al asociar usuarios a transacción:', error)
    throw error
  }
}

export interface UserFamily {
  id_family: string
  ds_family: string
  dt_inclusion: string | null
}

/**
 * Obtiene todas las familias de un usuario
 * @param supabase - Cliente de Supabase
 * @param idUser - ID del usuario
 * @returns Array de familias del usuario con sus datos
 */
export async function getUserFamilies(
  supabase: SupabaseClient<Database>,
  idUser: string
): Promise<UserFamily[]> {
  const { data, error } = await supabase
    .from('pml_rel_user_family')
    .select(`
      id_family,
      dt_inclusion,
      pml_dim_family (
        id_family,
        ds_family
      )
    `)
    .eq('id_user', idUser)

  if (error) {
    console.error('Error al obtener familias del usuario:', error)
    throw error
  }

  if (!data) {
    return []
  }

  return data
    .map((item: any) => {
      const family = item.pml_dim_family
      if (!family) return null
      return {
        id_family: item.id_family,
        ds_family: family.ds_family || '',
        dt_inclusion: item.dt_inclusion || null,
      }
    })
    .filter((item): item is UserFamily => item !== null)
}

/**
 * Crea un nuevo usuario en pml_dim_user
 * @param supabase - Cliente de Supabase
 * @param userData - Datos del usuario
 * @returns Usuario creado
 */
export async function createUser(
  supabase: SupabaseClient<Database>,
  userData: {
    id_user: string
    ds_email: string
    ds_user?: string | null
  }
): Promise<Database['public']['Tables']['pml_dim_user']['Row']> {
  const { data, error } = await supabase
    .from('pml_dim_user')
    .insert({
      id_user: userData.id_user,
      ds_email: userData.ds_email,
      ds_user: userData.ds_user || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error al crear usuario:', error)
    throw error
  }

  return data
}

/**
 * Añade un usuario a una familia
 * @param supabase - Cliente de Supabase
 * @param idUser - ID del usuario
 * @param idFamily - ID de la familia
 */
export async function addUserToFamily(
  supabase: SupabaseClient<Database>,
  idUser: string,
  idFamily: string
): Promise<void> {
  const { error } = await supabase
    .from('pml_rel_user_family')
    .insert({
      id_user: idUser,
      id_family: idFamily,
    })

  if (error) {
    console.error('Error al añadir usuario a familia:', error)
    throw error
  }
}

/**
 * Verifica si un usuario es admin de una familia
 * Por ahora, asumimos que el primer usuario (ordenado por dt_inclusion) es el admin
 * @param supabase - Cliente de Supabase
 * @param idUser - ID del usuario
 * @param idFamily - ID de la familia
 * @returns true si el usuario es admin
 */
export async function isUserFamilyAdmin(
  supabase: SupabaseClient<Database>,
  idUser: string,
  idFamily: string
): Promise<boolean> {
  // Obtener el primer usuario de la familia (ordenado por dt_inclusion)
  const { data, error } = await supabase
    .from('pml_rel_user_family')
    .select('id_user')
    .eq('id_family', idFamily)
    .order('dt_inclusion', { ascending: true, nullsFirst: false })
    .limit(1)
    .single()

  if (error || !data) {
    return false
  }

  return data.id_user === idUser
}

