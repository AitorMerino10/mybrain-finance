'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Helper para detectar prefers-reduced-motion
const prefersReducedMotion = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface NavigationProps {
  idFamily: string
  idUser: string
  userData: { ds_user: string | null; ds_email: string | null } | null
  families: Array<{ id_family: string; ds_family: string | null }>
  currentFamilyId: string
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
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const familyMenuRef = useRef<HTMLDivElement>(null)

  const navigationItems = [
    { name: 'Nueva Transacción', href: '/', icon: 'plus', isNewTransaction: true },
    { name: 'Analítica', href: '/analytics', icon: 'chart' },
    { name: 'Configuración', href: '/settings', icon: 'settings' },
  ]

  const isActive = (href: string) => pathname === href

  // Cerrar menús al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false)
      }
      if (familyMenuRef.current && !familyMenuRef.current.contains(event.target as Node)) {
        setIsFamilyMenuOpen(false)
      }
    }

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
      {/* Desktop Navigation - Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-gradient-to-b from-slate-900 to-slate-800 px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center border-b border-slate-700">
            <Link href={`/${currentFamilyId ? `?family=${currentFamilyId}` : ''}`} className="flex flex-col hover:opacity-80 transition-opacity">
              <h1 className="text-2xl font-bold text-white">MyBrain</h1>
              <p className="text-xs text-slate-400">finance</p>
            </Link>
          </div>
          <nav className="flex flex-1 flex-col">
            {/* Selector de familia en sidebar - solo escritorio */}
            <div className="px-4 py-3 mb-4 bg-slate-700/50 border border-slate-600/50 rounded-lg">
              <div className="relative" ref={familyMenuRef}>
                <button
                  onClick={() => setIsFamilyMenuOpen(!isFamilyMenuOpen)}
                  className="w-full flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <svg className="h-4 w-4 text-[#90EBD6] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                    <span className="text-xs font-semibold text-[#90EBD6] truncate">
                      {families.find(f => f.id_family === currentFamilyId)?.ds_family || 'Familia'}
                    </span>
                  </div>
                  <svg className="h-3 w-3 text-[#90EBD6] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isFamilyMenuOpen && (
                  <div className="absolute left-0 right-0 mt-2 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50 border border-gray-200">
                    <div className="py-1">
                      {families.map((family) => (
                        <button
                          key={family.id_family}
                          onClick={() => handleFamilyChange(family.id_family)}
                          className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                            family.id_family === currentFamilyId
                              ? 'bg-slate-600/50 text-[#90EBD6] font-semibold'
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
              <li>
                <Link
                  href={`/${currentFamilyId ? `?family=${currentFamilyId}` : ''}`}
                  className={`group flex gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6 transition-colors ${
                    isActive('/')
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                  </svg>
                  Inicio
                </Link>
              </li>
              {navigationItems.map((item) => (
                <li key={item.name}>
                  <Link
                    href={`${item.href === '/' && item.isNewTransaction ? `/?family=${currentFamilyId}&action=new-transaction` : `${item.href}${currentFamilyId ? `?family=${currentFamilyId}` : ''}`}`}
                    className={`group flex gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6 transition-colors ${
                      (item.href === '/' && item.isNewTransaction && searchParams?.action === 'new-transaction') || (item.href !== '/' && isActive(item.href))
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {item.icon === 'plus' && (
                      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    )}
                    {item.icon === 'chart' && (
                      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                      </svg>
                    )}
                    {item.icon === 'settings' && (
                      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>

      {/* Mobile Navigation - Bottom Bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="bg-[#EAF1F6] backdrop-blur-sm border-t border-gray-200/50 shadow-lg">
          <div className="flex h-14 items-center justify-around px-1">
            <Link
              href={`/analytics${currentFamilyId ? `?family=${currentFamilyId}` : ''}`}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                isActive('/analytics') ? 'text-slate-700' : 'text-slate-500'
              }`}
            >
              <svg className="h-5 w-5 mb-0.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <span className={`text-[10px] font-bold ${isActive('/analytics') ? 'text-slate-700' : 'text-slate-600'}`}>Analítica</span>
            </Link>
            <Link
              href={`/${currentFamilyId ? `?family=${currentFamilyId}&action=new-transaction` : '?action=new-transaction'}`}
              className="flex flex-col items-center justify-center flex-1 py-1"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center shadow-lg mb-0.5">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <span className="text-[10px] font-medium text-gray-600"></span>
            </Link>
            <Link
              href={`/settings${currentFamilyId ? `?family=${currentFamilyId}` : ''}`}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                isActive('/settings') ? 'text-slate-700' : 'text-slate-500'
              }`}
            >
              <svg className="h-5 w-5 mb-0.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className={`text-[10px] font-bold ${isActive('/settings') ? 'text-slate-700' : 'text-slate-600'}`}>Config</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Top Bar - Franja azul oscuro (solo mobile) */}
      <div 
        className={`lg:hidden sticky top-0 z-40 bg-[#071A2B] transition-all duration-300 ${
          isScrolled ? 'py-2' : 'py-4'
        } ${prefersReducedMotion() ? '' : 'transition-all duration-300'}`}
      >
        <div className="flex items-center justify-between px-4">
          {/* Family Selector - Mobile */}
          <div className="relative flex-1" ref={familyMenuRef}>
            <button
              onClick={() => setIsFamilyMenuOpen(!isFamilyMenuOpen)}
              className="flex items-center gap-2 text-white/90 hover:text-white transition-colors"
            >
              <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              <span className="text-sm font-medium truncate max-w-[140px]">
                {families.find(f => f.id_family === currentFamilyId)?.ds_family || 'Familia'}
              </span>
              <svg
                className="h-3 w-3 text-white/70 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isFamilyMenuOpen && (
              <div className="absolute left-0 mt-2 w-56 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1">
                  {families.map((family) => (
                    <button
                      key={family.id_family}
                      onClick={() => handleFamilyChange(family.id_family)}
                      className={`block w-full text-left px-4 py-2 text-sm ${
                        family.id_family === currentFamilyId
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {family.ds_family || 'Sin nombre'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

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

        {/* Profile Button - Desktop */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center gap-x-2 rounded-full bg-slate-800/80 p-2 hover:bg-slate-800 transition-colors"
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

