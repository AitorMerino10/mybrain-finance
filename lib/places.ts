/** Lugar de una transacción: coordenadas y, si se conoce, nombre, dirección e identificador de Google. */
export interface PlaceValue {
  latitude: number
  longitude: number
  name?: string | null
  address?: string | null
  placeId?: string | null
}

/** Mismo sitio: mismo identificador de Google o, si no hay, el mismo nombre. */
export function placesMatch(a: PlaceValue, b: PlaceValue): boolean {
  if (a.placeId && b.placeId && a.placeId === b.placeId) return true
  const nameA = (a.name || '').trim().toLowerCase()
  const nameB = (b.name || '').trim().toLowerCase()
  return Boolean(nameA) && nameA === nameB
}

/** Enlace de Google Maps que marca el punto exacto (o el lugar concreto si se conoce su identificador). */
export function googleMapsUrl(place: Pick<PlaceValue, 'latitude' | 'longitude' | 'placeId'>): string {
  const point = `${place.latitude.toFixed(6)},${place.longitude.toFixed(6)}`
  const placeParam = place.placeId ? `&query_place_id=${encodeURIComponent(place.placeId)}` : ''
  return `https://www.google.com/maps/search/?api=1&query=${point}${placeParam}`
}

export type UsualPlace = PlaceValue & { visits: number }

type PlaceHistory = {
  type?: string | null
  id_category: string | null
  id_subcategory: string | null
  dt_date?: string | null
  ft_latitude?: number | null
  ft_longitude?: number | null
  ds_place_name?: string | null
  ds_place_address?: string | null
  ds_place_id?: string | null
}

const MIN_VISITS = 2
const MAX_SUGGESTIONS = 3

function normalizePlaceName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function rankPlaces(rows: PlaceHistory[], minVisits = MIN_VISITS, limit = MAX_SUGGESTIONS): UsualPlace[] {
  const groups = new Map<string, { place: PlaceValue; visits: number; latest: string }>()
  const sorted = [...rows].sort((a, b) => (b.dt_date || '').localeCompare(a.dt_date || ''))
  for (const tx of sorted) {
    const name = tx.ds_place_name?.trim()
    const latitude = tx.ft_latitude
    const longitude = tx.ft_longitude
    if (!name || latitude == null || longitude == null) continue
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue
    const placeId = tx.ds_place_id?.trim() || null
    const key = placeId ? `id:${placeId}` : `name:${normalizePlaceName(name)}`
    const existing = groups.get(key)
    if (existing) {
      existing.visits += 1
      continue
    }
    groups.set(key, {
      visits: 1,
      latest: tx.dt_date || '',
      place: {
        latitude,
        longitude,
        name,
        address: tx.ds_place_address?.trim() || null,
        placeId,
      },
    })
  }
  return Array.from(groups.values())
    .filter((group) => group.visits >= minVisits)
    .sort((a, b) => b.visits - a.visits || b.latest.localeCompare(a.latest))
    .slice(0, limit)
    .map((group) => ({ ...group.place, visits: group.visits }))
}

/** Todos los sitios con nombre que ya se han usado, para poder buscarlos sin Google. */
export function listKnownPlaces(transactions: PlaceHistory[]): UsualPlace[] {
  return rankPlaces(
    transactions.filter((tx) => tx.type == null || tx.type === 'Expense'),
    1,
    400
  )
}

/** Coincidencias del buscador local: nombre o dirección, sin tildes. */
export function filterKnownPlaces(places: UsualPlace[], query: string, limit = 8): UsualPlace[] {
  const q = normalizePlaceName(query)
  if (!q) return []
  return places
    .filter((place) => normalizePlaceName(`${place.name || ''} ${place.address || ''}`).includes(q))
    .slice(0, limit)
}

export type HabitualExpense = {
  key: string
  idCategory: string
  categoryName: string
  idSubcategory: string | null
  subcategoryName: string | null
  visits: number
  place: UsualPlace | null
}

type HabitRow = PlaceHistory & {
  ds_category?: string | null
  ds_subcategory?: string | null
}

/** Un sitio solo cuenta como habitual si se repite y es una parte real de ese gasto, no 2 visitas sueltas. */
function dominantPlaces(rows: PlaceHistory[], limit = 3): UsualPlace[] {
  if (rows.length === 0) return []
  return rankPlaces(rows, 3, limit).filter((place) => place.visits / rows.length >= 0.2)
}

