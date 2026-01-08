import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navigation from '@/components/Navigation'
import HomePageClient from '@/components/HomePageClient'
import { getUserFamilies } from '@/lib/family'

export default async function HomePage({
  searchParams,
}: {
  searchParams: { family?: string; action?: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Obtener información del usuario
  const { data: userData } = await supabase
    .from('pml_dim_user')
    .select('ds_user, ds_email')
    .eq('id_user', user.id)
    .single()

  // Obtener todas las familias del usuario
  const families = await getUserFamilies(supabase, user.id)
  
  // Determinar qué familia usar (de searchParams o la primera)
  const selectedFamilyId = searchParams.family || families[0]?.id_family

  if (!selectedFamilyId || !families.find(f => f.id_family === selectedFamilyId)) {
    redirect('/unauthorized')
  }

  // Obtener primer nombre del usuario
  const firstName = userData?.ds_user?.split(' ')[0] || userData?.ds_email?.split('@')[0] || 'Usuario'

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation
        idFamily={selectedFamilyId}
        idUser={user.id}
        userData={userData}
        families={families.map(f => ({ id_family: f.id_family, ds_family: f.ds_family }))}
        currentFamilyId={selectedFamilyId}
      />
      
      {/* Main Content */}
      <main className="lg:pl-72">
        <div className="pt-4 sm:pt-6 pb-20 lg:pb-8 lg:pt-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <HomePageClient
              idFamily={selectedFamilyId}
              idUser={user.id}
              firstName={firstName}
              showNewTransaction={searchParams.action === 'new-transaction'}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
