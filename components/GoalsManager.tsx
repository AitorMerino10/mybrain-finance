'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  getAllCategoriesByFamily,
  getSubcategoriesByCategory,
  type Category,
  type Subcategory,
} from '@/lib/categories'
import { getFamilyMembers, type FamilyMember } from '@/lib/family'
import {
  getBudgetTypes,
  getCurrentUserBudgets,
  getSubcategoryBudgetDefaults,
  type BudgetType,
  type CurrentUserBudget,
} from '@/lib/budgets'
import {
  addMonths,
  currentMonthKey,
  fetchCalculatorTransactions,
  formatMoney,
  getScopedAmount,
  lastCompleteMonths,
  monthRange,
  parseNumber,
  type CalcTransaction,
} from '@/lib/budget-calculator'
import {
  calculateGoalProgress,
  createSpendingGoal,
  dateToMonth,
  deleteSpendingGoal,
  getSpendingGoals,
  updateSpendingGoal,
  type GoalProgress,
  type GoalStatus,
  type SpendingGoal,
} from '@/lib/goals'

type GoalForm = {
  id: string | null
  target: string
  periodicity: 'monthly' | 'annual'
  amount: string
  startMonth: string
  endMonth: string
  comments: string
}

type GoalItem = { goal: SpendingGoal; progress: GoalProgress; partidaKey: string }

const MULTI = 'multi'
const NONE = 'none'

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]'

const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const monthLabel = (month: string) => {
  const [year, monthNumber] = month.split('-')
  return `${MONTH_NAMES[Number(monthNumber) - 1]} ${year}`
}

const emptyForm = (): GoalForm => {
  const start = currentMonthKey()
  return {
    id: null,
    target: '',
    periodicity: 'monthly',
    amount: '',
    startMonth: start,
    endMonth: addMonths(start, 11),
    comments: '',
  }
}

