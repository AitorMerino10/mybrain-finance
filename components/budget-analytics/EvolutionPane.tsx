'use client'

import { useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { buildPartidaSeries, monthLabel, type BudgetAnalyticsData } from '@/lib/budget-analytics'
import { formatMoney } from '@/lib/budget-calculator'
import BudgetEvolution from './BudgetEvolution'
import { CHART_COLORS, Card, EmptyState } from './common'
import { accentForPartida } from './partidaAccent'

function EvolutionTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  const items = payload.filter((entry) => Number(entry.value) > 0)
  return (
    <div className="min-w-[190px] rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs shadow-[0_8px_24px_-12px_rgba(15,23,42,0.25)]">
      <p className="mb-2 text-sm font-semibold capitalize text-slate-900">{label}</p>
      {items.map((entry) => (
        <p key={entry.dataKey} className="mt-1 flex items-center justify-between gap-4 text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: entry.stroke || entry.color }} />
            {entry.name}
          </span>
          <span className="font-semibold tabular-nums text-slate-900">{formatMoney(Number(entry.value))}</span>
        </p>
      ))}
    </div>
  )
}

/** Cómo han ido cambiando los presupuestos con el tiempo, frente a lo que se ha gastado. */
export default function EvolutionPane({
  data,
  scopeUserId,
  months,
}: {
  data: BudgetAnalyticsData
  scopeUserId: string | null
  months: string[]
}) {
  const series = useMemo(
    () => buildPartidaSeries(data, scopeUserId, months).filter((item) => !item.isUnassigned && item.totalBudget > 0),
    [data, scopeUserId, months]
  )

  const rows = useMemo(
    () =>
      months.map((month, index) => {
        const row: Record<string, any> = { label: monthLabel(month) }
        let spent = 0
        let budget = 0
        for (const item of series) {
          row[item.idBudgetType] = Math.round(item.points[index].budget * 100) / 100
          budget += item.points[index].budget
          if (item.points[index].hasBudget) spent += item.points[index].spent
        }
        row.total = Math.round(budget * 100) / 100
        row.spent = Math.round(spent * 100) / 100
        return row
      }),
    [series, months]
  )

  return (
    <div className="space-y-6">
      <Card
        icon="chart"
        title="Evolución del presupuesto mensual"
        subtitle="Presupuesto vigente cada mes (las partidas anuales, ÷ 12), apilado por partida, frente al gasto real. Los escalones son los cambios de importe."
      >
        {series.length === 0 ? (
          <EmptyState>Todavía no hay presupuestos en este periodo.</EmptyState>
        ) : (
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
                  <Tooltip content={<EvolutionTooltip />} />
                  {series.map((item) => {
                    const color = accentForPartida(data, item.idBudgetType).solid
                    return (
                      <Area
                        key={item.idBudgetType}
                        dataKey={item.idBudgetType}
                        name={item.name}
                        stackId="budget"
                        type="stepAfter"
                        stroke={color}
                        fill={color}
                        fillOpacity={0.55}
                        strokeWidth={1.5}
                      />
                    )
                  })}
                  <Line dataKey="spent" name="Gasto real" stroke="#334155" strokeWidth={2} dot={{ r: 3, fill: '#334155', strokeWidth: 0 }} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {series.map((item) => (
                <span key={item.idBudgetType} className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: accentForPartida(data, item.idBudgetType).solid }} />
                  {item.name}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <span className="inline-block h-0.5 w-3.5 bg-slate-700" />
                Gasto real
              </span>
            </div>
          </>
        )}
      </Card>

      <Card
        icon="tag"
        title="Histórico de presupuestos"
        subtitle="Cada fila es una fecha en la que cambió algún importe y vale hasta la siguiente. Una persona siempre tiene un único presupuesto vigente cada mes."
      >
        <BudgetEvolution versions={data.budgets} budgetTypes={data.budgetTypes} members={data.members} scopeUserId={scopeUserId} />
      </Card>
    </div>
  )
}
