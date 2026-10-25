import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Navigation from '@/components/Navigation'
import BudgetsManager from '@/components/BudgetsManager'
import GoalsManager from '@/components/GoalsManager'
import HelpTooltip from '@/components/HelpTooltip'
import { getUserFamilies } from '@/lib/family'
import { isMyBrainFamilyAllowed } from '@/lib/mybrain/access'

export default async function BudgetsPage({
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

  if (!selectedFamilyId || !families.find((family) => family.id_family === selectedFamilyId)) {
    redirect('/unauthorized')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation
        idFamily={selectedFamilyId}
        idUser={user.id}
        userData={userData}
        families={families.map((family) => ({
          id_family: family.id_family,
          ds_family: family.ds_family,
        }))}
        currentFamilyId={selectedFamilyId}
        showMyBrainLink={isMyBrainFamilyAllowed(selectedFamilyId)}
      />

      <main className="lg:pl-72">
        <div className="pt-4 sm:pt-6 pb-20 lg:pb-8 lg:pt-12 min-h-screen">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-4 sm:mb-6 flex items-center gap-3">
              <Link
                href="/"
                className="lg:hidden text-gray-600 hover:text-gray-900 transition-colors touch-manipulation p-2 -ml-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
              </Link>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold italic text-gray-900 mb-1.5">
                  Presupuestos
                </h1>
                <HelpTooltip content="Define cuánto debería gastar cada persona y cómo se clasifican las subcategorías." />
              </div>
            </div>

            <div>
              <BudgetsManager idFamily={selectedFamilyId} idUser={user.id} />
            </div>

            <div className="mt-6">
              <GoalsManager idFamily={selectedFamilyId} idUser={user.id} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
