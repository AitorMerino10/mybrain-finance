import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { DiaryFinanceItem, DiaryItem, DiaryEntryItem } from '@/types/mybrain'
import { getSectionsForUser } from './sections'
import { getEntriesForSection } from './entries'

export async function getDiaryItemsForDate(
  supabase: SupabaseClient<Database>,
  userId: string,
  date: string
): Promise<DiaryItem[]> {
  const sections = await getSectionsForUser(supabase, userId)
  const entryLists = await Promise.all(
    sections.map(async (section) => {
      const entries = await getEntriesForSection(supabase, userId, section.id_section)
      return entries
        .filter((entry) => entry.dt_event === date)
        .map<DiaryEntryItem>((entry) => ({
          kind: 'entry',
          id: entry.id_entry,
          title: entry.ds_title,
          sectionName: section.ds_section,
          eventDate: entry.dt_event,
          createdAt: entry.dt_created,
          values: entry.values,
        }))
    })
  )

  const { data: financeRows, error } = await supabase
    .from('gnp_fct_transactions')
    .select(`
      id_transaction,
      dt_date,
      dt_created,
      ds_comments,
      ft_amount,
      pml_dim_family(ds_family),
      pml_dim_category(ds_category),
      pml_dim_transaction_type(ds_type),
      pml_rel_transaction_user!inner(id_user, ft_amount_user)
    `)
    .eq('dt_date', date)
    .eq('pml_rel_transaction_user.id_user', userId)
    .order('dt_created', { ascending: false })

  if (error) {
    console.error('Error al obtener datos financieros para el diario:', error)
    throw error
  }

  const financeItems = (financeRows || []).map<DiaryFinanceItem>((row: any) => {
    const userAmounts = Array.isArray(row.pml_rel_transaction_user)
      ? row.pml_rel_transaction_user
      : []

    const amount = userAmounts.length > 0
      ? userAmounts.reduce(
          (sum: number, item: { ft_amount_user: number | null }) => sum + (item.ft_amount_user || 0),
          0
        )
      : row.ft_amount

    return {
      kind: 'finance',
      id: row.id_transaction,
      title: row.ds_comments || row.pml_dim_category?.ds_category || 'Movimiento financiero',
      familyName: row.pml_dim_family?.ds_family || null,
      categoryName: row.pml_dim_category?.ds_category || null,
      transactionType: row.pml_dim_transaction_type?.ds_type || null,
      amount,
      eventDate: row.dt_date,
      createdAt: row.dt_created,
    }
  })

  return [...entryLists.flat(), ...financeItems].sort((a, b) => {
    const aDate = new Date(a.createdAt || a.eventDate).getTime()
    const bDate = new Date(b.createdAt || b.eventDate).getTime()
    return bDate - aDate
  })
}
