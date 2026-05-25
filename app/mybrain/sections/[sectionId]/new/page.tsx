import Link from 'next/link'
import AICaptureComposer from '@/components/mybrain/AICaptureComposer'
import MyBrainSetupNotice from '@/components/mybrain/MyBrainSetupNotice'
import { requireMyBrainUser } from '@/lib/mybrain/auth'
import { isMissingMyBrainSchemaError } from '@/lib/mybrain/errors'
import {
  getEntryCountBySection,
  getSectionWithFields,
  getSectionsForUser,
  mapSectionsToCards,
} from '@/lib/mybrain/sections'
import { notFound } from 'next/navigation'

export default async function MyBrainNewEntryPage({
  params,
}: {
  params: { sectionId: string }
}) {
  const { supabase, user } = await requireMyBrainUser()

  try {
    const section = await getSectionWithFields(supabase, user.id, params.sectionId)

    if (!section) {
      notFound()
    }

    const [sections, entryCountBySection] = await Promise.all([
      getSectionsForUser(supabase, user.id),
      getEntryCountBySection(supabase, user.id),
    ])
    const sectionCards = mapSectionsToCards(sections, entryCountBySection)

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            Nueva entrada · {section.ds_section}
          </h2>
          <Link
            href={`/mybrain/sections/${section.id_section}`}
            className="rounded-2xl border border-white/15 px-3 py-2 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10"
          >
            Cancelar
          </Link>
        </div>

        <AICaptureComposer
          sections={sectionCards}
          initiallyOpen
          triggerLabel="Abrir captura con IA"
          triggerClassName="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
        />
      </div>
    )
  } catch (error) {
    if (isMissingMyBrainSchemaError(error)) {
      return <MyBrainSetupNotice />
    }

    throw error
  }
}
