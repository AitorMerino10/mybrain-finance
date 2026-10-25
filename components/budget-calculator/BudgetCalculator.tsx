'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getFamilyMembers, type FamilyMember } from '@/lib/family'
import {
  createBudgetSubtype,
  createBudgetType,
  deleteSubcategoryBudgetDefault,
  getBudgetSubtypes,
  getBudgetTypes,
  budgetTypeAppliesTo,
  hasFamilyBudgetTypes,
  updateBudgetType,
  getSubcategoryBudgetDefaults,
  getUserBudgetHistory,
  saveUserBudgetVersion,
  upsertSubcategoryBudgetDefault,
  type BudgetSubtype,
  type BudgetType,
  type CurrentUserBudget,
} from '@/lib/budgets'
import { dateToMonth } from '@/lib/goals'
import {
  getBudgetPlans,
  planInForce,
  saveBudgetPlan,
  type BudgetPlan,
  type BudgetPlanSnapshot,
} from '@/lib/budget-plans'
import {
  buildExpenseGroups,
  buildPeriodRows,
  buildTypeStats,
  distributeAmount,
  currentMonthKey,
  fetchCalculatorTransactions,
  formatMoney,
  lastCompleteMonths,
  monthRange,
  parseNumber,
  round2,
  suggestedAmount,
  type BudgetLine,
  type CalcTransaction,
  type GroupLine,
  type StatMethod,
} from '@/lib/budget-calculator'
import BudgetMatrix from './BudgetMatrix'
import ControlsStep from './ControlsStep'
import ExpensesStep from './ExpensesStep'
import IncomeHistory from './IncomeHistory'
import { buildBreakdownCategories } from './MonthlyBreakdown'
import SummaryPanel, { SavingsControls, type SavingsMode } from './SummaryPanel'

type IncomeItem = { id: string; name: string; amount: string; months: string }
const STEPS = [
  { id: 1, title: 'Periodo e ingresos', hint: 'Cuándo y cuánto entra' },
  { id: 2, title: 'Gastos', hint: 'Qué sueles gastar' },
  { id: 3, title: 'Resumen y ahorro', hint: 'Si llegas' },
  { id: 4, title: 'Controles', hint: 'Vigilar verticales' },
  { id: 5, title: 'Guardar', hint: 'Aplicar presupuestos' },
]

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]'

const HISTORIC_INCOME_NAME = 'Ingresos históricos (media)'

function nextMonthKey(month: string): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
function previousMonthKey(month: string): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

let idCounter = 0
const newId = () => `item-${Date.now()}-${idCounter++}`

function IncomeList({
  title,
  description,
  items,
  onChange,
  showMonths,
  monthsLabel,
  addLabel,
  defaultName,
  defaultMonths,
  monthsPlaceholder,
  totalFor,
}: {
  title: string
  description: string
  items: IncomeItem[]
  onChange: (items: IncomeItem[]) => void
  showMonths: boolean
  monthsLabel: string
  addLabel: string
  defaultName: string
  defaultMonths: string
  /** Valor que se aplica si se deja vacío el nº de meses */
  monthsPlaceholder?: string
  totalFor: (item: IncomeItem) => number
}) {
  const update = (id: string, patch: Partial<IncomeItem>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))

  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mb-4 text-sm text-gray-500">{description}</p>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="grid items-end gap-3 sm:grid-cols-[1fr_140px_140px_120px_auto]">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Concepto</label>
              <input
                value={item.name}
                onChange={(event) => update(item.id, { name: event.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Importe (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.amount}
                onChange={(event) => update(item.id, { amount: event.target.value })}
                className={inputClass}
              />
            </div>
            {showMonths ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">{monthsLabel}</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={item.months}
                  placeholder={monthsPlaceholder}
                  onChange={(event) => update(item.id, { months: event.target.value })}
                  className={inputClass}
                />
              </div>
            ) : (
              <div />
            )}
            <div className="pb-2 text-right text-sm font-semibold text-gray-900 tabular-nums">
              {formatMoney(totalFor(item))}
            </div>
            <button
              type="button"
              onClick={() => onChange(items.filter((current) => current.id !== item.id))}
              className="pb-2 text-gray-400 hover:text-red-500"
              aria-label="Eliminar"
            >
              ✕
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-400">Sin conceptos todavía.</p>}
      </div>
      <button
        type="button"
        onClick={() =>
          onChange([...items, { id: newId(), name: defaultName, amount: '', months: defaultMonths }])
        }
        className="mt-4 rounded-xl border border-dashed border-[#0d9488] px-4 py-2 text-sm font-medium text-[#0d9488] hover:bg-[#90EBD6]/20"
      >
        + {addLabel}
      </button>
    </section>
  )
}

