import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient, isPushConfigured } from '@/lib/push'
import { processAlerts } from '@/lib/push-alerts'

/** Se llama tras guardar un gasto: avisa si alguna partida de la familia ha llegado a su límite. */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { idFamily } = (await req.json().catch(() => ({}))) as { idFamily?: string }
  if (!idFamily) return NextResponse.json({ error: 'idFamily requerido' }, { status: 400 })

  const { data: member } = await supabase
    .from('pml_rel_user_family')
    .select('id_user')
    .eq('id_user', user.id)
    .eq('id_family', idFamily)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Sin acceso a la familia' }, { status: 403 })

  const admin = createAdminClient()
  if (!admin || !isPushConfigured()) return NextResponse.json({ ok: true, sent: 0 })

  try {
    const sent = await processAlerts(admin, { idFamily })
    return NextResponse.json({ ok: true, sent })
  } catch (error) {
    console.error('Error comprobando avisos:', error)
    return NextResponse.json({ ok: true, sent: 0 })
  }
}
