'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getAllCategoriesByFamily, getSubcategoriesByCategory, type Category, type Subcategory } from '@/lib/categories'
import { getBudgetTypes, type BudgetType } from '@/lib/budgets'
import { getFamilyMembers, type FamilyMember } from '@/lib/family'
import { fetchCalculatorTransactions, formatMoney } from '@/lib/budget-calculator'
import { getTodayISOString } from '@/lib/date-utils'
import {
  EVERY_MONTHS_OPTIONS,
  createRecurringExpense,
  deleteRecurringExpense,
  describeSchedule,
  detectRecurringCandidates,
  firstOccurrenceOnOrAfter,
  getRecurringExpenses,
  monthlyEquivalent,
  startDateFor,
  updateRecurringExpense,
  type RecurringCandidate,
  type RecurringExpense,
} from '@/lib/recurring'

type FormState = {
  id: string | null
  name: string
  amount: string
  day: number
  every: number
  startMonth: string
  endDate: string
  categoryId: string
  subcategoryId: string
  budgetTypeId: string
  userIds: string[]
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900'

function longDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function RecurringSettings({ idFamily, idUser }: { idFamily: string; idUser: string }) {
  const today = getTodayISOString()
  const [rules, setRules] = useState<RecurringExpense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [budgetTypes, setBudgetTypes] = useState<BudgetType[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [candidates, setCandidates] = useState<RecurringCandidate[]>([])
  const [ignored, setIgnored] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const ignoredKey = `recurring-ignored:${idFamily}`

  const emptyForm = useCallback(
    (): FormState => ({
      id: null,
      name: '',
      amount: '',
      day: Number(today.slice(8, 10)),
      every: 1,
      startMonth: today.slice(0, 7),
      endDate: '',
      categoryId: '',
      subcategoryId: '',
      budgetTypeId: '',
      userIds: [idUser],
    }),
    [today, idUser]
  )

  const loadRules = useCallback(async () => {
    setRules(await getRecurringExpenses(supabase, idFamily))
  }, [idFamily])

  useEffect(() => {
    try {
      setIgnored(JSON.parse(localStorage.getItem(ignoredKey) || '[]'))
    } catch {
      setIgnored([])
    }
  }, [ignoredKey])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [loadedRules, loadedCategories, loadedTypes, loadedMembers] = await Promise.all([
          getRecurringExpenses(supabase, idFamily),
          getAllCategoriesByFamily(supabase, idFamily),
          getBudgetTypes(supabase, idFamily),
          getFamilyMembers(supabase, idFamily),
        ])
        if (cancelled) return
        const expenseCategories = loadedCategories.filter((category) => category.is_expense)
        const subLists = await Promise.all(expenseCategories.map((category) => getSubcategoriesByCategory(supabase, category.id_category)))
        if (cancelled) return
        setRules(loadedRules)
        setCategories(expenseCategories)
        setSubcategories(subLists.flat())
        setBudgetTypes(loadedTypes)
        setMembers(loadedMembers)

        // Las sugerencias se buscan después, para no retrasar la pantalla
        try {
          const transactions = await fetchCalculatorTransactions(idFamily)
          if (!cancelled) setCandidates(detectRecurringCandidates(transactions, loadedRules, getTodayISOString()))
        } catch {
          /* sin sugerencias */
        }
      } catch (error) {
        if (!cancelled) setMessage({ type: 'error', text: error instanceof Error ? error.message : 'No se pudieron cargar los gastos recurrentes' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [idFamily])

  const memberName = useCallback(
    (id: string) => {
      const member = members.find((item) => item.id_user === id)
      return member?.ds_user || member?.ds_email?.split('@')[0] || 'Alguien'
    },
    [members]
  )

  const categoryName = useCallback((id: string | null) => categories.find((category) => category.id_category === id)?.ds_category || null, [categories])
  const subcategoryName = useCallback((id: string | null) => subcategories.find((sub) => sub.id_subcategory === id)?.ds_subcategory || null, [subcategories])
  const partidaName = useCallback((id: string | null) => budgetTypes.find((type) => type.id_budget_type === id)?.ds_budget_type || null, [budgetTypes])

  const activeRules = rules.filter((rule) => rule.is_active)
  const monthlyWeight = activeRules.reduce((sum, rule) => sum + monthlyEquivalent(Number(rule.ft_amount), rule.nu_every_months), 0)
  const visibleCandidates = candidates.filter((candidate) => !ignored.includes(candidate.key))

  const runGeneration = async () => {
    try {
      const response = await fetch('/api/recurring/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idFamily }),
      })
      const json = await response.json().catch(() => ({}))
      return Number(json.created) || 0
    } catch {
      return 0
    }
  }

  const afterSave = async (text: string) => {
    const created = await runGeneration()
    await loadRules()
    setMessage({
      type: 'ok',
      text: created > 0 ? `${text} Hoy toca cobrarlo: ya lo tienes en tus gastos pendientes.` : text,
    })
  }

  const openNew = () => {
    setMessage(null)
    setForm(emptyForm())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openEdit = (rule: RecurringExpense) => {
    setMessage(null)
    setForm({
      id: rule.id_recurring_expense,
      name: rule.ds_name,
      amount: String(rule.ft_amount),
      day: rule.nu_day_of_month,
      every: rule.nu_every_months,
      startMonth: rule.dt_start.slice(0, 7),
      endDate: rule.dt_end || '',
      categoryId: rule.id_category || '',
      subcategoryId: rule.id_subcategory || '',
      budgetTypeId: rule.id_budget_type || '',
      userIds: rule.ds_user_ids.length > 0 ? rule.ds_user_ids : [idUser],
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const fillFromCandidate = (candidate: RecurringCandidate) => {
    setMessage(null)
    setForm({
      id: null,
      name: candidate.name,
      amount: String(candidate.amount),
      day: candidate.dayOfMonth,
      every: EVERY_MONTHS_OPTIONS.includes(candidate.everyMonths) ? candidate.everyMonths : 1,
      startMonth: candidate.nextDate.slice(0, 7),
      endDate: '',
      categoryId: candidate.idCategory || '',
      subcategoryId: candidate.idSubcategory || '',
      budgetTypeId: candidate.idBudgetType || '',
      userIds: candidate.userIds.length > 0 ? candidate.userIds : [idUser],
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const ignoreCandidate = (key: string) => {
    const next = [...ignored, key]
    setIgnored(next)
    try {
      localStorage.setItem(ignoredKey, JSON.stringify(next))
    } catch {
      /* sin almacenamiento */
    }
  }

  const schedule = useMemo(() => {
    if (!form) return null
    const dt_start = startDateFor(form.startMonth, form.day)
    return { dt_start, nu_day_of_month: form.day, nu_every_months: form.every }
  }, [form])

  const previewNext = schedule ? firstOccurrenceOnOrAfter(schedule, today) : null

  const save = async () => {
    if (!form || !schedule || !previewNext) return
    const amount = Number(form.amount.replace(',', '.'))
    if (!form.name.trim()) return setMessage({ type: 'error', text: 'Ponle un nombre (por ejemplo, Netflix o Alquiler).' })
    if (!Number.isFinite(amount) || amount <= 0) return setMessage({ type: 'error', text: 'Indica un importe mayor que 0.' })
    if (form.userIds.length === 0) return setMessage({ type: 'error', text: 'Elige al menos una persona.' })
    if (form.endDate && form.endDate < previewNext) return setMessage({ type: 'error', text: 'La fecha de fin es anterior al próximo cobro.' })

    setSaving(true)
    setMessage(null)
    try {
      const common = {
        ds_name: form.name.trim(),
        ft_amount: amount,
        nu_day_of_month: form.day,
        nu_every_months: form.every,
        dt_end: form.endDate || null,
        id_category: form.categoryId || null,
        id_subcategory: form.subcategoryId || null,
        id_budget_type: form.budgetTypeId || null,
        ds_user_ids: form.userIds,
      }
      if (form.id) {
        const current = rules.find((rule) => rule.id_recurring_expense === form.id)
        const scheduleChanged =
          !current ||
          current.nu_day_of_month !== form.day ||
          current.nu_every_months !== form.every ||
          current.dt_start.slice(0, 7) !== form.startMonth
        await updateRecurringExpense(supabase, form.id, {
          ...common,
          ...(scheduleChanged ? { dt_start: schedule.dt_start, dt_next: previewNext } : {}),
        })
        setForm(null)
        await afterSave('Cambios guardados.')
      } else {
        await createRecurringExpense(supabase, {
          ...common,
          id_family: idFamily,
          id_user_creator: idUser,
          dt_start: schedule.dt_start,
          dt_next: previewNext,
          is_active: true,
        })
        setForm(null)
        await afterSave('Gasto recurrente creado.')
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar (¿falta ejecutar la migración?)' })
    } finally {
      setSaving(false)
    }
  }

  const togglePause = async (rule: RecurringExpense) => {
    try {
      if (rule.is_active) {
        await updateRecurringExpense(supabase, rule.id_recurring_expense, { is_active: false })
      } else {
        // Al reactivar no se recuperan los cobros que pasaron mientras estaba en pausa
        await updateRecurringExpense(supabase, rule.id_recurring_expense, {
          is_active: true,
          dt_next: firstOccurrenceOnOrAfter(rule, today),
        })
      }
      await loadRules()
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'No se pudo cambiar el estado' })
    }
  }

  const remove = async (rule: RecurringExpense) => {
    if (!window.confirm(`¿Eliminar "${rule.ds_name}"? Los gastos que ya has registrado no se tocan.`)) return
    try {
      await deleteRecurringExpense(supabase, rule.id_recurring_expense)
      await loadRules()
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'No se pudo eliminar' })
    }
  }

  const formSubcategories = form ? subcategories.filter((sub) => sub.id_category === form.categoryId) : []

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900">🔁 Gastos recurrentes</h2>
          <p className="text-sm text-gray-500">
            Elige el día del mes y cada cuántos meses se cobra. Ese día se crea un gasto <strong>pendiente</strong> y te avisamos; tú lo completas cuando
            realmente se cobre.
          </p>
        </div>
        {!form && (
          <button onClick={openNew} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            + Nuevo recurrente
          </button>
        )}
      </div>

      {message && (
        <p
          className={`mt-3 rounded-xl border p-3 text-sm ${
            message.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </p>
      )}

      {form && schedule && (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50/60 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-900">{form.id ? 'Editar gasto recurrente' : 'Nuevo gasto recurrente'}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-gray-600">Nombre</span>
              <input
                className={inputClass}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Netflix, alquiler, seguro del coche…"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Importe (€)</span>
              <input
                className={inputClass}
                inputMode="decimal"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                placeholder="0,00"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Día del mes</span>
              <select className={inputClass} value={form.day} onChange={(event) => setForm({ ...form, day: Number(event.target.value) })}>
                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Se repite</span>
              <select className={inputClass} value={form.every} onChange={(event) => setForm({ ...form, every: Number(event.target.value) })}>
                {EVERY_MONTHS_OPTIONS.map((months) => (
                  <option key={months} value={months}>
                    {months === 1 ? 'Cada mes' : months === 12 ? 'Cada año' : `Cada ${months} meses`}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">{form.every === 1 ? 'Empieza en' : 'Primer cobro en'}</span>
              <input
                type="month"
                className={inputClass}
                value={form.startMonth}
                onChange={(event) => event.target.value && setForm({ ...form, startMonth: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Termina el (opcional)</span>
              <input type="date" className={inputClass} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
            </label>
          </div>

          {previewNext && (
            <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-gray-700 ring-1 ring-inset ring-gray-200">
              Se cobra <strong>{describeSchedule({ nu_day_of_month: form.day, nu_every_months: form.every })}</strong>. Próximo cobro:{' '}
              <strong>{longDate(previewNext)}</strong>
              {previewNext === today ? ' (hoy: aparecerá enseguida en tus pendientes)' : ''}.
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Categoría (opcional)</span>
              <select
                className={inputClass}
                value={form.categoryId}
                onChange={(event) => setForm({ ...form, categoryId: event.target.value, subcategoryId: '' })}
              >
                <option value="">Sin elegir</option>
                {categories.map((category) => (
                  <option key={category.id_category} value={category.id_category}>
                    {category.ds_category}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Subcategoría (opcional)</span>
              <select
                className={inputClass}
                value={form.subcategoryId}
                disabled={!form.categoryId}
                onChange={(event) => setForm({ ...form, subcategoryId: event.target.value })}
              >
                <option value="">Sin elegir</option>
                {formSubcategories.map((sub) => (
                  <option key={sub.id_subcategory} value={sub.id_subcategory}>
                    {sub.ds_subcategory}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Partida (opcional)</span>
              <select className={inputClass} value={form.budgetTypeId} onChange={(event) => setForm({ ...form, budgetTypeId: event.target.value })}>
                <option value="">La de la subcategoría</option>
                {budgetTypes.map((type) => (
                  <option key={type.id_budget_type} value={type.id_budget_type}>
                    {type.ds_budget_type}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {members.length > 1 && (
            <fieldset className="mt-4">
              <legend className="mb-1 text-xs font-medium text-gray-600">Quién lo paga</legend>
              <div className="flex flex-wrap gap-2">
                {members.map((member) => {
                  const checked = form.userIds.includes(member.id_user)
                  return (
                    <button
                      key={member.id_user}
                      type="button"
                      aria-pressed={checked}
                      onClick={() =>
                        setForm({
                          ...form,
                          userIds: checked ? form.userIds.filter((id) => id !== member.id_user) : [...form.userIds, member.id_user],
                        })
                      }
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        checked ? 'border-slate-900 bg-slate-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {memberName(member.id_user)}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1 text-xs text-gray-500">El pendiente le llega a quien lo crea; al completarlo se reparte entre las personas elegidas.</p>
            </fieldset>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={save} disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              onClick={() => setForm(null)}
              disabled={saving}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Cargando…</p>
      ) : (
        <>
          {activeRules.length > 0 && (
            <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200/70">
              Tus gastos recurrentes pesan unos <strong>{formatMoney(monthlyWeight)}</strong> al mes ({activeRules.length}{' '}
              {activeRules.length === 1 ? 'activo' : 'activos'}).
            </p>
          )}

          {visibleCandidates.length > 0 && !form && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-gray-900">Hemos detectado posibles suscripciones</h3>
              <p className="text-xs text-gray-500">Gastos que se repiten con un importe y un ritmo parecidos en tu histórico.</p>
              <ul className="mt-2 space-y-2">
                {visibleCandidates.slice(0, 6).map((candidate) => (
                  <li key={candidate.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium capitalize text-gray-900">{candidate.name}</p>
                      <p className="text-xs text-gray-500">
                        {candidate.variable ? 'Media de ' : ''}{formatMoney(candidate.amount, 2)} · {describeSchedule({ nu_day_of_month: candidate.dayOfMonth, nu_every_months: candidate.everyMonths })} ·{' '}
                        {candidate.occurrences} veces
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {candidate.reason}
                        {candidate.variable ? ' · el importe cambia cada vez' : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => fillFromCandidate(candidate)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">
                        Crear recurrente
                      </button>
                      <button
                        onClick={() => ignoreCandidate(candidate.key)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Ignorar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5">
            {rules.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                Aún no tienes gastos recurrentes. Crea el primero con “Nuevo recurrente”.
              </p>
            ) : (
              <ul className="space-y-2">
                {rules.map((rule) => {
                  const place = [categoryName(rule.id_category), subcategoryName(rule.id_subcategory)].filter(Boolean).join(' › ')
                  const partida = partidaName(rule.id_budget_type)
                  const ended = Boolean(rule.dt_end && rule.dt_next > rule.dt_end)
                  return (
                    <li key={rule.id_recurring_expense} className={`rounded-xl border border-gray-200 bg-white px-4 py-3 ${rule.is_active ? '' : 'opacity-60'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {rule.ds_name}
                            {!rule.is_active && (
                              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">{ended ? 'Terminado' : 'En pausa'}</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">{describeSchedule(rule)}</p>
                          {(place || partida) && <p className="text-xs text-gray-400">{[place, partida && `Partida: ${partida}`].filter(Boolean).join(' · ')}</p>}
                          {rule.is_active && <p className="mt-0.5 text-xs text-gray-500">Próximo cobro: {longDate(rule.dt_next)}</p>}
                          {rule.ds_user_ids.length > 0 && members.length > 1 && (
                            <p className="text-xs text-gray-400">{rule.ds_user_ids.map(memberName).join(', ')}</p>
                          )}
                        </div>
                        <p className="shrink-0 text-base font-semibold tabular-nums text-gray-900">{formatMoney(Number(rule.ft_amount), 2)}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button onClick={() => openEdit(rule)} className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                          Editar
                        </button>
                        {!ended && (
                          <button onClick={() => togglePause(rule)} className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                            {rule.is_active ? 'Pausar' : 'Reanudar'}
                          </button>
                        )}
                        <button onClick={() => remove(rule)} className="rounded-lg border border-red-100 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                          Eliminar
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
