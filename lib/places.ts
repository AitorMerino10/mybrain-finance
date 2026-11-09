/** Enlace de Google Maps que marca el punto exacto donde se hizo el pago (con las coordenadas del móvil). */
export function googleMapsUrl(params: { latitude: number; longitude: number }): string {
  const point = `${params.latitude.toFixed(6)},${params.longitude.toFixed(6)}`
  return `https://www.google.com/maps/search/?api=1&query=${point}`
}
