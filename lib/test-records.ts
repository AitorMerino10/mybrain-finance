import type { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deleteTransaction } from '@/lib/transactions'

/**
 * Registros de prueba creados desde localhost.
 *
 * En local la app lee y escribe en la base de datos real. Para poder limpiar lo que se crea como prueba,
 * se anotan en este navegador los ids de las transacciones creadas desde localhost y se pueden borrar de golpe.
 */

const STORAGE_KEY = 'test_transaction_ids_v1'
const EVENT_NAME = 'test-records-changed'

export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

export function getTestTransactionIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function saveTestTransactionIds(ids: string[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(new Set(ids))))
  window.dispatchEvent(new Event(EVENT_NAME))
}

/** Anota una transacción creada desde localhost (no hace nada fuera de local). */
export function trackTestTransaction(idTransaction: string) {
  if (!isLocalhost()) return
  saveTestTransactionIds([...getTestTransactionIds(), idTransaction])
}

export function subscribeToTestRecords(listener: () => void): () => void {
  window.addEventListener(EVENT_NAME, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(EVENT_NAME, listener)
    window.removeEventListener('storage', listener)
  }
}

/** Borra de la base de datos todas las transacciones de prueba anotadas. Devuelve cuántas se borraron. */
export async function deleteTrackedTestTransactions(supabase: SupabaseClient<Database>): Promise<number> {
  const ids = getTestTransactionIds()
  let deleted = 0
  const remaining: string[] = []
  for (const id of ids) {
    try {
      await deleteTransaction(supabase, id)
      deleted++
    } catch (error) {
      console.error('No se pudo borrar el registro de prueba', id, error)
      remaining.push(id)
    }
  }
  saveTestTransactionIds(remaining)
  return deleted
}
