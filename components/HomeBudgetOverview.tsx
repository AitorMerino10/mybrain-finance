'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  budgetCoverageStart,
  budgetDeadline,
  buildGoalViews,
  buildPartidaStatus,
  buildSpendTree,
  monthLabel,
  statusFromRatio,
  type BudgetAnalyticsData,
  type GoalView,
  type PartidaStatus,
  type Status,
} from '@/lib/budget-analytics'
import { currentMonthKey, formatMoney } from '@/lib/budget-calculator'
import { Card, useBudgetAnalyticsData } from './budget-analytics/common'
import { accentForPartida } from './budget-analytics/partidaAccent'
import PartidaCard, { type PartidaSavedInfo } from './budget-analytics/PartidaCard'
import { useBalanceExtras } from './budget-analytics/useBalanceExtras'
import { balanceFromAnalytics, monthlyBudgetTotal, savingsGoalProgress } from '@/lib/budget-balance'
import { resolveBudgetTypeId } from '@/lib/budget-analytics'
import { getScopedAmount } from '@/lib/budget-calculator'
import { planInForce, saveBudgetPlan, type BudgetPlan } from '@/lib/budget-plans'
import { supabase } from '@/lib/supabase'
import SpendTreeView from './budget-analytics/SpendTreeView'
import TransactionEditProvider, { EditTransactionButton } from './budget-analytics/TransactionEditProvider'
import {
  CONTROL_ACCENT,
  DeadlineStrip,
  RingProgress,
  StatusPill,
  type Accent,
} from './budget-analytics/visuals'

const STATUS_ORDER: Record<Status, number> = { over: 0, warning: 1, ok: 2 }

function SectionLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-50 hover:text-slate-900"
    >
      {children}
    </Link>
  )
}

