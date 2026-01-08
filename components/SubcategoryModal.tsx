'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { createSubcategory } from '@/lib/categories'
import type { Subcategory } from '@/types/transactions'

interface SubcategoryModalProps {
  isOpen: boolean
  onClose: () => void
  onSubcategoryCreated: (subcategory: Subcategory) => void
  idCategory: string
  categoryName: string
}

export default function SubcategoryModal({
  isOpen,
  onClose,
  onSubcategoryCreated,
  idCategory,
  categoryName,
}: SubcategoryModalProps) {
  const [subcategoryName, setSubcategoryName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!subcategoryName.trim()) {
      setError('El nombre de la subcategoría es requerido')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const newSubcategory = await createSubcategory(supabase, {
        ds_subcategory: subcategoryName.trim(),
        id_category: idCategory,
      })

      onSubcategoryCreated(newSubcategory)
      setSubcategoryName('')
      onClose()
    } catch (err) {
      console.error('Error al crear subcategoría:', err)
      setError(err instanceof Error ? err.message : 'Error al crear la subcategoría')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="mb-2 text-xl font-bold text-gray-900">
          Crear Nueva Subcategoría
        </h2>
        <p className="mb-6 text-sm text-gray-600">
          Categoría: <span className="font-medium text-gray-900">{categoryName}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="subcategoryName"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Nombre de la subcategoría
            </label>
            <input
              type="text"
              id="subcategoryName"
              value={subcategoryName}
              onChange={(e) => setSubcategoryName(e.target.value)}
              className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-base shadow-sm focus:border-[#90EBD6] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]/20 touch-manipulation transition-colors"
              placeholder="Ej: Supermercado, Restaurante..."
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation min-h-[44px] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !subcategoryName.trim()}
              className="rounded-xl bg-[#C7CEEA] px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-[#C7CEEA]/90 active:bg-[#C7CEEA]/80 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation min-h-[44px] transition-colors shadow-sm"
            >
              {loading ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

