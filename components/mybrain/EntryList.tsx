import type { MyBrainEntryWithValues, MyBrainSectionFieldWithConfig } from '@/types/mybrain'
import { formatDate } from '@/lib/format'

interface EntryListProps {
  fields: MyBrainSectionFieldWithConfig[]
  entries: MyBrainEntryWithValues[]
}

export default function EntryList({ fields, entries }: EntryListProps) {
  if (entries.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-[#A8B5D9]">
        Sin entradas aún. Pulsa <strong className="text-white">+</strong> abajo para
        crear la primera.
      </p>
    )
  }

  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="space-y-3 sm:hidden">
        {entries.map((entry) => {
          const valueMap = new Map(
            entry.values.map((value) => [value.id_field, value.ds_value]),
          )
          return (
            <div
              key={entry.id_entry}
              className="rounded-2xl border border-white/10 bg-white/95 p-4 text-slate-900 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-bold text-slate-900">
                  {entry.ds_title}
                </h3>
                <span className="shrink-0 text-xs font-medium text-slate-500">
                  {formatDate(entry.dt_event, 'long')}
                </span>
              </div>
              {fields.length > 0 && (
                <dl className="mt-3 grid gap-2">
                  {fields.map((field) => {
                    const value = valueMap.get(field.id_field)
                    if (!value) return null
                    return (
                      <div
                        key={`${entry.id_entry}-${field.id_field}`}
                        className="flex justify-between gap-3 text-sm"
                      >
                        <dt className="font-medium text-slate-500">
                          {field.ds_section_field}
                        </dt>
                        <dd className="text-right text-slate-900">{value}</dd>
                      </div>
                    )
                  })}
                </dl>
              )}
            </div>
          )
        })}
      </div>

      {/* Tablet/Desktop: table */}
      <div className="hidden overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm sm:block">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-600">
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Título</th>
                {fields.map((field) => (
                  <th key={field.id_field} className="px-4 py-3 font-semibold">
                    {field.ds_section_field}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const valueMap = new Map(
                  entry.values.map((value) => [value.id_field, value.ds_value]),
                )
                return (
                  <tr key={entry.id_entry} className="border-t border-slate-200 align-top">
                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                      {formatDate(entry.dt_event, 'long')}
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-900">
                      {entry.ds_title}
                    </td>
                    {fields.map((field) => (
                      <td
                        key={`${entry.id_entry}-${field.id_field}`}
                        className="px-4 py-4 text-slate-700"
                      >
                        {valueMap.get(field.id_field) || '—'}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