export default function GoalsManager({
  idFamily,
  idUser,
}: {
  idFamily: string
  idUser: string
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Record<string, Subcategory[]>>({})
  const [goals, setGoals] = useState<SpendingGoal[]>([])
  const [transactions, setTransactions] = useState<CalcTransaction[]>([])
  const [budgetTypes, setBudgetTypes] = useState<BudgetType[]>([])
  const [budgets, setBudgets] = useState<CurrentUserBudget[]>([])
  const [defaultsBySub, setDefaultsBySub] = useState<Map<string, string>>(new Map())
  const [selectedUser, setSelectedUser] = useState(idUser)
  const [form, setForm] = useState<GoalForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [membersData, categoriesData, goalsData, txs, typesData, budgetsData, defaultsData] = await Promise.all([
        getFamilyMembers(supabase, idFamily),
        getAllCategoriesByFamily(supabase, idFamily),
        getSpendingGoals(supabase, { idFamily }),
        fetchCalculatorTransactions(idFamily),
        getBudgetTypes(supabase, idFamily),
        getCurrentUserBudgets(supabase, idFamily),
        getSubcategoryBudgetDefaults(supabase, idFamily),
      ])
      const expenseCategories = categoriesData.filter((category) => category.is_expense)
      const entries = await Promise.all(
        expenseCategories.map(
          async (category) =>
            [category.id_category, await getSubcategoriesByCategory(supabase, category.id_category)] as const
        )
      )
      setMembers(membersData)
      setCategories(expenseCategories)
      setSubcategories(Object.fromEntries(entries))
      setGoals(goalsData)
      setTransactions(txs)
      setBudgetTypes(typesData)
      setBudgets(budgetsData)
      setDefaultsBySub(new Map(defaultsData.map((item) => [item.id_subcategory, item.id_budget_type])))
    } catch (err) {
      console.error('Error al cargar controles:', err)
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message
      setError(message || 'Error al cargar los controles')
    } finally {
      setLoading(false)
    }
  }, [idFamily])

  useEffect(() => {
    loadData()
  }, [loadData])

  const targetLabels = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories) {
      map.set(`cat:${category.id_category}`, category.ds_category)
      for (const sub of subcategories[category.id_category] || []) {
        map.set(`sub:${sub.id_subcategory}`, `${category.ds_category} · ${sub.ds_subcategory}`)
      }
    }
    return map
  }, [categories, subcategories])

  const goalTargetKey = (goal: SpendingGoal) =>
    goal.id_subcategory ? `sub:${goal.id_subcategory}` : `cat:${goal.id_category}`

  /** Partida a la que pertenece el control: la de su subcategoría, o la de las subcategorías de su categoría. */
  const partidaKeyFor = useCallback(
    (goal: SpendingGoal): string => {
      if (goal.id_subcategory) return defaultsBySub.get(goal.id_subcategory) ?? NONE
      const ids = new Set<string>()
      for (const sub of subcategories[goal.id_category || ''] || []) {
        const typeId = defaultsBySub.get(sub.id_subcategory)
        if (typeId) ids.add(typeId)
      }
      return ids.size === 0 ? NONE : ids.size === 1 ? Array.from(ids)[0] : MULTI
    },
    [defaultsBySub, subcategories]
  )

  const items = useMemo<GoalItem[]>(
    () =>
      goals
        .filter((goal) => goal.id_user === selectedUser)
        .map((goal) => ({
          goal,
          progress: calculateGoalProgress(goal, transactions, selectedUser),
          partidaKey: partidaKeyFor(goal),
        }))
        .sort((a, b) => {
          const rank = (item: GoalItem) =>
            item.progress.isFinished ? 3 : item.progress.isUpcoming ? 2 : item.progress.status === 'over' ? 0 : 1
          return rank(a) - rank(b) || b.goal.dt_start_month.localeCompare(a.goal.dt_start_month)
        }),
    [goals, transactions, selectedUser, partidaKeyFor]
  )

  const activeItems = items.filter((item) => !item.progress.isFinished && !item.progress.isUpcoming)

  const groups = useMemo(() => {
    const result: Array<{ key: string; type: BudgetType | null; items: GoalItem[] }> = []
    for (const type of budgetTypes) {
      const groupItems = items.filter((item) => item.partidaKey === type.id_budget_type)
      if (groupItems.length > 0) result.push({ key: type.id_budget_type, type, items: groupItems })
    }
    for (const key of [MULTI, NONE]) {
      const groupItems = items.filter((item) => item.partidaKey === key)
      if (groupItems.length > 0) result.push({ key, type: null, items: groupItems })
    }
    return result
  }, [budgetTypes, items])

  // Media histórica (últimos 12 meses completos) del control que se está editando, como ayuda
  const historicHint = useMemo(() => {
    if (!form?.target) return null
    const { from, to } = lastCompleteMonths(12)
    const months = new Set(monthRange(from, to))
    const [kind, id] = form.target.split(':')
    let total = 0
    for (const tx of transactions) {
      if (tx.type !== 'Expense' || !months.has(tx.ds_month_declared)) continue
      const matches = kind === 'sub' ? tx.id_subcategory === id : tx.id_category === id
      if (!matches) continue
      total += getScopedAmount(tx, selectedUser)
    }
    return { monthly: Math.round(total / 12), annual: Math.round(total) }
  }, [form?.target, transactions, selectedUser])

  const openNew = () => {
    setFormError(null)
    setForm(emptyForm())
  }

  const openEdit = (goal: SpendingGoal) => {
    setFormError(null)
    setForm({
      id: goal.id_spending_goal,
      target: goalTargetKey(goal),
      periodicity: goal.ds_periodicity as 'monthly' | 'annual',
      amount: String(goal.ft_goal_amount),
      startMonth: dateToMonth(goal.dt_start_month),
      endMonth: dateToMonth(goal.dt_end_month),
      comments: goal.ds_comments || '',
    })
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!form) return
    if (!form.target) return setFormError('Elige una categoría o subcategoría')
    if (parseNumber(form.amount) <= 0) return setFormError('Introduce un importe mayor que 0')
    if (form.endMonth < form.startMonth) return setFormError('El fin del periodo no puede ser anterior al inicio')

    const [kind, id] = form.target.split(':')
    try {
      setSaving(true)
      setFormError(null)
      const params = {
        idFamily,
        idUser: selectedUser,
        idCategory: kind === 'cat' ? id : null,
        idSubcategory: kind === 'sub' ? id : null,
        periodicity: form.periodicity,
        amount: parseNumber(form.amount),
        startMonth: form.startMonth,
        endMonth: form.endMonth,
        comments: form.comments,
      }
      if (form.id) await updateSpendingGoal(supabase, form.id, params)
      else await createSpendingGoal(supabase, params)
      setForm(null)
      setGoals(await getSpendingGoals(supabase, { idFamily }))
    } catch (err) {
      console.error('Error al guardar control:', err)
      setFormError((err as { message?: string })?.message || 'Error al guardar el control')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (goal: SpendingGoal) => {
    if (!window.confirm('¿Eliminar este control?')) return
    try {
      await deleteSpendingGoal(supabase, goal.id_spending_goal)
      setGoals(await getSpendingGoals(supabase, { idFamily }))
    } catch (err) {
      setError((err as { message?: string })?.message || 'Error al eliminar el control')
    }
  }

  const memberName = (member: FamilyMember) => member.ds_user || member.ds_email
  const selectedMember = members.find((member) => member.id_user === selectedUser)

  // ---------- Fila de control (solo definición; el seguimiento está en Inicio y Analítica) ----------
  const renderCard = ({ goal, progress }: GoalItem) => {
    const monthly = goal.ds_periodicity === 'monthly'
    const state = progress.isUpcoming ? 'Próximo' : progress.isFinished ? 'Cerrado' : 'Vigente'

    return (
      <article
        key={goal.id_spending_goal}
        className="flex items-start justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-4"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-gray-900">
              {targetLabels.get(goalTargetKey(goal)) || 'Categoría eliminada'}
            </h4>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                state === 'Vigente' ? 'bg-[#90EBD6]/40 text-teal-800' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {state}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-gray-700">
            <strong className="tabular-nums">{formatMoney(goal.ft_goal_amount)}</strong>{' '}
            {monthly ? 'al mes' : 'en el periodo'}
            <span className="text-gray-400">
              {' '}
              · {monthLabel(dateToMonth(goal.dt_start_month))} → {monthLabel(dateToMonth(goal.dt_end_month))} (
              {progress.totalMonths} meses)
            </span>
          </p>
          {goal.ds_comments && <p className="mt-1 text-sm italic text-gray-500">“{goal.ds_comments}”</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => openEdit(goal)}
            className="rounded-lg px-2 py-1 font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => handleDelete(goal)}
            className="rounded-lg px-2 py-1 font-medium text-gray-400 hover:bg-red-50 hover:text-red-600"
          >
            Eliminar
          </button>
        </div>
      </article>
    )
  }

  // ---------- Cabecera de partida ----------
  const renderGroupHeader = (group: { key: string; type: BudgetType | null; items: GoalItem[] }) => {
    if (!group.type) {
      return (
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {group.key === MULTI ? 'Varias partidas' : 'Sin partida'}
          </h3>
          <p className="text-sm text-gray-500">
            {group.key === MULTI
              ? 'Categorías cuyas subcategorías están en partidas distintas.'
              : 'Su categoría o subcategoría aún no está asignada a ninguna partida.'}
          </p>
        </div>
      )
    }

    const type = group.type
    const monthlyType = type.ds_periodicity === 'monthly'
    const unit = monthlyType ? '/mes' : '/año'
    const budget = budgets.find((item) => item.id_user === selectedUser && item.id_budget_type === type.id_budget_type)
    const budgetAmount = budget?.ft_budget_amount ?? 0

    // Controles vigentes, llevados a la unidad de la partida
    const controlsInUnit = group.items
      .filter((item) => !item.progress.isFinished && !item.progress.isUpcoming)
      .reduce((sum, item) => {
        const perMonth =
          item.goal.ds_periodicity === 'monthly'
            ? item.goal.ft_goal_amount
            : item.goal.ft_goal_amount / item.progress.totalMonths
        return sum + (monthlyType ? perMonth : perMonth * 12)
      }, 0)
    const occupancyPct = budgetAmount > 0 ? (controlsInUnit / budgetAmount) * 100 : 0
    const controlsExceed = budgetAmount > 0 && controlsInUnit > budgetAmount

    return (
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold text-gray-900">
            {type.ds_budget_type}{' '}
            <span className="text-xs font-normal text-gray-400">{monthlyType ? 'Mensual' : 'Anual'}</span>
          </h3>
          {budgetAmount > 0 ? (
            <span className="text-sm text-gray-600">
              Presupuesto: <strong className="tabular-nums text-gray-900">{formatMoney(budgetAmount)}</strong>
              {unit}
            </span>
          ) : (
            <span className="text-sm text-amber-700">Sin presupuesto definido para esta partida</span>
          )}
        </div>

        {budgetAmount > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Controles vigentes dentro de la partida</span>
              <span className={`tabular-nums ${controlsExceed ? 'font-semibold text-red-600' : ''}`}>
                {formatMoney(controlsInUnit)}
                {unit} ({occupancyPct.toFixed(0)}%)
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${controlsExceed ? 'bg-red-500' : 'bg-gray-400'}`}
                style={{ width: `${Math.min(occupancyPct, 100)}%` }}
              />
            </div>
          </div>
        )}
        {controlsExceed && (
          <p className="mt-2 text-xs text-red-600">
            Los controles de esta partida suman más que su presupuesto: revisa si caben juntos.
          </p>
        )}
      </div>
    )
  }

  return (
    <section id="objetivos" className="scroll-mt-24 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Controles de gasto</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Vigilan una categoría o subcategoría dentro de su partida. Puedes ir bien en el presupuesto de Vida y aun así
            estar abusando de algo concreto, como comer fuera. No suman en el cuadre del presupuesto.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Aquí los defines; el seguimiento lo ves en{' '}
            <Link href={`/?family=${idFamily}`} className="font-medium text-[#0d9488] hover:underline">
              Inicio
            </Link>{' '}
            y en{' '}
            <Link href={`/analytics?family=${idFamily}&tab=budgets`} className="font-medium text-[#0d9488] hover:underline">
              Analítica → Presupuestos
            </Link>
            .
          </p>
        </div>
        <div className="flex items-end gap-3">
          {members.length > 1 && (
            <label className="block text-xs font-medium text-gray-500">
              Persona
              <select
                value={selectedUser}
                onChange={(event) => setSelectedUser(event.target.value)}
                className={`${inputClass} mt-1 w-44`}
              >
                {members.map((member) => (
                  <option key={member.id_user} value={member.id_user}>
                    {memberName(member)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={openNew}
            className="rounded-xl bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            + Nuevo control
          </button>
        </div>
      </div>

      {loading && <p className="mt-6 text-sm text-gray-500">Cargando controles…</p>}
      {error && (
        <p className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
          {/schema cache|does not exist|pml_cfg_spending_goal/i.test(error) &&
            ' — ¿has ejecutado la migración de controles en Supabase?'}
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
          Todavía no hay controles para esta persona. Crea uno, por ejemplo “Comida fuera · 2.000 € al año” o “Ocio · 300
          €/mes”.
        </div>
      )}

      <div className="mt-6 space-y-8">
        {groups.map((group) => (
          <div key={group.key} className="space-y-4">
            {renderGroupHeader(group)}
            <div className="space-y-3">{group.items.map(renderCard)}</div>
          </div>
        ))}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{form.id ? 'Editar control' : 'Nuevo control'}</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Para {selectedMember ? memberName(selectedMember) : 'esta persona'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>

              <label className="block text-sm font-medium text-gray-700">
                Categoría o subcategoría
                <select
                  value={form.target}
                  onChange={(event) => setForm({ ...form, target: event.target.value })}
                  className={`${inputClass} mt-1`}
                >
                  <option value="">Elige…</option>
                  {categories.map((category) => (
                    <optgroup key={category.id_category} label={category.ds_category}>
                      <option value={`cat:${category.id_category}`}>Toda la categoría: {category.ds_category}</option>
                      {(subcategories[category.id_category] || []).map((sub) => (
                        <option key={sub.id_subcategory} value={`sub:${sub.id_subcategory}`}>
                          {sub.ds_subcategory}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <div>
                <span className="block text-sm font-medium text-gray-700">Tipo de control</span>
                <div className="mt-1 inline-flex rounded-xl bg-gray-100 p-1">
                  {(
                    [
                      { value: 'monthly', label: 'Mensual (€ por mes)' },
                      { value: 'annual', label: 'Anual (€ en todo el periodo)' },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setForm({ ...form, periodicity: option.value })}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                        form.periodicity === option.value
                          ? 'bg-white text-[#0d9488] shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Importe del control (€)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.amount}
                    onChange={(event) => setForm({ ...form, amount: event.target.value })}
                    className={`${inputClass} mt-1 w-44`}
                  />
                </label>
                {historicHint && form.target && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    Tu gasto de los últimos 12 meses:{' '}
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          amount: String(form.periodicity === 'monthly' ? historicHint.monthly : historicHint.annual),
                        })
                      }
                      className="font-medium text-[#0d9488] hover:underline"
                    >
                      {formatMoney(historicHint.monthly)}/mes · {formatMoney(historicHint.annual)}/año (usar{' '}
                      {form.periodicity === 'monthly' ? 'mensual' : 'anual'})
                    </button>
                  </p>
                )}
              </div>

              <div>
                <span className="block text-sm font-medium text-gray-700">Periodo de seguimiento</span>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <input
                    type="month"
                    value={form.startMonth}
                    max={form.endMonth}
                    onChange={(event) => event.target.value && setForm({ ...form, startMonth: event.target.value })}
                    className={`${inputClass} w-44`}
                  />
                  <span className="text-gray-400">→</span>
                  <input
                    type="month"
                    value={form.endMonth}
                    min={form.startMonth}
                    onChange={(event) => event.target.value && setForm({ ...form, endMonth: event.target.value })}
                    className={`${inputClass} w-44`}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, endMonth: addMonths(form.startMonth, 11) })}
                    className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:border-[#0d9488] hover:text-[#0d9488]"
                  >
                    12 meses desde el inicio
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, endMonth: `${form.startMonth.slice(0, 4)}-12` })}
                    className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:border-[#0d9488] hover:text-[#0d9488]"
                  >
                    Hasta diciembre
                  </button>
                </div>
              </div>

              <label className="block text-sm font-medium text-gray-700">
                ¿Por qué te pones este control? (opcional)
                <textarea
                  value={form.comments}
                  onChange={(event) => setForm({ ...form, comments: event.target.value })}
                  rows={2}
                  placeholder="Ej: quiero reducir comida fuera a 2 veces por semana"
                  className={`${inputClass} mt-1`}
                />
              </label>

              {formError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{formError}</p>}

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#0d9488] px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando…' : 'Guardar control'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
