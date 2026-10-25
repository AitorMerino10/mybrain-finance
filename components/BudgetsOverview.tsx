'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { FamilyMember } from '@/lib/family'
import {
  budgetMonthlyAmount,
  budgetPeriodMonths,
  budgetTypeAppliesTo,
  type BudgetSubtype,
  type BudgetType,
  type CurrentUserBudget,
} from '@/lib/budgets'
import { monthLabel } from '@/lib/budget-analytics'
import { addMonths } from '@/lib/budget-calculator'
import type { UserBalance } from '@/lib/budget-balance'
import { planIncomeMonthly, planInForce, planMonthsOf, type BudgetPlan } from '@/lib/budget-plans'
import BudgetEvolution, { personValidity } from './budget-analytics/BudgetEvolution'
import { DeadlineStrip, Icon } from './budget-analytics/visuals'

const money = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const initialOf = (name: string) => (name.trim()[0] || '?').toUpperCase()

/** Importe de una partida que se puede cambiar ahí mismo, sin pasar por la calculadora. */
function EditableAmount({
  amount,
  unit,
  hasValue,
  onSave,
}: {
  amount: number
  unit: string
  hasValue: boolean
  onSave: (amount: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = () => {
    setValue(hasValue ? String(amount) : '')
    setError(null)
    setEditing(true)
  }
  const submit = async () => {
    const parsed = Number(value.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Importe no válido')
      return
    }
    try {
      setSaving(true)
      setError(null)
      await onSave(parsed)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={open}
        title="Cambiar el importe de esta partida"
        className="group whitespace-nowrap rounded-lg px-1.5 py-0.5 text-sm font-semibold tabular-nums text-gray-900 hover:bg-teal-50"
      >
        {hasValue ? money(amount) : <span className="font-normal text-gray-300 group-hover:text-teal-700">+ importe</span>}
        {hasValue && <span className="ml-1 text-[11px] font-normal text-gray-400">{unit}</span>}
        <span className="ml-1 text-[11px] text-transparent group-hover:text-teal-700">✎</span>
      </button>
    )
  }
  return (
    <span className="flex flex-col items-end gap-0.5">
      <span className="flex items-center gap-1">
        <input
          autoFocus
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
            if (event.key === 'Escape') setEditing(false)
          }}
          className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm tabular-nums focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]"
        />
        <span className="text-[11px] text-gray-400">{unit}</span>
        <button type="button" disabled={saving} onClick={submit} className="rounded-lg bg-[#0d9488] px-2 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
          {saving ? '…' : 'OK'}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="px-1 text-xs text-gray-400 hover:text-gray-700">
          ✕
        </button>
      </span>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  )
}

/**
 * Presupuestos de la familia: una tarjeta por persona con su presupuesto vigente (todas las partidas, también las vacías),
 * el ahorro estimado al mes y en el periodo, y accesos para editarlo o crear el siguiente. Con otro botón, los pasados.
 */
