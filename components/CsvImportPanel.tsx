'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type FamilyWithMembers = {
  id_family: string
  ds_family: string | null
  members: Array<{
    id_user: string
    ds_user: string | null
    ds_email: string
  }>
}

type CsvRow = {
  fecha: string
  categoria: string
  subcategoria: string
  cantidad: string
  comentario: string
  mes_declarado: string
  personas_afectadas?: string
}

type ImportResult = {
  inserted: number
  errors: Array<{ row: number; error: string; data: CsvRow }>
}

type TransactionTypeOption = {
  id_type: string
  ds_type: string
}

type CsvImportPanelProps = {
  families: FamilyWithMembers[]
  defaultFamilyId?: string | null
  title?: string
}

const REQUIRED_HEADERS = [
  'fecha',
  'categoria',
  'subcategoria',
  'cantidad',
  'comentario',
  'mes_declarado',
]

const HEADER_ALIASES: Record<string, keyof CsvRow> = {
  fecha: 'fecha',
  date: 'fecha',
  categoria: 'categoria',
  category: 'categoria',
  subcategoria: 'subcategoria',
  subcategory: 'subcategoria',
  cantidad: 'cantidad',
  amount: 'cantidad',
  comentario: 'comentario',
  comment: 'comentario',
  'mes declarado': 'mes_declarado',
  mes_declarado: 'mes_declarado',
  mesdeclared: 'mes_declarado',
  personas_afectadas: 'personas_afectadas',
  personas: 'personas_afectadas',
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase()
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let current = ''
  let inQuotes = false

  const pushValue = () => {
    row.push(current)
    current = ''
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      pushValue()
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i++
      }
      pushValue()
      if (row.some(cell => cell.trim() !== '')) {
        rows.push(row)
      }
      row = []
      continue
    }

    current += char
  }

  pushValue()
  if (row.some(cell => cell.trim() !== '')) {
    rows.push(row)
  }

  return rows
}

