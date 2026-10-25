'use client'

import { useState, type ReactNode } from 'react'
import type { BudgetType } from '@/lib/budgets'
import { formatMoney, type BudgetLine, type GroupLine } from '@/lib/budget-calculator'
import type { BreakdownCategory } from './MonthlyBreakdown'

const monthlyOf = (type: BudgetType | null | undefined, amount: number, annualMonths: number) =>
  type?.ds_periodicity === 'monthly' ? amount : amount / annualMonths

export default function BudgetMatrix({
  categories,
  budgetTypes,
  budgetLines,
  groupLines,
  incomeMonthly,
  annualMonths = 12,
  annualUnitLabel = 'año',
  directAmounts,
}: {
  categories: BreakdownCategory[]
  budgetTypes: BudgetType[]
  budgetLines: BudgetLine[]
  groupLines: Record<string, GroupLine>
  /** Si se indica, se añaden al pie el % sobre el ingreso, el ingreso y lo que queda para ahorrar */
  incomeMonthly?: number
  /** Meses que cubre una partida anual (12, o los del periodo si hay fecha de fin) */
  annualMonths?: number
  annualUnitLabel?: string
  /** Importe puesto directamente a cada partida, sin vertical */
  directAmounts?: Record<string, number>
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const allOpen = categories.length > 0 && categories.every((category) => expanded[category.id])

  const cell = (amount: number | undefined) =>
    amount ? formatMoney(amount) : <span className="text-gray-300">—</span>

  const totalMonthly = budgetLines.reduce((sum, line) => sum + line.monthlyEquivalent, 0)
  const directMonthly = budgetLines.reduce(
    (sum, line) => sum + monthlyOf(line.type, directAmounts?.[line.type.id_budget_type] ?? 0, annualMonths),
    0
  )
  const hasDirect = directMonthly > 0

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() =>
            setExpanded(allOpen ? {} : Object.fromEntries(categories.map((category) => [category.id, true])))
          }
          className="text-sm font-medium text-[#0d9488] hover:underline"
        >
          {allOpen ? 'Contraer todo' : 'Ver subcategorías'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-gray-100 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Categoría</th>
              {budgetTypes.map((item) => (
                <th key={item.id_budget_type} className="px-4 py-3 text-right">
                  {item.ds_budget_type}
                  <span className="block text-[10px] font-normal normal-case text-gray-400">
                    {item.ds_periodicity === 'monthly' ? '€/mes' : `€/${annualUnitLabel}`}
                  </span>
                </th>
              ))}
              <th className="bg-gray-100 px-4 py-3 text-right">Total €/mes</th>
              <th className="bg-gray-100 px-4 py-3 text-right">Total €/{annualUnitLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-gray-800">
            {categories.map((block) => {
              const isOpen = expanded[block.id] ?? false
              const amounts = new Map<string, number>()
              let monthly = 0
              for (const group of block.groups) {
                const line = groupLines[group.key]
                if (!line?.type) continue
                amounts.set(line.type.id_budget_type, (amounts.get(line.type.id_budget_type) || 0) + line.amount)
                monthly += monthlyOf(line.type, line.amount, annualMonths)
              }
              return (
                <CategoryRows
                  key={block.id}
                  block={block}
                  isOpen={isOpen}
                  onToggle={() => setExpanded((current) => ({ ...current, [block.id]: !isOpen }))}
                  budgetTypes={budgetTypes}
                  amounts={amounts}
                  monthly={monthly}
                  groupLines={groupLines}
                  cell={cell}
                  annualMonths={annualMonths}
                />
              )
            })}
            {hasDirect && (
              <tr className="bg-amber-50/40">
                <td className="px-4 py-3 font-medium text-gray-900">
                  Importe directo
                  <span className="block text-[10px] font-normal text-gray-400">sin vertical</span>
                </td>
                {budgetLines.map((line) => (
                  <td key={line.type.id_budget_type} className="px-4 py-3 text-right tabular-nums">
                    {cell(directAmounts?.[line.type.id_budget_type])}
                  </td>
                ))}
                <td className="bg-gray-50 px-4 py-3 text-right tabular-nums">{formatMoney(directMonthly)}</td>
                <td className="bg-gray-50 px-4 py-3 text-right tabular-nums">{formatMoney(directMonthly * annualMonths)}</td>
              </tr>
            )}
            <tr className="bg-gray-50 font-semibold text-gray-900">
              <td className="px-4 py-3">Total presupuestado</td>
              {budgetLines.map((line) => (
                <td key={line.type.id_budget_type} className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(line.amount)}
                </td>
              ))}
              <td className="bg-gray-100 px-4 py-3 text-right tabular-nums text-[#0d9488]">
                {formatMoney(totalMonthly)}
              </td>
              <td className="bg-gray-100 px-4 py-3 text-right tabular-nums text-[#0d9488]">
                {formatMoney(totalMonthly * annualMonths)}
              </td>
            </tr>
            {incomeMonthly !== undefined && (
              <>
                <tr className="text-gray-600">
                  <td className="px-4 py-2">% del ingreso</td>
                  {budgetLines.map((line) => (
                    <td key={line.type.id_budget_type} className="px-4 py-2 text-right tabular-nums">
                      {incomeMonthly > 0 ? `${((line.monthlyEquivalent / incomeMonthly) * 100).toFixed(1)}%` : '—'}
                    </td>
                  ))}
                  <td className="bg-gray-50 px-4 py-2 text-right tabular-nums">
                    {incomeMonthly > 0 ? `${((totalMonthly / incomeMonthly) * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="bg-gray-50" />
                </tr>
                <tr className="text-gray-900">
                  <td className="px-4 py-2 font-medium">Ingreso medio</td>
                  <td colSpan={budgetTypes.length} />
                  <td className="bg-gray-50 px-4 py-2 text-right font-medium tabular-nums">{formatMoney(incomeMonthly)}</td>
                  <td className="bg-gray-50 px-4 py-2 text-right font-medium tabular-nums">
                    {formatMoney(incomeMonthly * annualMonths)}
                  </td>
                </tr>
                <tr className={incomeMonthly - totalMonthly >= 0 ? 'bg-[#90EBD6]/25' : 'bg-red-50'}>
                  <td className="px-4 py-3 font-semibold text-gray-900">Queda para ahorrar</td>
                  <td colSpan={budgetTypes.length} />
                  <td
                    className={`px-4 py-3 text-right font-bold tabular-nums ${
                      incomeMonthly - totalMonthly >= 0 ? 'text-teal-800' : 'text-red-700'
                    }`}
                  >
                    {formatMoney(incomeMonthly - totalMonthly)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-bold tabular-nums ${
                      incomeMonthly - totalMonthly >= 0 ? 'text-teal-800' : 'text-red-700'
                    }`}
                  >
                    {formatMoney((incomeMonthly - totalMonthly) * annualMonths)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CategoryRows({
  block,
  isOpen,
  onToggle,
  budgetTypes,
  amounts,
  monthly,
  groupLines,
  cell,
  annualMonths,
}: {
  block: BreakdownCategory
  isOpen: boolean
  onToggle: () => void
  budgetTypes: BudgetType[]
  amounts: Map<string, number>
  monthly: number
  groupLines: Record<string, GroupLine>
  cell: (amount: number | undefined) => ReactNode
  annualMonths: number
}) {
  return (
    <>
      <tr className="font-medium">
        <td className="px-4 py-2">
          <button type="button" onClick={onToggle} className="flex items-center gap-2 text-left text-gray-900">
            <span className={`text-xs text-gray-400 transition ${isOpen ? 'rotate-90' : ''}`}>▶</span>
            {block.name}
          </button>
        </td>
        {budgetTypes.map((item) => (
          <td key={item.id_budget_type} className="px-4 py-2 text-right tabular-nums">
            {cell(amounts.get(item.id_budget_type))}
          </td>
        ))}
        <td className="bg-gray-50 px-4 py-2 text-right tabular-nums">{cell(monthly)}</td>
        <td className="bg-gray-50 px-4 py-2 text-right tabular-nums">{cell(monthly * annualMonths)}</td>
      </tr>
      {isOpen &&
        block.groups.map((group) => {
          const line = groupLines[group.key]
          const subMonthly = line?.type ? monthlyOf(line.type, line.amount, annualMonths) : 0
          return (
            <tr key={group.key} className="text-gray-600">
              <td className="py-1.5 pl-10 pr-4">{group.dsSubcategory}</td>
              {budgetTypes.map((item) => (
                <td key={item.id_budget_type} className="px-4 py-1.5 text-right tabular-nums">
                  {cell(line?.type?.id_budget_type === item.id_budget_type ? line.amount : undefined)}
                </td>
              ))}
              <td className="bg-gray-50 px-4 py-1.5 text-right tabular-nums">{cell(subMonthly)}</td>
              <td className="bg-gray-50 px-4 py-1.5 text-right tabular-nums">{cell(subMonthly * annualMonths)}</td>
            </tr>
          )
        })}
    </>
  )
}
