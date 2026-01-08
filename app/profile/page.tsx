import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navigation from '@/components/Navigation'
import AccountPageClient from '@/components/AccountPageClient'
import { getUserFamilies } from '@/lib/family'
import Link from 'next/link'

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { family?: string }
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
    .select('ds_user, ds_email, dt_created, dt_last_login')
    .eq('id_user', user.id)
    .single()

  if (!userData) {
    redirect('/unauthorized')
  }

  // Obtener todas las familias del usuario
  const families = await getUserFamilies(supabase, user.id)
  
  // Determinar qué familia usar (de searchParams o la primera)
  const selectedFamilyId = searchParams.family || families[0]?.id_family

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation
        idFamily={selectedFamilyId || ''}
        idUser={user.id}
        userData={userData}
        families={families.map(f => ({ id_family: f.id_family, ds_family: f.ds_family }))}
        currentFamilyId={selectedFamilyId || ''}
      />
      
      {/* Main Content */}
      <main className="lg:pl-72">
        <div className="pt-4 sm:pt-6 pb-20 lg:pb-8 lg:pt-12 bg-gray-50 min-h-screen">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-4 sm:mb-6 flex items-center gap-3">
              {/* Botón volver en móvil */}
              <Link
                href="/"
                className="lg:hidden text-gray-600 hover:text-gray-900 transition-colors touch-manipulation p-2 -ml-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold italic text-gray-900 mb-1.5">Mi Perfil</h1>
                <p className="text-sm sm:text-base text-gray-500">
                  Gestiona tu información, familia y accesos
                </p>
              </div>
            </div>

            <AccountPageClient
              userId={user.id}
              userData={{
                ds_user: userData.ds_user,
                ds_email: userData.ds_email || '',
                dt_created: userData.dt_created,
                dt_last_login: userData.dt_last_login,
              }}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

