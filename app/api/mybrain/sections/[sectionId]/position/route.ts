import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { userHasMyBrainAccess } from '@/lib/mybrain/access'

function normalizeCoordinate(value: unknown) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return null
  return Math.max(0, Math.min(100, numberValue))
}

export async function PATCH(
  request: Request,
  { params }: { params: { sectionId: string } },
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await userHasMyBrainAccess(supabase, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const x = normalizeCoordinate(body?.x)
  const y = normalizeCoordinate(body?.y)

  if (x === null || y === null) {
    return NextResponse.json(
      { error: 'Invalid node position' },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from('pml_dim_section')
    .update({
      ft_brain_position_x: x,
      ft_brain_position_y: y,
    })
    .eq('id_section', params.sectionId)
    .eq('id_user', user.id)

  if (error) {
    console.error('Error al guardar la posicion del nodo:', error)
    return NextResponse.json(
      { error: 'Could not save node position' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
