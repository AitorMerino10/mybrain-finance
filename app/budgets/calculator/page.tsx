import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navigation from '@/components/Navigation'
import BudgetCalculator from '@/components/budget-calculator/BudgetCalculator'
import HelpTooltip from '@/components/HelpTooltip'
import { getUserFamilies } from '@/lib/family'
import { isMyBrainFamilyAllowed } from '@/lib/mybrain/access'

export default async function BudgetCalculatorPage({
  searchParams,
}: {
  searchParams: { family?: string; edit?: string; user?: string; month?: string; start?: string }
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
          <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
            <div className="mb-4 sm:mb-6 flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold italic text-gray-900 mb-1.5">
                Calculadora de presupuestos
              </h1>
              <HelpTooltip content="Construye tus presupuestos paso a paso a partir de tus ingresos y de tu histórico real de gastos." />
            </div>

            <BudgetCalculator
              idFamily={selectedFamilyId}
              idUser={user.id}
              initialStep={searchParams.edit ? 5 : 1}
              startFromSaved={Boolean(searchParams.edit)}
              initialScope={searchParams.user}
              initialMonth={searchParams.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? searchParams.month : undefined}
              newStartMonth={searchParams.start && /^\d{4}-\d{2}$/.test(searchParams.start) ? searchParams.start : undefined}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
