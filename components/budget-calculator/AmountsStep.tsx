'use client'

import { useState } from 'react'
import type { BudgetSubtype } from '@/lib/budgets'
import { formatMoney, parseNumber, round2, type BudgetLine, type PeriodRow, type SeriesStats } from '@/lib/budget-calculator'
import PartidaExplanation from './PartidaExplanation'

const inputClass =
  'rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]'

type Stat = 'avg' | 'median' | 'p75'
const STAT_LABELS: Array<{ key: Stat; label: string; short: string; help: string }> = [
  { key: 'avg', label: 'Media', short: 'Media', help: 'Lo que gastas de media: total ÷ meses.' },
  { key: 'median', label: 'Mediana', short: 'Mediana', help: 'El valor «típico»: ignora los meses muy altos o muy bajos.' },
  { key: 'p75', label: 'Percentil 75', short: 'P75', help: 'Un nivel prudente: en 3 de cada 4 meses gastaste menos que esto.' },
]

/** Importe con borrador mientras se escribe (para no pelearse con los decimales). */
function AmountField({
  value,
  onCommit,
  suffix,
  width = 'w-28',
  placeholder,
  ariaLabel,
}: {
  value: string
  onCommit: (raw: string) => void
  suffix: string
  width?: string
  placeholder?: string
  ariaLabel: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min="0"
        step="1"
        value={draft ?? value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => {
          setDraft(event.target.value)
          onCommit(event.target.value)
        }}
        onBlur={() => setDraft(null)}
        className={`${inputClass} ${width} !py-1 text-right font-semibold tabular-nums`}
      />
      <span className="whitespace-nowrap text-xs text-gray-400">{suffix}</span>
    </div>
  )
}

