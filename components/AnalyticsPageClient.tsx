'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getTransactionsForAnalytics,
  calculateTotalSummary,
  calculateMonthlySummary,
  calculateCategorySummary,
  calculateSubcategorySummary,
  calculateMedianMonthlyBenefit,
  compareMultipleCases,
  deleteTransaction,
  type AnalyticsFilters,
  type MonthlySummary,
  type CategorySummary,
  type SubcategorySummary,
  type TransactionWithRelations,
  type ComparatorCase,
  type MultiCaseComparison,
} from '@/lib/transactions'
import type { FamilyMember } from '@/lib/family'
import type { Category, Tag } from '@/types/transactions'
import { getSubcategoriesByCategory } from '@/lib/categories'
import { formatCurrency, formatDate } from '@/lib/format'
import Link from 'next/link'
import EditTransactionModal from './EditTransactionModal'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface AnalyticsPageClientProps {
  idFamily: string
  idUser: string
  familyMembers: FamilyMember[]
  categories: Category[]
  tags: Tag[]
}

// Colores pastel de la home page
const colorsArray = [
  '#90EBD6', // brand primary
  '#A8D5E2', // pastel blue
  '#FFD3A5', // pastel orange
  '#C7CEEA', // pastel purple
  '#d9ead3', // pastel green
  '#FFB6C1', // light pink
  '#DDA0DD', // plum
  '#f18a8a', // pastel red
]

// Colores para ingresos/gastos/beneficios usando paleta pastel
const incomeColor = '#A8D5E2' // pastel blue
const expenseColor = '#f18a8a' // pastel red
const benefitColor = '#14B8A6' // mismo color que KPI de beneficios

const colors = {
  income: incomeColor,
  expense: expenseColor,
  benefit: benefitColor,
  background: '#f8fafc',
  card: '#ffffff',
  text: {
    primary: '#1f2937',
    secondary: '#6b7280',
    muted: '#9ca3af',
  },
  active: '#90EBD6',
  activeText: '#0d9488',
  border: '#e5e7eb',
}

// Skeleton Loader
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
      <div className="h-8 bg-gray-200 rounded w-2/3"></div>
    </div>
  )
}

type ChartViewType = 'income-expense-benefit' | 'categories' | 'subcategories'
type ActiveSection = 'general' | 'details' | 'comparator'

