'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getAllCategoriesByFamily,
  getSubcategoriesByCategory,
  type Category,
  type Subcategory,
} from '@/lib/categories'
import { getFamilyMembers, type FamilyMember } from '@/lib/family'
import {
  getBudgetSubtypes,
  getBudgetTypes,
  getUserBudgetHistory,
  saveUserBudgetVersion,
  getSubcategoryBudgetDefaults,
  deleteCategoryBudgetDefaults,
  deleteSubcategoryBudgetDefault,
  upsertSubcategoryBudgetDefault,
  type BudgetSubtype,
  type BudgetType,
  type CurrentUserBudget,
  type SubcategoryBudgetDefault,
} from '@/lib/budgets'
import { getBudgetPlans, planInForce, saveBudgetPlan, type BudgetPlan } from '@/lib/budget-plans'
import BudgetsOverview from './BudgetsOverview'
import BudgetCloseModal from './BudgetCloseModal'
import { useBudgetAnalyticsData } from './budget-analytics/common'
import { useBalanceExtras } from './budget-analytics/useBalanceExtras'
import { closableMonths, balanceFromAnalytics, upcomingPeriodEnd, type UserBalance } from '@/lib/budget-balance'
import { lastCloseMonth, saveBudgetClose, undoLastBudgetClose } from '@/lib/budget-closes'
import { currentMonthKey } from '@/lib/budget-calculator'
import { monthLabel } from '@/lib/budget-analytics'
import PartidasManager from './PartidasManager'

interface BudgetsManagerProps {
  idFamily: string
  idUser?: string
}

