'use client'

import { useMemo, useState } from 'react'
import { currentMonthKey } from '@/lib/budget-calculator'
import {
  budgetCoverageStart,
  earliestMonth,
  monthLabel,
  monthsForPreset,
  type RangePreset,
} from '@/lib/budget-analytics'
import { dateToMonth } from '@/lib/goals'
import BudgetsPane from './BudgetsPane'
import ControlsPane from './ControlsPane'
import DetailPane from './DetailPane'
import EvolutionPane from './EvolutionPane'
import UnassignedPane from './UnassignedPane'
import TransactionEditProvider from './TransactionEditProvider'
import { Segmented, useBudgetAnalyticsData } from './common'

type Pane = 'budgets' | 'evolution' | 'controls' | 'detail' | 'unassigned'

export default function BudgetAnalyticsTab({ idFamily, idUser }: { idFamily: string; idUser: string }) {
  const { data, loading, error, reload } = useBudgetAnalyticsData(idFamily)
  const [pane, setPane] = useState<Pane>('budgets')
  const [scope, setScope] = useState<string>(idUser) // id de persona o 'family'
  const [preset, setPreset] = useState<RangePreset>('6m')
  const [customMonths, setCustomMonths] = useState<string[]>([])
  // Se incrementa al editar una transacción para que los paneles vuelvan a leer sus datos
  const [refreshKey, setRefreshKey] = useState(0)

  const nowMonth = currentMonthKey()
  const scopeUserId = scope === 'family' ? null : scope
  // Solo tiene sentido comparar desde que existe algo con qué comparar: el primer presupuesto u objetivo
  const floor = useMemo(() => {
    if (!data) return null
    // En «Sin asignar» interesa ver también lo anterior al primer presupuesto
    if (pane === 'unassigned') return null
    if (pane === 'controls') {
      const starts = data.goals
        .filter((goal) => !scopeUserId || goal.id_user === scopeUserId)
        .map((goal) => dateToMonth(goal.dt_start_month))
        .sort()
      return starts[0] || null
    }
    return budgetCoverageStart(data, scopeUserId)
  }, [data, pane, scopeUserId])

  const availableMonths = useMemo(
    () => monthsForPreset('all', nowMonth, floor || (data ? earliestMonth(data) : null)),
    [nowMonth, data, floor]
  )
  const months = useMemo(() => {
    const clip = (list: string[]) => {
      const kept = floor ? list.filter((month) => month >= floor) : list
      return kept.length > 0 ? kept : [nowMonth]
    }
    if (preset === 'custom') {
      return clip(customMonths.filter((month) => availableMonths.includes(month)).sort())
    }
    return clip(monthsForPreset(preset, nowMonth, floor || (data ? earliestMonth(data) : null)))
  }, [preset, customMonths, availableMonths, nowMonth, data, floor])

  const choosePreset = (next: RangePreset) => {
    // Al pasar a "Elegir meses" se parte de los meses que se estaban viendo
    if (next === 'custom' && preset !== 'custom') setCustomMonths(months)
    setPreset(next)
  }
  const toggleMonth = (month: string) =>
    setCustomMonths((current) => (current.includes(month) ? current.filter((item) => item !== month) : [...current, month]))

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-14 animate-pulse rounded-3xl bg-white/70 ring-1 ring-slate-100" />
        <div className="h-80 animate-pulse rounded-3xl bg-white/70 ring-1 ring-slate-100" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-semibold">No se han podido cargar los datos de presupuestos.</p>
        {error && <p className="mt-1 text-red-600">{error}</p>}
        <button
          type="button"
          onClick={reload}
          className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <TransactionEditProvider
      idFamily={idFamily}
      idUser={idUser}
      onSaved={() => {
        reload()
        setRefreshKey((value) => value + 1)
      }}
    >
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-4">
        <Segmented
          value={pane}
          onChange={setPane}
          options={[
            { value: 'budgets', label: 'Presupuestos' },
            { value: 'evolution', label: 'Evolución' },
            { value: 'controls', label: 'Controles' },
            { value: 'detail', label: 'Detalle' },
            { value: 'unassigned', label: 'Sin asignar' },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-500">
            Persona
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 focus:border-[#90EBD6] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]/40"
            >
              {data.members.map((member) => (
                <option key={member.id_user} value={member.id_user}>
                  {member.ds_user || member.ds_email}
                </option>
              ))}
              <option value="family">Toda la familia</option>
            </select>
          </label>
          <Segmented
            size="sm"
            value={preset}
            onChange={choosePreset}
            options={[
              { value: '6m', label: '6 meses' },
              { value: '12m', label: '12 meses' },
              { value: 'year', label: 'Este año' },
              { value: 'all', label: 'Todo' },
              { value: 'custom', label: 'Elegir meses' },
            ]}
          />
        </div>
      </div>

      {preset === 'custom' && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              Elige uno o varios meses <span className="text-slate-400">({customMonths.filter((month) => availableMonths.includes(month)).length} seleccionados)</span>
            </p>
            <div className="flex gap-3 text-xs font-medium">
              <button type="button" className="text-slate-500 hover:text-slate-900" onClick={() => setCustomMonths(availableMonths)}>
                Todos
              </button>
              <button type="button" className="text-slate-500 hover:text-slate-900" onClick={() => setCustomMonths([])}>
                Ninguno
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[...availableMonths].reverse().map((month) => {
              const on = customMonths.includes(month)
              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => toggleMonth(month)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {monthLabel(month)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {pane === 'budgets' && <BudgetsPane key={refreshKey} data={data} scopeUserId={scopeUserId} months={months} />}
      {pane === 'evolution' && <EvolutionPane data={data} scopeUserId={scopeUserId} months={months} />}
      {pane === 'controls' && <ControlsPane data={data} scopeUserId={scopeUserId} months={months} idFamily={idFamily} />}
      {pane === 'detail' && <DetailPane data={data} scopeUserId={scopeUserId} months={months} />}
      {pane === 'unassigned' && <UnassignedPane key={refreshKey} data={data} idFamily={idFamily} scopeUserId={scopeUserId} months={months} />}
    </div>
    </TransactionEditProvider>
  )
}
