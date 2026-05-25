import Link from 'next/link'
import CreateSectionModal from '@/components/mybrain/CreateSectionModal'
import MyBrainSetupNotice from '@/components/mybrain/MyBrainSetupNotice'
import { getUserFamilies } from '@/lib/family'
import { requireMyBrainUser } from '@/lib/mybrain/auth'
import { isMissingMyBrainSchemaError } from '@/lib/mybrain/errors'
import {
  getEntryCountBySection,
  getSectionsForUser,
  mapSectionsToCards,
} from '@/lib/mybrain/sections'
import { getFinanceSystemSection } from '@/lib/mybrain/system-sections'

export default async function MyBrainSectionsPage() {
  const { supabase, user } = await requireMyBrainUser()

  try {
    const [families, sections, entryCountBySection] = await Promise.all([
      getUserFamilies(supabase, user.id),
      getSectionsForUser(supabase, user.id),
      getEntryCountBySection(supabase, user.id),
    ])

    const cards = [
      getFinanceSystemSection(families),
      ...mapSectionsToCards(sections, entryCountBySection),
    ]

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-white sm:text-2xl">Secciones</h2>
          <CreateSectionModal
            userId={user.id}
            triggerLabel="+ Nueva"
            triggerClassName="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
          />
        </div>

        {cards.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#A8B5D9]">
            Aún no hay secciones. Crea la primera para empezar.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
            {cards.map((section) => (
              <Link
                key={section.id}
                href={section.href}
                className="group flex flex-col items-center rounded-[24px] border border-white/10 bg-white/[0.04] p-5 text-center transition-all hover:border-white/20 hover:bg-white/[0.08]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-2xl text-white">
                  {section.logo || section.name.charAt(0).toUpperCase()}
                </div>
                <h3 className="mt-3 line-clamp-2 text-sm font-bold text-white sm:text-base">
                  {section.name}
                </h3>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A8B5D9]">
                  {section.entryCount} entradas
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  } catch (error) {
    if (isMissingMyBrainSchemaError(error)) {
      return <MyBrainSetupNotice />
    }

    throw error
  }
}