export default function BudgetCalculator({
  idFamily,
  idUser,
  initialStep = 1,
  startFromSaved = false,
  initialScope,
  initialMonth,
  newStartMonth,
}: {
  idFamily: string
  idUser: string
  /** Paso con el que se abre la calculadora (5 = directamente a guardar/editar) */
  initialStep?: number
  /** Parte de los importes ya guardados para editarlos */
  startFromSaved?: boolean
  /** Persona para la que se abre la calculadora (por defecto, la actual) */
  initialScope?: string
  /** Mes del presupuesto guardado que se quiere editar (por defecto, el vigente hoy) */
  initialMonth?: string
  /** Si se indica, se parte del presupuesto vigente pero como uno NUEVO que empieza en este mes */
  newStartMonth?: string
}) {
  const [step, setStep] = useState(initialStep)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Datos
  const [transactions, setTransactions] = useState<CalcTransaction[]>([])
  const [allBudgetTypes, setBudgetTypes] = useState<BudgetType[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const originalDefaults = useRef<Record<string, string>>({})
  // Alcance y periodo
  const [scope, setScope] = useState<string>(initialScope || idUser)
  const [period, setPeriod] = useState(() => lastCompleteMonths(12))
  const [method, setMethod] = useState<StatMethod>('avg')

  // Ingresos
  const [recurring, setRecurring] = useState<IncomeItem[]>([
    { id: newId(), name: 'Nómina mensual', amount: '', months: '' },
  ])
  const [annualIncomes, setAnnualIncomes] = useState<IncomeItem[]>([])
  const [bonuses, setBonuses] = useState<IncomeItem[]>([])

  // Gastos
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  // Importe fijado a mano por subcategoría (vacío = usar la propuesta)
  const [groupOverrides, setGroupOverrides] = useState<Record<string, string>>({})
  // Total fijado para una vertical y partida (clave `idCategoria|idPartida`). El resto de subcategorías se reparte lo que sobre
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({})
  // Importe puesto directamente a una partida, sin relacionarlo con ninguna vertical (p. ej. un traje de 700 €). Se suma al de sus subcategorías
  const [directAmounts, setDirectAmounts] = useState<Record<string, string>>({})
  // Subpartidas de cada partida (p. ej. Viaje → Esquí, Verano) y su importe (en la unidad de la partida)
  const [subtypes, setSubtypes] = useState<BudgetSubtype[]>([])
  const [subtypesAvailable, setSubtypesAvailable] = useState(true)
  const [subAmounts, setSubAmounts] = useState<Record<string, string>>({})
  const [newSubNames, setNewSubNames] = useState<Record<string, string>>({})

  // Ahorro
  const [savingsMode, setSavingsMode] = useState<SavingsMode>('percent')
  const [savingsValue, setSavingsValue] = useState('10')

  // Guardado
  const [startMonth, setStartMonth] = useState(currentMonthKey())
  // Fecha límite opcional (último mes vigente, inclusive). Vacío = sin fecha límite
  const [endMonth, setEndMonth] = useState('')
  const [budgetHistory, setBudgetHistory] = useState<CurrentUserBudget[]>([])
  // Importe final editado a mano por partida (si no hay entrada, se usa el calculado)
  const [amountOverrides, setAmountOverrides] = useState<Record<string, string>>({})
  // Comentario opcional por partida (vacío por defecto)
  const [commentOverrides, setCommentOverrides] = useState<Record<string, string>>({})
  const savedLoadedRef = useRef(false)
  // Foto de lo configurado en cada guardado (para poder reabrir y editar)
  const [plans, setPlans] = useState<BudgetPlan[]>([])
  const [plansAvailable, setPlansAvailable] = useState(true)
  const [editNotice, setEditNotice] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)
  const [saveRelations, setSaveRelations] = useState(true)
  const [saving, setSaving] = useState(false)
  // Alta rápida de una partida desde el paso de gastos
  const [newPartidaName, setNewPartidaName] = useState('')
  const [newPartidaCadence, setNewPartidaCadence] = useState<'monthly' | 'annual'>('monthly')
  const [addingPartida, setAddingPartida] = useState(false)
  const [partidaError, setPartidaError] = useState<string | null>(null)
  const [partidaFormOpen, setPartidaFormOpen] = useState(false)
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [txs, types, familyMembers, defaults, history, planResult, subResult] = await Promise.all([
        fetchCalculatorTransactions(idFamily),
        getBudgetTypes(supabase, idFamily),
        getFamilyMembers(supabase, idFamily),
        getSubcategoryBudgetDefaults(supabase, idFamily),
        getUserBudgetHistory(supabase, idFamily),
        getBudgetPlans(supabase, idFamily),
        getBudgetSubtypes(supabase, idFamily),
      ])
      setSubtypes(subResult.subtypes)
      setSubtypesAvailable(subResult.available)
      setBudgetHistory(history.filter((item) => item.is_active))
      setPlans(planResult.plans)
      setPlansAvailable(planResult.available)
      setTransactions(txs)
      setBudgetTypes(types)
      setMembers(familyMembers)

      const defaultMap: Record<string, string> = {}
      defaults.forEach((item) => {
        defaultMap[`sub:${item.id_subcategory}`] = item.id_budget_type
      })
      originalDefaults.current = defaultMap
      setAssignments({ ...defaultMap })
    } catch (err) {
      console.error('Error al cargar la calculadora:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [idFamily])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ---------- Periodo del presupuesto ----------
  // Con fecha de fin, el plan dura de inicio a fin (ambos incluidos). Sin ella se calcula sobre 12 meses.
  const hasEndMonth = endMonth !== '' && endMonth >= startMonth
  const planMonthsNumber = hasEndMonth ? Math.max(1, monthRange(startMonth, endMonth).length) : 12
  /** Meses que cubre el importe de una partida "anual": todo el periodo si hay fecha de fin, 12 si no */
  const annualMonths = planMonthsNumber
  const annualUnitLabel = hasEndMonth ? 'periodo' : 'año'

  // ---------- Cálculos ----------
  const scopeUserId = scope === 'family' ? null : scope
  // Solo las partidas que valen para la persona (o que ya tienen un presupuesto suyo guardado)
  const budgetTypes = useMemo(
    () =>
      allBudgetTypes.filter(
        (type) =>
          budgetTypeAppliesTo(type, scopeUserId) ||
          budgetHistory.some((item) => item.id_user === scopeUserId && item.id_budget_type === type.id_budget_type && item.is_active)
      ),
    [allBudgetTypes, scopeUserId, budgetHistory]
  )
  const months = useMemo(() => monthRange(period.from, period.to), [period])
  const monthsCount = months.length

  const [minMonth, maxMonth] = useMemo(() => {
    let min: string | null = null
    let max: string | null = null
    for (const tx of transactions) {
      if (!min || tx.ds_month_declared < min) min = tx.ds_month_declared
      if (!max || tx.ds_month_declared > max) max = tx.ds_month_declared
    }
    return [min, max]
  }, [transactions])

  const rows = useMemo(
    () => buildPeriodRows(transactions, period.from, period.to, scopeUserId),
    [transactions, period, scopeUserId]
  )
  const incomeRows = useMemo(
    () => buildPeriodRows(transactions, period.from, period.to, scopeUserId, 'Income'),
    [transactions, period, scopeUserId]
  )
  const groups = useMemo(() => buildExpenseGroups(rows, months), [rows, months])
  const breakdownCategories = useMemo(
    () => buildBreakdownCategories(groups, monthsCount),
    [groups, monthsCount]
  )
  const typeStats = useMemo(
    () => buildTypeStats(groups, assignments, budgetTypes, monthsCount),
    [groups, assignments, budgetTypes, monthsCount]
  )

  // Presupuesto por subcategoría: propuesta (según método), importe fijado a mano o reparto del total fijado para su vertical
  const groupLines = useMemo(() => {
    const typeById = new Map(budgetTypes.map((item) => [item.id_budget_type, item]))
    const result: Record<string, GroupLine> = {}
    const byCategoryAndType = new Map<string, string[]>()
    for (const group of groups) {
      const type = typeById.get(assignments[group.key]) ?? null
      if (!type) {
        result[group.key] = { type: null, suggestion: 0, amount: 0, overridden: false }
        continue
      }
      const suggestion = suggestedAmount(group.stats, method, type.ds_periodicity, annualMonths)
      const override = groupOverrides[group.key] ?? ''
      result[group.key] = {
        type,
        suggestion,
        amount: override !== '' ? round2(parseNumber(override)) : suggestion,
        overridden: override !== '',
      }
      const categoryKey = `${group.idCategory ?? 'none'}|${type.id_budget_type}`
      byCategoryAndType.set(categoryKey, [...(byCategoryAndType.get(categoryKey) || []), group.key])
    }

    // Total fijado por vertical: lo que no han fijado las subcategorías se reparte entre el resto
    byCategoryAndType.forEach((keys, categoryKey) => {
      const raw = categoryOverrides[categoryKey]
      if (raw === undefined || raw === '') return
      const total = round2(parseNumber(raw))
      const free = keys.filter((key) => !result[key].overridden)
      if (free.length === 0) return
      const pinned = keys.filter((key) => result[key].overridden).reduce((sum, key) => sum + result[key].amount, 0)
      const shares = distributeAmount(Math.max(0, total - pinned), free.map((key) => result[key].suggestion))
      free.forEach((key, index) => {
        result[key] = { ...result[key], amount: shares[index], fromCategory: true }
      })
    })
    return result
  }, [groups, assignments, budgetTypes, method, groupOverrides, categoryOverrides, annualMonths])

  const subsByType = useMemo(() => {
    const map = new Map<string, BudgetSubtype[]>()
    for (const sub of subtypes) map.set(sub.id_budget_type, [...(map.get(sub.id_budget_type) || []), sub])
    return map
  }, [subtypes])
  /** Importe que se suma a una partida sin pasar por verticales: sus subpartidas más la cantidad adicional */
  const extraOf = (idBudgetType: string) =>
    parseNumber(directAmounts[idBudgetType]) +
    (subsByType.get(idBudgetType) || []).reduce((sum, sub) => sum + parseNumber(subAmounts[sub.id_budget_subtype]), 0)

  // Presupuesto por partida = suma de sus subcategorías + subpartidas + cantidad adicional
  const budgetLines = useMemo<BudgetLine[]>(
    () =>
      budgetTypes.map((type) => {
        const stats = typeStats.byType[type.id_budget_type]
        const lines = Object.values(groupLines).filter(
          (line) => line.type?.id_budget_type === type.id_budget_type
        )
        const amount = round2(
          lines.reduce((sum, line) => sum + line.amount, 0) + extraOf(type.id_budget_type)
        )
        return {
          type,
          stats,
          typeSuggestion: suggestedAmount(stats, method, type.ds_periodicity, annualMonths),
          amount,
          wasOverridden: lines.some((line) => line.overridden),
          monthlyEquivalent: type.ds_periodicity === 'monthly' ? amount : amount / annualMonths,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [budgetTypes, typeStats, groupLines, method, annualMonths, directAmounts, subAmounts, subsByType]
  )

  const committedMonthly = budgetLines.reduce((sum, line) => sum + line.monthlyEquivalent, 0)

  // Ingresos
  // Meses de cada ingreso: si se deja vacío son todos los del periodo
  const monthsOf = (item: IncomeItem) => (item.months !== '' ? parseNumber(item.months) : planMonthsNumber)
  const recurringTotal = (item: IncomeItem) => parseNumber(item.amount) * monthsOf(item)
  const annualTotal = (item: IncomeItem) => parseNumber(item.amount) * (planMonthsNumber / 12)
  const incomeTotal =
    recurring.reduce((sum, item) => sum + recurringTotal(item), 0) +
    annualIncomes.reduce((sum, item) => sum + annualTotal(item), 0) +
    bonuses.reduce((sum, item) => sum + recurringTotal(item), 0)
  const incomeMonthly = incomeTotal / planMonthsNumber

  // Ahorro
  const availableMonthly = incomeMonthly - committedMonthly
  const savingsInput = parseNumber(savingsValue)
  const savingsTargetMonthly =
    savingsMode === 'percent'
      ? (incomeMonthly * savingsInput) / 100
      : savingsMode === 'amount'
        ? savingsInput
        : null
  const savingsRate = incomeMonthly > 0 ? (availableMonthly / incomeMonthly) * 100 : 0
  const reachesTarget = savingsTargetMonthly === null ? null : availableMonthly >= savingsTargetMonthly
  const maxBudgetForTarget = savingsTargetMonthly === null ? null : incomeMonthly - savingsTargetMonthly

  // ---------- Handlers ----------
  const handleAddSubtype = async (idBudgetType: string) => {
    const name = newSubNames[idBudgetType] ?? ''
    if (!name.trim()) return
    try {
      setAddingPartida(true)
      setPartidaError(null)
      await createBudgetSubtype(supabase, { idFamily, idBudgetType, name })
      setSubtypes((await getBudgetSubtypes(supabase, idFamily)).subtypes)
      setNewSubNames((current) => ({ ...current, [idBudgetType]: '' }))
      setAddingSubFor(null)
    } catch (err) {
      setPartidaError(err instanceof Error ? err.message : 'No se pudo crear la subpartida')
    } finally {
      setAddingPartida(false)
    }
  }

  /** Quita una partida de la calculadora (se archiva: su histórico se conserva) */
  const handleRemovePartida = async (type: BudgetType) => {
    if (!window.confirm(`¿Quitar la partida "${type.ds_budget_type}"? Se archiva: dejará de aparecer, pero su histórico se conserva.`)) return
    try {
      setAddingPartida(true)
      setPartidaError(null)
      await updateBudgetType(supabase, { idBudgetType: type.id_budget_type, archived: true })
      setBudgetTypes(await getBudgetTypes(supabase, idFamily))
      const forget = (current: Record<string, string>) => {
        const next = { ...current }
        delete next[type.id_budget_type]
        return next
      }
      setDirectAmounts(forget)
      setAmountOverrides(forget)
      setCommentOverrides(forget)
    } catch (err) {
      setPartidaError(err instanceof Error ? err.message : 'No se pudo quitar la partida')
    } finally {
      setAddingPartida(false)
    }
  }

  const handleAddPartida = async () => {
    try {
      setAddingPartida(true)
      setPartidaError(null)
      await createBudgetType(supabase, { idFamily, name: newPartidaName, periodicity: newPartidaCadence })
      setBudgetTypes(await getBudgetTypes(supabase, idFamily))
      setNewPartidaName('')
      setPartidaFormOpen(false)
    } catch (err) {
      setPartidaError(err instanceof Error ? err.message : 'No se pudo crear la partida')
    } finally {
      setAddingPartida(false)
    }
  }

  const handlePeriodChange = (from: string, to: string) => setPeriod({ from, to })

  // Al cambiar de partida se descarta el importe manual: puede tener otra periodicidad
  const clearOverrides = (keys: string[]) =>
    setGroupOverrides((current) => {
      const next = { ...current }
      keys.forEach((key) => delete next[key])
      return next
    })

  const handleAssign = (key: string, idBudgetType: string) => {
    setAssignments((current) => ({ ...current, [key]: idBudgetType }))
    clearOverrides([key])
  }

  /** Quita los totales fijados de las verticales a las que pertenecen estas subcategorías */
  const clearCategoryOverridesFor = (keys: string[]) => {
    const categoryIds = new Set(
      groups.filter((group) => keys.includes(group.key)).map((group) => group.idCategory ?? 'none')
    )
    setCategoryOverrides((current) => {
      const next = { ...current }
      Object.keys(next).forEach((key) => {
        if (categoryIds.has(key.split('|')[0])) delete next[key]
      })
      return next
    })
  }

  const handleAssignMany = (keys: string[], idBudgetType: string) => {
    setAssignments((current) => {
      const next = { ...current }
      keys.forEach((key) => {
        next[key] = idBudgetType
      })
      return next
    })
    clearOverrides(keys)
    clearCategoryOverridesFor(keys)
  }

  const handleGroupOverrideChange = (key: string, value: string) =>
    setGroupOverrides((current) => ({ ...current, [key]: value }))

  const handleCategoryOverrideChange = (key: string, value: string) =>
    setCategoryOverrides((current) => {
      const next = { ...current }
      if (value === '') delete next[key]
      else next[key] = value
      return next
    })

  const handleUseAverageIncome = (monthlyAverage: number) =>
    setRecurring((current) => {
      const values = { amount: String(monthlyAverage), months: '' }
      const existing = current.find((item) => item.name === HISTORIC_INCOME_NAME)
      if (existing) {
        return current.map((item) => (item.id === existing.id ? { ...item, ...values } : item))
      }
      // Se descartan las filas vacías (p. ej. la fila de ejemplo inicial)
      const filled = current.filter((item) => item.amount !== '')
      return [...filled, { id: newId(), name: HISTORIC_INCOME_NAME, ...values }]
    })

  const relationChanges = useMemo(() => {
    const keys = new Set([...Object.keys(assignments), ...Object.keys(originalDefaults.current)])
    const upserts: Array<{ idSubcategory: string; idBudgetType: string }> = []
    const deletes: string[] = []
    keys.forEach((key) => {
      if (!key.startsWith('sub:')) return
      const current = assignments[key] || ''
      const original = originalDefaults.current[key] || ''
      if (current === original) return
      const idSubcategory = key.slice(4)
      if (current) upserts.push({ idSubcategory, idBudgetType: current })
      else deletes.push(idSubcategory)
    })
    return { upserts, deletes }
  }, [assignments])

  const relationChangesCount = relationChanges.upserts.length + relationChanges.deletes.length
  // Importe que se guardará: el editado a mano o, si no hay, el calculado
  const finalAmount = (line: BudgetLine) => {
    const override = amountOverrides[line.type.id_budget_type]
    return override !== undefined && override !== '' ? round2(parseNumber(override)) : line.amount
  }
  const commentFor = (line: BudgetLine) => commentOverrides[line.type.id_budget_type] ?? ''

  const linesToSave = budgetLines.filter((line) => finalAmount(line) > 0)
  const endMonthDate = endMonth ? `${nextMonthKey(endMonth)}-01` : null
  const endBeforeStart = endMonth !== '' && endMonth < startMonth
  const canSave = scopeUserId !== null && linesToSave.length > 0 && !endBeforeStart

  // Presupuesto guardado y vigente en el mes de inicio elegido
  const savedFor = (idBudgetType: string): CurrentUserBudget | null => {
    if (!scopeUserId) return null
    return (
      budgetHistory
        .filter((item) => item.id_user === scopeUserId && item.id_budget_type === idBudgetType)
        .filter((item) => {
          const start = dateToMonth(item.dt_start_month)
          const end = item.dt_end_month ? dateToMonth(item.dt_end_month) : null
          return start <= startMonth && (end === null || end > startMonth)
        })
        .sort((a, b) => b.dt_start_month.localeCompare(a.dt_start_month))[0] || null
    )
  }

  /** Foto completa de lo configurado ahora mismo en la calculadora. */
  const buildSnapshot = (): BudgetPlanSnapshot => ({
    version: 1,
    period,
    method,
    planMonths: String(planMonthsNumber),
    recurring,
    annualIncomes,
    bonuses,
    assignments,
    groupOverrides,
    categoryOverrides,
    directAmounts: Object.fromEntries(Object.entries(directAmounts).filter(([, value]) => parseNumber(value) > 0)),
    subAmounts: Object.fromEntries(Object.entries(subAmounts).filter(([, value]) => parseNumber(value) > 0)),
    savingsMode,
    savingsValue,
    manualAmounts: Object.fromEntries(
      budgetLines
        .filter((line) => {
          const value = amountOverrides[line.type.id_budget_type]
          return value !== undefined && value !== '' && round2(parseNumber(value)) !== line.amount
        })
        .map((line) => [line.type.id_budget_type, amountOverrides[line.type.id_budget_type]])
    ),
    endMonth,
  })

  const restorePlan = (plan: BudgetPlanSnapshot) => {
    setPeriod(plan.period)
    setMethod(plan.method as StatMethod)
    setRecurring(plan.recurring)
    setAnnualIncomes(plan.annualIncomes)
    setBonuses(plan.bonuses)
    // Lo que había en el plan manda sobre las relaciones actuales, el resto se mantiene
    setAssignments({ ...originalDefaults.current, ...plan.assignments })
    setGroupOverrides(plan.groupOverrides)
    setCategoryOverrides(plan.categoryOverrides ?? {})
    setDirectAmounts(plan.directAmounts ?? {})
    setSubAmounts(plan.subAmounts ?? {})
    setSavingsMode(plan.savingsMode as SavingsMode)
    setSavingsValue(plan.savingsValue)
  }

  /**
   * Carga el presupuesto guardado para editarlo: los importes/comentarios/fecha límite vigentes en `month`
   * y, si existe, la foto completa de la calculadora (periodo, método, subcategorías, ingresos, ahorro).
   * Devuelve true si se ha restaurado la foto completa.
   */
  const loadSavedBudgets = useCallback(
    (month: string): boolean => {
      if (!scopeUserId) return false
      const amounts: Record<string, string> = {}
      const comments: Record<string, string> = {}
      let lastEnd = ''
      let versionStart = ''
      for (const type of budgetTypes) {
        const saved = budgetHistory
          .filter((item) => item.id_user === scopeUserId && item.id_budget_type === type.id_budget_type)
          .filter((item) => {
            const start = dateToMonth(item.dt_start_month)
            const end = item.dt_end_month ? dateToMonth(item.dt_end_month) : null
            return start <= month && (end === null || end > month)
          })
          .sort((a, b) => b.dt_start_month.localeCompare(a.dt_start_month))[0]
        if (!saved) continue
        amounts[type.id_budget_type] = String(saved.ft_budget_amount)
        if (saved.ds_comments) comments[type.id_budget_type] = saved.ds_comments
        if (saved.dt_end_month) lastEnd = previousMonthKey(dateToMonth(saved.dt_end_month))
        const start = dateToMonth(saved.dt_start_month)
        if (start > versionStart) versionStart = start
      }

      const plan = planInForce(plans, scopeUserId, versionStart || month)
      if (plan) {
        restorePlan(plan.plan)
        setStartMonth(plan.dt_start_month.slice(0, 7))
      } else if (versionStart) {
        setStartMonth(versionStart)
      }
      // Con la foto completa, los importes salen de lo que has configurado (y solo se mantienen tus retoques manuales).
      // Sin ella (presupuestos antiguos) solo hay los totales guardados, que se cargan como punto de partida.
      setAmountOverrides(plan ? plan.plan.manualAmounts ?? {} : amounts)
      setCommentOverrides(comments)
      setEndMonth(lastEnd)

      const label = versionStart || month
      if (Object.keys(amounts).length === 0) {
        setEditNotice({ tone: 'warn', text: 'No hay ningún presupuesto guardado vigente para esta persona en ese mes.' })
      } else if (plan) {
        setEditNotice({
          tone: 'ok',
          text: `Editando el presupuesto vigente desde ${label}. Se ha restaurado todo tal y como lo guardaste (periodo, método, importes por subcategoría, ingresos y ahorro). Para aplicar los cambios desde otro mes, cámbialo en "Vigente desde".`,
        })
      } else {
        setEditNotice({
          tone: 'warn',
          text: plansAvailable
            ? `Este presupuesto (vigente desde ${label}) se guardó antes de que se guardara el detalle: solo se han cargado los totales por partida. Al guardarlo ahora se guardará ya el detalle completo.`
            : 'Falta ejecutar la migración de planes de presupuesto, así que solo se pueden cargar los totales por partida.',
        })
      }
      return plan !== null
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopeUserId, budgetTypes, budgetHistory, plans, plansAvailable]
  )

  // Si se abre en modo edición, se cargan los presupuestos guardados una sola vez
  useEffect(() => {
    if (!startFromSaved || savedLoadedRef.current || loading || budgetTypes.length === 0) return
    savedLoadedRef.current = true
    // Con la foto completa se vuelve al paso 1 para revisarlo todo; sin ella se queda en "Guardar"
    const restored = loadSavedBudgets(initialMonth || startMonth)
    if (newStartMonth) {
      // Nuevo presupuesto a partir del vigente: mismos valores de partida, empezando donde termina el actual
      setStartMonth(newStartMonth)
      setEndMonth(`${newStartMonth.slice(0, 4)}-12`)
      setEditNotice({
        tone: 'ok',
        text: `Nuevo presupuesto desde ${newStartMonth}, partiendo de los valores del vigente. Ajusta lo que quieras y guarda: el actual se cierra automáticamente cuando empiece este.`,
      })
      setStep(1)
    } else if (restored) {
      setStep(1)
    }
  }, [startFromSaved, loading, budgetTypes, startMonth, initialMonth, newStartMonth, loadSavedBudgets])

  const handleSave = async () => {
    if (!scopeUserId) return
    try {
      setSaving(true)
      setSaveError(null)
      setSaveMessage(null)

      for (const line of linesToSave) {
        await saveUserBudgetVersion(supabase, {
          idFamily,
          idUser: scopeUserId,
          idBudgetType: line.type.id_budget_type,
          amount: finalAmount(line),
          startMonth: `${startMonth}-01`,
          endMonth: endMonthDate,
          periodAmount: line.type.ds_periodicity === 'annual' && endMonthDate !== null,
          comments: commentFor(line).trim() || null,
        })
      }

      let planSaved = true
      try {
        await saveBudgetPlan(supabase, {
          idFamily,
          idUser: scopeUserId,
          startMonth: `${startMonth}-01`,
          plan: buildSnapshot(),
        })
        const refreshedPlans = await getBudgetPlans(supabase, idFamily)
        setPlans(refreshedPlans.plans)
        setPlansAvailable(refreshedPlans.available)
      } catch {
        planSaved = false
      }

      let relationsSaved = 0
      if (saveRelations) {
        for (const item of relationChanges.upserts) {
          await upsertSubcategoryBudgetDefault(supabase, {
            idFamily,
            idSubcategory: item.idSubcategory,
            idBudgetType: item.idBudgetType,
          })
          relationsSaved++
        }
        for (const idSubcategory of relationChanges.deletes) {
          await deleteSubcategoryBudgetDefault(supabase, { idFamily, idSubcategory })
          relationsSaved++
        }
        const refreshed: Record<string, string> = { ...originalDefaults.current }
        relationChanges.upserts.forEach((item) => {
          refreshed[`sub:${item.idSubcategory}`] = item.idBudgetType
        })
        relationChanges.deletes.forEach((id) => delete refreshed[`sub:${id}`])
        originalDefaults.current = refreshed
      }

      setBudgetHistory((await getUserBudgetHistory(supabase, idFamily)).filter((item) => item.is_active))
      setSaveMessage(
        `Guardados ${linesToSave.length} presupuestos desde ${startMonth}` +
          (endMonth ? ` hasta ${endMonth}` : '') +
          (relationsSaved > 0 ? ` y ${relationsSaved} relaciones subcategoría → partida.` : '.') +
          (planSaved ? '' : ' No se pudo guardar el detalle del cálculo (¿falta ejecutar la migración de planes?): no podrás recuperarlo al editar.')
      )
    } catch (err) {
      console.error('Error al guardar presupuestos desde la calculadora:', err)
      setSaveError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // ---------- Render ----------
  if (loading) {
    return (
      <div className="rounded-3xl border border-gray-100 bg-white p-12 text-center text-gray-500 shadow-sm">
        Cargando histórico de transacciones…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
        {error}
        <button type="button" onClick={loadData} className="ml-3 font-semibold underline">
          Reintentar
        </button>
      </div>
    )
  }

  const scopeName =
    scopeUserId === null
      ? 'toda la familia'
      : members.find((member) => member.id_user === scopeUserId)?.ds_user ||
        members.find((member) => member.id_user === scopeUserId)?.ds_email ||
        'la persona'

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/budgets" className="text-sm font-medium text-[#0d9488] hover:underline">
            ← Volver a presupuestos
          </Link>
          <p className="mt-1 text-sm text-gray-500">
            {transactions.length} transacciones cargadas · cálculo para <strong>{scopeName}</strong>
          </p>
        </div>
        <div className="w-full sm:w-64">
          <label className="mb-1 block text-xs font-medium text-gray-500">Calcular para</label>
          <select
            value={scope}
            onChange={(event) => {
              setScope(event.target.value)
              setGroupOverrides({}) // los importes manuales eran de otra persona
              setCategoryOverrides({})
            }}
            className={inputClass}
          >
            {members.map((member) => (
              <option key={member.id_user} value={member.id_user}>
                {member.ds_user || member.ds_email}
              </option>
            ))}
            <option value="family">Toda la familia (solo análisis)</option>
          </select>
        </div>
      </div>

      {editNotice && (
        <div
          className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm ${
            editNotice.tone === 'ok' ? 'border-teal-200 bg-[#90EBD6]/20 text-teal-900' : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <p>{editNotice.text}</p>
          <button type="button" onClick={() => setEditNotice(null)} className="text-xs font-semibold opacity-70 hover:opacity-100">
            Cerrar
          </button>
        </div>
      )}

      {/* Stepper */}
      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {STEPS.map((item) => {
          const active = step === item.id
          const done = step > item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              className={`rounded-xl border px-3 py-2 text-left transition ${
                active
                  ? 'border-[#0d9488] bg-[#90EBD6]/30 shadow-sm'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    active || done ? 'bg-[#0d9488] text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {done ? '✓' : item.id}
                </span>
                <span className="font-semibold text-gray-900">{item.title}</span>
              </div>
              <div className="mt-0.5 hidden text-[11px] text-gray-500 sm:block">{item.hint}</div>
            </button>
          )
        })}
      </nav>

      {/* Resumen compacto (móvil/tablet; en escritorio va el panel lateral) */}
      <div className="grid gap-3 sm:grid-cols-3 lg:hidden">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Ingreso mensual medio</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{formatMoney(incomeMonthly)}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Presupuestado / mes</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{formatMoney(committedMonthly)}</div>
          <div className="text-xs text-gray-500">anuales prorrateados incluidos</div>
        </div>
        <div
          className={`rounded-2xl border p-4 shadow-sm ${
            availableMonthly >= 0 ? 'border-teal-100 bg-[#90EBD6]/20' : 'border-red-100 bg-red-50'
          }`}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Ahorro / mes</div>
          <div className={`mt-1 text-2xl font-bold ${availableMonthly >= 0 ? 'text-teal-800' : 'text-red-700'}`}>
            {formatMoney(availableMonthly)}
          </div>
          <div className="text-xs text-gray-500">{incomeMonthly > 0 ? `${savingsRate.toFixed(1)}% del ingreso` : '—'}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="min-w-0 space-y-6">
      {/* Paso 1: Ingresos */}
      {step === 1 && (
        <div className="space-y-5">
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Periodo del presupuesto</h3>
            <p className="mb-4 text-sm text-gray-500">
              Elige desde cuándo y, si quieres, hasta cuándo aplica. Los meses del plan se calculan solos y se usan para
              ingresos y para las partidas anuales (Viaje, Excepcional).
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Desde</label>
                <input
                  type="month"
                  value={startMonth}
                  onChange={(event) => event.target.value && setStartMonth(event.target.value)}
                  className={`${inputClass} w-48`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Hasta (opcional)</label>
                <input
                  type="month"
                  min={startMonth}
                  value={endMonth}
                  onChange={(event) => setEndMonth(event.target.value)}
                  className={`${inputClass} w-48`}
                />
              </div>
              <div className="flex flex-wrap gap-3 pb-2 text-xs font-medium">
                <button type="button" onClick={() => setEndMonth(`${startMonth.slice(0, 4)}-12`)} className="text-[#0d9488] hover:underline">
                  Fin de año
                </button>
                {endMonth && (
                  <button type="button" onClick={() => setEndMonth('')} className="text-gray-500 hover:text-gray-800">
                    Sin fecha de fin
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-teal-100 bg-[#90EBD6]/20 p-4 text-sm text-teal-900">
              {hasEndMonth ? (
                <>
                  <strong>{planMonthsNumber} {planMonthsNumber === 1 ? 'mes' : 'meses'}</strong> ({startMonth} → {endMonth}). Las partidas
                  anuales se presupuestan <strong>para todo este periodo</strong>, no por año.
                </>
              ) : (
                <>
                  Sin fecha de fin: se calcula sobre <strong>12 meses</strong> y las partidas anuales son <strong>por año</strong>.
                </>
              )}
            </div>
            {endMonth !== '' && endMonth < startMonth && (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">La fecha de fin no puede ser anterior al inicio.</p>
            )}
          </section>

          <IncomeList
            title="Ingresos mensuales"
            description={`Importe que cobras cada mes. Por defecto cuenta todos los meses del periodo (${planMonthsNumber}); puedes cambiarlo en un ingreso concreto.`}
            items={recurring}
            onChange={setRecurring}
            showMonths
            monthsLabel="Nº de meses"
            monthsPlaceholder={String(planMonthsNumber)}
            addLabel="Añadir ingreso mensual"
            defaultName="Ingreso mensual"
            defaultMonths=""
            totalFor={recurringTotal}
          />
          <IncomeList
            title="Ingresos anuales"
            description="Importe por año; se prorratea según los meses del periodo."
            items={annualIncomes}
            onChange={setAnnualIncomes}
            showMonths={false}
            monthsLabel=""
            addLabel="Añadir ingreso anual"
            defaultName="Ingreso anual"
            defaultMonths="12"
            totalFor={annualTotal}
          />
          <IncomeList
            title="Bonus"
            description="Cantidad de cada bonus y a cuántos meses del periodo aplica (los que quieras)."
            items={bonuses}
            onChange={setBonuses}
            showMonths
            monthsLabel="Aplica a (meses)"
            addLabel="Añadir bonus"
            defaultName="Bonus"
            defaultMonths="1"
            totalFor={recurringTotal}
          />

          <section className="rounded-3xl border border-teal-100 bg-[#90EBD6]/20 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Total del periodo ({planMonthsNumber} {planMonthsNumber === 1 ? 'mes' : 'meses'})</div>
                <div className="text-xl font-bold text-gray-900">{formatMoney(incomeTotal)}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Media mensual</div>
                <div className="text-xl font-bold text-gray-900">{formatMoney(incomeMonthly)}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Anualizado</div>
                <div className="text-xl font-bold text-gray-900">{formatMoney(incomeMonthly * 12)}</div>
              </div>
            </div>
          </section>

          <IncomeHistory
            from={period.from}
            to={period.to}
            months={months}
            minMonth={minMonth}
            maxMonth={maxMonth}
            onPeriodChange={handlePeriodChange}
            rows={incomeRows}
            onUseAverage={handleUseAverageIncome}
          />
        </div>
      )}

      {/* Paso 2: Gastos */}
      {step === 2 && (
        <div className="space-y-5">
        <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-2 pt-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Partidas del presupuesto</h3>
              <p className="text-xs text-gray-500">
                Cada partida suma lo de sus verticales, sus subpartidas y su importe directo (sin vertical).
              </p>
            </div>
            {hasFamilyBudgetTypes(budgetTypes, idFamily) ? (
              partidaFormOpen ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (newPartidaName.trim()) handleAddPartida()
                  }}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    autoFocus
                    value={newPartidaName}
                    onChange={(event) => setNewPartidaName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setPartidaFormOpen(false)
                    }}
                    placeholder="Nombre de la partida"
                    aria-label="Nombre de la nueva partida"
                    className="w-44 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]"
                  />
                  <select
                    value={newPartidaCadence}
                    onChange={(event) => setNewPartidaCadence(event.target.value as 'monthly' | 'annual')}
                    aria-label="Cadencia de la nueva partida"
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]"
                  >
                    <option value="monthly">€/mes</option>
                    <option value="annual">Total periodo</option>
                  </select>
                  <button
                    type="submit"
                    disabled={addingPartida || !newPartidaName.trim()}
                    className="rounded-lg bg-[#0d9488] px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    Añadir
                  </button>
                  <button type="button" onClick={() => setPartidaFormOpen(false)} className="text-sm text-gray-400 hover:text-gray-700">
                    ✕
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setPartidaFormOpen(true)}
                  className="rounded-lg border border-[#0d9488] px-3 py-1.5 text-sm font-semibold text-[#0d9488] hover:bg-[#90EBD6]/20"
                >
                  + Partida
                </button>
              )
            ) : (
              <Link href={`/budgets?family=${idFamily}`} className="text-xs font-semibold text-[#0d9488] underline">
                Gestionar partidas
              </Link>
            )}
          </div>
          {partidaError && <p className="mx-5 mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">{partidaError}</p>}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-y border-gray-100 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-1.5">Partida</th>
                  <th className="px-3 py-1.5 text-right">Verticales</th>
                  <th className="px-3 py-1.5">Importe directo</th>
                  <th className="px-3 py-1.5 text-right">Total</th>
                  <th className="px-3 py-1.5 text-right">€/mes</th>
                  <th className="w-8 px-2 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-800">
                {budgetLines.map((line) => {
                  const id = line.type.id_budget_type
                  const extra = extraOf(id)
                  const unit = line.type.ds_periodicity === 'annual' ? annualUnitLabel : 'mes'
                  const subs = subsByType.get(id) || []
                  const canAddSub = subtypesAvailable && hasFamilyBudgetTypes(budgetTypes, idFamily)
                  const inputClassName =
                    'w-24 rounded-lg border border-gray-200 px-2 py-1 text-sm tabular-nums focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]'
                  return (
                    <Fragment key={id}>
                      <tr className="hover:bg-gray-50/50">
                        <td className="px-5 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-900">{line.type.ds_budget_type}</span>
                            {canAddSub &&
                              (addingSubFor === id ? (
                                <form
                                  onSubmit={(event) => {
                                    event.preventDefault()
                                    handleAddSubtype(id)
                                  }}
                                  className="flex items-center gap-1"
                                >
                                  <input
                                    autoFocus
                                    value={newSubNames[id] ?? ''}
                                    onChange={(event) => setNewSubNames((current) => ({ ...current, [id]: event.target.value }))}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Escape') setAddingSubFor(null)
                                    }}
                                    onBlur={() => {
                                      if (!(newSubNames[id] ?? '').trim()) setAddingSubFor(null)
                                    }}
                                    placeholder="Subpartida…"
                                    aria-label={`Nueva subpartida de ${line.type.ds_budget_type}`}
                                    className="w-32 rounded-md border border-[#0d9488] px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#90EBD6]"
                                  />
                                  <button type="submit" disabled={addingPartida} className="text-xs font-semibold text-[#0d9488] hover:underline">
                                    ↵
                                  </button>
                                </form>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setAddingSubFor(id)}
                                  title={`Añadir subpartida a ${line.type.ds_budget_type}`}
                                  aria-label={`Añadir subpartida a ${line.type.ds_budget_type}`}
                                  className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 text-xs font-bold leading-none text-gray-400 hover:border-[#0d9488] hover:bg-[#90EBD6]/20 hover:text-[#0d9488]"
                                >
                                  +
                                </button>
                              ))}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{formatMoney(round2(line.amount - extra))}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={directAmounts[id] ?? ''}
                              onChange={(event) =>
                                setDirectAmounts((current) => {
                                  const next = { ...current }
                                  if (event.target.value === '') delete next[id]
                                  else next[id] = event.target.value
                                  return next
                                })
                              }
                              placeholder={subs.length > 0 ? 'Adicional' : '0'}
                              aria-label={`Cantidad adicional de ${line.type.ds_budget_type}`}
                              className={inputClassName}
                            />
                            <span className="text-[11px] text-gray-400">€/{unit}</span>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatMoney(line.amount)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{formatMoney(line.monthlyEquivalent)}</td>
                        <td className="px-2 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemovePartida(line.type)}
                            disabled={addingPartida}
                            title="Quitar esta partida"
                            aria-label={`Quitar la partida ${line.type.ds_budget_type}`}
                            className="text-xs text-gray-300 hover:text-red-500 disabled:opacity-40"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                      {subs.map((sub) => (
                        <tr key={sub.id_budget_subtype} className="bg-gray-50/60">
                          <td className="py-1 pl-10 pr-3 text-xs text-gray-600">↳ {sub.ds_budget_subtype}</td>
                          <td className="px-3 py-1" />
                          <td className="px-3 py-1">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={subAmounts[sub.id_budget_subtype] ?? ''}
                                onChange={(event) =>
                                  setSubAmounts((current) => {
                                    const next = { ...current }
                                    if (event.target.value === '') delete next[sub.id_budget_subtype]
                                    else next[sub.id_budget_subtype] = event.target.value
                                    return next
                                  })
                                }
                                placeholder="0"
                                aria-label={`Importe de ${sub.ds_budget_subtype}`}
                                className={inputClassName}
                              />
                              <span className="text-[11px] text-gray-400">€/{unit}</span>
                            </div>
                          </td>
                          <td className="px-3 py-1 text-right text-xs tabular-nums text-gray-500">
                            {formatMoney(parseNumber(subAmounts[sub.id_budget_subtype]))}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
        <ExpensesStep
          from={period.from}
          to={period.to}
          onPeriodChange={handlePeriodChange}
          months={months}
          minMonth={minMonth}
          maxMonth={maxMonth}
          method={method}
          onMethodChange={setMethod}
          budgetTypes={budgetTypes}
          groups={groups}
          rows={rows}
          assignments={assignments}
          onAssign={handleAssign}
          onAssignMany={handleAssignMany}
          typeStats={typeStats}
          groupLines={groupLines}
          groupOverrides={groupOverrides}
          scopeLabel={scopeUserId ? scopeName : 'familia'}
          onGroupOverrideChange={handleGroupOverrideChange}
          categoryOverrides={categoryOverrides}
          onCategoryOverrideChange={handleCategoryOverrideChange}
          annualMonths={annualMonths}
          annualUnitLabel={annualUnitLabel}
          onResetOverrides={() => {
            setGroupOverrides({})
            setCategoryOverrides({})
          }}
        />
        </div>
      )}

      {/* Paso 3: Resumen y ahorro */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="lg:hidden rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <SavingsControls
              mode={savingsMode}
              value={savingsValue}
              onModeChange={setSavingsMode}
              onValueChange={setSavingsValue}
            />
          </div>

          <section
            className={`rounded-3xl border p-5 ${
              (reachesTarget === null ? availableMonthly >= 0 : reachesTarget)
                ? 'border-teal-100 bg-[#90EBD6]/20'
                : 'border-red-100 bg-red-50'
            }`}
          >
            {reachesTarget === null ? (
              <p className="text-lg font-semibold text-gray-900">
                {availableMonthly >= 0
                  ? `Con estos presupuestos ahorrarías ${formatMoney(availableMonthly)} al mes (${formatMoney(availableMonthly * annualMonths)} ${hasEndMonth ? 'en el periodo' : 'al año'}).`
                  : `Con estos presupuestos gastarías ${formatMoney(-availableMonthly)} más de lo que ingresas al mes.`}
              </p>
            ) : reachesTarget ? (
              <p className="text-lg font-semibold text-teal-900">
                ✓ Llegas al objetivo: ahorras {formatMoney(availableMonthly)}/mes frente a {formatMoney(savingsTargetMonthly!)} que buscabas
                (sobran {formatMoney(availableMonthly - savingsTargetMonthly!)}/mes).
              </p>
            ) : (
              <p className="text-lg font-semibold text-red-800">
                ✗ No llegas: ahorras {formatMoney(availableMonthly)}/mes y buscabas {formatMoney(savingsTargetMonthly!)}
                {' '}(faltan {formatMoney(savingsTargetMonthly! - availableMonthly)}/mes).
              </p>
            )}
            {maxBudgetForTarget !== null && (
              <p className="mt-2 text-sm text-gray-600">
                Para cumplir el objetivo tus presupuestos deberían sumar como máximo{' '}
                <strong>{formatMoney(maxBudgetForTarget)}</strong> al mes; ahora suman{' '}
                <strong>{formatMoney(committedMonthly)}</strong>.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Cuánto gastas en cada partida y en cada vertical</h3>
              <p className="text-sm text-gray-500">
                Importes en la unidad de cada partida (mensual o anual); las dos últimas columnas lo llevan todo a €/mes
                y €/año. Despliega para ver cada subcategoría. Abajo, el ingreso y lo que te queda.
              </p>
            </div>
            <BudgetMatrix
              categories={breakdownCategories}
              budgetTypes={budgetTypes}
              budgetLines={budgetLines}
              groupLines={groupLines}
              incomeMonthly={incomeMonthly}
              annualMonths={annualMonths}
              annualUnitLabel={annualUnitLabel}
              directAmounts={Object.fromEntries(budgetTypes.map((type) => [type.id_budget_type, extraOf(type.id_budget_type)]))}
            />
          </section>

        </div>
      )}

      {/* Paso 4: Controles */}
      {step === 4 && (
        <ControlsStep
          categories={breakdownCategories}
          idFamily={idFamily}
          idUser={scopeUserId}
          scopeName={scopeUserId ? scopeName : 'la familia'}
          startMonth={startMonth}
          endMonth={endMonth}
        />
      )}

      {/* Paso 5: Guardar */}
      {step === 5 && (
        <div className="space-y-5">
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Presupuestos que se guardarán</h3>
            <p className="mb-4 text-sm text-gray-500">
              Se guardan para <strong>{scopeName}</strong> como nueva versión desde el mes que elijas (el histórico anterior se conserva).
              Solo se guardan las partidas con importe mayor que 0.
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => loadSavedBudgets(startMonth)}
                disabled={!scopeUserId}
                className="rounded-xl border border-[#0d9488] px-3 py-2 text-sm font-medium text-[#0d9488] hover:bg-[#90EBD6]/20 disabled:opacity-40"
              >
                Cargar presupuesto guardado
              </button>
              <button
                type="button"
                onClick={() => {
                  setAmountOverrides({})
                  setCommentOverrides({})
                  setEndMonth('')
                }}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Usar importes calculados
              </button>
              <span className="text-xs text-gray-500">Puedes retocar cualquier importe a mano antes de guardar.</span>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-gray-100">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-2">Partida</th>
                    <th className="px-4 py-2 text-right">Guardado ahora</th>
                    <th className="px-4 py-2 text-right">Calculado</th>
                    <th className="px-4 py-2 text-right">Importe a guardar</th>
                    <th className="px-4 py-2">Comentario (opcional)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-800">
                  {budgetLines.map((line) => {
                    const id = line.type.id_budget_type
                    const saved = savedFor(id)
                    const unit = line.type.ds_periodicity === 'monthly' ? '/mes' : `/${annualUnitLabel}`
                    const savedUnit = line.type.ds_periodicity === 'monthly' ? '/mes' : saved?.is_period_amount ? '/periodo' : '/año'
                    const edited = amountOverrides[id] !== undefined && amountOverrides[id] !== '' && round2(parseNumber(amountOverrides[id])) !== line.amount
                    return (
                      <tr key={id} className={finalAmount(line) > 0 ? '' : 'opacity-60'}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{line.type.ds_budget_type}</div>
                          <div className="text-xs text-gray-500">{line.type.ds_periodicity === 'monthly' ? 'Mensual' : hasEndMonth ? 'De todo el periodo' : 'Anual'}</div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-gray-600">
                          {saved ? (
                            <>
                              <span className="text-sm font-semibold text-gray-900">{formatMoney(saved.ft_budget_amount, 2)}</span>
                              <span className="ml-1 text-gray-400">{savedUnit}</span>
                              <div className="text-gray-400">
                                {saved.dt_end_month ? `hasta ${previousMonthKey(dateToMonth(saved.dt_end_month))}` : 'sin fecha límite'}
                              </div>
                              {round2(saved.ft_budget_amount) !== finalAmount(line) && (
                                <button
                                  type="button"
                                  onClick={() => setAmountOverrides((current) => ({ ...current, [id]: String(saved.ft_budget_amount) }))}
                                  className="mt-0.5 text-[11px] font-medium text-[#0d9488] hover:underline"
                                >
                                  Usar este
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-gray-500">
                          {formatMoney(line.amount, 2)}
                          <span className="ml-1 text-gray-400">{unit}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={edited ? amountOverrides[id] : String(line.amount)}
                              onChange={(event) => setAmountOverrides((current) => ({ ...current, [id]: event.target.value }))}
                              className={`${inputClass} w-28 text-right font-semibold tabular-nums ${edited ? 'border-[#0d9488] bg-[#90EBD6]/10' : ''}`}
                            />
                            <span className="text-xs text-gray-400">{unit}</span>
                          </div>
                          <div className="mt-1 text-xs tabular-nums text-gray-400">
                            {line.type.ds_periodicity === 'monthly'
                              ? hasEndMonth
                                ? `${formatMoney(finalAmount(line) * planMonthsNumber)} en el periodo`
                                : `${formatMoney(finalAmount(line) * 12)}/año`
                              : `${formatMoney(finalAmount(line) / annualMonths, 2)}/mes`}
                          </div>
                        </td>
                        <td className="min-w-[260px] max-w-md px-4 py-3 text-xs text-gray-500">
                          {finalAmount(line) > 0 ? (
                            <textarea
                              value={commentFor(line)}
                              onChange={(event) => setCommentOverrides((current) => ({ ...current, [id]: event.target.value }))}
                              rows={2}
                              className={`${inputClass} text-xs`}
                              placeholder="Sin comentario"
                            />
                          ) : (
                            'No se guarda (importe 0)'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Vigente desde</label>
                <input
                  type="month"
                  value={startMonth}
                  onChange={(event) => event.target.value && setStartMonth(event.target.value)}
                  className={`${inputClass} w-48`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Fecha límite (último mes vigente, opcional)</label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="month"
                    min={startMonth}
                    value={endMonth}
                    onChange={(event) => setEndMonth(event.target.value)}
                    className={`${inputClass} w-48`}
                  />
                  {endMonth && (
                    <button type="button" onClick={() => setEndMonth('')} className="text-xs font-medium text-gray-500 hover:text-gray-800">
                      Quitar fecha límite
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEndMonth(`${startMonth.slice(0, 4)}-12`)}
                    className="text-xs font-medium text-[#0d9488] hover:underline"
                  >
                    Fin de año
                  </button>
                </div>
              </div>
            </div>

            <div
              className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 ${
                endMonth ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'
              }`}
            >
              <span className={`mt-0.5 text-lg ${endMonth ? 'text-amber-600' : 'text-gray-400'}`}>{endMonth ? '⏳' : '∞'}</span>
              <div className="text-sm">
                <p className={`font-semibold ${endMonth ? 'text-amber-900' : 'text-gray-700'}`}>
                  {endMonth
                    ? `Vigente de ${startMonth} a ${endMonth}`
                    : `Vigente desde ${startMonth}, sin fecha límite`}
                </p>
                <p className={endMonth ? 'text-amber-800' : 'text-gray-500'}>
                  {endMonth
                    ? `A partir de ${nextMonthKey(endMonth)} dejarás de tener presupuesto en estas partidas, salvo que guardes uno nuevo.`
                    : 'Seguirá aplicando hasta que guardes un cambio con una fecha posterior.'}
                </p>
              </div>
            </div>
            {endBeforeStart && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">La fecha límite no puede ser anterior al inicio.</p>}

            <label className="mt-4 flex items-start gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={saveRelations}
                onChange={(event) => setSaveRelations(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-[#0d9488] focus:ring-[#90EBD6]"
              />
              <span>
                También guardar la relación subcategoría → partida que has definido
                <span className="block text-xs text-gray-500">
                  {relationChangesCount > 0
                    ? `${relationChanges.upserts.length} asignaciones nuevas o cambiadas y ${relationChanges.deletes.length} eliminadas (afecta a las transacciones nuevas de la familia).`
                    : 'No has cambiado ninguna relación respecto a la configuración actual.'}
                </span>
              </span>
            </label>

            {scopeUserId === null && (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                Has elegido “Toda la familia”: los presupuestos son por persona. Elige una persona arriba para poder guardar.
              </p>
            )}
            {saveError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
            {saveMessage && (
              <p className="mt-4 rounded-xl bg-[#90EBD6]/30 p-3 text-sm text-teal-900">
                {saveMessage}{' '}
                <Link href="/budgets" className="font-semibold underline">
                  Ver en presupuestos
                </Link>
              </p>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || saving}
              className="mt-5 rounded-xl bg-[#0d9488] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar presupuestos'}
            </button>
          </section>
        </div>
      )}

      {/* Navegación */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep((current) => Math.max(1, current - 1))}
          disabled={step === 1}
          className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          ← Anterior
        </button>
        {step < 5 && (
          <button
            type="button"
            onClick={() => setStep((current) => Math.min(5, current + 1))}
            className="rounded-xl bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Siguiente →
          </button>
        )}
      </div>
      </div>

      <div className="hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <SummaryPanel
          incomeMonthly={incomeMonthly}
          lines={budgetLines}
          committedMonthly={committedMonthly}
          availableMonthly={availableMonthly}
          savingsTargetMonthly={savingsTargetMonthly}
          unassignedMonthly={typeStats.unassigned.avg}
          savingsMode={savingsMode}
          savingsValue={savingsValue}
          onSavingsModeChange={setSavingsMode}
          onSavingsValueChange={setSavingsValue}
          annualMonths={annualMonths}
          annualUnitLabel={annualUnitLabel}
        />
      </div>
      </div>
    </div>
  )
}
