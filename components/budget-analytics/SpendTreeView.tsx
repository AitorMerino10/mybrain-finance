'use client'

import { useMemo, useState } from 'react'
import { monthLabel, statusFromRatio, type SpendTree, type SpendTreeNode } from '@/lib/budget-analytics'
import { formatMoney } from '@/lib/budget-calculator'
import { Icon, type Accent } from './visuals'
import { EditTransactionButton } from './TransactionEditProvider'

const TX_PREVIEW = 6

const RATIO_TEXT = { ok: 'text-emerald-700', warning: 'text-amber-700', over: 'text-rose-600' } as const

function formatDay(date: string) {
  const [, month, day] = date.slice(0, 10).split('-')
  return `${day}/${month}`
}

/** El mismo árbol pero solo con el gasto de un mes. */
function restrictToMonth(nodes: SpendTreeNode[], month: string, total: number): SpendTreeNode[] {
  return nodes
    .map((node) => {
      const monthTotal = node.byMonth[month] || 0
      return {
        ...node,
        total: monthTotal,
        share: total > 0 ? monthTotal / total : 0,
        transactions: node.transactions.filter((tx) => tx.month === month),
        children: restrictToMonth(node.children, month, total),
      }
    })
    .filter((node) => node.total > 0)
    .sort((a, b) => b.total - a.total)
}

