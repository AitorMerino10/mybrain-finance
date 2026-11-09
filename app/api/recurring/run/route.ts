import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/push'
import { generateRecurringPending } from '@/lib/recurring-server'

export const dynamic = 'force-dynamic'

/** Crea ya los pendientes de los gastos recurrentes de la familia que toca cobrar hoy (sin avisar: la persona está en la app). */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { idFamily } = (await req.json().catch(() => ({}))) as { idFamily?: string }
  if (!idFamily) return NextResponse.json({ error: 'Falta la familia' }, { status: 400 })

  const { data: membership } = await supabase
    .from('pml_rel_user_family')
    .select('id_user')
    .eq('id_family', idFamily)
    .eq('id_user', user.id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Sin acceso a la familia' }, { status: 403 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Servidor sin configurar' }, { status: 500 })

  const result = await generateRecurringPending(admin, { idFamily, notify: false })
  return NextResponse.json({ ok: true, ...result })
}
