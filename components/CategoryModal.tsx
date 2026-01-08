'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { createCategory } from '@/lib/categories'
import type { Category } from '@/types/transactions'

interface CategoryModalProps {
  isOpen: boolean
  onClose: () => void
  onCategoryCreated: (category: Category) => void
  idFamily: string
  transactionType: 'Income' | 'Expense'
}

export default function CategoryModal({
  isOpen,
  onClose,
  onCategoryCreated,
  idFamily,
  transactionType: initialTransactionType,
}: CategoryModalProps) {
  const [categoryName, setCategoryName] = useState('')
  const [transactionType, setTransactionType] = useState<'Income' | 'Expense'>(initialTransactionType)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resetear el tipo cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setTransactionType(initialTransactionType)
      setCategoryName('')
      setError(null)
    }
  }, [isOpen, initialTransactionType])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!categoryName.trim()) {
      setError('El nombre de la categoría es requerido')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const newCategory = await createCategory(supabase, {
        ds_category: categoryName.trim(),
        id_family: idFamily,
        is_income: transactionType === 'Income',
        is_expense: transactionType === 'Expense',
      })

      onCategoryCreated(newCategory)
      setCategoryName('')
      setTransactionType(initialTransactionType)
      onClose()
    } catch (err) {
      console.error('Error al crear categoría:', err)
      setError(err instanceof Error ? err.message : 'Error al crear la categoría')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="mb-6 text-xl font-bold text-gray-900">
          Crear Nueva Categoría
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Selector de tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de categoría
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTransactionType('Expense')}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-colors touch-manipulation min-h-[44px] ${
                  transactionType === 'Expense'
                    ? 'bg-[#f18a8a] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Gastos
              </button>
              <button
                type="button"
                onClick={() => setTransactionType('Income')}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-colors touch-manipulation min-h-[44px] ${
                  transactionType === 'Income'
                    ? 'bg-[#A8D5E2] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Ingresos
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="categoryName"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Nombre de la categoría
            </label>
            <input
              type="text"
              id="categoryName"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-base shadow-sm focus:border-[#90EBD6] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]/20 touch-manipulation transition-colors"
              placeholder="Ej: Alimentación, Transporte..."
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
              disabled={loading || !categoryName.trim()}
              className="rounded-xl bg-[#90EBD6] px-5 py-2.5 text-sm font-medium text-[#0d9488] hover:bg-[#90EBD6]/90 active:bg-[#90EBD6]/80 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation min-h-[44px] transition-colors shadow-sm"
            >
              {loading ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

