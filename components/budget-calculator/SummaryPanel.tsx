'use client'

import { formatMoney, type BudgetLine } from '@/lib/budget-calculator'

export type SavingsMode = 'percent' | 'amount' | 'auto'

export function SavingsControls({
  mode,
  value,
  onModeChange,
  onValueChange,
}: {
  mode: SavingsMode
  value: string
  onModeChange: (mode: SavingsMode) => void
  onValueChange: (value: string) => void
}) {
  const options: Array<{ value: SavingsMode; label: string }> = [
    { value: 'percent', label: '% ingreso' },
    { value: 'amount', label: '€/mes' },
    { value: 'auto', label: 'Auto' },
  ]
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Objetivo de ahorro</div>
      <div className="mt-2 flex items-center gap-2">
        <div className="inline-flex rounded-xl bg-gray-100 p-1">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onModeChange(option.value)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                mode === option.value ? 'bg-white text-[#0d9488] shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {mode !== 'auto' && (
          <div className="relative w-24">
            <input
              type="number"
              min="0"
              step={mode === 'percent' ? '0.5' : '10'}
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-1.5 pl-3 pr-7 text-sm text-gray-900 focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {mode === 'percent' ? '%' : '€'}
            </span>
          </div>
        )}
      </div>
      {mode === 'auto' && (
        <p className="mt-1.5 text-xs text-gray-500">Sin objetivo: se muestra lo que queda tras los presupuestos.</p>
      )}
    </div>
  )
}

export const BAR_COLORS = ['#0d9488', '#14b8a6', '#5eead4', '#99f6e4', '#fcd34d', '#fdba74', '#a5b4fc']

export default function SummaryPanel({
  incomeMonthly,
  lines,
  committedMonthly,
  availableMonthly,
  savingsTargetMonthly,
  unassignedMonthly,
  savingsMode,
  savingsValue,
  onSavingsModeChange,
  onSavingsValueChange,
  annualMonths = 12,
  annualUnitLabel = 'año',
}: {
  incomeMonthly: number
  lines: BudgetLine[]
  committedMonthly: number
  availableMonthly: number
  savingsTargetMonthly: number | null
  unassignedMonthly: number
  savingsMode: SavingsMode
  savingsValue: string
  onSavingsModeChange: (mode: SavingsMode) => void
  onSavingsValueChange: (value: string) => void
  /** Meses que cubre una partida anual (12, o los del periodo si hay fecha de fin) */
  annualMonths?: number
  annualUnitLabel?: string
}) {
  const rate = incomeMonthly > 0 ? (availableMonthly / incomeMonthly) * 100 : 0
  const positive = availableMonthly >= 0
  const reaches = savingsTargetMonthly === null ? null : availableMonthly >= savingsTargetMonthly

  return (
    <aside className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Resumen en vivo</h3>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-sm text-gray-600">Ingreso mensual medio</span>
        <span className="text-lg font-bold tabular-nums text-gray-900">{formatMoney(incomeMonthly)}</span>
      </div>

      {incomeMonthly > 0 && (
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-gray-100">
          {lines.map((line, index) => {
            const width = Math.max(0, (line.monthlyEquivalent / incomeMonthly) * 100)
            return width > 0 ? (
              <div
                key={line.type.id_budget_type}
                style={{ width: `${Math.min(width, 100)}%`, backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}
                title={`${line.type.ds_budget_type}: ${formatMoney(line.monthlyEquivalent)}/mes`}
              />
            ) : null
          })}
        </div>
      )}

      <div className="mt-4 space-y-2.5">
        {lines.map((line, index) => {
          const monthly = line.type.ds_periodicity === 'monthly'
          return (
            <div key={line.type.id_budget_type} className="flex items-start justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-gray-700">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}
                />
                {line.type.ds_budget_type}
              </span>
              <span className="text-right tabular-nums">
                <span className="block font-medium text-gray-900">
                  {formatMoney(line.amount)}
                  <span className="ml-1 text-xs font-normal text-gray-400">{monthly ? '/mes' : `/${annualUnitLabel}`}</span>
                </span>
                {!monthly && (
                  <span className="block text-xs text-gray-400">{formatMoney(line.monthlyEquivalent)}/mes</span>
                )}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-baseline justify-between border-t border-gray-100 pt-3 text-sm">
        <span className="font-medium text-gray-700">Presupuestado / mes</span>
        <span className="font-semibold tabular-nums text-gray-900">{formatMoney(committedMonthly)}</span>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <SavingsControls
          mode={savingsMode}
          value={savingsValue}
          onModeChange={onSavingsModeChange}
          onValueChange={onSavingsValueChange}
        />
      </div>

      <div className={`mt-4 rounded-2xl p-4 ${positive ? 'bg-[#90EBD6]/30' : 'bg-red-50'}`}>
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Te queda (beneficio)</div>
        <div className={`text-2xl font-bold tabular-nums ${positive ? 'text-teal-800' : 'text-red-700'}`}>
          {formatMoney(availableMonthly)}
          <span className="ml-1 text-sm font-medium">/mes</span>
        </div>
        <div className="text-xs text-gray-600">
          {formatMoney(availableMonthly * annualMonths)} {annualUnitLabel === 'año' ? 'al año' : 'en el periodo'}
          {incomeMonthly > 0 ? ` · ${rate.toFixed(1)}% del ingreso` : ''}
        </div>
        {savingsTargetMonthly !== null && (
          <div className="mt-1 text-xs text-gray-500">Objetivo: {formatMoney(savingsTargetMonthly)}/mes</div>
        )}
        {reaches !== null && (
          <div className={`mt-2 text-xs font-semibold ${reaches ? 'text-teal-800' : 'text-red-700'}`}>
            {reaches
              ? `✓ Cumples el objetivo (${formatMoney(savingsTargetMonthly!)}/mes)`
              : `✗ Faltan ${formatMoney(savingsTargetMonthly! - availableMonthly)}/mes para el objetivo`}
          </div>
        )}
      </div>

      {unassignedMonthly > 0 && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          Hay ~{formatMoney(unassignedMonthly)}/mes de gasto histórico sin partida que no está incluido arriba.
        </p>
      )}
    </aside>
  )
}
