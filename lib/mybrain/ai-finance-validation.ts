import type {
  MyBrainAIFinanceProposal,
  MyBrainAIFinanceProposalResponse,
  MyBrainAIProposalStatus,
} from '@/types/mybrain'
import type { RawMyBrainAIFinanceResponse } from './ai-finance-provider'
import type { MyBrainAIFinanceContext } from './ai-finance-context'

function getTodayISOString() {
  return new Date().toISOString().slice(0, 10)
}

function getDeclaredMonthFromDate(date: string) {
  const [year, month] = date.split('-')
  return month && year ? `${month}-${year}` : ''
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function isValidISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isValidDeclaredMonth(value: string) {
  return /^(0[1-9]|1[0-2])-\d{4}$/.test(value)
}

function normalizeStatus(value: string | undefined): MyBrainAIProposalStatus {
  return value === 'ready' || value === 'needs_clarification'
    ? value
    : 'needs_clarification'
}

function getContextForResponse(context: MyBrainAIFinanceContext) {
  return {
    familyId: context.familyId,
    familyName: context.familyName,
    transactionTypeId: context.transactionTypeId,
    currentUserId: context.currentUserId,
    members: context.members,
    categories: context.categories,
  }
}

export function buildUnavailableFinanceProposalResponse(params: {
  inputText: string
  currentUserId: string
  reason: string
}): MyBrainAIFinanceProposalResponse {
  return {
    status: 'needs_clarification',
    inputText: params.inputText,
    normalizedInputText: params.inputText.trim(),
    summary: params.reason,
    warnings: [params.reason],
    questions: [],
    proposal: null,
    context: {
      familyId: null,
      familyName: null,
      transactionTypeId: null,
      currentUserId: params.currentUserId,
      members: [],
      categories: [],
    },
  }
}

export function validateMyBrainAIFinanceProposal(
  rawResponse: RawMyBrainAIFinanceResponse,
  context: MyBrainAIFinanceContext,
  inputText: string,
): MyBrainAIFinanceProposalResponse {
  const warnings = [...rawResponse.warnings]
  const questions = [...rawResponse.questions]
  const categoryMap = new Map(context.categories.map((category) => [category.id, category]))
  const memberIds = new Set(context.members.map((member) => member.id))

  if (!rawResponse.proposal) {
    return {
      status: normalizeStatus(rawResponse.status),
      inputText,
      normalizedInputText: inputText.trim(),
      summary:
        rawResponse.summary ||
        'No he encontrado un gasto de Finance listo para guardar en este texto.',
      warnings: dedupeStrings(warnings),
      questions: dedupeStrings(questions),
      proposal: null,
      context: getContextForResponse(context),
    }
  }

  const proposalWarnings = [...rawResponse.proposal.warnings]
  const missingFields = [...rawResponse.proposal.missingFields]
  const date = isValidISODate(rawResponse.proposal.date)
    ? rawResponse.proposal.date
    : getTodayISOString()
  const declaredMonth = isValidDeclaredMonth(rawResponse.proposal.declaredMonth)
    ? rawResponse.proposal.declaredMonth
    : getDeclaredMonthFromDate(date)

  const amount =
    typeof rawResponse.proposal.amount === 'number' && rawResponse.proposal.amount > 0
      ? Math.round((rawResponse.proposal.amount + Number.EPSILON) * 100) / 100
      : null

  if (amount === null) {
    missingFields.push('amount')
  }

  const category = rawResponse.proposal.categoryId
    ? categoryMap.get(rawResponse.proposal.categoryId)
    : null
  const categoryId = category?.id || null

  if (!categoryId) {
    missingFields.push('category')
  }

  const subcategory = category
    ? category.subcategories.find(
        (candidate) => candidate.id === rawResponse.proposal?.subcategoryId,
      )
    : null
  const subcategoryId = subcategory?.id || null

  if (rawResponse.proposal.subcategoryId && !subcategoryId) {
    proposalWarnings.push('La subcategoría propuesta no pertenece a la categoría seleccionada.')
  }

  const affectedUserIds = rawResponse.proposal.affectedUserIds.filter((id) =>
    memberIds.has(id),
  )
  const safeAffectedUserIds =
    affectedUserIds.length > 0 ? Array.from(new Set(affectedUserIds)) : [context.currentUserId]

  const description = rawResponse.proposal.description.trim() || inputText.trim()

  const proposal: MyBrainAIFinanceProposal = {
    amount,
    date,
    declaredMonth,
    categoryId,
    subcategoryId,
    description,
    affectedUserIds: safeAffectedUserIds,
    confidence: rawResponse.proposal.confidence,
    warnings: dedupeStrings(proposalWarnings),
    missingFields: dedupeStrings(missingFields),
  }

  return {
    status:
      proposal.amount !== null && proposal.categoryId && questions.length === 0
        ? 'ready'
        : normalizeStatus(rawResponse.status),
    inputText,
    normalizedInputText: inputText.trim(),
    summary: rawResponse.summary || 'He preparado un gasto de Finance para revisar.',
    warnings: dedupeStrings(warnings),
    questions: dedupeStrings(questions),
    proposal,
    context: getContextForResponse(context),
  }
}

export function validateMyBrainAIFinanceSaveProposal(
  proposal: MyBrainAIFinanceProposal,
  context: MyBrainAIFinanceContext,
) {
  const category = proposal.categoryId
    ? context.categories.find((candidate) => candidate.id === proposal.categoryId)
    : null

  if (!proposal.amount || proposal.amount <= 0) {
    throw new Error('El gasto necesita un importe mayor que cero.')
  }

  if (!isValidISODate(proposal.date)) {
    throw new Error('El gasto necesita una fecha válida.')
  }

  if (!isValidDeclaredMonth(proposal.declaredMonth)) {
    throw new Error('El mes declarado debe tener formato MM-YYYY.')
  }

  if (!category) {
    throw new Error('Selecciona una categoría de Finance antes de guardar.')
  }

  const subcategoryId = proposal.subcategoryId || null
  if (
    subcategoryId &&
    !category.subcategories.some((subcategory) => subcategory.id === subcategoryId)
  ) {
    throw new Error('La subcategoría seleccionada no pertenece a la categoría.')
  }

  const memberIds = new Set(context.members.map((member) => member.id))
  const affectedUserIds = Array.from(
    new Set(proposal.affectedUserIds.filter((id) => memberIds.has(id))),
  )

  if (affectedUserIds.length !== new Set(proposal.affectedUserIds).size) {
    throw new Error('El gasto contiene personas que no pertenecen a tu familia de Finance.')
  }

  if (affectedUserIds.length === 0) {
    throw new Error('Selecciona al menos una persona afectada.')
  }

  return {
    amount: Math.round((proposal.amount + Number.EPSILON) * 100) / 100,
    date: proposal.date,
    declaredMonth: proposal.declaredMonth,
    categoryId: category.id,
    subcategoryId,
    description: proposal.description.trim() || 'Gasto guardado con IA desde MyBrain',
    affectedUserIds,
  }
}
