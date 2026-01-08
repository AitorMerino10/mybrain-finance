'use client'

import { useState } from 'react'
import Link from 'next/link'
import TransactionForm from './TransactionForm'
import type { TransactionTypeName } from '@/types/transactions'

interface DashboardActionsProps {
  idFamily: string
  idUser: string
}

export default function DashboardActions({
  idFamily,
  idUser,
}: DashboardActionsProps) {
  const [showForm, setShowForm] = useState<TransactionTypeName | null>(null)

  const handleSuccess = () => {
    setShowForm(null)
    // Aquí podrías agregar lógica adicional, como refrescar la lista de transacciones
  }

  if (showForm) {
    return (
      <div className="rounded-lg bg-white p-4 sm:p-6 shadow">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            {showForm === 'Expense' ? 'Crear Gasto' : 'Crear Ingreso'}
          </h2>
          <button
            onClick={() => setShowForm(null)}
            className="p-2 text-gray-500 hover:text-gray-700 touch-manipulation"
            aria-label="Cerrar"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <TransactionForm
          transactionType={showForm}
          idFamily={idFamily}
          idUser={idUser}
          onSuccess={handleSuccess}
          onCancel={() => setShowForm(null)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white p-4 sm:p-6 shadow">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Acciones Rápidas</h3>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 active:bg-purple-800 touch-manipulation min-h-[44px]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            Ver Analítica
          </Link>
        </div>
      </div>
      <div className="rounded-lg bg-white p-4 sm:p-6 shadow">
        <h2 className="mb-4 text-lg sm:text-xl font-semibold text-gray-900">
          Nueva Transacción
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={() => setShowForm('Expense')}
            className="flex-1 rounded-lg border-2 border-red-300 bg-red-50 px-4 sm:px-6 py-3 sm:py-4 text-base sm:text-lg font-semibold text-red-700 transition-colors hover:bg-red-100 active:bg-red-200 touch-manipulation min-h-[44px]"
          >
            <div className="flex items-center justify-center gap-2">
              <svg
                className="h-5 w-5 sm:h-6 sm:w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Crear Gasto
            </div>
          </button>
          <button
            onClick={() => setShowForm('Income')}
            className="flex-1 rounded-lg border-2 border-green-300 bg-green-50 px-4 sm:px-6 py-3 sm:py-4 text-base sm:text-lg font-semibold text-green-700 transition-colors hover:bg-green-100 active:bg-green-200 touch-manipulation min-h-[44px]"
          >
            <div className="flex items-center justify-center gap-2">
              <svg
                className="h-5 w-5 sm:h-6 sm:w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Crear Ingreso
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

