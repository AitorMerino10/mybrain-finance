'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { monthLabel, statusFromRatio, type PartidaSeries } from '@/lib/budget-analytics'
import { formatMoney } from '@/lib/budget-calculator'
import { CHART_COLORS, EmptyState, KpiTile, Segmented } from './common'

type Mode = 'monthly' | 'cumulative'
type Row = Record<string, any> & { label: string }

const BUDGET_LINE = '#334155'

const round = (value: number) => Math.round(value * 100) / 100

function spentColor(spent: number, budget: number): string {
  if (budget <= 0) return CHART_COLORS.actual
  if (spent > budget) return CHART_COLORS.over
  if (spent >= budget * 0.85) return CHART_COLORS.warning
  return CHART_COLORS.actual
}

function ChartTooltip({
  active,
  payload,
  partidas,
  colorFor,
  breakdown,
  budgetLabel,
}: {
  active?: boolean
  payload?: any[]
  partidas: PartidaSeries[]
  colorFor: (id: string) => string
  breakdown: boolean
  budgetLabel: string
}) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload as Row
  const budget = Number(row.budget) || 0
  const spent = Number(row.spent) || 0
  return (
    <div className="min-w-[200px] rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs shadow-[0_8px_24px_-12px_rgba(15,23,42,0.25)]">
      <p className="mb-2 text-sm font-semibold text-slate-900">{row.label}</p>
      <p className="flex items-center justify-between gap-4 text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3" style={{ backgroundColor: BUDGET_LINE }} />
          {budgetLabel}
        </span>
        <span className="font-semibold tabular-nums text-slate-900">{formatMoney(budget)}</span>
      </p>
      <p className="mt-1 flex items-center justify-between gap-4 text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: spentColor(spent, budget) }} />
          Gasto
        </span>
        <span className="font-semibold tabular-nums text-slate-900">{formatMoney(spent)}</span>
      </p>
      {breakdown && (
        <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
          {partidas
            .filter((item) => (Number(row[`p_${item.idBudgetType}`]) || 0) > 0)
            .map((item) => (
              <p key={item.idBudgetType} className="flex items-center justify-between gap-4 text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: colorFor(item.idBudgetType) }} />
                  {item.name}
                </span>
                <span className="tabular-nums text-slate-800">{formatMoney(Number(row[`p_${item.idBudgetType}`]) || 0)}</span>
              </p>
            ))}
        </div>
      )}
      {budget > 0 && (
        <p className={`mt-2 border-t border-slate-100 pt-2 font-semibold ${spent > budget ? 'text-rose-600' : 'text-emerald-700'}`}>
          {spent > budget ? `${formatMoney(spent - budget)} por encima` : `${formatMoney(budget - spent)} por debajo`} ({Math.round((spent / budget) * 100)}%)
        </p>
      )}
    </div>
  )
}

