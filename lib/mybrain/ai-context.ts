import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type {
  MyBrainFieldType,
  MyBrainAISectionContext,
  MyBrainSectionFieldWithConfig,
} from '@/types/mybrain'
import {
  ensureMyBrainStatusField,
  getSectionsForUser,
  getSectionFields,
} from './sections'
import { parseFieldOptions } from './field-options'

const AI_SUPPORTED_FIELD_TYPES = new Set([
  'text',
  'number',
  'date',
  'location',
  'url',
  'picklist',
])

function normalizeKeyword(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function tokenize(value: string) {
  return normalizeKeyword(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

function getFieldKeywords(field: MyBrainSectionFieldWithConfig) {
  const keywords = new Set<string>(tokenize(field.ds_section_field))
  if (field.ds_field_description) {
    for (const token of tokenize(field.ds_field_description)) {
      keywords.add(token)
    }
  }

  for (const option of parseFieldOptions(field)) {
    for (const token of tokenize(option)) {
      keywords.add(token)
    }
  }

  return Array.from(keywords)
}

export async function loadMyBrainAIContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<MyBrainAISectionContext[]> {
  const sections = await getSectionsForUser(supabase, userId)

  const sectionsWithFields = await Promise.all(
    sections
      .filter((section) => !section.is_system_section)
      .map(async (section) => {
        await ensureMyBrainStatusField(supabase, section.id_section)
        const fields = await getSectionFields(supabase, section.id_section)
        return { section, fields }
      }),
  )

  return sectionsWithFields
    .filter(({ fields }) => fields.length > 0)
    .map(({ section, fields }) => {
      const keywordSet = new Set<string>(tokenize(section.ds_section))

      const normalizedFields = fields.map((field) => {
        const options = parseFieldOptions(field)
        const aiSupported = AI_SUPPORTED_FIELD_TYPES.has(field.ds_field_type)

        for (const keyword of getFieldKeywords(field)) {
          keywordSet.add(keyword)
        }

        return {
          id: field.id_field,
          name: field.ds_section_field,
          description: field.ds_field_description || null,
          type: field.ds_field_type as MyBrainFieldType,
          options,
          aiSupported,
        }
      })

      return {
        id: section.id_section,
        name: section.ds_section,
        logo: section.ds_logo,
        color: section.ds_color,
        keywords: Array.from(keywordSet).slice(0, 20),
        fields: normalizedFields,
      }
    })
}

export function buildMyBrainAIPromptContext(
  sections: MyBrainAISectionContext[],
) {
  return {
    sectionCount: sections.length,
    sections: sections.map((section) => ({
      id: section.id,
      name: section.name,
      keywords: section.keywords,
      fields: section.fields.map((field) => ({
        id: field.id,
        name: field.name,
        description: field.description,
        type: field.type,
        options: field.options,
        aiSupported: field.aiSupported,
      })),
    })),
  }
}
