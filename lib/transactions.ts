import type { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { convertMonthYearToDBFormat, formatMonthDeclared } from './date-utils'
import { associateTagToTransaction } from './tags'
import { associateUsersToTransaction } from './family'
import type { TransactionInsert, TransactionUpdate } from '@/types/transactions'

type Transaction = Database['public']['Tables']['gnp_fct_transactions']['Row']

/**
 * Crea una nueva transacción
 * @param supabase - Cliente de Supabase
 * @param transactionData - Datos de la transacción
 * @param ds_month_declared - Mes declarado en formato MM-YYYY (se convierte a YYYY-MM)
 * @param id_tag - ID de la tag opcional (se asocia después de crear la transacción)
 * @param userIds - Array de IDs de usuarios afectados (se asocian después de crear la transacción)
 * @returns Transacción creada
 */
export async function createTransaction(
  supabase: SupabaseClient<Database>,
  transactionData: Omit<TransactionInsert, 'ds_month_declared'> & {
    dt_date: string
  },
  ds_month_declared: string, // Formato MM-YYYY
  id_tag?: string | null,
  userIds?: string[]
): Promise<Transaction> {
  // Convertir MM-YYYY a YYYY-MM
  const ds_month_declared_db = convertMonthYearToDBFormat(ds_month_declared)

  // Asegurar que el amount se redondee correctamente antes de insertar
  const roundedAmount = Math.round((transactionData.ft_amount + Number.EPSILON) * 100) / 100

  const { data, error } = await supabase
    .from('gnp_fct_transactions')
    .insert({
      ...transactionData,
      ft_amount: roundedAmount,
      ds_month_declared: ds_month_declared_db,
    })
    .select()
    .single()

  if (error) {
    console.error('Error al crear transacción:', error)
    throw error
  }

  // Si hay tag, asociarla a la transacción
  if (id_tag && data) {
    try {
      await associateTagToTransaction(supabase, data.id_transaction, id_tag)
    } catch (tagError) {
      console.error('Error al asociar tag a transacción:', tagError)
      // No lanzamos el error para no fallar la creación de la transacción
    }
  }

  // Si hay usuarios, asociarlos a la transacción
  if (userIds && userIds.length > 0 && data) {
    try {
      // Dividir el importe entre el número de usuarios
      // Para evitar problemas de precisión, calculamos el amount para cada usuario
      // y el último recibe el resto para asegurar que la suma sea exacta
      const totalAmount = roundedAmount
      const numUsers = userIds.length
      const baseAmountPerUser = Math.floor((totalAmount / numUsers) * 100) / 100 // Redondear hacia abajo a 2 decimales
      
      // Calcular los amounts para cada usuario
      const amounts: number[] = []
      let sumSoFar = 0
      
      for (let i = 0; i < numUsers - 1; i++) {
        amounts.push(baseAmountPerUser)
        sumSoFar += baseAmountPerUser
      }
      
      // El último usuario recibe el resto para que la suma sea exacta
      const lastAmount = Math.round((totalAmount - sumSoFar) * 100) / 100
      amounts.push(lastAmount)
      
      // Crear las relaciones con los amounts calculados
      const relations = userIds.map((id_user, index) => ({
        id_transaction: data.id_transaction,
        id_user: id_user,
        ft_amount_user: amounts[index],
      }))
      
      const { error } = await supabase
        .from('pml_rel_transaction_user')
        .insert(relations)
      
      if (error) {
        console.error('Error al asociar usuarios a transacción:', error)
        throw error
      }
    } catch (userError) {
      console.error('Error al asociar usuarios a transacción:', userError)
      // No lanzamos el error para no fallar la creación de la transacción
    }
  }

  return data
}

/**
 * Obtiene una transacción por su ID
 * @param supabase - Cliente de Supabase
 * @param idTransaction - ID de la transacción
 * @returns Transacción o null si no se encuentra
 */
export async function getTransaction(
  supabase: SupabaseClient<Database>,
  idTransaction: string
): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('gnp_fct_transactions')
    .select('*')
    .eq('id_transaction', idTransaction)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No encontrado
      return null
    }
    console.error('Error al obtener transacción:', error)
    throw error
  }

  return data
}

/**
 * Obtiene una transacción con todas sus relaciones para edición
 * @param supabase - Cliente de Supabase
 * @param idTransaction - ID de la transacción
 * @returns Transacción con relaciones o null si no se encuentra
 */
export async function getTransactionWithRelations(
  supabase: SupabaseClient<Database>,
  idTransaction: string
): Promise<TransactionWithRelations | null> {
  // Obtener transacción base
  const transaction = await getTransaction(supabase, idTransaction)
  if (!transaction) return null

  // Obtener relaciones en paralelo
  const [tagResult, usersResult, categoryResult, subcategoryResult, typeResult] = await Promise.all([
    // Tag
    supabase
      .from('pml_rel_transaction_tag')
      .select('id_tag')
      .eq('id_transaction', idTransaction)
      .maybeSingle(),
    
    // Usuarios
    supabase
      .from('pml_rel_transaction_user')
      .select('id_user, ft_amount_user')
      .eq('id_transaction', idTransaction),
    
    // Categoría
    transaction.id_category
      ? supabase
          .from('pml_dim_category')
          .select('id_category, ds_category')
          .eq('id_category', transaction.id_category)
          .single()
      : Promise.resolve({ data: null }),
    
    // Subcategoría
    transaction.id_subcategory
      ? supabase
          .from('pml_dim_subcategory')
          .select('id_subcategory, ds_subcategory')
          .eq('id_subcategory', transaction.id_subcategory)
          .single()
      : Promise.resolve({ data: null }),
    
    // Tipo
    transaction.id_type
      ? supabase
          .from('pml_dim_transaction_type')
          .select('ds_type')
          .eq('id_type', transaction.id_type)
          .single()
      : Promise.resolve({ data: null }),
  ])

  // Obtener tag si existe
  let tag = null
  if (tagResult.data?.id_tag) {
    const { data: tagData } = await supabase
      .from('pml_dim_tag')
      .select('id_tag, ds_tag')
      .eq('id_tag', tagResult.data.id_tag)
      .single()
    if (tagData) {
      tag = { id_tag: tagData.id_tag, ds_tag: tagData.ds_tag }
    }
  }

  // Obtener usuarios con nombres
  const userIds = (usersResult.data?.map(u => u.id_user).filter((id): id is string => id !== null) || [])
  let users: Array<{ id_user: string; ds_user: string | null; ft_amount_user: number }> = []
  if (userIds.length > 0) {
    const { data: usersData } = await supabase
      .from('pml_dim_user')
      .select('id_user, ds_user')
      .in('id_user', userIds)
    
    const userMap = new Map((usersData || []).map(u => [u.id_user, u.ds_user]))
    users = (usersResult.data || [])
      .filter(u => u.id_user !== null)
      .map(u => ({
        id_user: u.id_user!,
        ds_user: userMap.get(u.id_user!) || null,
        ft_amount_user: u.ft_amount_user,
      }))
  }

  return {
    ...transaction,
    category: categoryResult.data ? {
      id_category: categoryResult.data.id_category,
      ds_category: categoryResult.data.ds_category,
    } : null,
    subcategory: subcategoryResult.data ? {
      id_subcategory: subcategoryResult.data.id_subcategory,
      ds_subcategory: subcategoryResult.data.ds_subcategory,
    } : null,
    tag,
    users,
    transactionType: typeResult.data?.ds_type as 'Income' | 'Expense' | null,
  }
}

