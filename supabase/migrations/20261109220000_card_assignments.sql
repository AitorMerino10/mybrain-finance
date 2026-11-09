-- Tarjetas de los pagos con el móvil y a quién se asignan por defecto
-- Ejemplo: "Tarjeta conjunta" -> los gastos son de las dos personas (luego se pueden editar al completar el pendiente).
-- Idempotente: se puede ejecutar más de una vez.

create table if not exists pml_cfg_card_assignment (
  id_card_assignment uuid primary key default gen_random_uuid(),
  id_family uuid not null references pml_dim_family(id_family) on delete cascade,
  -- Nombre de la tarjeta tal como llega del atajo (o escrito a mano)
  ds_card text not null,
  -- Nombre normalizado (minúsculas, sin tildes ni símbolos) para reconocerla aunque cambie un poco
  ds_card_key text not null,
  -- Personas a las que se asigna por defecto; vacío = solo quien paga
  ds_user_ids uuid[] not null default '{}',
  dt_created timestamptz not null default now(),
  unique (id_family, ds_card_key)
);

create index if not exists idx_card_assignment_family on pml_cfg_card_assignment (id_family);

alter table pml_cfg_card_assignment enable row level security;

drop policy if exists "Family members manage card assignments" on pml_cfg_card_assignment;
create policy "Family members manage card assignments"
  on pml_cfg_card_assignment
  for all
  using (
    exists (
      select 1 from pml_rel_user_family f
      where f.id_family = pml_cfg_card_assignment.id_family and f.id_user = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from pml_rel_user_family f
      where f.id_family = pml_cfg_card_assignment.id_family and f.id_user = auth.uid()
    )
  );
