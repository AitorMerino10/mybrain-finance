import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navigation from '@/components/Navigation'
import PlacesPageClient from '@/components/PlacesPageClient'
import { getUserFamilies } from '@/lib/family'
import { isMyBrainFamilyAllowed } from '@/lib/mybrain/access'

export default async function PlacesPage({ searchParams }: { searchParams: { family?: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: userData } = await supabase.from('pml_dim_user').select('ds_user, ds_email').eq('id_user', user.id).single()

  const families = await getUserFamilies(supabase, user.id)
  const selectedFamilyId = searchParams.family || families[0]?.id_family

  if (!selectedFamilyId || !families.find((f) => f.id_family === selectedFamilyId)) {
    redirect('/unauthorized')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation
        idFamily={selectedFamilyId}
        idUser={user.id}
        userData={userData}
        families={families.map((f) => ({ id_family: f.id_family, ds_family: f.ds_family }))}
        currentFamilyId={selectedFamilyId}
        showMyBrainLink={isMyBrainFamilyAllowed(selectedFamilyId)}
      />

      <main className="app-main">
        <div className="pt-4 sm:pt-6 pb-6 lg:pb-8 lg:pt-12">
          <PlacesPageClient idFamily={selectedFamilyId} idUser={user.id} />
        </div>
      </main>
    </div>
  )
}