/**
 * Actualiza una transacción
 * @param supabase - Cliente de Supabase
 * @param idTransaction - ID de la transacción
 * @param transactionData - Datos a actualizar
 * @returns Transacción actualizada
 */
export async function updateTransaction(
  supabase: SupabaseClient<Database>,
  idTransaction: string,
  transactionData: TransactionUpdate & {
    dt_date?: string
  }
): Promise<Transaction> {
  // Si se actualiza dt_date, recalcular ds_month_declared
  const updateData: TransactionUpdate = { ...transactionData }
  
  if (transactionData.dt_date) {
    updateData.ds_month_declared = formatMonthDeclared(transactionData.dt_date)
  }

  const { data, error } = await supabase
    .from('gnp_fct_transactions')
    .update(updateData)
    .eq('id_transaction', idTransaction)
    .select()
    .single()

  if (error) {
    console.error('Error al actualizar transacción:', error)
    throw error
  }

  return data
}

/**
 * Actualiza una transacción completa incluyendo relaciones (tags y usuarios)
 * @param supabase - Cliente de Supabase
 * @param idTransaction - ID de la transacción
 * @param transactionData - Datos de la transacción a actualizar
 * @param ds_month_declared - Mes declarado en formato MM-YYYY (opcional, se calcula de dt_date si no se proporciona)
 * @param id_tag - ID de la tag opcional (null para eliminar)
 * @param userIds - Array de IDs de usuarios afectados (opcional)
 * @returns Transacción actualizada
 */
export async function updateTransactionComplete(
  supabase: SupabaseClient<Database>,
  idTransaction: string,
  transactionData: Omit<TransactionUpdate, 'ds_month_declared'> & {
    dt_date?: string
  },
  ds_month_declared?: string, // Formato MM-YYYY
  id_tag?: string | null,
  userIds?: string[]
): Promise<Transaction> {
  // Calcular mes declarado
  let ds_month_declared_db: string
  if (ds_month_declared) {
    ds_month_declared_db = convertMonthYearToDBFormat(ds_month_declared)
  } else if (transactionData.dt_date) {
    ds_month_declared_db = formatMonthDeclared(transactionData.dt_date)
  } else {
    // Obtener la transacción actual para mantener el mes declarado
    const current = await getTransaction(supabase, idTransaction)
    if (!current) {
      throw new Error('Transacción no encontrada')
    }
    ds_month_declared_db = current.ds_month_declared || ''
  }

  // Redondear amount si existe
  const updateData: TransactionUpdate = { ...transactionData }
  if (updateData.ft_amount !== undefined) {
    updateData.ft_amount = Math.round((updateData.ft_amount + Number.EPSILON) * 100) / 100
  }
  updateData.ds_month_declared = ds_month_declared_db

  // Actualizar transacción base
  const updated = await updateTransaction(supabase, idTransaction, updateData)

  // Actualizar tag: eliminar todas las relaciones existentes y crear nueva si existe
  await supabase
    .from('pml_rel_transaction_tag')
    .delete()
    .eq('id_transaction', idTransaction)

  if (id_tag) {
    await associateTagToTransaction(supabase, idTransaction, id_tag)
  }

  // Actualizar usuarios: eliminar todas las relaciones existentes y crear nuevas si existen
  await supabase
    .from('pml_rel_transaction_user')
    .delete()
    .eq('id_transaction', idTransaction)

  if (userIds && userIds.length > 0) {
    const totalAmount = updateData.ft_amount !== undefined ? updateData.ft_amount : updated.ft_amount
    const numUsers = userIds.length
    const baseAmountPerUser = Math.floor((totalAmount / numUsers) * 100) / 100
    const amounts: number[] = []
    let sumSoFar = 0
    
    for (let i = 0; i < numUsers - 1; i++) {
      amounts.push(baseAmountPerUser)
      sumSoFar += baseAmountPerUser
    }
    
    const lastAmount = Math.round((totalAmount - sumSoFar) * 100) / 100
    amounts.push(lastAmount)
    
    const relations = userIds.map((id_user, index) => ({
      id_transaction: idTransaction,
      id_user: id_user,
      ft_amount_user: amounts[index],
    }))
    
    const { error } = await supabase
      .from('pml_rel_transaction_user')
      .insert(relations)
    
    if (error) {
      console.error('Error al actualizar usuarios de transacción:', error)
      throw error
    }
  }

  return updated
}

/**
 * Elimina una transacción
 * @param supabase - Cliente de Supabase
 * @param idTransaction - ID de la transacción
 */
export async function deleteTransaction(
  supabase: SupabaseClient<Database>,
  idTransaction: string
): Promise<void> {
  const { error } = await supabase
    .from('gnp_fct_transactions')
    .delete()
    .eq('id_transaction', idTransaction)

  if (error) {
    console.error('Error al eliminar transacción:', error)
    throw error
  }
}

/**
 * Obtiene todas las transacciones de una familia
 * @param supabase - Cliente de Supabase
 * @param idFamily - ID de la familia
 * @param limit - Límite de resultados (opcional)
 * @returns Array de transacciones
 */
export async function getTransactionsByFamily(
  supabase: SupabaseClient<Database>,
  idFamily: string,
  limit?: number
): Promise<Transaction[]> {
  let query = supabase
    .from('gnp_fct_transactions')
    .select('*')
    .eq('id_family', idFamily)
    .order('dt_date', { ascending: false })
    .order('dt_created', { ascending: false })

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error al obtener transacciones:', error)
    throw error
  }

  return data || []
}

// ==================== FUNCIONES DE ANALÍTICA ====================

// ==================== UTILIDADES ESTADÍSTICAS ====================