function PartidaCard({
  line,
  override,
  rows,
  months,
  annualMonths,
  annualUnitLabel,
  subs,
  subAmounts,
  directAmount,
  onAmountChange,
  onSubAmountChange,
  onDirectAmountChange,
}: {
  line: BudgetLine
  override: string | undefined
  rows: PeriodRow[]
  months: string[]
  annualMonths: number
  annualUnitLabel: string
  subs: BudgetSubtype[]
  subAmounts: Record<string, string>
  directAmount: string
  onAmountChange: (raw: string) => void
  onSubAmountChange: (idSubtype: string, raw: string) => void
  onDirectAmountChange: (raw: string) => void
}) {
  const [explainOpen, setExplainOpen] = useState(false)
  const [extrasOpen, setExtrasOpen] = useState(false)
  const type = line.type
  const monthly = type.ds_periodicity === 'monthly'
  const factor = monthly ? 1 : annualMonths
  const unit = monthly ? '€/mes' : `€/${annualUnitLabel}`
  const stats: SeriesStats = line.stats
  const values: Record<Stat, number> = {
    avg: Math.round(stats.avg * factor),
    median: Math.round(stats.median * factor),
    p75: Math.round(stats.p75 * factor),
  }
  const hasExtras = parseNumber(directAmount) > 0 || subs.some((sub) => parseNumber(subAmounts[sub.id_budget_subtype]) > 0)
  const chosen = STAT_LABELS.find((item) => Math.abs(line.amount - values[item.key]) < 0.5 && !hasExtras)?.key

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <div className="min-w-[140px]">
          <h3 className="text-sm font-semibold text-gray-900">{type.ds_budget_type}</h3>
          <p className="text-[11px] text-gray-500">{monthly ? 'cada mes' : annualMonths === 12 ? 'total al año' : `total para ${annualMonths} meses`}</p>
        </div>

        {stats.total > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {STAT_LABELS.map((item) => {
              const active = chosen === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onAmountChange(String(values[item.key]))}
                  title={`${item.help} Pulsa para usarla.`}
                  className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                    active ? 'border-[#0d9488] bg-[#90EBD6]/30 font-semibold text-gray-900' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-[#0d9488]/60'
                  }`}
                >
                  {item.short} <span className="font-semibold tabular-nums text-gray-900">{formatMoney(values[item.key])}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <span className="text-xs text-gray-400">Sin gastos relacionados en estos meses</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {!monthly && <span className="text-xs text-gray-400">{formatMoney(line.monthlyEquivalent)}/mes</span>}
          <AmountField
            value={override !== undefined ? override : String(line.amount)}
            onCommit={onAmountChange}
            suffix={unit}
            width="w-24"
            ariaLabel={`Presupuesto de ${type.ds_budget_type}`}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 border-t border-gray-50 bg-gray-50/50 px-4 py-1 text-xs">
        <button type="button" onClick={() => setExplainOpen((open) => !open)} aria-expanded={explainOpen} className="font-medium text-[#0d9488] hover:underline">
          {explainOpen ? '▾ Ocultar explicación' : '▸ Ver cómo salen'}
        </button>
        <button type="button" onClick={() => setExtrasOpen((open) => !open)} aria-expanded={extrasOpen} className="font-medium text-gray-600 hover:underline">
          {extrasOpen ? '▾ ' : '▸ '}
          {subs.length > 0 ? 'Subpartidas y gastos previstos' : 'Gasto previsto'}
          {hasExtras && <span className="ml-1.5 rounded-full bg-[#90EBD6]/50 px-1.5 text-[10px] text-teal-800">con importes</span>}
        </button>
        {override !== undefined && (
          <button type="button" onClick={() => onAmountChange('')} className="ml-auto font-medium text-gray-500 hover:text-gray-800">
            Volver al cálculo
          </button>
        )}
      </div>

      {extrasOpen && (
        <div className="space-y-1.5 border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-500">
            Se <strong>suma</strong> al presupuesto de la partida (no sale del histórico): útil para algo previsto que aún no has gastado, como un traje de boda.
          </p>
          {subs.map((sub) => (
            <label key={sub.id_budget_subtype} className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-700">
              <span>↳ {sub.ds_budget_subtype}</span>
              <AmountField
                value={subAmounts[sub.id_budget_subtype] ?? ''}
                onCommit={(raw) => onSubAmountChange(sub.id_budget_subtype, raw)}
                suffix={unit}
                width="w-24"
                placeholder="0"
                ariaLabel={`Importe de ${sub.ds_budget_subtype}`}
              />
            </label>
          ))}
          <label className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-700">
            <span>{subs.length > 0 ? 'Adicional (sin subpartida)' : 'Importe previsto'}</span>
            <AmountField value={directAmount} onCommit={onDirectAmountChange} suffix={unit} width="w-24" placeholder="0" ariaLabel={`Importe adicional de ${type.ds_budget_type}`} />
          </label>
        </div>
      )}

      {explainOpen && (
        <div className="border-t border-gray-100 p-4">
          <PartidaExplanation rows={rows} months={months} stats={stats} />
        </div>
      )}
    </section>
  )
}

/**
 * Paso de importes: para cada partida, media / mediana / percentil 75 del histórico elegido,
 * una explicación pinchable (gráfica mensual + detalle) y el importe que se presupuesta.
 */
export default function AmountsStep({
  lines,
  overrides,
  rowsByType,
  months,
  annualMonths,
  annualUnitLabel,
  subsByType,
  subAmounts,
  directAmounts,
  unassigned,
  onAmountChange,
  onSubAmountChange,
  onDirectAmountChange,
}: {
  lines: BudgetLine[]
  overrides: Record<string, string>
  rowsByType: Map<string, PeriodRow[]>
  months: string[]
  annualMonths: number
  annualUnitLabel: string
  subsByType: Map<string, BudgetSubtype[]>
  subAmounts: Record<string, string>
  directAmounts: Record<string, string>
  unassigned: SeriesStats
  onAmountChange: (idBudgetType: string, raw: string) => void
  onSubAmountChange: (idBudgetType: string, idSubtype: string, raw: string) => void
  onDirectAmountChange: (idBudgetType: string, raw: string) => void
}) {
  const total = lines.reduce((sum, line) => sum + line.monthlyEquivalent, 0)
  return (
    <div className="space-y-2">
      <p className="px-1 text-xs text-gray-500">
        Pulsa <strong>Media</strong>, <strong>Mediana</strong> o <strong>P75</strong> para usarla como presupuesto, o escribe tu importe.
        {unassigned.total > 0 && (
          <span className="ml-1 text-amber-700">
            Hay ≈ {formatMoney(unassigned.avg)}/mes de gasto sin partida que no cuenta (paso 3).
          </span>
        )}
      </p>
      {lines.map((line) => {
        const id = line.type.id_budget_type
        return (
          <PartidaCard
            key={id}
            line={line}
            override={overrides[id]}
            rows={rowsByType.get(id) ?? []}
            months={months}
            annualMonths={annualMonths}
            annualUnitLabel={annualUnitLabel}
            subs={subsByType.get(id) ?? []}
            subAmounts={subAmounts}
            directAmount={directAmounts[id] ?? ''}
            onAmountChange={(raw) => onAmountChange(id, raw)}
            onSubAmountChange={(idSubtype, raw) => onSubAmountChange(id, idSubtype, raw)}
            onDirectAmountChange={(raw) => onDirectAmountChange(id, raw)}
          />
        )
      })}
      {lines.length === 0 && (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          No hay partidas. Vuelve al paso 2 para crearlas.
        </p>
      )}
      <p className="text-right text-sm text-gray-600">
        Presupuestado en total: <strong className="tabular-nums">{formatMoney(round2(total))}</strong> al mes
      </p>
    </div>
  )
}
