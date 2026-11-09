'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { BudgetSubtype, BudgetType } from '@/lib/budgets'

const fieldClass =
  'rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#90EBD6] disabled:bg-gray-50 disabled:text-gray-400'

type Cadence = 'monthly' | 'annual'

const CADENCE_LABEL: Record<Cadence, string> = {
  monthly: 'Cada mes',
  annual: 'Total del periodo',
}

type Member = { id_user: string; ds_user: string | null; ds_email: string | null }
const memberName = (member: Member) => member.ds_user || member.ds_email || 'esa persona'

export type PartidaPatch = { name?: string; periodicity?: Cadence; idUser?: string | null }

function PartidaRow({
  type,
  subs,
  members,
  canManage,
  subtypesAvailable,
  busy,
  onUpdate,
  onRemove,
  onAddSub,
  onRemoveSub,
}: {
  type: BudgetType
  subs: BudgetSubtype[]
  members: Member[]
  canManage: boolean
  subtypesAvailable: boolean
  busy: boolean
  onUpdate: (type: BudgetType, patch: PartidaPatch) => Promise<boolean>
  onRemove: (type: BudgetType) => void
  onAddSub: (idBudgetType: string, name: string) => Promise<boolean>
  onRemoveSub: (sub: BudgetSubtype) => void
}) {
  const [name, setName] = useState(type.ds_budget_type)
  const [addingSub, setAddingSub] = useState(false)
  const [subName, setSubName] = useState('')
  useEffect(() => setName(type.ds_budget_type), [type.ds_budget_type])

  const cadence = (type.ds_periodicity === 'annual' ? 'annual' : 'monthly') as Cadence
  const owner = (type as { id_user?: string | null }).id_user ?? ''

  const commitName = async () => {
    const next = name.trim()
    if (!next || next === type.ds_budget_type) {
      setName(type.ds_budget_type)
      return
    }
    if (!(await onUpdate(type, { name: next }))) setName(type.ds_budget_type)
  }

  return (
    <li className="group flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <input
          value={name}
          disabled={!canManage || busy}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
            if (event.key === 'Escape') setName(type.ds_budget_type)
          }}
          aria-label="Nombre de la partida"
          className={`${fieldClass} w-44 border-transparent bg-transparent py-1 font-medium hover:border-gray-200 focus:bg-white`}
        />
        <select
          value={cadence}
          disabled={!canManage || busy}
          onChange={(event) => {
            const next = event.target.value as Cadence
            if (
              !window.confirm(
                `Cambiar "${type.ds_budget_type}" a "${CADENCE_LABEL[next]}" cambia cómo se interpretan sus importes ya guardados. ¿Continuar?`
              )
            )
              return
            onUpdate(type, { periodicity: next })
          }}
          aria-label="Cómo se presupuesta"
          className={`${fieldClass} border-transparent bg-gray-50 py-1 text-xs text-gray-600`}
        >
          {(Object.keys(CADENCE_LABEL) as Cadence[]).map((value) => (
            <option key={value} value={value}>
              {CADENCE_LABEL[value]}
            </option>
          ))}
        </select>
        <select
          value={owner}
          disabled={!canManage || busy}
          onChange={(event) => {
            const next = event.target.value || null
            const who = next ? memberName(members.find((member) => member.id_user === next) ?? { id_user: next, ds_user: null, ds_email: null }) : 'toda la familia'
            if (!window.confirm(`¿Dejar "${type.ds_budget_type}" para ${who}? Lo ya guardado se conserva; solo cambia a quién se le ofrece.`)) return
            onUpdate(type, { idUser: next })
          }}
          aria-label="Para quién es la partida"
          className={`${fieldClass} border-transparent bg-gray-50 py-1 text-xs text-gray-600`}
        >
          <option value="">Toda la familia</option>
          {members.map((member) => (
            <option key={member.id_user} value={member.id_user}>
              Solo {memberName(member)}
            </option>
          ))}
        </select>
      </div>

      {(subs.length > 0 || (canManage && subtypesAvailable)) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {subs.map((sub) => (
            <span key={sub.id_budget_subtype} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
              ↳ {sub.ds_budget_subtype}
              {canManage && (
                <button
                  type="button"
                  onClick={() => onRemoveSub(sub)}
                  disabled={busy}
                  aria-label={`Quitar la subpartida ${sub.ds_budget_subtype}`}
                  className="text-gray-400 hover:text-red-500"
                >
                  ✕
                </button>
              )}
            </span>
          ))}
          {canManage &&
            subtypesAvailable &&
            (addingSub ? (
              <form
                onSubmit={async (event) => {
                  event.preventDefault()
                  if (!subName.trim()) return
                  if (await onAddSub(type.id_budget_type, subName)) {
                    setSubName('')
                    setAddingSub(false)
                  }
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  autoFocus
                  value={subName}
                  onChange={(event) => setSubName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setAddingSub(false)
                  }}
                  placeholder="Subpartida…"
                  className={`${fieldClass} w-40 py-1 text-xs`}
                />
                <button type="submit" disabled={busy} className="text-xs font-semibold text-[#0d9488] hover:underline">
                  Añadir
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setAddingSub(true)} className="text-xs font-medium text-[#0d9488] hover:underline">
                + subpartida
              </button>
            ))}
        </div>
      )}
    {canManage && (
      <button
        type="button"
        onClick={() => onRemove(type)}
        disabled={busy}
        title="Quitar esta partida (se archiva: su histórico se conserva)"
        aria-label={`Quitar la partida ${type.ds_budget_type}`}
        className="ml-auto text-sm text-gray-300 hover:text-red-500 disabled:opacity-40"
      >
        ✕
      </button>
    )}
    </li>
  )
}