/**
 * Calcula la mediana de un array de números
 * La mediana es más robusta que el promedio ante outliers
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  
  return sorted[middle]
}

/**
 * Calcula el promedio de un array de números
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0
  const sum = values.reduce((acc, val) => acc + val, 0)
  return sum / values.length
}

/**
 * Redondea un número a 2 decimales usando Number.EPSILON
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export interface TransactionWithRelations extends Transaction {
  category?: { id_category: string; ds_category: string } | null
  subcategory?: { id_subcategory: string; ds_subcategory: string } | null
  tag?: { id_tag: string; ds_tag: string } | null
  users?: Array<{ id_user: string; ds_user: string | null; ft_amount_user: number }>
  transactionType?: 'Income' | 'Expense' | null // Añadido para evitar queries adicionales
}

export interface AnalyticsFilters {
  idFamily: string
  idUsers?: string[] | null // Array de IDs de usuarios (multipicklist)
  idCategories?: string[] | null // Array de IDs de categorías (multipicklist)
  idSubcategories?: string[] | null // Array de IDs de subcategorías (multipicklist)
  idTags?: string[] | null // Array de IDs de tags (multipicklist)
  monthsDeclared?: string[] | null // Array de meses declarados en formato YYYY-MM (multipicklist)
  dateFrom?: string | null // Fecha desde en formato YYYY-MM-DD
  dateTo?: string | null // Fecha hasta en formato YYYY-MM-DD
  startMonth?: string | null // Mes declarado desde en formato YYYY-MM
  endMonth?: string | null // Mes declarado hasta en formato YYYY-MM
  // Mantener compatibilidad con versiones anteriores
  idUser?: string | null
  idCategory?: string | null
  idSubcategory?: string | null
  idTag?: string | null
}

export interface MonthlySummary {
  month: string // Formato YYYY-MM
  monthDisplay: string // Formato MM-YYYY para mostrar
  income: number
  expense: number
  benefit: number
}

export interface CategorySummary {
  id_category: string
  ds_category: string
  total: number
  percentage: number
  transactions: number
}

export interface SubcategorySummary {
  id_subcategory: string
  ds_subcategory: string
  id_category: string
  ds_category: string
  total: number
  percentage: number
  transactions: number
}

export interface MonthlySavings {
  month: string // Formato YYYY-MM
  monthDisplay: string // Formato MM-YYYY
  savings: number // Ahorro puntual del mes
  cumulativeSavings: number // Ahorro acumulado hasta ese mes
  income: number
  expense: number
}

export interface MonthComparison {
  monthA: string // Mes A (formato YYYY-MM)
  monthB: string // Mes B (formato YYYY-MM)
  incomeA: number
  incomeB: number
  expenseA: number
  expenseB: number
  benefitA: number
  benefitB: number
  top5ExpensesA: TransactionWithRelations[]
  top5ExpensesB: TransactionWithRelations[]
  top5IncomesA: TransactionWithRelations[]
  top5IncomesB: TransactionWithRelations[]
  top5CategoriesA: CategorySummary[]
  top5CategoriesB: CategorySummary[]
  top5SubcategoriesA: SubcategorySummary[]
  top5SubcategoriesB: SubcategorySummary[]
  categoryDifferences: Array<{
    category: string
    monthA: number
    monthB: number
    difference: number // Diferencia en €
    differencePercent: number // Diferencia en %
  }>
}

export interface KPISummary {
  benefit: number // Beneficio total (antes netIncome)
  savingsRate: number // Tasa de ahorro (mediana) en %
  savingsRateAmount: number // Tasa de ahorro en valor absoluto (€)
  projectedDecember: number // Proyección a fin de año
  projectedMonths: number // Meses estimados para la proyección
  medianMonthlySavings: number // Ahorro mensual mediano
  averageMonthlyIncome: number // Ingreso mensual promedio
  averageMonthlyExpense: number // Gasto mensual promedio
}

export interface MonthlyProjection {
  month: string // Formato YYYY-MM
  monthDisplay: string // Formato MM-YYYY
  projectedBenefit: number // Beneficio proyectado
  cumulativeProjected: number // Acumulado proyectado
}

export interface CategoryMonthlyEvolution {
  id_category: string
  ds_category: string
  monthlyData: Array<{
    month: string
    monthDisplay: string
    total: number
    percentage: number
  }>
  total: number
  averageMonthly: number
}

export interface SubcategoryMonthlyEvolution {
  id_subcategory: string
  ds_subcategory: string
  id_category: string
  ds_category: string
  monthlyData: Array<{
    month: string
    monthDisplay: string
    total: number
    percentage: number
  }>
  total: number
  averageMonthly: number
}

export interface MonthAnalysis {
  month: string
  monthDisplay: string
  income: number
  expense: number
  benefit: number
  transactions: TransactionWithRelations[]
  categoryDistribution: CategorySummary[]
  subcategoryDistribution: SubcategorySummary[]
  top5Expenses: TransactionWithRelations[]
  top5Incomes: TransactionWithRelations[]
  top5Categories: CategorySummary[]
  top5Subcategories: SubcategorySummary[]
}

/**
 * Obtiene transacciones con todas sus relaciones para analítica
 */
