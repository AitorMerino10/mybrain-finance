import type { UserFamily } from '@/lib/family'
import type { MyBrainSectionCard } from '@/types/mybrain'

export const FINANCE_SYSTEM_SECTION_ID = 'system-finance'

export function getFinanceSystemSection(families: UserFamily[]): MyBrainSectionCard {
  const hasFamilies = families.length > 0
  const familyLabel = hasFamilies
    ? `${families.length} ${families.length === 1 ? 'familia' : 'familias'} conectadas`
    : 'Sin familias conectadas'

  return {
    id: FINANCE_SYSTEM_SECTION_ID,
    name: 'Finance',
    description:
      'Tu capa financiera actual dentro de MyBrain. Mantiene familias, transacciones, analítica y toda la lógica existente.',
    href: '/',
    isSystemSection: true,
    systemKey: 'finance',
    logo: '💵',
    color: null,
    brainRegion: 'frontal_right',
    brainPositionX: null,
    brainPositionY: null,
    entryCount: 0,
    metadata: familyLabel,
  }
}
