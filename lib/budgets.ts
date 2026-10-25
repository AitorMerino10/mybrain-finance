import type { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

export type BudgetType = Database['public']['Tables']['pml_dim_budget_type']['Row']
export type BudgetSubtype = Database['public']['Tables']['pml_dim_budget_subtype']['Row']
export type UserBudget = Database['public']['Tables']['pml_cfg_user_budget']['Row']
export type SubcategoryBudgetDefault =
  Database['public']['Tables']['pml_rel_subcategory_budget_type']['Row']

export type CurrentUserBudget = UserBudget & {
  budget_type: BudgetType | null
}

function monthIndexOf(date: string): number {
  const [year, month] = date.slice(0, 7).split('-').map(Number)
  return year * 12 + (month - 1)
}

/** Meses entre un inicio (inclusive) y un fin (exclusivo), ambos como YYYY-MM-DD o YYYY-MM. */
export function monthsBetweenDates(start: string, endExclusive: string): number {
  return Math.max(1, monthIndexOf(endExclusive) - monthIndexOf(start))
}

type PeriodBudget = Pick<UserBudget, 'dt_start_month' | 'dt_end_month'> & { is_period_amount?: boolean | null }

/** Nº de meses que cubre el importe cuando es "de todo el periodo" (partida anual con fecha de fin). null si es por año. */
export function budgetPeriodMonths(budget: PeriodBudget): number | null {
  if (!budget.is_period_amount || !budget.dt_end_month) return null
  return monthsBetweenDates(budget.dt_start_month, budget.dt_end_month)
}

/** Importe mensual equivalente de una versión: mensual tal cual; anual ÷12 o ÷ meses del periodo si es de todo el periodo. */
export function budgetMonthlyAmount(budget: PeriodBudget & { ft_budget_amount: number }, periodicity: string | null | undefined): number {
  if (periodicity !== 'annual') return budget.ft_budget_amount
  return budget.ft_budget_amount / (budgetPeriodMonths(budget) ?? 12)
}

/**
 * Partidas presupuestarias de una familia.
 * - Si la familia ya tiene partidas propias, se devuelven solo esas (sin las archivadas salvo `includeArchived`).
 * - Si no tiene ninguna (familia nueva, o migración sin ejecutar), se devuelven las plantillas globales.
 */
export async function getBudgetTypes(
  supabase: SupabaseClient<Database>,
  idFamily?: string,
  options: { includeArchived?: boolean } = {}
): Promise<BudgetType[]> {
  const { data, error } = await supabase
    .from('pml_dim_budget_type')
    .select('*')
    .order('id_order', { ascending: true })

  if (error) {
    console.error('Error al obtener tipos de presupuesto:', error)
    throw error
  }

  const rows = data || []
  const own = idFamily ? rows.filter((row) => row.id_family === idFamily) : []
  const list = own.length > 0 ? own : rows.filter((row) => !row.id_family)
  return options.includeArchived ? list : list.filter((row) => !row.is_archived)
}

/**
 * ¿La partida vale para esa persona? Las de toda la familia (sin `id_user`) valen para todos;
 * las de una persona, solo para ella. Sin persona (null) se consideran todas.
 * Antes de la migración la columna no existe y todas valen para todos.
 */
export function budgetTypeAppliesTo(type: BudgetType, idUser: string | null | undefined): boolean {
  const owner = (type as { id_user?: string | null }).id_user
  return !owner || !idUser || owner === idUser
}

/** Partidas que valen para alguna de estas personas (todas si no se indica ninguna). */
export function budgetTypesForUsers(types: BudgetType[], idUsers: Array<string | null | undefined>): BudgetType[] {
  const users = idUsers.filter((id): id is string => Boolean(id))
  if (users.length === 0) return types
  return types.filter((type) => users.some((id) => budgetTypeAppliesTo(type, id)))
}

/** ¿Tiene la familia partidas propias (migración ejecutada y partidas creadas)? */
export function hasFamilyBudgetTypes(budgetTypes: BudgetType[], idFamily: string): boolean {
  return budgetTypes.some((type) => type.id_family === idFamily)
}

/** Crea una partida nueva. `periodicity`: 'monthly' (importe al mes) o 'annual' (importe total del periodo). */
export async function createBudgetType(
  supabase: SupabaseClient<Database>,
  params: { idFamily: string; name: string; periodicity: 'monthly' | 'annual'; idUser?: string | null }
): Promise<BudgetType> {
  const name = params.name.trim()
  if (!name) throw new Error('La partida necesita un nombre')

  const { data: existing, error: existingError } = await supabase
    .from('pml_dim_budget_type')
    .select('id_order, ds_budget_type, is_archived')
    .eq('id_family', params.idFamily)
  if (existingError) throw existingError
  if ((existing || []).some((row) => !row.is_archived && row.ds_budget_type.toLowerCase() === name.toLowerCase())) {
    throw new Error(`Ya existe una partida llamada "${name}"`)
  }
  const nextOrder = Math.max(0, ...(existing || []).map((row) => row.id_order)) + 1

  const { data, error } = await supabase
    .from('pml_dim_budget_type')
    .insert({
      id_family: params.idFamily,
      ds_budget_type: name,
      ds_budget_type_key: `custom_${Math.random().toString(16).slice(2, 10)}`,
      ds_periodicity: params.periodicity,
      id_order: nextOrder,
      ...(params.idUser ? { id_user: params.idUser } : {}),
    })
    .select('*')
    .single()

  if (error) {
    console.error('Error al crear la partida:', error)
    throw error
  }
  return data
}

export async function updateBudgetType(
  supabase: SupabaseClient<Database>,
  params: { idBudgetType: string; name?: string; periodicity?: 'monthly' | 'annual'; archived?: boolean; idUser?: string | null }
): Promise<void> {
  const update: Database['public']['Tables']['pml_dim_budget_type']['Update'] = {}
  if (params.name !== undefined) {
    if (!params.name.trim()) throw new Error('La partida necesita un nombre')
    update.ds_budget_type = params.name.trim()
  }
  if (params.periodicity !== undefined) update.ds_periodicity = params.periodicity
  if (params.archived !== undefined) update.is_archived = params.archived
  if (params.idUser !== undefined) update.id_user = params.idUser

  const { error } = await supabase.from('pml_dim_budget_type').update(update).eq('id_budget_type', params.idBudgetType)
  if (error) {
    console.error('Error al actualizar la partida:', error)
    throw error
  }
}

/** Crea las partidas propias de la familia copiando las plantillas globales (solo si aún no tiene ninguna). */
export async function seedFamilyBudgetTypes(
  supabase: SupabaseClient<Database>,
  idFamily: string
): Promise<void> {
  const { data, error } = await supabase.from('pml_dim_budget_type').select('*').order('id_order', { ascending: true })
  if (error) throw error
  const rows = data || []
  if (rows.some((row) => row.id_family === idFamily)) return

  const templates = rows.filter((row) => !row.id_family)
  const hasVehicles = templates.some((row) => /veh[ií]culos/i.test(row.ds_budget_type))
  const { error: insertError } = await supabase.from('pml_dim_budget_type').insert([
    ...templates.map((template) => ({
      id_family: idFamily,
      ds_budget_type: template.ds_budget_type,
      ds_budget_type_key: `${template.ds_budget_type_key}_${idFamily.slice(0, 8)}`,
      ds_periodicity: template.ds_periodicity,
      id_order: template.id_order,
    })),
    // Partida de vehículos por defecto (con sus subpartidas, si están disponibles)
    ...(hasVehicles
      ? []
      : [
          {
            id_family: idFamily,
            ds_budget_type: 'Vehículos',
            ds_budget_type_key: `vehicles_${idFamily.slice(0, 8)}`,
            ds_periodicity: 'annual',
            id_order: Math.max(0, ...templates.map((row) => row.id_order)) + 1,
          },
        ]),
  ])
  if (insertError) {
    console.error('Error al crear las partidas iniciales:', insertError)
    throw insertError
  }

  if (!hasVehicles) {
    const { data: vehicles } = await supabase
      .from('pml_dim_budget_type')
      .select('id_budget_type')
      .eq('id_family', idFamily)
      .eq('ds_budget_type', 'Vehículos')
      .limit(1)
    const idVehicles = vehicles?.[0]?.id_budget_type
    if (idVehicles) {
      // Si la tabla de subpartidas aún no existe se ignora el error
      await supabase.from('pml_dim_budget_subtype').insert([
        { id_family: idFamily, id_budget_type: idVehicles, ds_budget_subtype: 'Seguro', id_order: 1 },
        { id_family: idFamily, id_budget_type: idVehicles, ds_budget_subtype: 'Reparaciones', id_order: 2 },
      ])
    }
  }
}

/**
 * Subpartidas de la familia (desglose opcional de una partida). Si la tabla aún no existe
 * (migración sin ejecutar) devuelve `available: false` en lugar de romper las pantallas.
 */
export async function getBudgetSubtypes(
  supabase: SupabaseClient<Database>,
  idFamily: string,
  options: { includeArchived?: boolean } = {}
): Promise<{ subtypes: BudgetSubtype[]; available: boolean }> {
  const { data, error } = await supabase
    .from('pml_dim_budget_subtype')
    .select('*')
    .eq('id_family', idFamily)
    .order('id_order', { ascending: true })
    .order('dt_created', { ascending: true })

  if (error) {
    console.warn('Subpartidas no disponibles:', error.message)
    return { subtypes: [], available: false }
  }
  const rows = data || []
  return { subtypes: options.includeArchived ? rows : rows.filter((row) => !row.is_archived), available: true }
}

export async function createBudgetSubtype(
  supabase: SupabaseClient<Database>,
  params: { idFamily: string; idBudgetType: string; name: string }
): Promise<BudgetSubtype> {
  const name = params.name.trim()
  if (!name) throw new Error('La subpartida necesita un nombre')

  const { data: existing, error: existingError } = await supabase
    .from('pml_dim_budget_subtype')
    .select('id_order, ds_budget_subtype, is_archived')
    .eq('id_budget_type', params.idBudgetType)
  if (existingError) throw existingError
  if ((existing || []).some((row) => !row.is_archived && row.ds_budget_subtype.toLowerCase() === name.toLowerCase())) {
    throw new Error(`Ya existe una subpartida llamada "${name}" en esta partida`)
  }

  const { data, error } = await supabase
    .from('pml_dim_budget_subtype')
    .insert({
      id_family: params.idFamily,
      id_budget_type: params.idBudgetType,
      ds_budget_subtype: name,
      id_order: Math.max(0, ...(existing || []).map((row) => row.id_order)) + 1,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Error al crear la subpartida:', error)
    throw error
  }
  return data
}

export async function updateBudgetSubtype(
  supabase: SupabaseClient<Database>,
  params: { idBudgetSubtype: string; name?: string; archived?: boolean }
): Promise<void> {
  const update: Database['public']['Tables']['pml_dim_budget_subtype']['Update'] = {}
  if (params.name !== undefined) {
    if (!params.name.trim()) throw new Error('La subpartida necesita un nombre')
    update.ds_budget_subtype = params.name.trim()
  }
  if (params.archived !== undefined) update.is_archived = params.archived

  const { error } = await supabase
    .from('pml_dim_budget_subtype')
    .update(update)
    .eq('id_budget_subtype', params.idBudgetSubtype)
  if (error) {
    console.error('Error al actualizar la subpartida:', error)
    throw error
  }
}

export async function getCurrentUserBudgets(
  supabase: SupabaseClient<Database>,
  idFamily: string
): Promise<CurrentUserBudget[]> {
  const { data, error } = await supabase
    .from('pml_cfg_user_budget')
    .select(
      `
      *,
      budget_type:pml_dim_budget_type(*)
    `
    )
    .eq('id_family', idFamily)
    .eq('is_active', true)
    .is('dt_end_month', null)
    .order('dt_start_month', { ascending: false })

  if (error) {
    console.error('Error al obtener presupuestos:', error)
    throw error
  }

  return (data || []) as CurrentUserBudget[]
}

export async function getUserBudgetHistory(
  supabase: SupabaseClient<Database>,
  idFamily: string
): Promise<CurrentUserBudget[]> {
  const { data, error } = await supabase
    .from('pml_cfg_user_budget')
    .select(
      `
      *,
      budget_type:pml_dim_budget_type(*)
    `
    )
    .eq('id_family', idFamily)
    .order('id_user', { ascending: true })
    .order('id_budget_type', { ascending: true })
    .order('dt_start_month', { ascending: false })

  if (error) {
    console.error('Error al obtener histórico de presupuestos:', error)
    throw error
  }

  return (data || []) as CurrentUserBudget[]
}

export async function saveUserBudgetVersion(
  supabase: SupabaseClient<Database>,
  params: {
    idFamily: string
    idUser: string
    idBudgetType: string
    amount: number
    startMonth: string
    /** Primer día del mes SIGUIENTE al último mes vigente (fecha límite). null/undefined = sin fecha límite */
    endMonth?: string | null
    /** El importe cubre todo el periodo (inicio → fin) en lugar de ser por año. Solo partidas anuales con fecha de fin */
    periodAmount?: boolean
    comments?: string | null
  }
): Promise<void> {
  const roundedAmount = Math.round((params.amount + Number.EPSILON) * 100) / 100

  const { data: versions, error: versionsError } = await supabase
    .from('pml_cfg_user_budget')
    .select('*')
    .eq('id_family', params.idFamily)
    .eq('id_user', params.idUser)
    .eq('id_budget_type', params.idBudgetType)
    .eq('is_active', true)
    .order('dt_start_month', { ascending: true })

  if (versionsError) {
    console.error('Error al buscar versiones del presupuesto:', versionsError)
    throw versionsError
  }

  const list = versions || []
  const start = params.startMonth

  // 1. Ya hay una versión que empieza ese mismo mes: se actualiza
  if (params.endMonth && params.endMonth <= start) {
    throw new Error('La fecha límite del presupuesto debe ser posterior a la de inicio')
  }
  const laterStart = (after: string) => list.find((version) => version.dt_start_month > after)?.dt_start_month ?? null
  // La fecha límite nunca puede pisar la versión siguiente
  const cap = (end: string | null | undefined, after: string): string | null => {
    const nextStart = laterStart(after)
    if (!end) return nextStart
    return nextStart && nextStart < end ? nextStart : end
  }

  const sameStart = list.find((version) => version.dt_start_month === start)
  if (sameStart) {
    const { error } = await supabase
      .from('pml_cfg_user_budget')
      .update({
        ft_budget_amount: roundedAmount,
        ds_comments: params.comments || null,
        ...(params.endMonth !== undefined ? { dt_end_month: cap(params.endMonth, start) } : {}),
        ...(params.periodAmount !== undefined && Boolean(sameStart.is_period_amount) !== params.periodAmount
          ? { is_period_amount: params.periodAmount }
          : {}),
      })
      .eq('id_user_budget', sameStart.id_user_budget)

    if (error) {
      console.error('Error al actualizar presupuesto:', error)
      throw error
    }
    return
  }

  // 2. Versión nueva. Puede ir al final (lo habitual), en medio o ANTES de todas las existentes.
  //    - Si hay una versión vigente en ese mes, se cierra justo ahí y la nueva hereda su fin.
  //    - Si no, la nueva dura hasta que empiece la siguiente versión (si la hay).
  const covering = list.find(
    (version) =>
      version.dt_start_month < start && (version.dt_end_month === null || version.dt_end_month > start)
  )
  const next = list.find((version) => version.dt_start_month > start)
  const inherited = covering ? covering.dt_end_month : next ? next.dt_start_month : null
  const newEnd = params.endMonth ? cap(params.endMonth, start) : inherited

  if (covering) {
    // Si el importe cubría un periodo completo y lo cerramos antes, se mantiene el ritmo mensual
    const coveringUpdate: { dt_end_month: string; ft_budget_amount?: number } = { dt_end_month: start }
    if (covering.is_period_amount && covering.dt_end_month) {
      const oldMonths = monthsBetweenDates(covering.dt_start_month, covering.dt_end_month)
      const newMonths = monthsBetweenDates(covering.dt_start_month, start)
      coveringUpdate.ft_budget_amount = Math.round(((covering.ft_budget_amount * newMonths) / oldMonths + Number.EPSILON) * 100) / 100
    }
    const { error } = await supabase
      .from('pml_cfg_user_budget')
      .update(coveringUpdate)
      .eq('id_user_budget', covering.id_user_budget)

    if (error) {
      console.error('Error al cerrar presupuesto anterior:', error)
      throw error
    }
  }

  // Sin indicar nada, la versión intermedia hereda el tipo de importe de la que parte
  const newIsPeriod =
    params.periodAmount !== undefined ? params.periodAmount : Boolean(covering?.is_period_amount) && newEnd !== null
  const { error } = await supabase.from('pml_cfg_user_budget').insert({
    id_family: params.idFamily,
    id_user: params.idUser,
    id_budget_type: params.idBudgetType,
    ft_budget_amount: roundedAmount,
    dt_start_month: start,
    dt_end_month: newEnd,
    ds_comments: params.comments || null,
    ...(newIsPeriod && newEnd !== null ? { is_period_amount: true } : {}),
  })

  if (error) {
    console.error('Error al crear presupuesto:', error)
    throw error
  }
}

export async function getSubcategoryBudgetDefaults(
  supabase: SupabaseClient<Database>,
  idFamily: string
): Promise<SubcategoryBudgetDefault[]> {
  const { data, error } = await supabase
    .from('pml_rel_subcategory_budget_type')
    .select('*')
    .eq('id_family', idFamily)

  if (error) {
    console.error('Error al obtener defaults de presupuesto:', error)
    throw error
  }

  return data || []
}

export async function upsertSubcategoryBudgetDefault(
  supabase: SupabaseClient<Database>,
  params: {
    idFamily: string
    idSubcategory: string
    idBudgetType: string
  }
): Promise<void> {
  const { error } = await supabase
    .from('pml_rel_subcategory_budget_type')
    .upsert(
      {
        id_family: params.idFamily,
        id_subcategory: params.idSubcategory,
        id_budget_type: params.idBudgetType,
      },
      { onConflict: 'id_family,id_subcategory' }
    )

  if (error) {
    console.error('Error al guardar default de presupuesto:', error)
    throw error
  }
}

export async function deleteSubcategoryBudgetDefault(
  supabase: SupabaseClient<Database>,
  params: {
    idFamily: string
    idSubcategory: string
  }
): Promise<void> {
  const { error } = await supabase
    .from('pml_rel_subcategory_budget_type')
    .delete()
    .eq('id_family', params.idFamily)
    .eq('id_subcategory', params.idSubcategory)

  if (error) {
    console.error('Error al eliminar default de presupuesto:', error)
    throw error
  }
}

export async function deleteCategoryBudgetDefaults(
  supabase: SupabaseClient<Database>,
  params: {
    idFamily: string
    idSubcategoryList: string[]
  }
): Promise<void> {
  if (params.idSubcategoryList.length === 0) return

  const { error } = await supabase
    .from('pml_rel_subcategory_budget_type')
    .delete()
    .eq('id_family', params.idFamily)
    .in('id_subcategory', params.idSubcategoryList)

  if (error) {
    console.error('Error al eliminar defaults de vertical:', error)
    throw error
  }
}
