'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function getBackHref(pathname: string) {
  if (pathname === '/mybrain') {
    return null
  }

  if (pathname === '/mybrain/diary' || pathname === '/mybrain/sections') {
    return '/mybrain'
  }

  if (pathname.startsWith('/mybrain/sections/')) {
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length >= 3) {
      const sectionId = parts[2]
      return parts.length === 3 ? '/mybrain/sections' : `/mybrain/sections/${sectionId}`
    }
  }

  return '/mybrain'
}

export default function MyBrainBackButton() {
  const pathname = usePathname()
  const href = getBackHref(pathname)

  if (!href) {
    return null
  }

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition-colors hover:text-white"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
      </svg>
      Back
    </Link>
  )
}
