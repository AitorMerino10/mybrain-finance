'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchCalculatorTransactions, type CalcTransaction } from '@/lib/budget-calculator'
import { listKnownPlaces, suggestHabitualExpenses, suggestUsualPlaces, type HabitualExpense, type UsualPlace } from '@/lib/places'

const EMPTY = { places: [] as UsualPlace[], scope: null as 'subcategory' | 'category' | null }

/** Sitios habituales de la vertical (y subvertical, si ya se ha repetido alguno) a partir del historial. */
export function useUsualPlaces(
  idFamily: string,
  categoryId: string | null,
  subcategoryId: string | null
): { places: UsualPlace[]; scope: 'subcategory' | 'category' | null; knownPlaces: UsualPlace[] } {
  const [rows, setRows] = useState<CalcTransaction[]>([])

  useEffect(() => {
    let cancelled = false
    fetchCalculatorTransactions(idFamily)
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [idFamily])

  return useMemo(() => {
    const suggestion = categoryId ? suggestUsualPlaces(rows, categoryId, subcategoryId) : EMPTY
    return { ...suggestion, knownPlaces: listKnownPlaces(rows) }
  }, [rows, categoryId, subcategoryId])
}

/** Los 4 o 5 gastos que más se repiten, para rellenar categoría y subcategoría de un toque. */
export function useHabitualExpenses(idFamily: string, enabled: boolean): HabitualExpense[] {
  const [rows, setRows] = useState<CalcTransaction[]>([])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    fetchCalculatorTransactions(idFamily)
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [idFamily, enabled])

  return useMemo(() => (enabled ? suggestHabitualExpenses(rows) : []), [enabled, rows])
}
