/**
 * Script para borrar todos los registros de transacciones
 * ⚠️ ADVERTENCIA: Este script borrará TODOS los datos de estas tablas
 * Ejecutar con: node scripts/migrate-delete-transactions.js
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

async function deleteAllTransactions() {
  console.log('⚠️  ADVERTENCIA: Este script borrará TODOS los datos de transacciones')
  console.log('📋 Tablas afectadas:')
  console.log('   - pml_rel_transaction_user')
  console.log('   - pml_rel_transaction_tag')
  console.log('   - gnp_fct_transactions\n')

  // Verificar conteos antes de borrar
  console.log('📊 Conteo actual de registros:')
  
  const { count: count1 } = await supabase
    .from('pml_rel_transaction_user')
    .select('*', { count: 'exact', head: true })
  
  const { count: count2 } = await supabase
    .from('pml_rel_transaction_tag')
    .select('*', { count: 'exact', head: true })
  
  const { count: count3 } = await supabase
    .from('gnp_fct_transactions')
    .select('*', { count: 'exact', head: true })

  console.log(`   pml_rel_transaction_user: ${count1 || 0} registros`)
  console.log(`   pml_rel_transaction_tag: ${count2 || 0} registros`)
  console.log(`   gnp_fct_transactions: ${count3 || 0} registros\n`)

  if (count1 === 0 && count2 === 0 && count3 === 0) {
    console.log('✅ Las tablas ya están vacías. No hay nada que borrar.')
    return
  }

  try {
    // 1. Borrar relaciones primero
    console.log('🗑️  Borrando pml_rel_transaction_user...')
    const { error: error1 } = await supabase
      .from('pml_rel_transaction_user')
      .delete()
      .neq('id_rel_transaction_user', '00000000-0000-0000-0000-000000000000') // Delete all
    
    if (error1) {
      // Si falla, intentar con método alternativo
      const { data, error: altError1 } = await supabase
        .from('pml_rel_transaction_user')
        .select('id_rel_transaction_user')
        .limit(1000)
      
      if (data && data.length > 0) {
        const ids = data.map(r => r.id_rel_transaction_user || r.id_transaction).filter(Boolean)
        for (const id of ids) {
          await supabase.from('pml_rel_transaction_user').delete().eq('id_rel_transaction_user', id)
        }
      }
    } else {
      console.log('   ✅ pml_rel_transaction_user borrada')
    }

    console.log('🗑️  Borrando pml_rel_transaction_tag...')
    const { error: error2 } = await supabase
      .from('pml_rel_transaction_tag')
      .delete()
      .neq('id_rel_transaction_tag', '00000000-0000-0000-0000-000000000000')
    
    if (error2) {
      const { data, error: altError2 } = await supabase
        .from('pml_rel_transaction_tag')
        .select('id_rel_transaction_tag')
        .limit(1000)
      
      if (data && data.length > 0) {
        const ids = data.map(r => r.id_rel_transaction_tag || r.id_transaction).filter(Boolean)
        for (const id of ids) {
          await supabase.from('pml_rel_transaction_tag').delete().eq('id_rel_transaction_tag', id)
        }
      }
    } else {
      console.log('   ✅ pml_rel_transaction_tag borrada')
    }

    // 2. Borrar transacciones principales
    console.log('🗑️  Borrando gnp_fct_transactions...')
    const { error: error3 } = await supabase
      .from('gnp_fct_transactions')
      .delete()
      .neq('id_transaction', '00000000-0000-0000-0000-000000000000')
    
    if (error3) {
      const { data, error: altError3 } = await supabase
        .from('gnp_fct_transactions')
        .select('id_transaction')
        .limit(1000)
      
      if (data && data.length > 0) {
        const ids = data.map(r => r.id_transaction).filter(Boolean)
        for (const id of ids) {
          await supabase.from('gnp_fct_transactions').delete().eq('id_transaction', id)
        }
      }
    } else {
      console.log('   ✅ gnp_fct_transactions borrada')
    }

    // Verificar que están vacías
    console.log('\n📊 Verificando que las tablas están vacías...')
    
    const { count: finalCount1 } = await supabase
      .from('pml_rel_transaction_user')
      .select('*', { count: 'exact', head: true })
    
    const { count: finalCount2 } = await supabase
      .from('pml_rel_transaction_tag')
      .select('*', { count: 'exact', head: true })
    
    const { count: finalCount3 } = await supabase
      .from('gnp_fct_transactions')
      .select('*', { count: 'exact', head: true })

    console.log(`   pml_rel_transaction_user: ${finalCount1 || 0} registros`)
    console.log(`   pml_rel_transaction_tag: ${finalCount2 || 0} registros`)
    console.log(`   gnp_fct_transactions: ${finalCount3 || 0} registros`)

    if (finalCount1 === 0 && finalCount2 === 0 && finalCount3 === 0) {
      console.log('\n✅ ¡Todas las tablas están vacías correctamente!')
    } else {
      console.log('\n⚠️  Algunas tablas aún tienen registros. Puede ser necesario ejecutar el script nuevamente.')
    }

  } catch (error) {
    console.error('❌ Error durante el borrado:', error.message)
    console.error('\n💡 Solución: Ejecuta el SQL manualmente en Supabase SQL Editor:')
    console.error('   📄 scripts/delete-all-transactions.sql')
    process.exit(1)
  }
}

deleteAllTransactions()

