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

function normalizeSuggestedTagName(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return null
  return normalized.slice(0, 40)
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
    tags: context.tags,
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
    proposals: [],
    context: {
      familyId: null,
      familyName: null,
      transactionTypeId: null,
      currentUserId: params.currentUserId,
      members: [],
      categories: [],
      tags: [],
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
  const tagMap = new Map(context.tags.map((tag) => [tag.id, tag]))
  const memberIds = new Set(context.members.map((member) => member.id))

  if (!rawResponse.proposals.length) {
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
      proposals: [],
      context: getContextForResponse(context),
    }
  }

  const proposals = rawResponse.proposals.slice(0, 5).map((rawProposal) => {
  const proposalWarnings = [...rawProposal.warnings]
  const missingFields = [...rawProposal.missingFields]
  const date = isValidISODate(rawProposal.date)
    ? rawProposal.date
    : getTodayISOString()
  const declaredMonth = isValidDeclaredMonth(rawProposal.declaredMonth)
    ? rawProposal.declaredMonth
    : getDeclaredMonthFromDate(date)

  const amount =
    typeof rawProposal.amount === 'number' && rawProposal.amount > 0
      ? Math.round((rawProposal.amount + Number.EPSILON) * 100) / 100
      : null

  if (amount === null) {
    missingFields.push('amount')
  }

  const category = rawProposal.categoryId
    ? categoryMap.get(rawProposal.categoryId)
    : null
  const categoryId = category?.id || null

  if (!categoryId) {
    missingFields.push('category')
  }

  const subcategory = category
    ? category.subcategories.find(
        (candidate) => candidate.id === rawProposal.subcategoryId,
      )
    : null
  const subcategoryId = subcategory?.id || null

  if (rawProposal.subcategoryId && !subcategoryId) {
    proposalWarnings.push('La subcategoría propuesta no pertenece a la categoría seleccionada.')
  }

  const tagId = rawProposal.tagId
    ? tagMap.get(rawProposal.tagId)?.id || null
    : null
  if (rawProposal.tagId && !tagId) {
    proposalWarnings.push('La tag propuesta no pertenece a tu familia de Finance.')
  }
  const suggestedNewTagName = tagId
    ? null
    : normalizeSuggestedTagName(rawProposal.suggestedNewTagName || '')

  const affectedUserIds = rawProposal.affectedUserIds.filter((id) =>
    memberIds.has(id),
  )
  const safeAffectedUserIds =
    affectedUserIds.length > 0 ? Array.from(new Set(affectedUserIds)) : [context.currentUserId]

  const description = rawProposal.description.trim() || inputText.trim()

  return {
    amount,
    date,
    declaredMonth,
    categoryId,
    subcategoryId,
    tagId,
    suggestedNewTagName,
    description,
    affectedUserIds: safeAffectedUserIds,
    confidence: rawProposal.confidence,
    warnings: dedupeStrings(proposalWarnings),
    missingFields: dedupeStrings(missingFields),
  }
  })

  return {
    status:
      proposals.some((proposal) => proposal.amount !== null && proposal.categoryId) &&
      questions.length === 0
        ? 'ready'
        : normalizeStatus(rawResponse.status),
    inputText,
    normalizedInputText: inputText.trim(),
    summary: rawResponse.summary || 'He preparado un gasto de Finance para revisar.',
    warnings: dedupeStrings(warnings),
    questions: dedupeStrings(questions),
    proposal: proposals[0] || null,
    proposals,
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

  const tagId = proposal.tagId || null
  if (tagId && !context.tags.some((tag) => tag.id === tagId)) {
    throw new Error('La tag seleccionada no pertenece a tu familia de Finance.')
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
    tagId,
    suggestedNewTagName: normalizeSuggestedTagName(proposal.suggestedNewTagName || ''),
    description: proposal.description.trim() || 'Gasto guardado con IA desde MyBrain',
    affectedUserIds,
  }
}
