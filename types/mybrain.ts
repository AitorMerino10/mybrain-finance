import type { Database } from './supabase'

export type MyBrainFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'photo'
  | 'location'
  | 'url'
  | 'picklist'

export type MyBrainBrainRegion =
  | 'frontal_left'
  | 'frontal_right'
  | 'parietal_left'
  | 'parietal_right'
  | 'temporal_left'
  | 'temporal_right'
  | 'occipital_left'
  | 'occipital_right'
  | 'cerebellum'

export const MYBRAIN_FIELD_TYPES: MyBrainFieldType[] = [
  'text',
  'number',
  'date',
  'photo',
  'location',
  'url',
  'picklist',
]

export const MYBRAIN_SECTION_ICON_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '🧠', label: 'Cerebro' },
  { value: '🍴', label: 'Comida' },
  { value: '🍷', label: 'Vinos' },
  { value: '🍸', label: 'Cocteles' },
  { value: '☕', label: 'Cafe' },
  { value: '📚', label: 'Libros' },
  { value: '🍽️', label: 'Restaurantes' },
  { value: '💡', label: 'Ideas' },
  { value: '👤', label: 'Personas' },
  { value: '👥', label: 'Grupos' },
  { value: '🎬', label: 'Peliculas' },
  { value: '🎵', label: 'Musica' },
  { value: '🎧', label: 'Podcasts' },
  { value: '✈️', label: 'Viajes' },
  { value: '🏨', label: 'Hoteles' },
  { value: '🏃', label: 'Habitos' },
  { value: '💪', label: 'Salud' },
  { value: '🧘', label: 'Bienestar' },
  { value: '🏠', label: 'Casa' },
  { value: '📍', label: 'Lugares' },
  { value: '🌍', label: 'Paises' },
  { value: '💼', label: 'Trabajo' },
  { value: '🚀', label: 'Proyectos' },
  { value: '📝', label: 'Notas' },
  { value: '✅', label: 'Tareas' },
  { value: '🎁', label: 'Regalos' },
  { value: '❤️', label: 'Favoritos' },
  { value: '🐶', label: 'Mascotas' },
  { value: '👶', label: 'Familia' },
  { value: '🎓', label: 'Aprendizaje' },
  { value: '🏦', label: 'Bancos' },
  { value: '🍿', label: 'Series' },
  { value: '🎮', label: 'Juegos' },
  { value: '📷', label: 'Fotos' },
  { value: '🛍️', label: 'Compras' },
  { value: '🌿', label: 'Naturaleza' },
]

export const MYBRAIN_SECTION_COLOR_OPTIONS: Array<{
  value: string
  label: string
}> = [
  { value: '#90EBD6', label: 'Menta' },
  { value: '#C7CEEA', label: 'Lavanda' },
  { value: '#F6C9B8', label: 'Melocoton' },
  { value: '#F5E6A8', label: 'Arena' },
  { value: '#A7D8F2', label: 'Cielo' },
  { value: '#F1B5D8', label: 'Rosa' },
  { value: '#B8E0C8', label: 'Salvia' },
  { value: '#D7C5F5', label: 'Lila' },
]

export const MYBRAIN_BRAIN_REGIONS: Array<{
  value: MyBrainBrainRegion
  label: string
}> = [
  { value: 'frontal_left', label: 'Frontal izquierda' },
  { value: 'frontal_right', label: 'Frontal derecha' },
  { value: 'parietal_left', label: 'Parietal izquierda' },
  { value: 'parietal_right', label: 'Parietal derecha' },
  { value: 'temporal_left', label: 'Temporal izquierda' },
  { value: 'temporal_right', label: 'Temporal derecha' },
  { value: 'occipital_left', label: 'Occipital izquierda' },
  { value: 'occipital_right', label: 'Occipital derecha' },
  { value: 'cerebellum', label: 'Cerebelo' },
]

export type MyBrainSection = Database['public']['Tables']['pml_dim_section']['Row']
export type MyBrainSectionInsert = Database['public']['Tables']['pml_dim_section']['Insert']

export type MyBrainSectionField = Database['public']['Tables']['pml_dim_section_field']['Row']
export type MyBrainSectionFieldInsert = Database['public']['Tables']['pml_dim_section_field']['Insert']
export type MyBrainSectionFieldWithConfig = MyBrainSectionField & {
  ds_field_options?: string | null
  ds_field_description?: string | null
}

export type MyBrainEntry = Database['public']['Tables']['gnp_fct_entries']['Row']
export type MyBrainEntryInsert = Database['public']['Tables']['gnp_fct_entries']['Insert']

