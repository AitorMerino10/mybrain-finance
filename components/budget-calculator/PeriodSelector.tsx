'use client'

import { lastCompleteMonths } from '@/lib/budget-calculator'

const inputClass =
  'rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]'

export default function PeriodSelector({
  from,
  to,
  monthsCount,
  minMonth,
  maxMonth,
  onChange,
}: {
  from: string
  to: string
  monthsCount: number
  minMonth: string | null
  maxMonth: string | null
  onChange: (from: string, to: string) => void
}) {
  const presets = [
    { label: 'Últimos 6 meses', range: lastCompleteMonths(6) },
    { label: 'Últimos 12 meses', range: lastCompleteMonths(12) },
    { label: 'Últimos 24 meses', range: lastCompleteMonths(24) },
    ...(minMonth && maxMonth ? [{ label: 'Todo el histórico', range: { from: minMonth, to: maxMonth } }] : []),
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="month"
          value={from}
          max={to}
          onChange={(event) => event.target.value && onChange(event.target.value, to)}
          className={`${inputClass} w-40`}
        />
        <span className="text-gray-400">→</span>
        <input
          type="month"
          value={to}
          min={from}
          onChange={(event) => event.target.value && onChange(from, event.target.value)}
          className={`${inputClass} w-40`}
        />
        <span className="text-sm text-gray-500">{monthsCount} meses</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(preset.range.from, preset.range.to)}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-[#0d9488] hover:text-[#0d9488]"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  )
}
