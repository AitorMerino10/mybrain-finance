import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type {
  MyBrainAIProposalEntry,
  MyBrainAIProposalResponse,
  MyBrainAISaveResult,
} from '@/types/mybrain'
import { loadMyBrainAIContext } from './ai-context'
import { requestMyBrainAIProposal } from './ai-provider'
import { validateMyBrainAIProposal, validateMyBrainAISaveEntries } from './ai-validation'
import { createEntryWithValues } from './entries'

function getTodayISOString() {
  return new Date().toISOString().slice(0, 10)
}

export async function saveMemoryFromText(
  supabase: SupabaseClient<Database>,
  userId: string,
  inputText: string,
): Promise<MyBrainAIProposalResponse> {
  const trimmedInput = inputText.trim()
  if (!trimmedInput) {
    throw new Error('Necesitas escribir o dictar algo antes de pedir ayuda a la IA')
  }

  const sections = await loadMyBrainAIContext(supabase, userId)
  if (sections.length === 0) {
    throw new Error('Necesitas al menos una sección con campos para usar la captura con IA')
  }

  const rawResponse = await requestMyBrainAIProposal({
    inputText: trimmedInput,
    today: getTodayISOString(),
    sections,
  })

  return validateMyBrainAIProposal(rawResponse, sections, trimmedInput)
}

export async function confirmMyBrainProposal(
  supabase: SupabaseClient<Database>,
  userId: string,
  proposals: MyBrainAIProposalEntry[],
): Promise<MyBrainAISaveResult> {
  const sections = await loadMyBrainAIContext(supabase, userId)
  const entriesToCreate = validateMyBrainAISaveEntries(proposals, sections)
  const createdEntries: MyBrainAISaveResult['createdEntries'] = []

  for (const entry of entriesToCreate) {
    const created = await createEntryWithValues(supabase, userId, entry.section.id, {
      title: entry.title,
      eventDate: entry.eventDate,
      values: entry.values,
    })

    createdEntries.push({
      entryId: created.id_entry,
      sectionId: entry.section.id,
      sectionName: entry.section.name,
      title: created.ds_title,
    })
  }

  return {
    createdEntries,
  }
}

export async function searchMemory(
  supabase: SupabaseClient<Database>,
  userId: string,
  query: string,
) {
  const sections = await loadMyBrainAIContext(supabase, userId)

  return {
    ok: true,
    query,
    sectionCount: sections.length,
  }
}
