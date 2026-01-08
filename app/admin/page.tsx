import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navigation from '@/components/Navigation'
import AdminPageClient from '@/components/AdminPageClient'
import { getUserFamilies } from '@/lib/family'
import { isAppAdmin, getAllFamilyRequests, getAllFamiliesWithMembers, getAllUsers } from '@/lib/admin'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

async function enrichRequestsWithAuthEmails(
  requests: Awaited<ReturnType<typeof getAllFamilyRequests>>,
  supabaseUrl: string,
  serviceRoleKey: string
) {
  // Obtener IDs de usuarios que no tienen email completo
  const userIdsToEnrich = requests
    .filter(r => r.user && r.user.ds_email.startsWith('Usuario '))
    .map(r => r.id_user)

  if (userIdsToEnrich.length === 0) {
    return requests
  }

  // Crear cliente admin para obtener emails
  const supabaseAdmin = createAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers()
    const usersMap = new Map(
      (usersData?.users || []).map(u => [u.id, { email: u.email || '', name: u.user_metadata?.full_name }])
    )

    // Enriquecer requests con emails reales
    return requests.map(req => {
      if (req.user && req.user.ds_email.startsWith('Usuario ')) {
        const authUser = usersMap.get(req.id_user)
        if (authUser) {
          return {
            ...req,
            user: {
              ...req.user,
              ds_email: authUser.email,
              ds_user: authUser.name || req.user.ds_user,
            },
          }
        }
      }
      return req
    })
  } catch (error) {
    console.error('Error al enriquecer requests con emails:', error)
    return requests
  }
}

export default async function AdminPage({
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
    .select('ds_user, ds_email')
    .eq('id_user', user.id)
    .single()

  // Verificar si es admin
  if (!isAppAdmin(user.id, userData?.ds_email || null)) {
    redirect('/unauthorized')
  }

  // Obtener todas las familias del usuario (aunque no las necesite para admin)
  const families = await getUserFamilies(supabase, user.id)
  const selectedFamilyId = searchParams.family || families[0]?.id_family || ''

  // Obtener datos iniciales del servidor
  const [familiesData, pendingRequests, allRequests, usersData] = await Promise.all([
    getAllFamiliesWithMembers(supabase),
    getAllFamilyRequests(supabase, 'pending'),
    getAllFamilyRequests(supabase),
    getAllUsers(supabase),
  ])

  // Enriquecer requests con emails desde auth.users si tenemos service role
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  let enrichedPendingRequests = pendingRequests
  let enrichedAllRequests = allRequests

  if (serviceRoleKey && supabaseUrl) {
    enrichedPendingRequests = await enrichRequestsWithAuthEmails(
      pendingRequests,
      supabaseUrl,
      serviceRoleKey
    )
    enrichedAllRequests = await enrichRequestsWithAuthEmails(
      allRequests,
      supabaseUrl,
      serviceRoleKey
    )
  }

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
            <AdminPageClient
              initialFamilies={familiesData}
              initialPendingRequests={enrichedPendingRequests}
              initialAllRequests={enrichedAllRequests}
              initialUsers={usersData}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

