import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createTag } from '@/lib/tags'
import { userHasMyBrainAccess } from '@/lib/mybrain/access'
import { auditMyBrainAIEvent, enforceMyBrainAIRateLimit } from '@/lib/mybrain/ai-guardrails'
import { loadMyBrainAIFinanceContext } from '@/lib/mybrain/ai-finance-context'

function normalizeTagName(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, 40)
}

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

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

  if (!isSameOriginRequest(request)) {
    auditMyBrainAIEvent('finance-tag-create-blocked-origin', {
      userId: user.id,
      origin: request.headers.get('origin'),
    })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rateLimit = enforceMyBrainAIRateLimit('finance-tag-create', user.id, 12, 5 * 60_000)
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: 'Has alcanzado el límite temporal de creación de tags.' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil(rateLimit.retryAfterMs / 1000).toString(),
        },
      },
    )
  }

  const body = await request.json().catch(() => null)
  const tagName = normalizeTagName(body?.name)

  if (!tagName) {
    return NextResponse.json({ error: 'El nombre de la tag es obligatorio' }, { status: 400 })
  }

  try {
    const contextResult = await loadMyBrainAIFinanceContext(supabase, user.id)
    if (!contextResult.ok) {
      return NextResponse.json({ error: contextResult.unavailable.reason }, { status: 400 })
    }

    const existing = contextResult.context.tags.find(
      (tag) => tag.name.toLowerCase() === tagName.toLowerCase(),
    )
    if (existing) {
      return NextResponse.json(existing)
    }

    const created = await createTag(supabase, {
      id_family: contextResult.context.familyId,
      ds_tag: tagName,
    })

    auditMyBrainAIEvent('finance-tag-created', {
      userId: user.id,
      tagId: created.id_tag,
      familyId: contextResult.context.familyId,
    })

    return NextResponse.json({
      id: created.id_tag,
      name: created.ds_tag,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear la tag'

    auditMyBrainAIEvent('finance-tag-create-failed', {
      userId: user.id,
      error: message,
    })

    return NextResponse.json({ error: message }, { status: 400 })
  }
}
