import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { userHasMyBrainAccess } from './access'

export async function requireMyBrainUser() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const hasMyBrainAccess = await userHasMyBrainAccess(supabase, user.id)
  if (!hasMyBrainAccess) {
    redirect('/unauthorized')
  }

  const { data: userData } = await supabase
    .from('pml_dim_user')
    .select('ds_user, ds_email')
    .eq('id_user', user.id)
    .maybeSingle()

  return {
    supabase,
    user,
    userData,
  }
}