export async function getTransactionsForAnalytics(
  supabase: SupabaseClient<Database>,
  filters: AnalyticsFilters
): Promise<TransactionWithRelations[]> {
  // Query base de transacciones
  let query = supabase
    .from('gnp_fct_transactions')
    .select('*')
    .eq('id_family', filters.idFamily)

  // Filtros de categoría (soporta array y valor único para compatibilidad)
  if (filters.idCategories && filters.idCategories.length > 0) {
    query = query.in('id_category', filters.idCategories)
  } else if (filters.idCategory) {
    query = query.eq('id_category', filters.idCategory)
  }

  // Filtros de subcategoría (soporta array y valor único para compatibilidad)
  if (filters.idSubcategories && filters.idSubcategories.length > 0) {
    query = query.in('id_subcategory', filters.idSubcategories)
  } else if (filters.idSubcategory) {
    query = query.eq('id_subcategory', filters.idSubcategory)
  }

  // Filtros de mes declarado (rango)
  if (filters.startMonth) {
    query = query.gte('ds_month_declared', filters.startMonth)
  }

  if (filters.endMonth) {
    query = query.lte('ds_month_declared', filters.endMonth)
  }

  // Filtros de mes declarado (multipicklist)
  if (filters.monthsDeclared && filters.monthsDeclared.length > 0) {
    query = query.in('ds_month_declared', filters.monthsDeclared)
  }

  // Filtros de fecha
  if (filters.dateFrom) {
    query = query.gte('dt_date', filters.dateFrom)
  }

  if (filters.dateTo) {
    query = query.lte('dt_date', filters.dateTo)
  }

  const { data: transactions, error } = await query.order('dt_date', { ascending: false })

  if (error) {
    console.error('Error al obtener transacciones para analítica:', error)
    throw error
  }

  if (!transactions || transactions.length === 0) {
    return []
  }

  // Obtener IDs únicos para hacer queries eficientes
  const categoryIds = Array.from(new Set(transactions.map(t => t.id_category).filter((id): id is string => id !== null)))
  const subcategoryIds = Array.from(new Set(transactions.map(t => t.id_subcategory).filter((id): id is string => id !== null)))
  const transactionIds = transactions.map(t => t.id_transaction)
  const typeIds = Array.from(new Set(transactions.map(t => t.id_type).filter((id): id is string => id !== null)))

  // Ejecutar todas las queries en paralelo para mejor rendimiento
  const [
    categoriesResult,
    subcategoriesResult,
    transactionTagsResult,
    transactionUsersResult,
    transactionTypesResult,
  ] = await Promise.all([
    // Query 1: Categorías
    categoryIds.length > 0
      ? supabase
          .from('pml_dim_category')
          .select('id_category, ds_category')
          .in('id_category', categoryIds)
      : Promise.resolve({ data: [] }),
    
    // Query 2: Subcategorías
    subcategoryIds.length > 0
      ? supabase
          .from('pml_dim_subcategory')
          .select('id_subcategory, ds_subcategory')
          .in('id_subcategory', subcategoryIds)
      : Promise.resolve({ data: [] }),
    
    // Query 3: Tags de transacciones
    supabase
      .from('pml_rel_transaction_tag')
      .select('id_transaction, id_tag')
      .in('id_transaction', transactionIds),
    
    // Query 4: Usuarios de transacciones
    supabase
      .from('pml_rel_transaction_user')
      .select('id_transaction, id_user, ft_amount_user')
      .in('id_transaction', transactionIds),
    
    // Query 5: Tipos de transacción (NUEVO - evita queries N+1)
    typeIds.length > 0
      ? supabase
          .from('pml_dim_transaction_type')
          .select('id_type, ds_type')
          .in('id_type', typeIds)
      : Promise.resolve({ data: [] }),
  ])

  // Procesar resultados
  const categories = categoriesResult.data || []
  const subcategories = subcategoriesResult.data || []
  const transactionTags = transactionTagsResult.data || []
  const transactionUsers = transactionUsersResult.data || []
  const transactionTypes = transactionTypesResult.data || []

  // Crear mapas para acceso rápido
  const categoryMap = new Map(categories.map(c => [c.id_category, c]))
  const subcategoryMap = new Map(subcategories.map(s => [s.id_subcategory, s]))
  const typeMap = new Map(transactionTypes.map(t => [t.id_type, t.ds_type as 'Income' | 'Expense']))

  // Procesar tags
  const tagIds = Array.from(new Set(transactionTags.map(tt => tt.id_tag).filter((id): id is string => id !== null)))
  const { data: tags } = tagIds.length > 0
    ? await supabase.from('pml_dim_tag').select('id_tag, ds_tag').in('id_tag', tagIds)
    : { data: [] }

  const tagMap = new Map((tags || []).map(t => [t.id_tag, t]))
  const transactionTagMap = new Map<string, string>()
  transactionTags.forEach(tt => {
    if (tt.id_transaction && tt.id_tag) {
      transactionTagMap.set(tt.id_transaction, tt.id_tag)
    }
  })

  // Procesar usuarios
  const userIds = Array.from(new Set(transactionUsers.map(tu => tu.id_user).filter((id): id is string => id !== null)))
  const { data: users } = userIds.length > 0
    ? await supabase.from('pml_dim_user').select('id_user, ds_user').in('id_user', userIds)
    : { data: [] }

  const userMap = new Map((users || []).map(u => [u.id_user, u]))
  const transactionUserMap = new Map<string, Array<{ id_user: string; ds_user: string | null; ft_amount_user: number }>>()
  transactionUsers.forEach(tu => {
    if (tu.id_transaction && tu.id_user) {
      const user = userMap.get(tu.id_user)
      if (!transactionUserMap.has(tu.id_transaction)) {
        transactionUserMap.set(tu.id_transaction, [])
      }
      transactionUserMap.get(tu.id_transaction)!.push({
        id_user: tu.id_user,
        ds_user: user?.ds_user || null,
        ft_amount_user: tu.ft_amount_user,
      })
    }
  })

  // Combinar todo
  const processed = transactions
    .map(transaction => {
      const category = transaction.id_category ? categoryMap.get(transaction.id_category) : null
      const subcategory = transaction.id_subcategory ? subcategoryMap.get(transaction.id_subcategory) : null
      const tagId = transactionTagMap.get(transaction.id_transaction)
      const tag = tagId ? tagMap.get(tagId) : null
      const users = transactionUserMap.get(transaction.id_transaction) || []
      const transactionType = transaction.id_type ? typeMap.get(transaction.id_type) : null

      // Filtrar por usuarios si se especifica (soporta array y valor único para compatibilidad)
      let filteredUsers = users
      let adjustedAmount = transaction.ft_amount
      
      if (filters.idUsers && filters.idUsers.length > 0) {
        // Filtrar usuarios que coincidan con los seleccionados
        filteredUsers = users.filter(u => filters.idUsers!.includes(u.id_user))
        // Si no hay usuarios que coincidan, excluir la transacción
        if (filteredUsers.length === 0) {
          return null
        }
        // Sumar los amounts de todos los usuarios seleccionados
        adjustedAmount = filteredUsers.reduce((sum, u) => sum + (u.ft_amount_user || 0), 0)
        // Si el total es 0 o nulo, excluir la transacción
        if (adjustedAmount === 0) {
          return null
        }
      } else if (filters.idUser) {
        // Compatibilidad con versión anterior
        filteredUsers = users.filter(u => u.id_user === filters.idUser)
        const userAmount = filteredUsers[0]?.ft_amount_user
        // Solo incluir transacciones donde el usuario tiene un valor distinto de cero o nulo
        if (userAmount === null || userAmount === undefined || userAmount === 0) {
          return null
        }
        adjustedAmount = userAmount
      }

      // Filtrar por tags si se especifica (soporta array y valor único para compatibilidad)
      if (filters.idTags && filters.idTags.length > 0) {
        if (!tagId || !filters.idTags.includes(tagId)) {
          return null
        }
      } else if (filters.idTag && tagId !== filters.idTag) {
        return null
      }

      return {
        ...transaction,
        ft_amount: adjustedAmount,
        transactionType, // Añadido para evitar queries adicionales
        category: category ? {
          id_category: category.id_category,
          ds_category: category.ds_category,
        } : null,
        subcategory: subcategory ? {
          id_subcategory: subcategory.id_subcategory,
          ds_subcategory: subcategory.ds_subcategory,
        } : null,
        tag: tag ? {
          id_tag: tag.id_tag,
          ds_tag: tag.ds_tag,
        } : null,
        users: filteredUsers,
      }
    })
    .filter((t) => t !== null) as TransactionWithRelations[]

  return processed
}

/**
 * Calcula totales de ingresos, gastos y beneficios
 * OPTIMIZADO: Usa el tipo ya incluido en las transacciones, sin queries adicionales
 */
export function calculateTotalSummary(
  transactions: TransactionWithRelations[]
): { income: number; expense: number; benefit: number } {
  let income = 0
  let expense = 0

  for (const transaction of transactions) {
    // Usar el tipo ya incluido en la transacción (sin query adicional)
    const isIncome = transaction.transactionType === 'Income'
    const amount = transaction.ft_amount || 0

    if (isIncome) {
      income += amount
    } else {
      expense += amount
    }
  }

  return {
    income: roundToTwoDecimals(income),
    expense: roundToTwoDecimals(expense),
    benefit: roundToTwoDecimals(income - expense),
  }
}

/**
 * @deprecated Usar calculateTotalSummary en su lugar. Mantenido para compatibilidad.
 */
export async function getTotalSummary(
  supabase: SupabaseClient<Database>,
  filters: AnalyticsFilters
): Promise<{ income: number; expense: number; benefit: number }> {
  const transactions = await getTransactionsForAnalytics(supabase, filters)
  return calculateTotalSummary(transactions)
}

/**
 * Calcula resumen por mes declarado
 * OPTIMIZADO: Usa el tipo ya incluido en las transacciones, sin queries adicionales
 */
export function calculateMonthlySummary(
  transactions: TransactionWithRelations[]
): MonthlySummary[] {
  // Agrupar por mes
  const monthlyData: Record<string, { income: number; expense: number }> = {}

  for (const transaction of transactions) {
    const month = transaction.ds_month_declared
    if (!month) continue

    if (!monthlyData[month]) {
      monthlyData[month] = { income: 0, expense: 0 }
    }

    // Usar el tipo ya incluido en la transacción (sin query adicional)
    const isIncome = transaction.transactionType === 'Income'
    const amount = transaction.ft_amount || 0

    if (isIncome) {
      monthlyData[month].income += amount
    } else {
      monthlyData[month].expense += amount
    }
  }

  // Convertir a array y ordenar por mes
  const summary: MonthlySummary[] = Object.entries(monthlyData)
    .map(([month, data]) => {
      const [year, monthNum] = month.split('-')
      return {
        month,
        monthDisplay: `${monthNum}-${year}`,
        income: roundToTwoDecimals(data.income),
        expense: roundToTwoDecimals(data.expense),
        benefit: roundToTwoDecimals(data.income - data.expense),
      }
    })
    .sort((a, b) => a.month.localeCompare(b.month))

  return summary
}

