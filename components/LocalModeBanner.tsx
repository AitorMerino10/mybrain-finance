'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  deleteTrackedTestTransactions,
  getTestTransactionIds,
  isLocalhost,
  subscribeToTestRecords,
} from '@/lib/test-records'

/** Aviso visible solo en localhost: lo que se guarda va a la base real y se puede limpiar lo creado como prueba. */
export default function LocalModeBanner() {
  const [visible, setVisible] = useState(false)
  const [count, setCount] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!isLocalhost()) return
    setVisible(true)
    const refresh = () => setCount(getTestTransactionIds().length)
    refresh()
    return subscribeToTestRecords(refresh)
  }, [])

  if (!visible) return null

  const handleDelete = async () => {
    if (!window.confirm(`¿Borrar de la base de datos real las ${count} transacciones creadas como prueba desde local?`)) return
    setDeleting(true)
    try {
      const deleted = await deleteTrackedTestTransactions(supabase)
      window.alert(`Borradas ${deleted} de ${count} transacciones de prueba.`)
      window.location.reload()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <p>
        <strong>Modo local:</strong> lo que guardes aquí se escribe en la base de datos <strong>real</strong>.
        {count > 0 ? ` Has creado ${count} ${count === 1 ? 'transacción' : 'transacciones'} de prueba desde este navegador.` : ' Las transacciones que crees desde local se anotan para poder borrarlas luego.'}
      </p>
      {count > 0 && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="shrink-0 rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {deleting ? 'Borrando…' : `Borrar registros de prueba (${count})`}
        </button>
      )}
    </div>
  )
}
