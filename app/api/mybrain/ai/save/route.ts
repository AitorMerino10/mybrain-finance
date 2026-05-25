import { NextResponse } from 'next/server'
import type { MyBrainAIProposalEntry, MyBrainAISaveRequest } from '@/types/mybrain'
import { createClient } from '@/lib/supabase-server'
import {
  auditMyBrainAIEvent,
  buildMyBrainAIIdempotencyKey,
  enforceMyBrainAIRateLimit,
  getMyBrainAIIdempotentResult,
  storeMyBrainAIIdempotentResult,
} from '@/lib/mybrain/ai-guardrails'
import { confirmMyBrainProposal } from '@/lib/mybrain/ai-placeholders'
import { userHasMyBrainAccess } from '@/lib/mybrain/access'

function isProposalFieldArray(value: unknown) {
  return Array.isArray(value)
}

function parseSaveRequest(body: unknown): MyBrainAISaveRequest | null {
  if (!body || typeof body !== 'object') {
    return null
  }

  const proposals = (body as { proposals?: unknown }).proposals
  if (!isProposalFieldArray(proposals)) {
    return null
  }

  return {
    proposals: proposals as MyBrainAIProposalEntry[],
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

  const rateLimit = enforceMyBrainAIRateLimit('save', user.id, 20, 5 * 60_000)
  if (!rateLimit.ok) {
    return NextResponse.json(
      {
        error: 'Has alcanzado el límite temporal de guardados asistidos por IA.',
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
  const parsed = parseSaveRequest(body)

  if (!parsed || parsed.proposals.length === 0 || parsed.proposals.length > 5) {
    return NextResponse.json(
      { error: 'La propuesta de guardado no es válida' },
      { status: 400 },
    )
  }

  const idempotencyKey = buildMyBrainAIIdempotencyKey(user.id, parsed.proposals)
  const cachedResult = getMyBrainAIIdempotentResult(idempotencyKey)

  if (cachedResult) {
    return NextResponse.json(cachedResult)
  }

  try {
    const result = await confirmMyBrainProposal(supabase, user.id, parsed.proposals)
    storeMyBrainAIIdempotentResult(idempotencyKey, result)

    auditMyBrainAIEvent('proposal-saved', {
      userId: user.id,
      proposalCount: parsed.proposals.length,
      createdCount: result.createdEntries.length,
      sectionIds: result.createdEntries.map((entry) => entry.sectionId),
    })

    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo guardar la propuesta'

    auditMyBrainAIEvent('proposal-save-failed', {
      userId: user.id,
      proposalCount: parsed.proposals.length,
      error: message,
    })

    return NextResponse.json({ error: message }, { status: 400 })
  }
}
