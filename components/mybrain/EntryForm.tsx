'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseFieldOptions } from '@/lib/mybrain/field-options'
import { supabase } from '@/lib/supabase'
import { createEntryWithValues } from '@/lib/mybrain/entries'
import { getTodayISOString } from '@/lib/date-utils'
import type { MyBrainSectionFieldWithConfig } from '@/types/mybrain'

interface EntryFormProps {
  userId: string
  sectionId: string
  fields: MyBrainSectionFieldWithConfig[]
}

function getFieldPlaceholder(type: string) {
  switch (type) {
    case 'url':
      return 'https://...'
    case 'location':
      return 'Lugar, ciudad o referencia'
    case 'photo':
      return 'URL de la foto o referencia'
    case 'date':
      return 'YYYY-MM-DD'
    default:
      return 'Escribe aquí'
  }
}

export default function EntryForm({ userId, sectionId, fields }: EntryFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [eventDate, setEventDate] = useState(getTodayISOString())
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sortedFields = useMemo(
    () =>
      [...fields].sort(
        (a, b) => (a.id_order ?? Number.MAX_SAFE_INTEGER) - (b.id_order ?? Number.MAX_SAFE_INTEGER)
      ),
    [fields]
  )

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    try {
      setSaving(true)
      setError(null)
      await createEntryWithValues(supabase, userId, sectionId, {
        title,
        eventDate,
        values,
      })
      router.push(`/mybrain/sections/${sectionId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la entrada')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Titulo
            </label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej: Cena en Bibo, Rioja del 2018, idea para newsletter..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Fecha del recuerdo
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
            />
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0d9488]">
            Detalle
          </p>
          <h3 className="mt-2 text-xl font-bold text-slate-900">
            Rellena los campos de esta sección
          </h3>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {sortedFields.map((field) => {
            const picklistOptions = parseFieldOptions(field)
            const inputType =
              field.ds_field_type === 'number'
                ? 'number'
                : field.ds_field_type === 'date'
                  ? 'date'
                  : field.ds_field_type === 'url'
                    ? 'url'
                    : 'text'

            return (
              <div key={field.id_field} className="md:col-span-1">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {field.ds_section_field}
                </label>
                {field.ds_field_type === 'picklist' ? (
                  <select
                    value={values[field.id_field] || ''}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        [field.id_field]: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                  >
                    <option value="">Selecciona una opcion</option>
                    {picklistOptions.map((option) => (
                      <option key={`${field.id_field}-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={inputType}
                    value={values[field.id_field] || ''}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        [field.id_field]: event.target.value,
                      }))
                    }
                    placeholder={getFieldPlaceholder(field.ds_field_type)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push(`/mybrain/sections/${sectionId}`)}
          className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-2xl bg-[#90EBD6] px-4 py-2.5 text-sm font-semibold text-[#0f766e] transition-colors hover:bg-[#7DD3C1] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar entrada'}
        </button>
      </div>
    </form>
  )
}
