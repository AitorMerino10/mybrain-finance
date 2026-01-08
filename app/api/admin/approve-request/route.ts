import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'
import { APP_ADMIN_ID, APP_ADMIN_EMAIL } from '@/lib/admin'

export async function POST(request: NextRequest) {
  try {
    const { idRequest, action } = await request.json()

    if (!idRequest || !action) {
      return NextResponse.json(
        { error: 'idRequest y action son requeridos' },
        { status: 400 }
      )
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: 'action debe ser "approve" o "reject"' },
        { status: 400 }
      )
    }

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

    // Obtener usuario actual desde cookies usando createClient de supabase-server
    const { createClient: createServerClient } = await import('@/lib/supabase-server')
    let currentUserId: string | null = null

    try {
      const supabaseClient = createServerClient()
      const { data: { user } } = await supabaseClient.auth.getUser()
      if (user) {
        currentUserId = user.id
      }
    } catch (e) {
      // Ignorar error
    }

    // Crear cliente con permisos de servicio
    const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Obtener la petición
    const { data: requestData, error: requestError } = await supabaseAdmin
      .from('pml_dim_family_request')
      .select('*')
      .eq('id_request', idRequest)
      .single()

    if (requestError || !requestData) {
      return NextResponse.json(
        { error: 'Petición no encontrada' },
        { status: 404 }
      )
    }

    if (requestData.ds_status !== 'pending') {
      return NextResponse.json(
        { error: 'La petición ya ha sido procesada' },
        { status: 400 }
      )
    }

    // Si es rechazar, solo actualizar estado
    if (action === 'reject') {
      const { error: updateError } = await supabaseAdmin
        .from('pml_dim_family_request')
        .update({
          ds_status: 'rejected',
          id_approved_by: currentUserId || APP_ADMIN_ID,
        })
        .eq('id_request', idRequest)

      if (updateError) {
        return NextResponse.json(
          { error: 'Error al rechazar petición' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    }

    // Si es aprobar, procesar según el tipo
    if (requestData.ds_request_type === 'create_family') {
      // Crear la familia
      const { data: family, error: familyError } = await supabaseAdmin
        .from('pml_dim_family')
        .insert({
          ds_family: requestData.ds_family_name || 'Nueva Familia',
        })
        .select()
        .single()

      if (familyError || !family) {
        return NextResponse.json(
          { error: 'Error al crear la familia' },
          { status: 500 }
        )
      }

      // Obtener emails de usuarios solicitados
      const requestedUsers: Array<{ email: string; name?: string }> = (
        Array.isArray(requestData.js_requested_users) 
          ? requestData.js_requested_users 
          : []
      ) as Array<{ email: string; name?: string }>
      const userEmails = requestedUsers.map(u => u.email.toLowerCase().trim())
      
      // Asegurar que el solicitante esté incluido
      // Primero intentar obtener desde pml_dim_user
      let requesterEmail: string | null = null
      const { data: requesterUser } = await supabaseAdmin
        .from('pml_dim_user')
        .select('ds_email')
        .eq('id_user', requestData.id_user)
        .maybeSingle()

      if (requesterUser?.ds_email) {
        requesterEmail = requesterUser.ds_email.toLowerCase().trim()
      } else {
        // Si no está en pml_dim_user, obtener desde auth.users
        try {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(requestData.id_user)
          if (authUser?.user?.email) {
            requesterEmail = authUser.user.email.toLowerCase().trim()
          }
        } catch (e) {
          console.error('Error al obtener email del solicitante:', e)
        }
      }

      if (requesterEmail && !userEmails.includes(requesterEmail)) {
        userEmails.push(requesterEmail)
      }

      // Crear usuarios y añadirlos a la familia
      const userIds: string[] = []
      
      for (const email of userEmails) {
        // Buscar usuario en auth.users
        let authUser
        try {
          // Listar usuarios y buscar por email
          const { data: usersData } = await supabaseAdmin.auth.admin.listUsers()
          authUser = usersData?.users?.find((u) => u.email === email)
        } catch (e) {
          // Usuario no existe
        }
        
        let userId: string
        
        if (authUser) {
          userId = authUser.id
        } else {
          // Crear usuario en auth si no existe
          const requestedUser = requestedUsers.find(u => u.email.toLowerCase().trim() === email)
          const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: {
              full_name: requestedUser?.name || email.split('@')[0],
            },
          })

          if (createError || !newAuthUser.user) {
            console.error(`Error al crear usuario ${email}:`, createError)
            continue
          }

          userId = newAuthUser.user.id
        }

        // Crear usuario en pml_dim_user si no existe
        const { data: existingUser } = await supabaseAdmin
          .from('pml_dim_user')
          .select('id_user')
          .eq('id_user', userId)
          .maybeSingle()

        if (!existingUser) {
          const requestedUser = requestedUsers.find(u => u.email.toLowerCase().trim() === email)
          await supabaseAdmin
            .from('pml_dim_user')
            .insert({
              id_user: userId,
              ds_email: email,
              ds_user: requestedUser?.name || null,
            })
        }

        userIds.push(userId)
      }

      // Añadir todos los usuarios a la familia
      for (const userId of userIds) {
        try {
          // Verificar si ya está en la familia
          const { data: existing } = await supabaseAdmin
            .from('pml_rel_user_family')
            .select('id_user')
            .eq('id_user', userId)
            .eq('id_family', family.id_family)
            .maybeSingle()

          if (!existing) {
            await supabaseAdmin
              .from('pml_rel_user_family')
              .insert({
                id_user: userId,
                id_family: family.id_family,
              })
          }
        } catch (error) {
          console.error(`Error al añadir usuario ${userId} a la familia:`, error)
          // Continuar con los demás usuarios
        }
      }

      // Actualizar estado de la petición
      const { error: updateError } = await supabaseAdmin
        .from('pml_dim_family_request')
        .update({
          ds_status: 'approved',
          id_approved_by: currentUserId || APP_ADMIN_ID,
        })
        .eq('id_request', idRequest)

      if (updateError) {
        return NextResponse.json(
          { error: 'Error al actualizar la petición' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, familyId: family.id_family })
    } else if (requestData.ds_request_type === 'join_family' && requestData.id_family) {
      // Añadir el usuario solicitante a la familia
      // Verificar si ya está en la familia
      const { data: existing } = await supabaseAdmin
        .from('pml_rel_user_family')
        .select('id_user')
        .eq('id_user', requestData.id_user)
        .eq('id_family', requestData.id_family)
        .maybeSingle()

      if (!existing) {
        const { error: familyError } = await supabaseAdmin
          .from('pml_rel_user_family')
          .insert({
            id_user: requestData.id_user,
            id_family: requestData.id_family,
          })

        if (familyError) {
          return NextResponse.json(
            { error: 'Error al añadir usuario a la familia' },
            { status: 500 }
          )
        }
      }

      // Actualizar estado de la petición
      const { error: updateError } = await supabaseAdmin
        .from('pml_dim_family_request')
        .update({
          ds_status: 'approved',
          id_approved_by: currentUserId || APP_ADMIN_ID,
        })
        .eq('id_request', idRequest)

      if (updateError) {
        return NextResponse.json(
          { error: 'Error al actualizar la petición' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Tipo de petición incorrecto' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error en approve-request:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

