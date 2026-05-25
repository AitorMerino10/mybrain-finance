import Link from 'next/link'

export default function MyBrainSetupNotice() {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            Configuracion pendiente
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            MyBrain necesita su migracion inicial
          </h2>
        </div>

        <p className="text-sm leading-7 text-slate-700 sm:text-base">
          Ya he dejado preparada la base del producto en código, pero antes de usar
          esta nueva capa necesitas ejecutar la migración SQL y regenerar los tipos
          de Supabase.
        </p>

        <div className="rounded-2xl border border-amber-200 bg-white px-4 py-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Siguiente paso recomendado</p>
          <p className="mt-2">
            Ejecuta `scripts/create-mybrain-foundation.sql` en el SQL Editor de
            Supabase y después regenera `types/supabase.ts`.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Volver a Finance
          </Link>
        </div>
      </div>
    </div>
  )
}
