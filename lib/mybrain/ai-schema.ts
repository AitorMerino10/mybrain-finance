import type {
  MyBrainAIConfidence,
  MyBrainAIProposalStatus,
} from '@/types/mybrain'

export type RawMyBrainAIModelFieldValue = {
  fieldId: string
  value: string
}

export type RawMyBrainAIModelProposal = {
  sectionId: string
  title: string
  eventDate: string
  confidence?: string
  warnings?: string[]
  fieldValues?: RawMyBrainAIModelFieldValue[]
  missingFields?: string[]
}

export type RawMyBrainAIModelResponse = {
  status?: string
  summary?: string
  warnings?: string[]
  questions?: string[]
  proposals?: RawMyBrainAIModelProposal[]
}

function isRawProposal(value: RawMyBrainAIModelProposal | null): value is RawMyBrainAIModelProposal {
  return Boolean(value)
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

function asConfidence(value: string): MyBrainAIConfidence {
  return value === 'high' || value === 'medium' || value === 'low'
    ? value
    : 'low'
}

function asStatus(value: string): MyBrainAIProposalStatus {
  return value === 'ready' || value === 'needs_clarification'
    ? value
    : 'needs_clarification'
}

export function parseMyBrainAIModelResponse(
  input: unknown,
): RawMyBrainAIModelResponse {
  const response =
    input && typeof input === 'object' ? (input as Record<string, unknown>) : {}

  const rawProposals = Array.isArray(response.proposals) ? response.proposals : []
  const proposals: RawMyBrainAIModelProposal[] = []

  for (const proposal of rawProposals) {
    if (!proposal || typeof proposal !== 'object') {
      continue
    }

    const value = proposal as Record<string, unknown>
    const rawFieldValues = Array.isArray(value.fieldValues)
      ? value.fieldValues
      : []

    const fieldValues: RawMyBrainAIModelFieldValue[] = []

    for (const fieldValue of rawFieldValues) {
      if (!fieldValue || typeof fieldValue !== 'object') {
        continue
      }

      const current = fieldValue as Record<string, unknown>
      const fieldId = asString(current.fieldId)
      const fieldValueText = asString(current.value)

      if (!fieldId) {
        continue
      }

      fieldValues.push({
        fieldId,
        value: fieldValueText,
      })
    }

    const nextProposal: RawMyBrainAIModelProposal = {
      sectionId: asString(value.sectionId),
      title: asString(value.title),
      eventDate: asString(value.eventDate),
      confidence: asConfidence(asString(value.confidence)),
      warnings: asStringArray(value.warnings),
      missingFields: asStringArray(value.missingFields),
      fieldValues,
    }

    if (isRawProposal(nextProposal)) {
      proposals.push(nextProposal)
    }
  }

  return {
    status: asStatus(asString(response.status)),
    summary: asString(response.summary),
    warnings: asStringArray(response.warnings),
    questions: asStringArray(response.questions),
    proposals,
  }
}

export function tryParseMyBrainAIModelResponse(text: string) {
  try {
    return parseMyBrainAIModelResponse(JSON.parse(text))
  } catch {
    return null
  }
}
