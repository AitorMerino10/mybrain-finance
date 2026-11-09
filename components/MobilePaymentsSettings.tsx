'use client'

import { useCallback, useEffect, useState } from 'react'

type TokenInfo = { idFamily: string; createdAt: string; lastUsedAt: string | null } | null

function CopyButton({ value, label = 'Copiar' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          window.prompt('Copia el texto:', value)
        }
      }}
      className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
    >
      {copied ? '✓ Copiado' : label}
    </button>
  )
}

function formatWhen(iso: string | null) {
  if (!iso) return 'nunca'
  return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function MobilePaymentsSettings({ idFamily }: { idFamily: string }) {
  const [info, setInfo] = useState<TokenInfo>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [endpoint, setEndpoint] = useState('')

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/pending/token')
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'No se pudo cargar la clave')
      setInfo(json.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la clave (¿falta ejecutar la migración?)')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setEndpoint(`${window.location.origin}/api/pending`)
    void load()
  }, [load])

  const generate = async () => {
    if (info && !window.confirm('Se creará una clave nueva y la anterior dejará de funcionar: tendrás que cambiarla en el atajo. ¿Seguir?')) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/pending/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idFamily }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || `No se pudo crear la clave (error ${response.status})`)
      setNewToken(json.token)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la clave')
    } finally {
      setBusy(false)
    }
  }

  const revoke = async () => {
    if (!window.confirm('El atajo del móvil dejará de funcionar hasta que crees otra clave. ¿Borrarla?')) return
    setBusy(true)
    try {
      await fetch('/api/pending/token', { method: 'DELETE' })
      setNewToken(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const bearer = newToken ? `Bearer ${newToken}` : 'Bearer TU_CLAVE'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">📲 Pagos con el móvil</h2>
        <p className="text-sm text-gray-500">
          Cada vez que pagas con Apple Pay, el iPhone avisa a MyBrain: el gasto queda como <strong>pendiente</strong> (no cuenta en ningún número) y te llega una
          notificación para ponerle vertical y partida. Puedes borrar los pendientes que no quieras.
        </p>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <div className="rounded-xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-900">1. Tu clave personal</h3>
        {loading ? (
          <p className="mt-2 text-sm text-gray-500">Cargando…</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-gray-500">
              {info
                ? `Activa desde ${formatWhen(info.createdAt)} · último uso: ${formatWhen(info.lastUsedAt)}. Por seguridad no se puede volver a ver.`
                : 'Todavía no tienes clave. Créala y pégala en el atajo del móvil.'}
            </p>
            {newToken && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold text-emerald-900">Cópiala ahora: solo se muestra esta vez</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded bg-white px-2 py-1.5 text-xs text-gray-800">{newToken}</code>
                  <CopyButton value={newToken} />
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={generate} disabled={busy} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50">
                {info ? 'Crear una clave nueva' : 'Crear clave'}
              </button>
              {info && (
                <button onClick={revoke} disabled={busy} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  Borrar clave
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-900">2. Datos para el atajo</h3>
        <div className="mt-2 space-y-2 text-sm">
          <div>
            <p className="text-xs font-medium text-gray-500">Dirección (URL)</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-gray-50 px-2 py-1.5 text-xs text-gray-800">{endpoint}</code>
              <CopyButton value={endpoint} />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Encabezado «Authorization»</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-gray-50 px-2 py-1.5 text-xs text-gray-800">{bearer}</code>
              {newToken && <CopyButton value={bearer} />}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 p-4 text-sm text-gray-700">
        <h3 className="text-sm font-semibold text-gray-900">3. Crear la automatización en el iPhone (una sola vez)</h3>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>
            Abre la app <strong>Atajos</strong> → pestaña <strong>Automatización</strong> → <strong>+</strong> → <strong>Transacción</strong> (de la Cartera).
          </li>
          <li>
            Elige las tarjetas que quieres vigilar y marca <strong>Ejecutar inmediatamente</strong> (así no te pide confirmar cada vez). Siguiente.
          </li>
          <li>
            <strong>Crear atajo nuevo</strong>. Primero añade la acción <strong>Obtener ubicación actual</strong> (para guardar dónde pagas; la primera vez iOS te pedirá permiso:
            elige <strong>Permitir siempre</strong>). Después añade <strong>Obtener contenido de URL</strong>.
          </li>
          <li>
            URL: la de arriba. Pulsa <strong>Mostrar más</strong> y pon: Método <strong>POST</strong>; en Encabezados, <strong>Clave</strong> = <code>Authorization</code> y{' '}
            <strong>Texto</strong> = el valor de arriba (<code>Bearer …</code>); Cuerpo de la solicitud: <strong>JSON</strong>.
          </li>
          <li>
            Añade estos campos de tipo <strong>Texto</strong> (la <strong>Clave</strong> es el nombre y el <strong>Texto</strong> el valor): <code>amount</code>, <code>merchant</code>,{' '}
            <code>card</code>, <code>date</code>, <code>latitude</code> y <code>longitude</code>. En los cuatro primeros toca el valor, elige la variable{' '}
            <strong>Entrada del atajo</strong> y su propiedad: <strong>Importe</strong>, <strong>Comercio</strong>, <strong>Tarjeta o pase</strong> y <strong>Fecha</strong>. En{' '}
            <code>latitude</code> y <code>longitude</code> elige la variable <strong>Ubicación actual</strong> y su propiedad <strong>Latitud</strong> y <strong>Longitud</strong>. Si alguna
            no aparece, quítala: solo <code>amount</code> es obligatorio.
          </li>
          <li>Pulsa <strong>Ok</strong> para guardar la automatización.</li>
        </ol>
        <h4 className="mt-4 text-sm font-semibold text-gray-900">Para probarlo sin pagar</h4>
        <p className="mt-1">
          Crea un atajo normal con la misma acción, pero escribiendo a mano <code>amount</code> = <code>1,23</code> y <code>merchant</code> = <code>Prueba</code>. Ejecútalo con un
          toque: debería llegarte la notificación y aparecer el pendiente en Inicio. Después, haz un pago pequeño con Apple Pay para comprobar que el iPhone entrega bien el
          importe y el comercio.
        </p>
        <p className="mt-3 text-xs text-gray-500">
          Solo funciona con pagos hechos con el móvil o el reloj (Apple Pay), no con la tarjeta física. Si el banco manda un nombre de comercio raro, puedes cambiarlo al
          completar el gasto.
        </p>
      </div>
    </div>
  )
}
