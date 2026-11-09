import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { generateApiToken, hashApiToken } from '@/lib/pending-server'

/** Estado de la clave personal del atajo (nunca devuelve la clave, solo si existe y cuándo se usó). */
export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase.from('pml_cfg_api_token').select('id_family, dt_created, dt_last_used').eq('id_user', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ token: data ? { idFamily: data.id_family, createdAt: data.dt_created, lastUsedAt: data.dt_last_used } : null })
}

/** Crea (o regenera) la clave. Se devuelve una sola vez: en la base de datos solo queda su hash. */
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

  const token = generateApiToken()
  const { error } = await supabase
    .from('pml_cfg_api_token')
    .upsert({ id_user: user.id, id_family: idFamily, ds_token_hash: hashApiToken(token), dt_created: new Date().toISOString(), dt_last_used: null })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ token })
}

export async function DELETE() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { error } = await supabase.from('pml_cfg_api_token').delete().eq('id_user', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
