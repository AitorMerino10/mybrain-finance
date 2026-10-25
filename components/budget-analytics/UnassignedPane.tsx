'use client'

import { useMemo, useState } from 'react'
import { balanceFromAnalytics, buildUnassignedRows } from '@/lib/budget-balance'
import { monthLabel, type BudgetAnalyticsData } from '@/lib/budget-analytics'
import { addMonths, currentMonthKey, formatMoney } from '@/lib/budget-calculator'
import { Card, Segmented } from './common'
import { useBalanceExtras } from './useBalanceExtras'
import { EditTransactionButton } from './TransactionEditProvider'

type Filter = 'all' | 'Expense' | 'Income'
type Range = 'budget' | 'selected'

const th = 'whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500'

export default function UnassignedPane({
  data,
  idFamily,
  scopeUserId,
  months,
}: {
  data: BudgetAnalyticsData
  idFamily: string
  scopeUserId: string | null
  months: string[]
}) {
  const { extras, loaded } = useBalanceExtras(idFamily)
  const [filter, setFilter] = useState<Filter>('all')
  const [range, setRange] = useState<Range>('budget')
  const nowMonth = currentMonthKey()

  // Saldo del presupuesto vigente de la persona (con la familia entera no hay un único presupuesto)
  const balance = useMemo(
    () => (scopeUserId && loaded ? balanceFromAnalytics(data, extras, scopeUserId, nowMonth) : null),
    [data, extras, scopeUserId, loaded, nowMonth]
  )
  const budgetMonths = useMemo(() => {
    if (!balance?.cycleStart) return null
    const list: string[] = []
    for (let cursor = balance.cycleStart; cursor <= nowMonth; cursor = addMonths(cursor, 1)) list.push(cursor)
    return list
  }, [balance, nowMonth])
  const shownMonths = range === 'budget' && budgetMonths ? budgetMonths : months

  const all = useMemo(() => buildUnassignedRows(data, extras, scopeUserId, shownMonths), [data, extras, scopeUserId, shownMonths])
  const rows = filter === 'all' ? all : all.filter((row) => row.type === filter)
  const expenseTotal = all.filter((row) => row.type === 'Expense').reduce((sum, row) => sum + row.amount, 0)
  const incomeTotal = all.filter((row) => row.type === 'Income').reduce((sum, row) => sum + row.amount, 0)
  const nameOf = (idUser: string) => {
    const member = data.members.find((item) => item.id_user === idUser)
    return member?.ds_user || member?.ds_email || '—'
  }

  return (
    <Card
      title="Sin asignar"
      subtitle="Gastos sin partida e ingresos sin reparto ni presupuesto vigente ese mes."
      action={
        <div className="flex flex-wrap items-center gap-2">
          {balance && (
            <Segmented
              size="sm"
              value={range}
              onChange={setRange}
              options={[
                { value: 'budget', label: 'Presupuesto vigente' },
                { value: 'selected', label: 'Meses elegidos' },
              ]}
            />
          )}
          <Segmented
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: `Todo (${all.length})` },
              { value: 'Expense', label: 'Gastos' },
              { value: 'Income', label: 'Ingresos' },
            ]}
          />
        </div>
      }
    >
      {!loaded ? (
        <div className="h-24 animate-pulse rounded-xl bg-gray-50" />
      ) : (
        <>
          {balance && balance.cycleStart && (
            <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50/60 p-4 text-sm">
              <p className="mb-2 font-semibold text-gray-800">
                Cómo se compone el ahorro ({monthLabel(balance.cycleStart)} – {monthLabel(nowMonth)})
              </p>
              <dl className="space-y-1 text-gray-600">
                {[
                  { label: 'Ingreso que no se llevó a ninguna partida', value: balance.unallocatedIncome },
                  { label: 'Sobrante de partidas (aportado y no gastado)', value: balance.surplus },
                  { label: 'Gastado por encima de lo aportado a una partida', value: -balance.overspent },
                  { label: 'Gastos sin partida', value: -balance.unassignedSpent },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between gap-4">
                    <dt>{item.label}</dt>
                    <dd className="tabular-nums">
                      {item.value > 0 ? '+' : item.value < 0 ? '−' : ''}
                      {formatMoney(Math.abs(item.value))}
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 border-t border-gray-200 pt-1 font-semibold text-gray-900">
                  <dt>= Ahorrado (ingresado {formatMoney(balance.incomeTotal)} − gastado {formatMoney(balance.spentTotal)})</dt>
                  <dd className="tabular-nums">{formatMoney(balance.realSavings)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-gray-400">
                Es dinero ingresado que no se ha llevado a ninguna partida (por tanto, ahorro), no movimientos sin asignar: por eso no aparece en la tabla.
              </p>
            </div>
          )}
          <div className="mb-4 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-red-50 px-3 py-1 font-semibold text-red-700">Gastos sin partida: {formatMoney(expenseTotal)}</span>
            <span className="rounded-full bg-sky-50 px-3 py-1 font-semibold text-sky-700">Ingresos sin reparto: {formatMoney(incomeTotal)}</span>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-500">No hay movimientos sin asignar en este periodo. 🎉</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`${th} text-left`}>Fecha</th>
                    <th className={`${th} text-left`}>Mes</th>
                    <th className={`${th} text-left`}>Tipo</th>
                    {!scopeUserId && <th className={`${th} text-left`}>Persona</th>}
                    <th className={`${th} text-left`}>Categoría</th>
                    <th className={`${th} text-left`}>Tag</th>
                    <th className={`${th} text-left`}>Comentario</th>
                    <th className={`${th} text-left`}>Motivo</th>
                    <th className={`${th} text-right`}>Importe</th>
                    <th className={th} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((row) => (
                    <tr key={row.tx.id_transaction}>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">{row.tx.dt_date}</td>
                      <td className="whitespace-nowrap px-3 py-2 capitalize text-gray-600">{monthLabel(row.tx.ds_month_declared)}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            row.type === 'Expense' ? 'bg-red-50 text-red-700' : 'bg-sky-50 text-sky-700'
                          }`}
                        >
                          {row.type === 'Expense' ? 'Gasto' : 'Ingreso'}
                        </span>
                      </td>
                      {!scopeUserId && (
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                          {row.tx.users.map((user) => nameOf(user.id_user)).join(', ') || '—'}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3 py-2 text-gray-900">
                        {row.tx.ds_category}
                        {row.tx.ds_subcategory && <span className="text-gray-400"> · {row.tx.ds_subcategory}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {row.tx.ds_tag?.trim() ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{row.tx.ds_tag.trim()}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="max-w-[16rem] truncate px-3 py-2 text-gray-600" title={row.tx.ds_comments || undefined}>
                        {row.tx.ds_comments || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{row.reason}</td>
                      <td className={`whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums ${row.type === 'Expense' ? 'text-red-600' : 'text-sky-700'}`}>
                        {row.type === 'Expense' ? '−' : '+'}
                        {formatMoney(row.amount)}
                      </td>
                      <td className="px-2 py-1">
                        <EditTransactionButton id={row.tx.id_transaction} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-gray-400">
            Pulsa el lápiz para asignar un gasto a su partida o repartir un ingreso. También puedes definir una partida por defecto para una subcategoría en Presupuestos.
          </p>
        </>
      )}
    </Card>
  )
}
