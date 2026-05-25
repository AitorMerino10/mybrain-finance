import MyBrainHomeClient from '@/components/mybrain/MyBrainHomeClient'
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

export default async function MyBrainPage() {
  const { supabase, user, userData } = await requireMyBrainUser()

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

    const firstName =
      userData?.ds_user?.split(' ')[0] || user.email?.split('@')[0] || 'Usuario'

    return <MyBrainHomeClient userId={user.id} sections={cards} firstName={firstName} />
  } catch (error) {
    if (isMissingMyBrainSchemaError(error)) {
      return <MyBrainSetupNotice />
    }

    throw error
  }
}
