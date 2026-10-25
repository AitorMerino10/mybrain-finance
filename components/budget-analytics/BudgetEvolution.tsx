'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { monthLabel, type BudgetDeadline } from '@/lib/budget-analytics'
import { currentMonthKey } from '@/lib/budget-calculator'
import { budgetMonthlyAmount, budgetPeriodMonths, type BudgetType, type CurrentUserBudget } from '@/lib/budgets'
import { dateToMonth } from '@/lib/goals'
import { Icon } from './visuals'

type Member = { id_user: string; ds_user?: string | null; ds_email?: string | null }

type Row = {
  month: string
  until: string | null
  amounts: Map<string, number | null>
  /** Partidas cuyo importe cubre todo el periodo: nº de meses */
  periods: Map<string, number>
  monthlyTotal: number
  /** Ninguna partida tiene presupuesto desde este mes (la fecha límite ya ha pasado) */
  empty: boolean
}

const money = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)

function buildRows(versions: CurrentUserBudget[], budgetTypes: BudgetType[]): Row[] {
  const active = versions.filter((version) => version.is_active !== false)
  // Cada inicio y cada fin (fecha límite) de una versión es un punto en el que cambia lo vigente
  const starts = Array.from(
    new Set(
      active.flatMap((version) => [
        dateToMonth(version.dt_start_month),
        ...(version.dt_end_month ? [dateToMonth(version.dt_end_month)] : []),
      ])
    )
  ).sort()

  const rows: Row[] = starts.map((month) => {
    const amounts = new Map<string, number | null>()
    const periods = new Map<string, number>()
    let monthlyTotal = 0
    for (const type of budgetTypes) {
      const candidates = active
        .filter((version) => version.id_budget_type === type.id_budget_type)
        .filter((version) => {
          const start = dateToMonth(version.dt_start_month)
          const end = version.dt_end_month ? dateToMonth(version.dt_end_month) : null
          return start <= month && (end === null || end > month)
        })
        .sort((a, b) => dateToMonth(b.dt_start_month).localeCompare(dateToMonth(a.dt_start_month)))
      const amount = candidates[0]?.ft_budget_amount ?? null
      amounts.set(type.id_budget_type, amount)
      if (candidates[0]) {
        monthlyTotal += budgetMonthlyAmount(candidates[0], type.ds_periodicity)
        const periodMonths = type.ds_periodicity === 'annual' ? budgetPeriodMonths(candidates[0]) : null
        if (periodMonths) periods.set(type.id_budget_type, periodMonths)
      }
    }
    return { month, until: null, amounts, periods, monthlyTotal, empty: Array.from(amounts.values()).every((amount) => amount === null) }
  })

  rows.forEach((row, index) => {
    row.until = rows[index + 1]?.month ?? null
  })
  // Las filas vacías del principio no aportan nada
  while (rows.length > 0 && rows[0].empty) rows.shift()
  return rows
}

function previousMonth(month: string): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function Delta({ value, unit }: { value: number; unit?: string }) {
  if (Math.abs(value) < 0.5) return null
  const up = value > 0
  return (
    <span className={`ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-medium ${up ? 'text-slate-500' : 'text-amber-700'}`}>
      <Icon name={up ? 'arrowUp' : 'arrowDown'} className="h-3 w-3" />
      {money(Math.abs(value))}
      {unit}
    </span>
  )
}

