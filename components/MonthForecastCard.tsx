'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { buildMonthForecast, type PendingRecurring } from '@/lib/budget-forecast'
import { monthLabel, type BudgetAnalyticsData, type Status } from '@/lib/budget-analytics'
import { formatMoney } from '@/lib/budget-calculator'
import type { RecurringExpense } from '@/lib/recurring'
import { Card, StatusBadge } from './budget-analytics/common'

const BAR: Record<Status, string> = { ok: 'bg-[#2FB394]', warning: 'bg-[#EBA23F]', over: 'bg-[#E5636B]' }
const BAR_SOFT: Record<Status, string> = { ok: 'bg-[#2FB394]/25', warning: 'bg-[#EBA23F]/30', over: 'bg-[#E5636B]/25' }

function shortDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Previsión de cierre del mes: lo gastado + cobros recurrentes que faltan + ritmo del gasto variable. */
export default function MonthForecastCard({
  idFamily,
  idUser,
  data,
  rules,
  pending,
}: {
  idFamily: string
  idUser: string
  data: BudgetAnalyticsData
  rules: RecurringExpense[]
  pending: PendingRecurring[]
}) {
  const forecast = useMemo(() => buildMonthForecast(data, idUser, rules, pending), [data, idUser, rules, pending])
  if (forecast.budget <= 0) return null

  const monthName = monthLabel(forecast.month, true).toLowerCase()
  const margin = forecast.budget - forecast.projected
  const scale = Math.max(forecast.budget, forecast.projected, 1)
  const spentWidth = Math.min(100, (forecast.spent / scale) * 100)
  const projectedWidth = Math.min(100, (forecast.projected / scale) * 100)
  const budgetMarker = Math.min(100, (forecast.budget / scale) * 100)
  const risky = forecast.rows.filter((row) => row.status !== 'ok').slice(0, 4)
  const upcoming = forecast.upcoming.slice(0, 5)

  const headline =
    forecast.status === 'over'
      ? `Te pasarías unos ${formatMoney(-margin)}`
      : forecast.status === 'warning'
        ? 'Vas a llegar justo'
        : `Te sobrarían unos ${formatMoney(margin)}`

  return (
    <Card
      icon="clock"
      title="Previsión de fin de mes"
      subtitle={`Cómo cerrarías ${monthName} si sigues a este ritmo. Cuenta los gastos recurrentes que faltan y el ritmo de tu gasto del día a día.`}
      action={
        <Link
          href={`/settings?family=${idFamily}&section=recurrentes`}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          Gastos recurrentes →
        </Link>
      }
    >
      {!forecast.hasEnoughData ? (
        <p className="text-sm text-slate-500">Aún es pronto para hacer una previsión: se activa a partir del día 3 del mes.</p>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-inset ring-slate-200/60 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Cierre previsto</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-slate-900">
                  ≈ {formatMoney(forecast.projected)}
                  <span className="ml-2 text-base font-normal text-slate-400">de {formatMoney(forecast.budget)}</span>
                </p>
                <p className={`mt-1 text-sm font-medium ${forecast.status === 'over' ? 'text-rose-600' : forecast.status === 'warning' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {headline}
                </p>
              </div>
              <StatusBadge
                status={forecast.status}
                label={forecast.status === 'over' ? 'Te pasarías' : forecast.status === 'warning' ? 'Justo' : 'En ritmo'}
              />
            </div>

            <div className="relative mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-200/70" title="Gastado hasta hoy y previsión hasta fin de mes">
              <div className={`absolute inset-y-0 left-0 rounded-full ${BAR_SOFT[forecast.status]}`} style={{ width: `${projectedWidth}%` }} />
              <div className={`absolute inset-y-0 left-0 rounded-full ${BAR[forecast.status]}`} style={{ width: `${spentWidth}%` }} />
              <div className="absolute inset-y-0 w-0.5 bg-slate-600/70" style={{ left: `${budgetMarker}%` }} title="Presupuesto" />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
              <span>Gastado {formatMoney(forecast.spent)}</span>
              <span>Presupuesto {formatMoney(forecast.budget)}</span>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50/70 p-3 ring-1 ring-inset ring-slate-100">
              <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Quedan</dt>
              <dd className="mt-1 text-base font-semibold tabular-nums text-slate-900">
                {forecast.daysLeft} {forecast.daysLeft === 1 ? 'día' : 'días'}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50/70 p-3 ring-1 ring-inset ring-slate-100">
              <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Recurrentes que faltan</dt>
              <dd className="mt-1 text-base font-semibold tabular-nums text-slate-900">{formatMoney(forecast.upcomingFixed)}</dd>
            </div>
            <div className="rounded-xl bg-slate-50/70 p-3 ring-1 ring-inset ring-slate-100">
              <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Para no pasarte</dt>
              <dd className="mt-1 text-base font-semibold tabular-nums text-slate-900">
                {forecast.dailyAllowance !== null ? `${formatMoney(forecast.dailyAllowance, 0)} al día` : 'Sin margen'}
              </dd>
            </div>
          </dl>

          <div>
            <p className="mb-2 text-xs font-semibold text-slate-700">{risky.length > 0 ? 'Partidas que se pasarían' : 'Partidas'}</p>
            {risky.length === 0 ? (
              <p className="text-sm text-slate-500">Todas las partidas mensuales cerrarían dentro de su presupuesto. 👌</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {risky.map((row) => (
                  <li key={row.idBudgetType} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{row.name}</p>
                      <p className="text-xs text-slate-500">
                        Llevas {formatMoney(row.spent)} · cerraría en ≈ {formatMoney(row.projected)} de {formatMoney(row.budget)}
                      </p>
                    </div>
                    <StatusBadge status={row.status} label={row.status === 'over' ? `+${formatMoney(row.projected - row.budget)}` : 'Justo'} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className={forecast.hasEnoughData ? 'mt-5' : 'mt-4'}>
          <p className="mb-2 text-xs font-semibold text-slate-700">Próximos gastos recurrentes</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {upcoming.map((item, index) => (
              <li key={`${item.rule.id_recurring_expense}-${item.date}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{item.rule.ds_name}</p>
                  <p className="text-xs capitalize text-slate-500">{shortDate(item.date)}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatMoney(item.amount, 2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
