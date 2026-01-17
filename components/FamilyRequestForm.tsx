'use client'

import { useState } from 'react'

interface RequestedUser {
  email: string
  name?: string
}

interface FamilyRequestFormProps {
  userId: string
  onRequestSubmitted?: () => void
}

export default function FamilyRequestForm({ userId, onRequestSubmitted }: FamilyRequestFormProps) {
  const [familyName, setFamilyName] = useState('')
  const [requestedUsers, setRequestedUsers] = useState<RequestedUser[]>([{ email: '', name: '' }])
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const addUserField = () => {
    setRequestedUsers([...requestedUsers, { email: '', name: '' }])
  }

  const removeUserField = (index: number) => {
    if (requestedUsers.length > 1) {
      setRequestedUsers(requestedUsers.filter((_, i) => i !== index))
    }
  }

  const updateUserField = (index: number, field: 'email' | 'name', value: string) => {
    const updated = [...requestedUsers]
    updated[index] = { ...updated[index], [field]: value }
    setRequestedUsers(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Validar
      if (!familyName.trim()) {
        throw new Error('El nombre de la familia es requerido')
      }

      // Filtrar usuarios válidos
      const validUsers = requestedUsers
        .map(u => ({
          email: u.email.trim().toLowerCase(),
          name: u.name?.trim() || undefined,
        }))
        .filter(u => u.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email))

      if (validUsers.length === 0) {
        throw new Error('Debes añadir al menos un usuario con email válido')
      }

      // Crear petición
      const response = await fetch('/api/family-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ds_request_type: 'create_family',
          ds_family_name: familyName.trim(),
          id_family: null,
          js_requested_users: validUsers,
          ds_comment: comment.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar la petición')
      }

      setSuccess(true)
      if (onRequestSubmitted) {
        onRequestSubmitted()
      }

      // Reset form
      setTimeout(() => {
        setFamilyName('')
        setRequestedUsers([{ email: '', name: '' }])
        setComment('')
        setSuccess(false)
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar la petición')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 p-6 sm:p-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#90EBD6]/20 border border-[#90EBD6]/30 mb-4">
            <svg className="h-6 w-6 text-[#90EBD6]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mb-2">¡Petición enviada!</h3>
          <p className="text-sm text-slate-300">
            Tu petición ha sido enviada al administrador. Lo verás en tu aplicación cuando sea procesada.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-4 sm:mb-6">
        Crear Nueva Familia
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Nombre de familia */}
        <div>
          <label htmlFor="familyName" className="block text-sm font-semibold text-slate-200 mb-2">
            Nombre de la familia *
          </label>
          <input
            type="text"
            id="familyName"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl focus:ring-2 focus:ring-[#90EBD6]/50 focus:border-[#90EBD6] outline-none text-base text-slate-100 placeholder:text-slate-500 transition-all"
            placeholder="Ej: Familia García"
            required
          />
        </div>

        {/* Usuarios a invitar */}
        <div>
          <label className="block text-sm font-semibold text-slate-200 mb-2">
            Usuarios a invitar *
          </label>
          <p className="text-xs text-slate-400 mb-3">
            Añade los emails de las personas que quieres invitar a tu familia. Puedes añadir sus nombres si lo deseas.
          </p>
          <div className="space-y-3">
            {requestedUsers.map((user, index) => (
              <div key={index} className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="email"
                    value={user.email}
                    onChange={(e) => updateUserField(index, 'email', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl focus:ring-2 focus:ring-[#90EBD6]/50 focus:border-[#90EBD6] outline-none text-base text-slate-100 placeholder:text-slate-500 transition-all"
                    placeholder="email@ejemplo.com"
                    required
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={user.name || ''}
                    onChange={(e) => updateUserField(index, 'name', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl focus:ring-2 focus:ring-[#90EBD6]/50 focus:border-[#90EBD6] outline-none text-base text-slate-100 placeholder:text-slate-500 transition-all"
                    placeholder="Nombre (opcional)"
                  />
                </div>
                {requestedUsers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeUserField(index)}
                    className="px-4 py-3 text-red-400 hover:bg-slate-700 rounded-xl transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addUserField}
              className="w-full px-4 py-3 text-sm font-semibold text-[#90EBD6] bg-[#90EBD6]/10 border border-[#90EBD6]/30 rounded-xl hover:bg-[#90EBD6]/20 transition-colors touch-manipulation min-h-[44px]"
            >
              + Añadir otro usuario
            </button>
          </div>
        </div>

        {/* Comentario */}
        <div>
          <label htmlFor="comment" className="block text-sm font-semibold text-slate-200 mb-2">
            Comentario (opcional)
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl focus:ring-2 focus:ring-[#90EBD6]/50 focus:border-[#90EBD6] outline-none text-base text-slate-100 placeholder:text-slate-500 resize-none transition-all"
            placeholder="Añade cualquier información adicional..."
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-700 rounded-xl">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 sm:py-4 text-base sm:text-lg font-semibold text-[#0d9488] bg-[#90EBD6] rounded-xl hover:bg-[#90EBD6]/90 active:bg-[#90EBD6]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all touch-manipulation min-h-[44px] shadow-lg"
        >
          {loading ? 'Enviando...' : 'Enviar Petición'}
        </button>
      </form>
    </div>
  )
}

