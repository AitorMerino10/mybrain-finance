-- Script para borrar todos los registros de las tablas de transacciones
-- ⚠️ ADVERTENCIA CRÍTICA: Este script borrará TODOS los datos de estas tablas
-- ⚠️ Asegúrate de haber ejecutado primero: scripts/add-unique-ids-to-relations.sql
-- Ejecutar en Supabase SQL Editor

-- ============================================
-- ORDEN DE BORRADO (respetando foreign keys)
-- ============================================

-- 1. Borrar primero las relaciones (tablas dependientes)
DELETE FROM pml_rel_transaction_user;
DELETE FROM pml_rel_transaction_tag;

-- 2. Borrar las transacciones principales
DELETE FROM gnp_fct_transactions;

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar que las tablas están vacías
SELECT 
  'pml_rel_transaction_user' as tabla,
  COUNT(*) as registros_restantes 
FROM pml_rel_transaction_user
UNION ALL
SELECT 
  'pml_rel_transaction_tag' as tabla,
  COUNT(*) as registros_restantes 
FROM pml_rel_transaction_tag
UNION ALL
SELECT 
  'gnp_fct_transactions' as tabla,
  COUNT(*) as registros_restantes 
FROM gnp_fct_transactions;

-- Si todos los conteos son 0, las tablas están vacías correctamente
