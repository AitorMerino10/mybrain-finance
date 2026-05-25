import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { auditMyBrainAIEvent, enforceMyBrainAIRateLimit } from '@/lib/mybrain/ai-guardrails'
import { saveMemoryFromText } from '@/lib/mybrain/ai-placeholders'
import { userHasMyBrainAccess } from '@/lib/mybrain/access'

export async function POST(request: Request) {
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

  const rateLimit = enforceMyBrainAIRateLimit('propose', user.id, 12, 5 * 60_000)
  if (!rateLimit.ok) {
    return NextResponse.json(
      {
        error: 'Has alcanzado el límite temporal de peticiones de IA. Inténtalo de nuevo en unos segundos.',
      },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil(rateLimit.retryAfterMs / 1000).toString(),
        },
      },
    )
  }

  const body = await request.json().catch(() => null)
  const inputText = typeof body?.inputText === 'string' ? body.inputText.trim() : ''

  if (!inputText) {
    return NextResponse.json({ error: 'El texto es obligatorio' }, { status: 400 })
  }

  if (inputText.length > 4_000) {
    return NextResponse.json(
      { error: 'El mensaje es demasiado largo para procesarlo con seguridad' },
      { status: 400 },
    )
  }

  try {
    const proposal = await saveMemoryFromText(supabase, user.id, inputText)

    auditMyBrainAIEvent('proposal-created', {
      userId: user.id,
      inputLength: inputText.length,
      proposalCount: proposal.proposals.length,
      warningCount: proposal.warnings.length,
      questionCount: proposal.questions.length,
    })

    return NextResponse.json(proposal)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'No se pudo interpretar el contenido con la IA'

    auditMyBrainAIEvent('proposal-failed', {
      userId: user.id,
      inputLength: inputText.length,
      error: message,
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
