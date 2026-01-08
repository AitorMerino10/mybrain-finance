import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const pathname = request.nextUrl.pathname
  
  // Logging para debugging
  console.log('🔵 Middleware ejecutado para:', pathname)
  const cookieNames = request.cookies.getAll().map(c => c.name)
  console.log('🔵 Cookies disponibles:', cookieNames)

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  console.log('🔵 Usuario encontrado:', !!user)
  console.log('🔵 Error al obtener usuario:', userError?.message)

  // Excluir el callback de autenticación - debe procesarse sin interferencia
  if (pathname.startsWith('/auth/callback')) {
    return response
  }

  // Proteger la ruta /dashboard
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      console.log('❌ Usuario no autenticado, redirigiendo a login')
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    console.log('✅ Usuario autenticado:', user.id)

    // Verificar si el usuario tiene una familia asociada
    const { data: userFamily, error } = await supabase
      .from('pml_rel_user_family')
      .select('id_family')
      .eq('id_user', user.id)
      .limit(1)
      .maybeSingle()

    console.log('🔵 Familia encontrada:', !!userFamily)
    console.log('🔵 Error al buscar familia:', error?.message)

    // Si hay error (que no sea "no encontrado") o no hay familia, redirigir
    if ((error && error.code !== 'PGRST116') || !userFamily) {
      console.log('⚠️ Usuario sin familia, redirigiendo a unauthorized')
      const url = request.nextUrl.clone()
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }
  }

  // Si el usuario está autenticado y va a /login, redirigir a dashboard
  if (pathname === '/login' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

