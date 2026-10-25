'use client'

import { useState, type ReactNode } from 'react'
import type { BudgetDeadline, Status } from '@/lib/budget-analytics'
import { formatMoney } from '@/lib/budget-calculator'
import { DeadlineStrip, Icon, IconBadge, RingProgress, StatusPill, type Accent } from './visuals'

export type PartidaSavedInfo = {
  /** Lo que hay ahora dentro de la partida: arrastre + aportado por ingresos - gastado */
  balance: number
  funded: number
  spent: number
  opening: number
  months: { month: string; funded: number; spent: number }[]
}

/** Partida única: lo ingresado, lo gastado y el total estimado, con una barra que lo resume. */
function UniqueSummary({
  saved,
  budget,
  accent,
  name,
  periodicityLabel,
  status,
  statusLabel,
  hasBudget,
}: {
  saved: PartidaSavedInfo
  budget: number
  accent: Accent
  name: string
  periodicityLabel?: string
  status: Status
  statusLabel?: string
  hasBudget: boolean
}) {
  const contributed = saved.funded + saved.opening
  const scale = Math.max(budget, contributed, saved.spent, 1)
  const spentPct = (Math.min(saved.spent, scale) / scale) * 100
  const insidePct = (Math.max(0, Math.min(contributed - saved.spent, scale - saved.spent)) / scale) * 100
  const toSpend = hasBudget ? budget - saved.spent : null
  const missing = hasBudget ? Math.max(0, budget - contributed) : 0
  const tiles = [
    { label: 'Gastado en total', value: formatMoney(saved.spent), hint: undefined as string | undefined, negative: false },
    {
      label: 'Presupuestado',
      value: hasBudget ? formatMoney(budget) : '—',
      hint: toSpend === null ? undefined : toSpend >= 0 ? `quedan ${formatMoney(toSpend)} por gastar` : `${formatMoney(-toSpend)} de más`,
      negative: toSpend !== null && toSpend < 0,
    },
    {
      label: 'Metido en la partida',
      value: formatMoney(contributed),
      hint: missing > 0 ? `faltan ${formatMoney(missing)} por aportar` : 'ya aportado',
      negative: false,
    },
  ]

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">{name}</h3>
          {periodicityLabel && (
            <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: accent.text }}>
              {periodicityLabel}
            </p>
          )}
        </div>
        {hasBudget && <StatusPill status={status} label={statusLabel} />}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl bg-slate-50/70 p-2.5 ring-1 ring-inset ring-slate-100">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{tile.label}</p>
            <p className="mt-0.5 text-base font-semibold tabular-nums text-slate-900">{tile.value}</p>
            {tile.hint && <p className={`text-[10px] ${tile.negative ? 'font-medium text-rose-600' : 'text-slate-400'}`}>{tile.hint}</p>}
          </div>
        ))}
      </div>

      <div className="mt-3">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-slate-700" style={{ width: `${spentPct}%` }} title="Gastado" />
          <div className="h-full" style={{ width: `${insidePct}%`, backgroundColor: accent.solid }} title="Disponible en la partida" />
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-700" /> Gastado
          </span>
          {saved.balance >= 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent.solid }} /> Disponible ahora{' '}
              <span className="font-semibold tabular-nums text-slate-800">{formatMoney(saved.balance)}</span>
            </span>
          ) : (
            <span className="font-medium text-rose-600">Has gastado {formatMoney(-saved.balance)} más de lo metido hasta ahora</span>
          )}
        </p>
      </div>
    </>
  )
}

/** Tarjeta de una partida: importes, estado y desglose desplegable. */
export default function PartidaCard({
  name,
  accent,
  periodicityLabel,
  spent,
  budget,
  ratio,
  status,
  statusLabel,
  pace,
  caption,
  saved,
  deadline,
  noBudgetMessage,
  expandable = true,
  defaultOpen = false,
  children,
}: {
  name: string
  accent: Accent
  periodicityLabel?: string
  spent: number
  budget: number
  ratio: number | null
  status: Status
  statusLabel?: string
  pace?: number
  caption?: string
  /** Solo partidas únicas: cuánto hay ahorrado dentro de la partida */
  saved?: PartidaSavedInfo | null
  deadline?: BudgetDeadline | null
  noBudgetMessage?: string
  expandable?: boolean
  defaultOpen?: boolean
  children?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const hasBudget = budget > 0
  const remaining = budget - spent

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.12)]">
      <div className="h-[3px]" style={{ backgroundColor: accent.solid }} />
      {deadline && <DeadlineStrip deadline={deadline} className="border-x-0 border-t-0" />}
      <div className="p-4 sm:p-5">
        {saved ? (
          <UniqueSummary
            saved={saved}
            budget={budget}
            accent={accent}
            name={name}
            periodicityLabel={periodicityLabel}
            status={status}
            statusLabel={statusLabel}
            hasBudget={hasBudget}
          />
        ) : (
          <>
        <div className="flex items-center gap-4">
          {hasBudget ? (
            <RingProgress ratio={ratio} status={status} size={84} stroke={8}>
              <span className="text-lg font-semibold tabular-nums tracking-tight text-slate-900">{ratio !== null ? `${Math.round(ratio * 100)}%` : '—'}</span>
            </RingProgress>
          ) : (
            <IconBadge accent={accent} className="h-[84px] w-[84px] rounded-full" iconClass="h-8 w-8" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-slate-900">{name}</h3>
                {periodicityLabel && (
                  <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: accent.text }}>
                    {periodicityLabel}
                  </p>
                )}
              </div>
              {hasBudget && <StatusPill status={status} label={statusLabel} />}
            </div>
            {hasBudget ? (
              <>
                <p className="mt-2 text-sm text-slate-500">
                  <span className="text-xl font-semibold tabular-nums tracking-tight text-slate-900">{formatMoney(spent)}</span> de {formatMoney(budget)}
                </p>
                <p className={`mt-0.5 text-xs ${remaining < 0 ? 'font-medium text-rose-600' : 'text-slate-500'}`}>
                  {remaining < 0 ? `${formatMoney(-remaining)} de más` : `Quedan ${formatMoney(remaining)}`}
                  {pace !== undefined && <span className="text-slate-400"> · ritmo esperado {Math.round(pace * 100)}%</span>}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                <span className="text-xl font-semibold tabular-nums tracking-tight text-slate-900">{formatMoney(spent)}</span>
                <span className="ml-1.5">{noBudgetMessage || 'sin presupuesto vigente'}</span>
              </p>
            )}
          </div>
        </div>
        {caption && <p className="mt-1 text-xs text-slate-400">{caption}</p>}

          </>
        )}

        {expandable && children && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
            aria-expanded={open}
          >
            {open ? 'Ocultar detalle' : saved ? 'Ver mes a mes' : 'Ver por qué'}
            <Icon name="chevron" className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {open && children && <div className="border-t border-slate-100 p-4 sm:p-5">{children}</div>}
    </article>
  )
}
