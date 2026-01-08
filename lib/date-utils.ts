/**
 * Formatea una fecha (string ISO o Date) al formato YYYY-MM para ds_month_declared
 * @param date - Fecha en formato ISO string o Date object
 * @returns String en formato YYYY-MM
 */
export function formatMonthDeclared(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  if (isNaN(dateObj.getTime())) {
    throw new Error('Fecha inválida')
  }
  
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  
  return `${year}-${month}`
}

/**
 * Obtiene la fecha actual en formato ISO string
 * @returns String en formato ISO (YYYY-MM-DD)
 */
export function getTodayISOString(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * Convierte formato MM-YYYY a YYYY-MM (formato de base de datos)
 * @param monthYear - String en formato MM-YYYY
 * @returns String en formato YYYY-MM
 */
export function convertMonthYearToDBFormat(monthYear: string): string {
  const [month, year] = monthYear.split('-')
  if (!month || !year || month.length !== 2 || year.length !== 4) {
    throw new Error('Formato inválido. Debe ser MM-YYYY')
  }
  return `${year}-${month}`
}

/**
 * Convierte formato YYYY-MM (base de datos) a MM-YYYY (formato de formulario)
 * @param dbFormat - String en formato YYYY-MM
 * @returns String en formato MM-YYYY
 */
export function convertDBFormatToMonthYear(dbFormat: string): string {
  const [year, month] = dbFormat.split('-')
  if (!month || !year || month.length !== 2 || year.length !== 4) {
    throw new Error('Formato inválido. Debe ser YYYY-MM')
  }
  return `${month}-${year}`
}

/**
 * Obtiene el mes actual en formato MM-YYYY
 * @returns String en formato MM-YYYY
 */
export function getCurrentMonthYear(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  return `${month}-${year}`
}