/**
 * Calcula ahorro mensual (puntual y acumulado)
 */
export function calculateMonthlySavings(
  transactions: TransactionWithRelations[]
): MonthlySavings[] {
  const monthlySummary = calculateMonthlySummary(transactions)
  
  let cumulativeSavings = 0
  
  return monthlySummary.map((month) => {
    const savings = month.benefit
    cumulativeSavings += savings
    
    return {
      month: month.month,
      monthDisplay: month.monthDisplay,
      savings: roundToTwoDecimals(savings),
      cumulativeSavings: roundToTwoDecimals(cumulativeSavings),
      income: month.income,
      expense: month.expense,
    }
  })
}

/**
 * Calcula KPIs principales usando medianas
 */
export function calculateKPISummary(
  transactions: TransactionWithRelations[]
): KPISummary {
  const monthlySummary = calculateMonthlySummary(transactions)
  
  if (monthlySummary.length === 0) {
    return {
      benefit: 0,
      savingsRate: 0,
      savingsRateAmount: 0,
      projectedDecember: 0,
      projectedMonths: 0,
      medianMonthlySavings: 0,
      averageMonthlyIncome: 0,
      averageMonthlyExpense: 0,
    }
  }
  
  // Calcular totales
  const totalIncome = monthlySummary.reduce((sum, m) => sum + m.income, 0)
  const totalExpense = monthlySummary.reduce((sum, m) => sum + m.expense, 0)
  const netIncome = roundToTwoDecimals(totalIncome - totalExpense)
  
  // Calcular medianas y promedios
  const savings = monthlySummary.map(m => m.benefit)
  const incomes = monthlySummary.map(m => m.income)
  const expenses = monthlySummary.map(m => m.expense)
  
  const medianSavings = calculateMedian(savings)
  const avgIncome = calculateAverage(incomes)
  const avgExpense = calculateAverage(expenses)
  
  // Tasa de ahorro (mediana de beneficios / mediana de ingresos)
  const medianIncome = calculateMedian(incomes)
  const savingsRate = medianIncome > 0 
    ? roundToTwoDecimals((medianSavings / medianIncome) * 100)
    : 0
  const savingsRateAmount = roundToTwoDecimals(medianSavings)
  
  // Proyección a diciembre: meses desde el mes actual hasta diciembre (excluyendo mes actual)
  const currentDate = new Date()
  const currentMonth = currentDate.getMonth() + 1 // 1-12
  const currentYear = currentDate.getFullYear()
  
  // Obtener mediana excluyendo el mes actual
  const monthsExcludingCurrent = monthlySummary.filter(m => {
    const [year, month] = m.month.split('-').map(Number)
    return !(year === currentYear && month === currentMonth)
  })
  
  const medianExcludingCurrent = monthsExcludingCurrent.length > 0
    ? calculateMedian(monthsExcludingCurrent.map(m => m.benefit))
    : medianSavings
  
  // Meses desde el mes siguiente hasta diciembre (inclusive)
  const monthsRemaining = 12 - currentMonth // Meses desde mes siguiente hasta diciembre
  const projectedDecember = roundToTwoDecimals(
    netIncome + (medianExcludingCurrent * monthsRemaining)
  )
  
  return {
    benefit: netIncome, // Cambiado de netIncome a benefit
    savingsRate,
    savingsRateAmount,
    projectedDecember,
    projectedMonths: monthsRemaining,
    medianMonthlySavings: roundToTwoDecimals(medianSavings),
    averageMonthlyIncome: roundToTwoDecimals(avgIncome),
    averageMonthlyExpense: roundToTwoDecimals(avgExpense),
  }
}

/**
 * Compara dos meses seleccionados con análisis completo
 */
export function compareMonths(
  transactions: TransactionWithRelations[],
  monthA: string, // Formato YYYY-MM
  monthB: string  // Formato YYYY-MM
): MonthComparison {
  // Filtrar transacciones por mes
  const transactionsA = transactions.filter(t => t.ds_month_declared === monthA)
  const transactionsB = transactions.filter(t => t.ds_month_declared === monthB)
  
  // Calcular resúmenes por mes
  const summaryA = calculateTotalSummary(transactionsA)
  const summaryB = calculateTotalSummary(transactionsB)
  
  // Top 5 gastos e ingresos
  const expensesA = transactionsA
    .filter(t => t.transactionType === 'Expense')
    .sort((a, b) => (b.ft_amount || 0) - (a.ft_amount || 0))
    .slice(0, 5)
  
  const expensesB = transactionsB
    .filter(t => t.transactionType === 'Expense')
    .sort((a, b) => (b.ft_amount || 0) - (a.ft_amount || 0))
    .slice(0, 5)
  
  const incomesA = transactionsA
    .filter(t => t.transactionType === 'Income')
    .sort((a, b) => (b.ft_amount || 0) - (a.ft_amount || 0))
    .slice(0, 5)
  
  const incomesB = transactionsB
    .filter(t => t.transactionType === 'Income')
    .sort((a, b) => (b.ft_amount || 0) - (a.ft_amount || 0))
    .slice(0, 5)
  
  // Top 5 categorías y subcategorías
  const categoriesA = calculateCategorySummary(transactionsA).slice(0, 5)
  const categoriesB = calculateCategorySummary(transactionsB).slice(0, 5)
  const subcategoriesA = calculateSubcategorySummary(transactionsA).slice(0, 5)
  const subcategoriesB = calculateSubcategorySummary(transactionsB).slice(0, 5)
  
  // Diferencias por categoría
  const categoryDataA: Record<string, number> = {}
  const categoryDataB: Record<string, number> = {}
  
  transactionsA
    .filter(t => t.transactionType === 'Expense' && t.category)
    .forEach(t => {
      const catId = t.category!.id_category
      categoryDataA[catId] = (categoryDataA[catId] || 0) + (t.ft_amount || 0)
    })
  
  transactionsB
    .filter(t => t.transactionType === 'Expense' && t.category)
    .forEach(t => {
      const catId = t.category!.id_category
      categoryDataB[catId] = (categoryDataB[catId] || 0) + (t.ft_amount || 0)
    })
  
  const categoryNames = new Map<string, string>()
  transactions.forEach(t => {
    if (t.category) {
      categoryNames.set(t.category.id_category, t.category.ds_category)
    }
  })
  
  const allCategories = new Set([
    ...Object.keys(categoryDataA),
    ...Object.keys(categoryDataB),
  ])
  
  const categoryDifferences = Array.from(allCategories).map(catId => {
    const valueA = roundToTwoDecimals(categoryDataA[catId] || 0)
    const valueB = roundToTwoDecimals(categoryDataB[catId] || 0)
    const difference = roundToTwoDecimals(valueB - valueA)
    const differencePercent = valueA !== 0
      ? roundToTwoDecimals((difference / valueA) * 100)
      : (valueB > 0 ? 100 : 0)
    
    return {
      category: categoryNames.get(catId) || 'Sin categoría',
      monthA: valueA,
      monthB: valueB,
      difference,
      differencePercent,
    }
  }).sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
  
  return {
    monthA,
    monthB,
    incomeA: summaryA.income,
    incomeB: summaryB.income,
    expenseA: summaryA.expense,
    expenseB: summaryB.expense,
    benefitA: summaryA.benefit,
    benefitB: summaryB.benefit,
    top5ExpensesA: expensesA,
    top5ExpensesB: expensesB,
    top5IncomesA: incomesA,
    top5IncomesB: incomesB,
    top5CategoriesA: categoriesA,
    top5CategoriesB: categoriesB,
    top5SubcategoriesA: subcategoriesA,
    top5SubcategoriesB: subcategoriesB,
    categoryDifferences,
  }
}