export default function BudgetsManager({ idFamily, idUser }: BudgetsManagerProps) {
  const [budgetTypes, setBudgetTypes] = useState<BudgetType[]>([])
  const [plans, setPlans] = useState<BudgetPlan[]>([])
  const [subtypes, setSubtypes] = useState<BudgetSubtype[]>([])
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState<
    Record<string, Subcategory[]>
  >({})
  const [defaults, setDefaults] = useState<SubcategoryBudgetDefault[]>([])
  const [budgetHistory, setBudgetHistory] = useState<CurrentUserBudget[]>([])
  const [expandedDefaultCategories, setExpandedDefaultCategories] = useState<Set<string>>(
    new Set()
  )
  const [loading, setLoading] = useState(true)
  const [savingDefault, setSavingDefault] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [closingUser, setClosingUser] = useState<string | null>(null)
  const analytics = useBudgetAnalyticsData(idFamily)
  const balanceExtras = useBalanceExtras(idFamily)
  const nowMonth = currentMonthKey()
  const [error, setError] = useState<string | null>(null)
  const defaultBySubcategory = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of defaults) {
      map.set(item.id_subcategory, item.id_budget_type)
    }
    return map
  }, [defaults])

  // `silent`: recarga sin sustituir la pantalla por el aviso de carga (evita el parpadeo al editar partidas)
  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      setError(null)

      const [
        budgetTypesData,
        membersData,
        budgetHistoryData,
        defaultsData,
        categoriesData,
        plansData,
        subtypesData,
      ] = await Promise.all([
        getBudgetTypes(supabase, idFamily),
        getFamilyMembers(supabase, idFamily),
        getUserBudgetHistory(supabase, idFamily),
        getSubcategoryBudgetDefaults(supabase, idFamily),
        getAllCategoriesByFamily(supabase, idFamily),
        getBudgetPlans(supabase, idFamily),
        getBudgetSubtypes(supabase, idFamily),
      ])

      const expenseCategories = categoriesData.filter((category) => category.is_expense)
      const subcategoryEntries = await Promise.all(
        expenseCategories.map(async (category) => [
          category.id_category,
          await getSubcategoriesByCategory(supabase, category.id_category),
        ] as const)
      )

      setBudgetTypes(budgetTypesData)
      setPlans(plansData.plans)
      setSubtypes(subtypesData.subtypes)
      setFamilyMembers(membersData)
      setBudgetHistory(budgetHistoryData)
      setDefaults(defaultsData)
      setCategories(expenseCategories)
      setSubcategoriesByCategory(Object.fromEntries(subcategoryEntries))
    } catch (err) {
      console.error('Error al cargar presupuestos:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [idFamily])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDefaultChange = async (idSubcategory: string, idBudgetType: string) => {
    try {
      setSavingDefault(idSubcategory)
      setError(null)
      setMessage(null)
      if (!idBudgetType) {
        await deleteSubcategoryBudgetDefault(supabase, {
          idFamily,
          idSubcategory,
        })
        setDefaults((prev) =>
          prev.filter((item) => item.id_subcategory !== idSubcategory)
        )
        setMessage('Default de subcategoría eliminado')
        return
      }

      await upsertSubcategoryBudgetDefault(supabase, {
        idFamily,
        idSubcategory,
        idBudgetType,
      })
      setDefaults((prev) => [
        ...prev.filter((item) => item.id_subcategory !== idSubcategory),
        {
          id_rel_subcategory_budget_type: crypto.randomUUID(),
          id_family: idFamily,
          id_subcategory: idSubcategory,
          id_budget_type: idBudgetType,
          dt_created: new Date().toISOString(),
          dt_updated: new Date().toISOString(),
        },
      ])
      setMessage('Default de subcategoría guardado')
    } catch (err) {
      console.error('Error al guardar default:', err)
      setError(err instanceof Error ? err.message : 'Error al guardar default')
    } finally {
      setSavingDefault(null)
    }
  }

  const handleCategoryDefaultChange = async (
    idCategory: string,
    idBudgetType: string
  ) => {
    const subcategories = subcategoriesByCategory[idCategory] || []
    try {
      setError(null)
      setMessage(null)

      if (!idBudgetType) {
        await deleteCategoryBudgetDefaults(supabase, {
          idFamily,
          idSubcategoryList: subcategories.map(
            (subcategory) => subcategory.id_subcategory
          ),
        })
        setDefaults((prev) =>
          prev.filter(
            (item) =>
              !subcategories.some(
                (subcategory) => subcategory.id_subcategory === item.id_subcategory
              )
          )
        )
        setMessage('Defaults eliminados de toda la vertical')
        return
      }

      await Promise.all(
        subcategories.map((subcategory) =>
          upsertSubcategoryBudgetDefault(supabase, {
            idFamily,
            idSubcategory: subcategory.id_subcategory,
            idBudgetType,
          })
        )
      )
      setDefaults((prev) => [
        ...prev.filter(
          (item) =>
            !subcategories.some(
              (subcategory) => subcategory.id_subcategory === item.id_subcategory
            )
        ),
        ...subcategories.map((subcategory) => ({
          id_rel_subcategory_budget_type: crypto.randomUUID(),
          id_family: idFamily,
          id_subcategory: subcategory.id_subcategory,
          id_budget_type: idBudgetType,
          dt_created: new Date().toISOString(),
          dt_updated: new Date().toISOString(),
        })),
      ])
      setMessage('Default aplicado a toda la vertical')
    } catch (err) {
      console.error('Error al guardar defaults de vertical:', err)
      setError(err instanceof Error ? err.message : 'Error al guardar defaults')
    }
  }

  // Valor común de la vertical: el id de la partida si todas las subcategorías
  // comparten la misma, 'mixed' si hay varias (o alguna sin asignar) y '' si ninguna tiene.
  const categoryDefaultValue = (idCategory: string): string => {
    const subcategories = subcategoriesByCategory[idCategory] || []
    if (subcategories.length === 0) return ''
    const values = subcategories.map(
      (subcategory) => defaultBySubcategory.get(subcategory.id_subcategory) || ''
    )
    const unique = new Set(values)
    if (unique.size === 1) return values[0]
    return 'mixed'
  }

  const toggleDefaultCategory = (idCategory: string) => {
    setExpandedDefaultCategories((prev) => {
      const next = new Set(prev)
      if (next.has(idCategory)) {
        next.delete(idCategory)
      } else {
        next.add(idCategory)
      }
      return next
    })
  }

  const { allocations, closes, plans: extraPlans, subtypes: extraSubtypes } = balanceExtras.extras
  const balances = useMemo(() => {
    const map = new Map<string, UserBalance>()
    if (!analytics.data || !balanceExtras.loaded) return map
    for (const member of familyMembers) {
      map.set(member.id_user, balanceFromAnalytics(analytics.data, { allocations, closes, plans: extraPlans, subtypes: extraSubtypes }, member.id_user, nowMonth))
    }
    return map
  }, [analytics.data, balanceExtras.loaded, allocations, closes, extraPlans, extraSubtypes, familyMembers, nowMonth])

  if (loading) {
    return <p className="text-gray-600">Cargando presupuestos...</p>
  }

  // Saldos y cierre: solo cuando ya están cargados los movimientos
  const balanceOf = (idUser: string): UserBalance | null => balances.get(idUser) ?? null
  const closeInfo = (idUser: string) => {
    const balance = balanceOf(idUser)
    const periodEnd = upcomingPeriodEnd(budgetHistory.filter((v) => v.is_active), idUser, nowMonth)
    const closable = Boolean(balance) && balanceExtras.closesAvailable && closableMonths(budgetHistory, idUser, balance?.openCycleStart ?? null, nowMonth).length > 0
    return {
      closable,
      hint: periodEnd
        ? `Disponible cuando termine el periodo (${monthLabel(periodEnd, true).toLowerCase()})`
        : 'Disponible cuando el presupuesto tenga fecha de fin y esta pase',
      lastClose: lastCloseMonth(balanceExtras.closes, idUser),
    }
  }
  const reloadBalances = async () => {
    await Promise.all([analytics.reload(), balanceExtras.reload()])
  }
  const undoClose = async (idUser: string) => {
    const last = lastCloseMonth(balanceExtras.closes, idUser)
    if (!last) return
    if (!window.confirm(`¿Deshacer el cierre de ${monthLabel(last, true).toLowerCase()}? Los saldos volverán a como estaban antes.`)) return
    try {
      await undoLastBudgetClose(supabase, { idFamily, idUser, closeMonth: last })
      await reloadBalances()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo deshacer el cierre')
    }
  }
  /** Cambia el importe de una partida del presupuesto vigente sin pasar por la calculadora */
  const editPartidaAmount = async (params: { idUser: string; idBudgetType: string; amount: number; startMonth: string }) => {
    const current = budgetHistory.find(
      (version) =>
        version.is_active &&
        version.id_user === params.idUser &&
        version.id_budget_type === params.idBudgetType &&
        version.dt_start_month === params.startMonth
    )
    await saveUserBudgetVersion(supabase, {
      idFamily,
      idUser: params.idUser,
      idBudgetType: params.idBudgetType,
      amount: params.amount,
      startMonth: params.startMonth,
      comments: current?.ds_comments ?? null,
    })
    // La foto de la calculadora guarda los importes retocados a mano: así, al abrirla, no vuelve al valor anterior
    const plan = planInForce(plans, params.idUser, params.startMonth.slice(0, 7))
    if (plan) {
      try {
        await saveBudgetPlan(supabase, {
          idFamily,
          idUser: params.idUser,
          startMonth: plan.dt_start_month,
          plan: { ...plan.plan, manualAmounts: { ...(plan.plan.manualAmounts ?? {}), [params.idBudgetType]: String(params.amount) } },
        })
      } catch (err) {
        console.warn('No se pudo actualizar el plan guardado:', err)
      }
    }
    await loadData(true)
    await reloadBalances()
  }
  const closingMember = closingUser ? familyMembers.find((member) => member.id_user === closingUser) : null

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-800">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {message}
        </div>
      )}

      <BudgetsOverview
          idFamily={idFamily}
          idUser={idUser}
          versions={budgetHistory}
          budgetTypes={budgetTypes}
          subtypes={subtypes}
          plans={plans}
          members={familyMembers}
          balanceOf={balanceOf}
          closeInfo={closeInfo}
          onClosePeriod={setClosingUser}
          onUndoClose={undoClose}
          onEditAmount={editPartidaAmount}
      />

      {closingUser && closingMember && analytics.data && (
        <BudgetCloseModal
          name={closingMember.ds_user || closingMember.ds_email || 'Persona'}
          months={closableMonths(budgetHistory, closingUser, balanceOf(closingUser)?.openCycleStart ?? null, nowMonth)}
          balanceFor={(month) => balanceFromAnalytics(analytics.data!, balanceExtras.extras, closingUser, month, false)}
          periodicityOf={(id) => budgetTypes.find((type) => type.id_budget_type === id)?.ds_periodicity}
          onCancel={() => setClosingUser(null)}
          onConfirm={async (month, rows) => {
            await saveBudgetClose(supabase, { idFamily, idUser: closingUser, closeMonth: month, rows })
            setClosingUser(null)
            await reloadBalances()
          }}
        />
      )}

      <PartidasManager idFamily={idFamily} onChanged={() => loadData(true)} />

      <section className="space-y-4 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Defaults por subcategoría</h3>
          <p className="text-sm text-gray-600">
            Al crear un gasto, la subcategoría propondrá esta partida de presupuesto.
          </p>
        </div>

        <div className="space-y-4">
          {categories.map((category) => (
            <div key={category.id_category} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 transition-colors hover:bg-gray-50">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => toggleDefaultCategory(category.id_category)}
                  className="text-left"
                >
                  <h4 className="font-semibold text-gray-900">{category.ds_category}</h4>
                  <p className="text-xs text-gray-500">
                    {(subcategoriesByCategory[category.id_category] || []).length} subcategorías
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#0d9488]">
                    {expandedDefaultCategories.has(category.id_category)
                      ? 'Ocultar subcategorías'
                      : 'Ver subcategorías'}
                  </p>
                </button>

                <label className="text-sm font-medium text-gray-700">
                  Aplicar a toda la vertical
                  <select
                    value={categoryDefaultValue(category.id_category)}
                    onChange={(event) =>
                      handleCategoryDefaultChange(category.id_category, event.target.value)
                    }
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base text-gray-900 shadow-sm focus:border-[#0d9488] focus:outline-none focus:ring-[#0d9488]"
                  >
                    {categoryDefaultValue(category.id_category) === 'mixed' && (
                      <option value="mixed" disabled>
                        Mixto (varias partidas)
                      </option>
                    )}
                    <option value="">Sin asignar</option>
                    {budgetTypes.map((budgetType) => (
                      <option
                        key={budgetType.id_budget_type}
                        value={budgetType.id_budget_type}
                      >
                        {budgetType.ds_budget_type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {expandedDefaultCategories.has(category.id_category) && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {(subcategoriesByCategory[category.id_category] || []).map((subcategory) => (
                    <label
                      key={subcategory.id_subcategory}
                      className="flex flex-col gap-1 text-sm font-medium text-gray-700"
                    >
                      {subcategory.ds_subcategory}
                      <select
                        value={defaultBySubcategory.get(subcategory.id_subcategory) || ''}
                        onChange={(event) =>
                          handleDefaultChange(subcategory.id_subcategory, event.target.value)
                        }
                        disabled={savingDefault === subcategory.id_subcategory}
                        className="rounded-xl border border-gray-300 px-3 py-2.5 text-base text-gray-900 shadow-sm focus:border-[#0d9488] focus:outline-none focus:ring-[#0d9488] disabled:bg-gray-100"
                      >
                        <option value="">Sin asignar</option>
                        {budgetTypes.map((budgetType) => (
                          <option
                            key={budgetType.id_budget_type}
                            value={budgetType.id_budget_type}
                          >
                            {budgetType.ds_budget_type}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
