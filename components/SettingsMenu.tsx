import Link from 'next/link'

export type SettingsSection = 'verticales' | 'notificaciones'

type MenuItem = { key: string; label: string; emoji: string; href: string }

/** Menú de Configuración: las secciones propias y los accesos a Presupuestos, Ayuda y Admin. */
export default function SettingsMenu({
  idFamily,
  active,
  showAdmin,
}: {
  idFamily: string
  active: SettingsSection
  showAdmin: boolean
}) {
  const family = `family=${idFamily}`
  const items: MenuItem[] = [
    { key: 'verticales', label: 'Verticales', emoji: '🗂️', href: `/settings?${family}&section=verticales` },
    { key: 'notificaciones', label: 'Notificaciones', emoji: '🔔', href: `/settings?${family}&section=notificaciones` },
    { key: 'presupuestos', label: 'Presupuestos', emoji: '📖', href: `/budgets?${family}` },
    { key: 'ayuda', label: 'Ayuda', emoji: '❓', href: `/help?${family}` },
    ...(showAdmin ? [{ key: 'admin', label: 'Admin', emoji: '👑', href: `/admin?${family}` }] : []),
  ]

  return (
    <nav aria-label="Secciones de configuración" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:mb-6 sm:px-0">
      <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
        {items.map((item) => {
          const isActive = item.key === active
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span aria-hidden>{item.emoji}</span>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
