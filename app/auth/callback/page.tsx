'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import CircularLoader from '@/components/CircularLoader'

export default function AuthCallback() {
  const hasProcessed = useRef(false)

  useEffect(() => {
    const handleCallback = async () => {
      // Evitar ejecuciones duplicadas (React Strict Mode)
      if (hasProcessed.current) {
        console.log('🔵 Callback ya procesado, ignorando...')
        return
      }

      console.log('🔵 Callback page cargada')
      console.log('🔵 Hash completo:', window.location.hash)
      
      // Primero verificar si ya hay una sesión activa (por si se ejecutó dos veces)
      const { data: { session: existingSession } } = await supabase.auth.getSession()
      if (existingSession) {
        console.log('✅ Sesión ya activa encontrada, redirigiendo...')
        hasProcessed.current = true
        setTimeout(() => {
          window.location.href = '/'
        }, 500)
        return
      }
      
      // Extraer parámetros del hash
      const hash = window.location.hash
      if (!hash || hash.length <= 1) {
        console.log('⚠️ No hay hash en la URL, verificando sesión...')
        // Si no hay hash, verificar si hay sesión de nuevo después de un momento
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession()
          if (retrySession) {
            console.log('✅ Sesión encontrada en segundo intento')
            hasProcessed.current = true
            setTimeout(() => {
              window.location.href = '/'
            }, 500)
          } else {
            console.error('❌ No hay hash ni sesión activa')
            hasProcessed.current = true
            setTimeout(() => {
              window.location.href = '/login?error=no_tokens'
            }, 2000)
          }
        }, 1000)
        return
      }
      
      const hashParams = new URLSearchParams(hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const error = hashParams.get('error')
      const errorDescription = hashParams.get('error_description')
      
      console.log('🔵 Access token presente:', !!accessToken)
      console.log('🔵 Refresh token presente:', !!refreshToken)
      console.log('🔵 Error:', error)
      
      if (error) {
        console.error('❌ Error en callback:', error, errorDescription)
        hasProcessed.current = true
        setTimeout(() => {
          window.location.href = `/login?error=${encodeURIComponent(errorDescription || error)}`
        }, 2000)
        return
      }
      
      if (accessToken && refreshToken) {
        hasProcessed.current = true
        console.log('✅ Tokens encontrados, estableciendo sesión...')
        
        // Establecer la sesión usando los tokens
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        
        if (sessionError) {
          console.error('❌ Error al establecer sesión:', sessionError)
          setTimeout(() => {
            window.location.href = `/login?error=${encodeURIComponent(sessionError.message)}`
          }, 2000)
          return
        }
        
        if (data.session && data.user) {
          console.log('✅ Sesión establecida correctamente')
          console.log('✅ Usuario ID:', data.user.id)
          console.log('✅ Email:', data.user.email)
          
          // Crear el usuario en pml_dim_user si no existe
          const userMetadata = data.user.user_metadata || {}
          const userName = userMetadata.full_name || userMetadata.name || data.user.email?.split('@')[0] || 'Usuario'
          const userEmail = data.user.email || ''
          
          console.log('🔄 Creando usuario en pml_dim_user...')
          
          const { error: insertError } = await supabase
            .from('pml_dim_user')
            .insert({
              id_user: data.user.id,
              ds_email: userEmail,
              ds_user: userName,
            })
            .select()
            .single()
          
          if (insertError) {
            // Si el error es que ya existe, está bien
            if (insertError.code !== '23505') { // 23505 es "duplicate key"
              console.error('❌ Error al crear usuario:', insertError)
            } else {
              console.log('✅ Usuario ya existe en pml_dim_user')
            }
          } else {
            console.log('✅ Usuario creado en pml_dim_user')
          }
          
          // Limpiar el hash de la URL
          window.history.replaceState({}, document.title, '/auth/callback')
          
          // Esperar un momento para que las cookies se establezcan
          console.log('🔄 Esperando antes de redirigir...')
          
          // Usar window.location.href para forzar recarga completa y que el middleware lea las cookies
          setTimeout(() => {
            console.log('🔄 Redirigiendo a /dashboard')
            window.location.href = '/'
          }, 1000)
        } else {
          console.error('❌ No se pudo establecer la sesión')
          setTimeout(() => {
            window.location.href = '/login?error=session_failed'
          }, 2000)
        }
      } else {
        console.error('❌ No se encontraron tokens en el hash')
        hasProcessed.current = true
        setTimeout(() => {
          window.location.href = '/login?error=no_tokens'
        }, 2000)
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
      <CircularLoader size="lg" />
    </div>
  )
}

