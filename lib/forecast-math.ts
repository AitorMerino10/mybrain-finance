// Núcleo de la previsión de fin de mes: sin dependencias, para usarlo tanto en la web como en las notificaciones.

export type Status = 'ok' | 'warning' | 'over'


export type ProjectionInput = {
  daysInMonth: number
  /** Día del mes de hoy (1-31); lo gastado hasta hoy incluye el día de hoy */
  dayOfMonth: number
  spentToDate: number
  /** Parte de lo gastado hasta hoy que viene de cobros recurrentes (no se extrapola) */
  fixedSpentToDate: number
  /** Cobros recurrentes que aún faltan por llegar este mes */
  upcomingFixed: number
  /** Gasto variable diario de los meses anteriores (null si no hay histórico) */
  historyDailyRate: number | null
}

/**
 * Previsión de cierre de mes: lo gastado + los cobros recurrentes que faltan + el ritmo del gasto variable por los días que quedan.
 * Al principio de mes pesa más el ritmo de los meses anteriores; hacia el día 10 pesa solo el de este mes.
 */
export function projectMonth(input: ProjectionInput): { projected: number; dailyRate: number } {
  const variableToDate = Math.max(0, input.spentToDate - input.fixedSpentToDate)
  const currentRate = variableToDate / Math.max(1, input.dayOfMonth)
  const weight = Math.min(1, input.dayOfMonth / 10)
  const dailyRate = input.historyDailyRate === null ? currentRate : weight * currentRate + (1 - weight) * input.historyDailyRate
  const daysLeft = Math.max(0, input.daysInMonth - input.dayOfMonth)
  return { projected: input.spentToDate + input.upcomingFixed + dailyRate * daysLeft, dailyRate }
}

export function forecastStatus(projected: number, budget: number): Status {
  if (budget <= 0) return 'ok'
  if (projected > budget) return 'over'
  if (projected > budget * 0.9) return 'warning'
  return 'ok'
}