function LegendDot({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span className={line ? 'inline-block h-0.5 w-3.5' : 'inline-block h-2.5 w-2.5 rounded-sm'} style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

/**
 * Una única barra por mes con presupuesto y gasto a la vez. Vista agregada (gastado + lo que queda / el exceso)
 * o desglosada por presupuesto (barra apilada con una marca del presupuesto). Con más de un mes se muestra
 * el acumulado por defecto.
 */
export default function BudgetVsActual({
  partidas,
  months,
  colorFor,
  breakdown,
  footnote,
  budgetLabel = 'Presupuesto',
}: {
  partidas: PartidaSeries[]
  months: string[]
  colorFor: (idBudgetType: string) => string
  breakdown: boolean
  footnote?: string
  budgetLabel?: string
}) {
  const multi = months.length > 1
  const [mode, setMode] = useState<Mode>(multi ? 'cumulative' : 'monthly')
  useEffect(() => {
    setMode(multi ? 'cumulative' : 'monthly')
  }, [multi])
  const effectiveMode: Mode = multi ? mode : 'monthly'

  // El gasto solo se compara en los meses en los que la partida tenía presupuesto (las "sin partida" siempre cuentan)
  const counts = (item: PartidaSeries, index: number) => item.isUnassigned || item.points[index].hasBudget

  const { rows, totals, uncovered } = useMemo(() => {
    const running: Record<string, number> = {}
    const bump = (key: string, value: number) => {
      if (effectiveMode === 'cumulative') {
        running[key] = (running[key] || 0) + value
        return running[key]
      }
      return value
    }
    let uncoveredSpend = 0
    let totalBudget = 0
    let totalSpent = 0

    const built: Row[] = months.map((month, index) => {
      const row: Row = { label: monthLabel(month) }
      let monthBudget = 0
      let monthSpent = 0
      for (const item of partidas) {
        const point = item.points[index]
        monthBudget += point.budget
        const counted = counts(item, index) ? point.spent : 0
        if (!counts(item, index)) uncoveredSpend += point.spent
        monthSpent += counted
        row[`p_${item.idBudgetType}`] = round(bump(`p_${item.idBudgetType}`, counted))
      }
      totalBudget += monthBudget
      totalSpent += monthSpent
      const budget = round(bump('budget', monthBudget))
      const spent = round(bump('spent', monthSpent))
      row.budget = budget
      row.spent = spent
      // Agregado: gastado + lo que queda (o el exceso) en una sola barra
      row.seg1 = Math.min(spent, budget > 0 ? budget : spent)
      row.seg2 = budget > 0 ? Math.abs(budget - spent) : 0
      row.seg1Color = spent > budget && budget > 0 ? CHART_COLORS.actual : spentColor(spent, budget)
      row.seg2Color = spent > budget ? CHART_COLORS.over : CHART_COLORS.budget
      return row
    })
    return { rows: built, totals: { budget: totalBudget, spent: totalSpent }, uncovered: uncoveredSpend }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidas, months, effectiveMode])

  const compared = rows.filter((_, i) => partidas.some((item) => item.points[i].hasBudget)).length
  const ratio = totals.budget > 0 ? totals.spent / totals.budget : null
  const diff = totals.budget - totals.spent
  const hasAnything = rows.some((row) => row.budget > 0 || row.spent > 0)
  const ratioStatus = statusFromRatio(ratio)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label={budgetLabel} value={formatMoney(totals.budget)} hint={multi ? 'suma de los meses elegidos' : 'del mes'} />
        <KpiTile label="Gasto real" value={formatMoney(totals.spent)} hint="en los meses con presupuesto" />
        <KpiTile
          label={diff >= 0 ? 'Por debajo' : 'Por encima'}
          value={formatMoney(Math.abs(diff))}
          tone={totals.budget === 0 ? 'default' : diff >= 0 ? 'good' : 'bad'}
          hint={ratio !== null ? `${Math.round(ratio * 100)}% de lo previsto` : undefined}
        />
        <KpiTile
          label="Meses comparados"
          value={`${compared} / ${months.length}`}
          hint={uncovered > 0 ? `${formatMoney(uncovered)} gastados sin referencia` : undefined}
        />
      </div>

      {multi && (
        <div className="flex items-center justify-between gap-3">
          <Segmented
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'cumulative', label: 'Acumulado' },
              { value: 'monthly', label: 'Mensual' },
            ]}
          />
          {ratio !== null && (
            <span className={`text-xs font-medium ${ratioStatus === 'over' ? 'text-rose-600' : ratioStatus === 'warning' ? 'text-amber-700' : 'text-emerald-700'}`}>
              {Math.round(ratio * 100)}% usado en el periodo
            </span>
          )}
        </div>
      )}

      {hasAnything ? (
        <>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => (Math.abs(value) >= 1000 ? `${Math.round(value / 100) / 10}k` : String(value))}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(15,23,42,0.03)' }}
                  content={<ChartTooltip partidas={partidas} colorFor={colorFor} breakdown={breakdown} budgetLabel={budgetLabel} />}
                />
                {breakdown ? (
                  <>
                    {partidas.map((item, i) => (
                      <Bar
                        key={item.idBudgetType}
                        dataKey={`p_${item.idBudgetType}`}
                        stackId="spent"
                        fill={colorFor(item.idBudgetType)}
                        maxBarSize={44}
                        radius={i === partidas.length - 1 ? [4, 4, 0, 0] : 0}
                      />
                    ))}
                    <Line dataKey="budget" stroke={BUDGET_LINE} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: BUDGET_LINE, strokeWidth: 0 }} type="monotone" />
                  </>
                ) : (
                  <>
                    <Bar dataKey="seg1" stackId="a" maxBarSize={44}>
                      {rows.map((row, i) => (
                        <Cell key={i} fill={row.seg1Color} />
                      ))}
                    </Bar>
                    <Bar dataKey="seg2" stackId="a" maxBarSize={44} radius={[4, 4, 0, 0]}>
                      {rows.map((row, i) => (
                        <Cell key={i} fill={row.seg2Color} />
                      ))}
                    </Bar>
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {breakdown ? (
              <>
                {partidas.map((item) => (
                  <LegendDot key={item.idBudgetType} color={colorFor(item.idBudgetType)} label={item.name} />
                ))}
                <LegendDot color={BUDGET_LINE} label={budgetLabel} line />
              </>
            ) : (
              <>
                <LegendDot color={CHART_COLORS.actual} label="Gastado" />
                <LegendDot color={CHART_COLORS.budget} label="Disponible" />
                <LegendDot color={CHART_COLORS.over} label="Exceso" />
              </>
            )}
          </div>
        </>
      ) : (
        <EmptyState>No hay datos en este periodo.</EmptyState>
      )}

      {footnote && <p className="text-xs text-slate-400">{footnote}</p>}
    </div>
  )
}
