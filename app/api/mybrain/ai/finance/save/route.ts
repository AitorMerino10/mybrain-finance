import { NextResponse } from 'next/server'
import type {
  MyBrainAIFinanceProposal,
  MyBrainAIFinanceSaveRequest,
} from '@/types/mybrain'
import { createClient } from '@/lib/supabase-server'
import { confirmFinanceExpenseProposal } from '@/lib/mybrain/ai-finance'
import {
  auditMyBrainAIEvent,
  buildMyBrainAIIdempotencyKey,
  enforceMyBrainAIRateLimit,
  getMyBrainAIIdempotentResult,
  storeMyBrainAIIdempotentResult,
} from '@/lib/mybrain/ai-guardrails'
import { userHasMyBrainAccess } from '@/lib/mybrain/access'

function parseSaveRequest(body: unknown): MyBrainAIFinanceSaveRequest | null {
  if (!body || typeof body !== 'object') {
    return null
  }

  const proposal = (body as { proposal?: unknown }).proposal
  if (!proposal || typeof proposal !== 'object') {
    return null
  }

  return {
    proposal: proposal as MyBrainAIFinanceProposal,
  }
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
    auditMyBrainAIEvent('finance-proposal-save-blocked-origin', {
      userId: user.id,
      origin: request.headers.get('origin'),
    })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rateLimit = enforceMyBrainAIRateLimit('finance-save', user.id, 20, 5 * 60_000)
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

  if (!parsed) {
    return NextResponse.json(
      { error: 'La propuesta de gasto no es válida' },
      { status: 400 },
    )
  }

  const idempotencyKey = buildMyBrainAIIdempotencyKey(user.id, {
    route: 'finance-save',
    proposal: parsed.proposal,
  })
  const cachedResult = getMyBrainAIIdempotentResult(idempotencyKey)

  if (cachedResult) {
    return NextResponse.json(cachedResult)
  }

  try {
    const result = await confirmFinanceExpenseProposal(supabase, user.id, parsed.proposal)
    storeMyBrainAIIdempotentResult(idempotencyKey, result)

    auditMyBrainAIEvent('finance-proposal-saved', {
      userId: user.id,
      transactionId: result.createdTransaction.transactionId,
      amount: result.createdTransaction.amount,
      affectedUserCount: result.createdTransaction.affectedUserIds.length,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo guardar el gasto de Finance'

    auditMyBrainAIEvent('finance-proposal-save-failed', {
      userId: user.id,
      error: message,
    })

    return NextResponse.json({ error: message }, { status: 400 })
  }
}
