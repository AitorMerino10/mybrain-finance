import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  MyBrainAIFinanceCategoryOption,
  MyBrainAIFinanceMember,
  MyBrainAIFinanceSubcategoryOption,
} from '@/types/mybrain'
import type { Database } from '@/types/supabase'
import { getCategoriesByType, getTransactionTypeId } from '@/lib/categories'
import { getFamilyMembers, getUserFamilies } from '@/lib/family'

export type MyBrainAIFinanceContext = {
  familyId: string
  familyName: string
  transactionTypeId: string
  currentUserId: string
  members: MyBrainAIFinanceMember[]
  categories: MyBrainAIFinanceCategoryOption[]
}

export type MyBrainAIFinanceUnavailableContext = {
  reason: string
  familyCount: number
  currentUserId: string
}

export type MyBrainAIFinanceContextResult =
  | { ok: true; context: MyBrainAIFinanceContext }
  | { ok: false; unavailable: MyBrainAIFinanceUnavailableContext }

function toMemberName(member: { ds_user: string | null; ds_email: string }) {
  return member.ds_user?.trim() || member.ds_email || 'Usuario'
}

export function serializeFinanceContextForPrompt(context: MyBrainAIFinanceContext) {
  return {
    family: {
      id: context.familyId,
      name: context.familyName,
    },
    currentUserId: context.currentUserId,
    members: context.members,
    expenseTransactionTypeId: context.transactionTypeId,
    categories: context.categories.map((category) => ({
      id: category.id,
      name: category.name,
      subcategories: category.subcategories.map((subcategory) => ({
        id: subcategory.id,
        name: subcategory.name,
      })),
    })),
  }
}

export async function loadMyBrainAIFinanceContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<MyBrainAIFinanceContextResult> {
  const families = await getUserFamilies(supabase, userId)

  if (families.length !== 1) {
    return {
      ok: false,
      unavailable: {
        currentUserId: userId,
        familyCount: families.length,
        reason:
          families.length === 0
            ? 'No perteneces a ninguna familia de Finance todavía.'
            : 'La captura de gastos con IA solo soporta usuarios con una familia por ahora.',
      },
    }
  }

  const family = families[0]
  const [members, categories, transactionTypeId] = await Promise.all([
    getFamilyMembers(supabase, family.id_family),
    getCategoriesByType(supabase, family.id_family, 'Expense'),
    getTransactionTypeId(supabase, 'Expense'),
  ])

  if (!transactionTypeId) {
    return {
      ok: false,
      unavailable: {
        currentUserId: userId,
        familyCount: families.length,
        reason: 'No se ha encontrado el tipo de transacción Expense en Finance.',
      },
    }
  }

  const categoryIds = categories.map((category) => category.id_category)
  let subcategories: MyBrainAIFinanceSubcategoryOption[] = []

  if (categoryIds.length > 0) {
    const { data, error } = await supabase
      .from('pml_dim_subcategory')
      .select('id_subcategory, id_category, ds_subcategory')
      .in('id_category', categoryIds)
      .order('ds_subcategory', { ascending: true })

    if (error) {
      console.error('Error al cargar subcategorias para Finance AI:', error)
      throw error
    }

    subcategories = (data || [])
      .filter((subcategory): subcategory is typeof subcategory & { id_category: string } =>
        Boolean(subcategory.id_category),
      )
      .map((subcategory) => ({
        id: subcategory.id_subcategory,
        name: subcategory.ds_subcategory,
        categoryId: subcategory.id_category,
      }))
  }

  const subcategoriesByCategory = new Map<string, MyBrainAIFinanceSubcategoryOption[]>()
  for (const subcategory of subcategories) {
    const list = subcategoriesByCategory.get(subcategory.categoryId) || []
    list.push(subcategory)
    subcategoriesByCategory.set(subcategory.categoryId, list)
  }

  return {
    ok: true,
    context: {
      familyId: family.id_family,
      familyName: family.ds_family,
      transactionTypeId,
      currentUserId: userId,
      members: members.map((member) => ({
        id: member.id_user,
        name: toMemberName(member),
        email: member.ds_email,
      })),
      categories: categories.map((category) => ({
        id: category.id_category,
        name: category.ds_category,
        subcategories: subcategoriesByCategory.get(category.id_category) || [],
      })),
    },
  }
}
