export const MYBRAIN_STATUS_FIELD_NAME = 'Status'
export const MYBRAIN_STATUS_OPTIONS = ['Want to', 'Done']

export function isMyBrainStatusFieldName(value: string) {
  return value.trim().toLowerCase() === MYBRAIN_STATUS_FIELD_NAME.toLowerCase()
}