/**
 * Paso "¿Qué presupuestos quieres tener?": solo decide las partidas (y sus subpartidas), sin importes.
 * Arriba, crear una nueva; debajo, editar las que ya existen.
 */
export default function PartidasStep({
  idFamily,
  scopeUserId,
  scopeName,
  members,
  budgetTypes,
  subtypes,
  subtypesAvailable,
  canManage,
  busy,
  error,
  onCreate,
  onUpdate,
  onRemove,
  onAddSub,
  onRemoveSub,
}: {
  idFamily: string
  scopeUserId: string | null
  scopeName: string
  members: Member[]
  budgetTypes: BudgetType[]
  subtypes: BudgetSubtype[]
  subtypesAvailable: boolean
  /** La familia ya tiene partidas propias (si no, hay que crearlas desde Presupuestos) */
  canManage: boolean
  busy: boolean
  error: string | null
  onCreate: (params: { name: string; cadence: Cadence; onlyForScope: boolean }) => Promise<boolean>
  onUpdate: (type: BudgetType, patch: PartidaPatch) => Promise<boolean>
  onRemove: (type: BudgetType) => void
  onAddSub: (idBudgetType: string, name: string) => Promise<boolean>
  onRemoveSub: (sub: BudgetSubtype) => void
}) {
  const [name, setName] = useState('')
  const [cadence, setCadence] = useState<Cadence>('monthly')
  const [onlyForScope, setOnlyForScope] = useState(false)

  const submit = async () => {
    if (!name.trim()) return
    if (await onCreate({ name, cadence, onlyForScope: onlyForScope && scopeUserId !== null })) setName('')
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {canManage ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
          className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-[#90EBD6]/15 px-3 py-2.5"
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nueva partida (ej.: Mascotas)"
            aria-label="Nombre de la nueva partida"
            className={`${fieldClass} min-w-[200px] flex-1`}
          />
          <select value={cadence} onChange={(event) => setCadence(event.target.value as Cadence)} aria-label="Cómo se presupuesta" className={fieldClass}>
            {(Object.keys(CADENCE_LABEL) as Cadence[]).map((value) => (
              <option key={value} value={value}>
                {CADENCE_LABEL[value]}
              </option>
            ))}
          </select>
          {scopeUserId && (
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={onlyForScope}
                onChange={(event) => setOnlyForScope(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#0d9488] focus:ring-[#90EBD6]"
              />
              Solo {scopeName}
            </label>
          )}
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-lg bg-[#0d9488] px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            + Añadir
          </button>
        </form>
      ) : (
        <p className="border-b border-gray-100 px-3 py-2.5 text-sm text-gray-600">
          Tu familia aún usa las partidas de ejemplo. Para crear o editar partidas,{' '}
          <Link href={`/budgets?family=${idFamily}`} className="font-semibold text-[#0d9488] underline">
            gestiónalas desde Presupuestos
          </Link>
          .
        </p>
      )}
      {error && <p className="m-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {budgetTypes.length === 0 ? (
        <p className="p-4 text-center text-sm text-gray-500">Todavía no hay partidas.</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {budgetTypes.map((type) => (
            <PartidaRow
              key={type.id_budget_type}
              type={type}
              subs={subtypes.filter((sub) => sub.id_budget_type === type.id_budget_type)}
              members={members}
              canManage={canManage}
              subtypesAvailable={subtypesAvailable}
              busy={busy}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onAddSub={onAddSub}
              onRemoveSub={onRemoveSub}
            />
          ))}
        </ul>
      )}
      <p className="border-t border-gray-100 bg-gray-50 px-3 py-1.5 text-[11px] text-gray-500">
        <strong>Cada mes</strong>: gastos que se repiten (casa, comida) · <strong>Total del periodo</strong>: puntuales o anuales (viajes, regalos). Todo se edita
        en la propia fila.
      </p>
    </section>
  )
}
