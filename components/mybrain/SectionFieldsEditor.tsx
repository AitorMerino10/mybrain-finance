'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { createSectionField, updateSection, updateSectionField } from '@/lib/mybrain/sections'
import { parseFieldOptions } from '@/lib/mybrain/field-options'
import type {
  MyBrainFieldType,
  MyBrainSectionFieldWithConfig,
  MyBrainSectionWithFields,
} from '@/types/mybrain'
import {
  MYBRAIN_FIELD_TYPES,
  MYBRAIN_SECTION_ICON_OPTIONS,
} from '@/types/mybrain'

interface SectionFieldsEditorProps {
  userId: string
  section: MyBrainSectionWithFields
}

type EditableField = {
  id: string
  name: string
  description: string
  type: MyBrainFieldType
  options: string[]
  saving: boolean
  error: string | null
}

function toEditableField(field: MyBrainSectionFieldWithConfig): EditableField {
  return {
    id: field.id_field,
    name: field.ds_section_field,
    description: field.ds_field_description || '',
    type: field.ds_field_type as MyBrainFieldType,
    options: parseFieldOptions(field),
    saving: false,
    error: null,
  }
}

export default function SectionFieldsEditor({
  userId,
  section,
}: SectionFieldsEditorProps) {
  const router = useRouter()
  const [sectionName, setSectionName] = useState(section.ds_section)
  const [sectionLogo, setSectionLogo] = useState(section.ds_logo || '🧠')
  const [sectionSaving, setSectionSaving] = useState(false)
  const [sectionError, setSectionError] = useState<string | null>(null)
  const [sectionSuccess, setSectionSuccess] = useState<string | null>(null)
  const [editableFields, setEditableFields] = useState<EditableField[]>(
    section.fields.map(toEditableField),
  )
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<MyBrainFieldType>('text')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSectionName(section.ds_section)
    setSectionLogo(section.ds_logo || '🧠')
    setEditableFields(section.fields.map(toEditableField))
  }, [section])

  const updateEditableField = (fieldId: string, patch: Partial<EditableField>) => {
    setEditableFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              ...patch,
              options:
                patch.type && patch.type !== 'picklist'
                  ? []
                  : patch.type === 'picklist' && field.options.length === 0
                    ? ['', '']
                    : patch.options ?? field.options,
            }
          : field,
      ),
    )
  }

  const updateEditableFieldOption = (
    fieldId: string,
    optionIndex: number,
    value: string,
  ) => {
    setEditableFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              options: field.options.map((option, index) =>
                index === optionIndex ? value : option,
              ),
              error: null,
            }
          : field,
      ),
    )
  }

  const addEditableFieldOption = (fieldId: string) => {
    setEditableFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              options: [...field.options, ''],
              error: null,
            }
          : field,
      ),
    )
  }

  const removeEditableFieldOption = (fieldId: string, optionIndex: number) => {
    setEditableFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              options:
                field.options.length <= 2
                  ? field.options
                  : field.options.filter((_, index) => index !== optionIndex),
              error: null,
            }
          : field,
      ),
    )
  }

  const updateNewOption = (optionIndex: number, value: string) => {
    setOptions((current) =>
      current.map((option, index) => (index === optionIndex ? value : option)),
    )
  }

  const addNewOption = () => {
    setOptions((current) => [...current, ''])
  }

  const removeNewOption = (optionIndex: number) => {
    setOptions((current) =>
      current.length <= 2
        ? current
        : current.filter((_, index) => index !== optionIndex),
    )
  }

  const handleSaveAll = async () => {
    try {
      setSectionSaving(true)
      setSaving(true)
      setSectionError(null)
      setSectionSuccess(null)
      setError(null)

      await updateSection(supabase, userId, section.id_section, {
        name: sectionName,
        logo: sectionLogo,
        color: null,
      })

      for (const field of editableFields) {
        await updateSectionField(supabase, userId, section.id_section, field.id, {
          name: field.name,
          description: field.description,
          type: field.type,
          options: field.type === 'picklist' ? field.options : [],
        })
      }

      if (name.trim()) {
        await createSectionField(supabase, userId, section.id_section, {
          name,
          description,
          type,
          options: type === 'picklist' ? options : [],
        })
        setName('')
        setDescription('')
        setType('text')
        setOptions(['', ''])
      }

      setSectionSuccess('Configuración actualizada')
      router.refresh()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo guardar la configuración'
      setSectionError(message)
      setError(message)
    } finally {
      setSectionSaving(false)
      setSaving(false)
    }
  }

  const renderSaveButton = () => (
    <button
      type="button"
      onClick={handleSaveAll}
      disabled={sectionSaving || saving}
      className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {sectionSaving || saving ? 'Guardando...' : 'Guardar configuración'}
    </button>
  )

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleSaveAll()
          }}
          className="space-y-5"
        >
          <div className="flex justify-end">{renderSaveButton()}</div>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Nombre</label>
              <input
                value={sectionName}
                onChange={(event) => setSectionName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Icono</label>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1">
                {MYBRAIN_SECTION_ICON_OPTIONS.map((iconOption) => {
                  const active = iconOption.value === sectionLogo
                  return (
                    <button
                      key={iconOption.value}
                      type="button"
                      onClick={() => setSectionLogo(iconOption.value)}
                      aria-label={iconOption.label}
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-lg transition ${
                        active
                          ? 'scale-105 border-slate-900 bg-slate-900 text-white shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {iconOption.value}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
            {sectionError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {sectionError}
              </div>
            )}
            {sectionSuccess && !sectionError && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {sectionSuccess}
              </div>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <h3 className="text-lg font-bold text-slate-900">Campos</h3>
        </div>

        {editableFields.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-600 sm:px-6">
            No fields yet. Create the first one below.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Options</th>
                </tr>
              </thead>
              <tbody>
                {editableFields.map((field) => (
                  <tr key={field.id} className="border-t border-slate-200 align-top">
                    <td className="px-4 py-4">
                      <input
                        value={field.name}
                        onChange={(event) =>
                          updateEditableField(field.id, { name: event.target.value, error: null })
                        }
                        className="w-full min-w-[180px] rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <input
                        value={field.description}
                        onChange={(event) =>
                          updateEditableField(field.id, {
                            description: event.target.value,
                            error: null,
                          })
                        }
                        placeholder="Optional context for the AI"
                        className="w-full min-w-[240px] rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={field.type}
                        onChange={(event) =>
                          updateEditableField(field.id, {
                            type: event.target.value as MyBrainFieldType,
                            error: null,
                          })
                        }
                        className="min-w-[130px] rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                      >
                        {MYBRAIN_FIELD_TYPES.map((fieldType) => (
                          <option key={fieldType} value={fieldType}>
                            {fieldType}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      {field.type === 'picklist' ? (
                        <div className="min-w-[240px] space-y-2">
                          {(field.options.length > 0 ? field.options : ['', '']).map(
                            (option, optionIndex) => (
                              <div key={`${field.id}-${optionIndex}`} className="flex gap-2">
                                <input
                                  value={option}
                                  onChange={(event) =>
                                    updateEditableFieldOption(
                                      field.id,
                                      optionIndex,
                                      event.target.value,
                                    )
                                  }
                                  placeholder={`Opción ${optionIndex + 1}`}
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                                />
                                {field.options.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeEditableFieldOption(field.id, optionIndex)
                                    }
                                    className="rounded-2xl px-2 text-sm font-semibold text-slate-500 transition-colors hover:text-rose-600"
                                    aria-label="Quitar opción"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ),
                          )}
                          <button
                            type="button"
                            onClick={() => addEditableFieldOption(field.id)}
                            className="text-xs font-semibold text-[#0d9488]"
                          >
                            + Añadir opción
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      {field.error && (
                        <div className="mt-2 text-xs text-rose-600">{field.error}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-bold text-slate-900">Crear campo</h3>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr_0.8fr]">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre del campo"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
          />
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descripción opcional para la IA"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
          />
          <select
            value={type}
            onChange={(event) => {
              const nextType = event.target.value as MyBrainFieldType
              setType(nextType)
              if (nextType !== 'picklist') {
                setOptions(['', ''])
              }
            }}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
          >
            {MYBRAIN_FIELD_TYPES.map((fieldType) => (
              <option key={fieldType} value={fieldType}>
                {fieldType}
              </option>
            ))}
          </select>
          {type === 'picklist' && (
            <div className="space-y-2 lg:col-span-3">
              <p className="text-sm font-medium text-slate-700">Opciones</p>
              {options.map((option, optionIndex) => (
                <div key={`new-option-${optionIndex}`} className="flex gap-2">
                  <input
                    value={option}
                    onChange={(event) => updateNewOption(optionIndex, event.target.value)}
                    placeholder={`Opción ${optionIndex + 1}`}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeNewOption(optionIndex)}
                      className="rounded-2xl px-3 text-sm font-semibold text-slate-500 transition-colors hover:text-rose-600"
                      aria-label="Quitar opción"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addNewOption}
                className="text-sm font-semibold text-[#0d9488]"
              >
                + Añadir opción
              </button>
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 lg:col-span-3">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        {renderSaveButton()}
      </div>
    </div>
  )
}
