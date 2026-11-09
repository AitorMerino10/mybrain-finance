'use client'

import { useMemo, useState } from 'react'
import { formatMoney, groupKeyFor, shortMonthLabel, type PeriodRow, type SeriesStats } from '@/lib/budget-calculator'

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

/**
 * Explicación de las cifras de una partida: gráfica del gasto mes a mes (con su media y mediana) y,
 * al pinchar en un mes (o en "todos"), la tabla de los gastos que hay detrás.
 */
export default function PartidaExplanation({
  rows,
  months,
  stats,
}: {
  /** Gastos del histórico que pertenecen a la partida (según las relaciones elegidas) */
  rows: PeriodRow[]
  months: string[]
  stats: SeriesStats
}) {
  // null = nada abierto · 'all' = todos los meses · YYYY-MM = un mes
  const [detail, setDetail] = useState<string | null>(null)

  const series = useMemo(() => {
    const index = new Map(months.map((month, position) => [month, position]))
    const values = new Array(months.length).fill(0) as number[]
    for (const { tx, amount } of rows) {
      const position = index.get(tx.ds_month_declared)
      if (position !== undefined) values[position] += amount
    }
    return values
  }, [rows, months])

  const byMonth = useMemo(() => {
    const map = new Map<string, PeriodRow[]>()
    for (const row of rows) {
      const list = map.get(row.tx.ds_month_declared) ?? []
      list.push(row)
      map.set(row.tx.ds_month_declared, list)
    }
    map.forEach((list) => list.sort((a, b) => b.tx.dt_date.localeCompare(a.tx.dt_date)))
    return map
  }, [rows])

  const bySubcategory = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>()
    for (const { tx, amount } of rows) {
      const key = groupKeyFor(tx)
      const current = map.get(key) ?? {
        name: tx.id_subcategory ? `${tx.ds_category} › ${tx.ds_subcategory}` : tx.ds_category,
        total: 0,
        count: 0,
      }
      current.total += amount
      current.count += 1
      map.set(key, current)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [rows])

  const total = series.reduce((sum, value) => sum + value, 0)
  const maxValue = Math.max(1, ...series, stats.avg, stats.median)
  const top = maxValue * 1.08
  const labelStep = Math.max(1, Math.ceil(months.length / 12))

  const visibleMonths =
    detail === null
      ? []
      : detail === 'all'
        ? months.filter((month) => byMonth.has(month)).reverse()
        : byMonth.has(detail)
          ? [detail]
          : []

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">No hay gastos relacionados con esta partida en los meses analizados.</p>
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-gray-800">
            Gasto mes a mes <span className="font-normal text-gray-500">· pulsa un mes para ver sus gastos</span>
          </p>
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-4 bg-[#0d9488]" /> media {formatMoney(stats.avg)}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-amber-500" /> mediana {formatMoney(stats.median)}
            </span>
          </div>
        </div>

        <div className="relative h-44 rounded-xl bg-gray-50 px-2 pb-6 pt-3">
          <div className="relative flex h-full items-end gap-[3px]">
            {/* Líneas de media y mediana */}
            <div className="pointer-events-none absolute inset-x-0 border-t border-[#0d9488]" style={{ bottom: `${(stats.avg / top) * 100}%` }} />
            <div
              className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-amber-500"
              style={{ bottom: `${(stats.median / top) * 100}%` }}
            />
            {months.map((month, position) => {
              const value = series[position]
              const selected = detail === month
              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => setDetail(selected ? null : month)}
                  title={`${shortMonthLabel(month)}: ${formatMoney(value, 2)}`}
                  className="group relative flex h-full min-w-[6px] flex-1 flex-col justify-end"
                >
                  <span
                    className={`block w-full rounded-t transition ${
                      selected ? 'bg-[#0d9488]' : value > 0 ? 'bg-[#90EBD6] group-hover:bg-[#5eead4]' : 'bg-gray-200'
                    }`}
                    style={{ height: `${Math.max(value > 0 ? 2 : 1, (value / top) * 100)}%` }}
                  />
                  {position % labelStep === 0 && (
                    <span className="pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-gray-400">
                      {shortMonthLabel(month)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Total en {months.length} meses: <strong>{formatMoney(total)}</strong> · meses con gasto: {stats.monthsWithSpend} de {months.length} · mes más
          alto: {formatMoney(stats.max)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDetail(detail === 'all' ? null : 'all')}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            detail === 'all' ? 'border-[#0d9488] bg-[#90EBD6]/30 text-teal-900' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {detail === 'all' ? 'Ocultar el detalle' : 'Ver el detalle de todos los meses'}
        </button>
        {detail && detail !== 'all' && (
          <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700">
            Mostrando {shortMonthLabel(detail)} ·{' '}
            <button type="button" onClick={() => setDetail(null)} className="text-[#0d9488] hover:underline">
              cerrar
            </button>
          </span>
        )}
      </div>

      {detail !== null &&
        (visibleMonths.length === 0 ? (
          <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">No hubo gastos de esta partida en {detail === 'all' ? 'estos meses' : shortMonthLabel(detail)}.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-3 py-2">Vertical › subvertical</th>
                  <th className="px-3 py-2">Comentario</th>
                  <th className="px-3 py-2">Tag</th>
                  <th className="px-4 py-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody className="text-gray-800">
                {visibleMonths.map((month) => {
                  const list = byMonth.get(month) ?? []
                  const monthTotal = list.reduce((sum, row) => sum + row.amount, 0)
                  return (
                    <MonthRows key={month} month={month} list={list} monthTotal={monthTotal} showHeader={detail === 'all'} />
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}

      <div>
        <p className="mb-2 text-sm font-medium text-gray-800">De qué está hecha esta partida</p>
        <div className="overflow-x-auto rounded-2xl border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Vertical › subvertical</th>
                <th className="px-3 py-2 text-right">Gastos</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Media/mes</th>
                <th className="px-4 py-2 text-right">% de la partida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-800">
              {bySubcategory.map((item) => (
                <tr key={item.name}>
                  <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{item.count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(item.total)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(item.total / months.length)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-500">{total > 0 ? Math.round((item.total / total) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MonthRows({
  month,
  list,
  monthTotal,
  showHeader,
}: {
  month: string
  list: PeriodRow[]
  monthTotal: number
  showHeader: boolean
}) {
  return (
    <>
      {showHeader && (
        <tr className="bg-gray-50/80">
          <td colSpan={4} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
            {shortMonthLabel(month)} · {list.length} gasto{list.length === 1 ? '' : 's'}
          </td>
          <td className="px-4 py-1.5 text-right text-xs font-semibold tabular-nums text-gray-700">{formatMoney(monthTotal, 2)}</td>
        </tr>
      )}
      {list.map(({ tx, amount }) => (
        <tr key={tx.id_transaction} className="border-t border-gray-50">
          <td className="whitespace-nowrap px-4 py-1.5 text-gray-600">{formatDate(tx.dt_date)}</td>
          <td className="px-3 py-1.5">
            {tx.ds_category}
            {tx.id_subcategory && <span className="text-gray-500"> › {tx.ds_subcategory}</span>}
          </td>
          <td className="max-w-xs truncate px-3 py-1.5 text-gray-600" title={tx.ds_comments ?? undefined}>
            {tx.ds_comments || <span className="text-gray-300">—</span>}
          </td>
          <td className="px-3 py-1.5 text-gray-600">{tx.ds_tag || <span className="text-gray-300">—</span>}</td>
          <td className="whitespace-nowrap px-4 py-1.5 text-right font-medium tabular-nums">{formatMoney(amount, 2)}</td>
        </tr>
      ))}
      {!showHeader && (
        <tr className="border-t border-gray-100 bg-gray-50/80">
          <td colSpan={4} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
            Total de {shortMonthLabel(month)}
          </td>
          <td className="px-4 py-1.5 text-right text-sm font-semibold tabular-nums text-gray-900">{formatMoney(monthTotal, 2)}</td>
        </tr>
      )}
    </>
  )
}
