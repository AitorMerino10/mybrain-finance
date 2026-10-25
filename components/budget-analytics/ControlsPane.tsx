'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  buildGoalViews,
  goalMonthlySeries,
  monthLabel,
  verticalMonthlySeries,
  type BudgetAnalyticsData,
  type BudgetMonthPoint,
  type GoalView,
} from '@/lib/budget-analytics'
import { currentMonthKey, formatMoney } from '@/lib/budget-calculator'
import { dateToMonth } from '@/lib/goals'
import BudgetVsActual from './BudgetVsActual'
import { Card, EmptyState, ProgressBar } from './common'

const TOTAL = 'total'

export function goalPeriodLabel(view: GoalView): string {
  const start = dateToMonth(view.goal.dt_start_month)
  const end = dateToMonth(view.goal.dt_end_month)
  return `${monthLabel(start)} – ${monthLabel(end)}`
}

export function ControlCard({ view }: { view: GoalView }) {
  const { goal, progress } = view
  const ratio = progress.target > 0 ? progress.spent / progress.target : null
  const pace = progress.totalMonths > 0 ? progress.elapsedMonths / progress.totalMonths : 0
  const monthly = goal.ds_periodicity === 'monthly'
  const statusLabel = progress.isUpcoming ? 'Próximo' : progress.isFinished ? 'Cerrado' : undefined

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{view.label}</p>
          <p className="truncate text-xs text-gray-500">
            {view.kind === 'sub' ? `${view.categoryLabel || 'Subcategoría'} · ` : 'Categoría · '}
            {formatMoney(goal.ft_goal_amount)}
            {monthly ? '/mes' : ' en el periodo'}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            statusLabel
              ? 'bg-gray-100 text-gray-600'
              : progress.status === 'over'
                ? 'bg-red-50 text-red-700'
                : progress.status === 'warning'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {statusLabel || (progress.status === 'over' ? 'Superado' : progress.status === 'warning' ? 'Por encima del ritmo' : 'En ritmo')}
        </span>
      </div>
      <ProgressBar ratio={ratio} status={progress.status} paceFraction={progress.isUpcoming ? undefined : pace} />
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>
          {formatMoney(progress.spent)} de {formatMoney(progress.target)}
        </span>
        <span>{goalPeriodLabel(view)}</span>
      </div>
      {progress.projected !== null && !progress.isFinished && progress.projectedDelta !== null && (
        <p className={`mt-1 text-xs font-medium ${progress.projectedDelta > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          Al ritmo actual cerrarás en {formatMoney(progress.projected)} (
          {progress.projectedDelta > 0 ? '+' : ''}
          {formatMoney(progress.projectedDelta)})
        </p>
      )}
      {view.goal.ds_comments && <p className="mt-1 text-xs italic text-gray-400">{view.goal.ds_comments}</p>}
    </div>
  )
}

export default function ControlsPane({
  data,
  scopeUserId,
  months,
  idFamily,
}: {
  data: BudgetAnalyticsData
  scopeUserId: string | null
  months: string[]
  idFamily: string
}) {
  const [selected, setSelected] = useState<string>(TOTAL)
  const nowMonth = currentMonthKey()
  const views = useMemo(() => buildGoalViews(data, scopeUserId, nowMonth), [data, scopeUserId, nowMonth])

  const categories = useMemo(
    () =>
      data.categories
        .filter((category) => category.is_expense)
        .sort((a, b) => a.ds_category.localeCompare(b.ds_category)),
    [data.categories]
  )

  const { points, label } = useMemo((): { points: BudgetMonthPoint[]; label: string } => {
    if (selected === TOTAL) {
      const series = views.map((view) => goalMonthlySeries(data, view.goal, months))
      return {
        label: 'Todos los controles',
        points: months.map((month, i) => ({
          month,
          budget: series.reduce((sum, item) => sum + item[i].target, 0),
          // Solo el gasto dentro del periodo de cada control, para compararlo con su objetivo
          spent: series.reduce((sum, item) => sum + (item[i].inPeriod ? item[i].spent : 0), 0),
          hasBudget: series.some((item) => item[i].inPeriod),
        })),
      }
    }
    const [kind, id] = selected.split(':')
    if (kind === 'goal') {
      const view = views.find((item) => item.goal.id_spending_goal === id)
      if (!view) return { points: [], label: '' }
      return {
        label: view.label,
        points: goalMonthlySeries(data, view.goal, months).map((point) => ({
          month: point.month,
          budget: point.target,
          spent: point.spent,
          hasBudget: point.inPeriod,
        })),
      }
    }
    const isSub = kind === 'sub'
    const name = isSub
      ? data.subcategories.find((item) => item.id_subcategory === id)?.ds_subcategory
      : categories.find((item) => item.id_category === id)?.ds_category
    return {
      label: name || 'Vertical',
      points: verticalMonthlySeries(data, scopeUserId, months, { kind: isSub ? 'sub' : 'cat', id }),
    }
  }, [selected, views, data, months, scopeUserId, categories])

  const activeViews = views.filter((view) => !view.progress.isFinished)
  const finishedViews = views.filter((view) => view.progress.isFinished)

  return (
    <div className="space-y-6">
      <Card
        title="Objetivo vs gasto real"
        subtitle="Compara cada mes lo que te marcaste con lo que has gastado. También puedes mirar cualquier vertical o subvertical."
        action={
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:border-[#90EBD6] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]/40 sm:w-72"
          >
            <option value={TOTAL}>Todos los controles (agregado)</option>
            {views.length > 0 && (
              <optgroup label="Controles">
                {views.map((view) => (
                  <option key={view.goal.id_spending_goal} value={`goal:${view.goal.id_spending_goal}`}>
                    {view.label} {scopeUserId ? '' : `· ${view.userName}`}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Verticales">
              {categories.map((category) => (
                <option key={category.id_category} value={`cat:${category.id_category}`}>
                  {category.ds_category}
                </option>
              ))}
            </optgroup>
            <optgroup label="Subverticales">
              {data.subcategories
                .slice()
                .sort((a, b) => a.ds_subcategory.localeCompare(b.ds_subcategory))
                .map((sub) => (
                  <option key={sub.id_subcategory} value={`sub:${sub.id_subcategory}`}>
                    {sub.ds_subcategory}
                  </option>
                ))}
            </optgroup>
          </select>
        }
      >
        {views.length === 0 && selected === TOTAL ? (
          <EmptyState>
            Aún no tienes controles de gasto.{' '}
            <Link href={`/budgets/calculator?family=${idFamily}`} className="font-semibold text-[#0d9488] hover:underline">
              Créalos desde la calculadora
            </Link>{' '}
            o en Presupuestos.
          </EmptyState>
        ) : (
          <BudgetVsActual
            partidas={[
              {
                idBudgetType: 'control',
                name: label,
                periodicity: null,
                isUnassigned: false,
                points,
                totalBudget: points.reduce((sum, point) => sum + point.budget, 0),
                totalSpent: points.reduce((sum, point) => sum + point.spent, 0),
              },
            ]}
            months={months}
            colorFor={() => '#7C8DB5'}
            breakdown={false}
            budgetLabel="Objetivo"
            footnote={
              selected === TOTAL
                ? 'El agregado suma los objetivos de todos los controles; si dos controles se solapan (p. ej. una categoría y una de sus subcategorías) se cuentan los dos.'
                : selected.startsWith('goal:')
                  ? 'Los objetivos anuales se reparten a partes iguales entre los meses de su periodo.'
                  : `${label}: el objetivo solo aparece si tiene un control fijado en esos meses.`
            }
          />
        )}
      </Card>

      <Card title="Estado de los controles" subtitle="La marca vertical indica el ritmo que tocaría llevar a estas alturas del periodo.">
        {views.length === 0 ? (
          <p className="text-sm text-gray-500">Sin controles.</p>
        ) : (
          <div className="space-y-5">
            {activeViews.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeViews.map((view) => (
                  <ControlCard key={view.goal.id_spending_goal} view={view} />
                ))}
              </div>
            )}
            {finishedViews.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Cerrados</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {finishedViews.map((view) => (
                    <ControlCard key={view.goal.id_spending_goal} view={view} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
