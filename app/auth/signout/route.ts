import { createClient } from '@/lib/supabase-route-handler'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url))
  const supabase = createClient(request, response)
  await supabase.auth.signOut()
  return response
}


