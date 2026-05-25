import type { MyBrainAIConfidence } from '@/types/mybrain'
import {
  serializeFinanceContextForPrompt,
  type MyBrainAIFinanceContext,
} from './ai-finance-context'

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
}

export type RawMyBrainAIFinanceProposal = {
  amount: number | null
  date: string
  declaredMonth: string
  categoryId: string
  subcategoryId: string
  description: string
  affectedUserIds: string[]
  confidence: MyBrainAIConfidence
  warnings: string[]
  missingFields: string[]
}

export type RawMyBrainAIFinanceResponse = {
  status: string
  summary: string
  warnings: string[]
  questions: string[]
  proposal: RawMyBrainAIFinanceProposal | null
}

function buildFinanceSystemPrompt() {
  return [
    'You are a structured expense extraction assistant for MyBrain Finance.',
    'Your task is to read the user input and propose at most ONE expense transaction draft.',
    'Only propose expenses, never income. If the input is not an expense, return proposal=null.',
    'Never invent family, member, category, subcategory, or transaction type IDs.',
    'Use only categoryId and subcategoryId values provided in the context.',
    'If no category is clear, leave categoryId empty and add it to missingFields.',
    'If no subcategory is clear, leave subcategoryId empty; subcategory is optional.',
    'Use YYYY-MM-DD for date and MM-YYYY for declaredMonth.',
    'The declaredMonth should match the expense date unless the user explicitly says a different declared/accounting month.',
    'The description must preserve useful expense context, such as merchant, place, people, and reason.',
    'Affected users: if no family member name is mentioned, use only currentUserId.',
    'If family member names are mentioned as part of a shared expense, include currentUserId and the mentioned member IDs.',
    'If the user says they paid only for someone else, include only that mentioned member if clear; otherwise ask a question.',
    'Return valid JSON only, using this shape:',
    JSON.stringify(
      {
        status: 'ready',
        summary: 'string',
        warnings: ['string'],
        questions: ['string'],
        proposal: {
          amount: 12.34,
          date: 'YYYY-MM-DD',
          declaredMonth: 'MM-YYYY',
          categoryId: 'uuid-or-empty',
          subcategoryId: 'uuid-or-empty',
          description: 'string',
          affectedUserIds: ['uuid'],
          confidence: 'high',
          warnings: ['string'],
          missingFields: ['string'],
        },
      },
      null,
      2,
    ),
    'The user may write in Spanish or English. Reply in the same language for summary, warnings, questions, and description.',
  ].join('\n')
}

function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini'
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no está configurada')
  }

  return {
    apiKey,
    model,
    baseUrl,
  }
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

function asConfidence(value: string): MyBrainAIConfidence {
  return value === 'high' || value === 'medium' || value === 'low'
    ? value
    : 'low'
}

function asAmount(value: unknown) {
  const numberValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(',', '.'))
        : NaN

  return Number.isFinite(numberValue) ? numberValue : null
}

function parseFinanceResponse(input: unknown): RawMyBrainAIFinanceResponse {
  const value = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const rawProposal =
    value.proposal && typeof value.proposal === 'object'
      ? (value.proposal as Record<string, unknown>)
      : null

  return {
    status: asString(value.status) || 'needs_clarification',
    summary: asString(value.summary),
    warnings: asStringArray(value.warnings),
    questions: asStringArray(value.questions),
    proposal: rawProposal
      ? {
          amount: asAmount(rawProposal.amount),
          date: asString(rawProposal.date),
          declaredMonth: asString(rawProposal.declaredMonth),
          categoryId: asString(rawProposal.categoryId),
          subcategoryId: asString(rawProposal.subcategoryId),
          description: asString(rawProposal.description),
          affectedUserIds: asStringArray(rawProposal.affectedUserIds),
          confidence: asConfidence(asString(rawProposal.confidence)),
          warnings: asStringArray(rawProposal.warnings),
          missingFields: asStringArray(rawProposal.missingFields),
        }
      : null,
  }
}

export async function requestMyBrainAIFinanceProposal(params: {
  inputText: string
  today: string
  context: MyBrainAIFinanceContext
}) {
  const { apiKey, baseUrl, model } = getOpenAIConfig()
  const payload = {
    model,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: buildFinanceSystemPrompt(),
      },
      {
        role: 'user',
        content: JSON.stringify({
          today: params.today,
          inputText: params.inputText,
          context: serializeFinanceContextForPrompt(params.context),
        }),
      },
    ],
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`La IA no ha respondido correctamente: ${errorText}`)
  }

  const data = (await response.json()) as ChatCompletionResponse
  const content = data.choices?.[0]?.message?.content?.trim()

  if (!content) {
    throw new Error('La IA no devolvió contenido')
  }

  try {
    return parseFinanceResponse(JSON.parse(content))
  } catch {
    throw new Error('La IA devolvió una respuesta de Finance inválida')
  }
}
