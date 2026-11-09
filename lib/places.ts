/** Lugar de una transacción: coordenadas y, si se conoce, nombre, dirección e identificador de Google. */
export interface PlaceValue {
  latitude: number
  longitude: number
  name?: string | null
  address?: string | null
  placeId?: string | null
}

/** Enlace de Google Maps que marca el punto exacto (o el lugar concreto si se conoce su identificador). */
export function googleMapsUrl(place: Pick<PlaceValue, 'latitude' | 'longitude' | 'placeId'>): string {
  const point = `${place.latitude.toFixed(6)},${place.longitude.toFixed(6)}`
  const placeParam = place.placeId ? `&query_place_id=${encodeURIComponent(place.placeId)}` : ''
  return `https://www.google.com/maps/search/?api=1&query=${point}${placeParam}`
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
