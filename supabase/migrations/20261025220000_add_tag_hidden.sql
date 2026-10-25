-- Tags ocultas: no aparecen en el buscador al crear/editar una transacción
alter table public.pml_dim_tag
  add column if not exists is_hidden boolean not null default false;
