'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import type {
  MyBrainAIFinanceProposal,
  MyBrainAIFinanceProposalResponse,
  MyBrainAIFinanceSaveResult,
  MyBrainAIProposalEntry,
  MyBrainAIProposalResponse,
  MyBrainAISaveResult,
  MyBrainSectionCard,
} from '@/types/mybrain'
import { useMyBrainOverlayLock } from './MyBrainOverlayContext'

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: {
    transcript: string
  }
}

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: Event & { error?: string }) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike
}

interface AICaptureComposerProps {
  sections: MyBrainSectionCard[]
  triggerClassName?: string
  triggerLabel?: string
  triggerContent?: React.ReactNode
  initiallyOpen?: boolean
  hideTrigger?: boolean
}

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function normalizeCaptureText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function looksLikeFinanceOnlyCapture(value: string) {
  const normalized = normalizeCaptureText(value)
  const hasExpenseSignal =
    /\b\d+(?:[.,]\d+)?\s*(?:€|eur|euro|euros)\b/.test(normalized) ||
    /\b(?:gasto|gastado|gaste|pague|pago|coste|costo|reembolso|reembolsable)\b/.test(
      normalized,
    )

  if (!hasExpenseSignal) return false

  const hasMemorySignal =
    /\b(?:me gusto|me encanto|recomiendo|opinion|bueno|malo|excelente|duro|suave|llamado|probe|visite|estuve|fui|cene|comi|tome|vino|restaurante|bar|cafe|hotel|pelicula|libro)\b/.test(
      normalized,
    )

  return !hasMemorySignal
}