export default function BudgetsOverview({
  idFamily,
  idUser,
  versions,
  budgetTypes,
  subtypes,
  plans,
  members,
  balanceOf,
  closeInfo,
  onClosePeriod,
  onUndoClose,
  onEditAmount,
}: {
  idFamily: string
  /** Persona que está viendo la pantalla: se muestra su presupuesto por defecto */
  idUser?: string
  versions: CurrentUserBudget[]
  budgetTypes: BudgetType[]
  subtypes: BudgetSubtype[]
  plans: BudgetPlan[]
  members: FamilyMember[]
  /** Saldos de la persona (ahorro real del periodo) o null si aún se están calculando */
  balanceOf?: (idUser: string) => UserBalance | null
  /** Si se puede cerrar el presupuesto (el periodo ya terminó) y, si no, cuándo */
  closeInfo?: (idUser: string) => { closable: boolean; hint: string; lastClose: string | null }
  onClosePeriod?: (idUser: string) => void
  onUndoClose?: (idUser: string) => void
  /** Cambia el importe de una partida del presupuesto vigente (`startMonth`: inicio de la versión que se edita, YYYY-MM-DD) */
  onEditAmount?: (params: { idUser: string; idBudgetType: string; amount: number; startMonth: string }) => Promise<void>
}) {
  const nowMonth = currentMonth()
  const [userFilter, setUserFilter] = useState(idUser && members.some((member) => member.id_user === idUser) ? idUser : 'all')
  const [view, setView] = useState<'current' | 'past'>('current')

  const people = useMemo(
    () => members.filter((member) => userFilter === 'all' || member.id_user === userFilter),
    [members, userFilter]
  )

  const calculatorHref = (idUser: string, params: { edit?: boolean; month?: string; start?: string } = {}) =>
    `/budgets/calculator?family=${idFamily}&user=${idUser}${params.edit ? '&edit=1' : ''}${
      params.month ? `&month=${params.month}` : ''
    }${params.start ? `&start=${params.start}` : ''}`

  const cards = people.map((member) => {
    const mine = versions.filter((version) => version.id_user === member.id_user && version.is_active)
    const activeNow = mine
      .filter(
        (version) =>
          version.dt_start_month.slice(0, 7) <= nowMonth &&
          (!version.dt_end_month || version.dt_end_month.slice(0, 7) > nowMonth)
      )
      .sort((a, b) => a.dt_start_month.localeCompare(b.dt_start_month))
    const byType = new Map<string, CurrentUserBudget>()
    for (const version of activeNow) byType.set(version.id_budget_type, version)

    const monthlyTotal = Array.from(byType.values()).reduce((sum, version) => {
      const type = budgetTypes.find((item) => item.id_budget_type === version.id_budget_type)
      return sum + budgetMonthlyAmount(version, type?.ds_periodicity)
    }, 0)

    const since = Array.from(byType.values())
      .map((version) => version.dt_start_month.slice(0, 7))
      .sort()
      .reverse()[0]

    // Foto de lo configurado: da el ahorro estimado y el desglose por subpartidas
    const plan = byType.size > 0 ? planInForce(plans, member.id_user, since || nowMonth) : null
    const incomeMonthly = plan ? planIncomeMonthly(plan.plan) : null
    const planMonths = plan ? planMonthsOf(plan.plan) : null
    const savingsMonthly = incomeMonthly !== null && incomeMonthly > 0 ? incomeMonthly - monthlyTotal : null

    // Próximo presupuesto ya guardado (empieza en el futuro)
    const upcomingStart =
      mine
        .map((version) => version.dt_start_month.slice(0, 7))
        .filter((month) => month > nowMonth)
        .sort()[0] || null

    // El nuevo presupuesto empieza donde acaba el último con fecha de fin (o el mes siguiente si el actual no termina)
    const lastEnd = mine
      .map((version) => version.dt_end_month?.slice(0, 7) ?? null)
      .filter((month): month is string => month !== null && month > nowMonth)
      .sort()
      .reverse()[0]
    const newStart = lastEnd ?? addMonths(nowMonth, 1)

    return {
      member,
      byType,
      monthlyTotal,
      since: since || null,
      plan,
      incomeMonthly,
      planMonths,
      savingsMonthly,
      upcomingStart,
      newStart,
      validity: personValidity(mine, nowMonth),
    }
  })

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-gray-900">Presupuestos</h3>
          <p className="text-sm text-gray-500">
            {view === 'current'
              ? 'El presupuesto vigente de cada persona y lo que se estima ahorrar.'
              : 'Presupuestos que ya dejaron de estar vigentes. Puedes abrir cualquiera para editarlo.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-gray-100 p-1 text-sm font-medium">
            {(
              [
                ['current', 'Actual'],
                ['past', 'Pasados'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                className={`rounded-lg px-3 py-1.5 transition ${
                  view === value ? 'bg-white text-[#0d9488] shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label>
            <span className="sr-only">Persona</span>
            <select
              value={userFilter}
              onChange={(event) => setUserFilter(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]"
            >
              {members.map((member) => (
                <option key={member.id_user} value={member.id_user}>
                  {member.ds_user || member.ds_email}
                  {member.id_user === idUser ? ' (tú)' : ''}
                </option>
              ))}
              <option value="all">Toda la familia</option>
            </select>
          </label>
        </div>
      </div>

      {view === 'current' ? (
        <div className={`grid gap-4 ${cards.length > 1 ? 'xl:grid-cols-2' : ''}`}>
          {cards.map((card) => {
            const name = card.member.ds_user || card.member.ds_email || 'Sin nombre'
            const hasBudget = card.byType.size > 0
            return (
              <article key={card.member.id_user} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
                {/* Cabecera */}
                <header className="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white px-5 py-3.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#90EBD6]/40 text-base font-bold text-[#0d9488]">
                    {initialOf(name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{name}</p>
                    <p className="text-xs text-gray-500">
                      {card.since ? `Vigente desde ${monthLabel(card.since, true)}` : 'Sin presupuesto vigente'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasBudget ? (
                      <>
                        <Link
                          href={calculatorHref(card.member.id_user, { edit: true, month: nowMonth })}
                          className="rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Editar
                        </Link>
                        <Link
                          href={calculatorHref(card.member.id_user, { edit: true, month: nowMonth, start: card.newStart })}
                          title={`Empieza en ${monthLabel(card.newStart, true)}, donde termina el actual, partiendo de sus valores`}
                          className="rounded-xl bg-[#0d9488] px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
                        >
                          + Nuevo
                        </Link>
                      </>
                    ) : (
                      <Link
                        href={calculatorHref(card.member.id_user)}
                        className="rounded-xl bg-[#0d9488] px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
                      >
                        Crear presupuesto
                      </Link>
                    )}
                  </div>
                </header>

                <div className="grid gap-0 md:grid-cols-[1fr_15rem]">
                  {/* Partidas */}
                  <ul className="divide-y divide-gray-50 px-5 py-2">
                    {budgetTypes
                      .filter((type) => budgetTypeAppliesTo(type, card.member.id_user) || card.byType.has(type.id_budget_type))
                      .map((type) => {
                      const version = card.byType.get(type.id_budget_type)
                      const periodMonths = version && type.ds_periodicity === 'annual' ? budgetPeriodMonths(version) : null
                      const monthly = version ? budgetMonthlyAmount(version, type.ds_periodicity) : 0
                      const share = card.monthlyTotal > 0 ? (monthly / card.monthlyTotal) * 100 : 0
                      const subs = card.plan
                        ? subtypes
                            .filter((sub) => sub.id_budget_type === type.id_budget_type && !sub.is_archived)
                            .map((sub) => ({ sub, amount: Number(card.plan?.plan.subAmounts?.[sub.id_budget_subtype] ?? 0) }))
                            .filter((item) => item.amount > 0)
                        : []
                      return (
                        <li key={type.id_budget_type} className="py-2">
                          <div className="flex items-baseline gap-3">
                            <span className={`min-w-0 flex-1 truncate text-sm ${version ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                              {type.ds_budget_type}
                            </span>
                            {onEditAmount && hasBudget && card.since ? (
                              <EditableAmount
                                amount={version?.ft_budget_amount ?? 0}
                                hasValue={Boolean(version)}
                                unit={type.ds_periodicity === 'monthly' ? '/mes' : periodMonths ? `en ${periodMonths} m` : '/año'}
                                onSave={(amount) =>
                                  onEditAmount({
                                    idUser: card.member.id_user,
                                    idBudgetType: type.id_budget_type,
                                    amount,
                                    startMonth: version ? version.dt_start_month : `${card.since}-01`,
                                  })
                                }
                              />
                            ) : (
                              <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-gray-900">
                                {version ? money(version.ft_budget_amount) : <span className="font-normal text-gray-300">—</span>}
                                <span className="ml-1 text-[11px] font-normal text-gray-400">
                                  {type.ds_periodicity === 'monthly' ? '/mes' : periodMonths ? `en ${periodMonths} m` : '/año'}
                                </span>
                              </span>
                            )}
                            <span className="w-20 whitespace-nowrap text-right text-xs tabular-nums text-gray-500">
                              {version && type.ds_periodicity !== 'monthly' ? `${money(monthly)}/mes` : ''}
                            </span>
                          </div>
                          {version && (
                            <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100">
                              <div className="h-full rounded-full bg-[#0d9488]/70" style={{ width: `${Math.min(100, share)}%` }} />
                            </div>
                          )}
                          {subs.length > 0 && (
                            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                              {subs.map((item) => (
                                <span key={item.sub.id_budget_subtype}>
                                  ↳ {item.sub.ds_budget_subtype}{' '}
                                  <span className="font-medium tabular-nums text-gray-700">{money(item.amount)}</span>
                                </span>
                              ))}
                            </p>
                          )}
                        </li>
                      )
                    })}
                    {budgetTypes.length === 0 && <li className="py-4 text-sm text-gray-500">Aún no hay partidas.</li>}
                  </ul>

                  {/* Resumen */}
                  <aside className="space-y-3 border-t border-gray-100 bg-gray-50/60 px-5 py-4 md:border-l md:border-t-0">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Gasto estimado</p>
                      <p className="text-lg font-bold tabular-nums text-gray-900">
                        {hasBudget ? money(card.monthlyTotal) : '—'}
                        <span className="text-xs font-normal text-gray-400"> /mes</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Ahorro estimado</p>
                      {card.savingsMonthly !== null && card.planMonths ? (
                        <>
                          <p
                            className={`text-lg font-bold tabular-nums ${card.savingsMonthly >= 0 ? 'text-teal-700' : 'text-red-600'}`}
                          >
                            {money(card.savingsMonthly)}
                            <span className="text-xs font-normal text-gray-400"> /mes</span>
                          </p>
                          <p className={`text-sm font-semibold tabular-nums ${card.savingsMonthly >= 0 ? 'text-teal-700' : 'text-red-600'}`}>
                            {money(card.savingsMonthly * card.planMonths)}
                            <span className="text-xs font-normal text-gray-400"> en {card.planMonths} meses</span>
                          </p>
                        </>
                      ) : (
                        <p className="text-xs leading-snug text-gray-400">
                          {hasBudget
                            ? 'Se calcula con los ingresos que guardas en la calculadora. Edita y guarda este presupuesto para verlo.'
                            : '—'}
                        </p>
                      )}
                    </div>
                    {(() => {
                      const balance = balanceOf?.(card.member.id_user)
                      if (!balance || !hasBudget) return null
                      const close = closeInfo?.(card.member.id_user)
                      return (
                        <div className="space-y-1.5 border-t border-gray-200 pt-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Ahorro real del periodo</p>
                          <p className={`text-lg font-bold tabular-nums ${balance.realSavings >= 0 ? 'text-teal-700' : 'text-red-600'}`}>
                            {money(balance.realSavings)}
                          </p>
                          <dl className="space-y-0.5 text-xs text-gray-500">
                            <div className="flex justify-between gap-2">
                              <dt>Ingresado</dt>
                              <dd className="font-medium tabular-nums text-gray-700">{money(balance.incomeTotal)}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt>Gastado</dt>
                              <dd className="font-medium tabular-nums text-gray-700">−{money(balance.spentTotal)}</dd>
                            </div>
                            <div className="flex justify-between gap-2 text-[11px] text-gray-400">
                              <dt>· Sobrante de partidas</dt>
                              <dd className="tabular-nums">+{money(balance.surplus)}</dd>
                            </div>
                            <div className="flex justify-between gap-2 text-[11px] text-gray-400">
                              <dt>· Sobregasto y gasto sin partida</dt>
                              <dd className="tabular-nums">−{money(balance.overspent + balance.unassignedSpent)}</dd>
                            </div>
                            <div className="flex justify-between gap-2 text-[11px] text-gray-400">
                              <dt>· Ingreso sin llevar a partidas</dt>
                              <dd className="tabular-nums">+{money(balance.unallocatedIncome)}</dd>
                            </div>
                            {balance.previousSavings !== 0 && (
                              <div className="flex justify-between gap-2">
                                <dt>Ahorro de periodos cerrados</dt>
                                <dd className="font-medium tabular-nums text-gray-700">{money(balance.previousSavings)}</dd>
                              </div>
                            )}
                          </dl>
                          {close && (
                            <>
                              <button
                                type="button"
                                disabled={!close.closable}
                                onClick={() => onClosePeriod?.(card.member.id_user)}
                                title={close.closable ? undefined : close.hint}
                                className="mt-1 w-full rounded-lg bg-[#0d9488] px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                              >
                                Cerrar presupuesto
                              </button>
                              {!close.closable && <p className="text-[11px] leading-snug text-gray-400">{close.hint}</p>}
                              {close.lastClose && (
                                <button type="button" onClick={() => onUndoClose?.(card.member.id_user)} className="text-[11px] text-gray-400 hover:text-gray-600 hover:underline">
                                  Deshacer último cierre ({monthLabel(close.lastClose)})
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })()}
                    <div className="overflow-hidden rounded-lg">
                      {card.validity.deadline ? (
                        <DeadlineStrip deadline={card.validity.deadline} className="rounded-lg border" />
                      ) : (
                        <div className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-gray-200">
                          <Icon name="clock" className="h-3.5 w-3.5" />
                          {card.validity.hasCurrent ? 'Sin fecha límite' : 'Sin presupuesto vigente'}
                        </div>
                      )}
                    </div>
                    {card.upcomingStart && (
                      <Link
                        href={calculatorHref(card.member.id_user, { edit: true, month: card.upcomingStart })}
                        className="block rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-100 hover:bg-indigo-100"
                      >
                        Próximo desde {monthLabel(card.upcomingStart, true)} · Editar
                      </Link>
                    )}
                  </aside>
                </div>
              </article>
            )
          })}
          {cards.length === 0 && <p className="text-sm text-gray-500">No hay personas que mostrar.</p>}
        </div>
      ) : (
        <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <BudgetEvolution
            versions={versions}
            budgetTypes={budgetTypes}
            members={members}
            scopeUserId={userFilter === 'all' ? null : userFilter}
            view="past"
            nowMonth={nowMonth}
            editHref={(idUser, month) => calculatorHref(idUser, { edit: true, month })}
          />
        </div>
      )}
    </section>
  )
}
