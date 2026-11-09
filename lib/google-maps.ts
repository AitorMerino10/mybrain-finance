/** Clave pública de Google Maps (restringida por dominio en Google Cloud). */
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

export const isGoogleMapsConfigured = GOOGLE_MAPS_API_KEY.length > 0

let loader: Promise<void> | null = null

/** Carga el script de Google Maps una sola vez (solo en el navegador). */
export function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Solo disponible en el navegador'))
  if (!isGoogleMapsConfigured) return Promise.reject(new Error('Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'))
  if (typeof google !== 'undefined' && typeof google.maps?.importLibrary === 'function') return Promise.resolve()
  if (loader) return loader

  loader = new Promise<void>((resolve, reject) => {
    // Con loading=async la API solo está lista cuando Google llama a `callback` (no basta con el onload del script)
    ;(window as unknown as Record<string, unknown>).__mybrainMapsReady = () => resolve()
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&v=weekly&loading=async&language=es&region=ES&callback=__mybrainMapsReady`
    script.async = true
    script.onerror = () => {
      loader = null
      reject(new Error('No se pudo cargar Google Maps'))
    }
    document.head.appendChild(script)
  })
  return loader
}
