import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type {
  MyBrainAISectionFieldContext,
  MyBrainEntry,
  MyBrainEntryValueInsert,
  MyBrainEntryWithValues,
  MyBrainFieldType,
  MyBrainSectionFieldWithConfig,
} from '@/types/mybrain'
import { getSectionById, getSectionFields } from './sections'
import { parseFieldOptions } from './field-options'

function normalizeFieldValue(value: string | null | undefined) {
  if (value === null || value === undefined) return null
  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : null
}

export function isValidMyBrainIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function normalizeNumberValue(value: string) {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    throw new Error('Los campos numéricos deben contener un número válido')
  }

  return normalized
}

type MyBrainFieldNormalizerInput =
  | MyBrainSectionFieldWithConfig
  | MyBrainAISectionFieldContext

function getFieldName(field: MyBrainFieldNormalizerInput) {
  return 'ds_section_field' in field ? field.ds_section_field : field.name
}

function getFieldType(field: MyBrainFieldNormalizerInput) {
  return 'ds_field_type' in field ? field.ds_field_type : field.type
}

function getFieldId(field: MyBrainFieldNormalizerInput) {
  return 'id_field' in field ? field.id_field : field.id
}

function getFieldOptions(field: MyBrainFieldNormalizerInput) {
  return 'id_field' in field ? parseFieldOptions(field) : field.options
}

function normalizeFieldValueByType(
  field: MyBrainFieldNormalizerInput,
  value: string | null | undefined,
  options?: { allowUnsupportedAiFields?: boolean }
) {
  const normalized = normalizeFieldValue(value)
  if (normalized === null) {
    return null
  }

  switch (getFieldType(field)) {
    case 'number':
      return normalizeNumberValue(normalized)
    case 'date':
      if (!isValidMyBrainIsoDate(normalized)) {
        throw new Error(`El campo "${getFieldName(field)}" necesita una fecha válida YYYY-MM-DD`)
      }
      return normalized
    case 'picklist': {
      const picklistOptions = getFieldOptions(field)
      const matchedOption = picklistOptions.find(
        (option) => option.toLowerCase() === normalized.toLowerCase()
      )

      if (!matchedOption) {
        throw new Error(`El campo "${getFieldName(field)}" necesita una opción válida`)
      }

      return matchedOption
    }
    case 'url':
      try {
        const parsed = new URL(normalized)
        return parsed.toString()
      } catch {
        throw new Error(`El campo "${getFieldName(field)}" necesita una URL válida`)
      }
    case 'photo':
      if (options?.allowUnsupportedAiFields === false) {
        throw new Error(`El campo "${getFieldName(field)}" no admite autocompletado con IA`)
      }
      return normalized
    default:
      return normalized
  }
}

export function normalizeEntryValuesForSection(
  sectionFields: MyBrainFieldNormalizerInput[],
  inputValues: Record<string, string>,
  options?: { rejectUnknownFields?: boolean; allowUnsupportedAiFields?: boolean }
) {
  const fieldMap = new Map(sectionFields.map((field) => [getFieldId(field), field]))
  const normalizedValues: Record<string, string> = {}
  const warnings: string[] = []

  for (const fieldId of Object.keys(inputValues)) {
    const field = fieldMap.get(fieldId)

    if (!field) {
      if (options?.rejectUnknownFields) {
        throw new Error('La propuesta incluye un campo que no pertenece a esta sección')
      }
      continue
    }

    try {
      const normalizedValue = normalizeFieldValueByType(
        field,
        inputValues[fieldId],
        options,
      )

      if (normalizedValue !== null) {
        normalizedValues[fieldId] = normalizedValue
      }
    } catch (error) {
      if (getFieldType(field) === 'photo' && options?.allowUnsupportedAiFields === false) {
        warnings.push(error instanceof Error ? error.message : 'Campo no soportado por IA')
        continue
      }
      throw error
    }
  }

  return {
    values: normalizedValues,
    warnings,
  }
}

export async function getEntriesForSection(
  supabase: SupabaseClient<Database>,
  userId: string,
  sectionId: string
): Promise<MyBrainEntryWithValues[]> {
  const { data: entries, error } = await supabase
    .from('gnp_fct_entries')
    .select('*')
    .eq('id_user', userId)
    .eq('id_section', sectionId)
    .order('dt_event', { ascending: false })
    .order('dt_created', { ascending: false })

  if (error) {
    console.error('Error al obtener entradas de MyBrain:', error)
    throw error
  }

  if (!entries || entries.length === 0) {
    return []
  }

  const fields = await getSectionFields(supabase, sectionId)
  const fieldMap = new Map(fields.map((field) => [field.id_field, field]))
  const entryIds = entries.map((entry) => entry.id_entry)

  const { data: values, error: valuesError } = await supabase
    .from('gnp_fct_entry_values')
    .select('*')
    .in('id_entry', entryIds)

  if (valuesError) {
    console.error('Error al obtener valores de entradas de MyBrain:', valuesError)
    throw valuesError
  }

  const valuesByEntry = new Map<string, MyBrainEntryWithValues['values']>()

  for (const value of values || []) {
    const field = fieldMap.get(value.id_field)
    if (!field) continue

    const currentValues = valuesByEntry.get(value.id_entry) || []
    currentValues.push({
      id_field: value.id_field,
      ds_section_field: field.ds_section_field,
      ds_field_type: field.ds_field_type as MyBrainFieldType,
      ds_value: value.ds_value,
      ds_field_options: field.ds_field_options,
    })
    valuesByEntry.set(value.id_entry, currentValues)
  }

  return entries.map((entry) => ({
    ...entry,
    values: valuesByEntry.get(entry.id_entry) || [],
  }))
}

export async function createEntryWithValues(
  supabase: SupabaseClient<Database>,
  userId: string,
  sectionId: string,
  params: {
    title: string
    eventDate: string
    values: Record<string, string>
  }
): Promise<MyBrainEntry> {
  const section = await getSectionById(supabase, userId, sectionId)

  if (!section) {
    throw new Error('No se ha encontrado la sección')
  }

  const title = params.title.trim()

  if (!title) {
    throw new Error('El título es obligatorio')
  }

  if (!params.eventDate) {
    throw new Error('La fecha es obligatoria')
  }

  if (!isValidMyBrainIsoDate(params.eventDate)) {
    throw new Error('La fecha debe tener formato YYYY-MM-DD')
  }

  const { data: entry, error } = await supabase
    .from('gnp_fct_entries')
    .insert({
      id_section: sectionId,
      id_user: userId,
      ds_title: title,
      dt_event: params.eventDate,
    })
    .select()
    .single()

  if (error) {
    console.error('Error al crear entrada de MyBrain:', error)
    throw error
  }

  const sectionFields = await getSectionFields(supabase, sectionId)
  const normalizedValues = normalizeEntryValuesForSection(sectionFields, params.values, {
    rejectUnknownFields: true,
    allowUnsupportedAiFields: true,
  })
  const valueRows: MyBrainEntryValueInsert[] = sectionFields
    .map((field) => ({
      id_entry: entry.id_entry,
      id_field: field.id_field,
      ds_value: normalizeFieldValue(normalizedValues.values[field.id_field]),
    }))
    .filter((value) => value.ds_value !== null)

  if (valueRows.length > 0) {
    const { error: valuesError } = await supabase
      .from('gnp_fct_entry_values')
      .insert(valueRows)

    if (valuesError) {
      console.error('Error al guardar valores de MyBrain:', valuesError)
      await supabase.from('gnp_fct_entries').delete().eq('id_entry', entry.id_entry)
      throw valuesError
    }
  }

  return entry
}
