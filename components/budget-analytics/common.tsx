'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { loadBudgetAnalyticsData, type BudgetAnalyticsData, type Status } from '@/lib/budget-analytics'
import { formatMoney } from '@/lib/budget-calculator'
import { SectionTitle, cardShell, type Accent, type IconName } from './visuals'

// ==================== DATOS ====================

export function useBudgetAnalyticsData(idFamily: string) {
  const [data, setData] = useState<BudgetAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setData(await loadBudgetAnalyticsData(supabase, idFamily))
    } catch (err) {
      console.error('Error al cargar la analítica de presupuestos:', err)
      setError((err as { message?: string })?.message || 'Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }, [idFamily])

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, error, reload: load }
}

// ==================== COLORES Y ESTADOS ====================

export const CHART_COLORS = {
  budget: '#D8DEE9',
  actual: '#2FB394',
  warning: '#EBA23F',
  over: '#E5636B',
  contributed: '#7FB8D6',
  balance: '#1F7A6F',
  grid: '#eef2f6',
}

export const STATUS_STYLES: Record<Status, { bar: string; chip: string; text: string; label: string }> = {
  ok: { bar: 'bg-[#90EBD6]', chip: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-700', label: 'En ritmo' },
  warning: { bar: 'bg-[#FFD3A5]', chip: 'bg-amber-50 text-amber-700', text: 'text-amber-700', label: 'Cuidado' },
  over: { bar: 'bg-[#f18a8a]', chip: 'bg-red-50 text-red-700', text: 'text-red-700', label: 'Superado' },
}

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const style = STATUS_STYLES[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.chip}`}>
      {label || style.label}
    </span>
  )
}

/** Barra de progreso con marca de "ritmo esperado" opcional. */
export function ProgressBar({
  ratio,
  status,
  paceFraction,
  height = 'h-2.5',
}: {
  ratio: number | null
  status: Status
  paceFraction?: number
  height?: string
}) {
  const width = Math.max(0, Math.min(1, ratio ?? 0)) * 100
  return (
    <div className={`relative ${height} w-full overflow-hidden rounded-full bg-gray-100`}>
      <div className={`h-full rounded-full ${STATUS_STYLES[status].bar} transition-all`} style={{ width: `${width}%` }} />
      {paceFraction !== undefined && (
        <div
          className="absolute top-0 h-full w-0.5 bg-gray-500/70"
          style={{ left: `${Math.min(1, paceFraction) * 100}%` }}
          title="Ritmo esperado"
        />
      )}
    </div>
  )
}

// ==================== UI BÁSICA ====================

export function Card({
  title,
  subtitle,
  action,
  icon,
  accent,
  children,
}: {
  title?: string
  subtitle?: string
  action?: ReactNode
  icon?: IconName
  accent?: Accent
  children: ReactNode
}) {
  return (
    <section className={`${cardShell} p-5 sm:p-6`}>
      {(title || action) && (
        <SectionTitle icon={icon} accent={accent} title={title || ''} subtitle={subtitle} action={action} />
      )}
      {children}
    </section>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-2xl bg-slate-100/80 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-xl font-semibold transition-all ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${
            value === option.value ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.12)]' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Chips<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string; hint?: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
            value === option.value
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          {option.label}
          {option.hint && <span className="ml-1 text-[10px] font-normal opacity-60">{option.hint}</span>}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-gray-500">
      {children}
    </div>
  )
}

export function KpiTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'good' | 'bad'
}) {
  const color = tone === 'good' ? 'text-[#2F6F67]' : tone === 'bad' ? 'text-[#B85C5C]' : 'text-slate-900'
  return (
    <div className="rounded-xl bg-slate-50/70 p-3.5 ring-1 ring-inset ring-slate-100 sm:p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tracking-tight sm:text-xl ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

// ==================== GRÁFICO COMPARATIVO ====================

export type ChartSeries = {
  key: string
  label: string
  color: string
  type: 'bar' | 'line' | 'area'
  dashed?: boolean
  /** Color por barra (p. ej. rojo si te pasas del presupuesto) */
  colorFn?: (row: Record<string, any>) => string
}

export type ChartRow = Record<string, any> & { label: string }

/** Convierte las claves indicadas en acumulados a lo largo de las filas. */
export function cumulate(rows: ChartRow[], keys: string[]): ChartRow[] {
  const running: Record<string, number> = {}
  return rows.map((row) => {
    const next: ChartRow = { ...row }
    for (const key of keys) {
      running[key] = (running[key] || 0) + (Number(row[key]) || 0)
      next[key] = running[key]
    }
    return next
  })
}

function ChartTooltip({
  active,
  payload,
  label,
  series,
  diff,
}: {
  active?: boolean
  payload?: any[]
  label?: string
  series: ChartSeries[]
  diff?: { budgetKey: string; actualKey: string }
}) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload as ChartRow
  const budget = diff ? Number(row[diff.budgetKey]) || 0 : 0
  const actual = diff ? Number(row[diff.actualKey]) || 0 : 0
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-[0_8px_24px_-12px_rgba(15,23,42,0.25)]">
      <p className="mb-1 font-semibold text-gray-900">{label}</p>
      {series.map((item) => (
        <p key={item.key} className="flex items-center justify-between gap-4 text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
          <span className="font-semibold tabular-nums text-gray-900">{formatMoney(Number(row[item.key]) || 0)}</span>
        </p>
      ))}
      {diff && budget > 0 && (
        <p className={`mt-1 border-t border-gray-100 pt-1 font-semibold ${actual > budget ? 'text-red-600' : 'text-emerald-600'}`}>
          {actual > budget
            ? `+${formatMoney(actual - budget)} sobre lo previsto`
            : `${formatMoney(budget - actual)} por debajo`}{' '}
          ({Math.round((actual / budget) * 100)}%)
        </p>
      )}
    </div>
  )
}

export function ComparisonChart({
  rows,
  series,
  height = 320,
  diff,
}: {
  rows: ChartRow[]
  series: ChartSeries[]
  height?: number
  diff?: { budgetKey: string; actualKey: string }
}) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => (Math.abs(value) >= 1000 ? `${Math.round(value / 100) / 10}k` : String(value))}
          />
          <Tooltip content={<ChartTooltip series={series} diff={diff} />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
          {series.map((item) => {
            if (item.type === 'bar') {
              return (
                <Bar key={item.key} dataKey={item.key} name={item.label} fill={item.color} radius={[4, 4, 0, 0]} maxBarSize={34}>
                  {item.colorFn && rows.map((row, i) => <Cell key={i} fill={item.colorFn!(row)} />)}
                </Bar>
              )
            }
            if (item.type === 'area') {
              return (
                <Area
                  key={item.key}
                  dataKey={item.key}
                  name={item.label}
                  stroke={item.color}
                  fill={item.color}
                  fillOpacity={0.35}
                  strokeWidth={2}
                  type="monotone"
                />
              )
            }
            return (
              <Line
                key={item.key}
                dataKey={item.key}
                name={item.label}
                stroke={item.color}
                strokeWidth={2.5}
                strokeDasharray={item.dashed ? '6 4' : undefined}
                dot={{ r: 3 }}
                type="monotone"
              />
            )
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Color de la barra "real" según cuánto se acerca al previsto de ese mes. */
export function actualBarColor(row: Record<string, any>, budgetKey = 'budget', actualKey = 'spent'): string {
  const budget = Number(row[budgetKey]) || 0
  const actual = Number(row[actualKey]) || 0
  if (budget <= 0) return CHART_COLORS.actual
  if (actual > budget) return CHART_COLORS.over
  if (actual >= budget * 0.85) return CHART_COLORS.warning
  return CHART_COLORS.actual
}
