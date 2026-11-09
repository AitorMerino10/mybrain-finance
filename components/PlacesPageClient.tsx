'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchCalculatorTransactions, formatMoney, type CalcTransaction } from '@/lib/budget-calculator'
import { getTodayISOString } from '@/lib/date-utils'
import { googleMapsUrl } from '@/lib/places'
import { isGoogleMapsConfigured, loadGoogleMaps } from '@/lib/google-maps'
import { categoryStyle } from '@/lib/category-style'

type Period = 'month' | '3months' | 'year' | 'all'

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'month', label: 'Este mes' },
  { key: '3months', label: '3 meses' },
  { key: 'year', label: 'Este año' },
  { key: 'all', label: 'Todo' },
]

type PlaceGroup = {
  key: string
  name: string
  latitude: number
  longitude: number
  placeId: string | null
  count: number
  total: number
  lastDate: string
  transactions: CalcTransaction[]
  /** Vertical que más pesa en este sitio (da el color y el emoji del pin) */
  idCategory: string | null
  categoryName: string
}

type Located = CalcTransaction & { ft_latitude: number; ft_longitude: number }

function periodStart(period: Period, today: string): string | null {
  if (period === 'all') return null
  const [year, month] = today.split('-').map(Number)
  if (period === 'month') return `${today.slice(0, 7)}-01`
  if (period === 'year') return `${year}-01-01`
  const date = new Date(Date.UTC(year, month - 1 - 2, 1))
  return date.toISOString().slice(0, 10)
}

function groupByPlace(transactions: Located[]): PlaceGroup[] {
  const groups = new Map<string, PlaceGroup & { names: Map<string, number>; latSum: number; lngSum: number; byCategory: Map<string, { name: string; total: number }> }>()
  for (const tx of transactions) {
    // Mismo lugar: mismo identificador de Google o, si no, el mismo punto redondeado (~100 m)
    const key = tx.ds_place_id ? `id:${tx.ds_place_id}` : `pt:${tx.ft_latitude.toFixed(3)},${tx.ft_longitude.toFixed(3)}`
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        name: '',
        latitude: 0,
        longitude: 0,
        placeId: tx.ds_place_id ?? null,
        count: 0,
        total: 0,
        lastDate: '',
        transactions: [],
        idCategory: null,
        categoryName: '',
        byCategory: new Map(),
        names: new Map(),
        latSum: 0,
        lngSum: 0,
      }
      groups.set(key, group)
    }
    group.count += 1
    group.total += tx.ft_amount
    group.latSum += tx.ft_latitude
    group.lngSum += tx.ft_longitude
    if (tx.dt_date > group.lastDate) group.lastDate = tx.dt_date
    group.transactions.push(tx)
    const catKey = tx.id_category || 'none'
    const catEntry = group.byCategory.get(catKey) || { name: tx.ds_category, total: 0 }
    catEntry.total += tx.ft_amount
    group.byCategory.set(catKey, catEntry)
    const label = tx.ds_place_name || tx.ds_comments?.trim() || ''
    if (label) group.names.set(label, (group.names.get(label) || 0) + 1)
  }

  return Array.from(groups.values())
    .map((group) => {
      const bestName = Array.from(group.names.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
      const { names, latSum, lngSum, byCategory, ...rest } = group
      void names
      const [mainKey, main] = Array.from(byCategory.entries()).sort((a, b) => b[1].total - a[1].total)[0]
      return {
        ...rest,
        idCategory: mainKey === 'none' ? null : mainKey,
        categoryName: main.name,
        name: bestName || 'Sitio sin nombre',
        latitude: latSum / group.count,
        longitude: lngSum / group.count,
        transactions: [...group.transactions].sort((a, b) => b.dt_date.localeCompare(a.dt_date)),
      }
    })
    .sort((a, b) => b.total - a.total)
}

function shortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PlacesPageClient({ idFamily }: { idFamily: string }) {
  const today = getTodayISOString()
  const [transactions, setTransactions] = useState<CalcTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('month')
  const [categoryId, setCategoryId] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map())
  const hasFittedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetchCalculatorTransactions(idFamily)
      .then((rows) => !cancelled && setTransactions(rows))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'No se pudieron cargar los gastos'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [idFamily])

  const expenses = useMemo(() => transactions.filter((tx) => tx.type === 'Expense'), [transactions])

  const categories = useMemo(() => {
    const map = new Map<string, string>()
    expenses.forEach((tx) => tx.id_category && map.set(tx.id_category, tx.ds_category))
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [expenses])

  const filtered = useMemo(() => {
    const from = periodStart(period, today)
    return expenses.filter((tx) => (!from || tx.dt_date >= from) && (!categoryId || tx.id_category === categoryId))
  }, [expenses, period, categoryId, today])

  const located = useMemo(
    () => filtered.filter((tx): tx is Located => tx.ft_latitude != null && tx.ft_longitude != null),
    [filtered]
  )
  const groups = useMemo(() => groupByPlace(located), [located])
  const withoutPlace = filtered.length - located.length
  // Leyenda: las verticales que aparecen en el mapa, con el gasto de cada una
  const legend = useMemo(() => {
    const from = periodStart(period, today)
    const map = new Map<string, { id: string; name: string; total: number }>()
    expenses.forEach((tx) => {
      if (!tx.id_category || tx.ft_latitude == null || tx.ft_longitude == null || (from && tx.dt_date < from)) return
      const entry = map.get(tx.id_category) || { id: tx.id_category, name: tx.ds_category, total: 0 }
      entry.total += tx.ft_amount
      map.set(tx.id_category, entry)
    })
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .map((item) => ({ ...item, ...categoryStyle(item.id, item.name) }))
  }, [expenses, period, today])
  const totalLocated = located.reduce((sum, tx) => sum + tx.ft_amount, 0)
  const selected = groups.find((group) => group.key === selectedKey) || null

  // Cargar Google Maps y crear el mapa
  useEffect(() => {
    if (!isGoogleMapsConfigured) {
      setMapError('Falta configurar la clave de Google Maps.')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        await loadGoogleMaps()
        const { Map } = await google.maps.importLibrary('maps')
        await google.maps.importLibrary('marker')
        if (cancelled || !mapDivRef.current) return
        mapRef.current = new Map(mapDivRef.current, {
          center: { lat: 40.4168, lng: -3.7038 },
          zoom: 5,
          mapId: 'DEMO_MAP_ID',
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
        })
        setMapReady(true)
      } catch (err) {
        if (!cancelled) setMapError(err instanceof Error ? err.message : 'No se pudo mostrar el mapa')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Pintar un marcador por sitio
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    let cancelled = false
    ;(async () => {
      const { AdvancedMarkerElement } = await google.maps.importLibrary('marker')
      if (cancelled) return
      markersRef.current.forEach((marker) => {
        marker.map = null
      })
      markersRef.current.clear()

      const maxTotal = Math.max(1, ...groups.map((group) => group.total))
      const bounds = new google.maps.LatLngBounds()
      groups.forEach((group) => {
        const size = 30 + Math.round((group.total / maxTotal) * 16)
        const style = categoryStyle(group.idCategory, group.categoryName)
        const content = document.createElement('div')
        content.dataset.key = group.key
        content.title = `${group.name} · ${formatMoney(group.total)}`
        content.style.cssText = `position:relative;width:${size}px;height:${Math.round(size * 1.22)}px;cursor:pointer;transform-origin:50% 100%;transition:transform .15s`
        const pin = document.createElement('div')
        pin.style.cssText = `position:absolute;top:0;left:0;width:${size}px;height:${size}px;background:${style.color};border:2.5px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,.35)`
        const emoji = document.createElement('div')
        emoji.textContent = style.emoji
        emoji.style.cssText = `position:absolute;top:0;left:0;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.52)}px;line-height:1`
        content.append(pin, emoji)
        if (group.count > 1) {
          const badge = document.createElement('div')
          badge.textContent = String(group.count)
          badge.style.cssText = `position:absolute;top:-5px;right:-7px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border-radius:9999px;background:#12222E;color:#fff;border:1.5px solid #fff;display:flex;align-items:center;justify-content:center;font:700 10px system-ui,sans-serif`
          content.append(badge)
        }
        const marker = new AdvancedMarkerElement({ map, position: { lat: group.latitude, lng: group.longitude }, content, title: group.name })
        marker.addListener('click', () => setSelectedKey(group.key))
        markersRef.current.set(group.key, marker)
        bounds.extend({ lat: group.latitude, lng: group.longitude })
      })

      if (groups.length > 0) {
        if (groups.length === 1) {
          map.setCenter({ lat: groups[0].latitude, lng: groups[0].longitude })
          map.setZoom(15)
        } else {
          map.fitBounds(bounds, 48)
        }
        hasFittedRef.current = true
      }
    })()
    return () => {
      cancelled = true
    }
  }, [groups, mapReady])

  // Resaltar y centrar el sitio elegido
  useEffect(() => {
    markersRef.current.forEach((marker, key) => {
      const element = marker.content as HTMLElement | null
      if (!element) return
      const active = key === selectedKey
      element.style.transform = active ? 'scale(1.3)' : 'scale(1)'
      marker.zIndex = active ? 10 : 1
    })
    if (selected && mapRef.current) {
      mapRef.current.panTo({ lat: selected.latitude, lng: selected.longitude })
      if ((mapRef.current.getZoom() ?? 0) < 14) mapRef.current.setZoom(15)
    }
  }, [selectedKey, selected])

  // Si el sitio elegido desaparece con los filtros, se deselecciona
  useEffect(() => {
    if (selectedKey && !groups.some((group) => group.key === selectedKey)) setSelectedKey(null)
  }, [groups, selectedKey])

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors touch-manipulation ${
      active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
    }`

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center gap-3 sm:mb-6">
        <Link href={`/analytics?family=${idFamily}`} className="lg:hidden -ml-2 p-2 text-gray-600 hover:text-gray-900 touch-manipulation" aria-label="Volver">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">📍 Mapa de gastos</h1>
          <p className="text-sm text-slate-500 sm:text-base">Dónde gastas y cuánto en cada sitio.</p>
        </div>
      </div>

      <div className="mb-4 space-y-3">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            {PERIODS.map((item) => (
              <button key={item.key} onClick={() => setPeriod(item.key)} className={chip(period === item.key)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {categories.length > 0 && (
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 sm:w-72"
            aria-label="Categoría"
          >
            <option value="">Todas las categorías</option>
            {categories.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      {legend.length > 1 && (
        <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
            {legend.map((item) => {
              const active = categoryId === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setCategoryId(active ? '' : item.id)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors touch-manipulation ${
                    active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px]" style={{ background: item.color }}>
                    {item.emoji}
                  </span>
                  {item.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
        <div className="lg:col-span-3">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
            <div ref={mapDivRef} className="h-[340px] w-full sm:h-[460px] lg:h-[560px]" />
            {mapError && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50 p-6 text-center text-sm text-slate-500">{mapError}</div>
            )}
            {!mapError && !loading && groups.length === 0 && (
              <div className="pointer-events-none absolute inset-x-4 top-4 rounded-xl bg-white/95 p-3 text-center text-sm text-slate-600 shadow">
                No hay gastos con ubicación en este periodo. Se guardan al pagar con el móvil o al elegir un sitio en el formulario.
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {loading
              ? 'Cargando gastos…'
              : `${located.length} ${located.length === 1 ? 'gasto' : 'gastos'} con ubicación (${formatMoney(totalLocated)})${
                  withoutPlace > 0 ? ` · ${withoutPlace} sin ubicación` : ''
                }. Cada color y emoji es una vertical; el número, las veces que has ido; el tamaño, lo que has gastado.`}
          </p>
        </div>

        <div className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Gastos por sitio</h2>
          {groups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              {loading ? 'Cargando…' : 'Sin sitios que mostrar.'}
            </p>
          ) : (
            <ul className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {groups.map((group) => {
                const active = group.key === selectedKey
                return (
                  <li key={group.key} className={`rounded-xl border bg-white transition-colors ${active ? 'border-[#2FB394] ring-1 ring-[#2FB394]' : 'border-slate-200'}`}>
                    <button onClick={() => setSelectedKey(active ? null : group.key)} className="w-full px-4 py-3 text-left touch-manipulation">
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base"
                          style={{ background: categoryStyle(group.idCategory, group.categoryName).color }}
                          title={group.categoryName}
                        >
                          {categoryStyle(group.idCategory, group.categoryName).emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{group.name}</p>
                          <p className="text-xs text-slate-500">
                            {group.count} {group.count === 1 ? 'vez' : 'veces'} · media {formatMoney(group.total / group.count, 2)} · última {shortDate(group.lastDate)}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatMoney(group.total, 2)}</p>
                      </div>
                    </button>
                    {active && (
                      <div className="border-t border-slate-100 px-4 py-3">
                        <ul className="space-y-1.5">
                          {group.transactions.slice(0, 8).map((tx) => (
                            <li key={tx.id_transaction} className="flex items-center justify-between gap-3 text-xs text-slate-600">
                              <span className="min-w-0 truncate">
                                {shortDate(tx.dt_date)} · {tx.ds_comments || tx.ds_subcategory || tx.ds_category}
                              </span>
                              <span className="shrink-0 font-medium tabular-nums text-slate-900">{formatMoney(tx.ft_amount, 2)}</span>
                            </li>
                          ))}
                        </ul>
                        {group.transactions.length > 8 && <p className="mt-1 text-xs text-slate-400">y {group.transactions.length - 8} más…</p>}
                        <a
                          href={googleMapsUrl(group)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-xs font-medium text-slate-600 underline hover:text-slate-900"
                        >
                          Abrir en Google Maps
                        </a>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
