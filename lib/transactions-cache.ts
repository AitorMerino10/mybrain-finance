// Caché en memoria (solo en el navegador) de la lista completa de transacciones de la familia.
// Inicio, Presupuestos, Analítica y Mapa la piden cada una por su lado; así se descarga una vez y se reutiliza.
// Se vacía sola a los 60 s y al crear, editar o borrar cualquier transacción.

const TTL_MS = 60_000

type Entry = { at: number; promise: Promise<unknown> }
const cache = new Map<string, Entry>()

export function cachedLoad<T>(key: string, loader: () => Promise<T>, force = false): Promise<T> {
  const entry = cache.get(key)
  if (!force && entry && Date.now() - entry.at < TTL_MS) return entry.promise as Promise<T>

  const promise = loader()
  cache.set(key, { at: Date.now(), promise })
  // Si falla, no se guarda el error
  promise.catch(() => {
    if (cache.get(key)?.promise === promise) cache.delete(key)
  })
  return promise
}

export function invalidateTransactionsCache(): void {
  cache.clear()
}
