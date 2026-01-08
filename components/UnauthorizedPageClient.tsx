'use client'

import { useState, useEffect } from 'react'
import FamilyRequestForm from './FamilyRequestForm'
import { supabase } from '@/lib/supabase'

interface UnauthorizedPageClientProps {
  userId: string
  userEmail: string
}

export default function UnauthorizedPageClient({ userId, userEmail }: UnauthorizedPageClientProps) {
  const [showForm, setShowForm] = useState(false)
  const [hasRequest, setHasRequest] = useState(false)

  useEffect(() => {
    const checkExistingRequest = async () => {
      const { data } = await supabase
        .from('pml_dim_family_request')
        .select('id_request')
        .eq('id_user', userId)
        .eq('ds_status', 'pending')
        .maybeSingle()

      if (data) {
        setHasRequest(true)
      }
    }

    checkExistingRequest()
  }, [userId])

  const handleRequestSubmitted = () => {
    setHasRequest(true)
    setShowForm(false)
  }

  if (hasRequest) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#EAF1F6] via-[#F0F7FA] to-[#EAF1F6] px-4 py-8">
        <div className="w-full max-w-2xl space-y-6">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#90EBD6]/20 mb-6">
              <svg
                className="h-8 w-8 text-[#0d9488]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              ¡Petición Enviada!
            </h1>
            <p className="text-base sm:text-lg text-gray-600 mb-6">
              Tu petición ha sido enviada al administrador. Te notificaremos cuando sea procesada.
            </p>

            <div className="rounded-2xl bg-[#90EBD6]/10 border border-[#90EBD6]/20 p-4 mb-6">
              <p className="text-sm text-[#0d9488]">
                Mientras tanto, puedes cerrar sesión y volver más tarde. Recibirás un email cuando tu acceso sea aprobado.
              </p>
            </div>

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors touch-manipulation min-h-[44px]"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EAF1F6] via-[#F0F7FA] to-[#EAF1F6] px-4 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4 sm:space-y-6">
          <div className="mx-auto flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-[#90EBD6]/20 mb-4">
            <svg
              className="h-10 w-10 sm:h-12 sm:w-12 text-[#0d9488]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900">
            ¡Bienvenido a MyBrain Finance!
          </h1>
          
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
            La aplicación perfecta para gestionar los gastos familiares de forma sencilla y colaborativa.
          </p>
        </div>

        {/* Value Proposition */}
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
            ¿Qué puedes hacer con MyBrain Finance?
          </h2>
          
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-xl bg-[#90EBD6]/20 flex items-center justify-center">
                  <svg className="h-6 w-6 text-[#0d9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Control Total</h3>
                <p className="text-sm text-gray-600">
                  Registra y categoriza todos tus gastos e ingresos de forma sencilla.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-xl bg-[#FFD3B6]/20 flex items-center justify-center">
                  <svg className="h-6 w-6 text-[#D97706]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Colaboración Familiar</h3>
                <p className="text-sm text-gray-600">
                  Trabaja en equipo con tu familia para mantener las finanzas organizadas.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-xl bg-[#C7CEEA]/20 flex items-center justify-center">
                  <svg className="h-6 w-6 text-[#4C63D2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Análisis Detallado</h3>
                <p className="text-sm text-gray-600">
                  Visualiza tus gastos con gráficos y estadísticas en tiempo real.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-xl bg-[#FFB3BA]/20 flex items-center justify-center">
                  <svg className="h-6 w-6 text-[#DC2626]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Presupuestos Inteligentes</h3>
                <p className="text-sm text-gray-600">
                  Establece límites y recibe alertas cuando te acerques a ellos.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Process Explanation */}
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
            ¿Cómo obtener acceso?
          </h2>
          
          <div className="space-y-4 sm:space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-[#90EBD6] text-white flex items-center justify-center font-bold text-lg">
                  1
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Solicita Acceso</h3>
                <p className="text-sm text-gray-600">
                  Puedes crear una nueva familia o unirte a una existente. Solo necesitas proporcionar algunos datos básicos.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-[#90EBD6] text-white flex items-center justify-center font-bold text-lg">
                  2
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Revisión del Administrador</h3>
                <p className="text-sm text-gray-600">
                  Nuestro equipo revisará tu solicitud y te notificará en un plazo máximo de 24-48 horas.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-[#90EBD6] text-white flex items-center justify-center font-bold text-lg">
                  3
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">¡Empieza a Usar!</h3>
                <p className="text-sm text-gray-600">
                  Una vez aprobado, recibirás un email y podrás acceder a todas las funcionalidades de la aplicación.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        {!showForm && (
          <div className="bg-gradient-to-r from-[#90EBD6] to-[#7DD3C1] rounded-3xl shadow-lg border border-[#90EBD6]/20 p-6 sm:p-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              ¿Listo para empezar?
            </h2>
            <p className="text-white/90 mb-6 text-lg">
              Solicita acceso ahora y comienza a gestionar tus finanzas familiares de forma inteligente.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-8 py-4 text-base sm:text-lg font-semibold text-[#0d9488] bg-white rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation min-h-[44px] shadow-lg"
            >
              Solicitar Acceso
            </button>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-4 sm:p-6">
            <button
              onClick={() => setShowForm(false)}
              className="mb-4 text-gray-500 hover:text-gray-700 flex items-center gap-2 text-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Volver
            </button>
            <FamilyRequestForm userId={userId} onRequestSubmitted={handleRequestSubmitted} />
          </div>
        )}
      </div>
    </div>
  )
}
