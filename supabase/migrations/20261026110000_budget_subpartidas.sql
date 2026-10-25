-- Subpartidas: desglose opcional de una partida (p. ej. partida "Viaje" -> "Esquí", "Verano", "Boda de Marta").
-- El importe de cada subpartida se define en la calculadora de presupuestos (se guarda en el plan del presupuesto);
-- aquí solo se guardan las propias subpartidas y la relación de cada gasto con una de ellas.

create table if not exists pml_dim_budget_subtype (
  id_budget_subtype uuid primary key default gen_random_uuid(),
  id_family uuid not null references pml_dim_family(id_family),
  id_budget_type uuid not null references pml_dim_budget_type(id_budget_type),
  ds_budget_subtype text not null,
  id_order integer not null default 0,
  is_archived boolean not null default false,
  dt_created timestamptz not null default now(),
  dt_updated timestamptz not null default now()
);

create index if not exists idx_budget_subtype_family on pml_dim_budget_subtype (id_family);
create index if not exists idx_budget_subtype_type on pml_dim_budget_subtype (id_budget_type);

alter table pml_dim_budget_subtype enable row level security;

drop policy if exists "Family members manage budget subtypes" on pml_dim_budget_subtype;
create policy "Family members manage budget subtypes"
  on pml_dim_budget_subtype
  for all
  using (
    exists (
      select 1 from pml_rel_user_family uf
      where uf.id_family = pml_dim_budget_subtype.id_family and uf.id_user = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from pml_rel_user_family uf
      where uf.id_family = pml_dim_budget_subtype.id_family and uf.id_user = auth.uid()
    )
  );

-- Cada gasto puede indicar, además de su partida, una subpartida de esa partida
alter table gnp_fct_transactions
  add column if not exists id_budget_subtype uuid references pml_dim_budget_subtype(id_budget_subtype) on delete set null;

create index if not exists idx_transactions_budget_subtype on gnp_fct_transactions (id_budget_subtype);