export default function AICaptureComposer({
  sections,
  triggerClassName,
  triggerLabel = 'Guardar con IA',
  triggerContent,
  initiallyOpen = false,
  hideTrigger = false,
}: AICaptureComposerProps) {
  const router = useRouter()
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const [open, setOpen] = useState(initiallyOpen)
  const [inputText, setInputText] = useState('')
  const [proposal, setProposal] = useState<MyBrainAIProposalResponse | null>(null)
  const [financeProposal, setFinanceProposal] =
    useState<MyBrainAIFinanceProposalResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreatingFinanceTag, setIsCreatingFinanceTag] = useState(false)
  const [newFinanceTagName, setNewFinanceTagName] = useState('')
  const [selectedFinanceDraftIndex, setSelectedFinanceDraftIndex] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [mounted, setMounted] = useState(false)

  const personalSections = useMemo(
    () => sections.filter((section) => !section.isSystemSection),
    [sections],
  )

  const financeDrafts = useMemo(() => {
    if (!financeProposal) return []
    return financeProposal.proposals.length > 0
      ? financeProposal.proposals
      : financeProposal.proposal
        ? [financeProposal.proposal]
        : []
  }, [financeProposal])
  const selectedFinanceDraft =
    financeDrafts[selectedFinanceDraftIndex] || financeDrafts[0] || null

  useMyBrainOverlayLock(open)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognitionConstructor()))
  }, [])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  useEffect(() => {
    if (selectedFinanceDraftIndex >= financeDrafts.length) {
      setSelectedFinanceDraftIndex(0)
    }
  }, [financeDrafts.length, selectedFinanceDraftIndex])

  function handleClose() {
    recognitionRef.current?.stop()
    setIsListening(false)
    setOpen(false)
    setError(null)
    setInfo(null)
    setFinanceProposal(null)
    setSelectedFinanceDraftIndex(0)
  }

  function updateProposal(updater: (current: MyBrainAIProposalEntry[]) => MyBrainAIProposalEntry[]) {
    setProposal((current) => {
      if (!current) return current
      return {
        ...current,
        proposals: updater(current.proposals),
      }
    })
  }

  function updateFinanceProposal(
    updater: (current: MyBrainAIFinanceProposal) => MyBrainAIFinanceProposal,
    proposalIndex = selectedFinanceDraftIndex,
  ) {
    setFinanceProposal((current) => {
      if (!current?.proposal) return current
      const currentProposals =
        current.proposals.length > 0 ? current.proposals : [current.proposal]
      const nextProposals = currentProposals.map((proposal, index) =>
        index === proposalIndex ? updater(proposal) : proposal,
      )
      return {
        ...current,
        proposal: nextProposals[0] || null,
        proposals: nextProposals,
      }
    })
  }

  async function handleCreateFinanceTag(name?: string, proposalIndex = selectedFinanceDraftIndex) {
    const tagName = (name || newFinanceTagName).trim()
    if (!tagName) return

    try {
      setIsCreatingFinanceTag(true)
      setError(null)
      const response = await fetch('/api/mybrain/ai/finance/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: tagName,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo crear la tag')
      }

      const createdTag = data as { id: string; name: string }
      setFinanceProposal((current) => {
        if (!current?.proposal) return current
        const currentProposals =
          current.proposals.length > 0 ? current.proposals : [current.proposal]
        const nextProposals = currentProposals.map((proposal, index) =>
          index === proposalIndex
            ? {
                ...proposal,
                tagId: createdTag.id,
                suggestedNewTagName: null,
              }
            : proposal,
        )
        const existing = current.context.tags.some((tag) => tag.id === createdTag.id)
        return {
          ...current,
          context: {
            ...current.context,
            tags: existing
              ? current.context.tags
              : [...current.context.tags, createdTag].sort((a, b) =>
                  a.name.localeCompare(b.name),
                ),
          },
          proposal: nextProposals[0] || null,
          proposals: nextProposals,
        }
      })
      setNewFinanceTagName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la tag')
    } finally {
      setIsCreatingFinanceTag(false)
    }
  }

  function toggleVoiceInput() {
    if (!speechSupported) {
      setError('Tu navegador no soporta dictado por voz en esta función.')
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const Recognition = getSpeechRecognitionConstructor()
    if (!Recognition) {
      setError('No se ha podido activar el reconocimiento de voz.')
      return
    }

    const recognition = new Recognition()
    recognition.lang = 'es-ES'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim()

      if (transcript) {
        setInputText(transcript)
      }
    }
    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        setError('No se ha podido capturar la voz. Puedes escribir el texto manualmente.')
      }
      setIsListening(false)
    }
    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    setError(null)
    setInfo('Escuchando...')
    setIsListening(true)
    recognition.start()
  }

  async function handlePropose() {
    try {
      setIsProcessing(true)
      setError(null)
      setInfo(null)
      setProposal(null)
      setFinanceProposal(null)
      setSelectedFinanceDraftIndex(0)

      let nextProposal: MyBrainAIProposalResponse | null = null
      let nextFinanceProposal: MyBrainAIFinanceProposalResponse | null = null
      const errors: string[] = []
      const financeOnlyCapture = looksLikeFinanceOnlyCapture(inputText)

      if (personalSections.length > 0 && !financeOnlyCapture) {
        try {
          const response = await fetch('/api/mybrain/ai/propose', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputText,
            }),
          })

          const data = await response.json()

          if (!response.ok) {
            throw new Error(data?.error || 'No se pudo generar la propuesta')
          }

          nextProposal = data as MyBrainAIProposalResponse
          setProposal(nextProposal)
        } catch (err) {
          errors.push(
            err instanceof Error ? err.message : 'No se pudo generar la propuesta',
          )
        }
      }

      try {
        const financeResponse = await fetch('/api/mybrain/ai/finance/propose', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputText,
          }),
        })

        const financeData = await financeResponse.json()

        if (!financeResponse.ok) {
          throw new Error(financeData?.error || 'No se pudo generar el gasto de Finance')
        }

        nextFinanceProposal = financeData as MyBrainAIFinanceProposalResponse
        setFinanceProposal(nextFinanceProposal)
      } catch (err) {
        errors.push(
          err instanceof Error ? err.message : 'No se pudo generar el gasto de Finance',
        )
      }

      const personalCount = nextProposal?.proposals.length || 0
      const financeCount =
        nextFinanceProposal?.proposals.length ||
        (nextFinanceProposal?.proposal ? 1 : 0)

      if (financeOnlyCapture && financeCount > 0) {
        setProposal(null)
        nextProposal = null
      }

      if (personalCount === 0 && financeCount === 0 && errors.length > 0) {
        throw new Error(errors.join(' '))
      }

      setInfo(
        personalCount + financeCount > 0
          ? 'Revisa la propuesta antes de guardar.'
          : 'La IA no ha encontrado una propuesta guardable todavía.',
      )
    } catch (err) {
      setProposal(null)
      setFinanceProposal(null)
      setError(err instanceof Error ? err.message : 'No se pudo generar la propuesta')
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleSave() {
    const personalProposals = proposal?.proposals || []
    const financeDraftsToSave = financeDrafts

    if (personalProposals.length === 0 && financeDraftsToSave.length === 0) {
      return
    }

    try {
      setIsSaving(true)
      setError(null)
      setInfo(null)

      let entryCount = 0
      let transactionCount = 0

      if (personalProposals.length > 0) {
        const response = await fetch('/api/mybrain/ai/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            proposals: personalProposals,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.error || 'No se pudo guardar la propuesta')
        }

        const result = data as MyBrainAISaveResult
        entryCount = result.createdEntries.length
      }

      for (const financeDraft of financeDraftsToSave) {
        const financeResponse = await fetch('/api/mybrain/ai/finance/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            proposal: financeDraft,
          }),
        })

        const financeData = await financeResponse.json()

        if (!financeResponse.ok) {
          throw new Error(financeData?.error || 'No se pudo guardar el gasto de Finance')
        }

        const financeResult = financeData as MyBrainAIFinanceSaveResult
        transactionCount += financeResult.createdTransaction ? 1 : 0
      }

      setInfo(
        [
          entryCount === 1
            ? '1 entrada guardada'
            : entryCount > 1
              ? `${entryCount} entradas guardadas`
              : '',
          transactionCount === 1
            ? '1 gasto de Finance guardado'
            : transactionCount > 1
              ? `${transactionCount} gastos de Finance guardados`
              : '',
        ]
          .filter(Boolean)
          .join(' y ') + '.',
      )
      router.refresh()
      setProposal(null)
      setFinanceProposal(null)
      setInputText('')
      setTimeout(() => {
        setOpen(false)
      }, 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la propuesta')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            triggerClassName ||
            'inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(15,23,42,0.22)] backdrop-blur-sm transition-colors hover:bg-white/15'
          }
        >
          {triggerContent || triggerLabel}
        </button>
      )}

      {open &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[60] bg-slate-950/70 px-4 py-6">
            <div className="flex min-h-full items-center justify-center">
            <div
              className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#F7FAFC] shadow-2xl"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-slate-900 sm:text-xl">
                  Guardar con IA
                </h3>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Cerrar"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                <div>
                  <div className="mb-4 rounded-[24px] border border-slate-200 bg-white px-4 py-5 text-center">
                    <button
                      type="button"
                      onClick={toggleVoiceInput}
                      disabled={!speechSupported}
                      className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full transition-all ${
                        isListening
                          ? 'bg-rose-100 text-rose-700 ring-4 ring-rose-100'
                          : 'bg-slate-900 text-white shadow-lg hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300'
                      }`}
                      aria-label={isListening ? 'Detener dictado' : 'Usar micrófono'}
                    >
                      {isListening ? (
                        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h12v12H6z" />
                        </svg>
                      ) : (
                        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-12 1.5a6 6 0 006 6m0 0v3.75m-3.75 0h7.5M12 15.75a3 3 0 003-3V6a3 3 0 10-6 0v6.75a3 3 0 003 3z" />
                        </svg>
                      )}
                    </button>
                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {isListening ? 'Escuchando...' : 'Dicta o escribe lo que quieres guardar'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Puede ser un recuerdo, una nota o un gasto de Finance.
                    </p>
                  </div>

                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Texto
                  </label>
                  <textarea
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    placeholder="Ej: Gasté 23 euros en cena con Marta en Goiko ayer."
                    className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                  />
                  <div className="mt-3 hidden flex-wrap gap-2 sm:flex">
                    {personalSections.slice(0, 8).map((section) => (
                      <span
                        key={section.id}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                      >
                        {section.name}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={handlePropose}
                      disabled={isProcessing || inputText.trim().length === 0}
                      className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isProcessing ? 'Interpretando...' : 'Proponer registros'}
                    </button>
                  </div>

                  {!speechSupported && (
                    <p className="mt-4 text-xs text-amber-700">
                      El dictado por voz depende del soporte del navegador.
                    </p>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Propuesta</p>
                    {(proposal || financeProposal) && (
                      <button
                        type="button"
                        onClick={() => {
                          setProposal(null)
                          setFinanceProposal(null)
                        }}
                        className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>

                  {proposal || financeProposal ? (
                    <div className="mt-3 space-y-4">
                        {proposal && (
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          {proposal.summary}
                          </div>
                        )}

                        {proposal && proposal.questions.length > 0 && (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            <p className="font-semibold">La IA necesita aclaraciones</p>
                            <ul className="mt-2 list-disc pl-5">
                              {proposal.questions.map((question) => (
                                <li key={question}>{question}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {proposal && proposal.warnings.length > 0 && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            <p className="font-semibold">Avisos</p>
                            <ul className="mt-2 list-disc pl-5">
                              {proposal.warnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {proposal && proposal.proposals.length === 0 && !financeProposal?.proposal ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            Todavía no hay entradas listas para guardar.
                          </div>
                        ) : proposal && proposal.proposals.length > 0 ? (
                          <div className="space-y-4">
                            {proposal.proposals.map((entry, proposalIndex) => (
                              <div
                                key={`${entry.sectionId}-${proposalIndex}`}
                                className="rounded-[24px] border border-slate-200 bg-white p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0d9488]">
                                      {entry.sectionName}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      Confianza: {entry.confidence}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateProposal((current) =>
                                        current.filter((_, index) => index !== proposalIndex),
                                      )
                                    }
                                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                    aria-label={`Quitar propuesta para ${entry.sectionName}`}
                                  >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>

                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                      Título
                                    </label>
                                    <input
                                      value={entry.title}
                                      onChange={(event) =>
                                        updateProposal((current) =>
                                          current.map((currentEntry, index) =>
                                            index === proposalIndex
                                              ? { ...currentEntry, title: event.target.value }
                                              : currentEntry,
                                          ),
                                        )
                                      }
                                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                      Fecha
                                    </label>
                                    <input
                                      type="date"
                                      value={entry.eventDate}
                                      onChange={(event) =>
                                        updateProposal((current) =>
                                          current.map((currentEntry, index) =>
                                            index === proposalIndex
                                              ? { ...currentEntry, eventDate: event.target.value }
                                              : currentEntry,
                                          ),
                                        )
                                      }
                                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                                    />
                                  </div>
                                </div>

                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                  {entry.fields.map((field, fieldIndex) => (
                                    <div key={field.id_field}>
                                      <label className="mb-2 block text-sm font-medium text-slate-700">
                                        {field.fieldName}
                                      </label>
                                      {field.fieldType === 'picklist' ? (
                                        <select
                                          value={field.value}
                                          onChange={(event) =>
                                            updateProposal((current) =>
                                              current.map((currentEntry, entryIndex) =>
                                                entryIndex === proposalIndex
                                                  ? {
                                                      ...currentEntry,
                                                      fields: currentEntry.fields.map((currentField, currentFieldIndex) =>
                                                        currentFieldIndex === fieldIndex
                                                          ? {
                                                              ...currentField,
                                                              value: event.target.value,
                                                            }
                                                          : currentField,
                                                      ),
                                                    }
                                                  : currentEntry,
                                              ),
                                            )
                                          }
                                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                                        >
                                          <option value="">Selecciona una opción</option>
                                          {field.options.map((option) => (
                                            <option key={`${field.id_field}-${option}`} value={option}>
                                              {option}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <input
                                          type={
                                            field.fieldType === 'date'
                                              ? 'date'
                                              : field.fieldType === 'number'
                                                ? 'number'
                                                : field.fieldType === 'url'
                                                  ? 'url'
                                                  : 'text'
                                          }
                                          value={field.value}
                                          onChange={(event) =>
                                            updateProposal((current) =>
                                              current.map((currentEntry, entryIndex) =>
                                                entryIndex === proposalIndex
                                                  ? {
                                                      ...currentEntry,
                                                      fields: currentEntry.fields.map((currentField, currentFieldIndex) =>
                                                        currentFieldIndex === fieldIndex
                                                          ? {
                                                              ...currentField,
                                                              value: event.target.value,
                                                            }
                                                          : currentField,
                                                      ),
                                                    }
                                                  : currentEntry,
                                              ),
                                            )
                                          }
                                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                                        />
                                      )}
                                      {!field.aiSupported && (
                                        <p className="mt-1 text-xs text-slate-500">
                                          Este campo no se rellena automáticamente; puedes editarlo aquí.
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {entry.missingFields.length > 0 && (
                                  <p className="mt-4 text-xs text-amber-700">
                                    Falta contexto en: {entry.missingFields.join(', ')}.
                                  </p>
                                )}

                                {entry.warnings.length > 0 && (
                                  <ul className="mt-4 list-disc pl-5 text-xs text-slate-500">
                                    {entry.warnings.map((warning) => (
                                      <li key={warning}>{warning}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {financeProposal && (
                          <div className="rounded-[24px] border border-emerald-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                  Finance expense
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {financeProposal.summary}
                                </p>
                              </div>
                              {selectedFinanceDraft && (
                                <button
                                  type="button"
                                  onClick={() => setFinanceProposal(null)}
                                  className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                  aria-label="Quitar propuesta de Finance"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>

                            {financeProposal.warnings.length > 0 && (
                              <ul className="mt-4 list-disc pl-5 text-xs text-amber-700">
                                {financeProposal.warnings.map((warning) => (
                                  <li key={warning}>{warning}</li>
                                ))}
                              </ul>
                            )}

                            {financeProposal.questions.length > 0 && (
                              <ul className="mt-4 list-disc pl-5 text-xs text-amber-700">
                                {financeProposal.questions.map((question) => (
                                  <li key={question}>{question}</li>
                                ))}
                              </ul>
                            )}

                            {financeDrafts.length > 1 && (
                              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
                                <p className="font-semibold">
                                  Se han detectado {financeDrafts.length} gastos de Finance.
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {financeDrafts.map((draft, index) => (
                                    <button
                                      key={`${draft.description}-${index}`}
                                      type="button"
                                      onClick={() => setSelectedFinanceDraftIndex(index)}
                                      className={`rounded-full px-3 py-1 text-left text-xs font-semibold transition-colors ${
                                        selectedFinanceDraftIndex === index
                                          ? 'bg-emerald-700 text-white'
                                          : 'bg-white text-emerald-800 hover:bg-emerald-100'
                                      }`}
                                    >
                                      {draft.amount ? `${draft.amount} · ` : ''}
                                      {draft.description}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {selectedFinanceDraft ? (
                              <>
                                <div className="mt-4 grid gap-4 md:grid-cols-3">
                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                      Importe
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={selectedFinanceDraft.amount ?? ''}
                                      onChange={(event) =>
                                        updateFinanceProposal((current) => ({
                                          ...current,
                                          amount: event.target.value
                                            ? Number(event.target.value)
                                            : null,
                                        }))
                                      }
                                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                      Fecha
                                    </label>
                                    <input
                                      type="date"
                                      value={selectedFinanceDraft.date}
                                      onChange={(event) =>
                                        updateFinanceProposal((current) => ({
                                          ...current,
                                          date: event.target.value,
                                        }))
                                      }
                                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                      Mes declarado
                                    </label>
                                    <input
                                      value={selectedFinanceDraft.declaredMonth}
                                      onChange={(event) =>
                                        updateFinanceProposal((current) => ({
                                          ...current,
                                          declaredMonth: event.target.value,
                                        }))
                                      }
                                      placeholder="MM-YYYY"
                                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                                    />
                                  </div>
                                </div>

                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                      Categoría
                                    </label>
                                    <select
                                      value={selectedFinanceDraft.categoryId || ''}
                                      onChange={(event) =>
                                        updateFinanceProposal((current) => ({
                                          ...current,
                                          categoryId: event.target.value || null,
                                          subcategoryId: null,
                                        }))
                                      }
                                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                                    >
                                      <option value="">Selecciona una categoría</option>
                                      {financeProposal.context.categories.map((category) => (
                                        <option key={category.id} value={category.id}>
                                          {category.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                      Subcategoría
                                    </label>
                                    <select
                                      value={selectedFinanceDraft.subcategoryId || ''}
                                      onChange={(event) =>
                                        updateFinanceProposal((current) => ({
                                          ...current,
                                          subcategoryId: event.target.value || null,
                                        }))
                                      }
                                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                                    >
                                      <option value="">Sin subcategoría</option>
                                      {financeProposal.context.categories
                                        .find(
                                          (category) =>
                                            category.id === selectedFinanceDraft.categoryId,
                                        )
                                        ?.subcategories.map((subcategory) => (
                                          <option key={subcategory.id} value={subcategory.id}>
                                            {subcategory.name}
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                </div>

                                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                                    <div>
                                      <label className="mb-2 block text-sm font-medium text-slate-700">
                                        Tag
                                      </label>
                                      <select
                                        value={selectedFinanceDraft.tagId || ''}
                                        onChange={(event) =>
                                          updateFinanceProposal((current) => ({
                                            ...current,
                                            tagId: event.target.value || null,
                                            suggestedNewTagName: event.target.value
                                              ? null
                                              : current.suggestedNewTagName,
                                          }))
                                        }
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                                      >
                                        <option value="">Sin tag</option>
                                        {financeProposal.context.tags.map((tag) => (
                                          <option key={tag.id} value={tag.id}>
                                            {tag.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    {selectedFinanceDraft.suggestedNewTagName && (
                                      <div className="flex items-end">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleCreateFinanceTag(
                                              selectedFinanceDraft.suggestedNewTagName || '',
                                            )
                                          }
                                          disabled={isCreatingFinanceTag}
                                          className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          {isCreatingFinanceTag
                                            ? 'Creando...'
                                            : `Crear "${selectedFinanceDraft.suggestedNewTagName}"`}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                    <input
                                      value={newFinanceTagName}
                                      onChange={(event) => setNewFinanceTagName(event.target.value)}
                                      placeholder="Crear otra tag..."
                                      className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleCreateFinanceTag()}
                                      disabled={isCreatingFinanceTag || !newFinanceTagName.trim()}
                                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {isCreatingFinanceTag ? 'Creando...' : 'Nueva tag'}
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-4">
                                  <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Descripción del gasto
                                  </label>
                                  <textarea
                                    value={selectedFinanceDraft.description}
                                    onChange={(event) =>
                                      updateFinanceProposal((current) => ({
                                        ...current,
                                        description: event.target.value,
                                      }))
                                    }
                                    className="min-h-[92px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
                                  />
                                </div>

                                <div className="mt-4">
                                  <p className="mb-2 text-sm font-medium text-slate-700">
                                    Personas afectadas
                                  </p>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    {financeProposal.context.members.map((member) => {
                                      const selected =
                                        selectedFinanceDraft.affectedUserIds.includes(
                                          member.id,
                                        ) || false

                                      return (
                                        <label
                                          key={member.id}
                                          className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={selected}
                                            onChange={(event) =>
                                              updateFinanceProposal((current) => ({
                                                ...current,
                                                affectedUserIds: event.target.checked
                                                  ? Array.from(
                                                      new Set([
                                                        ...current.affectedUserIds,
                                                        member.id,
                                                      ]),
                                                    )
                                                  : current.affectedUserIds.filter(
                                                      (id) => id !== member.id,
                                                    ),
                                              }))
                                            }
                                            className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                                          />
                                          <span>
                                            {member.name}
                                            {member.id === financeProposal.context.currentUserId
                                              ? ' (tú)'
                                              : ''}
                                          </span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                  {selectedFinanceDraft.amount &&
                                    selectedFinanceDraft.affectedUserIds.length > 0 && (
                                      <p className="mt-2 text-xs text-slate-500">
                                        Split estimado:{' '}
                                        {(
                                          selectedFinanceDraft.amount /
                                          selectedFinanceDraft.affectedUserIds.length
                                        ).toFixed(2)}{' '}
                                        por persona.
                                      </p>
                                    )}
                                </div>

                                {selectedFinanceDraft.missingFields.length > 0 && (
                                  <p className="mt-4 text-xs text-amber-700">
                                    Falta contexto en:{' '}
                                    {selectedFinanceDraft.missingFields.join(', ')}.
                                  </p>
                                )}

                                {selectedFinanceDraft.warnings.length > 0 && (
                                  <ul className="mt-4 list-disc pl-5 text-xs text-slate-500">
                                    {selectedFinanceDraft.warnings.map((warning) => (
                                      <li key={warning}>{warning}</li>
                                    ))}
                                  </ul>
                                )}
                              </>
                            ) : (
                              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                                No hay un gasto de Finance listo para guardar.
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      Escribe o dicta algo y la IA te propondrá qué guardar en tus secciones.
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-200 bg-[#F7FAFC] px-5 py-4 sm:px-6">
                {(error || info) && (
                  <div
                    className={`mb-3 rounded-2xl px-4 py-3 text-sm ${
                      error
                        ? 'border border-rose-200 bg-rose-50 text-rose-700'
                        : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {error || info}
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={
                      isSaving ||
                      ((proposal?.proposals.length || 0) === 0 && financeDrafts.length === 0)
                    }
                    className="rounded-2xl bg-[#90EBD6] px-4 py-2.5 text-sm font-semibold text-[#0f766e] transition-colors hover:bg-[#7DD3C1] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? 'Guardando...' : 'Guardar propuesta'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          </div>,
          document.body,
        )}
    </>
  )
}