function TxList({ node, indent }: { node: SpendTreeNode; indent: number }) {
  const [showAll, setShowAll] = useState(false)
  const list = showAll ? node.transactions : node.transactions.slice(0, TX_PREVIEW)
  return (
    <ul className="space-y-1 py-2 pr-1" style={{ paddingLeft: indent }}>
      {list.map((tx) => (
        <li key={tx.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50/80 px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">{tx.comment || 'Sin comentario'}</p>
            {tx.tag?.trim() && <p className="truncate text-xs text-slate-500">{tx.tag.trim()}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className="text-right">
              <p className="font-semibold tabular-nums text-slate-900">{formatMoney(tx.amount, 2)}</p>
              <p className="text-[11px] text-slate-400">{formatDay(tx.date)}</p>
            </div>
            <EditTransactionButton id={tx.id} />
          </div>
        </li>
      ))}
      {node.transactions.length > TX_PREVIEW && (
        <li>
          <button type="button" onClick={() => setShowAll((value) => !value)} className="text-xs font-semibold text-[#0d9488] hover:underline">
            {showAll ? 'Ver menos' : `Ver ${node.transactions.length - TX_PREVIEW} gastos más`}
          </button>
        </li>
      )}
    </ul>
  )
}

function NodeRow({
  node,
  depth,
  accent,
  expanded,
  onToggle,
  showMedian,
}: {
  node: SpendTreeNode
  depth: 0 | 1
  accent: Accent
  expanded: Set<string>
  onToggle: (key: string) => void
  showMedian: boolean
}) {
  const open = expanded.has(node.key)
  const hasChildren = node.children.length > 0
  const expandable = hasChildren || (depth >= 1 && node.transactions.length > 0)
  const padLeft = 12 + depth * 24
  return (
    <>
      <button
        type="button"
        onClick={() => expandable && onToggle(node.key)}
        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${expandable ? 'hover:bg-slate-50' : 'cursor-default'}`}
        style={{ paddingLeft: padLeft }}
      >
        <Icon name="chevron" className={`h-4 w-4 shrink-0 text-slate-300 transition-transform ${open ? 'rotate-0' : '-rotate-90'} ${expandable ? '' : 'opacity-0'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className={`flex min-w-0 items-center gap-1.5 truncate text-sm ${depth === 0 ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
              <span className="truncate">{node.label}</span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatMoney(node.total)}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${Math.max(node.share * 100, 2)}%`, backgroundColor: accent.solid }} />
            </div>
            <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-slate-400">{Math.round(node.share * 100)}%</span>
            {showMedian && (
              <span className="hidden w-28 shrink-0 justify-end text-[11px] tabular-nums text-slate-500 sm:flex">{formatMoney(node.monthlyMedian)}/mes</span>
            )}
          </div>
        </div>
      </button>
      {open && hasChildren && node.children.map((child) => <NodeRow key={child.key} node={child} depth={1} accent={accent} expanded={expanded} onToggle={onToggle} showMedian={showMedian} />)}
      {open && !hasChildren && depth >= 1 && <TxList node={node} indent={padLeft + 28} />}
    </>
  )
}

/**
 * Desglose de una partida en el periodo del presupuesto: mediana mensual, tabla mes a mes (se puede elegir un mes)
 * y verticales → subverticales → gastos concretos.
 */
export default function SpendTreeView({
  tree,
  accent,
  periodLabel,
  partialMonth = false,
  monthBudgets,
}: {
  tree: SpendTree
  accent: Accent
  periodLabel: string
  partialMonth?: boolean
  /** Presupuesto de cada mes (en €/mes) para compararlo con el gasto; los meses sin presupuesto no aparecen */
  monthBudgets?: Record<string, number>
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [month, setMonth] = useState<string | null>(null)
  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const multiMonth = tree.months.length > 1
  const activeMonth = multiMonth && month && tree.months.includes(month) ? month : null
  const monthTotal = activeMonth ? tree.byMonth[activeMonth] || 0 : tree.total
  const nodes = useMemo(() => (activeMonth ? restrictToMonth(tree.nodes, activeMonth, monthTotal) : tree.nodes), [tree, activeMonth, monthTotal])
  const hasBudgets = Boolean(monthBudgets && Object.keys(monthBudgets).length > 0)

  if (tree.nodes.length === 0) {
    return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No hay gastos en esta partida {periodLabel}.</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-600">
        {periodLabel[0].toUpperCase() + periodLabel.slice(1)} llevas <strong className="text-slate-900">{formatMoney(tree.total)}</strong> en {tree.txCount}{' '}
        {tree.txCount === 1 ? 'gasto' : 'gastos'}.
        {multiMonth && tree.medianMonths.length > 0 && (
          <>
            {' '}
            Mediana mensual: <strong className="text-slate-900">{formatMoney(tree.monthlyMedian)}/mes</strong>{' '}
            <span className="text-slate-400">
              ({tree.medianMonths.length === tree.months.length ? `en los ${tree.months.length} meses` : `en los ${tree.medianMonths.length} meses completos`} que lleva vigente el presupuesto)
            </span>
            .
          </>
        )}
        {partialMonth && <span className="text-slate-400"> El mes aún no ha terminado.</span>}
      </p>

      {multiMonth && (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Mes</th>
                <th className="px-3 py-2 text-right">Gastado</th>
                {hasBudgets && <th className="px-3 py-2 text-right">Presupuesto</th>}
                {hasBudgets && <th className="px-3 py-2 text-right">%</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 tabular-nums">
              {tree.months.map((item) => {
                const spent = tree.byMonth[item] || 0
                const budget = monthBudgets?.[item]
                const ratio = budget && budget > 0 ? spent / budget : null
                const selected = activeMonth === item
                return (
                  <tr
                    key={item}
                    onClick={() => setMonth(selected ? null : item)}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 ${selected ? 'bg-slate-100 font-medium' : ''}`}
                  >
                    <td className="px-3 py-1.5 capitalize text-slate-700">{monthLabel(item)}</td>
                    <td className="px-3 py-1.5 text-right text-slate-700">{spent > 0 ? formatMoney(spent) : '—'}</td>
                    {hasBudgets && <td className="px-3 py-1.5 text-right text-slate-500">{budget ? formatMoney(budget) : '—'}</td>}
                    {hasBudgets && (
                      <td className={`px-3 py-1.5 text-right font-medium ${ratio === null ? 'text-slate-300' : RATIO_TEXT[statusFromRatio(ratio)]}`}>
                        {ratio === null ? '—' : `${Math.round(ratio * 100)}%`}
                      </td>
                    )}
                  </tr>
                )
              })}
              <tr className="bg-slate-50/70 font-semibold text-slate-800">
                <td className="px-3 py-1.5">Mediana mensual</td>
                <td className="px-3 py-1.5 text-right">{formatMoney(tree.monthlyMedian)}</td>
                {hasBudgets && <td className="px-3 py-1.5" />}
                {hasBudgets && <td className="px-3 py-1.5" />}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {multiMonth && (
        <p className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          {activeMonth ? (
            <>
              <span>
                Viendo el detalle de <strong className="capitalize text-slate-700">{monthLabel(activeMonth, true)}</strong>
              </span>
              <button type="button" onClick={() => setMonth(null)} className="font-semibold text-[#0d9488] hover:underline">
                Ver todos los meses
              </button>
            </>
          ) : (
            <span>Pulsa un mes para ver solo sus gastos.</span>
          )}
        </p>
      )}

      <div className="rounded-xl border border-slate-100 p-1.5">
        {multiMonth && !activeMonth && (
          <div className="hidden items-center justify-end gap-3 px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:flex">
            <span className="w-28 text-right">mediana mensual</span>
          </div>
        )}
        {nodes.map((node) => (
          <NodeRow key={node.key} node={node} depth={0} accent={accent} expanded={expanded} onToggle={toggle} showMedian={multiMonth && !activeMonth} />
        ))}
      </div>
    </div>
  )
}
