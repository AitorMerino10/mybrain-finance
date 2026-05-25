import MyBrainSetupNotice from '@/components/mybrain/MyBrainSetupNotice'
import SectionDetailClient from '@/components/mybrain/SectionDetailClient'
import { requireMyBrainUser } from '@/lib/mybrain/auth'
import { getEntriesForSection } from '@/lib/mybrain/entries'
import { isMissingMyBrainSchemaError } from '@/lib/mybrain/errors'
import { getSectionWithFields } from '@/lib/mybrain/sections'
import { notFound } from 'next/navigation'

export default async function MyBrainSectionPage({
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

    const entries = await getEntriesForSection(supabase, user.id, section.id_section)

    return <SectionDetailClient section={section} userId={user.id} entries={entries} />
  } catch (error) {
    if (isMissingMyBrainSchemaError(error)) {
      return <MyBrainSetupNotice />
    }

    throw error
  }
}
