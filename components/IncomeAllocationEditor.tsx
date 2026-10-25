'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  budgetTypesForUsers,
  getBudgetSubtypes,
  getBudgetTypes,
  getUserBudgetHistory,
  type BudgetSubtype,
  type BudgetType,
  type CurrentUserBudget,
} from '@/lib/budgets'
import { getBudgetPlans, type BudgetPlan } from '@/lib/budget-plans'
import { convertMonthYearToDBFormat } from '@/lib/date-utils'
import { formatMoney, parseNumber } from '@/lib/budget-calculator'
import {
  SAVINGS_ID,
  computeDefaultIncomeAllocation,
  newAllocationKey,
  summarizeAllocation,
  type AllocationRow,
} from '@/lib/income-allocations'

const fieldClass =
  'rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400'

/**
 * Reparto de un ingreso entre las partidas (y subpartidas) del presupuesto.
 * `value = null` = "reparto por defecto": se calcula con el presupuesto vigente y no se guarda nada.
 * Plegado muestra solo un resumen; se puede desglosar y cambiar. Lo que no se reparte es ahorro,
 * y también se puede mandar a ahorro de forma explícita (línea "Ahorro").
 */
export default function IncomeAllocationEditor({
  idFamily,
  amount,
  userIds,
  monthDeclared,
  value,
  onChange,
  disabled = false,
}: {
  idFamily: string
  amount: number
  userIds: string[]
  /** Mes declarado del ingreso, MM-YYYY */
  monthDeclared: string
  value: AllocationRow[] | null
  onChange: (rows: AllocationRow[] | null) => void
  disabled?: boolean
}) {
  const [budgetTypes, setBudgetTypes] = useState<BudgetType[]>([])
  const [subtypes, setSubtypes] = useState<BudgetSubtype[]>([])
  const [versions, setVersions] = useState<CurrentUserBudget[]>([])
  const [plans, setPlans] = useState<BudgetPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [types, subs, history, plansResult] = await Promise.all([
          getBudgetTypes(supabase, idFamily),
          getBudgetSubtypes(supabase, idFamily),
          getUserBudgetHistory(supabase, idFamily),
          getBudgetPlans(supabase, idFamily),
        ])
        if (cancelled) return
        setBudgetTypes(types)
        setSubtypes(subs.subtypes)
        setVersions(history)
        setPlans(plansResult.plans)
      } catch (err) {
        console.error('Error al cargar partidas para el reparto del ingreso:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [idFamily])

  const month = useMemo(() => {
    try {
      return convertMonthYearToDBFormat(monthDeclared)
    } catch {
      return new Date().toISOString().slice(0, 7)
    }
  }, [monthDeclared])

  const defaultRows = useMemo(
    () => computeDefaultIncomeAllocation({ amount, userIds, month, versions, budgetTypes, plans, subtypes }),
    [amount, userIds, month, versions, budgetTypes, plans, subtypes]
  )

  // Solo las partidas que valen para quien cobra el ingreso
  const selectable = useMemo(() => budgetTypesForUsers(budgetTypes, userIds), [budgetTypes, userIds])

  const custom = value !== null
  const rows = value ?? defaultRows
  const summary = summarizeAllocation(rows, amount)
  const open = expanded || custom
  const hasSubtypes = subtypes.length > 0

  const edit = (update: (current: AllocationRow[]) => AllocationRow[]) => {
    const next = update(rows)
    // Sin ninguna línea el reparto personalizado no se podría guardar: equivale a mandarlo todo a ahorro
    onChange(
      next.length > 0
        ? next
        : [{ key: newAllocationKey(), id_budget_type: SAVINGS_ID, id_budget_subtype: null, amount: String(amount) }]
    )
  }
  const updateRow = (key: string, patch: Partial<AllocationRow>) =>
    edit((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  const subsOf = (idBudgetType: string) => subtypes.filter((sub) => sub.id_budget_type === idBudgetType)
  const usedTypes = new Set(rows.map((row) => row.id_budget_type))

  const wrapper = 'rounded-xl border border-emerald-100 bg-emerald-50/40 p-4'

  if (loading) return <div className={`${wrapper} text-xs text-gray-500`}>Calculando reparto…</div>
  if (amount <= 0) {
    return <div className={`${wrapper} text-xs text-gray-500`}>Introduce el importe para ver cómo se reparte entre tus partidas.</div>
  }

  // Resumen plegado
  if (!open) {
    return (
      <div className={`${wrapper} flex flex-wrap items-center justify-between gap-2`}>
        <p className="text-sm text-gray-700">
          <span className="font-semibold text-emerald-700">✓ Repartido por defecto</span>
          <span className="text-gray-500">
            {' '}
            según tu presupuesto
            {summary.savings > 0 ? ` · ahorro ${formatMoney(summary.savings)}` : ''}
          </span>
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([{ key: newAllocationKey(), id_budget_type: SAVINGS_ID, id_budget_subtype: null, amount: String(amount) }])}
            className="text-xs font-medium text-gray-600 hover:text-emerald-700 hover:underline"
          >
            Todo a ahorro
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setExpanded(true)}
            className="text-xs font-semibold text-indigo-700 hover:underline"
          >
            Desglosar / cambiar
          </button>
        </div>
      </div>
    )
  }

  // Alguna fila (con subpartidas disponibles) necesita la columna de subpartida
  const showSubColumn = hasSubtypes && rows.some((row) => row.id_budget_type !== SAVINGS_ID)
  const gridCols = showSubColumn ? 'grid-cols-[1fr_1fr_6.5rem_auto]' : 'grid-cols-[1fr_6.5rem_auto]'

  return (
    <div className={`${wrapper} space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            Reparto del ingreso
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                custom ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {custom ? 'Personalizado' : 'Por defecto'}
            </span>
          </h3>
          <p className="text-xs text-gray-600">Lo que no repartas a ninguna partida va a ahorro.</p>
        </div>
        <div className="flex items-center gap-3">
          {custom && (
            <button type="button" onClick={() => onChange(null)} disabled={disabled} className="text-xs font-medium text-indigo-700 hover:underline">
              Volver al reparto por defecto
            </button>
          )}
          {!custom && (
            <button type="button" onClick={() => setExpanded(false)} className="text-xs font-medium text-gray-500 hover:underline">
              Ocultar
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 && (
        <p className="rounded-lg bg-white/70 px-3 py-2 text-xs text-gray-600">
          No hay presupuesto vigente para este mes, así que todo iría a ahorro. Puedes repartirlo a mano.
        </p>
      )}

      <div className="space-y-2">
        {rows.map((row) => {
          const isSavings = row.id_budget_type === SAVINGS_ID
          const subs = isSavings ? [] : subsOf(row.id_budget_type)
          return (
            <div key={row.key} className={`grid ${gridCols} items-center gap-2`}>
              <select
                value={row.id_budget_type}
                disabled={disabled}
                onChange={(event) => updateRow(row.key, { id_budget_type: event.target.value, id_budget_subtype: null })}
                aria-label="Partida"
                className={fieldClass}
              >
                {budgetTypes
                  .filter((type) => type.id_budget_type === row.id_budget_type || selectable.includes(type))
                  .map((type) => (
                  <option key={type.id_budget_type} value={type.id_budget_type}>
                    {type.ds_budget_type}
                  </option>
                ))}
                <option value={SAVINGS_ID}>💰 Ahorro</option>
              </select>
              {showSubColumn &&
                (subs.length > 0 ? (
                  <select
                    value={row.id_budget_subtype ?? ''}
                    disabled={disabled}
                    onChange={(event) => updateRow(row.key, { id_budget_subtype: event.target.value || null })}
                    aria-label="Subpartida"
                    className={fieldClass}
                  >
                    <option value="">Sin subpartida</option>
                    {subs.map((sub) => (
                      <option key={sub.id_budget_subtype} value={sub.id_budget_subtype}>
                        {sub.ds_budget_subtype}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span />
                ))}
              <input
                type="number"
                min="0"
                step="0.01"
                value={row.amount}
                disabled={disabled}
                onChange={(event) => updateRow(row.key, { amount: event.target.value })}
                aria-label="Importe"
                className={`${fieldClass} text-right tabular-nums`}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => edit((current) => current.filter((item) => item.key !== row.key))}
                aria-label="Quitar línea"
                className="px-1 text-gray-400 hover:text-red-500"
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled || selectable.length === 0}
            onClick={() => {
              const next = selectable.find((type) => !usedTypes.has(type.id_budget_type)) ?? selectable[0]
              if (!next) return
              edit((current) => [
                ...current,
                {
                  key: newAllocationKey(),
                  id_budget_type: next.id_budget_type,
                  id_budget_subtype: null,
                  amount: summary.remainder > 0 ? String(summary.remainder) : '',
                },
              ])
            }}
            className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-indigo-400 hover:text-indigo-700"
          >
            + Añadir línea
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([{ key: newAllocationKey(), id_budget_type: SAVINGS_ID, id_budget_subtype: null, amount: String(amount) }])}
            className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-emerald-400 hover:text-emerald-700"
          >
            Todo a ahorro
          </button>
        </div>
        <p className="text-xs text-gray-600">
          A partidas <strong className="tabular-nums text-gray-900">{formatMoney(summary.toBudgets)}</strong>
          {summary.over ? (
            <span className="ml-2 font-semibold text-red-600">Te pasas {formatMoney(Math.abs(summary.remainder))} del importe</span>
          ) : (
            <span className="ml-2 font-semibold text-emerald-700">· 💰 Ahorro {formatMoney(summary.savings)}</span>
          )}
        </p>
      </div>
    </div>
  )
}

/** ¿Es válido guardar este reparto? (no repartir más de lo que entra) */
export function allocationIsValid(rows: AllocationRow[] | null, amount: number): boolean {
  if (rows === null) return true
  return !summarizeAllocation(rows, amount).over && rows.every((row) => parseNumber(row.amount) >= 0)
}
