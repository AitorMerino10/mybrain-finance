'use client'

import { useMemo, useRef, useState } from 'react'
import type { BudgetType } from '@/lib/budgets'
import {
  formatMoney,
  parseNumber,
  round2,
  type ExpenseGroup,
  type GroupLine,
  type PeriodRow,
  type StatMethod,
  type TypeStatsResult,
} from '@/lib/budget-calculator'
import MonthlyBreakdown, {
  buildBreakdownCategories,
  type BreakdownCategory,
  type BreakdownSelection,
} from './MonthlyBreakdown'
import PeriodSelector from './PeriodSelector'
import TransactionsTable, { EMPTY_TABLE_FILTER, type TableFilter } from './TransactionsTable'

const MIXED = '__mixed'

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]'

const METHODS: Array<{ value: StatMethod; label: string }> = [
  { value: 'avg', label: 'Media' },
  { value: 'median', label: 'Mediana' },
  { value: 'p75', label: 'Percentil 75' },
]

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {description && <p className="text-sm text-gray-500">{description}</p>}
    </div>
  )
}

type Unit = 'monthly' | 'annual'

// `annualMonths` = meses que cubre un importe "anual": 12, o los del periodo si el presupuesto tiene fecha de fin
const monthlyOf = (type: BudgetType | null | undefined, amount: number, annualMonths: number) =>
  type?.ds_periodicity === 'monthly' ? amount : amount / annualMonths

/** Convierte un importe escrito en `unit` a la unidad de la partida (mensual o anual/periodo). */
const toTypeUnit = (value: number, unit: Unit, type: BudgetType, annualMonths: number) => {
  const typeMonthly = type.ds_periodicity === 'monthly'
  if (unit === 'monthly') return typeMonthly ? value : value * annualMonths
  return typeMonthly ? value / annualMonths : value
}

/** Valor que se guarda como importe manual (con precisión para no perder nada al convertir). */
const toStoredAmount = (raw: string, unit: Unit, type: BudgetType, annualMonths: number) =>
  raw === '' ? '' : String(Math.round(toTypeUnit(parseNumber(raw), unit, type, annualMonths) * 10000) / 10000)

/**
 * Input de importe con selector de unidad (€/mes o €/año).
 * `amount` y `suggestion` llegan en la unidad de la partida (typeMonthly) y se muestran en `unit`.
 * `onChange` devuelve lo que ha escrito la persona y la unidad en la que lo escribió.
 * Mantiene un borrador mientras se escribe para no pelearse con los decimales.
 */
