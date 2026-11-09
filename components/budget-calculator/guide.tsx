'use client'

import { useState, type ReactNode } from 'react'

/**
 * Cabecera de cada paso del asistente: dice en lenguaje llano qué se está haciendo, qué hay que hacer
 * y qué se consigue al terminar, para que nadie tenga que adivinarlo.
 */
export function StepIntro({
  step,
  total,
  title,
  what,
  todo,
  result,
  optional = false,
}: {
  step: number
  total: number
  title: string
  /** Qué estás haciendo en este paso */
  what: ReactNode
  /** Lo que tienes que hacer, en pocas líneas */
  todo?: ReactNode[]
  /** Qué tendrás al terminarlo */
  result?: ReactNode
  optional?: boolean
}) {
  const [open, setOpen] = useState(false)
  const hasMore = Boolean((todo && todo.length > 0) || result)
  return (
    <section className="rounded-2xl border border-teal-100 bg-[#90EBD6]/15 px-4 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0d9488]">
          {step}/{total}
        </span>
        <h2 className="text-base font-semibold tracking-tight text-gray-900">{title}</h2>
        {optional && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-gray-500 ring-1 ring-gray-200">Opcional</span>}
        {hasMore && (
          <button type="button" onClick={() => setOpen((value) => !value)} className="ml-auto text-xs font-medium text-[#0d9488] hover:underline">
            {open ? 'Ocultar ayuda' : '¿Cómo se hace?'}
          </button>
        )}
      </div>
      <p className="mt-0.5 text-sm text-gray-600">{what}</p>
      {open && (
        <div className="mt-2 border-t border-teal-100 pt-2">
          {todo && todo.length > 0 && (
            <ol className="list-decimal space-y-0.5 pl-5 text-sm text-gray-700">
              {todo.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ol>
          )}
          {result && <p className="mt-1.5 text-xs text-gray-500">{result}</p>}
        </div>
      )}
    </section>
  )
}

/** Bloque plegable: lo secundario (ayudas, detalles, cálculos) queda a un clic en vez de alargar la pantalla. */
export function Collapsible({
  title,
  subtitle,
  badge,
  defaultOpen = false,
  tone = 'help',
  children,
}: {
  title: string
  subtitle?: string
  badge?: string
  defaultOpen?: boolean
  /** help: ayuda opcional; section: parte normal del paso pero plegada */
  tone?: 'help' | 'section'
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={`overflow-hidden rounded-2xl border ${tone === 'help' ? 'border-dashed border-gray-300 bg-gray-50/50' : 'border-gray-100 bg-white shadow-sm'}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-white/70"
      >
        <span className="text-base" aria-hidden>
          {tone === 'help' ? '💡' : '▤'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-tight text-gray-900">{title}</span>
          {subtitle && <span className="block text-xs text-gray-500">{subtitle}</span>}
        </span>
        {badge && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200">{badge}</span>}
        <svg className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="space-y-4 border-t border-gray-100 bg-white p-3 sm:p-4">{children}</div>}
    </section>
  )
}
