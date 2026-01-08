/**
 * Script para añadir IDs únicos a las tablas de relación
 * Este script ejecuta SQL directamente en Supabase usando la API REST
 * Ejecutar con: node scripts/migrate-add-unique-ids.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Faltan variables de entorno')
  console.error('Necesitas NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function executeSQL(sql) {
  // Usar la API REST de Supabase para ejecutar SQL
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({ query: sql })
  })

  if (!response.ok) {
    // Si no existe la función RPC, intentar método alternativo
    throw new Error(`SQL execution failed: ${response.statusText}`)
  }

  return await response.json()
}

async function addUniqueIds() {
  console.log('🔄 Iniciando migración: Añadir IDs únicos a tablas de relación...\n')

  try {
    // Para ejecutar ALTER TABLE necesitamos usar el SQL Editor de Supabase
    // o crear una función RPC. Por ahora, vamos a verificar y guiar al usuario
    
    console.log('📝 Verificando estructura actual de las tablas...\n')

    // Verificar pml_rel_transaction_user
    const { data: userData, error: userError } = await supabase
      .from('pml_rel_transaction_user')
      .select('*')
      .limit(1)

    if (userError && userError.message.includes('column') && userError.message.includes('does not exist')) {
      console.log('⚠️  La tabla pml_rel_transaction_user necesita la columna id_rel_transaction_user')
    } else {
      // Intentar leer la columna
      const testQuery = await supabase
        .from('pml_rel_transaction_user')
        .select('id_rel_transaction_user')
        .limit(1)
      
      if (testQuery.error && testQuery.error.message.includes('does not exist')) {
        console.log('❌ La columna id_rel_transaction_user NO existe en pml_rel_transaction_user')
        console.log('   Necesitas ejecutar el SQL manualmente en Supabase SQL Editor\n')
      } else {
        console.log('✅ La columna id_rel_transaction_user ya existe en pml_rel_transaction_user')
      }
    }

    // Verificar pml_rel_transaction_tag
    const { data: tagData, error: tagError } = await supabase
      .from('pml_rel_transaction_tag')
      .select('*')
      .limit(1)

    if (tagError && tagError.message.includes('column') && tagError.message.includes('does not exist')) {
      console.log('⚠️  La tabla pml_rel_transaction_tag necesita la columna id_rel_transaction_tag')
    } else {
      const testQuery2 = await supabase
        .from('pml_rel_transaction_tag')
        .select('id_rel_transaction_tag')
        .limit(1)
      
      if (testQuery2.error && testQuery2.error.message.includes('does not exist')) {
        console.log('❌ La columna id_rel_transaction_tag NO existe en pml_rel_transaction_tag')
        console.log('   Necesitas ejecutar el SQL manualmente en Supabase SQL Editor\n')
      } else {
        console.log('✅ La columna id_rel_transaction_tag ya existe en pml_rel_transaction_tag')
      }
    }

    console.log('\n📋 Para añadir las columnas, ejecuta este SQL en Supabase SQL Editor:')
    console.log('   📄 scripts/add-unique-ids-to-relations.sql\n')

    console.log('💡 Alternativa: Puedo crear una función RPC en Supabase para ejecutarlo automáticamente.')
    console.log('   ¿Quieres que lo haga? (Esto requiere permisos de administrador)\n')

  } catch (error) {
    console.error('❌ Error durante la verificación:', error.message)
    console.error('\n💡 Solución: Ejecuta el SQL manualmente en Supabase SQL Editor:')
    console.error('   📄 scripts/add-unique-ids-to-relations.sql')
  }
}

addUniqueIds()
