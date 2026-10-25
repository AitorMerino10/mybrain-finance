'use client'

import { useMemo, useState } from 'react'
import type { BudgetType } from '@/lib/budgets'
import { formatMoney, groupKeyFor, type CalcTransaction, type PeriodRow } from '@/lib/budget-calculator'

export type TableFilter = {
  search: string
  category: string
  subcategory: string
  budgetType: string // '' = todas, 'none' = sin partida, id = partida
  tag: string // '' = todos, '__none' = sin tag
  month: string // '' = todos, YYYY-MM = mes declarado concreto
}

export const EMPTY_TABLE_FILTER: TableFilter = {
  search: '',
  category: '',
  subcategory: '',
  budgetType: '',
  tag: '',
  month: '',
}

type SortKey = 'date' | 'month' | 'amount' | 'total' | 'category'
type GroupBy = '' | 'tag' | 'category' | 'subcategory' | 'month'
type GroupSortKey = 'label' | 'count' | 'amount' | 'total'

const PAGE_SIZE = 50
const NO_TAG = '__none'

const GROUP_OPTIONS: Array<{ value: GroupBy; label: string }> = [
  { value: '', label: 'Sin agrupar' },
  { value: 'tag', label: 'Por tag' },
  { value: 'category', label: 'Por categoría' },
  { value: 'subcategory', label: 'Por subcategoría' },
  { value: 'month', label: 'Por mes' },
]

const selectClass =
  'rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]'

function groupInfo(tx: CalcTransaction, groupBy: GroupBy): { key: string; label: string; patch: Partial<TableFilter> } {
  switch (groupBy) {
    case 'tag': {
      const key = tx.ds_tag ?? NO_TAG
      return { key, label: tx.ds_tag ?? 'Sin tag', patch: { tag: key } }
    }
    case 'category': {
      const key = tx.id_category ?? 'none'
      return { key, label: tx.ds_category, patch: { category: key, subcategory: '' } }
    }
    case 'subcategory': {
      const category = tx.id_category ?? 'none'
      const key = tx.id_subcategory ?? `cat:${category}`
      return {
        key: `${category}|${key}`,
        label: `${tx.ds_category} · ${tx.ds_subcategory}`,
        patch: { category, subcategory: key },
      }
    }
    default:
      return { key: tx.ds_month_declared, label: tx.ds_month_declared, patch: { month: tx.ds_month_declared } }
  }
}

