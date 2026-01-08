'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getTransactionsForAnalytics, calculateMonthlySummary, calculateCategorySummary, type TransactionWithRelations } from '@/lib/transactions'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import TransactionForm from './TransactionForm'
import type { TransactionTypeName } from '@/types/transactions'
import { formatCurrency, formatDate } from '@/lib/format'

interface HomePageClientProps {
  idFamily: string
  idUser: string
  firstName: string
  showNewTransaction?: boolean
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
}: HomePageClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentMonthBenefit, setCurrentMonthBenefit] = useState(0)
  const [previousMonthBenefit, setPreviousMonthBenefit] = useState(0)
  const [currentMonthExpenses, setCurrentMonthExpenses] = useState(0)
  const [expenseCategories, setExpenseCategories] = useState<Array<{ id_category: string; ds_category: string; total: number; percentage: number }>>([])
  const [top5Expenses, setTop5Expenses] = useState<TransactionWithRelations[]>([])
  const [activeTooltip, setActiveTooltip] = useState<{ x: number; y: number; data: any } | null>(null)
  const [showTransactionForm, setShowTransactionForm] = useState(showNewTransaction)
  const [selectedTransactionType, setSelectedTransactionType] = useState<TransactionTypeName>('Expense')

  // Sincronizar con prop
  useEffect(() => {
    setShowTransactionForm(showNewTransaction)
  }, [showNewTransaction])

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // Obtener todas las transacciones
        const transactions = await getTransactionsForAnalytics(supabase, {
          idFamily,
          idUser: idUser,
          idCategory: null,
          idSubcategory: null,
          idTag: null,
          startMonth: null,
          endMonth: null,
        })

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

        // Calcular gastos del mes actual
        const currentExpenses = currentMonthTransactions
          .filter(t => t.transactionType === 'Expense')
          .reduce((sum, t) => sum + (t.ft_amount || 0), 0)
        setCurrentMonthExpenses(currentExpenses)

        // Calcular categorías de gastos del mes actual
        const expenseTransactions = currentMonthTransactions.filter(t => t.transactionType === 'Expense')
        const categories = calculateCategorySummary(expenseTransactions, null, 'Expense')
        setExpenseCategories(categories)

        // Top 5 gastos del mes actual
        const top5 = expenseTransactions
          .sort((a, b) => (b.ft_amount || 0) - (a.ft_amount || 0))
          .slice(0, 5)
        setTop5Expenses(top5)
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

  const colorsArray = [
    '#90EBD6', // brand primary
    '#A8D5E2', // pastel blue
    '#FFD3A5', // pastel orange
    '#C7CEEA', // pastel purple
    '#d9ead3', // pastel green
    '#FFB6C1', // light pink
    '#DDA0DD', // plum
    '#f18a8a', // pastel red (última opción)
  ]

  // Colores para Top 5 - gradiente rojo a amarillo (pastel)
  const top5Colors = [
    '#f8a5a5', // rojo pastel
    '#f5b895', // naranja pastel
    '#f4d03f', // amarillo pastel
    '#f9e79f', // amarillo suave pastel
    '#fef9e7', // amarillo muy claro pastel (con texto oscuro)
  ]

  // Si se está mostrando el formulario de transacción
  if (showTransactionForm) {
    // Si no hay tipo seleccionado, usar 'Expense' por defecto
    const currentType = selectedTransactionType || 'Expense'

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Nueva Transacción</h2>
            <button
              onClick={() => {
                setShowTransactionForm(false)
                setSelectedTransactionType('Expense')
                router.push(`/?family=${idFamily}`)
              }}
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
            key={currentType} // Key para forzar re-render cuando cambia el tipo
            transactionType={currentType}
            idFamily={idFamily}
            idUser={idUser}
            onSuccess={() => {
              setShowTransactionForm(false)
              setSelectedTransactionType('Expense')
              router.push(`/?family=${idFamily}`)
              // Recargar datos
              setTimeout(() => window.location.reload(), 100)
            }}
            onCancel={() => {
              setShowTransactionForm(false)
              setSelectedTransactionType('Expense')
              router.push(`/?family=${idFamily}`)
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 pt-4 sm:pt-6">
      {/* Header con saludo - mejorado */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold italic text-gray-900 mb-1.5">
          Howdy, {firstName}!
        </h1>
        <p className="text-sm sm:text-base text-gray-500">
          Entiende tus gastos, controla tu dinero.
        </p>
      </div>

      {/* Tarjetas de Beneficio mejoradas */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6">
        {/* Beneficio Mes Actual - Mayor énfasis */}
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
              prev.setMonth(prev.getMonth() - 1)
              return formatDate(prev, 'short')
            })()}
          </p>
        </div>
      </div>

      {/* Pie Chart y Top 5 en escritorio - misma línea */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#90EBD6]/20 p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">Gastos por Categoría</h2>
          <p className="text-sm text-gray-500 mt-1">Mes actual declarado</p>
        </div>
        {expenseCategories.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="mt-4 text-sm text-gray-500">No hay gastos registrados este mes</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
            {/* Pie Chart */}
            <div className="relative flex-shrink-0 mx-auto lg:mx-0">
              <ResponsiveContainer width={240} height={240}>
                <PieChart>
                  <Pie
                    data={expenseCategories}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={false}
                    outerRadius={120}
                    innerRadius={60}
                    fill="#8884d8"
                    dataKey="total"
                    onClick={(data, index, e) => {
                      if (data && data.payload && e) {
                        const entry = data.payload
                        const total = entry.total || 0
                        const percentage = entry.percentage || 0
                        const nativeEvent = e.nativeEvent as MouseEvent | TouchEvent
                        const clientX = 'touches' in nativeEvent ? nativeEvent.touches[0]?.clientX : nativeEvent.clientX
                        const clientY = 'touches' in nativeEvent ? nativeEvent.touches[0]?.clientY : nativeEvent.clientY
                        setActiveTooltip({
                          x: clientX || 0,
                          y: (clientY || 0) - 80,
                          data: {
                            ds_category: entry.ds_category || entry.name,
                            total,
                            percentage,
                          },
                        })
                        setTimeout(() => setActiveTooltip(null), 3000)
                      }
                    }}
                  >
                    {expenseCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colorsArray[index % colorsArray.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    wrapperStyle={{ zIndex: 9999 }}
                    contentStyle={{ backgroundColor: '#000000', border: '2px solid #374151', borderRadius: '0.5rem', padding: '12px', opacity: 1, zIndex: 9999 }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-black text-white rounded-lg shadow-xl border-2 border-gray-800 p-3" style={{ opacity: 1, backgroundColor: '#000000' }}>
                            <p className="text-sm font-semibold mb-2">{data.ds_category}</p>
                            <p className="text-base font-bold mb-1">
                              {formatCurrency(data.total)}
                            </p>
                            <p className="text-xs text-gray-300">
                              {data.percentage.toFixed(1)}%
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {activeTooltip && (
                <div
                  className="fixed z-50 bg-black text-white rounded-lg shadow-lg p-4 pointer-events-none"
                  style={{
                    left: `${activeTooltip.x}px`,
                    top: `${activeTooltip.y}px`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <p className="text-sm font-semibold mb-2">{activeTooltip.data.ds_category}</p>
                  <p className="text-base font-bold mb-1">
                    {formatCurrency(activeTooltip.data.total)}
                  </p>
                  <p className="text-xs text-gray-300">
                    {activeTooltip.data.percentage.toFixed(1)}%
                  </p>
                </div>
              )}
              {/* Total en el centro - mejorado */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-[10px] sm:text-xs text-gray-400 mb-0.5">Total Gastos</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                    {formatCurrency(currentMonthExpenses)}
                  </p>
                </div>
              </div>
            </div>
            {/* Leyenda de categorías - solo móvil */}
            <div className="w-full lg:hidden">
              <div className="space-y-2">
                {expenseCategories.map((cat, index) => (
                  <div key={cat.id_category} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: colorsArray[index % colorsArray.length] }}
                      />
                      <span className="text-sm font-medium text-gray-900 truncate">{cat.ds_category}</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(cat.total)}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        {cat.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Layout escritorio: Leyenda izquierda + Top 5 derecha */}
            <div className="hidden lg:flex lg:flex-1 lg:gap-6">
              {/* Leyenda de categorías - compacta y pegada a la izquierda */}
              <div className="flex-shrink-0 w-64">
                <div className="space-y-1">
                  {expenseCategories.map((cat, index) => (
                    <div key={cat.id_category} className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: colorsArray[index % colorsArray.length] }}
                        />
                        <span className="text-xs lg:text-sm font-medium text-gray-900 truncate">{cat.ds_category}</span>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="text-xs lg:text-sm font-bold text-gray-900">
                          {formatCurrency(cat.total)}
                        </span>
                        <span className="text-[10px] lg:text-xs text-gray-500 ml-1">
                          {cat.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top 5 Gastos - a la derecha en escritorio */}
              <div className="flex-1 min-w-0 border-l border-[#90EBD6]/30 pl-6">
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Top 5 Gastos</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Mayores gastos del mes</p>
                </div>
                {top5Expenses.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="mt-3 text-xs text-gray-500">No hay gastos</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {top5Expenses.map((expense, index) => (
                      <div 
                        key={expense.id_transaction} 
                        className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all duration-200"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div 
                            className={`flex-shrink-0 w-7 h-7 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center font-bold text-xs lg:text-sm ${
                              index === 4 ? 'text-gray-800' : 'text-white'
                            }`}
                            style={{ backgroundColor: top5Colors[index] || top5Colors[4] }}
                          >
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs lg:text-sm font-semibold text-gray-900 truncate">
                              {expense.ds_comments || 'Sin comentario'}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[10px] lg:text-xs text-gray-500">
                                {expense.category?.ds_category || 'Sin categoría'}
                              </span>
                              {expense.subcategory && (
                                <>
                                  <span className="text-[10px] lg:text-xs text-gray-400">•</span>
                                  <span className="text-[10px] lg:text-xs text-gray-500">
                                    {expense.subcategory.ds_subcategory}
                                  </span>
                                </>
                              )}
                              <span className="text-[10px] lg:text-xs text-gray-400">•</span>
                              <span className="text-[10px] lg:text-xs text-gray-500">
                                {formatDate(expense.dt_date, 'long')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right ml-2">
                          <p className="text-sm lg:text-base font-bold text-gray-900">
                            {formatCurrency(expense.ft_amount || 0)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top 5 Gastos - Solo móvil */}
      <div className="lg:hidden bg-white rounded-2xl shadow-sm border border-[#90EBD6]/20 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">Top 5 Gastos del Mes</h2>
          <p className="text-sm text-gray-500 mt-1">Mayores gastos del mes actual</p>
        </div>
        {top5Expenses.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-4 text-sm text-gray-500">No hay gastos registrados este mes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {top5Expenses.map((expense, index) => (
              <div 
                key={expense.id_transaction} 
                className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all duration-200"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div 
                    className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white"
                    style={{ backgroundColor: top5Colors[index] || top5Colors[4] }}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {expense.ds_comments || 'Sin comentario'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-gray-500">
                        {expense.category?.ds_category || 'Sin categoría'}
                      </span>
                      {expense.subcategory && (
                        <>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">
                            {expense.subcategory.ds_subcategory}
                          </span>
                        </>
                      )}
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">
                        {formatDate(expense.dt_date, 'long')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right ml-4">
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(expense.ft_amount || 0)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

