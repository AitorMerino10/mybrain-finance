import { buildMyBrainAIPromptContext } from './ai-context'
import { tryParseMyBrainAIModelResponse } from './ai-schema'
import type { MyBrainAISectionContext } from '@/types/mybrain'

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
}

function buildSystemPrompt() {
  return [
    'You are a structured memory extraction assistant for MyBrain.',
    'Your task is to read the user input and propose at most ONE entry per section.',
    'If the user input contains multiple distinct memories, objects, places, people, expenses, recommendations, or observations, split them into separate proposals when matching sections exist.',
    'A single sentence may produce proposals for multiple sections.',
    'Do not treat a detail as context for one section if it is also a first-class item for another provided section.',
    'For example, "Dinner at Belmonde and tried a red wine called Monpelier" should create a restaurant/food proposal and a wine proposal if both sections exist.',
    'For example, "Watched a movie and liked the soundtrack" may create movie and music proposals if both sections exist.',
    'Use at most one proposal per section, but propose for every relevant section supported by the provided context.',
    'Prefer the most specific matching section for each extracted item.',
    'If a section name or keywords directly match a noun in the input, strongly consider creating a proposal for that section.',
    'You may only use the sections and fields provided in the context.',
    'Never invent new sections, new fields, or new IDs.',
    'Do not propose data for another person or another user account.',
    'If there is real ambiguity, return status needs_clarification and add questions.',
    'Return valid JSON only, using this shape:',
    JSON.stringify(
      {
        status: 'ready',
        summary: 'string',
        warnings: ['string'],
        questions: ['string'],
        proposals: [
          {
            sectionId: 'uuid',
            title: 'string',
            eventDate: 'YYYY-MM-DD',
            confidence: 'high',
            warnings: ['string'],
            missingFields: ['string'],
            fieldValues: [
              {
                fieldId: 'uuid',
                value: 'string',
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
    'Use YYYY-MM-DD for dates.',
    'For number fields, use plain numeric text with a dot decimal separator if needed.',
    'For picklist fields, use exactly one of the allowed options.',
    'Titles must be short and specific, usually 2 to 5 words.',
    'Use description, comments, notes, opinion, or similar free-text fields for details and context.',
    'Never make up details that were not stated or safely implied by the user.',
    'You may improve wording so details sound natural and clear, while preserving the original meaning.',
    'Every personal section has a Status picklist field with exactly "Want to" and "Done".',
    'For the Status field, use "Done" when the user describes something already experienced, visited, bought, watched, read, tried, met, or completed.',
    'For the Status field, use "Want to" when the user describes an intention, wish, recommendation, plan, pending item, or something they want to try or do later.',
    'The user may write in any language, especially Spanish and English. Classify Status by meaning, not by exact keywords.',
    'Do not suggest values for fields with aiSupported=false unless the user stated them literally and safely.',
    'Detect the language used by the user in the input text.',
    'Reply in that same language for all natural-language fields in the JSON, especially summary, warnings, questions, titles, and missingFields.',
    'Keep proper nouns, names, places, and product labels exactly as the user said them when appropriate.',
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

export async function requestMyBrainAIProposal(params: {
  inputText: string
  today: string
  sections: MyBrainAISectionContext[]
}) {
  const { apiKey, baseUrl, model } = getOpenAIConfig()
  const promptContext = buildMyBrainAIPromptContext(params.sections)
  const payload = {
    model,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt(),
      },
      {
        role: 'user',
        content: JSON.stringify({
          today: params.today,
          inputText: params.inputText,
          context: promptContext,
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

  const parsed = tryParseMyBrainAIModelResponse(content)
  if (!parsed) {
    throw new Error('La IA devolvió una respuesta inválida')
  }

  return parsed
}
