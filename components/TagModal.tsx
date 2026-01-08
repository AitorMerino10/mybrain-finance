'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { createTag } from '@/lib/tags'
import type { Database } from '@/types/supabase'

type Tag = Database['public']['Tables']['pml_dim_tag']['Row']

interface TagModalProps {
  isOpen: boolean
  onClose: () => void
  onTagCreated: (tag: Tag) => void
  idFamily: string
}

export default function TagModal({
  isOpen,
  onClose,
  onTagCreated,
  idFamily,
}: TagModalProps) {
  const [tagName, setTagName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!tagName.trim()) {
      setError('El nombre de la tag es requerido')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const newTag = await createTag(supabase, {
        ds_tag: tagName.trim(),
        id_family: idFamily,
      })

      onTagCreated(newTag)
      setTagName('')
      onClose()
    } catch (err) {
      console.error('Error al crear tag:', err)
      setError(err instanceof Error ? err.message : 'Error al crear la tag')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Crear Nueva Tag
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="tagName"
              className="block text-sm font-medium text-gray-700"
            >
              Nombre de la tag
            </label>
            <input
              type="text"
              id="tagName"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2.5 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 touch-manipulation"
              placeholder="Ej: Urgente, Reembolsable..."
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !tagName.trim()}
              className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation min-h-[44px]"
            >
              {loading ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

