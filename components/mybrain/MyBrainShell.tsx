'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { MyBrainSectionCard } from '@/types/mybrain'
import CreateSectionModal from './CreateSectionModal'
import MyBrainBackButton from './MyBrainBackButton'
import {
  MyBrainOverlayProvider,
  useMyBrainOverlayCount,
} from './MyBrainOverlayContext'

interface MyBrainShellProps {
  userId: string
  userName: string
  sections: MyBrainSectionCard[]
  children: React.ReactNode
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function MyBrainRouteTransitionOverlay() {
  const pathname = usePathname()
  const startPathRef = useRef<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const [origin, setOrigin] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleStart = (event: Event) => {
      const detail = (event as CustomEvent<{ x?: number; y?: number }>).detail
      startPathRef.current = pathname
      setOrigin({
        x: typeof detail?.x === 'number' ? detail.x : window.innerWidth / 2,
        y: typeof detail?.y === 'number' ? detail.y : window.innerHeight / 2,
      })
      setExpanded(false)
      setFadingOut(false)
      setVisible(true)
      requestAnimationFrame(() => {
        setExpanded(true)
      })
    }

    window.addEventListener('mybrain:route-transition-start', handleStart)
    return () => {
      window.removeEventListener('mybrain:route-transition-start', handleStart)
    }
  }, [pathname])

  useEffect(() => {
    if (!visible) return
    if (startPathRef.current === pathname) return

    const frame = requestAnimationFrame(() => {
      setFadingOut(true)
    })
    const timer = setTimeout(() => {
      setVisible(false)
      setExpanded(false)
      setFadingOut(false)
      startPathRef.current = null
    }, 940)

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [pathname, visible])

  if (!visible) return null

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-[79] bg-[#1A2847] transition-opacity duration-500 ease-out"
        style={{ opacity: fadingOut ? 0 : expanded ? 0.92 : 0 }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-[80] transition-[clip-path,opacity] duration-[1300ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          background: `radial-gradient(circle at ${origin.x}px ${origin.y}px, rgba(248,250,252,0.9) 0%, rgba(226,232,240,0.64) 26%, rgba(118,139,172,0.32) 56%, rgba(26,40,71,0) 100%)`,
          clipPath: expanded
            ? `circle(160vmax at ${origin.x}px ${origin.y}px)`
            : `circle(0vmax at ${origin.x}px ${origin.y}px)`,
          opacity: fadingOut ? 0 : 1,
          transitionDuration: fadingOut ? '900ms' : '1300ms',
        }}
      />
    </>
  )
}

