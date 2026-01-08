import { createClient } from '@/lib/supabase-server'

export async function SyncUserProfile() {
  const supabaseServer = createClient()
  const {
    data: { user },
  } = await supabaseServer.auth.getUser()

  if (!user) {
    return null
  }

  // Verificar si el usuario existe en pml_dim_user
  const { data: existingUser, error: fetchError } = await supabaseServer
    .from('pml_dim_user')
    .select('id_user')
    .eq('id_user', user.id)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    // Error que no sea "no encontrado"
    console.error('Error al verificar usuario:', fetchError)
    return null
  }

  // Si el usuario no existe, crearlo
  if (!existingUser) {
    const userMetadata = user.user_metadata || {}
    const userName = userMetadata.full_name || userMetadata.name || user.email?.split('@')[0] || 'Usuario'
    const userEmail = user.email || ''

    const { error: insertError } = await supabaseServer
      .from('pml_dim_user')
      .insert({
        id_user: user.id,
        ds_email: userEmail,
        ds_user: userName,
      })

    if (insertError) {
      console.error('Error al crear usuario:', insertError)
    } else {
      console.log('Usuario sincronizado correctamente:', user.id)
    }
  } else {
    // Actualizar dt_last_login si el usuario ya existe
    const { error: updateError } = await supabaseServer
      .from('pml_dim_user')
      .update({
        dt_last_login: new Date().toISOString(),
      })
      .eq('id_user', user.id)

    if (updateError) {
      console.error('Error al actualizar último login:', updateError)
    }
  }

  return null
}

