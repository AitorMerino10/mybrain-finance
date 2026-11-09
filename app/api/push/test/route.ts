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

  try {
    const delivered = await sendPushToUser(admin, user.id, {
      title: 'Notificaciones activadas 🎉',
      body: 'Todo listo: te avisaré de tus gastos y presupuestos.',
      url: '/',
      tag: 'test',
    })
    if (delivered === 0) {
      return NextResponse.json({ error: 'No se pudo entregar la notificación (no hay dispositivo guardado o el envío falló; mira los logs del servidor).' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, delivered })
  } catch (error) {
    console.error('Error en la prueba de push:', error)
    return NextResponse.json({ error: `Error del servidor: ${error instanceof Error ? error.message : 'desconocido'}` }, { status: 500 })
  }
}
