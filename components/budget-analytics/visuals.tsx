'use client'

import type { ReactNode } from 'react'
import { monthLabel, type BudgetDeadline, type Status } from '@/lib/budget-analytics'

// ==================== ICONOS ====================

const ICON_PATHS: Record<string, string> = {
  home: 'M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
  bag: 'M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z',
  sparkles:
    'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z',
  bolt: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
  plane: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5',
  wallet:
    'M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3',
  flag: 'M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  chevron: 'M19.5 8.25l-7.5 7.5-7.5-7.5',
  link: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244',
  chart:
    'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  arrowUp: 'M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18',
  arrowDown: 'M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3',
  tag: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z',
}

export type IconName = keyof typeof ICON_PATHS

export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[name]} />
    </svg>
  )
}

// ==================== COLORES POR PARTIDA ====================

export type Accent = { solid: string; soft: string; text: string; icon: IconName }

const ACCENTS: Record<string, Accent> = {
  fixed: { solid: '#6F8BE8', soft: '#EEF2FD', text: '#4A67C9', icon: 'home' },
  necessary: { solid: '#E8A06A', soft: '#FDF3EA', text: '#B96A2E', icon: 'bag' },
  life: { solid: '#3FB89E', soft: '#E9F8F4', text: '#1F8F78', icon: 'sparkles' },
  exceptional: { solid: '#A58BE6', soft: '#F3EFFC', text: '#7C5CCB', icon: 'bolt' },
  travel: { solid: '#4FAEDC', soft: '#E8F5FB', text: '#2780AC', icon: 'plane' },
}
const FALLBACKS: Accent[] = [
  { solid: '#E58FB0', soft: '#FCEFF4', text: '#B84F7E', icon: 'tag' },
  { solid: '#E0B84F', soft: '#FCF6E4', text: '#A8801A', icon: 'tag' },
]
export const UNASSIGNED_ACCENT: Accent = { solid: '#E0B84F', soft: '#FCF6E4', text: '#A8801A', icon: 'tag' }
export const BRAND_ACCENT: Accent = { solid: '#2A9D8F', soft: '#E7F6F3', text: '#1F7A6F', icon: 'wallet' }
export const CONTROL_ACCENT: Accent = { solid: '#6F8BE8', soft: '#EEF2FD', text: '#4A67C9', icon: 'flag' }

export function accentForBudgetType(key: string | null | undefined, index = 0): Accent {
  // Las partidas copiadas por familia llevan el id de la familia como sufijo de la clave
  const baseKey = key?.replace(/_[0-9a-f]{8}$/, '')
  if (baseKey && ACCENTS[baseKey]) return ACCENTS[baseKey]
  return FALLBACKS[index % FALLBACKS.length]
}

export function IconBadge({ accent, className = 'h-9 w-9', iconClass = 'h-[18px] w-[18px]' }: { accent: Accent; className?: string; iconClass?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-xl ${className}`} style={{ backgroundColor: accent.soft, color: accent.text }}>
      <Icon name={accent.icon} className={iconClass} />
    </span>
  )
}

// ==================== PROGRESO ====================

const STATUS_COLOR: Record<Status, string> = { ok: '#2FB394', warning: '#EBA23F', over: '#E5636B' }

/** Anillo de progreso con contenido central. */
export function RingProgress({
  ratio,
  status,
  size = 72,
  stroke = 8,
  color,
  children,
}: {
  ratio: number | null
  status: Status
  size?: number
  stroke?: number
  color?: string
  children?: ReactNode
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const value = Math.max(0, Math.min(1, ratio ?? 0))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EDF1F5" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color && status === 'ok' ? color : STATUS_COLOR[status]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value)}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">{children}</div>
    </div>
  )
}

/** Barra apilada "gastado / disponible" con marca de ritmo. */
export function SoftBar({
  ratio,
  status,
  color,
  pace,
  height = 'h-2',
}: {
  ratio: number | null
  status: Status
  color?: string
  pace?: number
  height?: string
}) {
  const width = Math.max(0, Math.min(1, ratio ?? 0)) * 100
  const fill = status === 'ok' ? color || STATUS_COLOR.ok : STATUS_COLOR[status]
  return (
    <div className={`relative ${height} w-full overflow-hidden rounded-full bg-slate-100`}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${width}%`, backgroundColor: fill }} />
      {pace !== undefined && (
        <div className="absolute top-0 h-full w-0.5 bg-slate-500/60" style={{ left: `${Math.min(1, pace) * 100}%` }} title="Ritmo esperado" />
      )}
    </div>
  )
}

export function StatusPill({ status, label }: { status: Status; label?: string }) {
  const styles: Record<Status, string> = {
    ok: 'bg-slate-50 text-slate-600 ring-slate-200',
    warning: 'bg-amber-50/60 text-amber-700 ring-amber-200/70',
    over: 'bg-rose-50/60 text-rose-700 ring-rose-200/70',
  }
  const defaults: Record<Status, string> = { ok: 'En ritmo', warning: 'Cuidado', over: 'Superado' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${styles[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] }} />
      {label || defaults[status]}
    </span>
  )
}

export function DeltaPill({ value, unit = '€/mes', invert = false }: { value: number; unit?: string; invert?: boolean }) {
  if (Math.abs(value) < 1) return <span className="text-xs text-slate-400">= habitual</span>
  const up = value > 0
  const bad = invert ? !up : up
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${bad ? 'bg-rose-50/70 text-rose-600' : 'bg-emerald-50/70 text-emerald-700'}`}>
      <Icon name={up ? 'arrowUp' : 'arrowDown'} className="h-3 w-3" />
      {Math.abs(Math.round(value)).toLocaleString('es-ES')} {unit}
    </span>
  )
}

// ==================== CONTENEDORES ====================

export function SectionTitle({
  icon,
  accent,
  title,
  subtitle,
  action,
}: {
  icon?: IconName
  accent?: Accent
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  const tone = accent || BRAND_ACCENT
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        {icon && <IconBadge accent={{ ...tone, icon }} className="h-8 w-8" iconClass="h-4 w-4" />}
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 max-w-2xl text-[13px] leading-snug text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export const cardShell = 'rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.12)]'

/** Franja bien visible con la fecha límite de un presupuesto. */
export function DeadlineStrip({ deadline, className = '' }: { deadline: BudgetDeadline; className?: string }) {
  const tone = deadline.expired
    ? 'bg-rose-50 text-rose-800 border-rose-200'
    : deadline.monthsLeft <= 3
      ? 'bg-amber-50 text-amber-900 border-amber-200'
      : 'bg-sky-50 text-sky-900 border-sky-200'
  const last = monthLabel(deadline.lastMonth, true)
  const text = deadline.expired
    ? `Presupuesto terminado en ${last}`
    : `Vigente hasta ${last} · ${deadline.monthsLeft === 1 ? 'último mes' : `quedan ${deadline.monthsLeft} meses`}`
  return (
    <div className={`flex items-center gap-2 border-y px-4 py-2 text-xs font-semibold sm:px-5 ${tone} ${className}`}>
      <Icon name="clock" className="h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  )
}
