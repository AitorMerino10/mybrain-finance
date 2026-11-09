'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isAppAdmin } from '@/lib/admin'
import { AppLogoSvg } from '@/lib/app-logo'

// Helper para detectar prefers-reduced-motion
const prefersReducedMotion = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const SIDEBAR_EMOJIS: Record<string, string> = {
  plus: '➕',
  chart: '📊',
  budget: '📖',
  places: '📍',
  settings: '⚙️',
}

interface NavigationProps {
  idFamily: string
  idUser: string
  userData: { ds_user: string | null; ds_email: string | null } | null
  families: Array<{ id_family: string; ds_family: string | null }>
  currentFamilyId: string
  /** Ya no se enseña el acceso a MyBrain; se mantiene para no tocar las páginas que lo pasan */
  showMyBrainLink?: boolean
}

export default function Navigation({
  idFamily,
  idUser,
  userData,
  families,
  currentFamilyId,
}: NavigationProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isFamilyMenuOpen, setIsFamilyMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const familyMenuRef = useRef<HTMLDivElement>(null)

  const navigationItems = [
    { name: 'Nueva Transacción', href: '/', icon: 'plus', isNewTransaction: true },
    { name: 'Analítica', href: '/analytics', icon: 'chart' },
    { name: 'Presupuestos', href: '/budgets', icon: 'budget' },
    { name: 'Mapa de gastos', href: '/places', icon: 'places' },
    { name: 'Configuración', href: '/settings', icon: 'settings' },
  ]

  // Verificar si el usuario es admin
  const isAdmin = isAppAdmin(idUser, userData?.ds_email || null)

  const isActive = (href: string) =>
    pathname === href || (href === '/budgets' && pathname.startsWith('/budgets/'))
  const isPlacesActive = pathname.startsWith('/places')
  // En móvil Presupuestos, Ayuda y Admin cuelgan del menú de Configuración
  const isConfigActive = ['/settings', '/budgets', '/help', '/admin'].some((path) => pathname === path || pathname.startsWith(`${path}/`))

  // Cerrar menús al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setIsProfileMenuOpen(false)
      }
      if (familyMenuRef.current && !familyMenuRef.current.contains(target)) {
        setIsFamilyMenuOpen(false)
      }
    }

    // Usar mousedown pero con un pequeño delay para que el click del botón se procese primero
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Detectar scroll para comprimir la franja superior en mobile
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // El estado real del menú vive en <html data-sidebar> (lo pone un script antes de pintar, sin parpadeo)
  useEffect(() => {
    setSidebarCollapsed(document.documentElement.dataset.sidebar === 'collapsed')
  }, [])

  const toggleSidebar = () => {
    const next = !(document.documentElement.dataset.sidebar === 'collapsed')
    if (next) document.documentElement.dataset.sidebar = 'collapsed'
    else delete document.documentElement.dataset.sidebar
    try {
      localStorage.setItem('mybrain:sidebar', next ? 'collapsed' : 'expanded')
    } catch {
      // sin almacenamiento: solo se pierde la preferencia
    }
    setSidebarCollapsed(next)
    setIsFamilyMenuOpen(false)
  }

  const handleFamilyChange = (newFamilyId: string) => {
    if (newFamilyId === currentFamilyId) {
      setIsFamilyMenuOpen(false)
      return
    }
    
    // Redirigir a la página actual con el nuevo idFamily
    const currentPath = pathname
    router.push(`${currentPath}?family=${newFamilyId}`)
    setIsFamilyMenuOpen(false)
  }

  return (
    <>
      {/* Desktop Navigation - Sidebar (se puede minimizar: solo emoticonos) */}
      <aside className="app-sidebar hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex lg:flex-col">
        <div className="sidebar-pad flex grow flex-col gap-y-5 overflow-y-auto overflow-x-hidden bg-slate-900 pb-4">
          <div className="sidebar-header flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-700">
            <Link
              href={`/${currentFamilyId ? `?family=${currentFamilyId}` : ''}`}
              className="sidebar-label flex items-center gap-3 transition-opacity hover:opacity-80"
              title="MyBrain finance"
            >
              <AppLogoSvg size={40} rounded idSuffix="-sidebar" />
              <span className="flex flex-col">
                <span className="text-2xl font-bold leading-7 text-white">MyBrain</span>
                <span className="text-xs leading-4 text-slate-400">finance</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={toggleSidebar}
              title={sidebarCollapsed ? 'Expandir menú' : 'Minimizar menú'}
              aria-label={sidebarCollapsed ? 'Expandir menú' : 'Minimizar menú'}
              className="sidebar-toggle flex h-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            >
              <span className="sidebar-mini flex" aria-hidden>
                <AppLogoSvg size={36} rounded idSuffix="-sidebar-mini" />
              </span>
              <span className="sidebar-label px-2 text-base" aria-hidden>
                «
              </span>
            </button>
          </div>
          <nav className="flex flex-1 flex-col">
            {/* Selector de familia en sidebar - solo escritorio */}
            <div className="sidebar-family mb-4 rounded-lg border border-slate-600/50 bg-slate-700/50 px-4 py-3">
              <div className="relative" ref={familyMenuRef}>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    // Con el menú minimizado, el selector de familia primero lo expande
                    if (sidebarCollapsed) {
                      toggleSidebar()
                      return
                    }
                    setIsFamilyMenuOpen(!isFamilyMenuOpen)
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  title={families.find((f) => f.id_family === currentFamilyId)?.ds_family || 'Familia'}
                  className="flex w-full items-center justify-between gap-2"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="sidebar-emoji shrink-0 text-base leading-none">👪</span>
                    <span className="sidebar-label truncate text-xs font-semibold text-[#90EBD6]">
                      {families.find(f => f.id_family === currentFamilyId)?.ds_family || 'Familia'}
                    </span>
                  </div>
                  <svg className="sidebar-label h-3 w-3 flex-shrink-0 text-[#90EBD6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isFamilyMenuOpen && !sidebarCollapsed && (
                  <div className="absolute left-0 right-0 z-50 mt-2 rounded-lg border border-gray-200 bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                    <div className="py-1">
                      {families.map((family) => (
                        <button
                          key={family.id_family}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleFamilyChange(family.id_family)
                            setIsFamilyMenuOpen(false)
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          className={`block w-full px-4 py-2 text-left text-sm transition-colors ${
                            family.id_family === currentFamilyId
                              ? 'bg-slate-600/50 font-semibold text-[#90EBD6]'
                              : 'text-slate-300 hover:bg-slate-600/30'
                          }`}
                        >
                          {family.ds_family || 'Sin nombre'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <ul role="list" className="flex flex-1 flex-col gap-y-1">
              {[
                { name: 'Inicio', href: `/${currentFamilyId ? `?family=${currentFamilyId}` : ''}`, emoji: '🏠', active: isActive('/') },
                ...navigationItems.map((item) => ({
                  name: item.name,
                  href:
                    item.href === '/' && item.isNewTransaction
                      ? `/?family=${currentFamilyId}&action=new-transaction`
                      : `${item.href}${currentFamilyId ? `?family=${currentFamilyId}` : ''}`,
                  emoji: SIDEBAR_EMOJIS[item.icon] ?? '•',
                  active:
                    (item.href === '/' && item.isNewTransaction && searchParams?.get('action') === 'new-transaction') ||
                    item.href !== '/' && isActive(item.href),
                })),
              ].map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    title={item.name}
                    className={`sidebar-item group flex gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6 transition-colors ${
                      item.active ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <span className="sidebar-emoji h-6 w-6 shrink-0 text-center text-lg leading-6" aria-hidden>
                      {item.emoji}
                    </span>
                    <span className="sidebar-label">{item.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>

      {/* Mobile Navigation - Bottom Bar: el fondo cubre también la zona segura de abajo (sin hueco) */}
      <div
        className="app-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/95 shadow-[0_-6px_20px_rgba(18,34,46,0.08)] backdrop-blur-md lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
          <Link
            href={`/analytics${currentFamilyId ? `?family=${currentFamilyId}` : ''}`}
            aria-current={isActive('/analytics') ? 'page' : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 touch-manipulation"
          >
            <span
              className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                isActive('/analytics') ? 'bg-slate-900 text-white' : 'text-slate-400'
              }`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </span>
            <span className={`text-[11px] font-semibold ${isActive('/analytics') ? 'text-slate-900' : 'text-slate-500'}`}>Analítica</span>
          </Link>
          <Link
            href={`/${currentFamilyId ? `?family=${currentFamilyId}&action=new-transaction` : '?action=new-transaction'}`}
            aria-label="Nueva transacción"
            className="flex flex-1 items-center justify-center touch-manipulation"
          >
            <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg ring-4 ring-white transition-transform active:scale-95">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </span>
          </Link>
          <Link
            href={`/settings${currentFamilyId ? `?family=${currentFamilyId}` : ''}`}
            aria-current={isConfigActive ? 'page' : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 touch-manipulation"
          >
            <span
              className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                isConfigActive ? 'bg-slate-900 text-white' : 'text-slate-400'
              }`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h7.125M10.5 12h7.125M10.5 18h7.125M6 6h.008v.008H6V6zm0 6h.008v.008H6V12zm0 6h.008v.008H6V18z" />
              </svg>
            </span>
            <span className={`text-[11px] font-semibold ${isConfigActive ? 'text-slate-900' : 'text-slate-500'}`}>Config</span>
          </Link>
        </div>
      </div>

      {/* Top Bar - Franja azul oscuro (solo mobile) */}
      <div 
        className={`lg:hidden sticky top-0 z-40 bg-slate-900 transition-all duration-300 ${
          isScrolled ? 'py-2' : 'py-3.5'
        } ${prefersReducedMotion() ? '' : 'transition-all duration-300'}`}
      >
        <div className="flex items-center justify-between px-4">
          {/* Logo: vuelve al inicio */}
          <Link
            href={`/${currentFamilyId ? `?family=${currentFamilyId}` : ''}`}
            className="flex flex-1 items-center gap-2.5 text-white"
            aria-label="MyBrain finance: ir al inicio"
          >
            {/* Sin esquinas ni borde: el logo comparte el azul de la franja y se ve todo seguido */}
            <AppLogoSvg size={40} idSuffix="-topbar" />
            <span className="text-lg font-bold leading-none">MyBrain</span>
          </Link>

          {/* Mapa de gastos (en móvil no hay otro acceso) */}
          <Link
            href={`/places${currentFamilyId ? `?family=${currentFamilyId}` : ''}`}
            className={`ml-2 flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              isPlacesActive ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            aria-label="Mapa de gastos"
            aria-current={isPlacesActive ? 'page' : undefined}
          >
            <span className="text-lg leading-none">🗺️</span>
          </Link>
          {/* Profile Button - Mobile */}
          <div className="relative ml-3" ref={profileMenuRef}>
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </button>
            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1">
                  {families.length > 1 && (
                    <div className="border-b border-gray-100 pb-1 mb-1">
                      <p className="px-4 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Familia</p>
                      {families.map((family) => (
                        <button
                          key={family.id_family}
                          onClick={() => {
                            handleFamilyChange(family.id_family)
                            setIsProfileMenuOpen(false)
                          }}
                          className={`block w-full px-4 py-2 text-left text-sm ${
                            family.id_family === currentFamilyId ? 'bg-slate-50 font-semibold text-slate-900' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          👪 {family.ds_family || 'Sin nombre'}
                        </button>
                      ))}
                    </div>
                  )}
                  <Link
                    href={`/profile${currentFamilyId ? `?family=${currentFamilyId}` : ''}`}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setIsProfileMenuOpen(false)}
                  >
                    Mi Perfil
                  </Link>
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut()
                      window.location.href = '/login'
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Bar - Desktop (mantener existente) */}
      <div className="hidden lg:sticky lg:top-0 lg:z-40 lg:flex lg:h-16 lg:shrink-0 lg:items-center lg:gap-x-4 lg:border-b lg:border-gray-200 lg:bg-white lg:px-4 lg:shadow-sm lg:px-6 lg:px-8">
        <div className="flex flex-1 items-center gap-x-4">
          {/* Family Selector - Desktop (ya está en sidebar, no necesario aquí) */}
        </div>

        {/* Admin Button - Desktop (solo para admin) */}
        {isAdmin && (
          <Link
            href={`/admin${currentFamilyId ? `?family=${currentFamilyId}` : ''}`}
            className={`flex items-center gap-x-2 rounded-full p-2 transition-colors ${
              isActive('/admin')
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1s.4-1 1-1h12c.6 0 1 .4 1 1z"/>
            </svg>
          </Link>
        )}
        <Link
          href={`/help${currentFamilyId ? `?family=${currentFamilyId}` : ''}`}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          aria-label="Ayuda"
        >
          <span className="font-bold">?</span>
        </Link>
        {/* Profile Button - Desktop */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center gap-x-2 rounded-full bg-slate-900 p-2 hover:bg-slate-800 transition-colors"
          >
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </button>
          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50">
              <div className="py-1">
                <Link
                  href={`/profile${currentFamilyId ? `?family=${currentFamilyId}` : ''}`}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setIsProfileMenuOpen(false)}
                >
                  Mi Perfil
                </Link>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut()
                    window.location.href = '/login'
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

