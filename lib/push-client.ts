/** Pide al servidor que revise si algún gasto ha llevado una partida a su límite (y avise por notificación). No bloquea nada. */
export function checkBudgetAlerts(idFamily: string) {
  void fetch('/api/push/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idFamily }),
    keepalive: true,
  }).catch(() => undefined)
}
