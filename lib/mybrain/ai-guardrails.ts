import { createHash } from 'crypto'

type RateLimitBucket = {
  count: number
  resetAt: number
}

type IdempotencyRecord = {
  createdAt: number
  result: unknown
}

type MyBrainAIGuardrailState = {
  rateLimits: Map<string, RateLimitBucket>
  idempotency: Map<string, IdempotencyRecord>
}

const stateKey = '__mybrainAiGuardrailState'

function getState(): MyBrainAIGuardrailState {
  const globalState = globalThis as typeof globalThis & {
    [stateKey]?: MyBrainAIGuardrailState
  }

  if (!globalState[stateKey]) {
    globalState[stateKey] = {
      rateLimits: new Map(),
      idempotency: new Map(),
    }
  }

  return globalState[stateKey] as MyBrainAIGuardrailState
}

function cleanupExpiredEntries() {
  const now = Date.now()
  const state = getState()

  for (const [key, value] of Array.from(state.rateLimits.entries())) {
    if (value.resetAt <= now) {
      state.rateLimits.delete(key)
    }
  }

  for (const [key, value] of Array.from(state.idempotency.entries())) {
    if (value.createdAt + 5 * 60_000 <= now) {
      state.idempotency.delete(key)
    }
  }
}

export function enforceMyBrainAIRateLimit(
  routeKey: string,
  userId: string,
  max: number,
  windowMs: number,
) {
  cleanupExpiredEntries()
  const key = `${routeKey}:${userId}`
  const now = Date.now()
  const state = getState()
  const bucket = state.rateLimits.get(key)

  if (!bucket || bucket.resetAt <= now) {
    state.rateLimits.set(key, {
      count: 1,
      resetAt: now + windowMs,
    })
    return { ok: true as const }
  }

  if (bucket.count >= max) {
    return {
      ok: false as const,
      retryAfterMs: Math.max(0, bucket.resetAt - now),
    }
  }

  bucket.count += 1
  state.rateLimits.set(key, bucket)
  return { ok: true as const }
}

export function buildMyBrainAIIdempotencyKey(
  userId: string,
  payload: unknown,
) {
  return createHash('sha256')
    .update(JSON.stringify({ userId, payload }))
    .digest('hex')
}

export function getMyBrainAIIdempotentResult(key: string) {
  cleanupExpiredEntries()
  return getState().idempotency.get(key)?.result
}

export function storeMyBrainAIIdempotentResult(key: string, result: unknown) {
  cleanupExpiredEntries()
  getState().idempotency.set(key, {
    createdAt: Date.now(),
    result,
  })
}

export function auditMyBrainAIEvent(
  event: string,
  payload: Record<string, unknown>,
) {
  console.info(
    `[mybrain-ai] ${event} ${JSON.stringify({
      ...payload,
      timestamp: new Date().toISOString(),
    })}`,
  )
}
