import type { MyBrainSectionFieldWithConfig } from '@/types/mybrain'

export function parseFieldOptions(field: MyBrainSectionFieldWithConfig): string[] {
  if (!field.ds_field_options) {
    return []
  }

  try {
    const parsed = JSON.parse(field.ds_field_options)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0)
  } catch {
    return []
  }
}

export function stringifyFieldOptions(options: string[]): string | null {
  const cleaned = options.map((option) => option.trim()).filter((option) => option.length > 0)
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null
}
