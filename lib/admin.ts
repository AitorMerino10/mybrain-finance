import type { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createUser, addUserToFamily } from './family'

// ID del administrador de la aplicación
export const APP_ADMIN_ID = 'bd65acd3-9c4c-4e84-a7e4-93e376773a49'
export const APP_ADMIN_EMAIL = 'aitormerino10@gmail.com'

/**
 * Verifica si un usuario es el administrador de la aplicación
 */
export function isAppAdmin(userId: string, userEmail?: string | null): boolean {
  return userId === APP_ADMIN_ID || userEmail === APP_ADMIN_EMAIL
}

/**
 * Tipo de petición de familia
 */
export type FamilyRequestType = 'create_family' | 'join_family'

/**
 * Estado de petición
 */
export type RequestStatus = 'pending' | 'approved' | 'rejected'

/**
 * Usuario solicitado en una petición
 */
export interface RequestedUser {
  email: string
  name?: string
}

/**
 * Petición de familia
 */
export interface FamilyRequest {
  id_request: string
  id_user: string
  ds_request_type: FamilyRequestType
  ds_family_name: string | null
  id_family: string | null
  js_requested_users: RequestedUser[]
  ds_comment: string | null
  ds_status: RequestStatus
  id_approved_by: string | null
  dt_created: string
  dt_updated: string
  // Datos del usuario solicitante
  user?: {
    id_user: string
    ds_user: string | null
    ds_email: string
  }
  // Datos de la familia (si es join_family)
  family?: {
    id_family: string
    ds_family: string | null
  }
}

/**
 * Crea una nueva petición de familia
 */
export async function createFamilyRequest(
  supabase: SupabaseClient<Database>,
  requestData: {
    id_user: string
    ds_request_type: FamilyRequestType
    ds_family_name?: string | null
    id_family?: string | null
    js_requested_users: RequestedUser[]
    ds_comment?: string | null
  }
): Promise<FamilyRequest> {
  const { data, error } = await supabase
    .from('pml_dim_family_request')
    .insert({
      id_user: requestData.id_user,
      ds_request_type: requestData.ds_request_type,
      ds_family_name: requestData.ds_family_name || null,
      id_family: requestData.id_family || null,
      js_requested_users: requestData.js_requested_users as any,
      ds_comment: requestData.ds_comment || null,
      ds_status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('Error al crear petición de familia:', error)
    throw error
  }

  return {
    ...data,
    js_requested_users: (data.js_requested_users as any) || [],
  } as FamilyRequest
}

/**
 * Obtiene todas las peticiones de familia
 */
export async function getAllFamilyRequests(
  supabase: SupabaseClient<Database>,
  status?: RequestStatus
): Promise<FamilyRequest[]> {
  // Primero obtener las peticiones sin joins para evitar problemas si no existe el usuario
  let query = supabase
    .from('pml_dim_family_request')
    .select('*')
    .order('dt_created', { ascending: false })

  if (status) {
    query = query.eq('ds_status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error al obtener peticiones:', error)
    throw error
  }

  if (!data || data.length === 0) {
    return []
  }

  // Obtener información de usuarios y familias por separado
  const userIds = Array.from(new Set(data.map((item: any) => item.id_user).filter(Boolean)))
  const familyIds = Array.from(new Set(data.map((item: any) => item.id_family).filter(Boolean)))

  // Obtener usuarios de pml_dim_user
  const usersMap = new Map<string, { id_user: string; ds_user: string | null; ds_email: string }>()
  if (userIds.length > 0) {
    const { data: usersData } = await supabase
      .from('pml_dim_user')
      .select('id_user, ds_user, ds_email')
      .in('id_user', userIds)

    if (usersData) {
      usersData.forEach((user: any) => {
        usersMap.set(user.id_user, user)
      })
    }

    // Para usuarios que no están en pml_dim_user, crear placeholder
    // (Los emails reales se obtendrán desde el servidor si es necesario)
    const missingUserIds = userIds.filter(id => !usersMap.has(id))
    if (missingUserIds.length > 0) {
      for (const userId of missingUserIds) {
        usersMap.set(userId, {
          id_user: userId,
          ds_user: null,
          ds_email: `Usuario ${userId.substring(0, 8)}...`,
        })
      }
    }
  }

  // Obtener familias
  const familiesMap = new Map<string, { id_family: string; ds_family: string | null }>()
  if (familyIds.length > 0) {
    const { data: familiesData } = await supabase
      .from('pml_dim_family')
      .select('id_family, ds_family')
      .in('id_family', familyIds)

    if (familiesData) {
      familiesData.forEach((family: any) => {
        familiesMap.set(family.id_family, family)
      })
    }
  }

  return data.map((item: any) => {
    const user = usersMap.get(item.id_user)
    const family = item.id_family ? familiesMap.get(item.id_family) : undefined

    return {
      id_request: item.id_request,
      id_user: item.id_user,
      ds_request_type: item.ds_request_type,
      ds_family_name: item.ds_family_name,
      id_family: item.id_family,
      js_requested_users: (item.js_requested_users as RequestedUser[]) || [],
      ds_comment: item.ds_comment,
      ds_status: item.ds_status,
      id_approved_by: item.id_approved_by,
      dt_created: item.dt_created,
      dt_updated: item.dt_updated,
      user: user ? {
        id_user: user.id_user,
        ds_user: user.ds_user,
        ds_email: user.ds_email,
      } : undefined,
      family: family ? {
        id_family: family.id_family,
        ds_family: family.ds_family,
      } : undefined,
    }
  })
}

/**
 * Obtiene peticiones pendientes para una familia específica
 */
export async function getPendingRequestsForFamily(
  supabase: SupabaseClient<Database>,
  idFamily: string
): Promise<FamilyRequest[]> {
  const { data, error } = await supabase
    .from('pml_dim_family_request')
    .select(`
      *,
      pml_dim_user!pml_dim_family_request_id_user_fkey (
        id_user,
        ds_user,
        ds_email
      )
    `)
    .eq('id_family', idFamily)
    .eq('ds_status', 'pending')
    .eq('ds_request_type', 'join_family')
    .order('dt_created', { ascending: false })

  if (error) {
    console.error('Error al obtener peticiones de familia:', error)
    throw error
  }

  if (!data) {
    return []
  }

  return data.map((item: any) => ({
    id_request: item.id_request,
    id_user: item.id_user,
    ds_request_type: item.ds_request_type,
    ds_family_name: item.ds_family_name,
    id_family: item.id_family,
    js_requested_users: (item.js_requested_users as RequestedUser[]) || [],
    ds_comment: item.ds_comment,
    ds_status: item.ds_status,
    id_approved_by: item.id_approved_by,
    dt_created: item.dt_created,
    dt_updated: item.dt_updated,
    user: item.pml_dim_user ? {
      id_user: item.pml_dim_user.id_user,
      ds_user: item.pml_dim_user.ds_user,
      ds_email: item.pml_dim_user.ds_email,
    } : undefined,
  }))
}

/**
 * Aprobar una petición de creación de familia (llama a API route)
 */
export async function approveCreateFamilyRequest(
  idRequest: string
): Promise<void> {
  const response = await fetch('/api/admin/approve-request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idRequest,
      action: 'approve',
    }),
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Error al aprobar petición')
  }
}

