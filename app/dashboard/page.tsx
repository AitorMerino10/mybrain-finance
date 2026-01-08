import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import DashboardActions from '@/components/DashboardActions'

export default async function DashboardPage() {
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

  // Obtener la familia del usuario
  const { data: userFamily } = await supabase
    .from('pml_rel_user_family')
    .select('id_family')
    .eq('id_user', user.id)
    .single()

  if (!userFamily) {
    redirect('/unauthorized')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 sm:mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Dashboard
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-600">
              Bienvenido, {userData?.ds_user || userData?.ds_email || 'Usuario'}
            </p>
          </div>
          <a
            href="/account"
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 active:bg-gray-300 touch-manipulation min-h-[44px] flex items-center"
          >
            Mi Cuenta
          </a>
        </div>

        <div className="mb-4 sm:mb-6">
          <DashboardActions
            idFamily={userFamily.id_family}
            idUser={user.id}
          />
        </div>
      </div>
    </div>
  )
}


