/** Enlace de Google Maps al sitio del pago: si hay comercio, lo busca cerca de las coordenadas; si no, marca el punto. */
export function googleMapsUrl(params: { merchant?: string | null; latitude: number; longitude: number }): string {
  const { merchant, latitude, longitude } = params
  const point = `${latitude.toFixed(6)},${longitude.toFixed(6)}`
  if (merchant && merchant.trim()) {
    return `https://www.google.com/maps/search/${encodeURIComponent(merchant.trim())}/@${point},18z`
  }
  return `https://www.google.com/maps/search/?api=1&query=${point}`
}
