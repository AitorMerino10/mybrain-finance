import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AccountPageClient from '@/components/AccountPageClient'

export default async function AccountPage() {
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

  return <AccountPageClient userId={user.id} userData={userData} />
}