/**
 * Los gastos que más se repiten, tengan sitio o no.
 * El lugar solo se añade si, dentro de ese gasto, es de verdad el sitio habitual.
 */
export function suggestHabitualExpenses(transactions: HabitRow[], limit = 5): HabitualExpense[] {
  const groups = new Map<
    string,
    {
      idCategory: string
      categoryName: string
      idSubcategory: string | null
      subcategoryName: string | null
      visits: number
      latest: string
      rows: HabitRow[]
    }
  >()

  for (const tx of transactions) {
    if (tx.type != null && tx.type !== 'Expense') continue
    if (!tx.id_category) continue
    const categoryName = tx.ds_category?.trim() || ''
    if (!categoryName || categoryName === 'Sin categoría') continue
    const idSubcategory = tx.id_subcategory || null
    const subcategoryName = idSubcategory ? tx.ds_subcategory?.trim() || '' : null
    if (idSubcategory && (!subcategoryName || subcategoryName === 'Sin subcategoría')) continue
    const key = idSubcategory ? `${tx.id_category}:${idSubcategory}` : tx.id_category
    const date = tx.dt_date || ''
    const existing = groups.get(key)
    if (existing) {
      existing.visits += 1
      if (date > existing.latest) existing.latest = date
      existing.rows.push(tx)
      continue
    }
    groups.set(key, {
      idCategory: tx.id_category,
      categoryName,
      idSubcategory,
      subcategoryName,
      visits: 1,
      latest: date,
      rows: [tx],
    })
  }

  return Array.from(groups.values())
    .filter((group) => group.visits >= 3)
    .sort((a, b) => b.visits - a.visits || b.latest.localeCompare(a.latest))
    .slice(0, limit)
    .map((group) => ({
      key: group.idSubcategory ? `${group.idCategory}:${group.idSubcategory}` : group.idCategory,
      idCategory: group.idCategory,
      categoryName: group.categoryName,
      idSubcategory: group.idSubcategory,
      subcategoryName: group.subcategoryName,
      visits: group.visits,
      place: dominantPlaces(group.rows, 1)[0] ?? null,
    }))
}

/**
 * Sitio habitual de la subvertical elegida (o de la vertical, si no hay subvertical).
 * Cuenta todos los gastos del grupo: un sitio con pocas visitas no se sugiere.
 */
export function suggestUsualPlaces(
  transactions: PlaceHistory[],
  categoryId: string | null,
  subcategoryId: string | null
): { places: UsualPlace[]; scope: 'subcategory' | 'category' | null } {
  if (!categoryId) return { places: [], scope: null }
  const pool = transactions.filter(
    (tx) => (tx.type == null || tx.type === 'Expense') && tx.id_category === categoryId
  )
  const rows = subcategoryId ? pool.filter((tx) => tx.id_subcategory === subcategoryId) : pool
  const places = dominantPlaces(rows)
  if (places.length === 0) return { places: [], scope: null }
  return { places, scope: subcategoryId ? 'subcategory' : 'category' }
}

/** Columnas de la transacción para guardar (o borrar, con `null`) el lugar. */
export function placeToTransactionFields(place: PlaceValue | null) {
  return {
    ft_latitude: place ? Number(place.latitude.toFixed(6)) : null,
    ft_longitude: place ? Number(place.longitude.toFixed(6)) : null,
    ds_place_name: place?.name?.trim() || null,
    ds_place_address: place?.address?.trim() || null,
    ds_place_id: place?.placeId || null,
    ds_location_url: place ? googleMapsUrl(place) : null,
  }
}

/** Lugar guardado en una transacción (null si no tiene coordenadas). */
export function placeFromTransaction(t: {
  ft_latitude?: number | null
  ft_longitude?: number | null
  ds_place_name?: string | null
  ds_place_address?: string | null
  ds_place_id?: string | null
}): PlaceValue | null {
  if (t.ft_latitude == null || t.ft_longitude == null) return null
  return {
    latitude: Number(t.ft_latitude),
    longitude: Number(t.ft_longitude),
    name: t.ds_place_name ?? null,
    address: t.ds_place_address ?? null,
    placeId: t.ds_place_id ?? null,
  }
}
