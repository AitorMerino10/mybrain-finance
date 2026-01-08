-- Crear tabla de peticiones de familias
-- Esta tabla almacena las peticiones de usuarios para crear nuevas familias o unirse a familias existentes

CREATE TABLE IF NOT EXISTS pml_dim_family_request (
  id_request UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ds_request_type TEXT NOT NULL CHECK (ds_request_type IN ('create_family', 'join_family')),
  ds_family_name TEXT, -- Nombre de la familia si es create_family
  id_family UUID REFERENCES pml_dim_family(id_family) ON DELETE CASCADE, -- ID de familia si es join_family
  js_requested_users JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de objetos con email, name de usuarios a invitar
  ds_comment TEXT, -- Comentario opcional del solicitante
  ds_status TEXT NOT NULL DEFAULT 'pending' CHECK (ds_status IN ('pending', 'approved', 'rejected')),
  id_approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Quien aprobó/rechazó
  dt_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dt_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_family_request_user ON pml_dim_family_request(id_user);
CREATE INDEX IF NOT EXISTS idx_family_request_family ON pml_dim_family_request(id_family);
CREATE INDEX IF NOT EXISTS idx_family_request_status ON pml_dim_family_request(ds_status);
CREATE INDEX IF NOT EXISTS idx_family_request_type ON pml_dim_family_request(ds_request_type);

-- Trigger para actualizar dt_updated automáticamente
CREATE OR REPLACE FUNCTION update_family_request_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.dt_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_family_request_updated
BEFORE UPDATE ON pml_dim_family_request
FOR EACH ROW
EXECUTE FUNCTION update_family_request_updated();

-- Comentarios en la tabla
COMMENT ON TABLE pml_dim_family_request IS 'Almacena peticiones de usuarios para crear familias o unirse a familias existentes';
COMMENT ON COLUMN pml_dim_family_request.ds_request_type IS 'Tipo de petición: create_family o join_family';
COMMENT ON COLUMN pml_dim_family_request.js_requested_users IS 'Array JSON con usuarios a invitar: [{"email": "...", "name": "..."}]';
COMMENT ON COLUMN pml_dim_family_request.ds_status IS 'Estado de la petición: pending, approved, rejected';

