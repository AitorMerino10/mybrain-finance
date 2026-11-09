'use client'

import { addMonths, currentMonthKey, lastCompleteMonths, shortMonthLabel } from '@/lib/budget-calculator'

/**
 * Selector de cuántos meses de histórico se usan para las cifras (media, mediana, percentil…).
 * Por defecto 12 meses; también 3, 6 o todo el histórico.
 */
export default function HistoryWindow({
  from,
  to,
  minMonth,
  onChange,
}: {
  from: string
  to: string
  minMonth: string | null
  onChange: (from: string, to: string) => void
}) {
  const lastMonth = addMonths(currentMonthKey(), -1)
  const options = [
    { key: '3', label: '3 meses', range: lastCompleteMonths(3) },
    { key: '6', label: '6 meses', range: lastCompleteMonths(6) },
    { key: '12', label: '12 meses', range: lastCompleteMonths(12) },
    ...(minMonth ? [{ key: 'all', label: 'Todo el histórico', range: { from: minMonth <= lastMonth ? minMonth : lastMonth, to: lastMonth } }] : []),
  ]
  const active = options.find((option) => option.range.from === from && option.range.to === to)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-gray-100 bg-white px-4 py-2 shadow-sm">
      <div className="text-xs text-gray-500">
        <span className="font-semibold uppercase tracking-wide">Histórico</span> · {shortMonthLabel(from)} → {shortMonthLabel(to)}
      </div>
      <div className="inline-flex rounded-xl bg-gray-100 p-1">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.range.from, option.range.to)}
            className={`rounded-lg px-2.5 py-1 text-sm font-medium transition ${
              active?.key === option.key ? 'bg-white text-[#0d9488] shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {option.label}
          </button>
        ))}
        {!active && <span className="rounded-lg px-2.5 py-1 text-sm font-medium text-gray-500">Personalizado</span>}
      </div>
    </div>
  )
}
