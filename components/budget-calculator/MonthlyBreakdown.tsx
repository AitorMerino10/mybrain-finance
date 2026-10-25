'use client'

import { useState } from 'react'
import { computeStats, formatMoney, sumSeries, type ExpenseGroup, type SeriesStats } from '@/lib/budget-calculator'

export type BreakdownCategory = {
  id: string
  name: string
  groups: ExpenseGroup[]
  series: number[]
  stats: SeriesStats
}

export type BreakdownSelection = {
  category?: string
  subcategory?: string
  month?: string
}

/** Agrupa las subcategorías por categoría con su serie mensual y estadísticas. */
export function buildBreakdownCategories(
  groups: ExpenseGroup[],
  monthsCount: number
): BreakdownCategory[] {
  const map = new Map<string, BreakdownCategory>()
  for (const group of groups) {
    const id = group.idCategory ?? 'none'
    let block = map.get(id)
    if (!block) {
      block = { id, name: group.dsCategory, groups: [], series: [], stats: computeStats([]) }
      map.set(id, block)
    }
    block.groups.push(group)
  }
  const blocks = Array.from(map.values())
  for (const block of blocks) {
    block.series = sumSeries(
      block.groups.map((group) => group.series),
      monthsCount
    )
    block.stats = computeStats(block.series)
  }
  return blocks.sort((a, b) => b.stats.total - a.stats.total)
}

