-- Foto completa de lo que se configuró en la calculadora de presupuestos al guardar
-- (periodo de histórico, método, importes por subcategoría, ingresos, objetivo de ahorro...).
-- Sirve para poder reabrir y editar un presupuesto guardado tal y como se dejó.
-- Una fila por persona y mes de inicio (igual que las versiones de pml_cfg_user_budget).

create table if not exists pml_cfg_budget_plan (
  id_budget_plan uuid primary key default gen_random_uuid(),
  id_family uuid not null references pml_dim_family(id_family),
  id_user uuid not null references pml_dim_user(id_user),
  dt_start_month date not null,
  js_plan jsonb not null,
  dt_created timestamptz not null default now(),
  dt_updated timestamptz not null default now(),
  constraint uq_budget_plan unique (id_family, id_user, dt_start_month)
);

alter table pml_cfg_budget_plan enable row level security;

drop policy if exists "Family members manage budget plans" on pml_cfg_budget_plan;
create policy "Family members manage budget plans"
  on pml_cfg_budget_plan
  for all
  using (
    exists (
      select 1
      from pml_rel_user_family uf
      where uf.id_family = pml_cfg_budget_plan.id_family
        and uf.id_user = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from pml_rel_user_family uf
      where uf.id_family = pml_cfg_budget_plan.id_family
        and uf.id_user = auth.uid()
    )
  );
