'use client'

import { useState, useEffect } from 'react'

export default function TestConnection() {
  const [message, setMessage] = useState<string>('')
  const [transactionTypeCount, setTransactionTypeCount] = useState<number | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)

  // Asegurar que estamos en el cliente
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Cargar el conteo de transaction types al montar el componente
  useEffect(() => {
    if (!isClient) return

    const fetchTransactionTypeCount = async () => {
      try {
        // Verificar primero las variables de entorno directamente
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        console.log('Verificando variables de entorno...')
        console.log('URL presente:', !!supabaseUrl, supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'NO')
        console.log('KEY presente:', !!supabaseKey, supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'NO')

        if (!supabaseUrl || !supabaseKey) {
          setError(
            `Variables de entorno no configuradas.\n\n` +
            `URL: ${supabaseUrl ? '✓' : '✗'}\n` +
            `KEY: ${supabaseKey ? '✓' : '✗'}\n\n` +
            `Asegúrate de que tu archivo .env.local tenga:\n` +
            `NEXT_PUBLIC_SUPABASE_URL=tu_url\n` +
            `NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave\n\n` +
            `Y reinicia el servidor de desarrollo (Ctrl+C y luego npm run dev)`
          )
          return
        }

        // Importar dinámicamente para evitar errores en el servidor
        const { supabase } = await import('@/lib/supabase')

        const { count, error: queryError } = await supabase
          .from('pml_dim_transaction_type')
          .select('*', { count: 'exact', head: true })

        if (queryError) {
          console.error('Error al contar transaction types:', queryError)
          setError(`Error al contar: ${queryError.message}`)
        } else {
          setTransactionTypeCount(count || 0)
        }
      } catch (err) {
        console.error('Error inesperado:', err)
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(
          `Error inesperado: ${errorMessage}\n\n` +
          `Si el error dice "supabaseUrl is required", significa que las variables de entorno no se están leyendo.\n` +
          `Por favor:\n` +
          `1. Verifica que .env.local esté en la raíz del proyecto\n` +
          `2. Verifica que no haya espacios alrededor del =\n` +
          `3. Reinicia el servidor de desarrollo completamente`
        )
      }
    }

    fetchTransactionTypeCount()
  }, [isClient])

  const handleCreateFamily = async () => {
    setLoading(true)
    setMessage('')

    try {
      const { supabase } = await import('@/lib/supabase')
      
      const { data, error } = await supabase
        .from('pml_dim_family')
        .insert([{ ds_family: 'Familia Merino Diaz' }])
        .select()

      if (error) {
        setMessage(`Error: ${error.message}`)
        console.error('Error al crear familia:', error)
      } else {
        setMessage('Conexión Exitosa: Familia Creada')
        console.log('Familia creada:', data)
      }
    } catch (err) {
      setMessage(`Error inesperado: ${err instanceof Error ? err.message : String(err)}`)
      console.error('Error inesperado:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isClient) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">Cargando...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-3xl font-bold text-red-600">Error de Configuración</h1>
        <div className="rounded-lg border border-red-300 bg-red-50 p-6 shadow-md max-w-2xl">
          <p className="text-lg font-semibold text-red-800 whitespace-pre-line">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">Prueba de Conexión con Supabase</h1>
      
      <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-md">
        <h2 className="mb-4 text-xl font-semibold">Estado de la Conexión</h2>
        
        <div className="mb-6">
          <p className="text-lg">
            Registros en <code className="rounded bg-gray-100 px-2 py-1">pml_dim_transaction_type</code>:
            {transactionTypeCount !== null ? (
              <span className="ml-2 font-bold text-blue-600">{transactionTypeCount}</span>
            ) : (
              <span className="ml-2 text-gray-500">Cargando...</span>
            )}
          </p>
        </div>

        <button
          onClick={handleCreateFamily}
          disabled={loading}
          className="rounded bg-blue-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Creando...' : 'Crear Familia de Prueba'}
        </button>

        {message && (
          <div
            className={`mt-4 rounded p-4 ${
              message.includes('Exitosa')
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            <p className="font-medium">{message}</p>
          </div>
        )}
      </div>
    </div>
  )
}