export default function TransactionsTable({
  rows,
  assignments,
  budgetTypes,
  filter,
  onFilterChange,
  showBudgetType = true,
  scopeLabel,
}: {
  rows: PeriodRow[]
  assignments: Record<string, string>
  budgetTypes: BudgetType[]
  filter: TableFilter
  onFilterChange: (filter: TableFilter) => void
  showBudgetType?: boolean
  /** Nombre de la persona/familia del alcance elegido, para etiquetar la columna de importe */
  scopeLabel?: string
}) {
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [groupBy, setGroupBy] = useState<GroupBy>('')
  const [groupSortKey, setGroupSortKey] = useState<GroupSortKey>('amount')
  const [groupSortDir, setGroupSortDir] = useState<'asc' | 'desc'>('desc')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const typeNameById = useMemo(
    () => new Map(budgetTypes.map((item) => [item.id_budget_type, item.ds_budget_type])),
    [budgetTypes]
  )

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>()
    rows.forEach(({ tx }) => map.set(tx.id_category ?? 'none', tx.ds_category))
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])

  const subcategoryOptions = useMemo(() => {
    const map = new Map<string, string>()
    rows.forEach(({ tx }) => {
      if (filter.category && (tx.id_category ?? 'none') !== filter.category) return
      map.set(tx.id_subcategory ?? `cat:${tx.id_category ?? 'none'}`, tx.ds_subcategory)
    })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows, filter.category])

  const tagOptions = useMemo(() => {
    const set = new Set<string>()
    rows.forEach(({ tx }) => tx.ds_tag && set.add(tx.ds_tag))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const monthOptions = useMemo(() => {
    const set = new Set<string>()
    rows.forEach(({ tx }) => set.add(tx.ds_month_declared))
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [rows])

  const filtered = useMemo(() => {
    const search = filter.search.trim().toLowerCase()
    const result = rows.filter(({ tx }) => {
      if (filter.month && tx.ds_month_declared !== filter.month) return false
      if (filter.category && (tx.id_category ?? 'none') !== filter.category) return false
      if (filter.subcategory) {
        const subKey = tx.id_subcategory ?? `cat:${tx.id_category ?? 'none'}`
        if (subKey !== filter.subcategory) return false
      }
      if (filter.tag) {
        if (filter.tag === NO_TAG ? tx.ds_tag : tx.ds_tag !== filter.tag) return false
      }
      if (filter.budgetType) {
        const assigned = assignments[groupKeyFor(tx)] || ''
        if (filter.budgetType === 'none' ? assigned !== '' : assigned !== filter.budgetType) {
          return false
        }
      }
      if (search) {
        const haystack = [tx.ds_comments, tx.ds_category, tx.ds_subcategory, tx.ds_tag]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(search)) return false
      }
      return true
    })

    const direction = sortDir === 'asc' ? 1 : -1
    result.sort((a, b) => {
      switch (sortKey) {
        case 'amount':
          return (a.amount - b.amount) * direction
        case 'total':
          return (a.tx.ft_amount - b.tx.ft_amount) * direction
        case 'month':
          return a.tx.ds_month_declared.localeCompare(b.tx.ds_month_declared) * direction
        case 'category':
          return (
            `${a.tx.ds_category} ${a.tx.ds_subcategory}`.localeCompare(
              `${b.tx.ds_category} ${b.tx.ds_subcategory}`
            ) * direction
          )
        default:
          return a.tx.dt_date.localeCompare(b.tx.dt_date) * direction
      }
    })
    return result
  }, [rows, filter, assignments, sortKey, sortDir])

  const totalAmount = filtered.reduce((sum, row) => sum + row.amount, 0)
  const totalReal = filtered.reduce((sum, row) => sum + row.tx.ft_amount, 0)

  const grouped = useMemo(() => {
    if (!groupBy) return []
    const map = new Map<
      string,
      { key: string; label: string; patch: Partial<TableFilter>; count: number; amount: number; total: number }
    >()
    for (const { tx, amount } of filtered) {
      const info = groupInfo(tx, groupBy)
      let entry = map.get(info.key)
      if (!entry) {
        entry = { ...info, count: 0, amount: 0, total: 0 }
        map.set(info.key, entry)
      }
      entry.count += 1
      entry.amount += amount
      entry.total += tx.ft_amount
    }
    const direction = groupSortDir === 'asc' ? 1 : -1
    return Array.from(map.values()).sort((a, b) =>
      groupSortKey === 'label'
        ? a.label.localeCompare(b.label) * direction
        : (a[groupSortKey] - b[groupSortKey]) * direction
    )
  }, [filtered, groupBy, groupSortKey, groupSortDir])

  const update = (patch: Partial<TableFilter>) => {
    setVisible(PAGE_SIZE)
    onFilterChange({ ...filter, ...patch })
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'category' ? 'asc' : 'desc')
    }
  }

  const toggleGroupSort = (key: GroupSortKey) => {
    if (groupSortKey === key) {
      setGroupSortDir(groupSortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setGroupSortKey(key)
      setGroupSortDir(key === 'label' ? 'asc' : 'desc')
    }
  }

  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '')
  const groupIndicator = (key: GroupSortKey) =>
    groupSortKey === key ? (groupSortDir === 'asc' ? ' ↑' : ' ↓') : ''

  const hasFilters = Object.values(filter).some(Boolean)
  const amountLabel = scopeLabel ? `Importe ${scopeLabel}` : 'Importe'

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input
          type="search"
          value={filter.search}
          onChange={(event) => update({ search: event.target.value })}
          placeholder="Buscar comentario, tag..."
          className={selectClass}
        />
        <select value={filter.month} onChange={(event) => update({ month: event.target.value })} className={selectClass}>
          <option value="">Todos los meses</option>
          {monthOptions.map((month) => (
            <option key={month} value={month}>
              {month}
            </option>
          ))}
        </select>
        <select
          value={filter.category}
          onChange={(event) => update({ category: event.target.value, subcategory: '' })}
          className={selectClass}
        >
          <option value="">Todas las categorías</option>
          {categoryOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={filter.subcategory}
          onChange={(event) => update({ subcategory: event.target.value })}
          className={selectClass}
        >
          <option value="">Todas las subcategorías</option>
          {subcategoryOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        {showBudgetType && (
          <select
            value={filter.budgetType}
            onChange={(event) => update({ budgetType: event.target.value })}
            className={selectClass}
          >
            <option value="">Todas las partidas</option>
            <option value="none">Sin partida</option>
            {budgetTypes.map((item) => (
              <option key={item.id_budget_type} value={item.id_budget_type}>
                {item.ds_budget_type}
              </option>
            ))}
          </select>
        )}
        <select value={filter.tag} onChange={(event) => update({ tag: event.target.value })} className={selectClass}>
          <option value="">Todos los tags</option>
          <option value={NO_TAG}>Sin tag</option>
          {tagOptions.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-xl bg-gray-100 p-1">
          {GROUP_OPTIONS.map((option) => (
            <button
              key={option.value || 'none'}
              type="button"
              onClick={() => setGroupBy(option.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                groupBy === option.value ? 'bg-white text-[#0d9488] shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
          <span>
            <strong className="text-gray-900">{filtered.length}</strong> transacciones
          </span>
          <span>
            {amountLabel}: <strong className="text-gray-900">{formatMoney(totalAmount, 2)}</strong>
          </span>
          <span>
            Importe total: <strong className="text-gray-900">{formatMoney(totalReal, 2)}</strong>
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setVisible(PAGE_SIZE)
                onFilterChange(EMPTY_TABLE_FILTER)
              }}
              className="font-medium text-[#0d9488] hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {groupBy ? (
        <div className="overflow-x-auto rounded-2xl border border-gray-100">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">
                  <button type="button" onClick={() => toggleGroupSort('label')}>
                    {GROUP_OPTIONS.find((option) => option.value === groupBy)?.label.replace('Por ', '')}
                    {groupIndicator('label')}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button type="button" onClick={() => toggleGroupSort('count')}>
                    Nº{groupIndicator('count')}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button type="button" onClick={() => toggleGroupSort('amount')}>
                    {amountLabel}
                    {groupIndicator('amount')}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button type="button" onClick={() => toggleGroupSort('total')}>
                    Importe total{groupIndicator('total')}
                  </button>
                </th>
                <th className="px-3 py-2 text-right">Media / trans.</th>
                <th className="px-3 py-2">% del importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white text-gray-800">
              {grouped.map((group) => {
                const share = totalAmount > 0 ? (group.amount / totalAmount) * 100 : 0
                return (
                  <tr
                    key={group.key}
                    onClick={() => {
                      setGroupBy('')
                      update(group.patch)
                    }}
                    className="cursor-pointer hover:bg-gray-50"
                    title="Ver las transacciones de este grupo"
                  >
                    <td className="px-3 py-2 font-medium text-gray-900">{group.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{group.count}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{formatMoney(group.amount, 2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(group.total, 2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                      {formatMoney(group.count > 0 ? group.amount / group.count : 0, 2)}
                    </td>
                    <td className="min-w-[140px] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-[#0d9488]" style={{ width: `${Math.min(share, 100)}%` }} />
                        </div>
                        <span className="w-10 text-right text-xs tabular-nums text-gray-500">{share.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {grouped.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                    No hay transacciones con estos filtros.
                  </td>
                </tr>
              )}
              {grouped.length > 0 && (
                <tr className="bg-gray-50 font-semibold text-gray-900">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{filtered.length}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totalAmount, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totalReal, 2)}</td>
                  <td colSpan={2} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">
                    <button type="button" onClick={() => toggleSort('date')}>
                      Fecha{sortIndicator('date')}
                    </button>
                  </th>
                  <th className="px-3 py-2">
                    <button type="button" onClick={() => toggleSort('month')}>
                      Mes declarado{sortIndicator('month')}
                    </button>
                  </th>
                  <th className="px-3 py-2">
                    <button type="button" onClick={() => toggleSort('category')}>
                      Categoría{sortIndicator('category')}
                    </button>
                  </th>
                  {showBudgetType && <th className="px-3 py-2">Partida</th>}
                  <th className="px-3 py-2 text-right">
                    <button type="button" onClick={() => toggleSort('amount')}>
                      {amountLabel}
                      {sortIndicator('amount')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right">
                    <button type="button" onClick={() => toggleSort('total')}>
                      Importe total{sortIndicator('total')}
                    </button>
                  </th>
                  <th className="px-3 py-2">Tag</th>
                  <th className="px-3 py-2">Comentario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white text-gray-800">
                {filtered.slice(0, visible).map(({ tx, amount }) => {
                  const assigned = assignments[groupKeyFor(tx)]
                  const isPartial = Math.abs(tx.ft_amount - amount) > 0.005
                  return (
                    <tr key={tx.id_transaction} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-3 py-2">{tx.dt_date}</td>
                      <td className="whitespace-nowrap px-3 py-2">{tx.ds_month_declared}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{tx.ds_category}</div>
                        <div className="text-xs text-gray-500">{tx.ds_subcategory}</div>
                      </td>
                      {showBudgetType && (
                        <td className="whitespace-nowrap px-3 py-2">
                          {assigned && typeNameById.get(assigned) ? (
                            <span className="rounded-full bg-[#90EBD6]/40 px-2 py-0.5 text-xs font-medium text-teal-800">
                              {typeNameById.get(assigned)}
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                              Sin partida
                            </span>
                          )}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">
                        {formatMoney(amount, 2)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${
                          isPartial ? 'text-gray-500' : 'text-gray-800'
                        }`}
                      >
                        {formatMoney(tx.ft_amount, 2)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{tx.ds_tag || '—'}</td>
                      <td className="max-w-xs px-3 py-2 text-gray-600">{tx.ds_comments || '—'}</td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={showBudgetType ? 8 : 7} className="px-3 py-8 text-center text-gray-500">
                      No hay transacciones con estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > visible && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setVisible((current) => current + PAGE_SIZE)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Mostrar más ({filtered.length - visible} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
