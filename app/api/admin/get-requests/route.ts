import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'
import { APP_ADMIN_ID, APP_ADMIN_EMAIL } from '@/lib/admin'

export async function GET(request: NextRequest) {
  try {
    // Verificar que tenemos la clave de servicio
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada' },
        { status: 500 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_SUPABASE_URL no está configurada' },
        { status: 500 }
      )
    }

    // Crear cliente con permisos de servicio
    const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Obtener todas las peticiones
    const status = request.nextUrl.searchParams.get('status')
    let query = supabaseAdmin
      .from('pml_dim_family_request')
      .select('*')
      .order('dt_created', { ascending: false })

    if (status) {
      query = query.eq('ds_status', status)
    }

    const { data: requests, error: requestsError } = await query

    if (requestsError) {
      return NextResponse.json(
        { error: 'Error al obtener peticiones' },
        { status: 500 }
      )
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json({ requests: [] })
    }

    // Obtener información de usuarios desde auth.users y pml_dim_user
    const userIds = Array.from(new Set(requests.map((r: any) => r.id_user).filter(Boolean)))
    const usersMap = new Map<string, { id_user: string; ds_user: string | null; ds_email: string }>()

    // Primero intentar obtener de pml_dim_user
    if (userIds.length > 0) {
      const { data: usersData } = await supabaseAdmin
        .from('pml_dim_user')
        .select('id_user, ds_user, ds_email')
        .in('id_user', userIds)

      if (usersData) {
        usersData.forEach((user: any) => {
          usersMap.set(user.id_user, user)
        })
      }

      // Para usuarios que no están en pml_dim_user, obtener de auth.users
      const missingUserIds = userIds.filter(id => !usersMap.has(id))
      if (missingUserIds.length > 0) {
        try {
          const { data: authUsersData } = await supabaseAdmin.auth.admin.listUsers()
          if (authUsersData?.users) {
            missingUserIds.forEach((userId) => {
              const authUser = authUsersData.users.find(u => u.id === userId)
              if (authUser) {
                usersMap.set(userId, {
                  id_user: userId,
                  ds_user: authUser.user_metadata?.full_name || authUser.user_metadata?.name || null,
                  ds_email: authUser.email || '',
                })
              }
            })
          }
        } catch (e) {
          console.error('Error al obtener usuarios de auth:', e)
        }
      }
    }

    // Obtener información de familias
    const familyIds = Array.from(new Set(requests.map((r: any) => r.id_family).filter(Boolean)))
    const familiesMap = new Map<string, { id_family: string; ds_family: string | null }>()
    
    if (familyIds.length > 0) {
      const { data: familiesData } = await supabaseAdmin
        .from('pml_dim_family')
        .select('id_family, ds_family')
        .in('id_family', familyIds)

      if (familiesData) {
        familiesData.forEach((family: any) => {
          familiesMap.set(family.id_family, family)
        })
      }
    }

    // Combinar datos
    const requestsWithData = requests.map((request: any) => {
      const user = usersMap.get(request.id_user)
      const family = request.id_family ? familiesMap.get(request.id_family) : undefined

      return {
        id_request: request.id_request,
        id_user: request.id_user,
        ds_request_type: request.ds_request_type,
        ds_family_name: request.ds_family_name,
        id_family: request.id_family,
        js_requested_users: request.js_requested_users || [],
        ds_comment: request.ds_comment,
        ds_status: request.ds_status,
        id_approved_by: request.id_approved_by,
        dt_created: request.dt_created,
        dt_updated: request.dt_updated,
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

    return NextResponse.json({ requests: requestsWithData })
  } catch (error) {
    console.error('Error en get-requests:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

