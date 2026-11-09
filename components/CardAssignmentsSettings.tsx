'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { deleteCardAssignment, getCardAssignments, saveCardAssignment, type CardAssignment } from '@/lib/cards'
import { getFamilyMembers, type FamilyMember } from '@/lib/family'

/** Relaciona cada tarjeta de los pagos con el móvil con las personas a las que se asignan sus gastos por defecto. */
export default function CardAssignmentsSettings({ idFamily }: { idFamily: string }) {
  const [cards, setCards] = useState<CardAssignment[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [newCard, setNewCard] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [loadedCards, loadedMembers] = await Promise.all([getCardAssignments(supabase, idFamily), getFamilyMembers(supabase, idFamily)])
    setCards(loadedCards)
    setMembers(loadedMembers)
  }, [idFamily])

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudieron cargar las tarjetas'))
      .finally(() => setLoading(false))
  }, [load])

  const nameOf = (member: FamilyMember) => member.ds_user || member.ds_email.split('@')[0]

  const toggleUser = async (card: CardAssignment, idUser: string) => {
    const next = card.ds_user_ids.includes(idUser) ? card.ds_user_ids.filter((id) => id !== idUser) : [...card.ds_user_ids, idUser]
    setCards((prev) => prev.map((item) => (item.id_card_assignment === card.id_card_assignment ? { ...item, ds_user_ids: next } : item)))
    setError(null)
    try {
      await saveCardAssignment(supabase, { idFamily, card: card.ds_card, userIds: next })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      await load()
    }
  }

  const add = async () => {
    setError(null)
    try {
      await saveCardAssignment(supabase, { idFamily, card: newCard, userIds: [] })
      setNewCard('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo añadir la tarjeta (¿falta ejecutar la migración?)')
    }
  }

  const remove = async (card: CardAssignment) => {
    if (!window.confirm(`¿Quitar "${card.ds_card}"? Volverá a aparecer si pagas con ella, sin personas asignadas.`)) return
    try {
      await deleteCardAssignment(supabase, card.id_card_assignment)
      setCards((prev) => prev.filter((item) => item.id_card_assignment !== card.id_card_assignment))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar la tarjeta')
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <h3 className="text-sm font-semibold text-gray-900">4. Tarjetas y personas</h3>
      <p className="mt-1 text-sm text-gray-500">
        Elige de quién son por defecto los gastos de cada tarjeta. Por ejemplo, marca a las dos personas en tu tarjeta conjunta y, al completar un pendiente pagado con ella, saldrá
        ya repartido entre las dos. Siempre puedes cambiarlo al completar el gasto. Si no marcas a nadie, el gasto es solo de quien paga.
      </p>

      {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-800">{error}</p>}

      {loading ? (
        <p className="mt-3 text-sm text-gray-500">Cargando…</p>
      ) : cards.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
          Aún no hay tarjetas. Aparecerán solas cuando llegue el primer pago desde el móvil, o puedes añadirlas a mano aquí abajo.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {cards.map((card) => (
            <li key={card.id_card_assignment} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium text-gray-900">💳 {card.ds_card}</p>
                <button onClick={() => remove(card)} className="shrink-0 text-xs font-medium text-red-600 hover:underline">
                  Quitar
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {members.map((member) => {
                  const checked = card.ds_user_ids.includes(member.id_user)
                  return (
                    <button
                      key={member.id_user}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => toggleUser(card, member.id_user)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        checked ? 'border-slate-900 bg-slate-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {nameOf(member)}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                {card.ds_user_ids.length === 0 ? 'Sin asignar: solo de quien paga.' : card.ds_user_ids.length === 1 ? 'Gasto de esa persona.' : 'Gasto compartido entre las personas marcadas.'}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={newCard}
          onChange={(event) => setNewCard(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && newCard.trim() && add()}
          placeholder="Añadir tarjeta a mano (tal como aparece en el pendiente)"
          maxLength={60}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
        />
        <button
          onClick={add}
          disabled={!newCard.trim()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          Añadir
        </button>
      </div>
    </div>
  )
}
