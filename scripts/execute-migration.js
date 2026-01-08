/**
 * Script para ejecutar la migración completa
 * Ejecuta SQL directamente en Supabase usando fetch
 */

require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Faltan variables de entorno')
  process.exit(1)
}

async function executeSQL(sql) {
  // Extraer el project ID de la URL
  const projectId = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1]
  
  if (!projectId) {
    throw new Error('No se pudo extraer el project ID de la URL')
  }

  // Usar la API de Management de Supabase para ejecutar SQL
  // Esto requiere autenticación con el access token
  console.log('📝 Intentando ejecutar SQL usando la API de Supabase...\n')
  
  // Nota: La API de Management requiere un access token diferente
  // Por ahora, vamos a mostrar el SQL para que se ejecute manualmente
  
  console.log('⚠️  La ejecución directa de DDL requiere permisos especiales')
  console.log('📋 Por favor, ejecuta este SQL en el SQL Editor de Supabase:\n')
  console.log('─'.repeat(70))
  console.log(sql)
  console.log('─'.repeat(70))
  console.log('\n💡 Pasos:')
  console.log('   1. Ve a tu proyecto en Supabase Dashboard')
  console.log('   2. Abre "SQL Editor" en el menú lateral')
  console.log('   3. Pega el SQL de arriba')
  console.log('   4. Haz clic en "Run" o presiona Ctrl+Enter\n')
}

async function main() {
  console.log('🔄 Ejecutando migración: Añadir IDs únicos\n')
  
  const sqlPath = path.join(__dirname, 'add-unique-ids-to-relations.sql')
  const sql = fs.readFileSync(sqlPath, 'utf-8')
  
  await executeSQL(sql)
  
  console.log('✅ Una vez ejecutado el SQL, puedes continuar con el borrado de datos')
  console.log('   Ejecuta: node scripts/migrate-delete-transactions.js\n')
}

main().catch(console.error)

