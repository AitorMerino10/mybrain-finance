import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

export async function POST(request: NextRequest) {
  try {
    const { userIds } = await request.json()

    if (!userIds || !Array.isArray(userIds)) {
      return NextResponse.json(
        { error: 'userIds debe ser un array' },
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

    // Obtener usuarios de auth.users
    const { data: usersData, error } = await supabaseAdmin.auth.admin.listUsers()

    if (error) {
      console.error('Error al listar usuarios:', error)
      return NextResponse.json(
        { error: 'Error al obtener usuarios' },
        { status: 500 }
      )
    }

    // Filtrar solo los usuarios que necesitamos
    const users = (usersData?.users || []).filter((u) => userIds.includes(u.id))

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error en get-user-emails:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

