import MyBrainShell from '@/components/mybrain/MyBrainShell'
import { requireMyBrainUser } from '@/lib/mybrain/auth'
import {
  getEntryCountBySection,
  getSectionsForUser,
  mapSectionsToCards,
} from '@/lib/mybrain/sections'

export default async function MyBrainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, userData, supabase } = await requireMyBrainUser()
  const userName =
    userData?.ds_user?.split(' ')[0] || user.email?.split('@')[0] || 'Usuario'
  const [sections, entryCountBySection] = await Promise.all([
    getSectionsForUser(supabase, user.id),
    getEntryCountBySection(supabase, user.id),
  ])
  const sectionCards = mapSectionsToCards(sections, entryCountBySection)

  return (
    <MyBrainShell userId={user.id} userName={userName} sections={sectionCards}>
      {children}
    </MyBrainShell>
  )
}
