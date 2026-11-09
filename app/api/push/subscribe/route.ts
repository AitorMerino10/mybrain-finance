import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type SubscriptionBody = {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
}

/** Guarda el dispositivo de la persona para poder enviarle notificaciones. */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = (await req.json()) as { subscription?: SubscriptionBody }
  const subscription = body.subscription
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) {
    return NextResponse.json({ error: 'Suscripción no válida' }, { status: 400 })
  }

  const { error } = await supabase.from('pml_cfg_push_subscription').upsert(
    {
      id_user: user.id,
      ds_endpoint: subscription.endpoint,
      ds_p256dh: subscription.keys.p256dh,
      ds_auth: subscription.keys.auth,
      ds_user_agent: req.headers.get('user-agent'),
    },
    { onConflict: 'ds_endpoint' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** Quita el dispositivo (o todos si no se indica endpoint). */
export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { endpoint?: string }
  let query = supabase.from('pml_cfg_push_subscription').delete().eq('id_user', user.id)
  if (body.endpoint) query = query.eq('ds_endpoint', body.endpoint)
  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