export default function AnalyticsPageClient({
  idFamily,
  idUser,
  familyMembers,
  categories: initialCategories,
  tags: initialTags,
}: AnalyticsPageClientProps) {
  // Estados principales
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<ActiveSection>('general')
  const [chartViewType, setChartViewType] = useState<ChartViewType>('income-expense-benefit')
  
  // Filtros
  const [filtersVisible, setFiltersVisible] = useState(false)
  const [filters, setFilters] = useState<AnalyticsFilters>({
    idFamily,
    idUsers: [idUser], // Por defecto, filtrar por el usuario actual
    idCategories: null,
    idSubcategories: null,
    idTags: null,
    monthsDeclared: null,
    dateFrom: null,
    dateTo: null,
    startMonth: null,
    endMonth: null,
  })

  // Datos - cargar todos al inicio
  const [allTransactionsRaw, setAllTransactionsRaw] = useState<TransactionWithRelations[]>([])
  const [allTransactions, setAllTransactions] = useState<TransactionWithRelations[]>([])
  const [totalSummary, setTotalSummary] = useState({ income: 0, expense: 0, benefit: 0 })
  const [medianMonthlyBenefit, setMedianMonthlyBenefit] = useState(0)
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([])
  const [categorySummary, setCategorySummary] = useState<CategorySummary[]>([])
  const [subcategorySummary, setSubcategorySummary] = useState<SubcategorySummary[]>([])

  // Sección Detalle
  const [detailsTransactions, setDetailsTransactions] = useState<TransactionWithRelations[]>([])
  const [detailsCategoryFilter, setDetailsCategoryFilter] = useState<string>('')
  const [detailsSubcategoryFilter, setDetailsSubcategoryFilter] = useState<string>('')
  const [detailsTransactionTypeFilter, setDetailsTransactionTypeFilter] = useState<{ income: boolean; expense: boolean }>({ income: true, expense: true })
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithRelations | null>(null)
  
  // Tooltip activo para móvil
  const [activeTooltip, setActiveTooltip] = useState<{ x: number; y: number; data: any; type: 'category' | 'subcategory' } | null>(null)

  // Sección Comparador
  const [comparatorCases, setComparatorCases] = useState<ComparatorCase[]>([])
  const [comparisonResult, setComparisonResult] = useState<MultiCaseComparison | null>(null)

  // Obtener meses disponibles
  const getAvailableMonths = (): Array<{ value: string; label: string }> => {
    const months = new Set<string>()
    allTransactions.forEach(t => {
      if (t.ds_month_declared) {
        months.add(t.ds_month_declared)
      }
    })
    return Array.from(months)
      .sort()
      .reverse()
      .map(m => {
        const [year, month] = m.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1)
        return {
          value: m,
          label: date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
        }
      })
  }

  const availableMonths = getAvailableMonths()

  // Cargar todos los datos al inicio (sin filtros)
  const loadAllData = async () => {
    setLoading(true)
    try {
      const filtersToUse: AnalyticsFilters = {
        idFamily,
        idUsers: null,
        idCategories: null,
        idSubcategories: null,
        idTags: null,
        monthsDeclared: null,
        dateFrom: null,
        dateTo: null,
        startMonth: null,
        endMonth: null,
      }
      
      const transactions = await getTransactionsForAnalytics(supabase, filtersToUse)
      setAllTransactionsRaw(transactions)
    } catch (err) {
      console.error('Error al cargar datos:', err)
    } finally {
      setLoading(false)
    }
  }

  // Aplicar filtros en el frontend
  const applyFilters = useCallback(() => {
    let filtered = [...allTransactionsRaw]

    // Filtros de usuarios
    if (filters.idUsers && filters.idUsers.length > 0) {
      filtered = filtered.filter(t => {
        if (!t.users || t.users.length === 0) return false
        return t.users.some(u => filters.idUsers!.includes(u.id_user))
      })
    }

    // Filtros de categorías
    if (filters.idCategories && filters.idCategories.length > 0) {
      filtered = filtered.filter(t => t.id_category && filters.idCategories!.includes(t.id_category))
    }

    // Filtros de subcategorías
    if (filters.idSubcategories && filters.idSubcategories.length > 0) {
      filtered = filtered.filter(t => t.id_subcategory && filters.idSubcategories!.includes(t.id_subcategory))
    }

    // Filtros de tags
    if (filters.idTags && filters.idTags.length > 0) {
      filtered = filtered.filter(t => {
        if (!t.tag) return false
        return filters.idTags!.includes(t.tag.id_tag)
      })
    }

    // Filtros de meses declarados
    if (filters.monthsDeclared && filters.monthsDeclared.length > 0) {
      filtered = filtered.filter(t => t.ds_month_declared && filters.monthsDeclared!.includes(t.ds_month_declared))
    }

    // Filtros de fecha
    if (filters.dateFrom) {
      filtered = filtered.filter(t => t.dt_date >= filters.dateFrom!)
    }
    if (filters.dateTo) {
      filtered = filtered.filter(t => t.dt_date <= filters.dateTo!)
    }

    // Filtros de mes declarado desde/hasta
    if (filters.startMonth) {
      filtered = filtered.filter(t => {
        if (!t.ds_month_declared) return false
        return t.ds_month_declared >= filters.startMonth!
      })
    }
    if (filters.endMonth) {
      filtered = filtered.filter(t => {
        if (!t.ds_month_declared) return false
        return t.ds_month_declared <= filters.endMonth!
      })
    }

    setAllTransactions(filtered)

    // Calcular resúmenes
    const totals = calculateTotalSummary(filtered)
    const monthly = calculateMonthlySummary(filtered)
    const median = calculateMedianMonthlyBenefit(filtered)
    const categories = calculateCategorySummary(filtered)
    const subcategories = calculateSubcategorySummary(filtered)

    setTotalSummary(totals)
    setMonthlySummary(monthly)
    setMedianMonthlyBenefit(median)
    setCategorySummary(categories)
    setSubcategorySummary(subcategories)

    // Para sección Detalle
    setDetailsTransactions(filtered)
  }, [allTransactionsRaw, filters])

  // Cargar datos iniciales
  useEffect(() => {
    loadAllData()
  }, [])

  // Aplicar filtros cuando cambian
  useEffect(() => {
    if (allTransactionsRaw.length > 0 && activeSection !== 'comparator') {
      applyFilters()
    }
  }, [allTransactionsRaw, filters, activeSection, applyFilters])

  // Cargar comparador (usa datos ya cargados)
  const loadComparator = useCallback(() => {
    if (comparatorCases.length < 2) {
      setComparisonResult(null)
      return
    }

    try {
      // Aplicar filtros globales (fecha desde/hasta, mes declarado desde/hasta) a los datos ya cargados
      let filteredForComparator = [...allTransactionsRaw]

      if (filters.dateFrom) {
        filteredForComparator = filteredForComparator.filter(t => t.dt_date >= filters.dateFrom!)
      }
      if (filters.dateTo) {
        filteredForComparator = filteredForComparator.filter(t => t.dt_date <= filters.dateTo!)
      }
      if (filters.startMonth) {
        filteredForComparator = filteredForComparator.filter(t => {
          if (!t.ds_month_declared) return false
          return t.ds_month_declared >= filters.startMonth!
        })
      }
      if (filters.endMonth) {
        filteredForComparator = filteredForComparator.filter(t => {
          if (!t.ds_month_declared) return false
          return t.ds_month_declared <= filters.endMonth!
        })
      }

      const result = compareMultipleCases(filteredForComparator, comparatorCases, {
        dateFrom: filters.dateFrom || null,
        dateTo: filters.dateTo || null,
        startMonth: filters.startMonth || null,
        endMonth: filters.endMonth || null,
      })

      setComparisonResult(result)
    } catch (err) {
      console.error('Error al cargar comparador:', err)
    }
  }, [allTransactionsRaw, comparatorCases, filters.dateFrom, filters.dateTo, filters.startMonth, filters.endMonth])

  // Ya no necesitamos este useEffect, los filtros se aplican automáticamente

  useEffect(() => {
    if (activeSection === 'comparator' && allTransactionsRaw.length > 0) {
      loadComparator()
    }
  }, [activeSection, allTransactionsRaw, loadComparator])

  // Preparar datos para gráfico de barras temporal
  const getBarChartData = () => {
    if (chartViewType === 'income-expense-benefit') {
      return monthlySummary.map(m => {
        const maxValue = Math.max(m.income, m.expense, Math.abs(m.benefit))
        const total = m.income + m.expense + Math.abs(m.benefit)
        const scale = total > 0 ? maxValue / total : 1

        return {
          month: m.monthDisplay,
          monthValue: m.month,
          maxValue,
          income: m.income * scale,
          expense: m.expense * scale,
          benefit: Math.abs(m.benefit) * scale,
          // Valores reales para tooltip
          incomeReal: m.income,
          expenseReal: m.expense,
          benefitReal: m.benefit,
        }
      })
    } else if (chartViewType === 'categories') {
      // Agrupar por mes y categoría
      const monthlyCategoryData: Record<string, Record<string, number>> = {}
      monthlySummary.forEach(m => {
        monthlyCategoryData[m.month] = {}
      })

      // Calcular totales por mes y categoría
      allTransactions
        .filter(t => t.transactionType === 'Expense' && t.category)
        .forEach(t => {
          const month = t.ds_month_declared || t.dt_date.substring(0, 7)
          const catName = t.category!.ds_category
          if (monthlyCategoryData[month]) {
            monthlyCategoryData[month][catName] = (monthlyCategoryData[month][catName] || 0) + (t.ft_amount || 0)
          }
        })

      // Top 10 categorías globales
      const topCategories = categorySummary.slice(0, 10).map(c => c.ds_category)
      const otherCategories = categorySummary.slice(10).map(c => c.ds_category)

      return monthlySummary.map(m => {
        const categoryValues = monthlyCategoryData[m.month] || {}
        const values = Object.values(categoryValues)
        const maxValue = values.length > 0 ? Math.max(...values) : 0
        const total = values.reduce((sum, v) => sum + v, 0)
        const scale = total > 0 ? maxValue / total : 1

        const result: any = {
          month: m.monthDisplay,
          monthValue: m.month,
          maxValue,
        }

        // Top 10 categorías
        topCategories.forEach(catName => {
          const value = categoryValues[catName] || 0
          result[catName] = value * scale
          result[`${catName}_real`] = value
        })

        // Resto en "Otros"
        const otherTotal = otherCategories.reduce((sum, catName) => {
          return sum + (categoryValues[catName] || 0)
        }, 0)
        if (otherTotal > 0) {
          result['Otros'] = otherTotal * scale
          result['Otros_real'] = otherTotal
        }

        return result
      })
    } else {
      // Subcategorías
      const monthlySubcategoryData: Record<string, Record<string, number>> = {}
      monthlySummary.forEach(m => {
        monthlySubcategoryData[m.month] = {}
      })

      // Calcular totales por mes y subcategoría
      allTransactions
        .filter(t => t.transactionType === 'Expense' && t.subcategory)
        .forEach(t => {
          const month = t.ds_month_declared || t.dt_date.substring(0, 7)
          const subcatName = t.subcategory!.ds_subcategory
          if (monthlySubcategoryData[month]) {
            monthlySubcategoryData[month][subcatName] = (monthlySubcategoryData[month][subcatName] || 0) + (t.ft_amount || 0)
          }
        })

      // Top 10 subcategorías globales
      const topSubcategories = subcategorySummary.slice(0, 10).map(s => s.ds_subcategory)
      const otherSubcategories = subcategorySummary.slice(10).map(s => s.ds_subcategory)

      return monthlySummary.map(m => {
        const subcategoryValues = monthlySubcategoryData[m.month] || {}
        const values = Object.values(subcategoryValues)
        const maxValue = values.length > 0 ? Math.max(...values) : 0
        const total = values.reduce((sum, v) => sum + v, 0)
        const scale = total > 0 ? maxValue / total : 1

        const result: any = {
          month: m.monthDisplay,
          monthValue: m.month,
          maxValue,
        }

        // Top 10 subcategorías
        topSubcategories.forEach(subcatName => {
          const value = subcategoryValues[subcatName] || 0
          result[subcatName] = value * scale
          result[`${subcatName}_real`] = value
        })

        // Resto en "Otros"
        const otherTotal = otherSubcategories.reduce((sum, subcatName) => {
          return sum + (subcategoryValues[subcatName] || 0)
        }, 0)
        if (otherTotal > 0) {
          result['Otros'] = otherTotal * scale
          result['Otros_real'] = otherTotal
        }

        return result
      })
    }
  }

  // Preparar datos para pie charts (máximo 10, resto en "Otros")
  const getPieChartData = (data: CategorySummary[] | SubcategorySummary[], maxItems: number = 10) => {
    const top = data.slice(0, maxItems)
    const others = data.slice(maxItems)
    const othersTotal = others.reduce((sum, item) => sum + item.total, 0)

    const result = top.map((item: CategorySummary | SubcategorySummary) => {
      // Si tiene id_subcategory, es SubcategorySummary y usamos ds_subcategory
      // Si no, es CategorySummary y usamos ds_category
      const name = 'id_subcategory' in item ? (item as SubcategorySummary).ds_subcategory : (item as CategorySummary).ds_category
      return {
        name,
        value: item.total,
        percentage: item.percentage,
      }
    })

    if (othersTotal > 0) {
      const total = data.reduce((sum, item) => sum + item.total, 0)
      result.push({
        name: 'Otros',
        value: othersTotal,
        percentage: total > 0 ? (othersTotal / total) * 100 : 0,
      })
    }

    return result
  }

  // Filtrar transacciones para sección Detalle
  const getFilteredDetailsTransactions = () => {
    return detailsTransactions.filter(t => {
      // Filtro de tipo (puede estar ambos seleccionados o solo uno)
      if (t.transactionType === 'Income' && !detailsTransactionTypeFilter.income) {
        return false
      }
      if (t.transactionType === 'Expense' && !detailsTransactionTypeFilter.expense) {
        return false
      }
      if (detailsCategoryFilter && t.id_category !== detailsCategoryFilter) {
        return false
      }
      if (detailsSubcategoryFilter && t.id_subcategory !== detailsSubcategoryFilter) {
        return false
      }
      return true
    })
  }

  // Borrar transacción
  const handleDeleteTransaction = async (idTransaction: string) => {
    if (!confirm('¿Estás seguro de que quieres borrar esta transacción?\n\nEsta acción es irreversible.')) {
      return
    }

    try {
      await deleteTransaction(supabase, idTransaction)
      // Recargar datos
      await loadAllData()
    } catch (err) {
      console.error('Error al borrar transacción:', err)
      alert('Error al borrar la transacción. Por favor, inténtalo de nuevo.')
    }
  }

  // Añadir casuística al comparador
  const addComparatorCase = () => {
    const newCase: ComparatorCase = {
      id: `case-${Date.now()}`,
      monthDeclared: null,
      idCategory: null,
      idSubcategory: null,
      idTag: null,
      label: `Caso ${String.fromCharCode(65 + comparatorCases.length)}`,
    }
    setComparatorCases([...comparatorCases, newCase])
  }

  // Eliminar casuística del comparador
  const removeComparatorCase = (id: string) => {
    setComparatorCases(comparatorCases.filter(c => c.id !== id))
  }

  // Actualizar casuística del comparador
  const updateComparatorCase = (id: string, updates: Partial<ComparatorCase>) => {
    setComparatorCases(comparatorCases.map(c => c.id === id ? { ...c, ...updates } : c))
  }

  // Validar casuística (al menos un campo debe estar relleno)
  const isValidCase = (case_: ComparatorCase): boolean => {
    return !!(case_.monthDeclared || case_.idCategory || case_.idSubcategory || case_.idTag || (case_.idUsers && case_.idUsers.length > 0))
  }

  if (loading && activeSection !== 'comparator') {
      return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonCard />
        </div>
        </div>
      )
  }

  const barChartData = getBarChartData()
  const categoryPieData = getPieChartData(categorySummary)
  const subcategoryPieData = getPieChartData(subcategorySummary, 10)
  const filteredDetails = getFilteredDetailsTransactions()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            {/* Botón volver en móvil */}
            <Link
              href="/"
              className="lg:hidden text-gray-600 hover:text-gray-900 transition-colors touch-manipulation p-2 -ml-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </Link>
          <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold italic text-gray-900 mb-1.5">
              Analítica
            </h1>
              <p className="text-sm sm:text-base text-gray-500">
              Análisis financiero inteligente
            </p>
          </div>
          </div>
          {/* Botón volver en desktop */}
          <Link
            href="/"
            className="hidden lg:flex text-sm font-medium items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors touch-manipulation min-h-[44px]"
            style={{ color: colors.active }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Volver
          </Link>
        </div>

        {/* KPIs Globales */}
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-4 md:gap-6 mb-6 sm:mb-8">
          <div className="bg-gray-50 rounded-2xl shadow-sm border border-gray-100 relative p-2 sm:p-5 md:p-6">
            <div className="mb-1 sm:mb-2">
              <h3 className="text-[8px] sm:text-[10px] md:text-xs font-bold text-gray-600 uppercase tracking-wider">Ingresos Totales</h3>
                  </div>
            <p className="text-sm sm:text-2xl md:text-3xl lg:text-4xl font-extrabold mb-1" style={{ color: colors.income }}>
              {formatCurrency(totalSummary.income)}
            </p>
                  </div>

          <div className="bg-gray-50 rounded-2xl shadow-sm border border-gray-100 relative p-2 sm:p-5 md:p-6">
            <div className="mb-1 sm:mb-2">
              <h3 className="text-[8px] sm:text-[10px] md:text-xs font-bold text-gray-600 uppercase tracking-wider">Beneficios Totales</h3>
                  </div>
            <p className={`text-sm sm:text-2xl md:text-3xl lg:text-4xl font-extrabold mb-1 ${totalSummary.benefit >= 0 ? 'text-[#14B8A6]' : 'text-[#f18a8a]'}`}>
              {formatCurrency(totalSummary.benefit)}
            </p>
                  </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 sm:p-5 md:p-6">
            <div className="mb-1 sm:mb-2">
              <h3 className="text-[8px] sm:text-[10px] md:text-xs font-bold text-gray-600 uppercase tracking-wider">Beneficio Medio Mensual</h3>
                  </div>
            <p className={`text-sm sm:text-2xl md:text-3xl lg:text-4xl font-extrabold mb-1 ${medianMonthlyBenefit >= 0 ? 'text-[#14B8A6]' : 'text-[#f18a8a]'}`}>
              {formatCurrency(medianMonthlyBenefit)}
            </p>
                </div>
        </div>

        {/* Filtros */}
        {(activeSection !== 'comparator' || filters.dateFrom || filters.dateTo || filters.startMonth || filters.endMonth) && (
          <>
            {/* Desktop: Filtros visibles */}
            <div className="hidden lg:block mb-6">
              <FiltersPanel
                filters={filters}
                setFilters={setFilters}
                familyMembers={familyMembers}
                categories={initialCategories}
                tags={initialTags}
                availableMonths={availableMonths}
                activeSection={activeSection}
              />
              </div>

            {/* Mobile: Filtros desplegables */}
            <div className="lg:hidden mb-6">
              <button
                onClick={() => setFiltersVisible(!filtersVisible)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white shadow-sm border border-gray-200 hover:bg-gray-50 transition-all touch-manipulation min-h-[44px]"
              >
                <span className="text-lg">🔍</span>
                <span className="text-sm font-medium text-gray-700">Filtros</span>
                {(filters.idUsers?.length || filters.idCategories?.length || filters.idSubcategories?.length || filters.idTags?.length || filters.monthsDeclared?.length) && (
                  <span className="w-2 h-2 rounded-full bg-gray-600"></span>
                )}
              </button>
              {filtersVisible && (
                <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <FiltersPanel
                    filters={filters}
                    setFilters={setFilters}
                    familyMembers={familyMembers}
                    categories={initialCategories}
                    tags={initialTags}
                    availableMonths={availableMonths}
                    activeSection={activeSection}
                  />
              </div>
              )}
              </div>
          </>
        )}

        {/* Tabs de Secciones */}
        <div className="mb-6">
          <div className="flex gap-2 border-b border-gray-200">
                <button
              onClick={() => setActiveSection('general')}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeSection === 'general'
                  ? 'border-[#90EBD6] text-[#0d9488]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              General
                </button>
                <button
              onClick={() => setActiveSection('details')}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeSection === 'details'
                  ? 'border-[#90EBD6] text-[#0d9488]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Detalle
                </button>
                <button
              onClick={() => setActiveSection('comparator')}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeSection === 'comparator'
                  ? 'border-[#90EBD6] text-[#0d9488]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
                >
                  Comparador
                </button>
          </div>
        </div>

        {/* Sección General */}
        {activeSection === 'general' && (
          <div className="space-y-6">
            {/* Selector de tipo de gráfico */}
            <div className="flex gap-1 sm:gap-2">
                <button
                onClick={() => setChartViewType('income-expense-benefit')}
                className={`flex-1 px-1 sm:px-4 py-1.5 sm:py-3 rounded-lg sm:rounded-xl border-2 transition-all text-[10px] sm:text-sm ${
                  chartViewType === 'income-expense-benefit'
                    ? 'border-[#90EBD6] bg-[#90EBD6]/10 text-[#0d9488] font-semibold'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                Beneficios
                </button>
                <button
                onClick={() => setChartViewType('categories')}
                className={`flex-1 px-1 sm:px-4 py-1.5 sm:py-3 rounded-lg sm:rounded-xl border-2 transition-all text-[10px] sm:text-sm ${
                  chartViewType === 'categories'
                    ? 'border-[#90EBD6] bg-[#90EBD6]/10 text-[#0d9488] font-semibold'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                Categorías
                </button>
              <button
                onClick={() => setChartViewType('subcategories')}
                className={`flex-1 px-1 sm:px-4 py-1.5 sm:py-3 rounded-lg sm:rounded-xl border-2 transition-all text-[10px] sm:text-sm ${
                  chartViewType === 'subcategories'
                    ? 'border-[#90EBD6] bg-[#90EBD6]/10 text-[#0d9488] font-semibold'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                Subcategorías
              </button>
            </div>

            {/* Gráfico de barras temporal */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Evolución Temporal</h2>
              {barChartData.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500">No hay datos para mostrar</p>
                </div>
              ) : (
                <div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: colors.text.secondary }} />
                      <YAxis tick={{ fontSize: 12, fill: colors.text.secondary }} />
                      <Tooltip 
                        wrapperStyle={{ zIndex: 9999 }}
                        contentStyle={{ backgroundColor: '#ffffff', border: '2px solid #d1d5db', borderRadius: '0.5rem', padding: '12px', opacity: 1, zIndex: 9999 }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                            <div className="bg-white rounded-lg shadow-xl border-2 border-gray-300 p-3" style={{ opacity: 1, backgroundColor: '#ffffff' }}>
                              <p className="text-sm font-semibold mb-2">{data.month}</p>
                              {chartViewType === 'income-expense-benefit' ? (
                                <>
                                  <p className="text-xs text-gray-600 mb-1">
                                    Ingresos: <span className="font-bold">{formatCurrency(data.incomeReal)}</span>
                                  </p>
                                  <p className="text-xs text-gray-600 mb-1">
                                    Gastos: <span className="font-bold">{formatCurrency(data.expenseReal)}</span>
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    Beneficio: <span className="font-bold">{formatCurrency(data.benefitReal)}</span>
                                  </p>
                                </>
                              ) : (
                                payload
                                  .filter((entry: any) => entry.value > 0)
                                  .map((entry: any, index: number) => {
                                    const realKey = `${entry.dataKey}_real`
                                    const realValue = data[realKey] || 0
                                    return (
                                      <p key={index} className="text-xs text-gray-600 mb-1">
                                        {entry.name}: <span className="font-bold">{formatCurrency(realValue)}</span>
                                      </p>
                                    )
                                  })
                              )}
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                    {chartViewType === 'income-expense-benefit' ? (
                      <>
                        {/* Ordenar de menor a mayor - el más pequeño va primero (más cerca del eje X) */}
                        {/* Para cada mes, ordenamos los valores y los apilamos de menor a mayor */}
                        {(() => {
                          // Ordenar por valor promedio para mantener consistencia visual
                          const avgValues = barChartData.length > 0 ? {
                            income: barChartData.reduce((sum, d) => sum + d.incomeReal, 0) / barChartData.length,
                            expense: barChartData.reduce((sum, d) => sum + d.expenseReal, 0) / barChartData.length,
                            benefit: barChartData.reduce((sum, d) => sum + Math.abs(d.benefitReal), 0) / barChartData.length,
                          } : { income: 0, expense: 0, benefit: 0 }
                          
                          const sorted = [
                            { key: 'income', value: avgValues.income, color: incomeColor, label: 'Ingresos' },
                            { key: 'expense', value: avgValues.expense, color: expenseColor, label: 'Gastos' },
                            { key: 'benefit', value: avgValues.benefit, color: benefitColor, label: 'Beneficio' },
                          ].sort((a, b) => a.value - b.value)
                          
                          return sorted.map(item => (
                            <Bar 
                              key={item.key} 
                              dataKey={item.key} 
                              stackId="a" 
                              fill={item.color} 
                              name={item.label}
                            />
                          ))
                        })()}
                      </>
                    ) : (
                      <>
                        {chartViewType === 'categories' ? (
                          <>
                            {/* Ordenar categorías por valor total (de menor a mayor) */}
                            {(() => {
                              const sortedCategories = [...categorySummary.slice(0, 10)].sort((a, b) => a.total - b.total)
                              return (
                                <>
                                  {sortedCategories.map((cat, index) => (
                                    <Bar 
                                      key={cat.id_category} 
                                      dataKey={cat.ds_category} 
                                      stackId="a" 
                                      fill={colorsArray[index % colorsArray.length]}
                                    />
                                  ))}
                                  {categorySummary.length > 10 && (
                                    <Bar 
                                      dataKey="Otros" 
                                      stackId="a" 
                                      fill={colorsArray[7]}
                                    />
                                  )}
                                </>
                              )
                            })()}
                          </>
                        ) : (
                          <>
                            {/* Ordenar subcategorías por valor total (de menor a mayor) */}
                            {(() => {
                              const sortedSubcategories = [...subcategorySummary.slice(0, 10)].sort((a, b) => a.total - b.total)
              return (
                                <>
                                  {sortedSubcategories.map((subcat, index) => (
                                    <Bar 
                                      key={subcat.id_subcategory} 
                                      dataKey={subcat.ds_subcategory} 
                                      stackId="a" 
                                      fill={colorsArray[index % colorsArray.length]}
                                    />
                                  ))}
                                  {subcategorySummary.length > 10 && (
                                    <Bar 
                                      dataKey="Otros" 
                                      stackId="a" 
                                      fill={colorsArray[7]}
                                    />
                                  )}
                                </>
                              )
                            })()}
                          </>
                        )}
                      </>
                    )}
                      <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        formatter={(value) => value}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                      </div>
              )}
                  </div>

            {/* Pie Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie Chart Categorías */}
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Distribución por Categoría</h2>
                {categoryPieData.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-gray-500">No hay datos</p>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <ResponsiveContainer width="100%" height={250}>
                              <PieChart>
                                <Pie
                          data={categoryPieData}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={false}
                          outerRadius={80}
                          innerRadius={40}
                                  fill="#8884d8"
                          dataKey="value"
                          onClick={(data: any, index: number, e: any) => {
                                    if (data && data.payload && e) {
                                      const entry = data.payload
                                      const nativeEvent = e.nativeEvent as MouseEvent | TouchEvent
                                      const clientX = 'touches' in nativeEvent ? nativeEvent.touches[0]?.clientX : nativeEvent.clientX
                                      const clientY = 'touches' in nativeEvent ? nativeEvent.touches[0]?.clientY : nativeEvent.clientY
                              setActiveTooltip({
                                        x: clientX || 0,
                                y: (clientY || 0) - 80,
                                data: {
                                  name: entry.name,
                                  value: entry.value,
                                  percentage: entry.percentage,
                                },
                                type: 'category'
                              })
                              setTimeout(() => setActiveTooltip(null), 3000)
                            }
                          }}
                        >
                            {categoryPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={colorsArray[index % colorsArray.length]} />
                            ))}
                                </Pie>
                                <Tooltip 
                            wrapperStyle={{ zIndex: 9999 }}
                            contentStyle={{ backgroundColor: '#ffffff', border: '2px solid #d1d5db', borderRadius: '0.5rem', padding: '12px', opacity: 1, zIndex: 9999 }}
                                  content={({ active, payload }) => {
                                    // Deshabilitar tooltip en dispositivos táctiles para evitar duplicación
                                    if (typeof window !== 'undefined' && 'ontouchstart' in window) {
                                      return null
                                    }
                                    if (active && payload && payload.length) {
                                const data = payload[0].payload
                                      return (
                                  <div className="bg-white rounded-lg shadow-xl border-2 border-gray-300 p-3" style={{ opacity: 1, backgroundColor: '#ffffff' }}>
                                    <p className="text-sm font-semibold mb-2">{data.name}</p>
                                    <p className="text-base font-bold mb-1">{formatCurrency(data.value)}</p>
                                    <p className="text-xs text-gray-500">{data.percentage.toFixed(1)}%</p>
                                        </div>
                                      )
                                    }
                                    return null
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                      {/* Total en el centro del donut */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mb-4">
                        <p className="text-xs text-gray-500 mb-1">Total</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(categoryPieData.reduce((sum, item) => sum + item.value, 0))}
                        </p>
                      </div>
                    </div>
                    {/* Leyenda fuera */}
                    <div className="mt-4 space-y-1 max-h-32 overflow-y-auto">
                      {categoryPieData.map((entry, index) => (
                        <div key={index} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <div 
                              className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: colorsArray[index % colorsArray.length] }}
                                      />
                            <span className="text-gray-700">{entry.name}</span>
                                    </div>
                          <span className="text-gray-600 font-medium">
                            {formatCurrency(entry.value)} ({entry.percentage.toFixed(1)}%)
                                      </span>
                                    </div>
                      ))}
                            </div>
                          </div>
                        )}
                      </div>

              {/* Pie Chart Subcategorías */}
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Distribución por Subcategoría</h2>
                {subcategoryPieData.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-gray-500">No hay datos</p>
                  </div>
                ) : (
                  <div className="relative">
                              <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                  <Pie
                          data={subcategoryPieData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={false}
                          outerRadius={80}
                          innerRadius={40}
                                    fill="#8884d8"
                          dataKey="value"
                          onClick={(data: any, index: number, e: any) => {
                                      if (data && data.payload && e) {
                                        const entry = data.payload
                                        const nativeEvent = e.nativeEvent as MouseEvent | TouchEvent
                                        const clientX = 'touches' in nativeEvent ? nativeEvent.touches[0]?.clientX : nativeEvent.clientX
                                        const clientY = 'touches' in nativeEvent ? nativeEvent.touches[0]?.clientY : nativeEvent.clientY
                              setActiveTooltip({
                                          x: clientX || 0,
                                y: (clientY || 0) - 80,
                                data: {
                                  name: entry.name,
                                  value: entry.value,
                                  percentage: entry.percentage,
                                },
                                type: 'subcategory'
                              })
                              setTimeout(() => setActiveTooltip(null), 3000)
                            }
                          }}
                        >
                          {subcategoryPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={colorsArray[index % colorsArray.length]} />
                          ))}
                                  </Pie>
                                  <Tooltip 
                                    content={({ active, payload }) => {
                                      // Deshabilitar tooltip en dispositivos táctiles para evitar duplicación
                                      if (typeof window !== 'undefined' && 'ontouchstart' in window) {
                                        return null
                                      }
                                      if (active && payload && payload.length) {
                              const data = payload[0].payload
                                        return (
                                <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3" style={{ opacity: 1 }}>
                                  <p className="text-sm font-semibold mb-2">{data.name}</p>
                                  <p className="text-base font-bold mb-1">{formatCurrency(data.value)}</p>
                                  <p className="text-xs text-gray-500">{data.percentage.toFixed(1)}%</p>
                                          </div>
                                        )
                                      }
                                      return null
                                    }}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                    {/* Total en el centro del donut */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ height: '250px' }}>
                      <p className="text-xs text-gray-500 mb-1">Total</p>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(subcategoryPieData.reduce((sum, item) => sum + item.value, 0))}
                      </p>
                            </div>
                    {/* Leyenda fuera */}
                    <div className="mt-4 space-y-1 max-h-32 overflow-y-auto">
                      {subcategoryPieData.map((entry, index) => (
                        <div key={index} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <div 
                              className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: colorsArray[index % colorsArray.length] }}
                                      />
                            <span className="text-gray-700">{entry.name}</span>
                          </div>
                          <span className="text-gray-600 font-medium">
                            {formatCurrency(entry.value)} ({entry.percentage.toFixed(1)}%)
                                        </span>
                                      </div>
                      ))}
                                    </div>
                                    </div>
                )}
                                  </div>
                            </div>
                          </div>
                        )}

        {/* Sección Detalle */}
        {activeSection === 'details' && (
          <DetailsSection
            transactions={filteredDetails}
            categories={initialCategories}
            detailsTransactionTypeFilter={detailsTransactionTypeFilter}
            setDetailsTransactionTypeFilter={setDetailsTransactionTypeFilter}
            setEditingTransaction={setEditingTransaction}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}

        {/* Sección Comparador */}
        {activeSection === 'comparator' && (
          <ComparatorSection
            cases={comparatorCases}
            comparisonResult={comparisonResult}
            addCase={addComparatorCase}
            removeCase={removeComparatorCase}
            updateCase={updateComparatorCase}
            isValidCase={isValidCase}
            categories={initialCategories}
            tags={initialTags}
            availableMonths={availableMonths}
            familyMembers={familyMembers}
          />
        )}

        {/* Modal de edición */}
        {editingTransaction && (
          <EditTransactionModal
            transaction={editingTransaction}
            idFamily={idFamily}
            idUser={idUser}
            familyMembers={familyMembers}
            categories={initialCategories}
            tags={initialTags}
            onClose={() => setEditingTransaction(null)}
            onSave={() => {
              setEditingTransaction(null)
              loadAllData()
            }}
          />
        )}

        {/* Tooltip móvil para pie charts */}
        {activeTooltip && (
          <>
            {/* Overlay para cerrar al tocar fuera */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setActiveTooltip(null)}
              onTouchStart={() => setActiveTooltip(null)}
            />
            {/* Tooltip */}
            <div
              className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3"
              style={{
                left: `${activeTooltip.x}px`,
                top: `${activeTooltip.y}px`,
                transform: 'translateX(-50%)',
                opacity: 1,
                minWidth: '140px',
              }}
            >
              <button
                onClick={() => setActiveTooltip(null)}
                className="absolute top-1 right-1 text-gray-400 hover:text-gray-600 active:text-gray-800 text-xl leading-none w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
                aria-label="Cerrar"
              >
                ×
              </button>
              <p className="text-sm font-semibold mb-2 pr-4">{activeTooltip.data.name}</p>
              <p className="text-base font-bold mb-1">{formatCurrency(activeTooltip.data.value)}</p>
              <p className="text-xs text-gray-500">{activeTooltip.data.percentage.toFixed(1)}%</p>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

// Componente de Filtros
function FiltersPanel({
  filters,
  setFilters,
  familyMembers,
  categories,
  tags,
  availableMonths,
  activeSection,
}: {
  filters: AnalyticsFilters
  setFilters: (filters: AnalyticsFilters) => void
  familyMembers: FamilyMember[]
  categories: Category[]
  tags: Tag[]
  availableMonths: Array<{ value: string; label: string }>
  activeSection: ActiveSection
}) {
  const updateArrayFilter = (key: 'idUsers' | 'idCategories' | 'idSubcategories' | 'idTags' | 'monthsDeclared', value: string, checked: boolean) => {
    const current = filters[key] || []
    if (checked) {
      setFilters({ ...filters, [key]: [...current, value] })
    } else {
      setFilters({ ...filters, [key]: current.filter(v => v !== value) })
    }
  }

  return (
    <div className="space-y-4">
      {activeSection !== 'comparator' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Categorías */}
          <div>
            <label className="block text-xs font-medium mb-2 text-gray-700">Categorías</label>
            <CompactMultiSelect
              items={categories.map(cat => ({ id: cat.id_category, label: cat.ds_category }))}
              selectedIds={filters.idCategories || []}
              onToggle={(id: string, checked: boolean) => updateArrayFilter('idCategories', id, checked)}
            />
          </div>

          {/* Subcategorías */}
          <div>
            <label className="block text-xs font-medium mb-2 text-gray-700">Subcategorías</label>
            <SubcategoriesFilter
              categories={categories}
              selectedSubcategories={filters.idSubcategories || []}
              onSubcategoryToggle={(subcatId: string, checked: boolean) => updateArrayFilter('idSubcategories', subcatId, checked)}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium mb-2 text-gray-700">Tags</label>
            <CompactMultiSelect
              items={tags.map(tag => ({ id: tag.id_tag, label: tag.ds_tag }))}
              selectedIds={filters.idTags || []}
              onToggle={(id: string, checked: boolean) => updateArrayFilter('idTags', id, checked)}
            />
          </div>

          {/* Mes Declarado */}
          <div>
            <label className="block text-xs font-medium mb-2 text-gray-700">Mes Declarado</label>
            <CompactMultiSelect
              items={availableMonths.map(m => ({ id: m.value, label: m.label }))}
              selectedIds={filters.monthsDeclared || []}
              onToggle={(id: string, checked: boolean) => updateArrayFilter('monthsDeclared', id, checked)}
            />
                                                </div>

          {/* Personas Afectadas */}
          <div>
            <label className="block text-xs font-medium mb-2 text-gray-700">Personas Afectadas</label>
            <CompactMultiSelect
              items={familyMembers.map(m => ({ id: m.id_user, label: m.ds_user || m.ds_email }))}
              selectedIds={filters.idUsers || []}
              onToggle={(id: string, checked: boolean) => updateArrayFilter('idUsers', id, checked)}
            />
                          </div>
        </div>
      )}

      {/* Filtros de fecha (siempre visibles en comparador) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium mb-2 text-gray-700">Fecha Desde</label>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || null })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#90EBD6] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]/20"
          />
                                          </div>

        <div>
          <label className="block text-xs font-medium mb-2 text-gray-700">Fecha Hasta</label>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || null })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#90EBD6] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]/20"
          />
                            </div>

        <div>
          <label className="block text-xs font-medium mb-2 text-gray-700">Mes Declarado Desde</label>
          <select
            value={filters.startMonth || ''}
            onChange={(e) => setFilters({ ...filters, startMonth: e.target.value || null })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#90EBD6] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]/20"
          >
            <option value="">Todos</option>
            {availableMonths.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
                                        </div>

        <div>
          <label className="block text-xs font-medium mb-2 text-gray-700">Mes Declarado Hasta</label>
          <select
            value={filters.endMonth || ''}
            onChange={(e) => setFilters({ ...filters, endMonth: e.target.value || null })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#90EBD6] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]/20"
          >
            <option value="">Todos</option>
            {availableMonths.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
                                        </div>
      </div>
    </div>
  )
}

// Componente de Sección Detalle
function DetailsSection({
  transactions,
  categories,
  detailsTransactionTypeFilter,
  setDetailsTransactionTypeFilter,
  setEditingTransaction,
  onDeleteTransaction,
}: {
  transactions: TransactionWithRelations[]
  categories: Category[]
  detailsTransactionTypeFilter: { income: boolean; expense: boolean }
  setDetailsTransactionTypeFilter: (value: { income: boolean; expense: boolean }) => void
  setEditingTransaction: (transaction: TransactionWithRelations | null) => void
  onDeleteTransaction: (idTransaction: string) => void
}) {

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Detalle de Transacciones</h2>

        {/* Botones de filtro de tipo (toggle) */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setDetailsTransactionTypeFilter({
              ...detailsTransactionTypeFilter,
              income: !detailsTransactionTypeFilter.income
            })}
            className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
              detailsTransactionTypeFilter.income
                ? 'border-[#90EBD6] bg-[#90EBD6]/10 text-[#0d9488] font-semibold'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            Ingresos
          </button>
          <button
            onClick={() => setDetailsTransactionTypeFilter({
              ...detailsTransactionTypeFilter,
              expense: !detailsTransactionTypeFilter.expense
            })}
            className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
              detailsTransactionTypeFilter.expense
                ? 'border-[#90EBD6] bg-[#90EBD6]/10 text-[#0d9488] font-semibold'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            Gastos
          </button>
                                        </div>

        {/* Tabla de transacciones */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Fecha</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Tipo</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Categoría</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Subcategoría</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Personas Afectadas</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Comentario</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700">Importe</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700">Acciones</th>
                                    </tr>
                                  </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-sm text-gray-500">
                    No hay transacciones
                                          </td>
                </tr>
              ) : (
                transactions.map(t => (
                  <tr key={t.id_transaction} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900">{formatDate(t.dt_date, 'long')}</td>
                    <td className="py-3 px-4 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        t.transactionType === 'Income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {t.transactionType === 'Income' ? 'Ingreso' : 'Gasto'}
                      </span>
                                          </td>
                    <td className="py-3 px-4 text-sm text-gray-900">{t.category?.ds_category || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{t.subcategory?.ds_subcategory || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {t.users && t.users.length > 0 
                        ? t.users.map(u => u.ds_user || 'Sin nombre').join(', ')
                        : '-'
                      }
                                          </td>
                    <td className="py-3 px-4 text-sm text-gray-900">{t.ds_comments || '-'}</td>
                    <td className="py-3 px-4 text-sm text-right font-semibold text-gray-900">
                      {formatCurrency(t.ft_amount || 0)}
                                          </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => setEditingTransaction(t)}
                          className="text-gray-600 hover:text-gray-900 transition-colors"
                          title="Editar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        <button
                          onClick={() => onDeleteTransaction(t.id_transaction)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          title="Borrar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                                          </td>
                                        </tr>
                ))
              )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                </div>
              )
}

// Componente de Sección Comparador
function ComparatorSection({
  cases,
  comparisonResult,
  addCase,
  removeCase,
  updateCase,
  isValidCase,
  categories,
  tags,
  availableMonths,
  familyMembers,
}: {
  cases: ComparatorCase[]
  comparisonResult: MultiCaseComparison | null
  addCase: () => void
  removeCase: (id: string) => void
  updateCase: (id: string, updates: Partial<ComparatorCase>) => void
  isValidCase: (case_: ComparatorCase) => boolean
  categories: Category[]
  tags: Tag[]
  availableMonths: Array<{ value: string; label: string }>
  familyMembers: FamilyMember[]
}) {
                  return (
                  <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Comparador de Casuísticas</h2>
          <button
            onClick={addCase}
            className="px-4 py-2 rounded-lg bg-[#90EBD6] text-white font-medium hover:bg-[#0d9488] transition-colors"
          >
            + Añadir Caso
          </button>
        </div>

        {/* Tabla de casuísticas */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Caso</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Mes Declarado</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Categoría</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Subcategoría</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Tag</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Personas Afectadas</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-sm text-gray-500">
                    Añade al menos 2 casuísticas para comparar
                  </td>
                </tr>
              ) : (
                cases.map((case_, index) => (
                  <tr key={case_.id} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-sm font-semibold text-gray-900">
                      {case_.label || `Caso ${String.fromCharCode(65 + index)}`}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={case_.monthDeclared || ''}
                        onChange={(e) => updateCase(case_.id, { monthDeclared: e.target.value || null })}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm"
                      >
                        <option value="">-</option>
                        {availableMonths.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={case_.idCategory || ''}
                        onChange={(e) => updateCase(case_.id, { idCategory: e.target.value || null })}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm"
                      >
                        <option value="">-</option>
                        {categories.map(cat => (
                          <option key={cat.id_category} value={cat.id_category}>{cat.ds_category}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      {case_.idCategory ? (
                        <ComparatorSubcategoriesLoader
                          categoryId={case_.idCategory}
                          value={case_.idSubcategory || ''}
                          onChange={(val) => updateCase(case_.id, { idSubcategory: val || null })}
                        />
                      ) : (
                        <select
                          disabled
                          className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm bg-gray-100"
                        >
                          <option value="">Selecciona categoría primero</option>
                        </select>
                      )}
                    </td>
                    <td className="py-3 px-4">
                        <select
                        value={case_.idTag || ''}
                        onChange={(e) => updateCase(case_.id, { idTag: e.target.value || null })}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm"
                      >
                        <option value="">-</option>
                        {tags.map(tag => (
                          <option key={tag.id_tag} value={tag.id_tag}>{tag.ds_tag}</option>
                          ))}
                        </select>
                    </td>
                    <td className="py-3 px-4">
                      <CompactMultiSelect
                        items={familyMembers.map(m => ({ id: m.id_user, label: m.ds_user || 'Sin nombre' }))}
                        selectedIds={case_.idUsers || []}
                        onToggle={(id: string, checked: boolean) => {
                          const currentUsers = case_.idUsers || []
                          const newUsers = checked
                            ? [...currentUsers, id]
                            : currentUsers.filter(u => u !== id)
                          updateCase(case_.id, { idUsers: newUsers.length > 0 ? newUsers : null })
                        }}
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => removeCase(case_.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
                </div>

        {/* Resultados de comparación */}
        {comparisonResult && cases.length >= 2 && cases.every(c => isValidCase(c)) && (
                  <div className="space-y-6">
            {/* Comparación Total - Métricas en la misma tarjeta */}
                    <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Comparación Total</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Tarjeta de Ingresos */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Ingresos</h4>
                  <div className="space-y-2">
                    {comparisonResult.cases.map((result, index) => (
                      <div key={result.case.id}>
                        <p className="text-xs text-gray-500">{result.case.label || `Caso ${String.fromCharCode(65 + index)}`}</p>
                        <p className="text-lg font-bold" style={{ color: colors.income }}>
                          {formatCurrency(result.income)}
                        </p>
                            </div>
                    ))}
                          </div>
                        </div>

                {/* Tarjeta de Gastos */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Gastos</h4>
                  <div className="space-y-2">
                    {comparisonResult.cases.map((result, index) => (
                      <div key={result.case.id}>
                        <p className="text-xs text-gray-500">{result.case.label || `Caso ${String.fromCharCode(65 + index)}`}</p>
                        <p className="text-lg font-bold" style={{ color: colors.expense }}>
                          {formatCurrency(result.expense)}
                        </p>
                            </div>
                    ))}
                          </div>
                        </div>

                {/* Tarjeta de Beneficios */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Beneficios</h4>
                  <div className="space-y-2">
                    {comparisonResult.cases.map((result, index) => (
                      <div key={result.case.id}>
                        <p className="text-xs text-gray-500">{result.case.label || `Caso ${String.fromCharCode(65 + index)}`}</p>
                        <p className={`text-lg font-bold ${result.benefit >= 0 ? 'text-[#14B8A6]' : 'text-[#f18a8a]'}`}>
                          {formatCurrency(result.benefit)}
                        </p>
                            </div>
                    ))}
                          </div>
                        </div>
                      </div>
                    </div>

            {/* Comparación por Categoría */}
                    <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Comparación por Categoría</h3>
                        <div className="overflow-x-auto">
                <table className="w-full">
                            <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Categoría</th>
                      {comparisonResult.cases.map((result, index) => (
                        <th key={result.case.id} className="text-right py-3 px-4 text-xs font-semibold text-gray-700">
                          {result.case.label || `Caso ${String.fromCharCode(65 + index)}`}
                                </th>
                      ))}
                              </tr>
                            </thead>
                  <tbody>
                    {comparisonResult.categoryComparison.map(cat => (
                      <tr key={cat.id_category} className="border-b border-gray-100">
                        <td className="py-3 px-4 text-sm text-gray-900">{cat.category}</td>
                        {comparisonResult.cases.map(result => (
                          <td key={result.case.id} className="py-3 px-4 text-sm text-right font-semibold text-gray-900">
                            {formatCurrency(cat.values[result.case.id] || 0)}
                                  </td>
                        ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                      </div>
                    </div>

            {/* Top 5 separados por métrica y caso */}
                    <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Top 5 Gastos, Categorías y Subcategorías</h3>
              
              {/* Top 5 Gastos - Separado por caso */}
              <div className="mb-6">
                <h4 className="text-base font-semibold text-gray-900 mb-3">Top 5 Gastos</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {comparisonResult.cases.map((result, index) => (
                    <div key={result.case.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <h5 className="text-sm font-semibold text-gray-700 mb-2">
                        {result.case.label || `Caso ${String.fromCharCode(65 + index)}`}
                      </h5>
                          <div className="space-y-2">
                        {result.top5Expenses.map((expense) => (
                          <div key={expense.id_transaction} className="flex items-start justify-between gap-2 pb-2 border-b border-gray-200 last:border-0">
                            <div className="flex-1">
                              <div className="text-sm text-gray-900 font-medium">
                                {expense.ds_comments ? (
                                  <>{expense.ds_comments} - {expense.category?.ds_category || '-'}</>
                                ) : (
                                  <>{expense.category?.ds_category || '-'}</>
                                )}
                                {expense.subcategory?.ds_subcategory && (
                                  <> - {expense.subcategory.ds_subcategory}</>
                            )}
                          </div>
                              <div className="text-xs text-gray-400 mt-1">
                                {formatDate(expense.dt_date, 'long')}
                        </div>
                                  </div>
                            <div className="text-sm font-semibold text-gray-900">
                              {formatCurrency(expense.ft_amount || 0)}
                                </div>
                          </div>
                        ))}
                    </div>
                    </div>
                  ))}
                                              </div>
                                </div>

              {/* Top 5 Categorías - Separado por caso */}
              <div className="mb-6">
                <h4 className="text-base font-semibold text-gray-900 mb-3">Top 5 Categorías</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {comparisonResult.cases.map((result, index) => (
                    <div key={result.case.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <h5 className="text-sm font-semibold text-gray-700 mb-2">
                        {result.case.label || `Caso ${String.fromCharCode(65 + index)}`}
                      </h5>
                      <div className="space-y-2">
                        {result.top5Categories.map((cat) => (
                          <div key={cat.id_category} className="flex items-start justify-between gap-2 pb-2 border-b border-gray-200 last:border-0">
                                      <div className="flex-1">
                              <div className="text-sm text-gray-900 font-medium">
                                {cat.ds_category}
                                        </div>
                              <div className="text-xs text-gray-400 mt-1">
                                {cat.percentage.toFixed(1)}%
                                        </div>
                                      </div>
                            <div className="text-sm font-semibold text-gray-900">
                              {formatCurrency(cat.total)}
                            </div>
                                    </div>
                                  ))}
                                </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

              {/* Top 5 Subcategorías - Separado por caso */}
                                      <div>
                <h4 className="text-base font-semibold text-gray-900 mb-3">Top 5 Subcategorías</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {comparisonResult.cases.map((result, index) => (
                    <div key={result.case.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <h5 className="text-sm font-semibold text-gray-700 mb-2">
                        {result.case.label || `Caso ${String.fromCharCode(65 + index)}`}
                      </h5>
                      <div className="space-y-2">
                        {result.top5Subcategories.map((subcat) => (
                          <div key={subcat.id_subcategory} className="flex items-start justify-between gap-2 pb-2 border-b border-gray-200 last:border-0">
                            <div className="flex-1">
                              <div className="text-sm text-gray-900 font-medium">
                                          {subcat.ds_subcategory}
                                      </div>
                              <div className="text-xs text-gray-400 mt-1">
                                {subcat.percentage.toFixed(1)}%
                                    </div>
                                </div>
                            <div className="text-sm font-semibold text-gray-900">
                              {formatCurrency(subcat.total)}
                              </div>
                            </div>
                        ))}
                              </div>
                                          </div>
                                    ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

        {cases.length < 2 && (
          <div className="text-center py-8 text-sm text-gray-500">
            Necesitas al menos 2 casuísticas válidas para comparar
                              </div>
                            )}
                                        </div>
                    </div>
                  )
}

// Componente para filtrar subcategorías (carga dinámicamente)
function SubcategoriesFilter({
  categories,
  selectedSubcategories,
  onSubcategoryToggle,
}: {
  categories: Category[]
  selectedSubcategories: string[]
  onSubcategoryToggle: (subcatId: string, checked: boolean) => void
}) {
  const [subcategoriesMap, setSubcategoriesMap] = useState<Record<string, Array<{ id_subcategory: string; ds_subcategory: string }>>>({})
  const [loadingCategories, setLoadingCategories] = useState<Set<string>>(new Set())

  // Cargar subcategorías para todas las categorías
  useEffect(() => {
    const loadAllSubcategories = async () => {
      const map: Record<string, Array<{ id_subcategory: string; ds_subcategory: string }>> = {}
      for (const cat of categories) {
        try {
          setLoadingCategories(prev => new Set(prev).add(cat.id_category))
          const subs = await getSubcategoriesByCategory(supabase, cat.id_category)
          map[cat.id_category] = subs.map(s => ({
            id_subcategory: s.id_subcategory,
            ds_subcategory: s.ds_subcategory,
          }))
        } catch (err) {
          console.error(`Error al cargar subcategorías de ${cat.ds_category}:`, err)
          map[cat.id_category] = []
        } finally {
          setLoadingCategories(prev => {
            const newSet = new Set(prev)
            newSet.delete(cat.id_category)
            return newSet
          })
        }
      }
      setSubcategoriesMap(map)
    }
    loadAllSubcategories()
  }, [categories])

  const allSubcategories = Object.values(subcategoriesMap).flat()

  return (
    <CompactMultiSelect
      items={allSubcategories.map(s => ({ id: s.id_subcategory, label: s.ds_subcategory }))}
      selectedIds={selectedSubcategories}
      onToggle={onSubcategoryToggle}
    />
  )
}

// Componente helper para cargar subcategorías en el comparador
function ComparatorSubcategoriesLoader({
  categoryId,
  value,
  onChange,
}: {
  categoryId: string
  value: string
  onChange: (value: string) => void
}) {
  const [subcategories, setSubcategories] = useState<Array<{ id_subcategory: string; ds_subcategory: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const subs = await getSubcategoriesByCategory(supabase, categoryId)
        setSubcategories(subs.map(s => ({
                                  id_subcategory: s.id_subcategory,
          ds_subcategory: s.ds_subcategory,
        })))
      } catch (err) {
        console.error('Error al cargar subcategorías:', err)
        setSubcategories([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [categoryId])

  return (
                        <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm"
      disabled={loading}
    >
      <option value="">-</option>
      {subcategories.map(subcat => (
                            <option key={subcat.id_subcategory} value={subcat.id_subcategory}>
                              {subcat.ds_subcategory}
                            </option>
                          ))}
                        </select>
  )
}

// Componente CompactMultiSelect para filtros más compactos
function CompactMultiSelect({
  items,
  selectedIds,
  onToggle,
}: {
  items: Array<{ id: string; label: string }>
  selectedIds: string[]
  onToggle: (id: string, checked: boolean) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedCount = selectedIds.length
                              
                              return (
    <div className="relative">
                                      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-left bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#90EBD6]/20 focus:border-[#90EBD6] flex items-center justify-between"
      >
        <span className="text-gray-700">
          {selectedCount === 0 ? 'Seleccionar...' : `${selectedCount} seleccionado${selectedCount > 1 ? 's' : ''}`}
        </span>
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
            {items.map(item => (
              <label key={item.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={(e) => onToggle(item.id, e.target.checked)}
                  className="rounded border-gray-300"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-sm text-gray-700">{item.label}</span>
              </label>
            ))}
                                    </div>
          </>
        )}
    </div>
  )
}
