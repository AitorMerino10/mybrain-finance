'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MyBrainSectionCard } from '@/types/mybrain'
import { useMyBrainOverlayLock } from './MyBrainOverlayContext'

interface NewEntryModalProps {
  sections: MyBrainSectionCard[]
  triggerClassName?: string
  triggerLabel?: string
  triggerContent?: React.ReactNode
}

export default function NewEntryModal({
  sections,
  triggerClassName,
  triggerLabel = 'Nueva entrada',
  triggerContent,
}: NewEntryModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const personalSections = sections.filter((section) => !section.isSystemSection)

  useMyBrainOverlayLock(open)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ||
          'inline-flex items-center justify-center rounded-full bg-white/14 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(15,23,42,0.22)] backdrop-blur-sm transition-colors hover:bg-white/20'
        }
      >
        {triggerContent || triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] bg-slate-950/60 px-4">
          <div className="flex min-h-full items-end justify-center py-4 sm:items-center">
            <div
              className="w-full max-w-lg rounded-[28px] border border-white/60 bg-white p-5 shadow-2xl sm:p-6"
              style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0d9488]">
                    Nueva entrada
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-900">
                    Elige primero la sección
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Cerrar"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {personalSections.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                  Antes de crear una entrada necesitas al menos una sección personal.
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {personalSections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        router.push(`/mybrain/sections/${section.id}/new`)
                      }}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-lg text-slate-900"
                        >
                          {section.logo || section.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{section.name}</p>
                          <p className="text-sm text-slate-500">{section.entryCount} entradas</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-slate-500">Abrir</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
