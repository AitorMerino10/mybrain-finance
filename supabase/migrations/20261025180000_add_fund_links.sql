-- Relación de fondos con presupuestos (partidas), verticales (categorías) o subverticales (subcategorías).
-- Un fondo puede relacionarse con varios destinos y un destino con varios fondos.
-- Ej.: fondo "Viaje" ↔ partidas Viaje y Excepcional; fondo "Relojes" ↔ subvertical Relojes.
create table if not exists pml_rel_fund_link (
  id_fund_link uuid primary key default gen_random_uuid(),
  id_family uuid not null references pml_dim_family(id_family),
  id_fund uuid not null references pml_dim_fund(id_fund) on delete cascade,
  -- Exactamente uno de los tres destinos
  id_budget_type uuid references pml_dim_budget_type(id_budget_type),
  id_category uuid references pml_dim_category(id_category),
  id_subcategory uuid references pml_dim_subcategory(id_subcategory),
  dt_created timestamptz not null default now(),
  constraint ck_fund_link_single_target
    check (
      ((id_budget_type is not null)::int
        + (id_category is not null)::int
        + (id_subcategory is not null)::int) = 1
    )
);

create unique index if not exists uq_fund_link_budget_type
  on pml_rel_fund_link (id_fund, id_budget_type) where id_budget_type is not null;
create unique index if not exists uq_fund_link_category
  on pml_rel_fund_link (id_fund, id_category) where id_category is not null;
create unique index if not exists uq_fund_link_subcategory
  on pml_rel_fund_link (id_fund, id_subcategory) where id_subcategory is not null;
create index if not exists idx_fund_link_family on pml_rel_fund_link (id_family);

alter table pml_rel_fund_link enable row level security;

drop policy if exists "Family members manage fund links" on pml_rel_fund_link;
create policy "Family members manage fund links"
  on pml_rel_fund_link
  for all
  using (
    exists (
      select 1
      from pml_rel_user_family uf
      where uf.id_family = pml_rel_fund_link.id_family
        and uf.id_user = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from pml_rel_user_family uf
      where uf.id_family = pml_rel_fund_link.id_family
        and uf.id_user = auth.uid()
    )
  );
