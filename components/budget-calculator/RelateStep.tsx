'use client'

import { useMemo, useState } from 'react'
import type { BudgetType } from '@/lib/budgets'
import type { BreakdownCategory } from './MonthlyBreakdown'

const MIXED = '__mixed'

const selectClass =
  'min-w-[150px] rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-sm text-gray-900 focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]'

/**
 * Paso "¿Qué gasto va a cada partida?": relaciona verticales y subverticales con las partidas elegidas.
 * Solo asigna; las cifras y los importes se ven en el paso siguiente.
 */
export default function RelateStep({
  categories,
  budgetTypes,
  assignments,
  onAssign,
  onAssignMany,
}: {
  categories: BreakdownCategory[]
  budgetTypes: BudgetType[]
  assignments: Record<string, string>
  onAssign: (key: string, idBudgetType: string) => void
  onAssignMany: (keys: string[], idBudgetType: string) => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [onlyMissing, setOnlyMissing] = useState(false)

  const validIds = useMemo(() => new Set(budgetTypes.map((type) => type.id_budget_type)), [budgetTypes])
  const isAssigned = (key: string) => validIds.has(assignments[key])

  const allGroups = categories.flatMap((category) => category.groups)
  const assignedCount = allGroups.filter((group) => isAssigned(group.key)).length
  const missingCount = allGroups.length - assignedCount

  const visible = categories
    .map((category) => ({
      category,
      groups: onlyMissing ? category.groups.filter((group) => !isAssigned(group.key)) : category.groups,
    }))
    .filter((item) => item.groups.length > 0)

  const select = (value: string, onChange: (value: string) => void) => (
    <select
      value={value}
      onChange={(event) => {
        if (event.target.value !== MIXED) onChange(event.target.value)
      }}
      className={`${selectClass} ${value === '' ? 'border-amber-300 bg-amber-50/50' : ''}`}
    >
      <option value="">Sin partida</option>
      {value === MIXED && (
        <option value={MIXED} disabled>
          Varias partidas
        </option>
      )}
      {budgetTypes.map((type) => (
        <option key={type.id_budget_type} value={type.id_budget_type}>
          {type.ds_budget_type}
        </option>
      ))}
    </select>
  )

  return (
    <div className="space-y-2">
      <section
        className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl border px-4 py-2 ${
          missingCount === 0 ? 'border-teal-100 bg-[#90EBD6]/20' : 'border-amber-200 bg-amber-50'
        }`}
      >
        <div className="text-sm">
          <p className={`font-semibold ${missingCount === 0 ? 'text-teal-900' : 'text-amber-900'}`}>
            {missingCount === 0
              ? '✓ Todo tu gasto está relacionado con alguna partida'
              : `${assignedCount} de ${allGroups.length} subcategorías con partida · faltan ${missingCount}`}
          </p>
          {missingCount > 0 && <p className="text-xs text-amber-800">Lo que no se relacione con una partida no contará en tu presupuesto.</p>}
        </div>
        {missingCount > 0 && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={onlyMissing}
              onChange={(event) => setOnlyMissing(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-[#0d9488] focus:ring-[#90EBD6]"
            />
            Mostrar solo las que faltan
          </label>
        )}
      </section>

      <div className="space-y-1.5">
        {visible.map(({ category, groups }) => {
          const isOpen = onlyMissing || (expanded[category.id] ?? false)
          const values = category.groups.map((group) => (isAssigned(group.key) ? assignments[group.key] : ''))
          const categoryValue = values.every((value) => value === values[0]) ? values[0] : MIXED
          const missingHere = category.groups.filter((group) => !isAssigned(group.key)).length
          return (
            <div key={category.id} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2">
                <button
                  type="button"
                  onClick={() => setExpanded((current) => ({ ...current, [category.id]: !isOpen }))}
                  className="flex min-w-[220px] flex-1 items-center gap-2 text-left"
                >
                  <span className={`text-gray-400 transition ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                  <span>
                    <span className="block font-semibold text-gray-900">
                      {category.name}
                      {missingHere > 0 ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          {missingHere} sin partida
                        </span>
                      ) : (
                        <span className="ml-2 text-xs text-teal-600">✓</span>
                      )}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {category.groups.length} subcategoría{category.groups.length === 1 ? '' : 's'}
                    </span>
                  </span>
                </button>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-500">
                  Toda la vertical a
                  {select(categoryValue, (value) =>
                    onAssignMany(
                      category.groups.map((group) => group.key),
                      value
                    )
                  )}
                </label>
              </div>

              {isOpen && (
                <div className="divide-y divide-gray-50 border-t border-gray-100">
                  {groups.map((group) => (
                    <div key={group.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-1">
                      <div className="min-w-[200px] flex-1 text-sm font-medium text-gray-900">{group.dsSubcategory}</div>
                      {select(isAssigned(group.key) ? assignments[group.key] : '', (value) => onAssign(group.key, value))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {visible.length === 0 && (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            {allGroups.length === 0 ? 'Todavía no hay gastos registrados para relacionar.' : 'No queda nada por relacionar.'}
          </div>
        )}
      </div>
    </div>
  )
}
