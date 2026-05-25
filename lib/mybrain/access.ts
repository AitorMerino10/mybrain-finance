import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getUserFamilies } from '@/lib/family'

const DEFAULT_ALLOWED_FAMILY_IDS = ['f4a87f78-d692-4625-835c-fadff4df1c61']

export function getAllowedMyBrainFamilyIds() {
  const configured = process.env.MYBRAIN_ALLOWED_FAMILY_IDS
  const values = configured
    ? configured
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : DEFAULT_ALLOWED_FAMILY_IDS

  return new Set(values)
}

export function isMyBrainFamilyAllowed(familyId: string | null | undefined) {
  if (!familyId) return false
  return getAllowedMyBrainFamilyIds().has(familyId)
}

export async function userHasMyBrainAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const families = await getUserFamilies(supabase, userId)
  return families.some((family) => isMyBrainFamilyAllowed(family.id_family))
}
