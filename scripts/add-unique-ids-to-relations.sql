-- Script para añadir IDs únicos a las tablas de relación
-- Ejecutar en Supabase SQL Editor
-- ⚠️ IMPORTANTE: Ejecutar este script ANTES de borrar los datos

-- ============================================
-- 1. TABLA: pml_rel_transaction_user
-- ============================================

-- Verificar si ya existe la columna
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pml_rel_transaction_user' 
    AND column_name = 'id_rel_transaction_user'
  ) THEN
    -- Eliminar constraint de clave primaria existente si existe
    ALTER TABLE pml_rel_transaction_user 
    DROP CONSTRAINT IF EXISTS pml_rel_transaction_user_pkey;
    
    -- Añadir nueva columna con UUID como clave primaria
    ALTER TABLE pml_rel_transaction_user
    ADD COLUMN id_rel_transaction_user UUID DEFAULT gen_random_uuid();
    
    -- Generar UUIDs para registros existentes (si los hay)
    UPDATE pml_rel_transaction_user
    SET id_rel_transaction_user = gen_random_uuid()
    WHERE id_rel_transaction_user IS NULL;
    
    -- Hacer la columna NOT NULL
    ALTER TABLE pml_rel_transaction_user
    ALTER COLUMN id_rel_transaction_user SET NOT NULL;
    
    -- Establecer como clave primaria
    ALTER TABLE pml_rel_transaction_user
    ADD PRIMARY KEY (id_rel_transaction_user);
    
    RAISE NOTICE 'Columna id_rel_transaction_user añadida correctamente';
  ELSE
    RAISE NOTICE 'La columna id_rel_transaction_user ya existe';
  END IF;
END $$;

-- ============================================
-- 2. TABLA: pml_rel_transaction_tag
-- ============================================

-- Verificar si ya existe la columna
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pml_rel_transaction_tag' 
    AND column_name = 'id_rel_transaction_tag'
  ) THEN
    -- Eliminar constraint de clave primaria existente si existe
    ALTER TABLE pml_rel_transaction_tag 
    DROP CONSTRAINT IF EXISTS pml_rel_transaction_tag_pkey;
    
    -- Añadir nueva columna con UUID como clave primaria
    ALTER TABLE pml_rel_transaction_tag
    ADD COLUMN id_rel_transaction_tag UUID DEFAULT gen_random_uuid();
    
    -- Generar UUIDs para registros existentes (si los hay)
    UPDATE pml_rel_transaction_tag
    SET id_rel_transaction_tag = gen_random_uuid()
    WHERE id_rel_transaction_tag IS NULL;
    
    -- Hacer la columna NOT NULL
    ALTER TABLE pml_rel_transaction_tag
    ALTER COLUMN id_rel_transaction_tag SET NOT NULL;
    
    -- Establecer como clave primaria
    ALTER TABLE pml_rel_transaction_tag
    ADD PRIMARY KEY (id_rel_transaction_tag);
    
    RAISE NOTICE 'Columna id_rel_transaction_tag añadida correctamente';
  ELSE
    RAISE NOTICE 'La columna id_rel_transaction_tag ya existe';
  END IF;
END $$;

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar estructura de pml_rel_transaction_user
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'pml_rel_transaction_user'
ORDER BY ordinal_position;

-- Verificar estructura de pml_rel_transaction_tag
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'pml_rel_transaction_tag'
ORDER BY ordinal_position;

-- Verificar claves primarias
SELECT 
  tc.table_name, 
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_name IN ('pml_rel_transaction_user', 'pml_rel_transaction_tag');

