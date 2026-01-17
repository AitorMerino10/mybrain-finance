'use client'

import { useState, useEffect } from 'react'
import FamilyRequestForm from './FamilyRequestForm'
import CircularLoader from './CircularLoader'
import { supabase } from '@/lib/supabase'

interface UnauthorizedPageClientProps {
  userId: string
  userEmail: string
}

export default function UnauthorizedPageClient({ userId, userEmail }: UnauthorizedPageClientProps) {
  const [showForm, setShowForm] = useState(false)
  const [hasRequest, setHasRequest] = useState(false)
  const [loading, setLoading] = useState(true)

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
      setLoading(false)
    }

    checkExistingRequest()
  }, [userId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <CircularLoader size="lg" />
      </div>
    )
  }

  const handleRequestSubmitted = () => {
    setHasRequest(true)
    setShowForm(false)
  }

  if (hasRequest) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-8">
        <div className="w-full max-w-2xl space-y-6">
          <div className="bg-slate-800 rounded-3xl shadow-xl border border-slate-700 p-6 sm:p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-700 mb-6">
              <svg
                className="h-8 w-8 text-slate-300"
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

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-3">
              ¡Petición Enviada!
            </h1>
            <p className="text-base sm:text-lg text-slate-300">
              Tu petición ha sido enviada al administrador. Lo verás en tu aplicación cuando sea procesada.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 px-4 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto space-y-8 sm:space-y-10">
        {/* Hero Section */}
        <div className="text-center space-y-4 sm:space-y-6">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-100 leading-tight">
            ¡Bienvenido a <span className="text-[#90EBD6]">MyBrain</span>!
          </h1>
          
          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-medium">
            La aplicación que necesitas para gestionar tus gastos y los de tu familia, entender tus finanzas y alcanzar tus objetivos.
          </p>
        </div>

        {/* Value Proposition */}
        <div className="bg-slate-800 rounded-3xl shadow-xl border border-slate-700 p-6 sm:p-8 lg:p-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-6 sm:mb-8 text-center">
            ¿Qué puedes hacer con MyBrain?
          </h2>
          
          <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
            <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-700/50 transition-colors">
              <div className="flex-shrink-0">
                <div className="h-14 w-14 rounded-xl bg-[#90EBD6]/20 flex items-center justify-center border border-[#90EBD6]/30">
                  <svg className="h-7 w-7 text-[#90EBD6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-100 mb-1 text-lg">Control Total</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Registra y categoriza todos tus gastos e ingresos de forma sencilla.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-700/50 transition-colors">
              <div className="flex-shrink-0">
                <div className="h-14 w-14 rounded-xl bg-[#90EBD6]/20 flex items-center justify-center border border-[#90EBD6]/30">
                  <svg className="h-7 w-7 text-[#90EBD6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-100 mb-1 text-lg">Colaboración Familiar</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Trabaja en equipo con tu familia para mantener las finanzas organizadas.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-700/50 transition-colors">
              <div className="flex-shrink-0">
                <div className="h-14 w-14 rounded-xl bg-[#90EBD6]/20 flex items-center justify-center border border-[#90EBD6]/30">
                  <svg className="h-7 w-7 text-[#90EBD6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-100 mb-1 text-lg">Análisis Detallado</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Visualiza tus gastos con gráficos y estadísticas en tiempo real.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-700/50 transition-colors">
              <div className="flex-shrink-0">
                <div className="h-14 w-14 rounded-xl bg-[#90EBD6]/20 flex items-center justify-center border border-[#90EBD6]/30">
                  <svg className="h-7 w-7 text-[#90EBD6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-100 mb-1 text-lg">Avanza en tus finanzas</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Entendiendo tus gastos y beneficios, organízate para lograr tus objetivos.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Process Explanation */}
        <div className="bg-slate-800 rounded-3xl shadow-xl border border-slate-700 p-6 sm:p-8 lg:p-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-6 sm:mb-8 text-center">
            ¿Cómo obtener acceso?
          </h2>
          
          <div className="space-y-5 sm:space-y-6 max-w-2xl mx-auto">
            <div className="flex gap-4 p-4 rounded-2xl bg-slate-700/50 border border-[#90EBD6]/30">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-full bg-[#90EBD6] text-[#0d9488] flex items-center justify-center font-bold text-lg shadow-md">
                  1
                </div>
              </div>
              <div className="flex-1 pt-1">
                <h3 className="font-bold text-slate-100 mb-1 text-lg">Crea tu Familia</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Solicita crear una nueva familia proporcionando algunos datos básicos. Puedes invitar a otros miembros desde el inicio.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-2xl bg-slate-700/50 border border-[#7DD3C1]/30">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-full bg-[#7DD3C1] text-[#0d9488] flex items-center justify-center font-bold text-lg shadow-md">
                  2
                </div>
              </div>
              <div className="flex-1 pt-1">
                <h3 className="font-bold text-slate-100 mb-1 text-lg">Unirse a una Familia Existente</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Si quieres unirte a una familia que ya existe, contacta con el administrador para que te dé acceso. Una vez hecho, lo verás automáticamente en tu aplicación.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-2xl bg-slate-700/50 border border-[#0d9488]/30">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-full bg-[#0d9488] text-white flex items-center justify-center font-bold text-lg shadow-md">
                  3
                </div>
              </div>
              <div className="flex-1 pt-1">
                <h3 className="font-bold text-slate-100 mb-1 text-lg">Empieza a entender tu dinero!</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Una vez que tu solicitud sea aprobada, verás el acceso automáticamente en tu aplicación cuando entres. No necesitas hacer nada más.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        {!showForm && (
          <div className="bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 p-8 sm:p-10 text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-100 mb-4">
              ¿Listo para empezar?
            </h2>
            <p className="text-slate-300 mb-8 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
              Solicita acceso ahora y comienza a gestionar tus finanzas familiares de forma inteligente.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-10 py-4 text-base sm:text-lg font-bold text-[#0d9488] bg-[#90EBD6] rounded-xl hover:bg-[#90EBD6]/90 active:bg-[#90EBD6]/80 transition-all touch-manipulation min-h-[44px] shadow-xl"
            >
              Solicitar Acceso
            </button>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="bg-slate-800 rounded-3xl shadow-xl border border-slate-700 p-4 sm:p-6 lg:p-8">
            <button
              onClick={() => setShowForm(false)}
              className="mb-4 text-slate-300 hover:text-slate-100 flex items-center gap-2 text-sm font-medium transition-colors"
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
