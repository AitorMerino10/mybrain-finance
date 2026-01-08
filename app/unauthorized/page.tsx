import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import UnauthorizedPageClient from '@/components/UnauthorizedPageClient'

export default async function UnauthorizedPage() {
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

  return <UnauthorizedPageClient userId={user.id} userEmail={userData?.ds_email || user.email || ''} />
}



