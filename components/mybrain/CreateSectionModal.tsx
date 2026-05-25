'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { createSection } from '@/lib/mybrain/sections'
import {
  MYBRAIN_FIELD_TYPES,
  MYBRAIN_SECTION_ICON_OPTIONS,
  type MyBrainBrainRegion,
  type MyBrainFieldType,
} from '@/types/mybrain'
import { useMyBrainOverlayLock } from './MyBrainOverlayContext'

interface CreateSectionModalProps {
  userId: string
  triggerClassName?: string
  triggerLabel?: string
  triggerContent?: React.ReactNode
}

type DraftField = {
  id: string
  name: string
  description: string
  type: MyBrainFieldType
  options: string[]
}

const DEFAULT_BRAIN_REGION: MyBrainBrainRegion = 'frontal_left'

function createDraftField(): DraftField {
  return {
    id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    description: '',
    type: 'text',
    options: ['', ''],
  }
}

export default function CreateSectionModal({
  userId,
  triggerClassName,
  triggerLabel = 'Crear sección',
  triggerContent,
}: CreateSectionModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [logo, setLogo] = useState(MYBRAIN_SECTION_ICON_OPTIONS[0]?.value || '🧠')
  const [fields, setFields] = useState<DraftField[]>([createDraftField()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useMyBrainOverlayLock(open)

  const resetForm = () => {
    setName('')
    setLogo(MYBRAIN_SECTION_ICON_OPTIONS[0]?.value || '🧠')
    setFields([createDraftField()])
    setError(null)
  }

  const updateField = (fieldId: string, patch: Partial<DraftField>) => {
    setFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              ...patch,
              options:
                patch.type && patch.type !== 'picklist'
                  ? ['', '']
                  : patch.options ?? field.options,
            }
          : field
      )
    )
  }

  const updateFieldOption = (fieldId: string, optionIndex: number, value: string) => {
    setFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              options: field.options.map((option, index) =>
                index === optionIndex ? value : option
              ),
            }
          : field
      )
    )
  }

  const addField = () => {
    setFields((current) => [...current, createDraftField()])
  }

  const removeField = (fieldId: string) => {
    setFields((current) =>
      current.length === 1 ? current : current.filter((field) => field.id !== fieldId),
    )
  }

  const addOption = (fieldId: string) => {
    setFields((current) =>
      current.map((field) =>
        field.id === fieldId ? { ...field, options: [...field.options, ''] } : field
      )
    )
  }

  const removeOption = (fieldId: string, optionIndex: number) => {
    setFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              options:
                field.options.length <= 2
                  ? field.options
                  : field.options.filter((_, index) => index !== optionIndex),
            }
          : field
      )
    )
  }

  const handleClose = () => {
    setOpen(false)
    resetForm()
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()

    try {
      setSaving(true)
      setError(null)

      const section = await createSection(supabase, userId, {
        name,
        logo,
        color: null,
        brainRegion: DEFAULT_BRAIN_REGION,
        fields: fields
          .map((field) => ({
            name: field.name,
            description: field.description,
            type: field.type,
            options: field.type === 'picklist' ? field.options : [],
          }))
          .filter((field) => field.name.trim().length > 0),
      })

      handleClose()
      router.push(`/mybrain/sections/${section.id_section}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la sección')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ||
          'inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800'
        }
      >
        {triggerContent || triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] bg-slate-950/60">
          <div className="flex min-h-full items-end justify-center md:items-center md:p-4">
            <div
              className="flex h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-white/60 bg-[#F8FAFC] shadow-2xl md:h-auto md:max-h-[90vh] md:rounded-[28px]"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-slate-900 sm:text-xl">
                  Nueva sección
                </h3>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Cerrar"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreate} className="flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Nombre
                    </label>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Vinos, Restaurantes, Ideas..."
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Icono
                    </label>
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1">
                      {MYBRAIN_SECTION_ICON_OPTIONS.map((opt) => {
                        const active = opt.value === logo
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setLogo(opt.value)}
                            aria-label={opt.label}
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-xl transition ${
                              active
                                ? 'scale-105 border-slate-900 bg-slate-900 text-white shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            {opt.value}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm font-medium text-slate-700">
                        Campos
                      </label>
                      <button
                        type="button"
                        onClick={addField}
                        className="text-sm font-semibold text-[#0d9488]"
                      >
                        + Añadir
                      </button>
                    </div>

                    <div className="mt-3 space-y-3">
                      {fields.map((field, fieldIndex) => (
                        <div
                          key={field.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                              Campo {fieldIndex + 1}
                            </p>
                            {fields.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeField(field.id)}
                                className="text-xs font-semibold text-slate-500 transition-colors hover:text-rose-600"
                              >
                                Quitar
                              </button>
                            )}
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
                            <input
                              value={field.name}
                              onChange={(event) =>
                                updateField(field.id, { name: event.target.value })
                              }
                              placeholder="Nombre del campo"
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                            />
                            <select
                              value={field.type}
                              onChange={(event) =>
                                updateField(field.id, {
                                  type: event.target.value as MyBrainFieldType,
                                })
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                            >
                              {MYBRAIN_FIELD_TYPES.map((fieldType) => (
                                <option key={fieldType} value={fieldType}>
                                  {fieldType}
                                </option>
                              ))}
                            </select>
                          </div>

                          <input
                            value={field.description}
                            onChange={(event) =>
                              updateField(field.id, { description: event.target.value })
                            }
                            placeholder="Descripción opcional"
                            className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                          />

                          {field.type === 'picklist' && (
                            <div className="mt-3 space-y-2">
                              {field.options.map((option, optionIndex) => (
                                <div
                                  key={`${field.id}-${optionIndex}`}
                                  className="flex gap-2"
                                >
                                  <input
                                    value={option}
                                    onChange={(event) =>
                                      updateFieldOption(field.id, optionIndex, event.target.value)
                                    }
                                    placeholder={`Opción ${optionIndex + 1}`}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                                  />
                                  {field.options.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => removeOption(field.id, optionIndex)}
                                      className="rounded-2xl px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:text-rose-600"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => addOption(field.id)}
                                className="text-xs font-semibold text-[#0d9488]"
                              >
                                + Añadir opción
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 bg-[#F8FAFC] px-5 py-4 sm:px-6">
                  {error && (
                    <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {error}
                    </div>
                  )}
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !name.trim()}
                      className="rounded-2xl bg-[#90EBD6] px-5 py-3 text-sm font-semibold text-[#0f766e] transition-colors hover:bg-[#7DD3C1] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? 'Creando...' : 'Crear sección'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
