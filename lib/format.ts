/**
 * Helpers para formateo de moneda y fechas
 */

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: Date | string, format: 'short' | 'long' | 'numeric' = 'short'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  if (format === 'short') {
    return dateObj.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
  } else if (format === 'long') {
    // Formato DD/MM/YYYY
    const day = String(dateObj.getDate()).padStart(2, '0')
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const year = dateObj.getFullYear()
    return `${day}/${month}/${year}`
  } else {
    return dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
  }
}

