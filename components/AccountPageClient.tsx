'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getFamilyMembers,
  getUserFamilies,
  isUserFamilyAdmin,
  type FamilyMember,
  type UserFamily,
} from '@/lib/family'
import {
  getPendingRequestsForFamily,
  approveJoinFamilyRequest,
  rejectFamilyRequest,
  type FamilyRequest,
} from '@/lib/admin'
import {
  getAllCategoriesByFamily,
  getSubcategoriesByCategory,
  type Category,
  type Subcategory,
} from '@/lib/categories'
import AddFamilyMemberModal from './AddFamilyMemberModal'
import CategoryManager from './CategoryManager'

interface AccountPageClientProps {
  userId: string
  userData: {
    ds_user: string | null
    ds_email: string
    dt_created: string | null
    dt_last_login: string | null
  }
}

export default function AccountPageClient({
  userId,
  userData,
}: AccountPageClientProps) {
  const [activeTab, setActiveTab] = useState<
    'account' | 'family' | 'other-families' | 'categories'
  >('account')
  const [currentFamily, setCurrentFamily] = useState<{
    id_family: string
    ds_family: string
  } | null>(null)
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [otherFamilies, setOtherFamilies] = useState<UserFamily[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<FamilyRequest[]>([])
  const [processingRequest, setProcessingRequest] = useState<string | null>(null)

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // Obtener la familia actual del usuario
        const { data: userFamily } = await supabase
          .from('pml_rel_user_family')
          .select('id_family, pml_dim_family!inner(id_family, ds_family)')
          .eq('id_user', userId)
          .limit(1)
          .maybeSingle()

        if (userFamily) {
          const family = (userFamily as any).pml_dim_family
          setCurrentFamily({
            id_family: family.id_family,
            ds_family: family.ds_family,
          })

          // Verificar si es admin
          const adminStatus = await isUserFamilyAdmin(
            supabase,
            userId,
            family.id_family
          )
          setIsAdmin(adminStatus)

          // Cargar miembros de la familia
          const members = await getFamilyMembers(supabase, family.id_family)
          setFamilyMembers(members)

          // Si es admin, cargar peticiones pendientes
          if (adminStatus) {
            const requests = await getPendingRequestsForFamily(supabase, family.id_family)
            setPendingRequests(requests)
          }
        }

        // Cargar otras familias
        const families = await getUserFamilies(supabase, userId)
        setOtherFamilies(families)
      } catch (err) {
        console.error('Error al cargar datos:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [userId])

  const handleMemberAdded = async () => {
    if (currentFamily) {
      const members = await getFamilyMembers(supabase, currentFamily.id_family)
      setFamilyMembers(members)
    }
  }

  const handleApproveRequest = async (request: FamilyRequest) => {
    if (processingRequest) return
    
    setProcessingRequest(request.id_request)
    try {
      await approveJoinFamilyRequest(request.id_request)
      // Recargar datos
      if (currentFamily) {
        const members = await getFamilyMembers(supabase, currentFamily.id_family)
        setFamilyMembers(members)
        const requests = await getPendingRequestsForFamily(supabase, currentFamily.id_family)
        setPendingRequests(requests)
      }
    } catch (error) {
      console.error('Error al aprobar petición:', error)
      alert(error instanceof Error ? error.message : 'Error al aprobar petición')
    } finally {
      setProcessingRequest(null)
    }
  }

  const handleRejectRequest = async (request: FamilyRequest) => {
    if (processingRequest) return
    
    if (!confirm('¿Estás seguro de rechazar esta petición?')) {
      return
    }

    setProcessingRequest(request.id_request)
    try {
      await rejectFamilyRequest(request.id_request)
      // Recargar peticiones
      if (currentFamily) {
        const requests = await getPendingRequestsForFamily(supabase, currentFamily.id_family)
        setPendingRequests(requests)
      }
    } catch (error) {
      console.error('Error al rechazar petición:', error)
      alert(error instanceof Error ? error.message : 'Error al rechazar petición')
    } finally {
      setProcessingRequest(null)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Cargando...</p>
      </div>
    )
  }

  return (
    <div>
        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('account')}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'account'
                  ? 'border-[#90EBD6] text-[#0d9488]'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Mi Cuenta
            </button>
            <button
              onClick={() => setActiveTab('family')}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'family'
                  ? 'border-[#90EBD6] text-[#0d9488]'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Mi Familia
            </button>
            <button
              onClick={() => setActiveTab('other-families')}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'other-families'
                  ? 'border-[#90EBD6] text-[#0d9488]'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Otras Familias
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === 'categories'
                  ? 'border-[#90EBD6] text-[#0d9488]'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Categorías
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-gray-100">
          {activeTab === 'account' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">
                Información de Mi Cuenta
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Nombre
                  </label>
                  <p className="mt-1 text-base text-gray-900">
                    {userData.ds_user || 'Sin nombre'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Email
                  </label>
                  <p className="mt-1 text-base text-gray-900">
                    {userData.ds_email}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Cuenta creada
                  </label>
                  <p className="mt-1 text-base text-gray-900">
                    {formatDate(userData.dt_created)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Último acceso
                  </label>
                  <p className="mt-1 text-base text-gray-900">
                    {formatDate(userData.dt_last_login)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'family' && currentFamily && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Mi Familia: {currentFamily.ds_family}
                </h2>
                {isAdmin && (
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="rounded-xl bg-[#90EBD6] px-4 py-2 text-sm font-medium text-[#0d9488] hover:bg-[#90EBD6]/90 active:bg-[#90EBD6]/80 touch-manipulation min-h-[44px] transition-colors shadow-sm"
                  >
                    + Añadir Miembro
                  </button>
                )}
              </div>
              {isAdmin && (
                <p className="text-sm text-gray-600 mb-4">
                  Eres administrador de esta familia
                </p>
              )}

              {/* Peticiones pendientes (solo para admin) */}
              {isAdmin && pendingRequests.length > 0 && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <h3 className="text-sm font-semibold text-yellow-800 mb-3">
                    Peticiones Pendientes ({pendingRequests.length})
                  </h3>
                  <div className="space-y-3">
                    {pendingRequests.map((request) => (
                      <div
                        key={request.id_request}
                        className="bg-white p-3 rounded-lg border border-yellow-200"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {request.user?.ds_user || request.user?.ds_email || 'Usuario desconocido'}
                            </p>
                            <p className="text-xs text-gray-500">{request.user?.ds_email}</p>
                            {request.ds_comment && (
                              <p className="text-xs text-gray-600 mt-1">{request.ds_comment}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleApproveRequest(request)}
                            disabled={processingRequest === request.id_request}
                            className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-[#90EBD6] rounded-lg hover:bg-[#90EBD6]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[36px]"
                          >
                            {processingRequest === request.id_request ? 'Procesando...' : 'Aprobar'}
                          </button>
                          <button
                            onClick={() => handleRejectRequest(request)}
                            disabled={processingRequest === request.id_request}
                            className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-[#FFB3BA] rounded-lg hover:bg-[#FFB3BA]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[36px]"
                          >
                            Rechazar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-lg font-medium text-gray-900">Miembros:</h3>
                {familyMembers.length === 0 ? (
                  <p className="text-gray-500">No hay miembros en esta familia</p>
                ) : (
                  <div className="space-y-2">
                    {familyMembers.map((member) => (
                      <div
                        key={member.id_user}
                        className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-3 hover:shadow-sm transition-shadow"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {member.ds_user || 'Sin nombre'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {member.ds_email}
                          </p>
                        </div>
                        {member.id_user === userId && (
                          <span className="rounded-full bg-[#90EBD6]/20 px-3 py-1 text-xs font-medium text-[#0d9488]">
                            Tú
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'other-families' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">
                Otras Familias
              </h2>
              {otherFamilies.length === 0 ? (
                <p className="text-gray-500">
                  No perteneces a otras familias
                </p>
              ) : (
                <div className="space-y-2">
                  {otherFamilies.map((family) => (
                    <div
                      key={family.id_family}
                      className="rounded-xl border border-gray-200 bg-gray-50 p-4 hover:shadow-sm transition-shadow"
                    >
                      <p className="font-medium text-gray-900">
                        {family.ds_family}
                      </p>
                      {family.dt_inclusion && (
                        <p className="mt-1 text-sm text-gray-500">
                          Añadido: {formatDate(family.dt_inclusion)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'categories' && currentFamily && (
            <CategoryManager idFamily={currentFamily.id_family} />
          )}
        </div>

      {currentFamily && (
        <AddFamilyMemberModal
          isOpen={showAddMemberModal}
          onClose={() => setShowAddMemberModal(false)}
          onMemberAdded={handleMemberAdded}
          idFamily={currentFamily.id_family}
        />
      )}
    </div>
  )
}

