'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getAllFamilyRequests,
  getAllFamiliesWithMembers,
  getAllUsers,
  approveCreateFamilyRequest,
  approveJoinFamilyRequest,
  rejectFamilyRequest,
  type FamilyRequest,
} from '@/lib/admin'
import { formatDate } from '@/lib/format'
import Link from 'next/link'

type ActiveTab = 'families' | 'users' | 'pending' | 'history'

interface AdminPageClientProps {
  initialFamilies?: Array<{
    id_family: string
    ds_family: string | null
    dt_created: string | null
    members: Array<{
      id_user: string
      ds_user: string | null
      ds_email: string
      dt_inclusion: string | null
    }>
  }>
  initialPendingRequests?: FamilyRequest[]
  initialAllRequests?: FamilyRequest[]
  initialUsers?: Array<{
    id_user: string
    ds_user: string | null
    ds_email: string
    dt_created: string | null
    dt_last_login: string | null
    families: Array<{ id_family: string; ds_family: string | null }>
  }>
}

export default function AdminPageClient({
  initialFamilies = [],
  initialPendingRequests = [],
  initialAllRequests = [],
  initialUsers = [],
}: AdminPageClientProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('families')
  const [loading, setLoading] = useState(false)
  const [families, setFamilies] = useState(initialFamilies)
  const [pendingRequests, setPendingRequests] = useState(initialPendingRequests)
  const [allRequests, setAllRequests] = useState(initialAllRequests)
  const [processingRequest, setProcessingRequest] = useState<string | null>(null)
  const [users, setUsers] = useState(initialUsers)

  const loadData = async () => {
    setLoading(true)
    try {
      const [familiesData, pendingData, allData, usersData] = await Promise.all([
        getAllFamiliesWithMembers(supabase),
        getAllFamilyRequests(supabase, 'pending'),
        getAllFamilyRequests(supabase),
        getAllUsers(supabase),
      ])
      setFamilies(familiesData)
      setPendingRequests(pendingData)
      setAllRequests(allData)
      setUsers(usersData)
    } catch (error) {
      console.error('Error al cargar datos:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleApprove = async (request: FamilyRequest) => {
    if (processingRequest) return
    
    setProcessingRequest(request.id_request)
    try {
      if (request.ds_request_type === 'create_family') {
        await approveCreateFamilyRequest(request.id_request)
      } else {
        await approveJoinFamilyRequest(request.id_request)
      }
      await loadData()
    } catch (error) {
      console.error('Error al aprobar petición:', error)
      alert(error instanceof Error ? error.message : 'Error al aprobar petición')
    } finally {
      setProcessingRequest(null)
    }
  }

  const handleReject = async (request: FamilyRequest) => {
    if (processingRequest) return
    
    if (!confirm('¿Estás seguro de rechazar esta petición?')) {
      return
    }

    setProcessingRequest(request.id_request)
    try {
      await rejectFamilyRequest(request.id_request)
      await loadData()
    } catch (error) {
      console.error('Error al rechazar petición:', error)
      alert(error instanceof Error ? error.message : 'Error al rechazar petición')
    } finally {
      setProcessingRequest(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#90EBD6] border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <Link
          href="/"
          className="lg:hidden text-gray-600 hover:text-gray-900 transition-colors touch-manipulation p-2 -ml-2 inline-block mb-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold italic text-gray-900 mb-1.5">Panel de Administración</h1>
          <p className="text-sm sm:text-base text-gray-500">
            Gestiona familias, usuarios y peticiones
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 sm:gap-3 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('families')}
          className={`px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'families'
              ? 'border-[#90EBD6] text-[#0d9488]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Familias ({families.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'users'
              ? 'border-[#90EBD6] text-[#0d9488]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Usuarios ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'pending'
              ? 'border-[#90EBD6] text-[#0d9488]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Peticiones Pendientes ({pendingRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-[#90EBD6] text-[#0d9488]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Historial
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4 sm:space-y-6">
        {activeTab === 'families' && (
          <FamiliesSection families={families} users={users} onRefresh={loadData} />
        )}

        {activeTab === 'users' && (
          <UsersSection users={users} families={families} onRefresh={loadData} />
        )}

        {activeTab === 'pending' && (
          <PendingRequestsSection
            requests={pendingRequests}
            onApprove={handleApprove}
            onReject={handleReject}
            processingRequest={processingRequest}
          />
        )}

        {activeTab === 'history' && (
          <HistorySection requests={allRequests.filter(r => r.ds_status !== 'pending')} />
        )}
      </div>
    </div>
  )
}

// Sección de Familias
function FamiliesSection({
  families,
  users,
  onRefresh,
}: {
  families: Array<{
    id_family: string
    ds_family: string | null
    dt_created: string | null
    members: Array<{
      id_user: string
      ds_user: string | null
      ds_email: string
      dt_inclusion: string | null
    }>
  }>
  users: Array<{
    id_user: string
    ds_user: string | null
    ds_email: string
    families: Array<{ id_family: string; ds_family: string | null }>
  }>
  onRefresh: () => void
}) {
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const handleAddUser = async (idFamily: string, userId: string) => {
    if (processing) return
    setProcessing(true)
    try {
      const response = await fetch('/api/admin/manage-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_to_family',
          userId,
          idFamily,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Error al añadir usuario')
      }
      await onRefresh()
      setSelectedFamily(null)
      setSelectedUserId(null)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al añadir usuario')
    } finally {
      setProcessing(false)
    }
  }

  const handleRemoveUser = async (idFamily: string, userId: string) => {
    if (processing) return
    if (!confirm('¿Estás seguro de quitar este usuario de la familia?')) {
      return
    }
    setProcessing(true)
    try {
      const response = await fetch('/api/admin/manage-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_from_family',
          userId,
          idFamily,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Error al quitar usuario')
      }
      await onRefresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al quitar usuario')
    } finally {
      setProcessing(false)
    }
  }
  if (families.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
        <p className="text-gray-500">No hay familias registradas</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {families.map((family) => (
        <div
          key={family.id_family}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                {family.ds_family || 'Sin nombre'}
              </h3>
              {family.dt_created && (
                <p className="text-xs sm:text-sm text-gray-500">
                  Creada: {formatDate(family.dt_created, 'long')}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 text-xs sm:text-sm font-medium text-[#0d9488] bg-[#90EBD6]/20 rounded-full">
                {family.members.length} {family.members.length === 1 ? 'miembro' : 'miembros'}
              </span>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">Miembros:</h4>
              <button
                onClick={() => {
                  setSelectedFamily(family.id_family)
                  setSelectedUserId(null)
                }}
                className="px-3 py-1.5 text-xs font-semibold text-[#0d9488] bg-[#90EBD6]/20 rounded-lg hover:bg-[#90EBD6]/30 transition-colors touch-manipulation"
              >
                + Añadir Usuario
              </button>
            </div>
            <div className="space-y-2">
              {family.members.map((member) => (
                <div
                  key={member.id_user}
                  className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {member.ds_user || 'Sin nombre'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{member.ds_email}</p>
                    {member.dt_inclusion && (
                      <p className="text-xs text-gray-400 mt-1">
                        Añadido: {formatDate(member.dt_inclusion, 'short')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveUser(family.id_family, member.id_user)}
                    disabled={processing}
                    className="ml-2 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            {selectedFamily === family.id_family && (
              <div className="mt-4 p-4 bg-[#90EBD6]/10 rounded-lg border border-[#90EBD6]/20">
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Seleccionar usuario:</h5>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {users
                    .filter(u => !family.members.some(m => m.id_user === u.id_user))
                    .map((user) => (
                      <button
                        key={user.id_user}
                        onClick={() => handleAddUser(family.id_family, user.id_user)}
                        disabled={processing}
                        className="w-full text-left px-3 py-2 text-sm bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors touch-manipulation"
                      >
                        <p className="font-medium text-gray-900">{user.ds_user || 'Sin nombre'}</p>
                        <p className="text-xs text-gray-500">{user.ds_email}</p>
                      </button>
                    ))}
                  {users.filter(u => !family.members.some(m => m.id_user === u.id_user)).length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-2">No hay usuarios disponibles</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedFamily(null)
                    setSelectedUserId(null)
                  }}
                  className="mt-2 w-full px-3 py-2 text-xs font-semibold text-gray-600 bg-white rounded-lg hover:bg-gray-50 transition-colors touch-manipulation"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// Sección de Peticiones Pendientes
function PendingRequestsSection({
  requests,
  onApprove,
  onReject,
  processingRequest,
}: {
  requests: FamilyRequest[]
  onApprove: (request: FamilyRequest) => void
  onReject: (request: FamilyRequest) => void
  processingRequest: string | null
}) {
  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
        <p className="text-gray-500">No hay peticiones pendientes</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {requests.map((request) => (
        <div
          key={request.id_request}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-full ${
                  request.ds_request_type === 'create_family'
                    ? 'bg-[#C7CEEA] text-[#4C63D2]'
                    : 'bg-[#FFD3B6] text-[#D97706]'
                }`}>
                  {request.ds_request_type === 'create_family' ? 'Crear Familia' : 'Unirse a Familia'}
                </span>
                <span className="text-xs sm:text-sm text-gray-500">
                  {formatDate(request.dt_created, 'long')}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                {request.user?.ds_user || request.user?.ds_email || 'Usuario desconocido'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mb-2">
                {request.user?.ds_email}
              </p>
              {request.ds_request_type === 'create_family' && request.ds_family_name && (
                <p className="text-sm sm:text-base text-gray-700 mb-2">
                  <span className="font-semibold">Nombre de familia:</span> {request.ds_family_name}
                </p>
              )}
              {request.ds_request_type === 'join_family' && request.family && (
                <p className="text-sm sm:text-base text-gray-700 mb-2">
                  <span className="font-semibold">Familia:</span> {request.family.ds_family || 'Sin nombre'}
                </p>
              )}
              {request.ds_comment && (
                <div className="mt-2 p-2 sm:p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-600">
                    <span className="font-semibold">Comentario:</span> {request.ds_comment}
                  </p>
                </div>
              )}
            </div>
          </div>

          {request.ds_request_type === 'create_family' && request.js_requested_users.length > 0 && (
            <div className="mb-4 p-3 sm:p-4 bg-[#90EBD6]/10 rounded-lg border border-[#90EBD6]/20">
              <p className="text-xs sm:text-sm font-semibold text-[#0d9488] mb-2">
                Usuarios a invitar:
              </p>
              <div className="space-y-1">
                {request.js_requested_users.map((user, idx) => (
                  <p key={idx} className="text-xs sm:text-sm text-gray-700">
                    • {user.email} {user.name && `(${user.name})`}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => onApprove(request)}
              disabled={processingRequest === request.id_request}
              className="flex-1 px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold text-white bg-[#90EBD6] rounded-xl hover:bg-[#90EBD6]/90 active:bg-[#90EBD6]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
            >
              {processingRequest === request.id_request ? 'Procesando...' : 'Aprobar'}
            </button>
            <button
              onClick={() => onReject(request)}
              disabled={processingRequest === request.id_request}
              className="flex-1 px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold text-white bg-[#FFB3BA] rounded-xl hover:bg-[#FFB3BA]/90 active:bg-[#FFB3BA]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
            >
              Rechazar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// Sección de Historial
function HistorySection({ requests }: { requests: FamilyRequest[] }) {
  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
        <p className="text-gray-500">No hay peticiones en el historial</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {requests.map((request) => (
        <div
          key={request.id_request}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-full ${
                  request.ds_request_type === 'create_family'
                    ? 'bg-[#C7CEEA] text-[#4C63D2]'
                    : 'bg-[#FFD3B6] text-[#D97706]'
                }`}>
                  {request.ds_request_type === 'create_family' ? 'Crear Familia' : 'Unirse a Familia'}
                </span>
                <span className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-full ${
                  request.ds_status === 'approved'
                    ? 'bg-[#90EBD6]/20 text-[#0d9488]'
                    : 'bg-[#FFB3BA]/20 text-[#DC2626]'
                }`}>
                  {request.ds_status === 'approved' ? 'Aprobada' : 'Rechazada'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">
                {request.user?.ds_user || request.user?.ds_email || 'Usuario desconocido'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mb-2">
                {request.user?.ds_email}
              </p>
              {request.ds_request_type === 'create_family' && request.ds_family_name && (
                <p className="text-sm sm:text-base text-gray-700 mb-1">
                  <span className="font-semibold">Familia:</span> {request.ds_family_name}
                </p>
              )}
              {request.ds_request_type === 'join_family' && request.family && (
                <p className="text-sm sm:text-base text-gray-700 mb-1">
                  <span className="font-semibold">Familia:</span> {request.family.ds_family || 'Sin nombre'}
                </p>
              )}
              <p className="text-xs sm:text-sm text-gray-500 mt-2">
                {formatDate(request.dt_created, 'long')}
                {request.dt_updated !== request.dt_created && (
                  <span className="ml-2">
                    • Procesada: {formatDate(request.dt_updated, 'long')}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Sección de Usuarios
function UsersSection({
  users,
  families,
  onRefresh,
}: {
  users: Array<{
    id_user: string
    ds_user: string | null
    ds_email: string
    dt_created: string | null
    dt_last_login: string | null
    families: Array<{ id_family: string; ds_family: string | null }>
  }>
  families: Array<{ id_family: string; ds_family: string | null }>
  onRefresh: () => void
}) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (creating) return
    setCreating(true)
    try {
      const response = await fetch('/api/admin/manage-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          email: newUserEmail.trim(),
          name: newUserName.trim() || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Error al crear usuario')
      }
      setNewUserEmail('')
      setNewUserName('')
      setShowCreateModal(false)
      await onRefresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al crear usuario')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (deleting) return
    if (!confirm('¿Estás seguro de borrar este usuario? Esta acción no se puede deshacer.')) {
      return
    }
    setDeleting(userId)
    try {
      const response = await fetch('/api/admin/manage-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          userId,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Error al borrar usuario')
      }
      await onRefresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al borrar usuario')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Usuarios del Sistema</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm font-semibold text-white bg-[#90EBD6] rounded-xl hover:bg-[#90EBD6]/90 active:bg-[#90EBD6]/80 transition-colors touch-manipulation min-h-[44px]"
        >
          + Crear Usuario
        </button>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Crear Nuevo Usuario</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#90EBD6] focus:border-[#90EBD6] outline-none text-base"
                  placeholder="usuario@ejemplo.com"
                />
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre (opcional)
                </label>
                <input
                  type="text"
                  id="name"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#90EBD6] focus:border-[#90EBD6] outline-none text-base"
                  placeholder="Nombre del usuario"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-3 text-base font-semibold text-white bg-[#90EBD6] rounded-xl hover:bg-[#90EBD6]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[44px]"
                >
                  {creating ? 'Creando...' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewUserEmail('')
                    setNewUserName('')
                  }}
                  className="flex-1 px-4 py-3 text-base font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors touch-manipulation min-h-[44px]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {users.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center">
          <p className="text-gray-500">No hay usuarios registrados</p>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {users.map((user) => (
            <div
              key={user.id_user}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
                <div className="flex-1">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                    {user.ds_user || 'Sin nombre'}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">{user.ds_email}</p>
                  {user.dt_created && (
                    <p className="text-xs text-gray-500">
                      Creado: {formatDate(user.dt_created, 'long')}
                    </p>
                  )}
                  {user.dt_last_login && (
                    <p className="text-xs text-gray-500">
                      Último acceso: {formatDate(user.dt_last_login, 'long')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteUser(user.id_user)}
                  disabled={deleting === user.id_user}
                  className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[44px]"
                >
                  {deleting === user.id_user ? 'Borrando...' : 'Borrar Usuario'}
                </button>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Familias ({user.families.length}):
                </h4>
                {user.families.length === 0 ? (
                  <p className="text-sm text-gray-500">No pertenece a ninguna familia</p>
                ) : (
                  <div className="space-y-2">
                    {user.families.map((family) => (
                      <div
                        key={family.id_family}
                        className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg"
                      >
                        <p className="text-sm font-medium text-gray-900">
                          {family.ds_family || 'Sin nombre'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

