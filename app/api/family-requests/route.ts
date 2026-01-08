import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createFamilyRequest } from '@/lib/admin'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { ds_request_type, ds_family_name, id_family, js_requested_users, ds_comment } = body

    if (!ds_request_type || !js_requested_users || !Array.isArray(js_requested_users)) {
      return NextResponse.json(
        { error: 'Datos inválidos' },
        { status: 400 }
      )
    }

    if (ds_request_type === 'create_family' && !ds_family_name) {
      return NextResponse.json(
        { error: 'El nombre de la familia es requerido' },
        { status: 400 }
      )
    }

    if (ds_request_type === 'join_family' && !id_family) {
      return NextResponse.json(
        { error: 'El ID de la familia es requerido' },
        { status: 400 }
      )
    }

    // Validar emails
    for (const userData of js_requested_users) {
      if (!userData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
        return NextResponse.json(
          { error: 'Uno o más emails no son válidos' },
          { status: 400 }
        )
      }
    }

    const familyRequest = await createFamilyRequest(supabase, {
      id_user: user.id,
      ds_request_type,
      ds_family_name: ds_family_name || null,
      id_family: id_family || null,
      js_requested_users,
      ds_comment: ds_comment || null,
    })

    return NextResponse.json({ success: true, request: familyRequest })
  } catch (error) {
    console.error('Error en family-requests:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

