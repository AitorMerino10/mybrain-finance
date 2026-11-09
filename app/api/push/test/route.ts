import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient, isPushConfigured, sendPushToUser } from '@/lib/push'

/** Envía una notificación de prueba a los dispositivos de la persona que la pide. */
export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin || !isPushConfigured()) {
    return NextResponse.json({ error: 'Las notificaciones no están configuradas en el servidor (faltan las claves VAPID).' }, { status: 500 })
  }

  const delivered = await sendPushToUser(admin, user.id, {
    title: 'MyBrain finance',
    body: 'Las notificaciones funcionan correctamente 🎉',
    url: '/',
    tag: 'test',
  })
  if (delivered === 0) return NextResponse.json({ error: 'No hay ningún dispositivo suscrito.' }, { status: 404 })
  return NextResponse.json({ ok: true, delivered })
}
