'use client'

import { useMemo, useState } from 'react'
import {
  budgetDeadline,
  budgetPeriodLabel,
  buildPartidaSeries,
  buildSpendTree,
  median,
  monthLabel,
  statusFromRatio,
  type BudgetAnalyticsData,
  type BudgetMonthPoint,
  type PartidaSeries,
} from '@/lib/budget-analytics'
import { currentMonthKey, formatMoney } from '@/lib/budget-calculator'
import BudgetVsActual from './BudgetVsActual'
import { Card, Segmented } from './common'
import { accentForPartida } from './partidaAccent'
import PartidaCard from './PartidaCard'
import SpendTreeView from './SpendTreeView'
import { BRAND_ACCENT, type Accent } from './visuals'

function PartidaTree({
  data,
  scopeUserId,
  months,
  idBudgetType,
  accent,
  periodLabel,
  monthBudgets,
}: {
  data: BudgetAnalyticsData
  scopeUserId: string | null
  months: string[]
  idBudgetType: string
  accent: Accent
  periodLabel: string
  monthBudgets: Record<string, number>
}) {
  const tree = useMemo(() => buildSpendTree(data, scopeUserId, { months, idBudgetType }), [data, scopeUserId, months, idBudgetType])
  return (
    <SpendTreeView
      tree={tree}
      accent={accent}
      periodLabel={periodLabel}
      monthBudgets={monthBudgets}
      partialMonth={months.includes(currentMonthKey())}
    />
  )
}

export default function BudgetsPane({
  data,
  scopeUserId,
  months,
}: {
  data: BudgetAnalyticsData
  scopeUserId: string | null
  months: string[]
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [view, setView] = useState<'aggregate' | 'breakdown'>('aggregate')
  const series = useMemo(() => buildPartidaSeries(data, scopeUserId, months), [data, scopeUserId, months])
  const visible = series.filter((item) => item.totalBudget > 0 || item.totalSpent > 0)

  const chosen = useMemo(() => {
    const active = selectedIds.filter((id) => visible.some((item) => item.idBudgetType === id))
    return active.length === 0 ? visible : visible.filter((item) => active.includes(item.idBudgetType))
  }, [selectedIds, visible])
  const allChosen = chosen.length === visible.length
  const colorFor = (id: string) => accentForPartida(data, id).solid

  const toggleChosen = (id: string) =>
    setSelectedIds((current) => {
      const base = current.length === 0 ? visible.map((item) => item.idBudgetType) : current
      const next = base.includes(id) ? base.filter((item) => item !== id) : [...base, id]
      return next.length === visible.length ? [] : next
    })

  const periodicityNote =
    'Las partidas anuales se reparten en partes iguales (importe anual ÷ 12, o importe del periodo ÷ sus meses si tienen fecha de fin) para poder sumarlas con las mensuales.'

  const nowMonth = currentMonthKey()
  const windowLabel = months.length === 1 ? `en ${monthLabel(months[0], true).toLowerCase()}` : 'en el periodo'

  /** Presupuesto y gasto de la partida en el periodo (solo los meses en los que tenía presupuesto; "sin partida" cuenta todos) */
  const windowStats = (item: PartidaSeries) => {
    const covered = item.points.filter((point) => point.hasBudget)
    const budget = covered.reduce((sum, point) => sum + point.budget, 0)
    const spent = (item.isUnassigned ? item.points : covered).reduce((sum, point) => sum + point.spent, 0)
    return { budget, spent }
  }

  /** Mediana del gasto mensual en los meses que lleva vigente (sin el mes en curso si hay otros completos) */
  const medianOf = (item: PartidaSeries) => {
    const counted: BudgetMonthPoint[] = item.isUnassigned ? item.points : item.points.filter((point) => point.hasBudget)
    const complete = counted.length > 1 ? counted.filter((point) => point.month !== nowMonth) : counted
    return { value: median(complete.map((point) => point.spent)), count: complete.length, total: counted.length }
  }

  return (
    <div className="space-y-6">
      <Card
        icon="chart"
        title="Presupuesto vs gasto real"
        subtitle="Una barra por mes con el presupuesto y el gasto. En la vista por presupuesto ves de qué partidas se compone; puedes elegir varias para compararlas."
      >
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Segmented
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'aggregate', label: 'Agregado' },
              { value: 'breakdown', label: 'Por presupuesto' },
            ]}
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                allChosen ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Todos
            </button>
            {visible.map((item) => {
              const on = !allChosen && chosen.some((chosenItem) => chosenItem.idBudgetType === item.idBudgetType)
              return (
                <button
                  key={item.idBudgetType}
                  type="button"
                  onClick={() => toggleChosen(item.idBudgetType)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(item.idBudgetType) }} />
                  {item.name}
                </button>
              )
            })}
          </div>
        </div>
        <BudgetVsActual
          partidas={chosen}
          months={months}
          colorFor={colorFor}
          breakdown={view === 'breakdown'}
          footnote={periodicityNote}
        />
      </Card>

      <Card
        icon="sparkles"
        accent={BRAND_ACCENT}
        title="¿Por qué me he pasado o quedado corto?"
        subtitle="Gasto de cada partida en el presupuesto elegido, con la mediana mensual de los meses que lleva vigente. Ábrela para ver el detalle mes a mes y qué verticales, subverticales y gastos lo componen."
      >
        {visible.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay presupuestos ni gastos en este periodo.</p>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {visible.map((item) => {
              const { budget, spent } = windowStats(item)
              const ratio = budget > 0 ? spent / budget : null
              const accent = accentForPartida(data, item.idBudgetType)
              // El desglose solo mira los meses en los que la partida tenía presupuesto
              const coveredMonths = item.isUnassigned ? months : months.filter((month) => item.points.find((point) => point.month === month)?.hasBudget)
              const treeMonths = coveredMonths.length > 0 ? coveredMonths : months
              const monthBudgets = Object.fromEntries(item.points.filter((point) => point.hasBudget).map((point) => [point.month, point.budget]))
              const typical = medianOf(item)
              return (
                <PartidaCard
                  key={item.idBudgetType}
                  name={item.name}
                  accent={accent}
                  periodicityLabel={budgetPeriodLabel(data, scopeUserId, item.idBudgetType, item.periodicity, currentMonthKey())}
                  spent={spent}
                  budget={budget}
                  ratio={ratio}
                  status={item.isUnassigned ? 'warning' : statusFromRatio(ratio)}
                  noBudgetMessage={item.isUnassigned ? 'en gastos sin partida asignada' : 'sin presupuesto en este periodo'}
                  caption={
                    typical.total > 1
                      ? `Mediana mensual ${formatMoney(typical.value)} · ${typical.count} ${typical.count === 1 ? 'mes' : 'meses'} vigente${typical.count === 1 ? '' : 's'}`
                      : windowLabel[0].toUpperCase() + windowLabel.slice(1)
                  }
                  deadline={item.isUnassigned ? null : budgetDeadline(data, scopeUserId, item.idBudgetType, currentMonthKey())}
                >
                  <PartidaTree
                    data={data}
                    scopeUserId={scopeUserId}
                    months={treeMonths}
                    idBudgetType={item.idBudgetType}
                    accent={accent}
                    periodLabel={windowLabel}
                    monthBudgets={monthBudgets}
                  />
                </PartidaCard>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
