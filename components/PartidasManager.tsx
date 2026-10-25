'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getFamilyMembers, type FamilyMember } from '@/lib/family'
import {
  createBudgetSubtype,
  createBudgetType,
  getBudgetSubtypes,
  getBudgetTypes,
  hasFamilyBudgetTypes,
  seedFamilyBudgetTypes,
  updateBudgetSubtype,
  updateBudgetType,
  type BudgetSubtype,
  type BudgetType,
} from '@/lib/budgets'

type Cadence = 'monthly' | 'annual'

const CADENCE_LABEL: Record<Cadence, string> = {
  monthly: 'Importe al mes',
  annual: 'Total del periodo',
}

const fieldClass =
  'rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#90EBD6]'

/**
 * Partidas presupuestarias de la familia: se crean, renombran, cambian de cadencia y se archivan.
 * Cada partida puede tener subpartidas (chips) que se añaden con el botón "+".
 * Archivar la oculta de los selectores pero conserva su histórico.
 */
export default function PartidasManager({ idFamily, onChanged }: { idFamily: string; onChanged?: () => void }) {
  const [types, setTypes] = useState<BudgetType[]>([])
  const [subtypes, setSubtypes] = useState<BudgetSubtype[]>([])
  const [subtypesAvailable, setSubtypesAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCadence, setNewCadence] = useState<Cadence>('monthly')
  const [newOwner, setNewOwner] = useState('')
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null)
  const [newSubName, setNewSubName] = useState('')

  const load = useCallback(async () => {
    try {
      setError(null)
      setTypes(await getBudgetTypes(supabase, idFamily, { includeArchived: true }))
      setMembers(await getFamilyMembers(supabase, idFamily))
      const subResult = await getBudgetSubtypes(supabase, idFamily, { includeArchived: true })
      setSubtypes(subResult.subtypes)
      setSubtypesAvailable(subResult.available)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las partidas')
    } finally {
      setLoading(false)
    }
  }, [idFamily])

  useEffect(() => {
    load()
  }, [load])

  // Si la columna id_family no existe, la migración aún no se ha ejecutado
  const migrationReady = types.length === 0 || types.some((type) => 'id_family' in type)
  const own = hasFamilyBudgetTypes(types, idFamily)
  const visible = types.filter((type) => showArchived || !type.is_archived)
  const archivedCount = types.filter((type) => type.is_archived).length

  const run = async (action: () => Promise<unknown>) => {
    try {
      setBusy(true)
      setError(null)
      await action()
      await load()
      onChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  const clearDraft = (id: string) =>
    setDrafts((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })

  const commitTypeName = (type: BudgetType) => {
    const draft = drafts[type.id_budget_type]
    clearDraft(type.id_budget_type)
    if (draft === undefined || draft.trim() === '' || draft.trim() === type.ds_budget_type) return
    run(() => updateBudgetType(supabase, { idBudgetType: type.id_budget_type, name: draft }))
  }

  const commitSubName = (sub: BudgetSubtype) => {
    const draft = drafts[sub.id_budget_subtype]
    clearDraft(sub.id_budget_subtype)
    if (draft === undefined || !draft.trim() || draft.trim() === sub.ds_budget_subtype) return
    run(() => updateBudgetSubtype(supabase, { idBudgetSubtype: sub.id_budget_subtype, name: draft }))
  }

  if (loading) return <p className="text-sm text-gray-500">Cargando partidas...</p>

  return (
    <section className="space-y-3 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-gray-900">Partidas presupuestarias</h3>
          <p className="text-sm text-gray-500">
            Los gastos que estimas para el año. Pulsa <span className="font-semibold text-gray-700">+</span> en una partida para
            añadirle subpartidas (Viaje → Esquí, Verano…).
          </p>
        </div>
        {migrationReady && own && !formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="rounded-xl border border-[#0d9488] px-3 py-1.5 text-sm font-semibold text-[#0d9488] hover:bg-[#90EBD6]/20"
          >
            + Partida
          </button>
        )}
        {migrationReady && own && formOpen && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!newName.trim()) return
              run(async () => {
                await createBudgetType(supabase, { idFamily, name: newName, periodicity: newCadence, idUser: newOwner || null })
                setNewName('')
                setNewOwner('')
                setFormOpen(false)
              })
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setFormOpen(false)
              }}
              placeholder="Nombre de la partida"
              aria-label="Nombre de la nueva partida"
              className={`${fieldClass} w-48`}
            />
            <select
              value={newCadence}
              onChange={(event) => setNewCadence(event.target.value as Cadence)}
              aria-label="Cadencia de la nueva partida"
              className={fieldClass}
            >
              {(Object.keys(CADENCE_LABEL) as Cadence[]).map((value) => (
                <option key={value} value={value}>
                  {CADENCE_LABEL[value]}
                </option>
              ))}
            </select>
            <select value={newOwner} onChange={(event) => setNewOwner(event.target.value)} aria-label="Para quién es la partida" className={fieldClass}>
              <option value="">Toda la familia</option>
              {members.map((member) => (
                <option key={member.id_user} value={member.id_user}>
                  Solo {member.ds_user || member.ds_email}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy || !newName.trim()}
              className="rounded-lg bg-[#0d9488] px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              Añadir
            </button>
            <button type="button" onClick={() => setFormOpen(false)} className="text-sm text-gray-400 hover:text-gray-700">
              ✕
            </button>
          </form>
        )}
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {!migrationReady && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Falta ejecutar en Supabase la migración <code>20261026100000_family_budget_partidas.sql</code> para poder crear y editar partidas propias.
        </p>
      )}

      {own && !subtypesAvailable && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Para crear subpartidas falta ejecutar la migración <code>20261026110000_budget_subpartidas.sql</code>.
        </p>
      )}

      {migrationReady && !own && (
        <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
          <p>Tu familia todavía no tiene partidas propias (ahora mismo se usan las de ejemplo).</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => seedFamilyBudgetTypes(supabase, idFamily))}
            className="mt-3 rounded-xl bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            Crear mis partidas a partir de las de ejemplo
          </button>
        </div>
      )}

      {own && (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100">
          {visible.map((type) => {
            const cadence = (type.ds_periodicity === 'annual' ? 'annual' : 'monthly') as Cadence
            const subs = subtypes.filter(
              (sub) => sub.id_budget_type === type.id_budget_type && (showArchived || !sub.is_archived)
            )
            const adding = addingSubFor === type.id_budget_type
            return (
              <li
                key={type.id_budget_type}
                className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 ${type.is_archived ? 'bg-gray-50 opacity-70' : 'hover:bg-gray-50/50'}`}
              >
                <input
                  value={drafts[type.id_budget_type] ?? type.ds_budget_type}
                  disabled={busy || type.is_archived}
                  onChange={(event) => setDrafts((current) => ({ ...current, [type.id_budget_type]: event.target.value }))}
                  onBlur={() => commitTypeName(type)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
                  }}
                  aria-label="Nombre de la partida"
                  className={`${fieldClass} w-44 border-transparent bg-transparent font-semibold hover:border-gray-200 focus:bg-white`}
                />
                <select
                  value={cadence}
                  disabled={busy || type.is_archived}
                  onChange={(event) => {
                    const next = event.target.value as Cadence
                    if (
                      !window.confirm(
                        `Cambiar "${type.ds_budget_type}" a "${CADENCE_LABEL[next]}" cambia cómo se interpretan sus importes ya guardados. ¿Continuar?`
                      )
                    )
                      return
                    run(() => updateBudgetType(supabase, { idBudgetType: type.id_budget_type, periodicity: next }))
                  }}
                  aria-label="Cadencia de la partida"
                  className={`${fieldClass} border-transparent bg-gray-50 text-xs text-gray-600`}
                >
                  {(Object.keys(CADENCE_LABEL) as Cadence[]).map((value) => (
                    <option key={value} value={value}>
                      {CADENCE_LABEL[value]}
                    </option>
                  ))}
                </select>

                <select
                  value={type.id_user ?? ''}
                  disabled={busy || type.is_archived}
                  onChange={(event) => {
                    const next = event.target.value || null
                    const who = next ? members.find((member) => member.id_user === next)?.ds_user || 'esa persona' : 'toda la familia'
                    if (!window.confirm(`¿Dejar "${type.ds_budget_type}" para ${who}? Lo ya guardado se conserva; solo cambia a quién se le ofrece.`)) return
                    run(() => updateBudgetType(supabase, { idBudgetType: type.id_budget_type, idUser: next }))
                  }}
                  aria-label="Para quién es la partida"
                  className={`${fieldClass} border-transparent bg-gray-50 text-xs text-gray-600`}
                >
                  <option value="">Toda la familia</option>
                  {members.map((member) => (
                    <option key={member.id_user} value={member.id_user}>
                      Solo {member.ds_user || member.ds_email}
                    </option>
                  ))}
                </select>

                {/* Subpartidas: chips editables + botón "+" en la misma línea */}
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  {!type.is_archived &&
                    subtypesAvailable &&
                    subs.map((sub) => {
                      const value = drafts[sub.id_budget_subtype] ?? sub.ds_budget_subtype
                      return (
                        <span
                          key={sub.id_budget_subtype}
                          className={`inline-flex items-center rounded-full bg-[#90EBD6]/25 pl-3 pr-1 text-sm text-teal-900 ${sub.is_archived ? 'opacity-50' : ''}`}
                        >
                          <input
                            value={value}
                            disabled={busy || sub.is_archived}
                            onChange={(event) => setDrafts((current) => ({ ...current, [sub.id_budget_subtype]: event.target.value }))}
                            onBlur={() => commitSubName(sub)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
                            }}
                            aria-label="Nombre de la subpartida"
                            style={{ width: `${Math.max(4, value.length + 1)}ch` }}
                            className="bg-transparent py-1 focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(() => updateBudgetSubtype(supabase, { idBudgetSubtype: sub.id_budget_subtype, archived: !sub.is_archived }))
                            }
                            title={sub.is_archived ? 'Restaurar subpartida' : 'Archivar subpartida'}
                            aria-label={sub.is_archived ? 'Restaurar subpartida' : 'Archivar subpartida'}
                            className="flex h-5 w-5 items-center justify-center rounded-full text-xs text-teal-700/60 hover:bg-white hover:text-red-600"
                          >
                            {sub.is_archived ? '↺' : '✕'}
                          </button>
                        </span>
                      )
                    })}
                  {!type.is_archived && subtypesAvailable &&
                    (adding ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault()
                          if (!newSubName.trim()) return
                          run(async () => {
                            await createBudgetSubtype(supabase, { idFamily, idBudgetType: type.id_budget_type, name: newSubName })
                            setNewSubName('')
                            setAddingSubFor(null)
                          })
                        }}
                        className="inline-flex items-center gap-1"
                      >
                        <input
                          autoFocus
                          value={newSubName}
                          onChange={(event) => setNewSubName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') setAddingSubFor(null)
                          }}
                          onBlur={() => {
                            if (!newSubName.trim()) setAddingSubFor(null)
                          }}
                          placeholder="Nombre…"
                          aria-label={`Nueva subpartida de ${type.ds_budget_type}`}
                          className="w-32 rounded-full border border-[#0d9488] px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#90EBD6]"
                        />
                        <button type="submit" disabled={busy} className="text-sm font-semibold text-[#0d9488] hover:underline">
                          ↵
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setNewSubName('')
                          setAddingSubFor(type.id_budget_type)
                        }}
                        title={`Añadir subpartida a ${type.ds_budget_type}`}
                        aria-label={`Añadir subpartida a ${type.ds_budget_type}`}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-gray-300 text-sm font-bold leading-none text-gray-400 hover:border-[#0d9488] hover:bg-[#90EBD6]/20 hover:text-[#0d9488]"
                      >
                        +
                      </button>
                    ))}
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => updateBudgetType(supabase, { idBudgetType: type.id_budget_type, archived: !type.is_archived }))}
                  className="text-xs font-medium text-gray-400 hover:text-gray-700 hover:underline"
                  title={type.is_archived ? 'Volver a usar esta partida' : 'La oculta de los selectores y conserva su histórico'}
                >
                  {type.is_archived ? 'Restaurar' : 'Archivar'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {own && archivedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowArchived((current) => !current)}
          className="text-xs font-medium text-gray-500 hover:text-gray-800 hover:underline"
        >
          {showArchived ? 'Ocultar archivadas' : `Ver archivadas (${archivedCount})`}
        </button>
      )}
    </section>
  )
}
