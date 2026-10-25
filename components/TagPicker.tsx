'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { setTagHidden } from '@/lib/tags'
import type { Tag } from '@/types/transactions'

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
      {off ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      )}
    </svg>
  )
}

/**
 * Selector de tag con búsqueda mientras se escribe.
 * Las tags ocultas no aparecen salvo que se pida "Mostrar ocultas" (o sea la tag ya seleccionada).
 */
export default function TagPicker({
  tags,
  value,
  onChange,
  onTagUpdated,
  disabled = false,
  id,
}: {
  tags: Tag[]
  value: string | null
  onChange: (idTag: string | null) => void
  /** Se llama cuando se oculta/muestra una tag, para refrescar la lista del padre */
  onTagUpdated: (tag: Tag) => void
  disabled?: boolean
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = tags.find((tag) => tag.id_tag === value) || null
  const hiddenCount = tags.filter((tag) => tag.is_hidden && tag.id_tag !== value).length

  const options = useMemo(() => {
    const needle = normalize(query)
    return tags
      .filter((tag) => showHidden || !tag.is_hidden || tag.id_tag === value)
      .filter((tag) => !needle || normalize(tag.ds_tag).includes(needle))
      .sort((a, b) => {
        // Las que empiezan por lo escrito primero
        if (needle) {
          const aStarts = normalize(a.ds_tag).startsWith(needle) ? 0 : 1
          const bStarts = normalize(b.ds_tag).startsWith(needle) ? 0 : 1
          if (aStarts !== bStarts) return aStarts - bStarts
        }
        return a.ds_tag.localeCompare(b.ds_tag, 'es')
      })
  }, [tags, query, showHidden, value])

  useEffect(() => {
    setHighlight(0)
  }, [query, showHidden, open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [open])

  const choose = (idTag: string | null) => {
    onChange(idTag)
    setOpen(false)
    setQuery('')
  }

  const toggleHidden = async (tag: Tag) => {
    setError(null)
    try {
      const updated = await setTagHidden(supabase, tag.id_tag, !tag.is_hidden)
      onTagUpdated(updated)
    } catch (err) {
      console.error(err)
      setError('No se pudo actualizar la tag. ¿Has ejecutado la migración de tags ocultas?')
    }
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setHighlight((current) => Math.min(current + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter') {
      if (open) {
        event.preventDefault()
        const option = options[highlight]
        if (option) choose(option.id_tag)
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="tag-picker-list"
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          value={open ? query : selected?.ds_tag || ''}
          placeholder={open ? (selected ? selected.ds_tag : 'Escribe para buscar…') : 'Sin tag · escribe para buscar'}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-md border border-gray-300 px-3 py-2.5 pr-9 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 touch-manipulation"
        />
        {value && !open && !disabled && (
          <button
            type="button"
            onClick={() => choose(null)}
            aria-label="Quitar tag"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700"
          >
            ✕
          </button>
        )}
      </div>

      {open && !disabled && (
        <div id="tag-picker-list" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {!query && (
            <button
              type="button"
              onClick={() => choose(null)}
              className={`block w-full px-3 py-2 text-left text-sm italic text-gray-500 hover:bg-gray-50 ${!value ? 'bg-gray-50' : ''}`}
            >
              Sin tag
            </button>
          )}
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">
              No hay tags que coincidan{!showHidden && hiddenCount > 0 ? ' (hay ocultas)' : ''}.
            </p>
          ) : (
            options.map((tag, index) => (
              <div
                key={tag.id_tag}
                onMouseEnter={() => setHighlight(index)}
                className={`flex items-center gap-1 pr-1 ${index === highlight ? 'bg-teal-50' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => choose(tag.id_tag)}
                  className={`flex-1 truncate px-3 py-2 text-left text-sm ${tag.id_tag === value ? 'font-semibold text-teal-700' : 'text-gray-800'} ${tag.is_hidden ? 'italic text-gray-400' : ''}`}
                >
                  {tag.ds_tag}
                  {tag.is_hidden && <span className="ml-2 text-[10px] font-semibold uppercase not-italic text-gray-400">oculta</span>}
                </button>
                <button
                  type="button"
                  onClick={() => toggleHidden(tag)}
                  title={tag.is_hidden ? 'Volver a mostrar esta tag' : 'Ocultar esta tag del buscador'}
                  aria-label={tag.is_hidden ? 'Mostrar tag' : 'Ocultar tag'}
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <EyeIcon off={!tag.is_hidden} />
                </button>
              </div>
            ))
          )}
          {(hiddenCount > 0 || showHidden) && (
            <button
              type="button"
              onClick={() => setShowHidden((current) => !current)}
              className="mt-1 block w-full border-t border-gray-100 px-3 py-2 text-left text-xs font-medium text-teal-700 hover:bg-gray-50"
            >
              {showHidden ? 'Ocultar de nuevo las tags ocultas' : `Mostrar tags ocultas (${hiddenCount})`}
            </button>
          )}
          {error && <p className="border-t border-gray-100 px-3 py-2 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
