import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/format'
import type { DiaryItem } from '@/types/mybrain'

interface DiaryViewProps {
  date: string
  items: DiaryItem[]
}

export default function DiaryView({ date, items }: DiaryViewProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#A8B5D9]">{formatDate(date, 'long')}</p>

      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-[#A8B5D9]">
          Nada registrado este día.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) =>
            item.kind === 'entry' ? (
              <div
                key={`entry-${item.id}`}
                className="rounded-2xl border border-white/10 bg-white/95 p-4 text-slate-900 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#90EBD6]/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0d9488]">
                    {item.sectionName}
                  </span>
                </div>
                <h3 className="mt-2 text-base font-bold text-slate-900">
                  {item.title}
                </h3>
                {item.values.length > 0 && (
                  <dl className="mt-3 grid gap-1.5">
                    {item.values
                      .filter((v) => v.ds_value)
                      .map((value) => (
                        <div
                          key={`${item.id}-${value.id_field}`}
                          className="flex justify-between gap-3 text-sm"
                        >
                          <dt className="font-medium text-slate-500">
                            {value.ds_section_field}
                          </dt>
                          <dd className="text-right text-slate-900">
                            {value.ds_value}
                          </dd>
                        </div>
                      ))}
                  </dl>
                )}
              </div>
            ) : (
              <div
                key={`finance-${item.id}`}
                className="rounded-2xl border border-[#90EBD6]/35 bg-gradient-to-br from-[#90EBD6]/15 to-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0d9488]">
                    Finance
                  </span>
                  {item.transactionType && (
                    <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {item.transactionType}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      {item.familyName ? `${item.familyName} · ` : ''}
                      {item.categoryName || 'Sin categoría'}
                    </p>
                  </div>
                  <p className="shrink-0 text-base font-bold text-slate-900">
                    {formatCurrency(item.amount)}
                  </p>
                </div>
                <Link
                  href="/"
                  className="mt-3 inline-flex text-xs font-semibold text-[#0d9488] hover:underline"
                >
                  Abrir Finance →
                </Link>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
