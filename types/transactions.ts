import type { Database } from './supabase'

// Tipos de la base de datos
export type Transaction = Database['public']['Tables']['gnp_fct_transactions']['Row']
export type TransactionInsert = Database['public']['Tables']['gnp_fct_transactions']['Insert']
export type TransactionUpdate = Database['public']['Tables']['gnp_fct_transactions']['Update']

export type Category = Database['public']['Tables']['pml_dim_category']['Row']
export type CategoryInsert = Database['public']['Tables']['pml_dim_category']['Insert']

export type Subcategory = Database['public']['Tables']['pml_dim_subcategory']['Row']
export type SubcategoryInsert = Database['public']['Tables']['pml_dim_subcategory']['Insert']

export type TransactionType = Database['public']['Tables']['pml_dim_transaction_type']['Row']

export type Tag = Database['public']['Tables']['pml_dim_tag']['Row']

// Tipos para el formulario
export type TransactionFormData = {
  id_type: string
  id_category: string | null
  id_subcategory: string | null
  ft_amount: number
  dt_date: string
  ds_month_declared: string // Formato MM-YYYY
  id_tag: string | null
  selectedUsers: string[] // IDs de usuarios afectados
  ds_comments: string | null
}

// Tipo para el tipo de transacción (Income o Expense)
export type TransactionTypeName = 'Income' | 'Expense'

// Errores de validación del formulario
export type TransactionFormErrors = {
  id_type?: string
  id_category?: string
  id_subcategory?: string
  ft_amount?: string
  dt_date?: string
  ds_month_declared?: string
  id_tag?: string
  selectedUsers?: string
  ds_comments?: string
}

// Función de validación
export function validateTransactionForm(
  data: TransactionFormData,
  requireUsers: boolean = true
): TransactionFormErrors {
  const errors: TransactionFormErrors = {}

  if (!data.id_type) {
    errors.id_type = 'El tipo de transacción es requerido'
  }

  if (!data.ft_amount || data.ft_amount <= 0) {
    errors.ft_amount = 'El importe debe ser mayor a 0'
  }

  if (!data.dt_date) {
    errors.dt_date = 'La fecha es requerida'
  }

  if (!data.ds_month_declared) {
    errors.ds_month_declared = 'El mes declarado es requerido'
  } else {
    // Validar formato MM-YYYY
    const monthYearRegex = /^(0[1-9]|1[0-2])-\d{4}$/
    if (!monthYearRegex.test(data.ds_month_declared)) {
      errors.ds_month_declared = 'El formato debe ser MM-YYYY (ej: 01-2024)'
    }
  }

  if (requireUsers && (!data.selectedUsers || data.selectedUsers.length === 0)) {
    errors.selectedUsers = 'Debe seleccionar al menos una persona'
  }

  return errors
}

