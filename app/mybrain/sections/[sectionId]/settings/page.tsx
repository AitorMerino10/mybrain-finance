import Link from 'next/link'
import SectionFieldsEditor from '@/components/mybrain/SectionFieldsEditor'
import MyBrainSetupNotice from '@/components/mybrain/MyBrainSetupNotice'
import { requireMyBrainUser } from '@/lib/mybrain/auth'
import { isMissingMyBrainSchemaError } from '@/lib/mybrain/errors'
import { getSectionWithFields } from '@/lib/mybrain/sections'
import { notFound } from 'next/navigation'

export default async function MyBrainSectionSettingsPage({
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

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            {section.ds_section}
          </h2>
          <Link
            href={`/mybrain/sections/${section.id_section}`}
            className="rounded-2xl border border-white/15 px-3 py-2 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10"
          >
            Volver
          </Link>
        </div>

        <SectionFieldsEditor userId={user.id} section={section} />
      </div>
    )
  } catch (error) {
    if (isMissingMyBrainSchemaError(error)) {
      return <MyBrainSetupNotice />
    }

    throw error
  }
}
