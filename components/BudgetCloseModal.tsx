'use client'

import { useMemo, useState } from 'react'
import { monthLabel } from '@/lib/budget-analytics'
import type { UserBalance } from '@/lib/budget-balance'
import type { CloseRowInput } from '@/lib/budget-closes'
import { formatMoney, parseNumber, round2 } from '@/lib/budget-calculator'

type Decision = { mode: 'carry' | 'savings' | 'custom'; custom: string }

const moneyTone = (value: number) => (value < 0 ? 'text-rose-600' : 'text-gray-900')

/** Cierre de presupuesto: del sobrante de cada partida, qué pasa a ahorro y qué queda como base del siguiente. */
export default function BudgetCloseModal({
  name,
  months,
  balanceFor,
  periodicityOf,
  onCancel,
  onConfirm,
}: {
  name: string
  /** Meses en los que termina un periodo aún sin cerrar */
  months: string[]
  balanceFor: (month: string) => UserBalance
  periodicityOf: (idBudgetType: string) => string | null | undefined
  onCancel: () => void
  onConfirm: (month: string, rows: CloseRowInput[]) => Promise<void>
}) {
  const [month, setMonth] = useState(months[months.length - 1])
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const balance = useMemo(() => balanceFor(month), [balanceFor, month])
  const allRows = balance.partidas.filter((row) => row.opening !== 0 || row.funded !== 0 || row.spent !== 0 || row.balance !== 0)
  // Solo se puede mover lo que sobra (saldo positivo). Lo que se ha gastado de más ya sale del ahorro del periodo
  const rows = allRows.filter((row) => row.balance > 0)
  const overspent = allRows.filter((row) => row.balance < 0)

  // Por defecto: las partidas anuales se quedan (siguen moviéndose); las mensuales pasan a ahorro
  const decisionFor = (idBudgetType: string): Decision =>
    decisions[idBudgetType] || { mode: periodicityOf(idBudgetType) === 'annual' ? 'carry' : 'savings', custom: '' }

  const lines = rows.map((row) => {
    const decision = decisionFor(row.idBudgetType)
    const wanted = decision.mode === 'carry' ? row.balance : decision.mode === 'savings' ? 0 : round2(parseNumber(decision.custom))
    const carried = Math.min(row.balance, Math.max(0, wanted))
    return { row, decision, carried, toSavings: round2(row.balance - carried) }
  })
  const toSavingsTotal = round2(lines.reduce((sum, line) => sum + line.toSavings, 0))
  const newPrevious = round2(balance.previousSavings + balance.periodSavings + toSavingsTotal)

  const confirm = async () => {
    try {
      setSaving(true)
      setError(null)
      const closeRows: CloseRowInput[] = [
        ...lines.map((line) => ({ idBudgetType: line.row.idBudgetType, balance: line.row.balance, carried: line.carried, toSavings: line.toSavings })),
        ...overspent.map((row) => ({ idBudgetType: row.idBudgetType, balance: row.balance, carried: 0, toSavings: 0 })),
        { idBudgetType: null, balance: balance.periodSavings, carried: 0, toSavings: balance.periodSavings },
      ]
      await onConfirm(month, closeRows)
    } catch (err) {
      console.error('Error al cerrar el presupuesto:', err)
      const message = (err as { message?: string })?.message || 'No se pudo cerrar el presupuesto'
      setError(/schema cache|does not exist|pml_cfg_budget_close/i.test(message) ? `${message} — ¿has ejecutado la migración 20261026140000?` : message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Cerrar presupuesto de {name}</h3>
            <p className="mt-1 text-sm text-gray-600">
              Las partidas en las que han entrado más ingresos de los que has gastado tienen un sobrante: pásalo a ahorro o déjalo como base del siguiente presupuesto.
            </p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Cerrar" className="rounded-full p-2 text-gray-500 hover:bg-gray-100">
            ✕
          </button>
        </div>

        <label className={`mt-4 block text-sm font-medium text-gray-700 ${months.length <= 1 ? 'hidden' : ''}`}>
          Periodo que termina en
          <select
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base text-gray-900 sm:w-64"
          >
            {[...months].reverse().map((item) => (
              <option key={item} value={item}>
                {monthLabel(item, true)}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 space-y-2">
          {lines.length === 0 && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">Ninguna partida tiene sobrante: no hay nada que mover.</p>}
          {lines.map(({ row, decision, carried, toSavings }) => (
            <div key={row.idBudgetType} className="grid items-center gap-2 rounded-xl border border-gray-100 p-3 sm:grid-cols-[1fr_auto_11rem]">
              <div>
                <p className="font-medium text-gray-900">{row.name}</p>
                <p className="text-xs text-gray-500">
                  Sobrante <span className="font-semibold tabular-nums text-emerald-700">{formatMoney(row.balance)}</span>
                  {' · '}base del siguiente {formatMoney(carried)} · a ahorro {formatMoney(toSavings)}
                </p>
              </div>
              {decision.mode === 'custom' ? (
                <input
                  type="number"
                  step="0.01"
                  value={decision.custom}
                  onChange={(event) => setDecisions((current) => ({ ...current, [row.idBudgetType]: { mode: 'custom', custom: event.target.value } }))}
                  placeholder="Base…"
                  aria-label="Cantidad que se deja como base"
                  className="w-28 rounded-lg border border-gray-300 px-2.5 py-2 text-right text-sm tabular-nums"
                />
              ) : (
                <span />
              )}
              <select
                value={decision.mode}
                onChange={(event) =>
                  setDecisions((current) => ({
                    ...current,
                    [row.idBudgetType]: { mode: event.target.value as Decision['mode'], custom: current[row.idBudgetType]?.custom || '' },
                  }))
                }
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm"
              >
                <option value="carry">Dejar como base del siguiente</option>
                <option value="savings">Pasar a ahorro</option>
                <option value="custom">Repartir…</option>
              </select>
            </div>
          ))}
        </div>

        {overspent.length > 0 && (
          <p className="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
            {overspent.map((row) => row.name).join(', ')}: gasto por encima de lo aportado. No se arrastra: ya está descontado del ahorro del periodo.
          </p>
        )}

        <div className="mt-4 rounded-xl bg-emerald-50/60 p-3 text-sm text-gray-700">
          <p>
            Ahorro del periodo: <strong className="tabular-nums">{formatMoney(balance.periodSavings)}</strong>
            {toSavingsTotal !== 0 && (
              <>
                {' '}+ saldos que pasan a ahorro: <strong className="tabular-nums">{formatMoney(toSavingsTotal)}</strong>
              </>
            )}
          </p>
          <p className="mt-1 text-gray-600">
            Ahorro anterior después del cierre: <strong className="tabular-nums text-emerald-700">{formatMoney(newPrevious)}</strong>
          </p>
        </div>

        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="rounded-2xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={confirm}
            className="rounded-2xl bg-[#0d9488] px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? 'Cerrando…' : 'Cerrar presupuesto'}
          </button>
        </div>
      </div>
    </div>
  )
}