const monthLabel = (month: string) => {
  const [year, monthNumber] = month.split('-')
  const names = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${names[Number(monthNumber) - 1]} ${year.slice(2)}`
}

function cellStyle(value: number, max: number) {
  if (value <= 0 || max <= 0) return undefined
  const alpha = 0.08 + 0.5 * (value / max)
  return { backgroundColor: `rgba(13, 148, 136, ${alpha.toFixed(2)})` }
}

export default function MonthlyBreakdown({
  months,
  categories,
  onSelect,
}: {
  months: string[]
  categories: BreakdownCategory[]
  onSelect: (selection: BreakdownSelection) => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const allOpen = categories.length > 0 && categories.every((category) => expanded[category.id])

  const totalSeries = sumSeries(
    categories.map((category) => category.series),
    months.length
  )
  const totalStats = computeStats(totalSeries)
  const totalMax = Math.max(0, ...totalSeries)

  const stickyCell = 'sticky left-0 z-10 bg-white'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          Pulsa un importe para ver las transacciones de ese mes; pulsa un mes para ver todas sus transacciones.
        </p>
        <button
          type="button"
          onClick={() =>
            setExpanded(
              allOpen ? {} : Object.fromEntries(categories.map((category) => [category.id, true]))
            )
          }
          className="text-sm font-medium text-[#0d9488] hover:underline"
        >
          {allOpen ? 'Contraer todo' : 'Expandir todo'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="sticky left-0 z-20 min-w-[240px] bg-gray-50 px-4 py-2 text-left">Categoría</th>
              {months.map((month) => (
                <th key={month} className="min-w-[78px] bg-gray-50 px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onSelect({ month })}
                    className="uppercase hover:text-[#0d9488]"
                    title={`Ver transacciones de ${month}`}
                  >
                    {monthLabel(month)}
                  </button>
                </th>
              ))}
              <th className="min-w-[90px] bg-gray-100 px-3 py-2 text-right">Total</th>
              <th className="min-w-[90px] bg-gray-100 px-3 py-2 text-right">Media</th>
              <th className="min-w-[90px] bg-gray-100 px-3 py-2 text-right">Mediana</th>
            </tr>
          </thead>
          <tbody className="text-gray-800">
            {categories.map((category) => {
              const isOpen = expanded[category.id] ?? false
              const max = Math.max(0, ...category.series)
              return (
                <CategoryRows
                  key={category.id}
                  category={category}
                  months={months}
                  isOpen={isOpen}
                  max={max}
                  stickyCell={stickyCell}
                  onToggle={() => setExpanded((current) => ({ ...current, [category.id]: !isOpen }))}
                  onSelect={onSelect}
                />
              )
            })}
            <tr className="font-semibold text-gray-900">
              <td className="sticky left-0 z-10 border-t-2 border-gray-200 bg-gray-50 px-4 py-2">Total</td>
              {totalSeries.map((value, index) => (
                <td
                  key={months[index]}
                  className="border-t-2 border-gray-200 bg-gray-50 px-2 py-2 text-right tabular-nums"
                  style={cellStyle(value, totalMax)}
                >
                  {value > 0 ? formatMoney(value) : '·'}
                </td>
              ))}
              <td className="border-t-2 border-gray-200 bg-gray-100 px-3 py-2 text-right tabular-nums">
                {formatMoney(totalStats.total)}
              </td>
              <td className="border-t-2 border-gray-200 bg-gray-100 px-3 py-2 text-right tabular-nums">
                {formatMoney(totalStats.avg)}
              </td>
              <td className="border-t-2 border-gray-200 bg-gray-100 px-3 py-2 text-right tabular-nums">
                {formatMoney(totalStats.median)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CategoryRows({
  category,
  months,
  isOpen,
  max,
  stickyCell,
  onToggle,
  onSelect,
}: {
  category: BreakdownCategory
  months: string[]
  isOpen: boolean
  max: number
  stickyCell: string
  onToggle: () => void
  onSelect: (selection: BreakdownSelection) => void
}) {
  return (
    <>
      <tr className="font-medium">
        <td className={`${stickyCell} border-t border-gray-100 px-4 py-2`}>
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onToggle} className="flex items-center gap-2 text-left text-gray-900">
              <span className={`text-xs text-gray-400 transition ${isOpen ? 'rotate-90' : ''}`}>▶</span>
              {category.name}
            </button>
            <button
              type="button"
              onClick={() => onSelect({ category: category.id })}
              className="whitespace-nowrap text-xs font-medium text-[#0d9488] hover:underline"
              title={`Ver todas las transacciones de ${category.name}`}
            >
              Ver
            </button>
          </div>
        </td>
        {category.series.map((value, index) => (
          <td
            key={months[index]}
            className="border-t border-gray-100 px-2 py-2 text-right tabular-nums"
            style={cellStyle(value, max)}
          >
            {value > 0 ? (
              <button
                type="button"
                onClick={() => onSelect({ category: category.id, month: months[index] })}
                className="w-full text-right hover:underline"
              >
                {formatMoney(value)}
              </button>
            ) : (
              <span className="text-gray-300">·</span>
            )}
          </td>
        ))}
        <td className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-right tabular-nums">
          {formatMoney(category.stats.total)}
        </td>
        <td className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-right tabular-nums">
          {formatMoney(category.stats.avg)}
        </td>
        <td className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-right tabular-nums">
          {formatMoney(category.stats.median)}
        </td>
      </tr>
      {isOpen &&
        category.groups.map((group) => {
          const groupMax = Math.max(0, ...group.series)
          return (
            <tr key={group.key} className="text-gray-700">
              <td className={`${stickyCell} border-t border-gray-50 py-1.5 pl-10 pr-4`}>
                <div className="flex items-center justify-between gap-3">
                  <span>{group.dsSubcategory}</span>
                  <button
                    type="button"
                    onClick={() =>
                      onSelect({
                        category: group.idCategory ?? 'none',
                        subcategory: group.idSubcategory ?? `cat:${group.idCategory ?? 'none'}`,
                      })
                    }
                    className="whitespace-nowrap text-xs font-medium text-[#0d9488] hover:underline"
                    title={`Ver transacciones de ${group.dsSubcategory}`}
                  >
                    Ver
                  </button>
                </div>
              </td>
              {group.series.map((value, index) => (
                <td
                  key={months[index]}
                  className="border-t border-gray-50 px-2 py-1.5 text-right tabular-nums"
                  style={cellStyle(value, groupMax)}
                >
                  {value > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        onSelect({
                          category: group.idCategory ?? 'none',
                          subcategory: group.idSubcategory ?? `cat:${group.idCategory ?? 'none'}`,
                          month: months[index],
                        })
                      }
                      className="w-full text-right hover:underline"
                    >
                      {formatMoney(value)}
                    </button>
                  ) : (
                    <span className="text-gray-300">·</span>
                  )}
                </td>
              ))}
              <td className="border-t border-gray-50 bg-gray-50 px-3 py-1.5 text-right tabular-nums">
                {formatMoney(group.stats.total)}
              </td>
              <td className="border-t border-gray-50 bg-gray-50 px-3 py-1.5 text-right tabular-nums">
                {formatMoney(group.stats.avg)}
              </td>
              <td className="border-t border-gray-50 bg-gray-50 px-3 py-1.5 text-right tabular-nums">
                {formatMoney(group.stats.median)}
              </td>
            </tr>
          )
        })}
    </>
  )
}
