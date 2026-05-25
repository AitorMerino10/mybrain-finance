import Link from 'next/link'
import AICaptureComposer from '@/components/mybrain/AICaptureComposer'
import MyBrainSetupNotice from '@/components/mybrain/MyBrainSetupNotice'
import { requireMyBrainUser } from '@/lib/mybrain/auth'
import { isMissingMyBrainSchemaError } from '@/lib/mybrain/errors'
import {
  getEntryCountBySection,
  getSectionsForUser,
  mapSectionsToCards,
} from '@/lib/mybrain/sections'

export default async function MyBrainCapturePage() {
  const { supabase, user } = await requireMyBrainUser()

  try {
    const [sections, entryCountBySection] = await Promise.all([
      getSectionsForUser(supabase, user.id),
      getEntryCountBySection(supabase, user.id),
    ])
    const sectionCards = mapSectionsToCards(sections, entryCountBySection)

    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center text-center">
        <div className="rounded-[32px] border border-white/10 bg-white/5 px-6 py-8 shadow-[0_24px_80px_rgba(5,10,24,0.22)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#90EBD6]">
            Quick capture
          </p>
          <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
            Crea un registro con IA
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#A8B5D9]">
            Usa esta URL como shortcut para abrir directamente la captura de
            recuerdos, notas o gastos de Finance.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <AICaptureComposer sections={sectionCards} initiallyOpen hideTrigger />
            <Link
              href="/mybrain"
              className="rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10"
            >
              Volver a MyBrain
            </Link>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    if (isMissingMyBrainSchemaError(error)) {
      return <MyBrainSetupNotice />
    }

    throw error
  }
}