export type MyBrainEntryValue = Database['public']['Tables']['gnp_fct_entry_values']['Row']
export type MyBrainEntryValueInsert = Database['public']['Tables']['gnp_fct_entry_values']['Insert']

export type MyBrainEntryValueWithField = {
  id_field: string
  ds_section_field: string
  ds_field_type: MyBrainFieldType
  ds_value: string | null
  ds_field_options?: string | null
}

export type MyBrainEntryWithValues = MyBrainEntry & {
  values: MyBrainEntryValueWithField[]
}

export type MyBrainSectionWithFields = MyBrainSection & {
  fields: MyBrainSectionFieldWithConfig[]
}

export type MyBrainSectionCard = {
  id: string
  name: string
  description: string
  href: string
  isSystemSection: boolean
  systemKey: string | null
  metadata: string
  logo: string | null
  color: string | null
  brainRegion: MyBrainBrainRegion
  brainPositionX: number | null
  brainPositionY: number | null
  entryCount: number
}

export type MyBrainAISectionContext = {
  id: string
  name: string
  logo: string | null
  color: string | null
  keywords: string[]
  fields: MyBrainAISectionFieldContext[]
}

export type MyBrainAISectionFieldContext = {
  id: string
  name: string
  description: string | null
  type: MyBrainFieldType
  options: string[]
  aiSupported: boolean
}

export type MyBrainAIProposalStatus = 'ready' | 'needs_clarification'
export type MyBrainAIConfidence = 'high' | 'medium' | 'low'

export type MyBrainAIProposalField = {
  id_field: string
  fieldName: string
  fieldDescription: string | null
  fieldType: MyBrainFieldType
  options: string[]
  value: string
  isSuggested: boolean
  aiSupported: boolean
}

export type MyBrainAIProposalEntry = {
  sectionId: string
  sectionName: string
  title: string
  eventDate: string
  confidence: MyBrainAIConfidence
  warnings: string[]
  fields: MyBrainAIProposalField[]
  missingFields: string[]
}

export type MyBrainAIProposalResponse = {
  status: MyBrainAIProposalStatus
  inputText: string
  normalizedInputText: string
  summary: string
  warnings: string[]
  questions: string[]
  proposals: MyBrainAIProposalEntry[]
}

export type MyBrainAISaveRequest = {
  proposals: MyBrainAIProposalEntry[]
}

export type MyBrainAISaveResult = {
  createdEntries: Array<{
    entryId: string
    sectionId: string
    sectionName: string
    title: string
  }>
}

export type MyBrainAIFinanceMember = {
  id: string
  name: string
  email: string
}

export type MyBrainAIFinanceSubcategoryOption = {
  id: string
  name: string
  categoryId: string
}

export type MyBrainAIFinanceCategoryOption = {
  id: string
  name: string
  subcategories: MyBrainAIFinanceSubcategoryOption[]
}

export type MyBrainAIFinanceProposal = {
  amount: number | null
  date: string
  declaredMonth: string
  categoryId: string | null
  subcategoryId: string | null
  description: string
  affectedUserIds: string[]
  confidence: MyBrainAIConfidence
  warnings: string[]
  missingFields: string[]
}

export type MyBrainAIFinanceProposalResponse = {
  status: MyBrainAIProposalStatus
  inputText: string
  normalizedInputText: string
  summary: string
  warnings: string[]
  questions: string[]
  proposal: MyBrainAIFinanceProposal | null
  context: {
    familyId: string | null
    familyName: string | null
    transactionTypeId: string | null
    currentUserId: string
    members: MyBrainAIFinanceMember[]
    categories: MyBrainAIFinanceCategoryOption[]
  }
}

export type MyBrainAIFinanceSaveRequest = {
  proposal: MyBrainAIFinanceProposal
}

export type MyBrainAIFinanceSaveResult = {
  createdTransaction: {
    transactionId: string
    amount: number
    date: string
    categoryId: string | null
    subcategoryId: string | null
    affectedUserIds: string[]
    description: string
  }
}

export type DiaryEntryItem = {
  kind: 'entry'
  id: string
  title: string
  sectionName: string
  eventDate: string
  createdAt: string | null
  values: MyBrainEntryValueWithField[]
}

export type DiaryFinanceItem = {
  kind: 'finance'
  id: string
  title: string
  familyName: string | null
  categoryName: string | null
  transactionType: 'Income' | 'Expense' | null
  amount: number
  eventDate: string
  createdAt: string | null
}

export type DiaryItem = DiaryEntryItem | DiaryFinanceItem