/**
 * @deprecated Usar calculateMonthlySummary en su lugar. Mantenido para compatibilidad.
 */
export async function getMonthlySummary(
  supabase: SupabaseClient<Database>,
  filters: AnalyticsFilters
): Promise<MonthlySummary[]> {
  const transactions = await getTransactionsForAnalytics(supabase, filters)
  return calculateMonthlySummary(transactions)
}

/**
 * Calcula relevancia de categorías (solo gastos)
 * OPTIMIZADO: Usa el tipo ya incluido en las transacciones, sin queries adicionales
 * Si hay un tag filtrado, solo muestra categorías de transacciones con ese tag
 */
export function calculateCategorySummary(
  transactions: TransactionWithRelations[],
  filterByTag?: string | null,
  transactionType?: 'Income' | 'Expense' | null
): CategorySummary[] {
  // Filtrar por tipo de transacción (por defecto solo gastos para compatibilidad)
  const typeFilter = transactionType || 'Expense'
  let filteredTransactions = transactions.filter(
    t => t.transactionType === typeFilter && t.category
  )
  
  // Si hay un tag filtrado, aplicar filtro adicional
  if (filterByTag) {
    filteredTransactions = filteredTransactions.filter(
      t => t.tag?.id_tag === filterByTag
    )
  }

  // Agrupar por categoría
  const categoryData: Record<string, { total: number; count: number; name: string }> = {}

  for (const transaction of filteredTransactions) {
    if (!transaction.category) continue

    const catId = transaction.category.id_category
    const catName = transaction.category.ds_category

    if (!categoryData[catId]) {
      categoryData[catId] = { total: 0, count: 0, name: catName }
    }

    categoryData[catId].total += transaction.ft_amount || 0
    categoryData[catId].count += 1
  }

  // Calcular total para porcentajes
  const grandTotal = Object.values(categoryData).reduce((sum, cat) => sum + cat.total, 0)

  // Convertir a array y calcular porcentajes
  const summary: CategorySummary[] = Object.entries(categoryData)
    .map(([id, data]) => ({
      id_category: id,
      ds_category: data.name,
      total: roundToTwoDecimals(data.total),
      percentage: grandTotal > 0 ? roundToTwoDecimals((data.total / grandTotal) * 100) : 0,
      transactions: data.count,
    }))
    .sort((a, b) => b.total - a.total)

  return summary
}

/**
 * Calcula relevancia de subcategorías (solo gastos)
 * OPTIMIZADO: Usa el tipo ya incluido en las transacciones, sin queries adicionales
 * Si hay un tag filtrado, solo muestra subcategorías de transacciones con ese tag
 */
export function calculateSubcategorySummary(
  transactions: TransactionWithRelations[],
  filterByTag?: string | null,
  transactionType?: 'Income' | 'Expense' | null
): SubcategorySummary[] {
  // Filtrar por tipo de transacción (por defecto solo gastos para compatibilidad)
  const typeFilter = transactionType || 'Expense'
  let filteredTransactions = transactions.filter(
    t => t.transactionType === typeFilter && t.subcategory && t.category
  )
  
  // Si hay un tag filtrado, aplicar filtro adicional
  if (filterByTag) {
    filteredTransactions = filteredTransactions.filter(
      t => t.tag?.id_tag === filterByTag
    )
  }

  // Agrupar por subcategoría
  const subcategoryData: Record<string, { total: number; count: number; subcatName: string; catId: string; catName: string }> = {}

  for (const transaction of filteredTransactions) {
    if (!transaction.subcategory || !transaction.category) continue

    const subcatId = transaction.subcategory.id_subcategory
    const subcatName = transaction.subcategory.ds_subcategory
    const catId = transaction.category.id_category
    const catName = transaction.category.ds_category

    if (!subcategoryData[subcatId]) {
      subcategoryData[subcatId] = { total: 0, count: 0, subcatName, catId, catName }
    }

    subcategoryData[subcatId].total += transaction.ft_amount || 0
    subcategoryData[subcatId].count += 1
  }

  // Calcular total para porcentajes
  const grandTotal = Object.values(subcategoryData).reduce((sum, subcat) => sum + subcat.total, 0)

  // Convertir a array y calcular porcentajes
  const summary: SubcategorySummary[] = Object.entries(subcategoryData)
    .map(([id, data]) => ({
      id_subcategory: id,
      ds_subcategory: data.subcatName,
      id_category: data.catId,
      ds_category: data.catName,
      total: roundToTwoDecimals(data.total),
      percentage: grandTotal > 0 ? roundToTwoDecimals((data.total / grandTotal) * 100) : 0,
      transactions: data.count,
    }))
    .sort((a, b) => b.total - a.total)

  return summary
}

/**
 * @deprecated Usar calculateSubcategorySummary en su lugar. Mantenido para compatibilidad.
 */
export async function getSubcategorySummary(
  supabase: SupabaseClient<Database>,
  filters: AnalyticsFilters
): Promise<SubcategorySummary[]> {
  const transactions = await getTransactionsForAnalytics(supabase, filters)
  return calculateSubcategorySummary(transactions)
}

/**
 * Busca transacciones con filtros avanzados
 */
export async function searchTransactions(
  supabase: SupabaseClient<Database>,
  filters: AnalyticsFilters & {
    searchText?: string
    limit?: number
  }
): Promise<TransactionWithRelations[]> {
  const transactions = await getTransactionsForAnalytics(supabase, filters)

  // Filtrar por texto de búsqueda si existe
  let filtered = transactions
  if (filters.searchText) {
    const searchLower = filters.searchText.toLowerCase()
    filtered = transactions.filter(t => {
      const comments = (t.ds_comments || '').toLowerCase()
      const category = (t.category?.ds_category || '').toLowerCase()
      const subcategory = (t.subcategory?.ds_subcategory || '').toLowerCase()
      const tag = (t.tag?.ds_tag || '').toLowerCase()
      
      return comments.includes(searchLower) ||
             category.includes(searchLower) ||
             subcategory.includes(searchLower) ||
             tag.includes(searchLower) ||
             t.ft_amount.toString().includes(searchLower)
    })
  }

  // Aplicar límite si existe
  if (filters.limit) {
    filtered = filtered.slice(0, filters.limit)
  }

  return filtered
}

/**
 * Calcula proyección mensual hasta diciembre
 */
