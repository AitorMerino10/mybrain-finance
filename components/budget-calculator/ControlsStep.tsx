'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { addMonths, formatMoney, parseNumber } from '@/lib/budget-calculator'
import { createSpendingGoal } from '@/lib/goals'
import type { BreakdownCategory } from './MonthlyBreakdown'

const fieldClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#90EBD6] disabled:bg-gray-50 disabled:text-gray-400'

type Created = { id: number; label: string; amount: number; periodicity: 'monthly' | 'annual' }

/**
 * Puntos de control: vigilar de cerca una vertical o subvertical (comida fuera, ropa…) con un importe mensual
 * o total, sin que forme parte de las partidas del presupuesto. Se guarda al momento.
 */
export default function ControlsStep({
  categories,
  idFamily,
  idUser,
  scopeName,
  startMonth,
  endMonth,
}: {
  categories: BreakdownCategory[]
  idFamily: string
  /** null = "toda la familia": los controles son por persona */
  idUser: string | null
  scopeName: string
  /** Periodo del presupuesto (YYYY-MM); sin fin se usan 12 meses */
  startMonth: string
  endMonth: string
}) {
  const verticals = useMemo(() => categories.filter((category) => category.id !== 'none'), [categories])
  const [idCategory, setIdCategory] = useState('')
  const [idSubcategory, setIdSubcategory] = useState('')
  const [periodicity, setPeriodicity] = useState<'monthly' | 'annual'>('monthly')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Created[]>([])

  const category = verticals.find((item) => item.id === idCategory) ?? null
  const subs = category?.groups.filter((group) => group.idSubcategory) ?? []
  const group = subs.find((item) => item.idSubcategory === idSubcategory) ?? null
  const average = (group ?? category)?.stats.avg ?? 0
  const suggestion = Math.round(periodicity === 'monthly' ? average : average * 12)

  const effectiveEnd = endMonth && endMonth >= startMonth ? endMonth : addMonths(startMonth, 11)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!idUser || !category) return
    const value = parseNumber(amount)
    if (value <= 0) return setError('Introduce un importe mayor que 0')
    try {
      setSaving(true)
      setError(null)
      await createSpendingGoal(supabase, {
        idFamily,
        idUser,
        idCategory: idSubcategory ? null : category.id,
        idSubcategory: idSubcategory || null,
        periodicity,
        amount: value,
        startMonth,
        endMonth: effectiveEnd,
      })
      setCreated((current) => [
        ...current,
        { id: current.length + 1, label: group ? `${category.name} · ${group.dsSubcategory}` : category.name, amount: value, periodicity },
      ])
      setIdCategory('')
      setIdSubcategory('')
      setAmount('')
    } catch (err) {
      console.error('Error al crear el control:', err)
      const message = (err as { message?: string })?.message || 'Error al guardar el control'
      setError(
        /schema cache|does not exist|pml_cfg_spending_goal/i.test(message)
          ? `${message} — ¿has ejecutado la migración de controles en Supabase?`
          : message
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Puntos de control</h3>
        <p className="text-sm text-gray-500">
          Opcional. Elige una vertical (o una subvertical) que quieras vigilar y ponle un importe mensual o total para{' '}
          <strong>{scopeName}</strong>. No cambia tu presupuesto: es un aviso extra, y se guarda al momento.
        </p>
      </div>

      {!idUser && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Los controles son por persona: elige una persona en el paso 1 para poder crearlos.
        </p>
      )}

      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_9rem_auto] lg:items-end">
        <label className="block text-xs font-medium text-gray-500">
          Vertical
          <select
            value={idCategory}
            disabled={!idUser || saving}
            onChange={(event) => {
              setIdCategory(event.target.value)
              setIdSubcategory('')
            }}
            className={`${fieldClass} mt-1`}
          >
            <option value="">Elige una vertical…</option>
            {verticals.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-gray-500">
          Subvertical (opcional)
          <select
            value={idSubcategory}
            disabled={!idUser || saving || !category || subs.length === 0}
            onChange={(event) => setIdSubcategory(event.target.value)}
            className={`${fieldClass} mt-1`}
          >
            <option value="">{category ? 'Toda la vertical' : '—'}</option>
            {subs.map((item) => (
              <option key={item.key} value={item.idSubcategory as string}>
                {item.dsSubcategory}
              </option>
            ))}
          </select>
        </label>

        <div className="block text-xs font-medium text-gray-500">
          Importe
          <div className="mt-1 inline-flex w-full rounded-xl bg-gray-100 p-1 text-sm">
            {(
              [
                ['monthly', 'Al mes'],
                ['annual', 'Total'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriodicity(value)}
                className={`flex-1 rounded-lg px-3 py-1.5 font-medium transition ${
                  periodicity === value ? 'bg-white text-[#0d9488] shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-xs font-medium text-gray-500">
          Cantidad (€)
          <input
            type="number"
            min="0"
            step="1"
            value={amount}
            disabled={!idUser || saving || !category}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={category ? String(suggestion) : '0'}
            className={`${fieldClass} mt-1 tabular-nums`}
          />
        </label>

        <button
          type="submit"
          disabled={!idUser || saving || !category || !amount}
          className="rounded-xl bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-40"
        >
          {saving ? 'Guardando…' : 'Fijar control'}
        </button>
      </form>

      {category && (
        <p className="text-xs text-gray-500">
          Media del periodo analizado: <strong>{formatMoney(average)}/mes</strong>. El control vale de {startMonth} a {effectiveEnd}.
        </p>
      )}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {created.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {created.map((item) => (
            <li key={item.id} className="rounded-full bg-[#90EBD6]/30 px-3 py-1 text-xs font-medium text-teal-900">
              ✓ {item.label} · {formatMoney(item.amount)} {item.periodicity === 'monthly' ? '/mes' : 'total'}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
