'use client'

import { useState } from 'react'
import { createFamilyRequest } from '@/lib/admin'
import { supabase } from '@/lib/supabase'

interface RequestedUser {
  email: string
  name?: string
}

interface FamilyRequestFormProps {
  userId: string
  onRequestSubmitted?: () => void
}

export default function FamilyRequestForm({ userId, onRequestSubmitted }: FamilyRequestFormProps) {
  const [requestType, setRequestType] = useState<'create_family' | 'join_family'>('create_family')
  const [familyName, setFamilyName] = useState('')
  const [selectedFamilyId, setSelectedFamilyId] = useState('')
  const [availableFamilies, setAvailableFamilies] = useState<Array<{ id_family: string; ds_family: string | null }>>([])
  const [requestedUsers, setRequestedUsers] = useState<RequestedUser[]>([{ email: '', name: '' }])
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Cargar familias disponibles cuando se selecciona "join_family"
  const loadFamilies = async () => {
    if (requestType === 'join_family') {
      const { data, error } = await supabase
        .from('pml_dim_family')
        .select('id_family, ds_family')
        .order('ds_family')
      
      if (!error && data) {
        setAvailableFamilies(data)
      }
    }
  }

  const handleRequestTypeChange = (type: 'create_family' | 'join_family') => {
    setRequestType(type)
    setError(null)
    if (type === 'join_family') {
      loadFamilies()
    }
  }

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
      if (requestType === 'create_family' && !familyName.trim()) {
        throw new Error('El nombre de la familia es requerido')
      }

      if (requestType === 'join_family' && !selectedFamilyId) {
        throw new Error('Debes seleccionar una familia')
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
          ds_request_type: requestType,
          ds_family_name: requestType === 'create_family' ? familyName.trim() : null,
          id_family: requestType === 'join_family' ? selectedFamilyId : null,
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
        setSelectedFamilyId('')
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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#90EBD6]/20 mb-4">
            <svg className="h-6 w-6 text-[#0d9488]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">¡Petición enviada!</h3>
          <p className="text-sm text-gray-600">
            Tu petición ha sido enviada al administrador. Te notificaremos cuando sea procesada.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
        Solicitar Acceso a Familia
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Tipo de petición */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Tipo de solicitud
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleRequestTypeChange('create_family')}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-colors touch-manipulation min-h-[44px] ${
                requestType === 'create_family'
                  ? 'bg-[#90EBD6] text-[#0d9488]'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Crear Nueva Familia
            </button>
            <button
              type="button"
              onClick={() => handleRequestTypeChange('join_family')}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-colors touch-manipulation min-h-[44px] ${
                requestType === 'join_family'
                  ? 'bg-[#90EBD6] text-[#0d9488]'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Unirse a Familia Existente
            </button>
          </div>
        </div>

        {/* Nombre de familia (solo para create_family) */}
        {requestType === 'create_family' && (
          <div>
            <label htmlFor="familyName" className="block text-sm font-semibold text-gray-700 mb-2">
              Nombre de la familia *
            </label>
            <input
              type="text"
              id="familyName"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#90EBD6] focus:border-[#90EBD6] outline-none text-base"
              placeholder="Ej: Familia García"
              required
            />
          </div>
        )}

        {/* Selección de familia (solo para join_family) */}
        {requestType === 'join_family' && (
          <div>
            <label htmlFor="familySelect" className="block text-sm font-semibold text-gray-700 mb-2">
              Seleccionar familia *
            </label>
            <select
              id="familySelect"
              value={selectedFamilyId}
              onChange={(e) => setSelectedFamilyId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#90EBD6] focus:border-[#90EBD6] outline-none text-base bg-white"
              required
            >
              <option value="">Selecciona una familia</option>
              {availableFamilies.map((family) => (
                <option key={family.id_family} value={family.id_family}>
                  {family.ds_family || 'Sin nombre'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Usuarios a invitar */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Usuarios a invitar *
          </label>
          <div className="space-y-3">
            {requestedUsers.map((user, index) => (
              <div key={index} className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="email"
                    value={user.email}
                    onChange={(e) => updateUserField(index, 'email', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#90EBD6] focus:border-[#90EBD6] outline-none text-base"
                    placeholder="email@ejemplo.com"
                    required
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={user.name || ''}
                    onChange={(e) => updateUserField(index, 'name', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#90EBD6] focus:border-[#90EBD6] outline-none text-base"
                    placeholder="Nombre (opcional)"
                  />
                </div>
                {requestedUsers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeUserField(index)}
                    className="px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
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
              className="w-full px-4 py-3 text-sm font-semibold text-[#0d9488] bg-[#90EBD6]/20 rounded-xl hover:bg-[#90EBD6]/30 transition-colors touch-manipulation min-h-[44px]"
            >
              + Añadir otro usuario
            </button>
          </div>
        </div>

        {/* Comentario */}
        <div>
          <label htmlFor="comment" className="block text-sm font-semibold text-gray-700 mb-2">
            Comentario (opcional)
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#90EBD6] focus:border-[#90EBD6] outline-none text-base resize-none"
            placeholder="Añade cualquier información adicional..."
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 sm:py-4 text-base sm:text-lg font-semibold text-white bg-[#90EBD6] rounded-xl hover:bg-[#90EBD6]/90 active:bg-[#90EBD6]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[44px]"
        >
          {loading ? 'Enviando...' : 'Enviar Petición'}
        </button>
      </form>
    </div>
  )
}

