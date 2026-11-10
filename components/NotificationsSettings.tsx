'use client'

import { useCallback, useEffect, useState } from 'react'

type Prefs = {
  dailyReminder: boolean
  budgetAlerts: boolean
  goalAlerts: boolean
  warnPercent: number
  closeAlerts: boolean
  pendingAlerts: boolean
  forecastAlerts: boolean
  recurringAlerts: boolean
  dailyHour: number
  pendingHour: number
  closeHour: number
  recurringHour: number
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(Array.from(raw).map((char) => char.charCodeAt(0)))
}

type Status = 'loading' | 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on'

function HourSelect({ value, onChange, label }: { value: number; onChange: (hour: number) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 pb-2.5 text-xs text-gray-600">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-900"
      >
        {Array.from({ length: 24 }, (_, hour) => (
          <option key={hour} value={hour}>
            {String(hour).padStart(2, '0')}:00
          </option>
        ))}
      </select>
      <span className="text-gray-400">(hora de Madrid)</span>
    </label>
  )
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: React.ReactNode }) {
  return (
    <label className="flex items-start justify-between gap-4 py-2.5 cursor-pointer">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {hint && <span className="block text-xs text-gray-500 mt-0.5">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-teal-500' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  )
}

export default function NotificationsSettings() {
  const [status, setStatus] = useState<Status>('loading')
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [isIos, setIsIos] = useState(false)

  const refreshStatus = useCallback(async () => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIos(ios)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    if (!supported) {
      // En iPhone, las notificaciones solo existen con la app añadida a la pantalla de inicio
      setStatus(ios && !standalone ? 'needs-install' : 'unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('blocked')
      return
    }
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setStatus(subscription && Notification.permission === 'granted' ? 'on' : 'off')
    } catch {
      setStatus('off')
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
    fetch('/api/push/prefs')
      .then((response) => response.json())
      .then((json) => json.prefs && setPrefs(json.prefs))
      .catch(() => undefined)
  }, [refreshStatus])

  const enable = async () => {
    setMessage(null)
    if (!VAPID_PUBLIC_KEY) {
      setMessage({ type: 'error', text: 'Falta configurar las claves de notificaciones en el servidor.' })
      return
    }
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'blocked' : 'off')
        return
      }
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }))
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })
      if (!response.ok) {
        const json = await response.json().catch(() => ({}))
        throw new Error(json.error || `No se pudo guardar el dispositivo (error ${response.status})`)
      }
      setStatus('on')
      setMessage({ type: 'ok', text: 'Notificaciones activadas en este dispositivo.' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'No se pudieron activar las notificaciones' })
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
      setStatus('off')
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'No se pudieron desactivar' })
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch('/api/push/test', { method: 'POST' })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || `No se pudo enviar la prueba (error ${response.status})`)
      setMessage({ type: 'ok', text: 'Prueba enviada: debería llegarte en unos segundos.' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'No se pudo enviar la prueba' })
    } finally {
      setBusy(false)
    }
  }

  const updatePrefs = (patch: Partial<Prefs>) => {
    if (!prefs) return
    const next = { ...prefs, ...patch }
    setPrefs(next)
    fetch('/api/push/prefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefs: next }) }).catch(() => undefined)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">🔔 Notificaciones</h2>
          <p className="text-sm text-gray-500">Avisos en este dispositivo. Cada persona activa los suyos.</p>
        </div>
        {status === 'off' && (
          <button onClick={enable} disabled={busy} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50">
            Activar en este dispositivo
          </button>
        )}
        {status === 'on' && (
          <div className="flex gap-2">
            <button onClick={sendTest} disabled={busy} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Enviar prueba
            </button>
            <button onClick={disable} disabled={busy} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Desactivar
            </button>
          </div>
        )}
      </div>

      {status === 'needs-install' && (
        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          <p className="font-medium">Primero añade la app a tu pantalla de inicio</p>
          <ol className="mt-1 list-decimal pl-5 space-y-0.5">
            <li>
              En Safari pulsa <strong>Compartir</strong> (el cuadrado con la flecha).
            </li>
            <li>
              Elige <strong>Añadir a pantalla de inicio</strong>.
            </li>
            <li>Abre MyBrain desde el nuevo icono y vuelve aquí para activar los avisos.</li>
          </ol>
        </div>
      )}
      {status === 'unsupported' && (
        <p className="mt-3 rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm text-gray-600">
          Este navegador no admite notificaciones{isIos ? ' (necesitas iOS 16.4 o superior)' : ''}.
        </p>
      )}
      {status === 'blocked' && (
        <p className="mt-3 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          Las notificaciones están bloqueadas. Actívalas en los ajustes del dispositivo (en iPhone: Ajustes → Notificaciones → MyBrain) y recarga.
        </p>
      )}
      {message && (
        <p className={`mt-3 rounded-xl border p-3 text-sm ${message.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {message.text}
        </p>
      )}

      {prefs && (
        <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100 px-4">
          <Toggle
            label="Recordatorio diario de gastos"
            checked={prefs.dailyReminder}
            onChange={(value) => updatePrefs({ dailyReminder: value })}
            hint="Todos los días, para que metas los gastos de hoy."
          />
          {prefs.dailyReminder && <HourSelect label="Enviar a las" value={prefs.dailyHour} onChange={(hour) => updatePrefs({ dailyHour: hour })} />}
          <Toggle
            label="Gastos pendientes sin completar"
            checked={prefs.pendingAlerts}
            onChange={(value) => updatePrefs({ pendingAlerts: value })}
            hint="Todos los días, solo si tienes gastos pendientes (pagos con el móvil o recurrentes) sin completar."
          />
          {prefs.pendingAlerts && <HourSelect label="Enviar a las" value={prefs.pendingHour} onChange={(hour) => updatePrefs({ pendingHour: hour })} />}
          <Toggle
            label="Cobros recurrentes"
            checked={prefs.recurringAlerts}
            onChange={(value) => updatePrefs({ recurringAlerts: value })}
            hint="El día que toca un gasto recurrente (suscripción, alquiler…) se crea como pendiente y te avisamos para que lo completes."
          />
          {prefs.recurringAlerts && <HourSelect label="Crear y avisar a partir de las" value={prefs.recurringHour} onChange={(hour) => updatePrefs({ recurringHour: hour })} />}
          <Toggle
            label="Previsión de fin de mes"
            checked={prefs.forecastAlerts}
            onChange={(value) => updatePrefs({ forecastAlerts: value })}
            hint="Si a este ritmo vas a pasarte del presupuesto del mes (una vez al mes, a partir del día 7)."
          />
          <Toggle
            label="Presupuesto mensual al límite"
            checked={prefs.budgetAlerts}
            onChange={(value) => updatePrefs({ budgetAlerts: value })}
            hint="Al guardar un gasto, si llevas más del porcentaje elegido de tu presupuesto del mes (y de nuevo al pasarte del 100 %)."
          />
          <Toggle
            label="Controles de gasto al límite"
            checked={prefs.goalAlerts}
            onChange={(value) => updatePrefs({ goalAlerts: value })}
            hint="Lo mismo, pero para cada control de gasto que tengas creado."
          />
          <Toggle
            label="Cierre de mes"
            checked={prefs.closeAlerts}
            onChange={(value) => updatePrefs({ closeAlerts: value })}
            hint="El día 1 de cada mes, para cerrar el anterior y ver qué tal ha ido."
          />
          {prefs.closeAlerts && <HourSelect label="Enviar a partir de las" value={prefs.closeHour} onChange={(hour) => updatePrefs({ closeHour: hour })} />}
          <div className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-sm font-medium text-gray-900">Avisarme al llegar al</span>
            <select
              value={prefs.warnPercent}
              onChange={(event) => updatePrefs({ warnPercent: Number(event.target.value) })}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm"
            >
              {[50, 60, 70, 80, 90].map((value) => (
                <option key={value} value={value}>
                  {value} %
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
