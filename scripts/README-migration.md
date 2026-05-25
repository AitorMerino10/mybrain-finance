# Scripts de Migración de Base de Datos

## ⚠️ IMPORTANTE: Orden de Ejecución

Ejecuta estos scripts en el **SQL Editor de Supabase** en el siguiente orden:

### Paso 1: Añadir IDs Únicos
```sql
-- Ejecutar: scripts/add-unique-ids-to-relations.sql
```
Este script:
- Añade la columna `id_rel_transaction_user` a `pml_rel_transaction_user`
- Añade la columna `id_rel_transaction_tag` a `pml_rel_transaction_tag`
- Establece estas columnas como claves primarias (UUID)
- Genera UUIDs para registros existentes

### Paso 2: Borrar Datos
```sql
-- Ejecutar: scripts/delete-all-transactions.sql
```
Este script:
- Borra todos los registros de `pml_rel_transaction_user`
- Borra todos los registros de `pml_rel_transaction_tag`
- Borra todos los registros de `gnp_fct_transactions`

## 📋 Notas

- **NO ejecutes el script de borrado antes del de añadir IDs**, ya que necesitas las columnas primero
- Los scripts son idempotentes: puedes ejecutarlos múltiples veces sin problemas
- Para activar la nueva capa de `MyBrain`, ejecuta también:
  ```sql
  -- Ejecutar: scripts/create-mybrain-foundation.sql
  ```
- Después de ejecutar, necesitarás regenerar los tipos TypeScript con:
  ```bash
  npx supabase gen types typescript --project-id tu-project-id > types/supabase.ts
  ```

## 🔍 Verificación

Después de ejecutar ambos scripts, verifica que:
1. Las columnas `id_rel_transaction_user` y `id_rel_transaction_tag` existen
2. Todas las tablas están vacías (conteo = 0)
3. Las claves primarias están correctamente establecidas