export function calculateMonthlyProjection(
  transactions: TransactionWithRelations[]
): MonthlyProjection[] {
  const monthlySummary = calculateMonthlySummary(transactions)
  const currentDate = new Date()
  const currentMonth = currentDate.getMonth() + 1
  const currentYear = currentDate.getFullYear()
  
  // Obtener mediana excluyendo el mes actual
  const monthsExcludingCurrent = monthlySummary.filter(m => {
    const [year, month] = m.month.split('-').map(Number)
    return !(year === currentYear && month === currentMonth)
  })
  
  const medianBenefit = monthsExcludingCurrent.length > 0
    ? calculateMedian(monthsExcludingCurrent.map(m => m.benefit))
    : 0
  
  // Calcular beneficio acumulado hasta el mes actual
  const currentMonthData = monthlySummary.find(m => {
    const [year, month] = m.month.split('-').map(Number)
    return year === currentYear && month === currentMonth
  })
  const currentBenefit = currentMonthData?.benefit || 0
  
  // Generar proyección desde el mes siguiente hasta diciembre
  const projections: MonthlyProjection[] = []
  let cumulative = currentBenefit
  
  for (let month = currentMonth + 1; month <= 12; month++) {
    const monthStr = `${currentYear}-${String(month).padStart(2, '0')}`
    const [year, monthNum] = monthStr.split('-').map(Number)
    cumulative += medianBenefit
    
    projections.push({
      month: monthStr,
      monthDisplay: `${String(monthNum).padStart(2, '0')}-${year}`,
      projectedBenefit: roundToTwoDecimals(medianBenefit),
      cumulativeProjected: roundToTwoDecimals(cumulative),
    })
  }
  
  return projections
}

/**
 * Calcula evolución mensual de categorías
 */
export function calculateCategoryMonthlyEvolution(
  transactions: TransactionWithRelations[],
  transactionType?: 'Income' | 'Expense' | null
): CategoryMonthlyEvolution[] {
  const monthlySummary = calculateMonthlySummary(transactions)
  // Filtrar por tipo de transacción (por defecto solo gastos para compatibilidad)
  const typeFilter = transactionType || 'Expense'
  const filteredTransactions = transactions.filter(
    t => t.transactionType === typeFilter && t.category
  )
  
  // Agrupar por categoría y mes
  const categoryMonthlyData: Record<string, {
    name: string
    monthly: Record<string, number>
  }> = {}
  
  filteredTransactions.forEach(t => {
    if (!t.category || !t.ds_month_declared) return
    
    const catId = t.category.id_category
    const catName = t.category.ds_category
    const month = t.ds_month_declared
    
    if (!categoryMonthlyData[catId]) {
      categoryMonthlyData[catId] = { name: catName, monthly: {} }
    }
    
    categoryMonthlyData[catId].monthly[month] = 
      (categoryMonthlyData[catId].monthly[month] || 0) + (t.ft_amount || 0)
  })
  
  // Calcular totales mensuales para porcentajes
  const monthlyTotals: Record<string, number> = {}
  monthlySummary.forEach(m => {
    const monthTransactions = transactions.filter(
      t => t.ds_month_declared === m.month && t.transactionType === typeFilter
    )
    monthlyTotals[m.month] = monthTransactions.reduce(
      (sum, t) => sum + (t.ft_amount || 0), 0
    )
  })
  
  // Convertir a array
  const evolution: CategoryMonthlyEvolution[] = Object.entries(categoryMonthlyData).map(
    ([catId, data]) => {
      const monthlyData = monthlySummary.map(m => {
        const total = roundToTwoDecimals(data.monthly[m.month] || 0)
        const monthlyTotal = monthlyTotals[m.month] || 1
        const percentage = roundToTwoDecimals((total / monthlyTotal) * 100)
        
        return {
          month: m.month,
          monthDisplay: m.monthDisplay,
          total,
          percentage,
        }
      })
      
      const total = roundToTwoDecimals(
        Object.values(data.monthly).reduce((sum, val) => sum + val, 0)
      )
      const averageMonthly = monthlyData.length > 0
        ? roundToTwoDecimals(total / monthlyData.length)
        : 0
      
      return {
        id_category: catId,
        ds_category: data.name,
        monthlyData,
        total,
        averageMonthly,
      }
    }
  )
  
  return evolution.sort((a, b) => b.total - a.total)
}

/**
 * Calcula evolución mensual de subcategorías
 */
export function calculateSubcategoryMonthlyEvolution(
  transactions: TransactionWithRelations[],
  transactionType?: 'Income' | 'Expense' | null
): SubcategoryMonthlyEvolution[] {
  const monthlySummary = calculateMonthlySummary(transactions)
  // Filtrar por tipo de transacción (por defecto solo gastos para compatibilidad)
  const typeFilter = transactionType || 'Expense'
  const filteredTransactions = transactions.filter(
    t => t.transactionType === typeFilter && t.subcategory && t.category
  )
  
  // Agrupar por subcategoría y mes
  const subcategoryMonthlyData: Record<string, {
    name: string
    catId: string
    catName: string
    monthly: Record<string, number>
  }> = {}
  
  filteredTransactions.forEach(t => {
    if (!t.subcategory || !t.category || !t.ds_month_declared) return
    
    const subcatId = t.subcategory.id_subcategory
    const subcatName = t.subcategory.ds_subcategory
    const catId = t.category.id_category
    const catName = t.category.ds_category
    const month = t.ds_month_declared
    
    if (!subcategoryMonthlyData[subcatId]) {
      subcategoryMonthlyData[subcatId] = {
        name: subcatName,
        catId,
        catName,
        monthly: {},
      }
    }
    
    subcategoryMonthlyData[subcatId].monthly[month] = 
      (subcategoryMonthlyData[subcatId].monthly[month] || 0) + (t.ft_amount || 0)
  })
  
  // Calcular totales mensuales para porcentajes
  const monthlyTotals: Record<string, number> = {}
  monthlySummary.forEach(m => {
    const monthTransactions = transactions.filter(
      t => t.ds_month_declared === m.month && t.transactionType === typeFilter
    )
    monthlyTotals[m.month] = monthTransactions.reduce(
      (sum, t) => sum + (t.ft_amount || 0), 0
    )
  })
  
  // Convertir a array
  const evolution: SubcategoryMonthlyEvolution[] = Object.entries(subcategoryMonthlyData).map(
    ([subcatId, data]) => {
      const monthlyData = monthlySummary.map(m => {
        const total = roundToTwoDecimals(data.monthly[m.month] || 0)
        const monthlyTotal = monthlyTotals[m.month] || 1
        const percentage = roundToTwoDecimals((total / monthlyTotal) * 100)
        
        return {
          month: m.month,
          monthDisplay: m.monthDisplay,
          total,
          percentage,
        }
      })
      
      const total = roundToTwoDecimals(
        Object.values(data.monthly).reduce((sum, val) => sum + val, 0)
      )
      const averageMonthly = monthlyData.length > 0
        ? roundToTwoDecimals(total / monthlyData.length)
        : 0
      
      return {
        id_subcategory: subcatId,
        ds_subcategory: data.name,
        id_category: data.catId,
        ds_category: data.catName,
        monthlyData,
        total,
        averageMonthly,
      }
    }
  )
  
  return evolution.sort((a, b) => b.total - a.total)
}

/**
 * Análisis completo de un mes específico
 */
