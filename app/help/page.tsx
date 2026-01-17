import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navigation from '@/components/Navigation'
import { getUserFamilies } from '@/lib/family'
import Link from 'next/link'

export default async function HelpPage({
  searchParams,
}: {
  searchParams: { family?: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: userData } = await supabase
    .from('pml_dim_user')
    .select('ds_user, ds_email')
    .eq('id_user', user.id)
    .single()

  const families = await getUserFamilies(supabase, user.id)
  const selectedFamilyId = searchParams.family || families[0]?.id_family

  if (!selectedFamilyId || !families.find(f => f.id_family === selectedFamilyId)) {
    redirect('/unauthorized')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation
        idFamily={selectedFamilyId}
        idUser={user.id}
        userData={userData}
        families={families.map(f => ({ id_family: f.id_family, ds_family: f.ds_family }))}
        currentFamilyId={selectedFamilyId}
      />

      <main className="lg:pl-72">
        <div className="pt-4 sm:pt-6 pb-20 lg:pb-8 lg:pt-12 bg-gray-50 min-h-screen">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="mb-4 sm:mb-6 flex items-center gap-3">
              <Link
                href="/"
                className="lg:hidden text-gray-600 hover:text-gray-900 transition-colors touch-manipulation p-2 -ml-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold italic text-gray-900 mb-1.5">MyBrain</h1>
                <p className="text-sm sm:text-base text-gray-500">
                  Entiende el proyecto y sácale partido.
                </p>
              </div>
            </div>

            <section className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl shadow-sm border border-slate-700 p-5 sm:p-8 text-white space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide">
                  MyBrain Finance · v0
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold">
                Tu vida financiera, ordenada y siempre a mano.
              </h2>
              <p className="text-sm sm:text-base text-white/80">
                MyBrain Finance te muestra el pasado y el presente de tus ingresos y gastos dándote la oportunidad de identificar patrones 
                y mejorar tus finanzas.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  href="/?action=new-transaction"
                  className="inline-flex items-center justify-center rounded-xl bg-[#90EBD6] text-[#0d9488] px-4 py-2 text-sm font-semibold shadow-sm hover:bg-[#7DD3C1] transition-colors"
                >
                  Ir a Nueva Transacción
                </Link>
                <Link
                  href="/analytics"
                  className="inline-flex items-center justify-center rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                >
                  Explorar Analítica
                </Link>
              </div>
            </section>

            <section className="bg-gradient-to-r from-[#90EBD6]/15 to-[#7DD3C1]/15 rounded-2xl shadow-sm border border-[#90EBD6]/30 p-4 sm:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#0d9488]">Visión</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span>El objetivo</span>
                <span className="text-lg">💡</span>
              </h2>
              <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                MyBrain nace para concentrar en una sola aplicación todos esos lugares, restaurantes, películas, fechas o gastos que no quieres olvidar,
                y tenerlos al alcance de un clic para recordarlos de verdad.
              </p>
              <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                La primera versión es <span className="font-semibold">MyBrain Finance</span>: gestiona gastos e ingresos,
                categorízalos a tu manera, revisa el pasado y entiende con claridad dónde y cómo se va tu dinero.
              </p>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-3">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span>Presentación de MyBrain Finance</span>
                <span className="text-lg">🚀</span>
              </h2>
              <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                Crea tantas familias como necesites: personal, empresa, conjunta o una única para todo.
                Da acceso a quienes forman parte de este proyecto para que todos podáis registrar movimientos y
                comprender los gastos conjuntos: parejas, padres, hijos, equipos...
              </p>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span>Cómo empiezo a usarlo</span>
                <span className="text-lg">🧭</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-3 text-sm sm:text-base text-gray-700 leading-relaxed">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs font-semibold text-[#0d9488] mb-2">Paso 1</p>
                  Configura categorías y subcategorías de ingresos y gastos según tus necesidades. Ordénalas en
                  Configuración para encontrarlas antes.
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs font-semibold text-[#0d9488] mb-2">Paso 2</p>
                  Utiliza tags para agrupar momentos concretos: viajes, eventos, bodas, proyectos. Añade tantas
                  tags como quieras y obtén métricas específicas de cada grupo.
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs font-semibold text-[#0d9488] mb-2">Paso 3</p>
                  Registra transacciones en segundos con Nueva Transacción o el botón &quot;+&quot; en móvil.
                </div>
              </div>
              <div className="rounded-xl border border-[#90EBD6]/40 bg-[#90EBD6]/10 p-4 text-sm sm:text-base text-gray-700">
                <span className="font-semibold text-[#0d9488]">Tip pro:</span> crea un atajo en tu móvil y añádelo a la
                pantalla de bloqueo con el link de nueva transacción. Registrarás cada gasto al momento y evitarás
                dolores de cabeza al final del mes.
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-3">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span>Exprímelo al máximo</span>
                <span className="text-lg">📊</span>
              </h2>
              <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                La analítica es donde MyBrain Finance brilla: identifica beneficios mensuales, categorías habituales,
                picos de gasto y oportunidades reales de ahorro. Entender tu dinero es el primer paso para optimizarlo.
              </p>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-3">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span>Contacto</span>
                <span className="text-lg">🤝</span>
              </h2>
              <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                Dudas o feedback: <span className="font-semibold">aitormerino10@gmail.com</span>
              </p>
              <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                Próximamente, nuevas versiones de MyBrain, la app que recuerda y registra todo lo que vives.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
