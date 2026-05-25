import DiaryView from '@/components/mybrain/DiaryView'
import MyBrainSetupNotice from '@/components/mybrain/MyBrainSetupNotice'
import { getTodayISOString } from '@/lib/date-utils'
import { requireMyBrainUser } from '@/lib/mybrain/auth'
import { getDiaryItemsForDate } from '@/lib/mybrain/diary'
import { isMissingMyBrainSchemaError } from '@/lib/mybrain/errors'

export default async function MyBrainDiaryPage({
  searchParams,
}: {
  searchParams: { date?: string }
}) {
  const { supabase, user } = await requireMyBrainUser()
  const selectedDate = searchParams.date || getTodayISOString()

  try {
    const items = await getDiaryItemsForDate(supabase, user.id, selectedDate)

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-white sm:text-2xl">Diario</h2>
          <form className="flex items-center gap-2" action="/mybrain/diary">
            <input
              type="date"
              name="date"
              defaultValue={selectedDate}
              className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#90EBD6] focus:ring-2 focus:ring-[#90EBD6]/30"
            />
            <button
              type="submit"
              className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
            >
              Filtrar
            </button>
          </form>
        </div>

        <DiaryView date={selectedDate} items={items} />
      </div>
    )
  } catch (error) {
    if (isMissingMyBrainSchemaError(error)) {
      return <MyBrainSetupNotice />
    }

    throw error
  }
}
