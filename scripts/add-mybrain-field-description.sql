ALTER TABLE public.pml_dim_section_field
ADD COLUMN IF NOT EXISTS ds_field_description TEXT;

COMMENT ON COLUMN public.pml_dim_section_field.ds_field_description IS
'Descripción opcional para ayudar al usuario y a la IA a entender qué guardar en este campo';
