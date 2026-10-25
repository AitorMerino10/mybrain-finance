'use client'

import { useMemo, useState } from 'react'
import type { SpendTree, SpendTreeNode } from '@/lib/budget-analytics'
import { formatMoney } from '@/lib/budget-calculator'
import { DeltaPill, Icon, type Accent } from './visuals'
import { EditTransactionButton } from './TransactionEditProvider'

const TX_PREVIEW = 6

function formatDay(date: string) {
  const [, month, day] = date.slice(0, 10).split('-')
  return `${day}/${month}`
}

function Insight({ tone, title, items }: { tone: 'up' | 'down'; title: string; items: Array<{ label: string; delta: number }> }) {
  if (items.length === 0) return null
  return (
    <div className={`rounded-xl p-3 sm:p-4 ${tone === 'up' ? 'bg-rose-50/70' : 'bg-emerald-50/70'}`}>
      <p className={`mb-2 text-[11px] font-bold uppercase tracking-wider ${tone === 'up' ? 'text-rose-600' : 'text-emerald-700'}`}>{title}</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-800">{item.label}</span>
            <DeltaPill value={item.delta} />
          </li>
        ))}
      </ul>
    </div>
  )
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
}: {
  node: SpendTreeNode
  depth: 0 | 1
  accent: Accent
  expanded: Set<string>
  onToggle: (key: string) => void
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
            <span className="hidden w-28 shrink-0 justify-end sm:flex">
              <DeltaPill value={node.delta} />
            </span>
          </div>
        </div>
      </button>
      {open && hasChildren && node.children.map((child) => <NodeRow key={child.key} node={child} depth={1} accent={accent} expanded={expanded} onToggle={onToggle} />)}
      {open && !hasChildren && depth >= 1 && <TxList node={node} indent={padLeft + 28} />}
    </>
  )
}

/** Desglose "¿qué hay detrás?": verticales → subverticales → gastos concretos, comparado con lo habitual. */
export default function SpendTreeView({
  tree,
  accent,
  periodLabel,
  partialMonth = false,
}: {
  tree: SpendTree
  accent: Accent
  periodLabel: string
  partialMonth?: boolean
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const { ups, downs } = useMemo(() => {
    const cats = tree.nodes.map((cat) => ({ label: cat.label, delta: cat.delta })).filter((item) => Math.abs(item.delta) >= 5)
    return {
      ups: cats.filter((item) => item.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3),
      downs: cats.filter((item) => item.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3),
    }
  }, [tree])

  if (tree.nodes.length === 0) {
    return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No hay gastos en esta partida {periodLabel}.</p>
  }

  const hasBaseline = tree.baselineMonths > 0 && tree.baselineMonthly > 0
  const diff = tree.monthlyAvg - tree.baselineMonthly

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-600">
        {periodLabel[0].toUpperCase() + periodLabel.slice(1)} llevas <strong className="text-slate-900">{formatMoney(tree.total)}</strong> en {tree.txCount}{' '}
        {tree.txCount === 1 ? 'gasto' : 'gastos'}.
        {hasBaseline && (
          <>
            {' '}
            Tu media de los {tree.baselineMonths} meses anteriores es <strong className="text-slate-900">{formatMoney(tree.baselineMonthly)}/mes</strong>
            {Math.abs(diff) >= 1 && (
              <>
                {' '}
                (<span className={diff > 0 ? 'font-semibold text-rose-600' : 'font-semibold text-emerald-600'}>
                  {diff > 0 ? '+' : '−'}
                  {formatMoney(Math.abs(diff))}/mes
                </span>
                )
              </>
            )}
            .
          </>
        )}
        {partialMonth && <span className="text-slate-400"> El mes aún no ha terminado, así que la comparación puede quedarse corta.</span>}
      </p>

      {(ups.length > 0 || downs.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Insight tone="up" title="Lo que más ha subido" items={ups} />
          <Insight tone="down" title="Lo que ha bajado" items={downs} />
        </div>
      )}

      <div className="rounded-xl border border-slate-100 p-1.5">
        <div className="hidden items-center justify-end gap-3 px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:flex">
          <span className="w-28 text-right">vs. habitual</span>
        </div>
        {tree.nodes.map((node) => (
          <NodeRow key={node.key} node={node} depth={0} accent={accent} expanded={expanded} onToggle={toggle} />
        ))}
      </div>
    </div>
  )
}