function AmountInput({
  amount,
  suggestion,
  overridden,
  typeMonthly,
  annualMonths,
  annualLabel,
  unit,
  onUnitChange,
  onChange,
  alwaysShowValue = false,
}: {
  amount: number
  suggestion: number
  overridden: boolean
  typeMonthly: boolean
  annualMonths: number
  annualLabel: string
  unit: Unit
  onUnitChange: (unit: Unit) => void
  onChange: (raw: string, unit: Unit) => void
  alwaysShowValue?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)

  const toDisplay = (value: number) =>
    round2(unit === 'monthly' ? (typeMonthly ? value : value / annualMonths) : typeMonthly ? value * annualMonths : value)

  const shown = draft ?? (overridden || alwaysShowValue ? String(toDisplay(amount)) : '')

  return (
    <div className="flex flex-col gap-1">
      <input
        type="number"
        min="0"
        step="1"
        value={shown}
        placeholder={String(toDisplay(suggestion))}
        onChange={(event) => {
          const raw = event.target.value
          setDraft(raw)
          onChange(raw, unit)
        }}
        onBlur={() => setDraft(null)}
        className={`${inputClass} w-28 ${overridden ? 'border-[#0d9488] bg-[#90EBD6]/10' : ''}`}
      />
      <div className="inline-flex w-fit rounded-lg bg-gray-100 p-0.5 text-[11px] font-medium">
        {(['monthly', 'annual'] as Unit[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setDraft(null)
              onUnitChange(item)
            }}
            className={`rounded-md px-2 py-0.5 transition ${
              unit === item ? 'bg-white text-[#0d9488] shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {item === 'monthly' ? '€/mes' : `€/${annualLabel}`}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ExpensesStep({
  from,
  to,
  onPeriodChange,
  months,
  minMonth,
  maxMonth,
  method,
  onMethodChange,
  budgetTypes,
  groups,
  rows,
  assignments,
  onAssign,
  onAssignMany,
  typeStats,
  groupLines,
  groupOverrides,
  scopeLabel,
  onGroupOverrideChange,
  categoryOverrides,
  onCategoryOverrideChange,
  annualMonths,
  annualUnitLabel,
  onResetOverrides,
}: {
  from: string
  to: string
  onPeriodChange: (from: string, to: string) => void
  months: string[]
  minMonth: string | null
  maxMonth: string | null
  method: StatMethod
  onMethodChange: (method: StatMethod) => void
  budgetTypes: BudgetType[]
  groups: ExpenseGroup[]
  rows: PeriodRow[]
  assignments: Record<string, string>
  onAssign: (key: string, idBudgetType: string) => void
  onAssignMany: (keys: string[], idBudgetType: string) => void
  typeStats: TypeStatsResult
  groupLines: Record<string, GroupLine>
  groupOverrides: Record<string, string>
  scopeLabel: string
  onGroupOverrideChange: (key: string, value: string) => void
  /** Totales fijados por vertical y partida (`idCategoria|idPartida`) */
  categoryOverrides: Record<string, string>
  onCategoryOverrideChange: (key: string, value: string) => void
  /** Meses que cubre una partida anual (12, o los del periodo si hay fecha de fin) */
  annualMonths: number
  annualUnitLabel: string
  onResetOverrides: () => void
}) {
  const monthsCount = months.length
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  // Unidad en la que se introduce cada importe (por subcategoría o por categoría|partida)
  const [units, setUnits] = useState<Record<string, Unit>>({})
  const [tableFilter, setTableFilter] = useState<TableFilter>(EMPTY_TABLE_FILTER)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [transactionsOpen, setTransactionsOpen] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)

  const categories = useMemo<BreakdownCategory[]>(
    () => buildBreakdownCategories(groups, monthsCount),
    [groups, monthsCount]
  )

  const typeById = useMemo(
    () => new Map(budgetTypes.map((item) => [item.id_budget_type, item])),
    [budgetTypes]
  )
  const validTypeIds = useMemo(() => new Set(budgetTypes.map((item) => item.id_budget_type)), [budgetTypes])
  const hasOverrides =
    Object.values(groupOverrides).some((value) => value !== '') || Object.keys(categoryOverrides).length > 0

  const categoryValue = (block: BreakdownCategory): string => {
    const values = block.groups.map((group) =>
      validTypeIds.has(assignments[group.key]) ? assignments[group.key] : ''
    )
    return values.every((value) => value === values[0]) ? values[0] : MIXED
  }

  /** Presupuesto de una categoría desglosado por partida (en la unidad de cada partida). */
  const categoryTypeAmounts = (
    block: BreakdownCategory
  ): Map<string, { amount: number; suggestion: number; overridden: boolean }> => {
    const result = new Map<string, { amount: number; suggestion: number; overridden: boolean }>()
    for (const group of block.groups) {
      const line = groupLines[group.key]
      if (!line?.type) continue
      const previous = result.get(line.type.id_budget_type)
      result.set(line.type.id_budget_type, {
        amount: (previous?.amount || 0) + line.amount,
        suggestion: (previous?.suggestion || 0) + line.suggestion,
        overridden: (previous?.overridden || false) || line.overridden,
      })
    }
    return result
  }

  /**
   * Fija el total de una vertical para una partida. No se reparte entre sus subcategorías: lo que no fijes
   * a mano en alguna subcategoría concreta se calcula como el resto. Vacío = volver a la suma de subcategorías.
   */
  const applyCategoryTypeTotal = (
    block: BreakdownCategory,
    typeId: string,
    raw: string,
    unit: Unit
  ) => {
    const type = typeById.get(typeId)
    if (!type) return
    onCategoryOverrideChange(`${block.id}|${typeId}`, toStoredAmount(raw, unit, type, annualMonths))
  }

  const showTransactions = (selection: BreakdownSelection) => {
    setTableFilter({
      ...EMPTY_TABLE_FILTER,
      category: selection.category ?? '',
      subcategory: selection.subcategory ?? '',
      month: selection.month ?? '',
    })
    setTransactionsOpen(true)
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const typeSelect = (value: string, onChange: (value: string) => void) => (
    <select
      value={value}
      onChange={(event) => {
        if (event.target.value !== MIXED) onChange(event.target.value)
      }}
      className={`${inputClass} min-w-[140px]`}
    >
      <option value="">Sin partida</option>
      {value === MIXED && (
        <option value={MIXED} disabled>
          Mixto
        </option>
      )}
      {budgetTypes.map((item) => (
        <option key={item.id_budget_type} value={item.id_budget_type}>
          {item.ds_budget_type}
        </option>
      ))}
    </select>
  )

  const defaultUnit = (type: BudgetType): Unit => (type.ds_periodicity === 'monthly' ? 'monthly' : 'annual')

  return (
    <div className="space-y-5">
      {/* Periodo y método */}
      <section className="rounded-3xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Periodo analizado (mes declarado)</h3>
            <PeriodSelector
              from={from}
              to={to}
              monthsCount={monthsCount}
              minMonth={minMonth}
              maxMonth={maxMonth}
              onChange={onPeriodChange}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Base para proponer cada subcategoría</h3>
            <div className="mt-2 inline-flex rounded-xl bg-gray-100 p-1">
              {METHODS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onMethodChange(item.value)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    method === item.value
                      ? 'bg-white text-[#0d9488] shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              Media: total real · Mediana: ignora meses extremos · P75: más conservador. Meses sin gasto = 0.
            </p>
          </div>
        </div>
      </section>

      {/* Asignar y presupuestar */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <SectionTitle
            title="Asignar y presupuestar por categoría y subcategoría"
            description="Elige la partida de cada subcategoría y, si quieres, fija un total por vertical o importes concretos: el resto se calcula solo. Sin valor se usa la propuesta. Todo se guarda en el último paso."
          />
          {hasOverrides && (
            <button
              type="button"
              onClick={onResetOverrides}
              className="text-sm font-medium text-[#0d9488] hover:underline"
            >
              Restablecer ajustes manuales
            </button>
          )}
        </div>

        {typeStats.unassigned.total > 0 && (
          <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            Aún hay {formatMoney(typeStats.unassigned.total)} de gasto en el periodo (~
            {formatMoney(typeStats.unassigned.avg)}/mes) sin asignar a ninguna partida; no entra en tu presupuesto.
          </p>
        )}

        <div className="space-y-2">
          {categories.map((block) => {
            const isOpen = expanded[block.id] ?? false
            const typeAmounts = categoryTypeAmounts(block)
            const categoryMonthly = Array.from(typeAmounts.entries()).reduce(
              (sum, [typeId, value]) => sum + monthlyOf(typeById.get(typeId), value.amount, annualMonths),
              0
            )
            return (
              <div key={block.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="flex flex-wrap items-end gap-x-6 gap-y-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setExpanded((current) => ({ ...current, [block.id]: !isOpen }))}
                    className="flex min-w-[220px] flex-1 items-center gap-2 self-center text-left"
                  >
                    <span className={`text-gray-400 transition ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                    <span>
                      <span className="block font-semibold text-gray-900">{block.name}</span>
                      <span className="block text-xs text-gray-500">
                        {block.groups.length} subcategorías · media {formatMoney(block.stats.avg)}/mes · mediana{' '}
                        {formatMoney(block.stats.median)}/mes
                      </span>
                      {typeAmounts.size > 0 && (
                        <span className="mt-0.5 block text-xs font-medium text-teal-700">
                          Presupuesto: {formatMoney(categoryMonthly)}/mes · {formatMoney(categoryMonthly * annualMonths)}/{annualUnitLabel}
                        </span>
                      )}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => showTransactions({ category: block.id })}
                    className="self-center whitespace-nowrap text-xs font-medium text-[#0d9488] hover:underline"
                  >
                    Ver movimientos
                  </button>
                  <div className="flex flex-wrap items-end gap-3">
                    {typeAmounts.size === 0 ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        Sin partida
                      </span>
                    ) : (
                      Array.from(typeAmounts.entries()).map(([typeId, value]) => {
                        const type = typeById.get(typeId)
                        if (!type) return null
                        const unitKey = `${block.id}|${typeId}`
                        const monthly = monthlyOf(type, value.amount, annualMonths)
                        const fixedTotal = categoryOverrides[unitKey]
                        const hasFixedTotal = fixedTotal !== undefined && fixedTotal !== ''
                        const pinnedGroups = block.groups.filter(
                          (group) => groupLines[group.key]?.type?.id_budget_type === typeId && groupLines[group.key].overridden
                        )
                        const pinnedSum = pinnedGroups.reduce((sum, group) => sum + groupLines[group.key].amount, 0)
                        const exceeds = hasFixedTotal && pinnedSum > parseNumber(fixedTotal) + 0.01
                        return (
                          <div key={typeId} className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-gray-500">{type.ds_budget_type}</span>
                            <div className="flex items-start gap-2">
                              <AmountInput
                                amount={value.amount}
                                suggestion={value.suggestion}
                                overridden={hasFixedTotal}
                                alwaysShowValue
                                typeMonthly={type.ds_periodicity === 'monthly'}
                                annualMonths={annualMonths}
                                annualLabel={annualUnitLabel}
                                unit={units[unitKey] ?? defaultUnit(type)}
                                onUnitChange={(unit) => setUnits((current) => ({ ...current, [unitKey]: unit }))}
                                onChange={(raw, unit) => applyCategoryTypeTotal(block, typeId, raw, unit)}
                              />
                              {hasFixedTotal && (
                                <button
                                  type="button"
                                  onClick={() => onCategoryOverrideChange(unitKey, '')}
                                  className="mt-2 text-xs text-gray-400 hover:text-gray-700"
                                  title="Quitar el total fijado: vuelve a la suma de las subcategorías"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                            <span className="text-[11px] text-gray-400">
                              {formatMoney(monthly)}/mes · {formatMoney(monthly * annualMonths)}/{annualUnitLabel}
                            </span>
                            {hasFixedTotal && (
                              <span className={`text-[11px] ${exceeds ? 'font-medium text-amber-700' : 'text-teal-700'}`}>
                                {exceeds
                                  ? `Las subcategorías fijadas suman ${formatMoney(pinnedSum)}: más que el total`
                                  : pinnedGroups.length > 0
                                    ? `Total fijado · ${pinnedGroups.length} subcategoría${pinnedGroups.length === 1 ? '' : 's'} fijada${pinnedGroups.length === 1 ? '' : 's'}`
                                    : 'Total fijado para la vertical'}
                              </span>
                            )}
                          </div>
                        )
                      })
                    )}
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-gray-500">Toda la vertical a</span>
                      {typeSelect(categoryValue(block), (value) =>
                        onAssignMany(
                          block.groups.map((group) => group.key),
                          value
                        )
                      )}
                    </label>
                  </div>
                </div>

                {isOpen && (
                  <div className="overflow-x-auto border-t border-gray-100">
                    <table className="min-w-full divide-y divide-gray-50 text-sm">
                      <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-5 py-2">Subcategoría</th>
                          <th className="px-3 py-2 text-right">Total</th>
                          <th className="px-3 py-2 text-right">Media/mes</th>
                          <th className="px-3 py-2 text-right">Mediana/mes</th>
                          <th className="px-3 py-2 text-right">Meses con gasto</th>
                          <th className="px-3 py-2">Partida</th>
                          <th className="px-3 py-2">Presupuesto</th>
                          <th className="px-3 py-2 text-right">€/mes</th>
                          <th className="px-3 py-2 text-right">€/{annualUnitLabel}</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-gray-800">
                        {block.groups.map((group) => {
                          const line = groupLines[group.key]
                          const assigned = validTypeIds.has(assignments[group.key])
                          return (
                            <tr key={group.key}>
                              <td className="px-5 py-2 font-medium text-gray-900">{group.dsSubcategory}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatMoney(group.stats.total)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatMoney(group.stats.avg)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatMoney(group.stats.median)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {group.stats.monthsWithSpend}/{monthsCount}
                              </td>
                              <td className="px-3 py-2">
                                {typeSelect(assigned ? assignments[group.key] : '', (value) =>
                                  onAssign(group.key, value)
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {assigned && line?.type ? (
                                  <div className="flex items-start gap-2">
                                    <AmountInput
                                      amount={line.amount}
                                      suggestion={line.fromCategory ? line.amount : line.suggestion}
                                      overridden={line.overridden}
                                      typeMonthly={line.type.ds_periodicity === 'monthly'}
                                      annualMonths={annualMonths}
                                      annualLabel={annualUnitLabel}
                                      unit={units[group.key] ?? defaultUnit(line.type)}
                                      onUnitChange={(unit) =>
                                        setUnits((current) => ({ ...current, [group.key]: unit }))
                                      }
                                      onChange={(raw, unit) => line.type && onGroupOverrideChange(group.key, toStoredAmount(raw, unit, line.type, annualMonths))}
                                    />
                                    {line.fromCategory && (
                                      <span className="mt-2 whitespace-nowrap text-[11px] text-teal-700">resto de la vertical</span>
                                    )}
                                    {line.overridden && (
                                      <button
                                        type="button"
                                        onClick={() => onGroupOverrideChange(group.key, '')}
                                        className="mt-2 text-xs text-gray-400 hover:text-gray-700"
                                        title="Dejar de fijarla: vuelve a la propuesta o al resto de la vertical"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">Asigna una partida</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                                {assigned && line?.type ? formatMoney(monthlyOf(line.type, line.amount, annualMonths)) : '—'}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                                {assigned && line?.type ? formatMoney(monthlyOf(line.type, line.amount, annualMonths) * annualMonths) : '—'}
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    showTransactions({
                                      category: group.idCategory ?? 'none',
                                      subcategory: group.idSubcategory ?? `cat:${group.idCategory ?? 'none'}`,
                                    })
                                  }
                                  className="whitespace-nowrap text-xs font-medium text-[#0d9488] hover:underline"
                                >
                                  Ver movimientos
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
          {categories.length === 0 && (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
              No hay gastos en este periodo.
            </div>
          )}
        </div>
      </section>

      {/* Detalle del histórico: plegado por defecto para no alargar la pantalla */}
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setBreakdownOpen((current) => !current)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span>
            <span className="block text-sm font-semibold text-gray-900">Gasto mensual por categoría y subcategoría</span>
            <span className="block text-xs text-gray-500">Cómo se repartió tu gasto mes a mes en el periodo analizado.</span>
          </span>
          <span className={`text-gray-400 transition ${breakdownOpen ? 'rotate-90' : ''}`}>▶</span>
        </button>
        {breakdownOpen && (
          <div className="border-t border-gray-100 p-4">
            <MonthlyBreakdown months={months} categories={categories} onSelect={showTransactions} />
          </div>
        )}
      </section>

      <section ref={tableRef} className="scroll-mt-24 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setTransactionsOpen((current) => !current)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span>
            <span className="block text-sm font-semibold text-gray-900">Transacciones reales del periodo</span>
            <span className="block text-xs text-gray-500">Los movimientos que hay detrás de cada cifra.</span>
          </span>
          <span className={`text-gray-400 transition ${transactionsOpen ? 'rotate-90' : ''}`}>▶</span>
        </button>
        {transactionsOpen && (
          <div className="border-t border-gray-100 p-4">
            <TransactionsTable
              rows={rows}
              assignments={assignments}
              budgetTypes={budgetTypes}
              filter={tableFilter}
              onFilterChange={setTableFilter}
              scopeLabel={scopeLabel}
            />
          </div>
        )}
      </section>
    </div>
  )
}
