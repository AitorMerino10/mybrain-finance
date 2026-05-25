-- Crear la base de MyBrain usando la misma nomenclatura que Finance
-- Ejecutar este archivo en el SQL Editor de Supabase

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS pml_dim_section (
  id_section UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_user UUID NOT NULL REFERENCES pml_dim_user(id_user) ON DELETE CASCADE,
  ds_section TEXT NOT NULL,
  ds_logo TEXT,
  ds_color TEXT,
  ds_brain_region TEXT NOT NULL DEFAULT 'frontal_left' CHECK (
    ds_brain_region IN (
      'frontal_left',
      'frontal_right',
      'parietal_left',
      'parietal_right',
      'temporal_left',
      'temporal_right',
      'occipital_left',
      'occipital_right',
      'cerebellum'
    )
  ),
  ft_brain_position_x NUMERIC(6, 3),
  ft_brain_position_y NUMERIC(6, 3),
  is_system_section BOOLEAN NOT NULL DEFAULT FALSE,
  ds_system_key TEXT,
  dt_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dt_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pml_dim_section ADD COLUMN IF NOT EXISTS ds_logo TEXT;
ALTER TABLE pml_dim_section ADD COLUMN IF NOT EXISTS ds_color TEXT;
ALTER TABLE pml_dim_section ADD COLUMN IF NOT EXISTS ds_brain_region TEXT;
ALTER TABLE pml_dim_section ADD COLUMN IF NOT EXISTS ft_brain_position_x NUMERIC(6, 3);
ALTER TABLE pml_dim_section ADD COLUMN IF NOT EXISTS ft_brain_position_y NUMERIC(6, 3);
ALTER TABLE pml_dim_section ALTER COLUMN ds_brain_region SET DEFAULT 'frontal_left';
UPDATE pml_dim_section
SET ds_brain_region = 'frontal_left'
WHERE ds_brain_region IS NULL;

CREATE TABLE IF NOT EXISTS pml_dim_section_field (
  id_field UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_section UUID NOT NULL REFERENCES pml_dim_section(id_section) ON DELETE CASCADE,
  ds_section_field TEXT NOT NULL,
  ds_field_type TEXT NOT NULL CHECK (ds_field_type IN ('text', 'number', 'date', 'photo', 'location', 'url', 'picklist')),
  ds_field_options TEXT,
  ds_field_description TEXT,
  id_order INTEGER NOT NULL DEFAULT 0,
  dt_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dt_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pml_dim_section_field ADD COLUMN IF NOT EXISTS ds_field_options TEXT;
ALTER TABLE pml_dim_section_field ADD COLUMN IF NOT EXISTS ds_field_description TEXT;
ALTER TABLE pml_dim_section_field DROP CONSTRAINT IF EXISTS pml_dim_section_field_ds_field_type_check;
ALTER TABLE pml_dim_section_field
ADD CONSTRAINT pml_dim_section_field_ds_field_type_check
CHECK (ds_field_type IN ('text', 'number', 'date', 'photo', 'location', 'url', 'picklist'));

CREATE TABLE IF NOT EXISTS gnp_fct_entries (
  id_entry UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_section UUID NOT NULL REFERENCES pml_dim_section(id_section) ON DELETE CASCADE,
  id_user UUID NOT NULL REFERENCES pml_dim_user(id_user) ON DELETE CASCADE,
  ds_title TEXT NOT NULL,
  dt_event DATE NOT NULL,
  dt_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dt_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gnp_fct_entry_values (
  id_entry_value UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_entry UUID NOT NULL REFERENCES gnp_fct_entries(id_entry) ON DELETE CASCADE,
  id_field UUID NOT NULL REFERENCES pml_dim_section_field(id_field) ON DELETE CASCADE,
  ds_value TEXT,
  dt_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dt_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_section_system_key_per_user
ON pml_dim_section(id_user, ds_system_key)
WHERE is_system_section = TRUE AND ds_system_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_section_user ON pml_dim_section(id_user);
CREATE INDEX IF NOT EXISTS idx_section_field_section ON pml_dim_section_field(id_section);
CREATE INDEX IF NOT EXISTS idx_entry_section ON gnp_fct_entries(id_section);
CREATE INDEX IF NOT EXISTS idx_entry_user_event ON gnp_fct_entries(id_user, dt_event);
CREATE INDEX IF NOT EXISTS idx_entry_value_entry ON gnp_fct_entry_values(id_entry);
CREATE INDEX IF NOT EXISTS idx_entry_value_field ON gnp_fct_entry_values(id_field);

CREATE OR REPLACE FUNCTION update_mybrain_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.dt_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_section_updated ON pml_dim_section;
CREATE TRIGGER trigger_update_section_updated
BEFORE UPDATE ON pml_dim_section
FOR EACH ROW
EXECUTE FUNCTION update_mybrain_updated_at();

DROP TRIGGER IF EXISTS trigger_update_section_field_updated ON pml_dim_section_field;
CREATE TRIGGER trigger_update_section_field_updated
BEFORE UPDATE ON pml_dim_section_field
FOR EACH ROW
EXECUTE FUNCTION update_mybrain_updated_at();

DROP TRIGGER IF EXISTS trigger_update_entry_updated ON gnp_fct_entries;
CREATE TRIGGER trigger_update_entry_updated
BEFORE UPDATE ON gnp_fct_entries
FOR EACH ROW
EXECUTE FUNCTION update_mybrain_updated_at();

DROP TRIGGER IF EXISTS trigger_update_entry_value_updated ON gnp_fct_entry_values;
CREATE TRIGGER trigger_update_entry_value_updated
BEFORE UPDATE ON gnp_fct_entry_values
FOR EACH ROW
EXECUTE FUNCTION update_mybrain_updated_at();

ALTER TABLE pml_dim_section ENABLE ROW LEVEL SECURITY;
ALTER TABLE pml_dim_section_field ENABLE ROW LEVEL SECURITY;
ALTER TABLE gnp_fct_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gnp_fct_entry_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own sections" ON pml_dim_section;
CREATE POLICY "Users manage own sections"
ON pml_dim_section
FOR ALL
USING (auth.uid() = id_user)
WITH CHECK (auth.uid() = id_user);

DROP POLICY IF EXISTS "Users manage own section fields" ON pml_dim_section_field;
CREATE POLICY "Users manage own section fields"
ON pml_dim_section_field
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM pml_dim_section section
    WHERE section.id_section = pml_dim_section_field.id_section
      AND section.id_user = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM pml_dim_section section
    WHERE section.id_section = pml_dim_section_field.id_section
      AND section.id_user = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users manage own entries" ON gnp_fct_entries;
CREATE POLICY "Users manage own entries"
ON gnp_fct_entries
FOR ALL
USING (auth.uid() = id_user)
WITH CHECK (
  auth.uid() = id_user
  AND EXISTS (
    SELECT 1
    FROM pml_dim_section section
    WHERE section.id_section = gnp_fct_entries.id_section
      AND section.id_user = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users manage own entry values" ON gnp_fct_entry_values;
CREATE POLICY "Users manage own entry values"
ON gnp_fct_entry_values
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM gnp_fct_entries entry
    JOIN pml_dim_section section ON section.id_section = entry.id_section
    WHERE entry.id_entry = gnp_fct_entry_values.id_entry
      AND section.id_user = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM gnp_fct_entries entry
    JOIN pml_dim_section section ON section.id_section = entry.id_section
    WHERE entry.id_entry = gnp_fct_entry_values.id_entry
      AND section.id_user = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM pml_dim_section_field field
    JOIN pml_dim_section section ON section.id_section = field.id_section
    WHERE field.id_field = gnp_fct_entry_values.id_field
      AND section.id_user = auth.uid()
  )
);

COMMENT ON TABLE pml_dim_section IS 'Secciones personalizadas o del sistema dentro de MyBrain';
COMMENT ON COLUMN pml_dim_section.ds_system_key IS 'Clave técnica para secciones del sistema como finance';
COMMENT ON COLUMN pml_dim_section.ds_logo IS 'Logo o icono simple que representa visualmente la sección';
COMMENT ON COLUMN pml_dim_section.ds_color IS 'Color principal asociado a la sección';
COMMENT ON COLUMN pml_dim_section.ds_brain_region IS 'Zona del cerebro donde se representa visualmente la sección';
COMMENT ON COLUMN pml_dim_section.ft_brain_position_x IS 'Posición horizontal del nodo en el mapa visual de MyBrain, normalizada de 0 a 100';
COMMENT ON COLUMN pml_dim_section.ft_brain_position_y IS 'Posición vertical del nodo en el mapa visual de MyBrain, normalizada de 0 a 100';

COMMENT ON TABLE pml_dim_section_field IS 'Campos configurables que definen la estructura de cada sección';
COMMENT ON COLUMN pml_dim_section_field.ds_field_type IS 'Tipo del campo: text, number, date, photo, location, url o picklist';
COMMENT ON COLUMN pml_dim_section_field.ds_field_options IS 'Opciones serializadas en JSON para campos tipo picklist';
COMMENT ON COLUMN pml_dim_section_field.ds_field_description IS 'Descripción opcional para ayudar al usuario y a la IA a entender qué guardar en este campo';

COMMENT ON TABLE gnp_fct_entries IS 'Entradas guardadas por el usuario dentro de una sección de MyBrain';
COMMENT ON COLUMN gnp_fct_entries.dt_event IS 'Fecha en la que ocurrió el recuerdo o evento';

COMMENT ON TABLE gnp_fct_entry_values IS 'Valores concretos de cada campo para una entrada de MyBrain';
