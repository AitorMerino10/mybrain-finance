import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type {
  MyBrainBrainRegion,
  MyBrainFieldType,
  MyBrainSection,
  MyBrainSectionCard,
  MyBrainSectionFieldWithConfig,
  MyBrainSectionWithFields,
} from '@/types/mybrain'
import { stringifyFieldOptions } from './field-options'
import {
  isMyBrainStatusFieldName,
  MYBRAIN_STATUS_FIELD_NAME,
  MYBRAIN_STATUS_OPTIONS,
} from './status'

function normalizeFieldDraft(params: {
  name: string
  type: MyBrainFieldType
  description?: string | null
  options?: string[]
}) {
  const name = params.name.trim()
  const description = params.description?.trim() || null
  const options = (params.options || []).map((option) => option.trim()).filter(Boolean)

  if (!name) {
    throw new Error('El nombre del campo es obligatorio')
  }

  if (params.type === 'picklist' && options.length === 0) {
    throw new Error(`El campo "${name}" necesita al menos una opcion`)
  }

  return {
    name,
    type: params.type,
    description,
    options,
  }
}

export async function getSectionsForUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<MyBrainSection[]> {
  const { data, error } = await supabase
    .from('pml_dim_section')
    .select('*')
    .eq('id_user', userId)
    .order('dt_created', { ascending: false })

  if (error) {
    console.error('Error al obtener secciones de MyBrain:', error)
    throw error
  }

  return data || []
}

