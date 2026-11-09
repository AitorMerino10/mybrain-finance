'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calculateMonthlySummary, type TransactionWithRelations } from '@/lib/transactions'
import HomeBudgetOverview from './HomeBudgetOverview'
import TransactionForm from './TransactionForm'
import type { TransactionTypeName } from '@/types/transactions'
import { formatCurrency, formatDate } from '@/lib/format'
import LocalModeBanner from './LocalModeBanner'
import { deletePendingTransaction, getPendingTransactions, type PendingTransaction } from '@/lib/pending'

interface HomePageClientProps {
  idFamily: string
  idUser: string
  firstName: string
  showNewTransaction?: boolean
  /** Gasto pendiente que se abre directamente (viene de la notificación) */
  openPendingId?: string
}

// Helper para detectar prefers-reduced-motion
const prefersReducedMotion = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getPreviousMonth(): string {
  const now = new Date()
  now.setMonth(now.getMonth() - 1)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function HomePageClient({
  idFamily,
  idUser,
  firstName,
  showNewTransaction = false,
  openPendingId,
}: HomePageClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentMonthBenefit, setCurrentMonthBenefit] = useState(0)
  const [previousMonthBenefit, setPreviousMonthBenefit] = useState(0)
  const [showTransactionForm, setShowTransactionForm] = useState(showNewTransaction)
  const [selectedTransactionType, setSelectedTransactionType] = useState<TransactionTypeName>('Expense')
  const [pending, setPending] = useState<PendingTransaction[]>([])
  const [activePending, setActivePending] = useState<PendingTransaction | null>(null)

  const closeForm = () => {
    setShowTransactionForm(false)
    setSelectedTransactionType('Expense')
    setActivePending(null)
    router.push(`/?family=${idFamily}`)
  }

  const removePending = async (item: PendingTransaction) => {
    const label = item.ds_merchant ? `${item.ds_merchant} (${formatCurrency(item.ft_amount)})` : formatCurrency(item.ft_amount)
    if (!window.confirm(`¿Borrar el gasto pendiente de ${label}? No se ha contado en ningún número.`)) return
    try {
      await deletePendingTransaction(supabase, item.id_pending_transaction)
      setPending((prev) => prev.filter((row) => row.id_pending_transaction !== item.id_pending_transaction))
    } catch (error) {
      console.error('No se pudo borrar el pendiente:', error)
    }
  }

  const startPending = (item: PendingTransaction) => {
    setActivePending(item)
    setSelectedTransactionType('Expense')
    setShowTransactionForm(true)
  }

  // Gastos pendientes (los que llegan desde el móvil)
  useEffect(() => {
    let cancelled = false
    getPendingTransactions(supabase, idFamily, idUser).then((rows) => {
      if (cancelled) return
      setPending(rows)
      // Si vienes de la notificación, se abre ese gasto directamente
      const target = openPendingId ? rows.find((row) => row.id_pending_transaction === openPendingId) : null
      if (target) {
        setActivePending(target)
        setSelectedTransactionType('Expense')
        setShowTransactionForm(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [idFamily, idUser, openPendingId])

  // Sincronizar con prop
  useEffect(() => {
    setShowTransactionForm(showNewTransaction)
  }, [showNewTransaction])

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        let transactions: TransactionWithRelations[] = []

        const transactionsResponse = await fetch('/api/analytics/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idFamily,
            idUsers: [idUser],
            idCategories: null,
            idSubcategories: null,
            idTags: null,
            monthsDeclared: null,
            dateFrom: null,
            dateTo: null,
            startMonth: null,
            endMonth: null,
          }),
        })
        const data = await transactionsResponse.json()
        if (!transactionsResponse.ok) {
          throw new Error(data.error || 'Error al cargar transacciones')
        }
        transactions = (data.transactions || []) as TransactionWithRelations[]

        // Obtener mes actual y anterior
        const currentMonth = getCurrentMonth()
        const previousMonth = getPreviousMonth()

        // Filtrar transacciones del mes actual y anterior
        const currentMonthTransactions = transactions.filter(t => t.ds_month_declared === currentMonth)
        const previousMonthTransactions = transactions.filter(t => t.ds_month_declared === previousMonth)

        // Calcular beneficios
        const currentSummary = calculateMonthlySummary(currentMonthTransactions)
        const previousSummary = calculateMonthlySummary(previousMonthTransactions)

        setCurrentMonthBenefit(currentSummary[0]?.benefit || 0)
        setPreviousMonthBenefit(previousSummary[0]?.benefit || 0)
      } catch (error) {
        console.error('Error al cargar datos:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [idFamily, idUser])

  // Skeleton component
  const SkeletonCard = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
      <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-20"></div>
    </div>
  )

  const SkeletonPie = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
      <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
      <div className="flex items-center justify-center">
        <div className="w-48 h-48 bg-gray-200 rounded-full"></div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-8 pt-2">
        <div className="mb-6">
          <div className="h-10 bg-gray-200 rounded w-64 mb-2 animate-pulse"></div>
          <div className="h-5 bg-gray-200 rounded w-80 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonPie />
      </div>
    )
  }

  // Si se está mostrando el formulario de transacción
  if (showTransactionForm) {
    // Si no hay tipo seleccionado, usar 'Expense' por defecto
    const currentType = selectedTransactionType || 'Expense'

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">{activePending ? 'Completar gasto' : 'Nueva Transacción'}</h2>
            <button
              onClick={closeForm}
              className="p-2 text-gray-500 hover:text-gray-700"
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

          {/* Radio buttons tipo card y formulario */}
          <div>
            {/* Radio buttons tipo card */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 mb-4">
                Tipo de transacción *
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedTransactionType('Expense')}
                  className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                    currentType === 'Expense'
                      ? 'border-red-500 bg-red-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className={`w-3 h-3 rounded-full transition-all duration-200 ${
                      currentType === 'Expense' ? 'bg-red-500' : 'bg-gray-300'
                    }`} />
                    <span className={`font-semibold transition-colors duration-200 ${
                      currentType === 'Expense' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      Gasto
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTransactionType('Income')}
                  className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                    currentType === 'Income'
                      ? 'border-green-500 bg-green-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className={`w-3 h-3 rounded-full transition-all duration-200 ${
                      currentType === 'Income' ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                    <span className={`font-semibold transition-colors duration-200 ${
                      currentType === 'Income' ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      Ingreso
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Formulario */}
            <TransactionForm
            key={`${currentType}-${activePending?.id_pending_transaction || 'new'}`} // Key para forzar re-render cuando cambia el tipo o el pendiente
            transactionType={currentType}
            idFamily={idFamily}
            idUser={idUser}
            initialValues={
              activePending
                ? { amount: activePending.ft_amount, date: activePending.dt_date, comments: activePending.ds_merchant }
                : undefined
            }
            onCreated={() => {
              // El gasto ya existe de verdad: el pendiente deja de hacer falta
              if (activePending) {
                deletePendingTransaction(supabase, activePending.id_pending_transaction).catch((error) =>
                  console.error('No se pudo borrar el pendiente completado:', error)
                )
              }
            }}
            onSuccess={() => {
              closeForm()
              // Recargar datos
              setTimeout(() => window.location.reload(), 100)
            }}
            onCancel={closeForm}
          />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 pt-4 sm:pt-6">
      {/* Header con saludo */}
      <div className="mb-1 sm:mb-2">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="mb-1 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Howdy, {firstName}</h1>
        <p className="text-sm text-slate-500">Entiende tus gastos, controla tu dinero.</p>
      </div>

      <LocalModeBanner />

      {pending.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-amber-900">
              📲 Pendientes de completar ({pending.length})
            </h2>
            <p className="text-xs text-amber-800/80">No cuentan en tus números hasta que los completes</p>
          </div>
          <ul className="divide-y divide-amber-100 rounded-xl bg-white">
            {pending.map((item) => (
              <li key={item.id_pending_transaction} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{item.ds_merchant || 'Gasto sin nombre'}</p>
                  <p className="text-xs text-gray-500">
                    {formatCurrency(item.ft_amount)} · {new Date(`${item.dt_date}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    {item.ds_card ? ` · ${item.ds_card}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => startPending(item)}
                  className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  Completar
                </button>
                <button
                  onClick={() => removePending(item)}
                  className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Borrar pendiente"
                  title="Borrar"
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tarjetas de Beneficio */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6">
        {/* Beneficio Mes Actual */}
        <div
          className={`bg-gray-50 rounded-2xl shadow-sm border border-gray-100 relative p-5 sm:p-6 hover:shadow-md transition-all ${
            prefersReducedMotion() ? '' : 'duration-300 hover:scale-[1.01]'
          }`}
        >
          <div className="mb-2">
            <h3 className="text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider">Beneficio Actual</h3>
          </div>
          <p className={`text-2xl sm:text-3xl md:text-4xl font-extrabold mb-1 ${currentMonthBenefit >= 0 ? 'text-[#14B8A6]' : 'text-[#f18a8a]'}`}>
            {formatCurrency(currentMonthBenefit)}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-400 font-medium lowercase">
            {formatDate(new Date(), 'short')}
          </p>
        </div>

        {/* Beneficio Mes Anterior */}
        <div
          className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 hover:shadow-md transition-all ${
            prefersReducedMotion() ? '' : 'duration-300 hover:scale-[1.01]'
          }`}
        >
          <div className="mb-2">
            <h3 className="text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider">Beneficio Anterior</h3>
          </div>
          <p className={`text-2xl sm:text-3xl md:text-4xl font-extrabold mb-1 ${previousMonthBenefit >= 0 ? 'text-[#14B8A6]' : 'text-[#f18a8a]'}`}>
            {formatCurrency(previousMonthBenefit)}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-400 font-medium lowercase">
            {(() => {
              const prev = new Date()
              prev.setDate(1)
              prev.setMonth(prev.getMonth() - 1)
              return formatDate(prev, 'short')
            })()}
          </p>
        </div>
      </div>

      {/* Seguimiento de presupuestos y controles */}
      <HomeBudgetOverview idFamily={idFamily} idUser={idUser} />
    </div>
  )
}

