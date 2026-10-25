'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { getFamilyMembers, type FamilyMember } from '@/lib/family'
import { getAllCategoriesByFamily } from '@/lib/categories'
import { getTagsByFamily } from '@/lib/tags'
import { getTransactionWithRelations, type TransactionWithRelations } from '@/lib/transactions'
import type { Category, Tag } from '@/types/transactions'
import EditTransactionModal from '../EditTransactionModal'

type EditFn = (idTransaction: string) => void

const EditContext = createContext<EditFn | null>(null)

/** Abre el editor de una transacción desde cualquier punto de la pantalla (null si no hay proveedor). */
export const useEditTransaction = () => useContext(EditContext)

type Lookups = { members: FamilyMember[]; categories: Category[]; tags: Tag[] }

/**
 * Permite editar cualquier transacción que se vea en pantalla: carga lo necesario al abrir el primer editor
 * y avisa con `onSaved` para que la pantalla recargue sus datos.
 */
export default function TransactionEditProvider({
  idFamily,
  idUser,
  onSaved,
  children,
}: {
  idFamily: string
  idUser: string
  onSaved: () => void
  children: ReactNode
}) {
  const lookups = useRef<Lookups | null>(null)
  const [editing, setEditing] = useState<{ transaction: TransactionWithRelations; lookups: Lookups } | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const edit = useCallback<EditFn>(
    async (idTransaction) => {
      try {
        setError(null)
        setLoadingId(idTransaction)
        if (!lookups.current) {
          const [members, categories, tags] = await Promise.all([
            getFamilyMembers(supabase, idFamily),
            getAllCategoriesByFamily(supabase, idFamily),
            getTagsByFamily(supabase, idFamily),
          ])
          lookups.current = { members, categories: categories as unknown as Category[], tags }
        }
        const transaction = await getTransactionWithRelations(supabase, idTransaction)
        if (!transaction) throw new Error('No se ha encontrado la transacción')
        setEditing({ transaction, lookups: lookups.current })
      } catch (err) {
        console.error('Error al abrir la transacción:', err)
        setError(err instanceof Error ? err.message : 'No se pudo abrir la transacción')
      } finally {
        setLoadingId(null)
      }
    },
    [idFamily]
  )

  return (
    <EditContext.Provider value={edit}>
      {children}
      {(loadingId || error) && (
        <div
          className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2 text-sm font-medium shadow-lg ${
            error ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
          }`}
          onClick={() => setError(null)}
        >
          {error || 'Abriendo transacción…'}
        </div>
      )}
      {editing && (
        <EditTransactionModal
          transaction={editing.transaction}
          idFamily={idFamily}
          idUser={idUser}
          familyMembers={editing.lookups.members}
          categories={editing.lookups.categories}
          tags={editing.lookups.tags}
          onClose={() => setEditing(null)}
          onSave={() => {
            setEditing(null)
            onSaved()
          }}
        />
      )}
    </EditContext.Provider>
  )
}

/** Lápiz para editar una transacción; no se muestra si no hay editor disponible. */
export function EditTransactionButton({ id, className = '' }: { id: string; className?: string }) {
  const edit = useEditTransaction()
  if (!edit) return null
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        edit(id)
      }}
      title="Editar transacción"
      aria-label="Editar transacción"
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  )
}
