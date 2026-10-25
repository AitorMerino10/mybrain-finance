'use client'

import { useMemo, useRef, useState } from 'react'
import {
  buildExpenseGroups,
  computeStats,
  formatMoney,
  sumSeries,
  type PeriodRow,
} from '@/lib/budget-calculator'
import MonthlyBreakdown, {
  buildBreakdownCategories,
  type BreakdownSelection,
} from './MonthlyBreakdown'
import PeriodSelector from './PeriodSelector'
import TransactionsTable, { EMPTY_TABLE_FILTER, type TableFilter } from './TransactionsTable'

export default function IncomeHistory({
  from,
  to,
  months,
  minMonth,
  maxMonth,
  onPeriodChange,
  rows,
  onUseAverage,
}: {
  from: string
  to: string
  months: string[]
  minMonth: string | null
  maxMonth: string | null
  onPeriodChange: (from: string, to: string) => void
  rows: PeriodRow[]
  onUseAverage: (monthlyAverage: number) => void
}) {
  const [tableFilter, setTableFilter] = useState<TableFilter>(EMPTY_TABLE_FILTER)
  const tableRef = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => buildExpenseGroups(rows, months), [rows, months])
  const categories = useMemo(() => buildBreakdownCategories(groups, months.length), [groups, months.length])
  const stats = useMemo(
    () =>
      computeStats(
        sumSeries(
          groups.map((group) => group.series),
          months.length
        )
      ),
    [groups, months.length]
  )

  const showTransactions = (selection: BreakdownSelection) => {
    setTableFilter({
      ...EMPTY_TABLE_FILTER,
      category: selection.category ?? '',
      subcategory: selection.subcategory ?? '',
      month: selection.month ?? '',
    })
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  const cards = [
    { label: 'Total del periodo', value: stats.total },
    { label: 'Media mensual', value: stats.avg },
    { label: 'Mediana mensual', value: stats.median },
    { label: 'Anualizado (media × 12)', value: stats.avg * 12 },
  ]

  return (
    <section className="space-y-5 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Histórico de ingresos</h3>
        <p className="text-sm text-gray-500">
          Lo que has ingresado de verdad en el periodo (por mes declarado). El periodo es el mismo que el del análisis de
          gastos.
        </p>
      </div>

      <PeriodSelector
        from={from}
        to={to}
        monthsCount={months.length}
        minMonth={minMonth}
        maxMonth={maxMonth}
        onChange={onPeriodChange}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl bg-gray-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{card.label}</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-gray-900">{formatMoney(card.value)}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#90EBD6]/20 p-4 text-sm text-gray-700">
        <span>
          Ingresaste una media de <strong>{formatMoney(stats.avg)}/mes</strong> en {stats.monthsWithSpend} de{' '}
          {months.length} meses con ingresos.
        </span>
        <button
          type="button"
          onClick={() => onUseAverage(Math.round(stats.avg * 100) / 100)}
          disabled={stats.avg <= 0}
          className="rounded-xl bg-[#0d9488] px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-40"
        >
          Usar la media como ingreso mensual
        </button>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-gray-900">Ingresos por mes, categoría y subcategoría</h4>
        <MonthlyBreakdown months={months} categories={categories} onSelect={showTransactions} />
      </div>

      <div ref={tableRef} className="scroll-mt-24">
        <h4 className="mb-2 text-sm font-semibold text-gray-900">Transacciones de ingreso</h4>
        <TransactionsTable
          rows={rows}
          assignments={{}}
          budgetTypes={[]}
          filter={tableFilter}
          onFilterChange={setTableFilter}
          showBudgetType={false}
        />
      </div>
    </section>
  )
}
