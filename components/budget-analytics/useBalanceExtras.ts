'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getBudgetSubtypes, type BudgetSubtype } from '@/lib/budgets'
import { getBudgetPlans, type BudgetPlan } from '@/lib/budget-plans'
import { getBudgetCloses, type BudgetClose } from '@/lib/budget-closes'
import { getFamilyIncomeAllocations, type AllocationRow } from '@/lib/income-allocations'
import type { BalanceExtras } from '@/lib/budget-balance'

/** Repartos de ingresos, cierres, planes y subpartidas: lo que hace falta, además de la analítica, para calcular saldos. */
export function useBalanceExtras(idFamily: string) {
  const [allocations, setAllocations] = useState<Map<string, AllocationRow[]>>(new Map())
  const [closes, setCloses] = useState<BudgetClose[]>([])
  const [closesAvailable, setClosesAvailable] = useState(true)
  const [plans, setPlans] = useState<BudgetPlan[]>([])
  const [subtypes, setSubtypes] = useState<BudgetSubtype[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    try {
      const [allocs, closesResult, plansResult, subtypesResult] = await Promise.all([
        getFamilyIncomeAllocations(supabase, idFamily),
        getBudgetCloses(supabase, idFamily),
        getBudgetPlans(supabase, idFamily),
        getBudgetSubtypes(supabase, idFamily, { includeArchived: true }),
      ])
      setAllocations(allocs)
      setCloses(closesResult.closes)
      setClosesAvailable(closesResult.available)
      setPlans(plansResult.plans)
      setSubtypes(subtypesResult.subtypes)
    } catch (err) {
      console.error('Error al cargar datos de saldos:', err)
    } finally {
      setLoaded(true)
    }
  }, [idFamily])

  useEffect(() => {
    reload()
  }, [reload])

  const extras: BalanceExtras = { allocations, closes, plans, subtypes }
  return { extras, closes, closesAvailable, plans, subtypes, loaded, reload }
}