/**
 * Aprobar una petición de unirse a familia existente (llama a API route)
 */
export async function approveJoinFamilyRequest(
  idRequest: string
): Promise<void> {
  const response = await fetch('/api/admin/approve-request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idRequest,
      action: 'approve',
    }),
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Error al aprobar petición')
  }
}

/**
 * Rechazar una petición (llama a API route)
 */
export async function rejectFamilyRequest(
  idRequest: string
): Promise<void> {
  const response = await fetch('/api/admin/approve-request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idRequest,
      action: 'reject',
    }),
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Error al rechazar petición')
  }
}

/**
 * Obtiene todas las familias con sus miembros
 */
export async function getAllFamiliesWithMembers(
  supabase: SupabaseClient<Database>
): Promise<Array<{
  id_family: string
  ds_family: string | null
  dt_created: string | null
  members: Array<{
    id_user: string
    ds_user: string | null
    ds_email: string
    dt_inclusion: string | null
  }>
}>> {
  // Obtener todas las familias
  const { data: families, error: familiesError } = await supabase
    .from('pml_dim_family')
    .select('id_family, ds_family, dt_created')
    .order('dt_created', { ascending: false })

  if (familiesError) {
    console.error('Error al obtener familias:', familiesError)
    throw familiesError
  }

  if (!families || families.length === 0) {
    return []
  }

  // Para cada familia, obtener sus miembros
  const familiesWithMembers = await Promise.all(
    families.map(async (family) => {
      const { data: relations, error: relationsError } = await supabase
        .from('pml_rel_user_family')
        .select(`
          id_user,
          dt_inclusion,
          pml_dim_user!pml_rel_user_family_id_user_fkey (
            id_user,
            ds_user,
            ds_email
          )
        `)
        .eq('id_family', family.id_family)
        .order('dt_inclusion', { ascending: true })

      if (relationsError) {
        console.error(`Error al obtener miembros de familia ${family.id_family}:`, relationsError)
        return {
          id_family: family.id_family,
          ds_family: family.ds_family,
          dt_created: family.dt_created,
          members: [],
        }
      }

      const members = (relations || []).map((rel: any) => ({
        id_user: rel.id_user,
        ds_user: rel.pml_dim_user?.ds_user || null,
        ds_email: rel.pml_dim_user?.ds_email || '',
        dt_inclusion: rel.dt_inclusion,
      }))

      return {
        id_family: family.id_family,
        ds_family: family.ds_family,
        dt_created: family.dt_created,
        members,
      }
    })
  )

  return familiesWithMembers
}

/**
 * Obtiene todos los usuarios del sistema
 */
export async function getAllUsers(
  supabase: SupabaseClient<Database>
): Promise<Array<{
  id_user: string
  ds_user: string | null
  ds_email: string
  dt_created: string | null
  dt_last_login: string | null
  families: Array<{
    id_family: string
    ds_family: string | null
  }>
}>> {
  // Obtener todos los usuarios
  const { data: users, error: usersError } = await supabase
    .from('pml_dim_user')
    .select('id_user, ds_user, ds_email, dt_created, dt_last_login')
    .order('dt_created', { ascending: false })

  if (usersError) {
    console.error('Error al obtener usuarios:', usersError)
    throw usersError
  }

  if (!users || users.length === 0) {
    return []
  }

  // Para cada usuario, obtener sus familias
  const usersWithFamilies = await Promise.all(
    users.map(async (user) => {
      const { data: relations } = await supabase
        .from('pml_rel_user_family')
        .select(`
          id_family,
          pml_dim_family!pml_rel_user_family_id_family_fkey (
            id_family,
            ds_family
          )
        `)
        .eq('id_user', user.id_user)

      const families = (relations || []).map((rel: any) => ({
        id_family: rel.id_family,
        ds_family: rel.pml_dim_family?.ds_family || null,
      }))

      return {
        id_user: user.id_user,
        ds_user: user.ds_user,
        ds_email: user.ds_email,
        dt_created: user.dt_created,
        dt_last_login: user.dt_last_login,
        families,
      }
    })
  )

  return usersWithFamilies
}
