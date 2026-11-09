'use client'

import { useEffect, useState } from 'react'
import { AppLogoSvg } from '@/lib/app-logo'
import { SPLASH_SLOGAN, SPLASH_TITLE } from '@/lib/app-splash'

/**
 * Pantalla de presentación al abrir la app instalada en el móvil: en vez de blanco mientras carga se ve el logo y el lema.
 * Va en el HTML del servidor (se pinta antes que nada) y se desvanece cuando la app ya ha cargado.
 * El CSS (globals.css) la limita a móvil con la app instalada y la quita sola si algo fallara.
 */
export default function SplashScreen() {
  const [hiding, setHiding] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const startedAt = Date.now()
    let timer: ReturnType<typeof setTimeout>
    const hide = () => {
      // Se queda un momento mínimo para que no parpadee si carga muy rápido
      timer = setTimeout(() => setHiding(true), Math.max(0, 900 - (Date.now() - startedAt)))
    }
    if (document.readyState === 'complete') hide()
    else window.addEventListener('load', hide, { once: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('load', hide)
    }
  }, [])

  useEffect(() => {
    if (!hiding) return
    const timer = setTimeout(() => setGone(true), 500)
    return () => clearTimeout(timer)
  }, [hiding])

  if (gone) return null

  return (
    <div id="app-splash" data-hiding={hiding} aria-hidden="true">
      <div className="app-splash-logo">
        <AppLogoSvg size={140} idSuffix="-splash" />
      </div>
      <p className="app-splash-title">{SPLASH_TITLE}</p>
      <p className="app-splash-slogan">{SPLASH_SLOGAN}</p>
      <div className="app-splash-bar">
        <span />
      </div>
    </div>
  )
}