function yearToDateMonths(nowMonth: string): string[] {
  const [year, month] = nowMonth.split('-').map(Number)
  return Array.from({ length: month }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
}

function HomePartidaCard({
  row,
  data,
  idUser,
  nowMonth,
  ytdMonths,
  saved,
}: {
  row: PartidaStatus
  data: BudgetAnalyticsData
  idUser: string
  nowMonth: string
  ytdMonths: string[]
  /** Solo partidas únicas: lo ahorrado dentro de la partida */
  saved?: PartidaSavedInfo | null
}) {
  const accent = accentForPartida(data, row.idBudgetType)
  const windowMonths = row.periodKind === 'period' ? row.windowMonths : row.periodicity === 'annual' ? ytdMonths : [nowMonth]
  const periodLabel =
    row.periodKind === 'period' ? 'en lo que va del periodo' : row.periodicity === 'annual' ? 'en lo que va de año' : 'este mes'

  return (
    <PartidaCard
      name={row.name}
      accent={accent}
      periodicityLabel={row.periodicityLabel}
      spent={row.spent}
      budget={row.hasBudget ? row.budget : 0}
      ratio={row.ratio}
      status={row.isUnassigned ? 'warning' : row.status}
      statusLabel={row.isUnassigned ? 'Sin partida' : undefined}
      pace={row.hasBudget ? row.paceFraction : undefined}
      noBudgetMessage={row.isUnassigned ? 'gastados este mes sin partida asignada' : 'gastados este mes (sin presupuesto vigente)'}
      caption={row.periodicity === 'annual' && row.hasBudget ? `${row.windowLabel} · este mes ${formatMoney(row.monthSpent)}` : undefined}
      saved={saved}
      deadline={row.isUnassigned ? null : budgetDeadline(data, idUser, row.idBudgetType, nowMonth)}
    >
      {saved ? (
        <UniquePartidaDetail saved={saved} data={data} idUser={idUser} idBudgetType={row.idBudgetType} nowMonth={nowMonth} />
      ) : (
        <HomePartidaTree data={data} idUser={idUser} months={windowMonths} idBudgetType={row.idBudgetType} accent={accent} periodLabel={periodLabel} partial={windowMonths.includes(nowMonth)} />
      )}
    </PartidaCard>
  )
}

/** Detalle de una partida única: mes a mes lo aportado y lo gastado, y los gastos de este mes. */
function UniquePartidaDetail({
  saved,
  data,
  idUser,
  idBudgetType,
  nowMonth,
}: {
  saved: PartidaSavedInfo
  data: BudgetAnalyticsData
  idUser: string
  idBudgetType: string
  nowMonth: string
}) {
  const expenses = data.transactions
    .filter((tx) => tx.type === 'Expense' && tx.ds_month_declared === nowMonth && resolveBudgetTypeId(tx, data.defaults) === idBudgetType)
    .map((tx) => ({ tx, amount: getScopedAmount(tx, idUser) }))
    .filter((item) => item.amount)
    .sort((a, b) => b.tx.dt_date.localeCompare(a.tx.dt_date))
  let running = saved.opening

  return (
    <div className="space-y-4 text-sm">
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Mes</th>
              <th className="px-3 py-2 text-right">Metido</th>
              <th className="px-3 py-2 text-right">Gastado</th>
              <th className="px-3 py-2 text-right">Disponible</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 tabular-nums">
            {saved.opening !== 0 && (
              <tr className="text-slate-500">
                <td className="px-3 py-1.5">Arrastrado de un cierre</td>
                <td className="px-3 py-1.5 text-right">{formatMoney(saved.opening)}</td>
                <td className="px-3 py-1.5 text-right">—</td>
                <td className="px-3 py-1.5 text-right">{formatMoney(saved.opening)}</td>
              </tr>
            )}
            {saved.months.map((item) => {
              running += item.funded - item.spent
              return (
                <tr key={item.month} className={item.month === nowMonth ? 'bg-slate-50/70 font-medium' : ''}>
                  <td className="px-3 py-1.5 capitalize text-slate-700">{monthLabel(item.month)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-700">{item.funded > 0 ? `+${formatMoney(item.funded)}` : '—'}</td>
                  <td className="px-3 py-1.5 text-right text-slate-700">{item.spent > 0 ? `−${formatMoney(item.spent)}` : '—'}</td>
                  <td className={`px-3 py-1.5 text-right ${running < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{formatMoney(running)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Gastos de {monthLabel(nowMonth, true).toLowerCase()}</p>
        {expenses.length === 0 ? (
          <p className="text-xs text-slate-400">Sin gastos este mes.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {expenses.map(({ tx, amount }) => (
              <li key={tx.id_transaction} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800">{tx.ds_comments || tx.ds_subcategory || tx.ds_category}</span>
                  <span className="flex flex-wrap items-center gap-x-1.5 text-slate-400">
                    {tx.dt_date} · {tx.ds_category}
                    {tx.ds_subcategory ? ` · ${tx.ds_subcategory}` : ''}
                    {tx.ds_tag?.trim() && (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{tx.ds_tag.trim()}</span>
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="font-semibold tabular-nums text-slate-900">−{formatMoney(amount)}</span>
                  <EditTransactionButton id={tx.id_transaction} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function HomePartidaTree({
  data,
  idUser,
  months,
  idBudgetType,
  accent,
  periodLabel,
  partial,
}: {
  data: BudgetAnalyticsData
  idUser: string
  months: string[]
  idBudgetType: string
  accent: Accent
  periodLabel: string
  partial: boolean
}) {
  const tree = useMemo(() => buildSpendTree(data, idUser, { months, idBudgetType }), [data, idUser, months, idBudgetType])
  return <SpendTreeView tree={tree} accent={accent} periodLabel={periodLabel} partialMonth={partial} />
}

function ControlCard({ view, nowMonth }: { view: GoalView; nowMonth: string }) {
  const { goal, progress } = view
  const monthly = goal.ds_periodicity === 'monthly' && progress.currentMonth
  const spent = monthly ? progress.currentMonth!.spent : progress.spent
  const target = monthly ? progress.currentMonth!.target : progress.target
  const ratio = target > 0 ? spent / target : null
  const status: Status = monthly ? statusFromRatio(ratio) : progress.status
  const remaining = target - spent

  return (
    <article className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.12)] sm:p-5">
      <div className="flex items-center gap-4">
        <RingProgress ratio={ratio} status={status} size={68} stroke={7}>
          <span className="text-sm font-semibold tabular-nums text-slate-900">{ratio !== null ? `${Math.round(ratio * 100)}%` : '—'}</span>
        </RingProgress>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{view.label}</p>
              <p className="truncate text-xs text-slate-500">
                {view.kind === 'sub' ? view.categoryLabel : 'Vertical'} ·{' '}
                {monthly ? monthLabel(nowMonth, true) : `${monthLabel(goal.dt_start_month.slice(0, 7))} – ${monthLabel(goal.dt_end_month.slice(0, 7))}`}
              </p>
            </div>
            <StatusPill status={status} label={status === 'over' ? 'Superado' : status === 'warning' ? (monthly ? 'Cuidado' : 'Por encima del ritmo') : undefined} />
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            <span className="text-lg font-semibold tabular-nums text-slate-900">{formatMoney(spent)}</span> de {formatMoney(target)}
            <span className={`ml-2 text-xs ${remaining < 0 ? 'font-medium text-rose-600' : 'text-slate-400'}`}>
              {remaining < 0 ? `${formatMoney(-remaining)} de más` : `quedan ${formatMoney(remaining)}`}
            </span>
          </p>
        </div>
      </div>
      {monthly && progress.projectedDelta !== null && progress.projected !== null && (
        <p className={`mt-2 text-xs ${progress.projectedDelta > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
          Periodo completo: {formatMoney(progress.spent)} de {formatMoney(progress.target)} · proyección {formatMoney(progress.projected)}
        </p>
      )}
      {!monthly && progress.projected !== null && progress.projectedDelta !== null && (
        <p className={`mt-2 text-xs ${progress.projectedDelta > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
          Al ritmo actual cerrarás en {formatMoney(progress.projected)} ({progress.projectedDelta > 0 ? '+' : ''}
          {formatMoney(progress.projectedDelta)})
        </p>
      )}
    </article>
  )
}

type GoalMode = 'percent' | 'amount' | 'auto'

/** Cambiar el objetivo de ahorro: un % de lo ingresado, una cantidad fija al mes o lo que sale de la calculadora. */
function SavingsGoalEditor({
  initialMode,
  initialValue,
  onSave,
  onCancel,
}: {
  initialMode: GoalMode
  initialValue: string
  onSave: (mode: GoalMode, value: string) => Promise<void>
  onCancel: () => void
}) {
  const [mode, setMode] = useState<GoalMode>(initialMode)
  const [value, setValue] = useState(initialValue)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const options: Array<{ value: GoalMode; label: string; hint: string }> = [
    { value: 'percent', label: '% de lo ingresado', hint: 'Ahorrar un porcentaje de cada ingreso' },
    { value: 'amount', label: 'Cantidad fija al mes', hint: 'Una cantidad que tú pones' },
    { value: 'auto', label: 'Lo estimado en la calculadora', hint: 'Ingresos estimados − presupuesto' },
  ]
  const valid = mode === 'auto' || Number(value.replace(',', '.')) > 0

  return (
    <div className="mb-4 rounded-2xl bg-slate-50/80 p-4 ring-1 ring-inset ring-slate-200/60">
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            className={`rounded-xl border px-3 py-2 text-left transition-colors ${
              mode === option.value ? 'border-[#0d9488] bg-white shadow-sm' : 'border-slate-200 bg-white/60 hover:bg-white'
            }`}
          >
            <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
            <span className="block text-[11px] text-slate-500">{option.hint}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {mode !== 'auto' && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            {mode === 'percent' ? 'Porcentaje' : 'Euros al mes'}
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-right text-sm tabular-nums focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]/50"
            />
            <span className="text-slate-400">{mode === 'percent' ? '%' : '€'}</span>
          </label>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!valid || saving}
            onClick={async () => {
              try {
                setSaving(true)
                setError(null)
                await onSave(mode, mode === 'auto' ? initialValue : value)
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo guardar')
                setSaving(false)
              }
            }}
            className="rounded-lg bg-[#0d9488] px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {saving ? 'Guardando…' : 'Guardar objetivo'}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  )
}

function SavingsGoalCard({
  goal,
  cycleStart,
  idFamily,
  plan,
  onSaveGoal,
}: {
  goal: ReturnType<typeof savingsGoalProgress>
  cycleStart: string | null
  idFamily: string
  /** Plan vigente: sin él no hay dónde guardar el objetivo desde aquí */
  plan: BudgetPlan | null
  onSaveGoal: (mode: GoalMode, value: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const editor = plan && editing && (
    <SavingsGoalEditor
      initialMode={(plan.plan.savingsMode as GoalMode) || 'percent'}
      initialValue={plan.plan.savingsValue || '10'}
      onSave={async (mode, value) => {
        await onSaveGoal(mode, value)
        setEditing(false)
      }}
      onCancel={() => setEditing(false)}
    />
  )
  const editButton = plan && !editing && (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-50 hover:text-slate-900"
    >
      Cambiar objetivo
    </button>
  )

  if (!goal) {
    return (
      <Card icon="flag" title="Objetivo de ahorro del periodo" action={editButton || undefined}>
        {editor}
        <p className="text-sm text-slate-500">
          Todavía no hay objetivo de ahorro.{' '}
          {plan ? (
            'Pulsa «Cambiar objetivo» para fijarlo.'
          ) : (
            <>
              Guarda un presupuesto en la{' '}
              <Link href={`/budgets/calculator?family=${idFamily}`} className="font-semibold text-[#0d9488] hover:underline">
                calculadora
              </Link>{' '}
              para poder fijarlo.
            </>
          )}
        </p>
      </Card>
    )
  }

  const ratio = goal.ratio
  const status: Status = ratio === null || ratio >= 1 ? 'ok' : ratio >= 0.75 ? 'warning' : 'over'
  const diff = goal.saved - goal.targetToDate
  const targetLabel =
    goal.mode === 'percent'
      ? `${goal.value}% de lo ingresado`
      : goal.mode === 'auto'
        ? `${formatMoney(goal.value)} al mes (lo estimado en la calculadora)`
        : `${formatMoney(goal.value)} al mes`

  return (
    <Card
      icon="flag"
      title="Objetivo de ahorro del periodo"
      action={editButton || undefined}
      subtitle={`${targetLabel}${cycleStart ? ` · desde ${monthLabel(cycleStart, true).toLowerCase()}` : ''}. Es el ahorro acumulado del presupuesto, no solo el de este mes.`}
    >
      {editor}
      <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex items-center gap-5">
          <RingProgress ratio={ratio === null ? null : Math.min(1, Math.max(0, ratio))} status={status} size={104} stroke={10}>
            <span className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{ratio !== null ? `${Math.round(ratio * 100)}%` : '—'}</span>
          </RingProgress>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Ahorrado hasta hoy</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-slate-900">
              {formatMoney(goal.saved)}
              <span className="ml-2 text-base font-normal text-slate-400">de {formatMoney(goal.targetToDate)}</span>
            </p>
            <p className={`mt-1 text-sm ${diff < 0 ? 'font-medium text-rose-600' : 'text-emerald-700'}`}>
              {diff < 0 ? `Te faltan ${formatMoney(-diff)} para ir en objetivo` : `Vas ${formatMoney(diff)} por encima del objetivo`}
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <dl className="grid grid-cols-3 gap-3">
            {[
              { label: 'Ingresado', value: formatMoney(goal.incomeSoFar) },
              { label: 'Gastado', value: formatMoney(goal.spent) },
              { label: 'Objetivo del periodo completo', value: goal.targetTotal !== null ? formatMoney(goal.targetTotal) : '—' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-50/70 p-3 ring-1 ring-inset ring-slate-100">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{item.label}</dt>
                <dd className="mt-1 text-base font-semibold tabular-nums text-slate-900">{item.value}</dd>
              </div>
            ))}
          </dl>
          <details className="group rounded-xl bg-slate-50/70 px-3 py-2 text-xs text-slate-600 ring-1 ring-inset ring-slate-100">
            <summary className="cursor-pointer select-none font-medium text-slate-700">
              Ahorrado = ingresado − gastado = {formatMoney(goal.saved)} · ver de qué se compone
            </summary>
            <dl className="mt-2 space-y-1">
              {[
                { label: 'Ingreso que no se llevó a ninguna partida', value: goal.unallocatedIncome },
                { label: 'Sobrante de partidas (aportado y no gastado)', value: goal.savedSurplus },
                { label: 'Gastado por encima de lo aportado a una partida', value: -goal.overspent },
                { label: 'Gastos sin partida', value: -goal.unassignedSpent },
              ].map((item) => (
                <div key={item.label} className="flex justify-between gap-3">
                  <dt>{item.label}</dt>
                  <dd className={`tabular-nums ${item.value < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                    {item.value > 0 ? '+' : item.value < 0 ? '−' : ''}
                    {formatMoney(Math.abs(item.value))}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </div>
    </Card>
  )
}

/** Todas las secciones de una persona: partidas mensuales, controles, objetivo de ahorro y partidas únicas. */
function MemberSections({
  idFamily,
  idUser,
  isSelf,
  name,
  data,
  balanceExtras,
}: {
  idFamily: string
  idUser: string
  isSelf: boolean
  name: string
  data: BudgetAnalyticsData
  balanceExtras: ReturnType<typeof useBalanceExtras>
}) {
  const nowMonth = currentMonthKey()
  const { allocations, closes, plans: extraPlans, subtypes: extraSubtypes } = balanceExtras.extras
  const balance = useMemo(
    () =>
      balanceExtras.loaded
        ? balanceFromAnalytics(data, { allocations, closes, plans: extraPlans, subtypes: extraSubtypes }, idUser, nowMonth)
        : null,
    [data, balanceExtras.loaded, allocations, closes, extraPlans, extraSubtypes, idUser, nowMonth]
  )
  const planNow = useMemo(() => planInForce(extraPlans, idUser, nowMonth), [extraPlans, idUser, nowMonth])
  const goal = useMemo(
    () =>
      balance
        ? savingsGoalProgress(balance, planNow?.plan ?? null, nowMonth, monthlyBudgetTotal(data.budgets, data.budgetTypes, idUser, nowMonth))
        : null,
    [balance, data, planNow, idUser, nowMonth]
  )
  const saveGoal = async (mode: GoalMode, value: string) => {
    if (!planNow) return
    await saveBudgetPlan(supabase, {
      idFamily,
      idUser,
      startMonth: planNow.dt_start_month,
      plan: { ...planNow.plan, savingsMode: mode, savingsValue: value },
    })
    await balanceExtras.reload()
  }

  const partidas = useMemo(() => buildPartidaStatus(data, idUser), [data, idUser])
  const controls = useMemo(() => {
    return buildGoalViews(data, idUser, nowMonth)
      .filter((view) => !view.progress.isFinished && !view.progress.isUpcoming)
      .sort((a, b) => STATUS_ORDER[a.progress.status] - STATUS_ORDER[b.progress.status])
  }, [data, idUser, nowMonth])
  // El año hasta hoy, pero solo desde que hay presupuesto: antes no hay nada con qué comparar
  const ytdMonths = useMemo(() => {
    const all = yearToDateMonths(nowMonth)
    const floor = budgetCoverageStart(data, idUser)
    const kept = floor ? all.filter((month) => month >= floor) : all
    return kept.length > 0 ? kept : [nowMonth]
  }, [nowMonth, data, idUser])

  if (!partidas) return null

  const analyticsHref = `/analytics?family=${idFamily}&tab=budgets`
  const monthlyRatio = partidas.monthlyBudget > 0 ? partidas.monthlySpent / partidas.monthlyBudget : null
  const monthlyStatus = statusFromRatio(monthlyRatio)
  const sortedRows = [...partidas.rows].sort((a, b) => {
    if (a.isUnassigned !== b.isUnassigned) return a.isUnassigned ? 1 : -1
    return 0
  })

  // Fecha límite más próxima entre todas las partidas con presupuesto
  const overallDeadline = sortedRows
    .filter((row) => !row.isUnassigned && row.hasBudget)
    .map((row) => budgetDeadline(data, idUser, row.idBudgetType, nowMonth))
    .filter((deadline): deadline is NonNullable<typeof deadline> => deadline !== null && !deadline.expired)
    .sort((a, b) => a.lastMonth.localeCompare(b.lastMonth))[0] || null

  const composition = sortedRows
    .filter((row) => row.periodicity === 'monthly' && row.monthSpent > 0)
    .map((row) => ({ id: row.idBudgetType, name: row.name, spent: row.monthSpent, color: accentForPartida(data, row.idBudgetType).solid }))
  const compositionTotal = composition.reduce((sum, item) => sum + item.spent, 0) || 1

  // Secciones: mensuales (con el gasto sin partida al final), únicas con gasto y únicas sin gasto en el periodo
  const monthlyRows = sortedRows.filter((row) => row.isUnassigned || row.periodicity === 'monthly')
  const uniqueRows = sortedRows.filter((row) => !row.isUnassigned && row.periodicity !== 'monthly')
  const uniqueWithSpend = uniqueRows.filter((row) => row.spent > 0)
  const uniqueWithoutSpend = uniqueRows.filter((row) => row.spent <= 0)
  const savedFor = (idBudgetType: string): PartidaSavedInfo | null => {
    const found = balance?.partidas.find((item) => item.idBudgetType === idBudgetType)
    return found ? { balance: found.balance, funded: found.funded, spent: found.spent, opening: found.opening, months: found.months } : null
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 0. Objetivo de ahorro del periodo */}
      {balance && sortedRows.length > 0 && <SavingsGoalCard goal={goal} cycleStart={balance.cycleStart} idFamily={idFamily} plan={planNow} onSaveGoal={saveGoal} />}

      {/* 1. Partidas mensuales */}
      <Card
        icon="chart"
        title={`Partidas mensuales · ${monthLabel(nowMonth, true).toLowerCase()}`}
        subtitle="Lo gastado este mes frente a lo que tocaría. La marca vertical es el ritmo que tocaría llevar hoy. Abre una partida para ver por qué."
        action={<SectionLink href={analyticsHref}>Ver analítica →</SectionLink>}
      >
        {sortedRows.length === 0 ? (
          <p className="text-sm text-slate-500">
            {isSelf ? 'Aún no tienes presupuestos.' : `${name} aún no tiene presupuestos.`}{' '}
            <Link href={`/budgets/calculator?family=${idFamily}`} className="font-semibold text-[#0d9488] hover:underline">
              Créalos con la calculadora
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-5">
            {overallDeadline && <DeadlineStrip deadline={overallDeadline} className="rounded-2xl border" />}
            {partidas.monthlyBudget > 0 && (
              <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-inset ring-slate-200/60 sm:p-5">
                <div className="flex items-center gap-5">
                  <RingProgress ratio={monthlyRatio} status={monthlyStatus} size={104} stroke={10}>
                    <span className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
                      {monthlyRatio !== null ? `${Math.round(monthlyRatio * 100)}%` : '—'}
                    </span>
                  </RingProgress>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Partidas mensuales</p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-slate-900">
                      {formatMoney(partidas.monthlySpent)}
                      <span className="ml-2 text-base font-normal text-slate-400">de {formatMoney(partidas.monthlyBudget)}</span>
                    </p>
                    <p className={`mt-1 text-sm ${partidas.monthlyBudget - partidas.monthlySpent < 0 ? 'font-medium text-rose-600' : 'text-slate-500'}`}>
                      {partidas.monthlyBudget - partidas.monthlySpent < 0
                        ? `Te has pasado ${formatMoney(partidas.monthlySpent - partidas.monthlyBudget)} este mes`
                        : `Te quedan ${formatMoney(partidas.monthlyBudget - partidas.monthlySpent)} este mes`}
                    </p>
                  </div>
                </div>
                {composition.length > 0 && (
                  <div className="mt-4">
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200/70">
                      {composition.map((item) => (
                        <div key={item.id} style={{ width: `${(item.spent / compositionTotal) * 100}%`, backgroundColor: item.color }} title={`${item.name}: ${formatMoney(item.spent)}`} />
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {composition.map((item) => (
                        <span key={item.id} className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.name} <span className="font-medium tabular-nums text-slate-700">{formatMoney(item.spent)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {monthlyRows.length === 0 ? (
              <p className="text-sm text-slate-500">No hay partidas mensuales en este presupuesto.</p>
            ) : (
              <div className="grid items-start gap-4 md:grid-cols-2">
                {monthlyRows.map((row) => (
                  <HomePartidaCard key={row.idBudgetType} row={row} data={data} idUser={idUser} nowMonth={nowMonth} ytdMonths={ytdMonths} />
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 2. Controles (junto a las partidas mensuales, lo que más se mira) */}
      <Card
        icon="flag"
        accent={CONTROL_ACCENT}
        title="Controles de gasto"
        subtitle="Objetivos por vertical o subvertical, frente a lo gastado."
        action={<SectionLink href={`/budgets?family=${idFamily}#objetivos`}>Gestionar →</SectionLink>}
      >
        {controls.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay controles activos este mes. Se pueden fijar desde la{' '}
            <Link href={`/budgets/calculator?family=${idFamily}`} className="font-semibold text-[#0d9488] hover:underline">
              calculadora
            </Link>{' '}
            o en Presupuestos.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {controls.map((view) => (
              <ControlCard key={view.goal.id_spending_goal} view={view} nowMonth={nowMonth} />
            ))}
          </div>
        )}
      </Card>

      {/* 2. Partidas únicas con gasto en el periodo */}
      {uniqueWithSpend.length > 0 && (
        <Card
          icon="wallet"
          title="Partidas únicas con gasto"
          subtitle="Partidas de todo el periodo (viajes, regalos, vehículos…) en las que ya has gastado: lo gastado frente al presupuesto y lo que queda ahorrado dentro."
        >
          <div className="grid items-start gap-4 md:grid-cols-2">
            {uniqueWithSpend.map((row) => (
              <HomePartidaCard key={row.idBudgetType} row={row} data={data} idUser={idUser} nowMonth={nowMonth} ytdMonths={ytdMonths} saved={savedFor(row.idBudgetType)} />
            ))}
          </div>
        </Card>
      )}

      {/* 3. Partidas únicas sin gasto en el periodo */}
      {uniqueWithoutSpend.length > 0 && (
        <Card
          icon="wallet"
          title="Partidas únicas sin gasto"
          subtitle="Partidas de todo el periodo en las que todavía no has gastado nada: lo que llevas ahorrado en cada una."
        >
          <div className="grid items-start gap-4 md:grid-cols-2">
            {uniqueWithoutSpend.map((row) => (
              <HomePartidaCard key={row.idBudgetType} row={row} data={data} idUser={idUser} nowMonth={nowMonth} ytdMonths={ytdMonths} saved={savedFor(row.idBudgetType)} />
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

export default function HomeBudgetOverview({ idFamily, idUser }: { idFamily: string; idUser: string }) {
  const { data, loading, error, reload } = useBudgetAnalyticsData(idFamily)
  const balanceExtras = useBalanceExtras(idFamily)
  const [selectedUser, setSelectedUser] = useState(idUser)

  if (loading && !data) {
    return (
      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-3xl bg-white/70 ring-1 ring-slate-100" />
        ))}
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card title="Presupuestos">
        <p className="text-sm text-slate-500">No se han podido cargar los presupuestos ahora mismo.</p>
      </Card>
    )
  }

  // Primero tú y después el resto de la familia
  const members = [...data.members].sort((a, b) => Number(b.id_user === idUser) - Number(a.id_user === idUser))
  const selectedMember = members.find((member) => member.id_user === selectedUser) || members[0]
  const nameOf = (member: { ds_user: string | null; ds_email: string | null }) => member.ds_user || member.ds_email || 'Sin nombre'

  return (
    <TransactionEditProvider
      idFamily={idFamily}
      idUser={idUser}
      onSaved={() => {
        reload()
        balanceExtras.reload()
      }}
    >
      <div className="space-y-6 sm:space-y-8">
        {members.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Ver presupuestos de</span>
            <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 text-sm font-medium">
              {members.map((member) => (
                <button
                  key={member.id_user}
                  type="button"
                  onClick={() => setSelectedUser(member.id_user)}
                  className={`rounded-lg px-3 py-1.5 transition ${
                    member.id_user === selectedMember.id_user ? 'bg-white text-[#0d9488] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {member.id_user === idUser ? `${nameOf(member)} (tú)` : nameOf(member)}
                </button>
              ))}
            </div>
          </div>
        )}
        {selectedMember && (
          <MemberSections
            key={selectedMember.id_user}
            idFamily={idFamily}
            idUser={selectedMember.id_user}
            isSelf={selectedMember.id_user === idUser}
            name={nameOf(selectedMember)}
            data={data}
            balanceExtras={balanceExtras}
          />
        )}
      </div>
    </TransactionEditProvider>
  )
}
