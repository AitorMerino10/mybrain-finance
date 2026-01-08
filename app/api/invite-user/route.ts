import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

// Este endpoint requiere las claves de servicio de Supabase
// Debe estar en variables de entorno: SUPABASE_SERVICE_ROLE_KEY
export async function POST(request: NextRequest) {
  try {
    const { email, name, idFamily } = await request.json()

    if (!email || !idFamily) {
      return NextResponse.json(
        { error: 'Email e idFamily son requeridos' },
        { status: 400 }
      )
    }

    // Verificar que tenemos la clave de servicio
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY no está configurada en las variables de entorno')
      return NextResponse.json(
        { 
          error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada. Por favor, añade esta variable a tu archivo .env.local y reinicia el servidor. Puedes encontrarla en Supabase: Settings → API → Service Role Key'
        },
        { status: 500 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_SUPABASE_URL no está configurada en las variables de entorno' },
        { status: 500 }
      )
    }

    // Crear cliente con permisos de servicio (bypassa RLS)
    const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    let userId: string

    // Intentar crear el usuario directamente. Si ya existe, lo capturamos
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirmar email
      user_metadata: {
        full_name: name,
      },
    })

    if (createError) {
      // Si el error es que el usuario ya existe, buscarlo por email
      if (createError.message?.includes('already registered') || createError.message?.includes('already exists')) {
        // Buscar el usuario existente por email
        const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
        
        if (listError) {
          console.error('Error al listar usuarios:', listError)
          return NextResponse.json(
            { error: 'Error al verificar usuarios existentes' },
            { status: 500 }
          )
        }

        const existingUser = existingUsers?.users?.find((u) => u.email === email)
        
        if (!existingUser) {
          return NextResponse.json(
            { error: 'El usuario ya existe pero no se pudo encontrar' },
            { status: 500 }
          )
        }

        userId = existingUser.id
      } else {
        console.error('Error al crear usuario en Auth:', createError)
        return NextResponse.json(
          { error: `Error al crear usuario: ${createError.message}` },
          { status: 500 }
        )
      }
    } else {
      if (!newUser?.user) {
        return NextResponse.json(
          { error: 'No se pudo crear el usuario' },
          { status: 500 }
        )
      }

      userId = newUser.user.id
    }

    // Verificar si el usuario ya existe en pml_dim_user
    const { data: existingDimUser } = await supabaseAdmin
      .from('pml_dim_user')
      .select('id_user')
      .eq('id_user', userId)
      .maybeSingle()

    if (!existingDimUser) {
      // Crear el usuario en pml_dim_user
      const { error: insertError } = await supabaseAdmin
        .from('pml_dim_user')
        .insert({
          id_user: userId,
          ds_email: email,
          ds_user: name || null,
        })

      if (insertError) {
        console.error('Error al crear usuario en pml_dim_user:', insertError)
        // No fallar si ya existe
        if (insertError.code !== '23505') {
          return NextResponse.json(
            { error: `Error al crear perfil de usuario: ${insertError.message}` },
            { status: 500 }
          )
        }
      }
    }

    // Verificar si ya está en la familia
    const { data: existingRelation } = await supabaseAdmin
      .from('pml_rel_user_family')
      .select('id_user')
      .eq('id_user', userId)
      .eq('id_family', idFamily)
      .maybeSingle()

    if (existingRelation) {
      return NextResponse.json(
        { error: 'Este usuario ya está en la familia' },
        { status: 400 }
      )
    }

    // Añadir el usuario a la familia
    const { error: familyError } = await supabaseAdmin
      .from('pml_rel_user_family')
      .insert({
        id_user: userId,
        id_family: idFamily,
      })

    if (familyError) {
      console.error('Error al añadir usuario a familia:', familyError)
      return NextResponse.json(
        { error: `Error al añadir a la familia: ${familyError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Usuario invitado y añadido a la familia correctamente',
      userId,
    })
  } catch (error) {
    console.error('Error en invite-user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

