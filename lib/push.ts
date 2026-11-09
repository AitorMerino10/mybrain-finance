import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import type { Database } from '@/types/supabase'

export type PushPayload = {
  title: string
  body: string
  /** Ruta que se abre al pulsar la notificación */
  url?: string
  /** Mensajes con la misma etiqueta se sustituyen entre sí en vez de apilarse */
  tag?: string
}

export type AdminClient = SupabaseClient<Database>

/** Cliente con permisos de servidor (service role). Solo para rutas API. */
export function createAdminClient(): AdminClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

let vapidConfigured = false

export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

function configureVapid() {
  if (vapidConfigured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  )
  vapidConfigured = true
}

/** Envía una notificación a todos los dispositivos de una persona. Devuelve cuántos la recibieron. */
export async function sendPushToUser(admin: AdminClient, idUser: string, payload: PushPayload): Promise<number> {
  if (!isPushConfigured()) return 0
  configureVapid()

  const { data: subscriptions } = await admin.from('pml_cfg_push_subscription').select('*').eq('id_user', idUser)
  if (!subscriptions || subscriptions.length === 0) return 0

  let delivered = 0
  const body = JSON.stringify(payload)

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.ds_endpoint, keys: { p256dh: subscription.ds_p256dh, auth: subscription.ds_auth } },
          body,
          { TTL: 60 * 60 * 12 }
        )
        delivered += 1
        await admin
          .from('pml_cfg_push_subscription')
          .update({ dt_last_used: new Date().toISOString() })
          .eq('id_push_subscription', subscription.id_push_subscription)
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        // 404/410: el dispositivo ya no existe (app desinstalada o permiso retirado)
        if (status === 404 || status === 410) {
          await admin.from('pml_cfg_push_subscription').delete().eq('id_push_subscription', subscription.id_push_subscription)
        } else {
          console.error('Error enviando push:', status, (error as Error).message)
        }
      }
    })
  )

  return delivered
}
