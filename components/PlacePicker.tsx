'use client'

import { useEffect, useRef, useState } from 'react'
import { isGoogleMapsConfigured, loadGoogleMaps } from '@/lib/google-maps'
import { googleMapsUrl, type PlaceValue } from '@/lib/places'

interface PlacePickerProps {
  value: PlaceValue | null
  onChange: (place: PlaceValue | null) => void
  disabled?: boolean
}

interface Suggestion {
  key: string
  main: string
  secondary: string
  prediction: google.maps.places.PlacePrediction
}

const PLACE_FIELDS = ['displayName', 'formattedAddress', 'location', 'id']

function toPlaceValue(place: google.maps.places.Place): PlaceValue | null {
  const location = place.location
  if (!location) return null
  return {
    latitude: location.lat(),
    longitude: location.lng(),
    name: place.displayName ?? null,
    address: place.formattedAddress ?? null,
    placeId: place.id ?? null,
  }
}

/**
 * Lugar de una transacción: buscador de Google Maps (comercios y direcciones), sugerencias de sitios
 * cercanos a unas coordenadas y mapa en el que se puede mover el pin.
 */
export default function PlacePicker({ value, onChange, disabled = false }: PlacePickerProps) {
  const [ready, setReady] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [nearby, setNearby] = useState<PlaceValue[]>([])
  const [error, setError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const tokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  valueRef.current = value
  onChangeRef.current = onChange

  const hasValue = value !== null
  const hasName = Boolean(value?.name)
  const latitude = value?.latitude
  const longitude = value?.longitude

  // Cargar Google Maps
  useEffect(() => {
    if (!isGoogleMapsConfigured) return
    let cancelled = false
    // Google avisa aquí cuando rechaza la clave (restricción de dominio, API sin activar, facturación...)
    ;(window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () =>
      setError('Google ha rechazado la clave: revisa que las APIs estén activadas, la facturación y la restricción de dominio.')
    loadGoogleMaps()
      .then(() => !cancelled && setReady(true))
      .catch(() => !cancelled && setError('No se pudo cargar Google Maps.'))
    return () => {
      cancelled = true
    }
  }, [])

  // Crear el mapa cuando hay lugar
  useEffect(() => {
    if (!ready || !hasValue || !mapDivRef.current) return
    let cancelled = false
    ;(async () => {
      const { Map } = await google.maps.importLibrary('maps')
      const { AdvancedMarkerElement } = await google.maps.importLibrary('marker')
      const current = valueRef.current
      if (cancelled || !mapDivRef.current || !current) return
      const center = { lat: current.latitude, lng: current.longitude }
      const map = new Map(mapDivRef.current, {
        center,
        zoom: 17,
        mapId: 'DEMO_MAP_ID',
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'cooperative',
      })
      const marker = new AdvancedMarkerElement({ map, position: center, gmpDraggable: true })

      const move = (lat: number, lng: number) => {
        const previous = valueRef.current
        if (!previous) return
        onChangeRef.current({ ...previous, latitude: lat, longitude: lng })
      }
      marker.addListener('dragend', () => {
        const position = marker.position
        if (!position) return
        const lat = typeof position.lat === 'function' ? position.lat() : position.lat
        const lng = typeof position.lng === 'function' ? position.lng() : position.lng
        move(lat, lng)
      })
      map.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (event.latLng) move(event.latLng.lat(), event.latLng.lng())
      })

      mapRef.current = map
      markerRef.current = marker
    })().catch((mapError: unknown) => {
      console.error('Error al mostrar el mapa:', mapError)
      const detail = mapError instanceof Error ? mapError.message : String(mapError)
      setError(`No se pudo mostrar el mapa (${detail.slice(0, 160)}).`)
    })
    return () => {
      cancelled = true
      mapRef.current = null
      markerRef.current = null
    }
  }, [ready, hasValue])

  // Mantener el pin sincronizado cuando cambian las coordenadas
  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return
    const position = { lat: latitude, lng: longitude }
    if (markerRef.current) markerRef.current.position = position
    mapRef.current?.panTo(position)
  }, [latitude, longitude])

  // Sitios cercanos cuando hay coordenadas pero todavía no nombre
  useEffect(() => {
    setNearby([])
    if (!ready || latitude === undefined || longitude === undefined || hasName) return
    let cancelled = false
    ;(async () => {
      const { Place, SearchNearbyRankPreference } = await google.maps.importLibrary('places')
      const { places } = await Place.searchNearby({
        fields: PLACE_FIELDS,
        locationRestriction: { center: { lat: latitude, lng: longitude }, radius: 100 },
        maxResultCount: 6,
        rankPreference: SearchNearbyRankPreference.DISTANCE,
        language: 'es',
      })
      if (cancelled) return
      setNearby(places.map(toPlaceValue).filter((place): place is PlaceValue => place !== null))
    })().catch(() => {
      // Sin sugerencias: se puede buscar a mano
    })
    return () => {
      cancelled = true
    }
  }, [ready, latitude, longitude, hasName])

  // Buscador (con retardo para no gastar llamadas mientras se escribe)
  useEffect(() => {
    if (!ready || query.trim().length < 3) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const { AutocompleteSuggestion, AutocompleteSessionToken } = await google.maps.importLibrary('places')
        if (!tokenRef.current) tokenRef.current = new AutocompleteSessionToken()
        const current = valueRef.current
        const { suggestions: found } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query.trim(),
          sessionToken: tokenRef.current,
          language: 'es',
          ...(current ? { locationBias: { center: { lat: current.latitude, lng: current.longitude }, radius: 30000 } } : {}),
        })
        if (cancelled) return
        setError(null)
        setSuggestions(
          found
            .filter((item) => item.placePrediction)
            .map((item) => {
              const prediction = item.placePrediction as google.maps.places.PlacePrediction
              return {
                key: prediction.placeId,
                main: prediction.mainText?.text || prediction.text.text,
                secondary: prediction.secondaryText?.text || '',
                prediction,
              }
            })
        )
      } catch {
        if (!cancelled) setError('No se pudo buscar lugares. Revisa la clave de Google Maps.')
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [ready, query])

  const selectSuggestion = async (suggestion: Suggestion) => {
    try {
      const place = suggestion.prediction.toPlace()
      await place.fetchFields({ fields: PLACE_FIELDS })
      const next = toPlaceValue(place)
      if (next) onChange(next)
    } catch {
      setError('No se pudo obtener el lugar.')
    } finally {
      tokenRef.current = null
      setQuery('')
      setSuggestions([])
    }
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Este dispositivo no permite obtener la ubicación.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        setError(null)
        onChange({ latitude: position.coords.latitude, longitude: position.coords.longitude })
      },
      () => {
        setLocating(false)
        setError('No se pudo obtener tu ubicación. Revisa el permiso en los ajustes del navegador.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Sin clave de Google: solo se enseña el lugar guardado, si lo hay, como enlace
  if (!isGoogleMapsConfigured) {
    if (!value) return null
    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">Lugar</label>
        <a
          href={googleMapsUrl(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
        >
          <span className="text-xl" aria-hidden>
            📍
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{value.name || 'Sitio del pago'}</span>
            <span className="block text-xs text-sky-800/80">Ver en Google Maps</span>
          </span>
          <span aria-hidden>↗</span>
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700">
        Lugar <span className="font-normal text-gray-400">(opcional)</span>
      </label>

      {value && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div ref={mapDivRef} className="h-48 w-full bg-gray-100" />
          <div className="flex items-start gap-3 p-3">
            <span className="text-xl" aria-hidden>
              📍
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{value.name || 'Ubicación del pago'}</p>
              <p className="text-xs text-gray-500">
                {value.address || `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`}
              </p>
              <a
                href={googleMapsUrl(value)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs font-medium text-sky-700 hover:underline"
              >
                Abrir en Google Maps ↗
              </a>
            </div>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={disabled}
              className="rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            >
              Quitar
            </button>
          </div>
          <p className="border-t border-gray-100 px-3 py-2 text-[11px] text-gray-400">
            Arrastra el pin o toca el mapa para ajustar el punto exacto.
          </p>
        </div>
      )}

      {value && !hasName && nearby.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600">¿Es alguno de estos sitios cercanos?</p>
          <div className="flex flex-wrap gap-2">
            {nearby.map((place) => (
              <button
                key={place.placeId || `${place.latitude},${place.longitude}`}
                type="button"
                onClick={() => onChange(place)}
                disabled={disabled}
                className="max-w-full truncate rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-50"
              >
                {place.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={disabled || !ready}
          placeholder={ready ? (value ? 'Cambiar lugar: busca un comercio o dirección…' : 'Busca un comercio o dirección…') : 'Cargando mapa…'}
          autoComplete="off"
          className="block w-full min-w-0 rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-gray-900 shadow-sm transition-all duration-200 placeholder:text-gray-400 hover:border-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-50"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
            {suggestions.map((suggestion) => (
              <li key={suggestion.key}>
                <button
                  type="button"
                  onClick={() => selectSuggestion(suggestion)}
                  className="block w-full px-4 py-2.5 text-left hover:bg-gray-50"
                >
                  <span className="block truncate text-sm font-medium text-gray-900">{suggestion.main}</span>
                  {suggestion.secondary && <span className="block truncate text-xs text-gray-500">{suggestion.secondary}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={useMyLocation}
        disabled={disabled || locating}
        className="text-sm font-medium text-indigo-600 hover:underline disabled:opacity-50"
      >
        {locating ? 'Obteniendo ubicación…' : '📍 Usar mi ubicación actual'}
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
