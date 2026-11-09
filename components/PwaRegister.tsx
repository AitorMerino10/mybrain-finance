'use client'

import { useEffect } from 'react'

/** Registra el service worker (necesario para instalar la app y recibir notificaciones). */
export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('No se pudo registrar el service worker:', error))
  }, [])
  return null
}
