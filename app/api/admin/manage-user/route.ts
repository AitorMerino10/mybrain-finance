import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

export async function POST(request: NextRequest) {
  try {
    const { action, userId, email, name, idFamily } = await request.json()

    if (!action) {
      return NextResponse.json(
        { error: 'action es requerido' },
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

    // Crear cliente con permisos de servicio
    const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    if (action === 'create') {
      if (!email) {
        return NextResponse.json(
          { error: 'email es requerido para crear usuario' },
          { status: 400 }
        )
      }

      // Crear usuario en auth
      const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: name || email.split('@')[0],
        },
      })

      if (createError || !newAuthUser.user) {
        return NextResponse.json(
          { error: `Error al crear usuario: ${createError?.message || 'Error desconocido'}` },
          { status: 500 }
        )
      }

      // Crear usuario en pml_dim_user
      const { error: insertError } = await supabaseAdmin
        .from('pml_dim_user')
        .insert({
          id_user: newAuthUser.user.id,
          ds_email: email,
          ds_user: name || null,
        })

      if (insertError) {
        // Si ya existe, no es un error crítico
        if (insertError.code !== '23505') {
          return NextResponse.json(
            { error: `Error al crear perfil: ${insertError.message}` },
            { status: 500 }
          )
        }
      }

      return NextResponse.json({
        success: true,
        userId: newAuthUser.user.id,
        message: 'Usuario creado correctamente',
      })
    }

    if (action === 'delete') {
      if (!userId) {
        return NextResponse.json(
          { error: 'userId es requerido para borrar usuario' },
          { status: 400 }
        )
      }

      // Borrar usuario de auth (esto también borrará en cascada de pml_dim_user y relaciones)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

      if (deleteError) {
        return NextResponse.json(
          { error: `Error al borrar usuario: ${deleteError.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Usuario borrado correctamente',
      })
    }

    if (action === 'add_to_family') {
      if (!userId || !idFamily) {
        return NextResponse.json(
          { error: 'userId e idFamily son requeridos' },
          { status: 400 }
        )
      }

      // Verificar si ya está en la familia
      const { data: existing } = await supabaseAdmin
        .from('pml_rel_user_family')
        .select('id_user')
        .eq('id_user', userId)
        .eq('id_family', idFamily)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { error: 'El usuario ya está en esta familia' },
          { status: 400 }
        )
      }

      // Añadir a la familia
      const { error: insertError } = await supabaseAdmin
        .from('pml_rel_user_family')
        .insert({
          id_user: userId,
          id_family: idFamily,
        })

      if (insertError) {
        return NextResponse.json(
          { error: `Error al añadir a familia: ${insertError.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Usuario añadido a la familia correctamente',
      })
    }

    if (action === 'remove_from_family') {
      if (!userId || !idFamily) {
        return NextResponse.json(
          { error: 'userId e idFamily son requeridos' },
          { status: 400 }
        )
      }

      // Quitar de la familia
      const { error: deleteError } = await supabaseAdmin
        .from('pml_rel_user_family')
        .delete()
        .eq('id_user', userId)
        .eq('id_family', idFamily)

      if (deleteError) {
        return NextResponse.json(
          { error: `Error al quitar de familia: ${deleteError.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Usuario quitado de la familia correctamente',
      })
    }

    return NextResponse.json(
      { error: 'action no válido' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error en manage-user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