function downloadTemplate() {
  const header = [
    'fecha',
    'categoria',
    'subcategoria',
    'cantidad',
    'comentario',
    'mes_declarado',
    'personas_afectadas',
  ]
  const sample = [
    '2024-01-10',
    'Alimentación',
    'Supermercado',
    '45.90',
    'Compra semanal',
    '2024-01',
    'conjunta',
  ]
  const csv = `${header.join(',')}\n${sample.join(',')}\n`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'plantilla_migracion.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function CsvImportPanel({
  families,
  defaultFamilyId,
  title = 'Migración CSV',
}: CsvImportPanelProps) {
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>(
    defaultFamilyId || families[0]?.id_family || ''
  )
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [transactionTypes, setTransactionTypes] = useState<TransactionTypeOption[]>([])
  const [selectedTypeId, setSelectedTypeId] = useState<string>('')
  const [rows, setRows] = useState<CsvRow[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [useCsvUsers, setUseCsvUsers] = useState(true)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const currentFamily = useMemo(
    () => families.find(f => f.id_family === selectedFamilyId) || null,
    [families, selectedFamilyId]
  )

  useEffect(() => {
    if (!selectedFamilyId && families.length > 0) {
      setSelectedFamilyId(defaultFamilyId || families[0].id_family)
    }
  }, [families, defaultFamilyId, selectedFamilyId])

  useEffect(() => {
    const loadTypes = async () => {
      const { data, error } = await supabase
        .from('pml_dim_transaction_type')
        .select('id_type, ds_type')
        .order('ds_type', { ascending: true })

      if (!error && data) {
        setTransactionTypes(data)
        if (!selectedTypeId && data.length > 0) {
          const expense = data.find(t => t.ds_type === 'Expense')
          setSelectedTypeId(expense?.id_type || data[0].id_type)
        }
      }
    }

    loadTypes()
  }, [selectedTypeId])

  useEffect(() => {
    if (!currentFamily) return
    const defaultUsers = currentFamily.members.map(m => m.id_user)
    setSelectedUserIds(defaultUsers)
  }, [currentFamily?.id_family])

  const handleFileChange = async (file: File | null) => {
    setRows([])
    setParseError(null)
    setResult(null)

    if (!file) return

    setFileName(file.name)
    const text = await file.text()
    const parsed = parseCsv(text)

    if (parsed.length === 0) {
      setParseError('El CSV está vacío')
      return
    }

    const headerRow = parsed[0].map(normalizeHeader)

    const requiredMissing = REQUIRED_HEADERS.filter(req => {
      return !headerRow.some(h => HEADER_ALIASES[h] === req)
    })

    if (requiredMissing.length > 0) {
      setParseError(`Faltan columnas requeridas: ${requiredMissing.join(', ')}`)
      return
    }

    const dataRows = parsed.slice(1)
    const csvRows: CsvRow[] = dataRows.map((row) => {
      const rowData: Partial<CsvRow> = {}
      headerRow.forEach((header, i) => {
        const key = HEADER_ALIASES[header]
        if (!key) return
        rowData[key] = (row[i] || '').trim()
      })
      return {
        fecha: rowData.fecha || '',
        categoria: rowData.categoria || '',
        subcategoria: rowData.subcategoria || '',
        cantidad: rowData.cantidad || '',
        comentario: rowData.comentario || '',
        mes_declarado: rowData.mes_declarado || '',
        personas_afectadas: rowData.personas_afectadas || '',
      }
    })

    setRows(csvRows)
  }

  const handleImport = async () => {
    setImporting(true)
    setResult(null)
    try {
      const response = await fetch('/api/import-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idFamily: selectedFamilyId,
          idType: selectedTypeId,
          defaultUserIds: selectedUserIds,
          rows,
          useCsvUsers,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Error en la importación')
      }

      setResult(data)
    } catch (err) {
      setResult({
        inserted: 0,
        errors: [
          {
            row: 0,
            error: err instanceof Error ? err.message : 'Error desconocido',
            data: {
              fecha: '',
              categoria: '',
              subcategoria: '',
              cantidad: '',
              comentario: '',
              mes_declarado: '',
              personas_afectadas: '',
            },
          },
        ],
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-1">
          Importa transacciones desde CSV y crea relaciones por persona automáticamente.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Familia
          </label>
          <select
            value={selectedFamilyId}
            onChange={(e) => setSelectedFamilyId(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#90EBD6]"
          >
            {families.map(f => (
              <option key={f.id_family} value={f.id_family}>
                {f.ds_family || 'Sin nombre'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Tipo de transacción
          </label>
          <select
            value={selectedTypeId}
            onChange={(e) => setSelectedTypeId(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#90EBD6]"
          >
            {transactionTypes.map(t => (
              <option key={t.id_type} value={t.id_type}>
                {t.ds_type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentFamily && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Personas afectadas (por defecto)
          </label>
          <div className="flex flex-wrap gap-2">
            {currentFamily.members.map(m => (
              <label
                key={m.id_user}
                className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(m.id_user)}
                  onChange={(e) => {
                    setSelectedUserIds(prev =>
                      e.target.checked
                        ? [...prev, m.id_user]
                        : prev.filter(id => id !== m.id_user)
                    )
                  }}
                />
                <span>{m.ds_user || m.ds_email}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-700 flex items-center gap-2">
          <input
            type="checkbox"
            checked={useCsvUsers}
            onChange={(e) => setUseCsvUsers(e.target.checked)}
          />
          Usar columna "personas_afectadas" si existe en el CSV
        </label>
        <button
          type="button"
          onClick={downloadTemplate}
          className="text-sm text-[#0d9488] hover:underline"
        >
          Descargar plantilla
        </button>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          CSV (fecha, categoria, subcategoria, cantidad, comentario, mes_declarado)
        </label>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
        />
        {fileName && (
          <p className="text-xs text-gray-500 mt-1">Archivo: {fileName}</p>
        )}
        {parseError && (
          <p className="text-sm text-red-600 mt-2">{parseError}</p>
        )}
      </div>

      {rows.length > 0 && (
        <div className="border rounded-xl p-4 bg-gray-50">
          <p className="text-sm text-gray-700 mb-2">
            Filas detectadas: <strong>{rows.length}</strong>
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-gray-700">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-3">Fecha</th>
                  <th className="text-left py-2 pr-3">Categoría</th>
                  <th className="text-left py-2 pr-3">Subcategoría</th>
                  <th className="text-left py-2 pr-3">Cantidad</th>
                  <th className="text-left py-2 pr-3">Mes declarado</th>
                  <th className="text-left py-2 pr-3">Personas</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2 pr-3">{r.fecha}</td>
                    <td className="py-2 pr-3">{r.categoria}</td>
                    <td className="py-2 pr-3">{r.subcategoria}</td>
                    <td className="py-2 pr-3">{r.cantidad}</td>
                    <td className="py-2 pr-3">{r.mes_declarado}</td>
                    <td className="py-2 pr-3">{r.personas_afectadas || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 5 && (
            <p className="text-xs text-gray-500 mt-2">
              Mostrando 5 filas de {rows.length}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          disabled={importing || rows.length === 0 || !selectedFamilyId || !selectedTypeId}
          onClick={handleImport}
          className="px-4 py-3 rounded-xl bg-[#90EBD6] text-[#0d9488] font-semibold disabled:opacity-50"
        >
          {importing ? 'Importando...' : 'Importar CSV'}
        </button>
      </div>

      {result && (
        <div className="mt-4">
          <p className="text-sm text-gray-700">
            Insertadas: <strong>{result.inserted}</strong>
          </p>
          {result.errors.length > 0 && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700 font-semibold mb-2">
                Errores ({result.errors.length})
              </p>
              <ul className="text-xs text-red-700 space-y-1">
                {result.errors.slice(0, 5).map((e, idx) => (
                  <li key={idx}>
                    Fila {e.row}: {e.error}
                  </li>
                ))}
              </ul>
              {result.errors.length > 5 && (
                <p className="text-xs text-red-600 mt-2">
                  Mostrando 5 de {result.errors.length}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
