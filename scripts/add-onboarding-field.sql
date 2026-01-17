-- Añadir campo is_onboarding_completed a pml_dim_user
-- Este campo indica si el usuario ha completado el onboarding

ALTER TABLE pml_dim_user 
ADD COLUMN IF NOT EXISTS is_onboarding_completed BOOLEAN DEFAULT FALSE;

-- Comentario para documentar el campo
COMMENT ON COLUMN pml_dim_user.is_onboarding_completed IS 'Indica si el usuario ha completado el tutorial de onboarding';