function MyBrainShellInner({ userId, userName, sections, children }: MyBrainShellProps) {
  const pathname = usePathname()
  const overlayCount = useMyBrainOverlayCount()
  const hideBottomNav = overlayCount > 0

  const navItems = [
    { href: '/mybrain', label: 'Inicio' },
    { href: '/mybrain/diary', label: 'Diario' },
    { href: '/mybrain/sections', label: 'Secciones' },
  ]

  const isHome = pathname === '/mybrain'

  return (
    <div className="min-h-screen bg-[#1A2847]">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-white/10 bg-[#263856] px-6 pb-6">
          <div className="flex h-20 shrink-0 items-center border-b border-white/10">
            <Link href="/mybrain" className="flex items-center gap-3 transition-opacity hover:opacity-85">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-sm">
                <span className="text-2xl leading-none">🧠</span>
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold text-white">MyBrain</h1>
                <p className="truncate text-xs text-white/60">Memory, upgraded</p>
              </div>
            </Link>
          </div>

          <div className="grid gap-2">
            <Link
              href="/mybrain/capture"
              className="flex w-full items-center justify-center rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm font-semibold text-white/85 transition-colors hover:bg-white/12 hover:text-white"
            >
              Guardar con IA
            </Link>
            <CreateSectionModal
              userId={userId}
              triggerClassName="flex w-full items-center justify-center rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm font-semibold text-white/85 transition-colors hover:bg-white/12 hover:text-white"
              triggerLabel="Crear sección"
            />
          </div>

          <nav className="flex flex-1 flex-col">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const active = isActive(pathname, item.href)

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                        active
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-white/75 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                          active ? 'bg-slate-900/10' : 'bg-white/10'
                        }`}
                      >
                        {item.label === 'Inicio' ? '🧠' : item.label === 'Diario' ? '📖' : '📚'}
                      </span>
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>

            <div className="mt-auto border-t border-white/10 pt-4">
              <Link
                href="/"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm">
                  💵
                </span>
                Abrir Finance
              </Link>
            </div>
          </nav>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[linear-gradient(180deg,rgba(9,16,30,0.9)_0%,rgba(26,40,71,0.82)_100%)] text-white backdrop-blur-sm lg:hidden">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="mb-2 sm:mb-3">
            <MyBrainBackButton />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Link href="/mybrain" className="block">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:h-11 sm:w-11">
                    <span className="text-xl leading-none sm:text-2xl">🧠</span>
                  </div>
                  <div className="min-w-0">
                    <h1 className="truncate text-lg font-bold sm:text-2xl">MyBrain</h1>
                    <p className="truncate text-xs text-[#90EBD6]/90 sm:text-sm">
                      Memory, upgraded
                    </p>
                  </div>
                </div>
              </Link>
            </div>

            <div className="hidden items-center gap-2 md:flex lg:hidden">
              <Link
                href="/mybrain/capture"
                className="inline-flex items-center justify-center rounded-2xl border border-[#90EBD6]/30 bg-[#90EBD6]/15 px-4 py-2 text-sm font-semibold text-[#D9FFF5] transition-colors hover:bg-[#90EBD6]/20"
              >
                Guardar con IA
              </Link>
              <CreateSectionModal
                userId={userId}
                triggerClassName="inline-flex items-center justify-center rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                triggerLabel="Crear sección"
              />
              {navItems.map((item) => {
                const active = isActive(pathname, item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-white text-slate-900'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
              <Link
                href="/"
                className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white"
              >
                Abrir Finance
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div
        className={`mx-auto max-w-6xl lg:ml-72 ${
          isHome
            ? 'px-0 pt-0 pb-24 sm:px-0 lg:px-0 lg:pb-0'
            : 'px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-24'
        }`}
      >
        {children}
      </div>

      <MyBrainRouteTransitionOverlay />

      <div
        className={`fixed inset-x-0 bottom-0 z-40 transition-opacity duration-200 lg:hidden ${
          hideBottomNav ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-hidden={hideBottomNav}
      >
        <div className="bg-[#EAF1F6] backdrop-blur-sm border-t border-gray-200/50 shadow-lg">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-around px-1">
          <Link
            href="/mybrain/diary"
            className={`flex min-w-0 flex-1 flex-col items-center justify-center py-1 transition-colors ${
              isActive(pathname, '/mybrain/diary')
                ? 'text-slate-700'
                : 'text-slate-500'
            }`}
          >
            <span className="mb-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900">
              <svg
                className="h-[18px] w-[18px] text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.75c-1.55-1.1-3.45-1.75-5.5-1.75-.78 0-1.52.09-2.23.27A1 1 0 003.5 6.24v11.4c0 .66.62 1.14 1.25.96.56-.16 1.15-.24 1.75-.24 2.05 0 3.95.65 5.5 1.75m0-13.36c1.55-1.1 3.45-1.75 5.5-1.75.78 0 1.52.09 2.23.27.45.12.77.52.77.97v11.4c0 .66-.62 1.14-1.25.96a6.4 6.4 0 00-1.75-.24c-2.05 0-3.95.65-5.5 1.75m0-13.36v13.36"
                />
              </svg>
            </span>
            <span className={`text-[10px] font-bold ${isActive(pathname, '/mybrain/diary') ? 'text-slate-700' : 'text-slate-600'}`}>
              Diario
            </span>
          </Link>
          <Link
            href="/mybrain/capture"
            className="flex min-w-0 flex-1 flex-col items-center justify-center py-1"
          >
              <>
                <div className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-b from-slate-900 to-slate-800 shadow-lg">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <span className="text-[10px] font-medium text-gray-600">New</span>
              </>
          </Link>
          <Link
            href="/mybrain/sections"
            className={`flex min-w-0 flex-1 flex-col items-center justify-center py-1 transition-colors ${
              isActive(pathname, '/mybrain/sections')
                ? 'text-slate-700'
                : 'text-slate-500'
            }`}
          >
            <span className="mb-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900">
              <svg
                className="h-[18px] w-[18px] text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.25 4.75h4.5c.83 0 1.5.67 1.5 1.5v12.5h-6c-.83 0-1.5-.67-1.5-1.5v-11c0-.83.67-1.5 1.5-1.5zM11.25 6.25h4.5c.83 0 1.5.67 1.5 1.5v11h-6V6.25zM17.25 8.25h1.5c.83 0 1.5.67 1.5 1.5v7.5c0 .83-.67 1.5-1.5 1.5h-1.5V8.25zM6.25 8h2.5M12.25 9h2.5M18 11h1"
                />
              </svg>
            </span>
            <span className={`text-[10px] font-bold ${isActive(pathname, '/mybrain/sections') ? 'text-slate-700' : 'text-slate-600'}`}>
              Secciones
            </span>
          </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MyBrainShell(props: MyBrainShellProps) {
  return (
    <MyBrainOverlayProvider>
      <MyBrainShellInner {...props} />
    </MyBrainOverlayProvider>
  )
}
