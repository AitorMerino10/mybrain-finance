import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { formatCurrency } from '@/lib/format'
import { createAdminClient, isPushConfigured, sendPushToUser } from '@/lib/push'
import { cleanText, hashApiToken, parseAmount, parseCoordinate, parseDate } from '@/lib/pending-server'

export const dynamic = 'force-dynamic'

/**
 * Lo llama el atajo del móvil tras un pago: guarda el gasto como PENDIENTE (no afecta a ningún número)
 * y avisa con una notificación. Cabecera `Authorization: Bearer <clave personal>`.
 * Cuerpo (JSON o formulario): amount (obligatorio), merchant, card, date.
 */
export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ error: 'Falta la clave (cabecera Authorization: Bearer ...)' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Servidor sin configurar' }, { status: 500 })

  const { data: owner, error: tokenError } = await admin
    .from('pml_cfg_api_token')
    .select('id_user, id_family')
    .eq('ds_token_hash', hashApiToken(token))
    .maybeSingle()
  if (tokenError) {
    console.error('Error comprobando la clave del atajo:', tokenError.message)
    return NextResponse.json({ error: 'No se pudo comprobar la clave' }, { status: 500 })
  }
  if (!owner) return NextResponse.json({ error: 'Clave no válida' }, { status: 401 })

  let body: Record<string, unknown> = {}
  const contentType = req.headers.get('content-type') || ''
  try {
    if (contentType.includes('application/json')) {
      body = (await req.json()) as Record<string, unknown>
    } else {
      const form = await req.formData()
      form.forEach((value, key) => {
        body[key] = typeof value === 'string' ? value : ''
      })
    }
  } catch {
    return NextResponse.json({ error: 'Cuerpo no válido' }, { status: 400 })
  }

  const amount = parseAmount(body.amount)
  if (amount === null) return NextResponse.json({ error: 'Importe no válido' }, { status: 400 })
  const merchant = cleanText(body.merchant)
  const card = cleanText(body.card, 60)
  const date = parseDate(body.date)
  let latitude = parseCoordinate(body.latitude ?? body.lat, 90)
  let longitude = parseCoordinate(body.longitude ?? body.lng ?? body.lon, 180)
  if (latitude === null || longitude === null) {
    // Plan B: un solo campo "location" con "lat,lng" o un enlace de Mapas con las dos coordenadas
    const combined = typeof body.location === 'string' ? body.location.match(/(-?\d{1,3}[.,]\d+)\s*[,;\s]\s*(-?\d{1,3}[.,]\d+)/) : null
    if (combined) {
      latitude = parseCoordinate(combined[1], 90)
      longitude = parseCoordinate(combined[2], 180)
    }
  }
  const hasLocation = latitude !== null && longitude !== null

  // Algunos móviles lanzan la automatización dos veces: si llega lo mismo en 3 minutos, se ignora
  const since = new Date(Date.now() - 3 * 60 * 1000).toISOString()
  let duplicateQuery = admin
    .from('pml_pending_transaction')
    .select('id_pending_transaction')
    .eq('id_user', owner.id_user)
    .eq('id_family', owner.id_family)
    .eq('ft_amount', amount)
    .gte('dt_created', since)
  duplicateQuery = merchant ? duplicateQuery.eq('ds_merchant', merchant) : duplicateQuery.is('ds_merchant', null)
  const { data: duplicate } = await duplicateQuery.limit(1)
  if (duplicate && duplicate.length > 0) return NextResponse.json({ ok: true, duplicate: true })

  // Para depurar el atajo: se devuelve lo que ha llegado en los campos de ubicación
  const received = {
    latitude: String(body.latitude ?? '').slice(0, 40),
    longitude: String(body.longitude ?? '').slice(0, 40),
    keys: Object.keys(body),
  }

  const { data: created, error } = await admin
    .from('pml_pending_transaction')
    .insert({
      id_user: owner.id_user,
      id_family: owner.id_family,
      ft_amount: amount,
      ds_merchant: merchant,
      ds_card: card,
      dt_date: date,
      // Solo se envían si hay ubicación: así funciona también antes de ejecutar la migración
      ...(hasLocation ? { ft_latitude: latitude, ft_longitude: longitude } : {}),
    })
    .select('id_pending_transaction')
    .single()
  if (error || !created) {
    console.error('Error guardando el gasto pendiente:', error?.message)
    return NextResponse.json({ error: 'No se pudo guardar el gasto' }, { status: 500 })
  }

  await admin.from('pml_cfg_api_token').update({ dt_last_used: new Date().toISOString() }).eq('id_user', owner.id_user)

  let notified = 0
  if (isPushConfigured()) {
    notified = await sendPushToUser(admin, owner.id_user, {
      title: merchant ? `${formatCurrency(amount)} en ${merchant}` : `Nuevo gasto de ${formatCurrency(amount)}`,
      body: 'Toca para elegir la vertical y la partida.',
      url: `/?family=${owner.id_family}&pending=${created.id_pending_transaction}`,
      tag: `pending-${created.id_pending_transaction}`,
    })
  }

  return NextResponse.json({ ok: true, id: created.id_pending_transaction, notified: notified > 0, location: hasLocation, received })
}
