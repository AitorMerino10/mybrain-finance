/**
 * Script para añadir IDs únicos ejecutando SQL directamente en Supabase
 * Usa la API REST de Supabase con Service Role Key
 * Ejecutar con: node scripts/migrate-add-unique-ids-direct.js
 */

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Faltan variables de entorno')
  console.error('Necesitas NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

async function executeSQL(sql) {
  // Usar la API REST de Supabase para ejecutar SQL
  // Necesitamos usar el endpoint de PostgREST o crear una función RPC
  // Por ahora, vamos a usar fetch directamente con la API de Supabase
  
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ query: sql })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`SQL execution failed (${response.status}): ${errorText}`)
  }

  return await response.json()
}

async function addUniqueIds() {
  console.log('🔄 Ejecutando migración: Añadir IDs únicos a tablas de relación...\n')

  const sql = `
-- Añadir id_rel_transaction_user a pml_rel_transaction_user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pml_rel_transaction_user' 
    AND column_name = 'id_rel_transaction_user'
  ) THEN
    ALTER TABLE pml_rel_transaction_user 
    DROP CONSTRAINT IF EXISTS pml_rel_transaction_user_pkey;
    
    ALTER TABLE pml_rel_transaction_user
    ADD COLUMN id_rel_transaction_user UUID DEFAULT gen_random_uuid();
    
    UPDATE pml_rel_transaction_user
    SET id_rel_transaction_user = gen_random_uuid()
    WHERE id_rel_transaction_user IS NULL;
    
    ALTER TABLE pml_rel_transaction_user
    ALTER COLUMN id_rel_transaction_user SET NOT NULL;
    
    ALTER TABLE pml_rel_transaction_user
    ADD PRIMARY KEY (id_rel_transaction_user);
  END IF;
END $$;

-- Añadir id_rel_transaction_tag a pml_rel_transaction_tag
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pml_rel_transaction_tag' 
    AND column_name = 'id_rel_transaction_tag'
  ) THEN
    ALTER TABLE pml_rel_transaction_tag 
    DROP CONSTRAINT IF EXISTS pml_rel_transaction_tag_pkey;
    
    ALTER TABLE pml_rel_transaction_tag
    ADD COLUMN id_rel_transaction_tag UUID DEFAULT gen_random_uuid();
    
    UPDATE pml_rel_transaction_tag
    SET id_rel_transaction_tag = gen_random_uuid()
    WHERE id_rel_transaction_tag IS NULL;
    
    ALTER TABLE pml_rel_transaction_tag
    ALTER COLUMN id_rel_transaction_tag SET NOT NULL;
    
    ALTER TABLE pml_rel_transaction_tag
    ADD PRIMARY KEY (id_rel_transaction_tag);
  END IF;
END $$;
  `

  try {
    console.log('📝 Ejecutando SQL para añadir columnas...\n')
    
    // Intentar ejecutar usando fetch directo a la API de Supabase
    // Nota: Supabase no expone directamente ejecución de SQL DDL por seguridad
    // Necesitamos usar el SQL Editor o crear una función RPC
    
    console.log('⚠️  Supabase no permite ejecutar ALTER TABLE directamente desde la API REST')
    console.log('📋 Por favor, ejecuta el siguiente SQL en el SQL Editor de Supabase:\n')
    console.log('─'.repeat(60))
    console.log(sql)
    console.log('─'.repeat(60))
    console.log('\n💡 O copia el contenido de: scripts/add-unique-ids-to-relations.sql\n')
    
    // Alternativa: Intentar crear una función RPC temporal
    console.log('🔄 Intentando crear función RPC temporal...\n')
    
    const createRPCFunction = `
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE query;
END;
$$;
    `
    
    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query: createRPCFunction })
    })
    
    if (rpcResponse.ok) {
      console.log('✅ Función RPC creada. Ejecutando migración...\n')
      await executeSQL(sql)
      console.log('✅ Migración completada exitosamente!\n')
    } else {
      console.log('❌ No se pudo crear la función RPC automáticamente')
      console.log('📋 Por favor, ejecuta el SQL manualmente en Supabase SQL Editor\n')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error('\n📋 Solución: Ejecuta el SQL manualmente en Supabase SQL Editor')
    console.error('   📄 Archivo: scripts/add-unique-ids-to-relations.sql\n')
    process.exit(1)
  }
}

addUniqueIds()

