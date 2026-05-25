import type {
  MyBrainAIConfidence,
  MyBrainAIProposalEntry,
  MyBrainAIProposalField,
  MyBrainAIProposalResponse,
  MyBrainAIProposalStatus,
  MyBrainAISectionContext,
} from '@/types/mybrain'
import type { RawMyBrainAIModelResponse } from './ai-schema'
import { isValidMyBrainIsoDate, normalizeEntryValuesForSection } from './entries'

function getTodayISOString() {
  return new Date().toISOString().slice(0, 10)
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function normalizeConfidence(value: MyBrainAIConfidence | string | undefined): MyBrainAIConfidence {
  return value === 'high' || value === 'medium' || value === 'low'
    ? value
    : 'low'
}

function normalizeStatus(value: string | undefined): MyBrainAIProposalStatus {
  return value === 'ready' || value === 'needs_clarification'
    ? value
    : 'needs_clarification'
}

export function validateMyBrainAIProposal(
  rawResponse: RawMyBrainAIModelResponse,
  sections: MyBrainAISectionContext[],
  inputText: string,
): MyBrainAIProposalResponse {
  const sectionMap = new Map(sections.map((section) => [section.id, section]))
  const proposals: MyBrainAIProposalEntry[] = []
  const responseWarnings = [...(rawResponse.warnings || [])]

  for (const proposal of rawResponse.proposals || []) {
    if (!proposal.sectionId) {
      continue
    }

    const section = sectionMap.get(proposal.sectionId)
    if (!section) {
      responseWarnings.push('La IA ha propuesto una sección que no pertenece al usuario.')
      continue
    }

    const proposedValueMap = Object.fromEntries(
      (proposal.fieldValues || []).map((fieldValue) => [fieldValue.fieldId, fieldValue.value]),
    )

    const fieldWarnings = [...(proposal.warnings || [])]
    let normalized: ReturnType<typeof normalizeEntryValuesForSection>

    try {
      normalized = normalizeEntryValuesForSection(section.fields, proposedValueMap, {
        rejectUnknownFields: true,
        allowUnsupportedAiFields: false,
      })
      fieldWarnings.push(...normalized.warnings)
    } catch (error) {
      fieldWarnings.push(
        error instanceof Error
          ? error.message
          : `La propuesta para ${section.name} no se pudo validar`,
      )
      continue
    }

    const fields: MyBrainAIProposalField[] = section.fields.map((field) => ({
      id_field: field.id,
      fieldName: field.name,
      fieldDescription: field.description,
      fieldType: field.type,
      options: field.options,
      value: normalized.values[field.id] || '',
      isSuggested: field.id in normalized.values,
      aiSupported: field.aiSupported,
    }))

    const missingFields = dedupeStrings([
      ...(proposal.missingFields || []),
      ...fields
        .filter((field) => field.aiSupported && !field.value)
        .map((field) => field.fieldName),
    ])

    const title = proposal.title.trim()
    if (!title) {
      fieldWarnings.push(`La propuesta para ${section.name} no tenía un título válido.`)
      continue
    }

    proposals.push({
      sectionId: section.id,
      sectionName: section.name,
      title,
      eventDate:
        proposal.eventDate && isValidMyBrainIsoDate(proposal.eventDate)
          ? proposal.eventDate
          : getTodayISOString(),
      confidence: normalizeConfidence(proposal.confidence),
      warnings: dedupeStrings(fieldWarnings),
      fields,
      missingFields,
    })
  }

  const questions = dedupeStrings(rawResponse.questions || [])
  const summary = rawResponse.summary?.trim() || 'He preparado una propuesta para revisar antes de guardar.'
  const status: MyBrainAIProposalStatus =
    proposals.length > 0 && questions.length === 0
      ? 'ready'
      : normalizeStatus(rawResponse.status)

  return {
    status,
    inputText,
    normalizedInputText: inputText.trim(),
    summary,
    warnings: dedupeStrings(responseWarnings),
    questions,
    proposals: proposals.slice(0, 5),
  }
}

export function validateMyBrainAISaveEntries(
  proposals: MyBrainAIProposalEntry[],
  sections: MyBrainAISectionContext[],
) {
  const sectionMap = new Map(sections.map((section) => [section.id, section]))

  return proposals.map((proposal) => {
    const section = sectionMap.get(proposal.sectionId)
    if (!section) {
      throw new Error('La propuesta contiene una sección no permitida para este usuario.')
    }

    const valueMap = Object.fromEntries(
      proposal.fields.map((field) => [field.id_field, field.value]),
    )

    const normalized = normalizeEntryValuesForSection(section.fields, valueMap, {
      rejectUnknownFields: true,
      allowUnsupportedAiFields: true,
    })
    const title = proposal.title.trim()

    if (!title) {
      throw new Error(`La propuesta para ${section.name} necesita un título`)
    }

    return {
      section,
      title,
      eventDate: isValidMyBrainIsoDate(proposal.eventDate)
        ? proposal.eventDate
        : getTodayISOString(),
      values: normalized.values,
      warnings: normalized.warnings,
    }
  })
}
