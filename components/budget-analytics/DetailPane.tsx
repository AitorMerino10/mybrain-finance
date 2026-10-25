'use client'

import { Fragment, useMemo, useState } from 'react'
import {
  buildGoalViews,
  buildPartidaBreakdown,
  buildPartidaSeries,
  monthLabel,
  statusFromRatio,
  sumPoints,
  type BudgetAnalyticsData,
  type BudgetMonthPoint,
  type Status,
} from '@/lib/budget-analytics'
import { currentMonthKey, formatMoney } from '@/lib/budget-calculator'
import { Card, Segmented, StatusBadge } from './common'
import { goalPeriodLabel } from './ControlsPane'

type Metric = 'pct' | 'spent' | 'diff'

const HEAT: Record<Status, string> = {
  ok: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  over: 'bg-red-50 text-red-700',
}

const th = 'whitespace-nowrap px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500'
const stickyFirst = 'sticky left-0 z-10 bg-white'

function MatrixCell({ point, metric }: { point: BudgetMonthPoint; metric: Metric }) {
  if (metric === 'spent') {
    return <td className="px-3 py-2 text-right tabular-nums text-gray-700">{point.spent > 0 ? formatMoney(point.spent) : '—'}</td>
  }
  if (!point.hasBudget || point.budget <= 0) {
    return (
      <td className="px-3 py-2 text-right text-xs text-gray-300" title={point.spent > 0 ? `Gastado ${formatMoney(point.spent)} sin presupuesto` : undefined}>
        {point.spent > 0 ? '·' : '—'}
      </td>
    )
  }
  if (metric === 'diff') {
    const diff = point.budget - point.spent
    return (
      <td className={`px-3 py-2 text-right tabular-nums ${diff < 0 ? 'font-semibold text-red-600' : 'text-gray-700'}`}>
        {diff < 0 ? '−' : ''}
        {formatMoney(Math.abs(diff))}
      </td>
    )
  }
  const ratio = point.spent / point.budget
  return (
    <td className="px-2 py-1.5 text-right">
      <span className={`inline-block min-w-[3rem] rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${HEAT[statusFromRatio(ratio)]}`}>
        {Math.round(ratio * 100)}%
      </span>
    </td>
  )
}

function totalsOf(points: BudgetMonthPoint[]) {
  const covered = points.filter((point) => point.hasBudget)
  return {
    budget: covered.reduce((sum, point) => sum + point.budget, 0),
    coveredSpent: covered.reduce((sum, point) => sum + point.spent, 0),
    spent: points.reduce((sum, point) => sum + point.spent, 0),
  }
}

