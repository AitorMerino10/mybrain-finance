import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  MyBrainAIFinanceProposal,
  MyBrainAIFinanceProposalResponse,
  MyBrainAIFinanceSaveResult,
} from '@/types/mybrain'
import type { Database } from '@/types/supabase'
import { convertMonthYearToDBFormat } from '@/lib/date-utils'
import { loadMyBrainAIFinanceContext } from './ai-finance-context'
import { requestMyBrainAIFinanceProposal } from './ai-finance-provider'
import {
  buildUnavailableFinanceProposalResponse,
  validateMyBrainAIFinanceProposal,
  validateMyBrainAIFinanceSaveProposal,
} from './ai-finance-validation'

function getTodayISOString() {
  return new Date().toISOString().slice(0, 10)
}

function splitAmountAcrossUsers(totalAmount: number, userCount: number) {
  const baseAmountPerUser = Math.floor((totalAmount / userCount) * 100) / 100
  const amounts: number[] = []
  let sumSoFar = 0

  for (let i = 0; i < userCount - 1; i += 1) {
    amounts.push(baseAmountPerUser)
    sumSoFar += baseAmountPerUser
  }

  amounts.push(Math.round((totalAmount - sumSoFar) * 100) / 100)
  return amounts
}

async function createFinanceExpenseFromAI(
  supabase: SupabaseClient<Database>,
  params: {
    familyId: string
    userId: string
    transactionTypeId: string
    amount: number
    date: string
    declaredMonth: string
    categoryId: string
    subcategoryId: string | null
    description: string
    affectedUserIds: string[]
  },
) {
  const { data: memberships, error: membershipError } = await supabase
    .from('pml_rel_user_family')
    .select('id_user')
    .eq('id_family', params.familyId)
    .in('id_user', params.affectedUserIds)

  if (membershipError) {
    console.error('Error al validar miembros del gasto de Finance con IA:', membershipError)
    throw membershipError
  }

  const confirmedMemberIds = new Set((memberships || []).map((member) => member.id_user))
  if (
    confirmedMemberIds.size !== params.affectedUserIds.length ||
    !params.affectedUserIds.every((idUser) => confirmedMemberIds.has(idUser))
  ) {
    throw new Error('El gasto contiene personas que no pertenecen a tu familia de Finance.')
  }

  const { data: category, error: categoryError } = await supabase
    .from('pml_dim_category')
    .select('id_category')
    .eq('id_category', params.categoryId)
    .eq('id_family', params.familyId)
    .eq('is_expense', true)
    .maybeSingle()

  if (categoryError) {
    console.error('Error al validar categoria del gasto de Finance con IA:', categoryError)
    throw categoryError
  }

  if (!category) {
    throw new Error('La categoría seleccionada no pertenece a tu familia de Finance.')
  }

  if (params.subcategoryId) {
    const { data: subcategory, error: subcategoryError } = await supabase
      .from('pml_dim_subcategory')
      .select('id_subcategory')
      .eq('id_subcategory', params.subcategoryId)
      .eq('id_category', params.categoryId)
      .maybeSingle()

    if (subcategoryError) {
      console.error(
        'Error al validar subcategoria del gasto de Finance con IA:',
        subcategoryError,
      )
      throw subcategoryError
    }

    if (!subcategory) {
      throw new Error('La subcategoría seleccionada no pertenece a la categoría.')
    }
  }

  const roundedAmount = Math.round((params.amount + Number.EPSILON) * 100) / 100
  const declaredMonthForDb = convertMonthYearToDBFormat(params.declaredMonth)
  const splitAmounts = splitAmountAcrossUsers(
    roundedAmount,
    params.affectedUserIds.length,
  )

  const { data: created, error: transactionError } = await supabase
    .from('gnp_fct_transactions')
    .insert({
      id_family: params.familyId,
      id_user_creator: params.userId,
      id_type: params.transactionTypeId,
      id_category: params.categoryId,
      id_subcategory: params.subcategoryId,
      ft_amount: roundedAmount,
      dt_date: params.date,
      ds_month_declared: declaredMonthForDb,
      ds_comments: params.description,
    })
    .select()
    .single()

  if (transactionError) {
    console.error('Error al crear gasto de Finance con IA:', transactionError)
    throw transactionError
  }

  const relations = params.affectedUserIds.map((idUser, index) => ({
    id_transaction: created.id_transaction,
    id_user: idUser,
    ft_amount_user: splitAmounts[index],
  }))

  const { error: relationError } = await supabase
    .from('pml_rel_transaction_user')
    .insert(relations)

  if (relationError) {
    console.error('Error al asociar usuarios al gasto de Finance con IA:', relationError)
    throw new Error(
      'No se pudo guardar el split del gasto. No se han ejecutado updates ni deletes; revisa permisos/RLS de pml_rel_transaction_user.',
    )
  }

  return created
}

export async function proposeFinanceExpenseFromText(
  supabase: SupabaseClient<Database>,
  userId: string,
  inputText: string,
): Promise<MyBrainAIFinanceProposalResponse> {
  const trimmedInput = inputText.trim()
  if (!trimmedInput) {
    throw new Error('Necesitas escribir o dictar algo antes de pedir ayuda a la IA')
  }

  const contextResult = await loadMyBrainAIFinanceContext(supabase, userId)
  if (!contextResult.ok) {
    return buildUnavailableFinanceProposalResponse({
      inputText: trimmedInput,
      currentUserId: userId,
      reason: contextResult.unavailable.reason,
    })
  }

  const rawResponse = await requestMyBrainAIFinanceProposal({
    inputText: trimmedInput,
    today: getTodayISOString(),
    context: contextResult.context,
  })

  return validateMyBrainAIFinanceProposal(
    rawResponse,
    contextResult.context,
    trimmedInput,
  )
}

export async function confirmFinanceExpenseProposal(
  supabase: SupabaseClient<Database>,
  userId: string,
  proposal: MyBrainAIFinanceProposal,
): Promise<MyBrainAIFinanceSaveResult> {
  const contextResult = await loadMyBrainAIFinanceContext(supabase, userId)
  if (!contextResult.ok) {
    throw new Error(contextResult.unavailable.reason)
  }

  const transaction = validateMyBrainAIFinanceSaveProposal(
    proposal,
    contextResult.context,
  )

  const created = await createFinanceExpenseFromAI(supabase, {
    familyId: contextResult.context.familyId,
    userId,
    transactionTypeId: contextResult.context.transactionTypeId,
    categoryId: transaction.categoryId,
    subcategoryId: transaction.subcategoryId,
    amount: transaction.amount,
    date: transaction.date,
    declaredMonth: transaction.declaredMonth,
    description: transaction.description,
    affectedUserIds: transaction.affectedUserIds,
  })

  return {
    createdTransaction: {
      transactionId: created.id_transaction,
      amount: created.ft_amount,
      date: created.dt_date,
      categoryId: created.id_category,
      subcategoryId: created.id_subcategory,
      affectedUserIds: transaction.affectedUserIds,
      description: created.ds_comments || transaction.description,
    },
  }
}
