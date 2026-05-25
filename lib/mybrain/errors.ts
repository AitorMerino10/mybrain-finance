export function isMissingMyBrainSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const code = 'code' in error ? String(error.code) : ''
  const message = 'message' in error ? String(error.message) : ''

  return (
    code === '42P01' ||
    message.toLowerCase().includes('pml_dim_section') ||
    message.toLowerCase().includes('pml_dim_section_field') ||
    message.toLowerCase().includes('gnp_fct_entries') ||
    message.toLowerCase().includes('gnp_fct_entry_values')
  )
}