export async function createSection(
  supabase: SupabaseClient<Database>,
  userId: string,
  params: {
    name: string
    logo?: string | null
    color?: string | null
    brainRegion: MyBrainBrainRegion
    fields?: Array<{
      name: string
      type: MyBrainFieldType
      description?: string | null
      options?: string[]
    }>
  }
): Promise<MyBrainSection> {
  const trimmedName = params.name.trim()
  const trimmedLogo = params.logo?.trim() || null
  const trimmedColor = params.color?.trim() || null

  if (!trimmedName) {
    throw new Error('El nombre de la sección es obligatorio')
  }

  const normalizedFields = (params.fields || [])
    .map((field) => normalizeFieldDraft(field))
    .filter(
      (field) => field.name.length > 0 && !isMyBrainStatusFieldName(field.name),
    )

  const { data, error } = await supabase
    .from('pml_dim_section')
    .insert({
      id_user: userId,
      ds_section: trimmedName,
      ds_logo: trimmedLogo,
      ds_color: trimmedColor,
      ds_brain_region: params.brainRegion,
      is_system_section: false,
      ds_system_key: null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error al crear sección de MyBrain:', error)
    throw error
  }

  const fieldsToCreate = [
    {
      name: MYBRAIN_STATUS_FIELD_NAME,
      type: 'picklist' as MyBrainFieldType,
      description: 'Whether this record is a plan or something already done.',
      options: MYBRAIN_STATUS_OPTIONS,
    },
    ...normalizedFields,
  ]

  if (fieldsToCreate.length > 0) {
    const fieldRows = fieldsToCreate.map((field, index) => {
      const row = {
        id_section: data.id_section,
        ds_section_field: field.name,
        ds_field_type: field.type,
        id_order: index,
        ...(field.description ? { ds_field_description: field.description } : {}),
      }

      const options = stringifyFieldOptions(field.options)

      return options ? { ...row, ds_field_options: options } : row
    })

    const { error: fieldError } = await supabase
      .from('pml_dim_section_field')
      .insert(fieldRows as any)

    if (fieldError) {
      console.error('Error al crear los campos iniciales de MyBrain:', fieldError)
      throw fieldError
    }
  }

  return data
}

export async function ensureMyBrainStatusField(
  supabase: SupabaseClient<Database>,
  sectionId: string,
): Promise<MyBrainSectionFieldWithConfig> {
  const fields = await getSectionFields(supabase, sectionId)
  const existing = fields.find((field) =>
    isMyBrainStatusFieldName(field.ds_section_field),
  )
  const fieldOrders = fields
    .map((field) => field.id_order)
    .filter((order): order is number => typeof order === 'number')
  const firstOrder = fieldOrders.length > 0 ? Math.min(...fieldOrders) - 1 : 0

  const payload = {
    ds_section_field: MYBRAIN_STATUS_FIELD_NAME,
    ds_field_type: 'picklist',
    ds_field_description:
      'Whether this record is a plan or something already done.',
    ds_field_options: stringifyFieldOptions(MYBRAIN_STATUS_OPTIONS),
    id_order: existing?.id_order ?? firstOrder,
  }

  if (existing) {
    const { data, error } = await supabase
      .from('pml_dim_section_field')
      .update(payload as any)
      .eq('id_field', existing.id_field)
      .select()
      .single()

    if (error) {
      console.error('Error al asegurar el campo Status de MyBrain:', error)
      throw error
    }

    return data as MyBrainSectionFieldWithConfig
  }

  const { data, error } = await supabase
    .from('pml_dim_section_field')
    .insert({
      id_section: sectionId,
      ...payload,
    } as any)
    .select()
    .single()

  if (error) {
    console.error('Error al crear el campo Status de MyBrain:', error)
    throw error
  }

  return data as MyBrainSectionFieldWithConfig
}

export async function getSectionById(
  supabase: SupabaseClient<Database>,
  userId: string,
  sectionId: string
): Promise<MyBrainSection | null> {
  const { data, error } = await supabase
    .from('pml_dim_section')
    .select('*')
    .eq('id_user', userId)
    .eq('id_section', sectionId)
    .maybeSingle()

  if (error) {
    console.error('Error al obtener sección de MyBrain:', error)
    throw error
  }

  return data
}

export async function getSectionFields(
  supabase: SupabaseClient<Database>,
  sectionId: string
): Promise<MyBrainSectionFieldWithConfig[]> {
  const { data, error } = await supabase
    .from('pml_dim_section_field')
    .select('*')
    .eq('id_section', sectionId)
    .order('id_order', { ascending: true, nullsFirst: false })
    .order('dt_created', { ascending: true })

  if (error) {
    console.error('Error al obtener campos de la sección:', error)
    throw error
  }

  return (data || []) as MyBrainSectionFieldWithConfig[]
}

export async function getSectionWithFields(
  supabase: SupabaseClient<Database>,
  userId: string,
  sectionId: string
): Promise<MyBrainSectionWithFields | null> {
  const section = await getSectionById(supabase, userId, sectionId)

  if (!section) {
    return null
  }

  if (!section.is_system_section) {
    await ensureMyBrainStatusField(supabase, section.id_section)
  }

  const fields = await getSectionFields(supabase, section.id_section)

  return {
    ...section,
    fields,
  }
}

export async function createSectionField(
  supabase: SupabaseClient<Database>,
  userId: string,
  sectionId: string,
  params: {
    name: string
    type: MyBrainFieldType
    description?: string | null
    options?: string[]
  }
): Promise<MyBrainSectionFieldWithConfig> {
  const section = await getSectionById(supabase, userId, sectionId)

  if (!section) {
    throw new Error('No se ha encontrado la sección')
  }

  const normalizedField = normalizeFieldDraft(params)

  const { data: latestField } = await supabase
    .from('pml_dim_section_field')
    .select('id_order')
    .eq('id_section', sectionId)
    .order('id_order', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (latestField?.id_order ?? -1) + 1

  const insertPayload = {
    id_section: sectionId,
    ds_section_field: normalizedField.name,
    ds_field_type: normalizedField.type,
    id_order: nextOrder,
    ...(normalizedField.description ? { ds_field_description: normalizedField.description } : {}),
    ...(normalizedField.options.length > 0
      ? { ds_field_options: stringifyFieldOptions(normalizedField.options) }
      : {}),
  }

  const { data, error } = await supabase
    .from('pml_dim_section_field')
    .insert(insertPayload as any)
    .select()
    .single()

  if (error) {
    console.error('Error al crear campo de MyBrain:', error)
    throw error
  }

  return data as MyBrainSectionFieldWithConfig
}

export async function updateSection(
  supabase: SupabaseClient<Database>,
  userId: string,
  sectionId: string,
  params: {
    name: string
    logo?: string | null
    color?: string | null
  }
): Promise<MyBrainSection> {
  const section = await getSectionById(supabase, userId, sectionId)

  if (!section) {
    throw new Error('No se ha encontrado la sección')
  }

  const trimmedName = params.name.trim()
  if (!trimmedName) {
    throw new Error('El nombre de la sección es obligatorio')
  }

  const { data, error } = await supabase
    .from('pml_dim_section')
    .update({
      ds_section: trimmedName,
      ds_logo: params.logo?.trim() || null,
      ds_color: params.color?.trim() || null,
    })
    .eq('id_section', sectionId)
    .eq('id_user', userId)
    .select()
    .single()

  if (error) {
    console.error('Error al actualizar sección de MyBrain:', error)
    throw error
  }

  return data
}

export async function updateSectionField(
  supabase: SupabaseClient<Database>,
  userId: string,
  sectionId: string,
  fieldId: string,
  params: {
    name: string
    type: MyBrainFieldType
    description?: string | null
    options?: string[]
  }
): Promise<MyBrainSectionFieldWithConfig> {
  const section = await getSectionById(supabase, userId, sectionId)

  if (!section) {
    throw new Error('No se ha encontrado la sección')
  }

  const normalizedField = normalizeFieldDraft(params)
  const updatePayload = {
    ds_section_field: normalizedField.name,
    ds_field_type: normalizedField.type,
    ds_field_description: normalizedField.description,
    ds_field_options:
      normalizedField.options.length > 0
        ? stringifyFieldOptions(normalizedField.options)
        : null,
  }

  const { data, error } = await supabase
    .from('pml_dim_section_field')
    .update(updatePayload as any)
    .eq('id_field', fieldId)
    .eq('id_section', sectionId)
    .select()
    .single()

  if (error) {
    console.error('Error al actualizar campo de MyBrain:', error)
    throw error
  }

  return data as MyBrainSectionFieldWithConfig
}

export async function getEntryCountBySection(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('gnp_fct_entries')
    .select('id_section')
    .eq('id_user', userId)

  if (error) {
    console.error('Error al obtener el volumen por sección de MyBrain:', error)
    throw error
  }

  return (data || []).reduce<Record<string, number>>((acc, row) => {
    acc[row.id_section] = (acc[row.id_section] || 0) + 1
    return acc
  }, {})
}

export function mapSectionsToCards(
  sections: MyBrainSection[],
  entryCountBySection: Record<string, number>
): MyBrainSectionCard[] {
  return sections.map((section) => ({
      id: section.id_section,
      name: section.ds_section,
      description: 'Organiza recuerdos, notas y referencias de esta parte de tu vida.',
      href: `/mybrain/sections/${section.id_section}`,
      isSystemSection: false,
      systemKey: section.ds_system_key,
      logo: section.ds_logo,
      color: section.ds_color,
      brainRegion: section.ds_brain_region as MyBrainBrainRegion,
      brainPositionX: section.ft_brain_position_x,
      brainPositionY: section.ft_brain_position_y,
      entryCount: entryCountBySection[section.id_section] || 0,
      metadata: section.dt_created
        ? `Creada el ${new Date(section.dt_created).toLocaleDateString('es-ES')}`
        : 'Sección personal',
    }))
}