/** Histórico de presupuestos: una fila por cada fecha en la que cambió algo, con las cantidades vigentes desde entonces. */
export default function BudgetEvolution({
  versions,
  budgetTypes,
  members,
  scopeUserId = null,
  editHref,
  view = 'all',
  nowMonth = currentMonthKey(),
}: {
  versions: CurrentUserBudget[]
  budgetTypes: BudgetType[]
  members: Member[]
  scopeUserId?: string | null
  /** Si se indica, cada fila con presupuesto muestra un enlace "Editar" a esa dirección */
  editHref?: (idUser: string, month: string) => string
  /** all: todo el histórico · past: solo los presupuestos que ya dejaron de estar vigentes */
  view?: 'all' | 'past'
  nowMonth?: string
}) {
  const people = useMemo(() => {
    const ids = Array.from(new Set(versions.map((version) => version.id_user)))
    return ids
      .filter((id) => !scopeUserId || id === scopeUserId)
      .map((id) => {
        const member = members.find((item) => item.id_user === id)
        return {
          id,
          name: member?.ds_user || member?.ds_email || 'Persona',
          rows: buildRows(
            versions.filter((version) => version.id_user === id),
            budgetTypes
          ),
        }
      })
  }, [versions, budgetTypes, members, scopeUserId])

  if (people.length === 0 || people.every((person) => person.rows.length === 0)) {
    return <p className="text-sm text-slate-500">Todavía no hay histórico de presupuestos.</p>
  }

  return (
    <div className="space-y-6">
      {people.map((person) => {
        const ascending = person.rows
        const rows = [...ascending].reverse().filter((row) => view === 'all' || (row.until !== null && row.until <= nowMonth))
        if (rows.length === 0) {
          return (
            <div key={person.id}>
              <h4 className="mb-2 text-sm font-semibold text-slate-900">{person.name}</h4>
              <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                {view === 'past' ? 'Todavía no hay presupuestos pasados.' : 'Todavía no hay presupuestos.'}
              </p>
            </div>
          )
        }
        return (
          <div key={person.id}>
            <h4 className="mb-2 text-sm font-semibold text-slate-900">{person.name}</h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200/70">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Vigente</th>
                    {budgetTypes.map((type) => (
                      <th key={type.id_budget_type} className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                        {type.ds_budget_type}
                        <span className="ml-1 font-normal text-slate-400">{type.ds_periodicity === 'annual' ? '/año o periodo' : '/mes'}</span>
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500">Total/mes</th>
                    {editHref && <th className="px-3 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map((row) => {
                    const previous = ascending[ascending.indexOf(row) - 1]
                    const current = row.until === null && !row.empty
                    const endsHere = Boolean(row.until) && ascending[ascending.indexOf(row) + 1]?.empty
                    return (
                      <tr key={row.month} className={current ? 'bg-emerald-50/30' : undefined}>
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-800">
                          <span className="font-medium capitalize">{monthLabel(row.month, true)}</span>
                          {row.empty ? (
                            <span className="ml-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">Sin presupuesto</span>
                          ) : (
                            <span className="ml-1.5 text-xs text-slate-400">{row.until ? `→ ${monthLabel(row.until)}` : '→ actual'}</span>
                          )}
                          {endsHere && row.until && (
                            <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                              Fecha límite: {monthLabel(previousMonth(row.until), true)}
                            </span>
                          )}
                        </td>
                        {budgetTypes.map((type) => {
                          const amount = row.amounts.get(type.id_budget_type) ?? null
                          const before = previous?.amounts.get(type.id_budget_type) ?? null
                          return (
                            <td key={type.id_budget_type} className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-800">
                              {amount === null ? <span className="text-slate-300">—</span> : money(amount)}
                              {amount !== null && row.periods.get(type.id_budget_type) && (
                                <span className="ml-1 text-[10px] font-normal text-slate-400">en {row.periods.get(type.id_budget_type)} m</span>
                              )}
                              {previous && amount !== null && before !== null && <Delta value={amount - before} />}
                            </td>
                          )
                        })}
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                          {row.empty ? <span className="text-slate-300">—</span> : money(row.monthlyTotal)}
                          {previous && !row.empty && <Delta value={row.monthlyTotal - previous.monthlyTotal} />}
                        </td>
                        {editHref && (
                          <td className="whitespace-nowrap px-3 py-2.5 text-right">
                            {!row.empty && (
                              <Link href={editHref(person.id, row.month)} className="text-xs font-semibold text-[#0d9488] hover:underline">
                                Editar
                              </Link>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function monthNumber(month: string): number {
  const [year, m] = month.split('-').map(Number)
  return year * 12 + (m - 1)
}

/** Vigencia de los presupuestos de una persona: fecha límite si la hay, o si no tiene presupuesto vigente. */
export function personValidity(
  versions: CurrentUserBudget[],
  nowMonth: string
): { deadline: BudgetDeadline | null; hasCurrent: boolean } {
  const mine = versions.filter((version) => version.is_active !== false)
  const current = mine.filter((version) => {
    const start = dateToMonth(version.dt_start_month)
    const end = version.dt_end_month ? dateToMonth(version.dt_end_month) : null
    return start <= nowMonth && (end === null || end > nowMonth)
  })
  let deadline: BudgetDeadline | null = null
  if (current.length > 0 && current.every((version) => version.dt_end_month)) {
    const last = previousMonth(current.map((version) => dateToMonth(version.dt_end_month as string)).sort()[0])
    deadline = { lastMonth: last, monthsLeft: monthNumber(last) - monthNumber(nowMonth) + 1, expired: false }
  } else if (current.length === 0 && mine.length > 0) {
    const ends = mine
      .filter((version) => version.dt_end_month)
      .map((version) => dateToMonth(version.dt_end_month as string))
      .sort()
    const lastEnd = ends[ends.length - 1]
    if (lastEnd && lastEnd <= nowMonth) deadline = { lastMonth: previousMonth(lastEnd), monthsLeft: 0, expired: true }
  }
  return { deadline, hasCurrent: current.length > 0 }
}
