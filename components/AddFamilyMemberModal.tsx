'use client'

import { useState } from 'react'

interface AddFamilyMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onMemberAdded: () => void
  idFamily: string
}

export default function AddFamilyMemberModal({
  isOpen,
  onClose,
  onMemberAdded,
  idFamily,
}: AddFamilyMemberModalProps) {
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!userName.trim() || !userEmail.trim()) {
      setError('El nombre y el email son requeridos')
      return
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(userEmail.trim())) {
      setError('El email no es válido')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Llamar al API route que usa las claves de servicio
      const response = await fetch('/api/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail.trim(),
          name: userName.trim(),
          idFamily: idFamily,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al invitar usuario')
      }

      // Limpiar formulario
      setUserName('')
      setUserEmail('')
      onMemberAdded()
      onClose()
    } catch (err: any) {
      console.error('Error al añadir miembro:', err)
      console.error('Error code:', err?.code)
      console.error('Error message:', err?.message)
      console.error('Error details:', JSON.stringify(err, null, 2))
      
      // Manejar diferentes tipos de errores
      let errorMessage = 'Error al añadir el miembro. Por favor, inténtalo de nuevo.'
      
      if (err?.code === '23505' || err?.message?.includes('duplicate') || err?.message?.includes('unique')) {
        errorMessage = 'Este email ya está registrado en el sistema. El usuario debe iniciar sesión primero con Google.'
      } else if (err?.code === '23503') {
        errorMessage = 'Error de referencia. Verifica que la familia existe.'
      } else if (err?.code === 'PGRST116') {
        errorMessage = 'No se encontró el recurso solicitado.'
      } else if (err?.message) {
        errorMessage = err.message
      } else if (err?.error?.message) {
        errorMessage = err.error.message
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Añadir Nuevo Miembro
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="userName"
              className="block text-sm font-medium text-gray-700"
            >
              Nombre *
            </label>
            <input
              type="text"
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2.5 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 touch-manipulation"
              placeholder="Nombre del miembro"
              disabled={loading}
              autoFocus
              required
            />
          </div>

          <div>
            <label
              htmlFor="userEmail"
              className="block text-sm font-medium text-gray-700"
            >
              Email *
            </label>
            <input
              type="email"
              id="userEmail"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2.5 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 touch-manipulation"
              placeholder="email@ejemplo.com"
              disabled={loading}
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              El usuario podrá iniciar sesión con este email usando Google. Si el email ya existe en el sistema, el usuario será añadido automáticamente a la familia al iniciar sesión.
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !userName.trim() || !userEmail.trim()}
              className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation min-h-[44px]"
            >
              {loading ? 'Añadiendo...' : 'Añadir Miembro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