export default function DetailPane({
  data,
  scopeUserId,
  months,
}: {
  data: BudgetAnalyticsData
  scopeUserId: string | null
  months: string[]
}) {
  const [metric, setMetric] = useState<Metric>('pct')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const nowMonth = currentMonthKey()

  const series = useMemo(() => buildPartidaSeries(data, scopeUserId, months), [data, scopeUserId, months])
  const visible = series.filter((item) => item.totalBudget > 0 || item.totalSpent > 0)
  const totalPoints = useMemo(() => sumPoints(visible, months), [visible, months])
  const breakdown = useMemo(() => buildPartidaBreakdown(data, scopeUserId, months), [data, scopeUserId, months])
  const goalViews = useMemo(() => buildGoalViews(data, scopeUserId, nowMonth), [data, scopeUserId, nowMonth])

  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const renderTotalCell = (points: BudgetMonthPoint[]) => {
    const totals = totalsOf(points)
    if (metric === 'spent') return <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatMoney(totals.spent)}</td>
    if (totals.budget <= 0) return <td className="px-3 py-2 text-right text-xs text-gray-300">—</td>
    if (metric === 'diff') {
      const diff = totals.budget - totals.coveredSpent
      return (
        <td className={`px-3 py-2 text-right font-semibold tabular-nums ${diff < 0 ? 'text-red-600' : 'text-gray-900'}`}>
          {diff < 0 ? '−' : ''}
          {formatMoney(Math.abs(diff))}
        </td>
      )
    }
    const ratio = totals.coveredSpent / totals.budget
    return (
      <td className="px-2 py-1.5 text-right">
        <span className={`inline-block min-w-[3rem] rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${HEAT[statusFromRatio(ratio)]}`}>
          {Math.round(ratio * 100)}%
        </span>
      </td>
    )
  }

  return (
    <div className="space-y-6">
      {/* A. Partidas por mes */}
      <Card
        title="Partidas mes a mes"
        subtitle="Cada celda compara el gasto real de la partida con su presupuesto de ese mes."
        action={
          <Segmented
            size="sm"
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'pct', label: '% usado' },
              { value: 'spent', label: 'Gastado' },
              { value: 'diff', label: 'Diferencia' },
            ]}
          />
        }
      >
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className={`${th} ${stickyFirst} bg-gray-50 text-left`}>Partida</th>
                {months.map((month) => (
                  <th key={month} className={th}>
                    {monthLabel(month)}
                  </th>
                ))}
                <th className={th}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.map((item) => (
                <tr key={item.idBudgetType}>
                  <td className={`${stickyFirst} whitespace-nowrap px-3 py-2 font-medium text-gray-900`}>
                    {item.name}
                    {item.periodicity === 'annual' && <span className="ml-1 text-[10px] font-normal text-gray-400">anual, repartido por meses</span>}
                  </td>
                  {item.points.map((point) => (
                    <MatrixCell key={point.month} point={point} metric={metric} />
                  ))}
                  {renderTotalCell(item.points)}
                </tr>
              ))}
              {visible.length > 0 && (
                <tr className="bg-gray-50/70 font-semibold">
                  <td className={`${stickyFirst} bg-gray-50 px-3 py-2 text-gray-900`}>Total</td>
                  {totalPoints.map((point) => (
                    <MatrixCell key={point.month} point={point} metric={metric} />
                  ))}
                  {renderTotalCell(totalPoints)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          «·» = hubo gasto pero no había presupuesto ese mes. «Sin partida» recoge gastos que no tienen partida ni heredan una de su subcategoría.
        </p>
      </Card>

      {/* B. Desglose por vertical y subvertical */}
      <Card
        title="Desglose por vertical y subvertical"
        subtitle="En qué se ha ido el gasto de cada partida. Despliega para bajar al detalle."
      >
        {breakdown.length === 0 ? (
          <p className="text-sm text-gray-500">No hay gastos en este periodo.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className={`${th} ${stickyFirst} bg-gray-50 text-left`}>Partida / vertical / subvertical</th>
                  {months.map((month) => (
                    <th key={month} className={th}>
                      {monthLabel(month)}
                    </th>
                  ))}
                  <th className={th}>Total</th>
                  <th className={th}>% partida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {breakdown.map((partida) => (
                  <Fragment key={partida.key}>
                    <BreakdownRow node={partida} depth={0} parentTotal={partida.total} expanded={expanded} onToggle={toggle} />
                    {expanded.has(partida.key) &&
                      partida.children.map((category) => (
                        <Fragment key={category.key}>
                          <BreakdownRow node={category} depth={1} parentTotal={partida.total} expanded={expanded} onToggle={toggle} />
                          {expanded.has(category.key) &&
                            category.children.map((sub) => (
                              <BreakdownRow key={sub.key} node={sub} depth={2} parentTotal={category.total} expanded={expanded} onToggle={toggle} />
                            ))}
                        </Fragment>
                      ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* C. Controles */}
      <Card title="Controles de gasto" subtitle="Situación de cada control a fecha de hoy.">
        {goalViews.length === 0 ? (
          <p className="text-sm text-gray-500">No hay controles definidos.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className={`${th} text-left`}>Control</th>
                  {!scopeUserId && <th className={`${th} text-left`}>Persona</th>}
                  <th className={`${th} text-left`}>Periodo</th>
                  <th className={th}>Objetivo</th>
                  <th className={th}>Gastado</th>
                  <th className={th}>Esperado hoy</th>
                  <th className={th}>Proyección</th>
                  <th className={`${th} text-left`}>Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {goalViews.map((view) => {
                  const { progress } = view
                  return (
                    <tr key={view.goal.id_spending_goal}>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className="font-medium text-gray-900">{view.label}</span>
                        <span className="ml-1 text-xs text-gray-400">
                          {view.kind === 'sub' ? view.categoryLabel : 'Categoría'}
                        </span>
                      </td>
                      {!scopeUserId && <td className="whitespace-nowrap px-3 py-2 text-gray-600">{view.userName}</td>}
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">{goalPeriodLabel(view)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {formatMoney(progress.target)}
                        <span className="ml-1 text-[10px] text-gray-400">
                          {view.goal.ds_periodicity === 'monthly' ? `(${formatMoney(view.goal.ft_goal_amount)}/mes)` : ''}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{formatMoney(progress.spent)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-600">{formatMoney(progress.expectedToDate)}</td>
                      <td
                        className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${
                          progress.projectedDelta !== null && progress.projectedDelta > 0 ? 'text-red-600' : 'text-gray-600'
                        }`}
                      >
                        {progress.projected === null ? '—' : formatMoney(progress.projected)}
                      </td>
                      <td className="px-3 py-2">
                        {progress.isUpcoming ? (
                          <span className="text-xs text-gray-400">Próximo</span>
                        ) : (
                          <StatusBadge
                            status={progress.status}
                            label={progress.isFinished ? (progress.status === 'over' ? 'Superado' : 'Cumplido') : undefined}
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function BreakdownRow({
  node,
  depth,
  parentTotal,
  expanded,
  onToggle,
}: {
  node: { key: string; label: string; series: number[]; total: number; children: unknown[] }
  depth: number
  parentTotal: number
  expanded: Set<string>
  onToggle: (key: string) => void
}) {
  const hasChildren = node.children.length > 0 && depth < 2
  const open = expanded.has(node.key)
  const share = parentTotal > 0 ? Math.round((node.total / parentTotal) * 100) : 0
  return (
    <tr className={depth === 0 ? 'bg-gray-50/60 font-semibold' : ''}>
      <td className={`${stickyFirst} whitespace-nowrap px-3 py-2 ${depth === 0 ? 'bg-gray-50' : ''}`} style={{ paddingLeft: 12 + depth * 20 }}>
        {hasChildren ? (
          <button type="button" onClick={() => onToggle(node.key)} className="flex items-center gap-1.5 text-left text-gray-900">
            <span className="inline-block w-3 text-xs text-gray-400">{open ? '▾' : '▸'}</span>
            {node.label}
          </button>
        ) : (
          <span className={`ml-[18px] ${depth === 2 ? 'text-gray-600' : 'text-gray-900'}`}>{node.label}</span>
        )}
      </td>
      {node.series.map((value, i) => (
        <td key={i} className="px-3 py-2 text-right tabular-nums text-gray-700">
          {value > 0 ? formatMoney(value) : '—'}
        </td>
      ))}
      <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatMoney(node.total)}</td>
      <td className="px-3 py-2 text-right text-xs tabular-nums text-gray-500">{depth === 0 ? '100%' : `${share}%`}</td>
    </tr>
  )
}