export function analyzeMonth(
  transactions: TransactionWithRelations[],
  month: string // Formato YYYY-MM
): MonthAnalysis | null {
  const monthTransactions = transactions.filter(t => t.ds_month_declared === month)
  
  if (monthTransactions.length === 0) {
    return null
  }
  
  const summary = calculateTotalSummary(monthTransactions)
  const monthlySummary = calculateMonthlySummary(monthTransactions)
  const monthData = monthlySummary[0]
  
  if (!monthData) {
    return null
  }
  
  // Top 5 gastos e ingresos
  const top5Expenses = monthTransactions
    .filter(t => t.transactionType === 'Expense')
    .sort((a, b) => (b.ft_amount || 0) - (a.ft_amount || 0))
    .slice(0, 5)
  
  const top5Incomes = monthTransactions
    .filter(t => t.transactionType === 'Income')
    .sort((a, b) => (b.ft_amount || 0) - (a.ft_amount || 0))
    .slice(0, 5)
  
  // Distribución por categoría y subcategoría
  const categoryDistribution = calculateCategorySummary(monthTransactions)
  const subcategoryDistribution = calculateSubcategorySummary(monthTransactions)
  
  // Top 5 categorías y subcategorías
  const top5Categories = categoryDistribution.slice(0, 5)
  const top5Subcategories = subcategoryDistribution.slice(0, 5)
  
  return {
    month: monthData.month,
    monthDisplay: monthData.monthDisplay,
    income: summary.income,
    expense: summary.expense,
    benefit: summary.benefit,
    transactions: monthTransactions.sort((a, b) => 
      new Date(b.dt_date).getTime() - new Date(a.dt_date).getTime()
    ),
    categoryDistribution,
    subcategoryDistribution,
    top5Expenses,
    top5Incomes,
    top5Categories,
    top5Subcategories,
  }
}

// ==================== NUEVAS FUNCIONES PARA ANALÍTICA REDISEÑADA ====================

/**
 * Calcula la mediana de beneficios mensuales
 */
export function calculateMedianMonthlyBenefit(
  transactions: TransactionWithRelations[]
): number {
  const monthlySummary = calculateMonthlySummary(transactions)
  const benefits = monthlySummary.map(m => m.benefit)
  return calculateMedian(benefits)
}

/**
 * Interfaz para una casuística en el comparador
 */
export interface ComparatorCase {
  id: string // ID único de la casuística
  monthDeclared?: string | null // Mes declarado en formato YYYY-MM
  idCategory?: string | null
  idSubcategory?: string | null
  idTag?: string | null
  idUsers?: string[] | null // Array de IDs de usuarios afectados
  label?: string // Etiqueta opcional (Caso A, B, C, etc.)
}

/**
 * Resultado de una casuística en el comparador
 */
export interface ComparatorCaseResult {
  case: ComparatorCase
  income: number
  expense: number
  benefit: number
  top5Expenses: TransactionWithRelations[]
  top5Incomes: TransactionWithRelations[]
  top5Categories: CategorySummary[]
  top5Subcategories: SubcategorySummary[]
  categoryDistribution: CategorySummary[]
  subcategoryDistribution: SubcategorySummary[]
}

/**
 * Resultado completo del comparador con múltiples casuísticas
 */
export interface MultiCaseComparison {
  cases: ComparatorCaseResult[]
  categoryComparison: Array<{
    category: string
    id_category: string
    values: Record<string, number> // key: case.id, value: amount
  }>
}

/**
 * Compara múltiples casuísticas y genera un ranking
 * @param transactions - Todas las transacciones disponibles
 * @param cases - Array de casuísticas a comparar
 * @param globalFilters - Filtros globales (fecha desde/hasta, mes declarado desde/hasta) que aplican a todas las casuísticas
 */
export function compareMultipleCases(
  transactions: TransactionWithRelations[],
  cases: ComparatorCase[],
  globalFilters?: {
    dateFrom?: string | null
    dateTo?: string | null
    startMonth?: string | null
    endMonth?: string | null
  }
): MultiCaseComparison {
  // Aplicar filtros globales primero
  let filteredTransactions = transactions

  if (globalFilters) {
    if (globalFilters.dateFrom) {
      filteredTransactions = filteredTransactions.filter(t => t.dt_date >= globalFilters.dateFrom!)
    }
    if (globalFilters.dateTo) {
      filteredTransactions = filteredTransactions.filter(t => t.dt_date <= globalFilters.dateTo!)
    }
    if (globalFilters.startMonth) {
      filteredTransactions = filteredTransactions.filter(t => 
        t.ds_month_declared && t.ds_month_declared >= globalFilters.startMonth!
      )
    }
    if (globalFilters.endMonth) {
      filteredTransactions = filteredTransactions.filter(t => 
        t.ds_month_declared && t.ds_month_declared <= globalFilters.endMonth!
      )
    }
  }

  // Procesar cada casuística
  const caseResults: ComparatorCaseResult[] = cases.map(case_ => {
    // Filtrar transacciones para esta casuística
    let caseTransactions = filteredTransactions

    if (case_.monthDeclared) {
      caseTransactions = caseTransactions.filter(t => t.ds_month_declared === case_.monthDeclared)
    }

    if (case_.idCategory) {
      caseTransactions = caseTransactions.filter(t => t.id_category === case_.idCategory)
    }

    if (case_.idSubcategory) {
      caseTransactions = caseTransactions.filter(t => t.id_subcategory === case_.idSubcategory)
    }

    if (case_.idTag) {
      caseTransactions = caseTransactions.filter(t => t.tag?.id_tag === case_.idTag)
    }

    if (case_.idUsers && case_.idUsers.length > 0) {
      caseTransactions = caseTransactions.filter(t => {
        if (!t.users || t.users.length === 0) return false
        return t.users.some(u => case_.idUsers!.includes(u.id_user))
      })
    }

    // Calcular métricas para esta casuística
    const summary = calculateTotalSummary(caseTransactions)
    const top5Expenses = caseTransactions
      .filter(t => t.transactionType === 'Expense')
      .sort((a, b) => (b.ft_amount || 0) - (a.ft_amount || 0))
      .slice(0, 5)
    
    const top5Incomes = caseTransactions
      .filter(t => t.transactionType === 'Income')
      .sort((a, b) => (b.ft_amount || 0) - (a.ft_amount || 0))
      .slice(0, 5)

    const categoryDistribution = calculateCategorySummary(caseTransactions)
    const subcategoryDistribution = calculateSubcategorySummary(caseTransactions)

    return {
      case: case_,
      income: summary.income,
      expense: summary.expense,
      benefit: summary.benefit,
      top5Expenses,
      top5Incomes,
      top5Categories: categoryDistribution.slice(0, 5),
      top5Subcategories: subcategoryDistribution.slice(0, 5),
      categoryDistribution,
      subcategoryDistribution,
    }
  })

  // Crear comparación por categoría
  const categoryMap = new Map<string, { name: string; id: string }>()
  const categoryValues: Record<string, Record<string, number>> = {}

  // Recopilar todas las categorías de todas las casuísticas
  caseResults.forEach((result, index) => {
    result.categoryDistribution.forEach(cat => {
      if (!categoryMap.has(cat.id_category)) {
        categoryMap.set(cat.id_category, {
          name: cat.ds_category,
          id: cat.id_category,
        })
      }
      if (!categoryValues[cat.id_category]) {
        categoryValues[cat.id_category] = {}
      }
      categoryValues[cat.id_category][result.case.id] = cat.total
    })
  })

  // Crear array de comparación por categoría
  const categoryComparison = Array.from(categoryMap.entries()).map(([id, info]) => {
    const values: Record<string, number> = {}
    caseResults.forEach(result => {
      values[result.case.id] = categoryValues[id]?.[result.case.id] || 0
    })
    return {
      category: info.name,
      id_category: id,
      values,
    }
  })

  return {
    cases: caseResults,
    categoryComparison,
  }
}

