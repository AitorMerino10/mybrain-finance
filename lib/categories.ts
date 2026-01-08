import type { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

type Category = Database['public']['Tables']['pml_dim_category']['Row']
type Subcategory = Database['public']['Tables']['pml_dim_subcategory']['Row']
type TransactionType = Database['public']['Tables']['pml_dim_transaction_type']['Row']

/**
 * Obtiene todas las categorías filtradas por familia y tipo de transacción
 * @param supabase - Cliente de Supabase
 * @param idFamily - ID de la familia
 * @param transactionTypeName - 'Income' o 'Expense'
 * @returns Array de categorías
 */
export async function getCategoriesByType(
  supabase: SupabaseClient<Database>,
  idFamily: string,
  transactionTypeName: 'Income' | 'Expense'
): Promise<Category[]> {
  const isIncome = transactionTypeName === 'Income'
  const isExpense = transactionTypeName === 'Expense'

  const { data, error } = await supabase
    .from('pml_dim_category')
    .select('*')
    .eq('id_family', idFamily)
    .eq(isIncome ? 'is_income' : 'is_expense', true)
    .order('id_order', { ascending: true, nullsFirst: false })
    .order('ds_category', { ascending: true })

  if (error) {
    console.error('Error al obtener categorías:', error)
    throw error
  }

  return data || []
}

/**
 * Obtiene todas las subcategorías de una categoría específica
 * @param supabase - Cliente de Supabase
 * @param idCategory - ID de la categoría
 * @returns Array de subcategorías
 */
export async function getSubcategoriesByCategory(
  supabase: SupabaseClient<Database>,
  idCategory: string
): Promise<Subcategory[]> {
  const { data, error } = await supabase
    .from('pml_dim_subcategory')
    .select('*')
    .eq('id_category', idCategory)
    .order('ds_subcategory', { ascending: true })

  if (error) {
    console.error('Error al obtener subcategorías:', error)
    throw error
  }

  return data || []
}

/**
 * Obtiene el ID del tipo de transacción por su nombre
 * @param supabase - Cliente de Supabase
 * @param typeName - 'Income' o 'Expense'
 * @returns ID del tipo de transacción o null si no se encuentra
 */
export async function getTransactionTypeId(
  supabase: SupabaseClient<Database>,
  typeName: 'Income' | 'Expense'
): Promise<string | null> {
  const { data, error } = await supabase
    .from('pml_dim_transaction_type')
    .select('id_type')
    .eq('ds_type', typeName)
    .single()

  if (error) {
    console.error('Error al obtener tipo de transacción:', error)
    return null
  }

  return data?.id_type || null
}

/**
 * Crea una nueva categoría
 * @param supabase - Cliente de Supabase
 * @param categoryData - Datos de la categoría
 * @returns Categoría creada
 */
export async function createCategory(
  supabase: SupabaseClient<Database>,
  categoryData: {
    ds_category: string
    id_family: string
    is_income?: boolean
    is_expense?: boolean
    ds_color?: string | null
    ds_icon?: string | null
  }
): Promise<Category> {
  const { data, error } = await supabase
    .from('pml_dim_category')
    .insert({
      ds_category: categoryData.ds_category,
      id_family: categoryData.id_family,
      is_income: categoryData.is_income ?? false,
      is_expense: categoryData.is_expense ?? false,
      ds_color: categoryData.ds_color ?? null,
      ds_icon: categoryData.ds_icon ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error al crear categoría:', error)
    throw error
  }

  return data
}

/**
 * Crea una nueva subcategoría
 * @param supabase - Cliente de Supabase
 * @param subcategoryData - Datos de la subcategoría
 * @returns Subcategoría creada
 */
export async function createSubcategory(
  supabase: SupabaseClient<Database>,
  subcategoryData: {
    ds_subcategory: string
    id_category: string
    ds_color?: string | null
    ds_icon?: string | null
  }
): Promise<Subcategory> {
  const { data, error } = await supabase
    .from('pml_dim_subcategory')
    .insert({
      ds_subcategory: subcategoryData.ds_subcategory,
      id_category: subcategoryData.id_category,
      ds_color: subcategoryData.ds_color ?? null,
      ds_icon: subcategoryData.ds_icon ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error al crear subcategoría:', error)
    throw error
  }

  return data
}

/**
 * Obtiene todas las categorías de una familia (sin filtrar por tipo)
 * @param supabase - Cliente de Supabase
 * @param idFamily - ID de la familia
 * @returns Array de categorías
 */
export async function getAllCategoriesByFamily(
  supabase: SupabaseClient<Database>,
  idFamily: string
): Promise<Category[]> {
  const { data, error } = await supabase
    .from('pml_dim_category')
    .select('*')
    .eq('id_family', idFamily)
    .order('id_order', { ascending: true, nullsFirst: false })
    .order('ds_category', { ascending: true })

  if (error) {
    console.error('Error al obtener categorías:', error)
    throw error
  }

  return data || []
}

/**
 * Elimina una categoría
 * @param supabase - Cliente de Supabase
 * @param idCategory - ID de la categoría
 */
export async function deleteCategory(
  supabase: SupabaseClient<Database>,
  idCategory: string
): Promise<void> {
  const { error } = await supabase
    .from('pml_dim_category')
    .delete()
    .eq('id_category', idCategory)

  if (error) {
    console.error('Error al eliminar categoría:', error)
    throw error
  }
}

/**
 * Elimina una subcategoría
 * @param supabase - Cliente de Supabase
 * @param idSubcategory - ID de la subcategoría
 */
export async function deleteSubcategory(
  supabase: SupabaseClient<Database>,
  idSubcategory: string
): Promise<void> {
  const { error } = await supabase
    .from('pml_dim_subcategory')
    .delete()
    .eq('id_subcategory', idSubcategory)

  if (error) {
    console.error('Error al eliminar subcategoría:', error)
    throw error
  }
}

/**
 * Actualiza el orden de una categoría
 * @param supabase - Cliente de Supabase
 * @param idCategory - ID de la categoría
 * @param idOrder - Nuevo orden
 */
export async function updateCategoryOrder(
  supabase: SupabaseClient<Database>,
  idCategory: string,
  idOrder: number
): Promise<void> {
  const { error } = await supabase
    .from('pml_dim_category')
    .update({ id_order: idOrder })
    .eq('id_category', idCategory)

  if (error) {
    console.error('Error al actualizar orden de categoría:', error)
    throw error
  }
}

/**
 * Actualiza múltiples categorías con nuevos órdenes
 * @param supabase - Cliente de Supabase
 * @param categoryOrders - Array de objetos { id_category, id_order }
 */
export async function updateCategoriesOrder(
  supabase: SupabaseClient<Database>,
  categoryOrders: Array<{ id_category: string; id_order: number }>
): Promise<void> {
  // Actualizar cada categoría individualmente
  for (const { id_category, id_order } of categoryOrders) {
    await updateCategoryOrder(supabase, id_category, id_order)
  }
}

