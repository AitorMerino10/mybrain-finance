-- Reparto de un ingreso entre partidas (y subpartidas) del presupuesto.
--
-- Por defecto un ingreso NO guarda nada aquí: su reparto se calcula al vuelo con el presupuesto vigente
-- (a cada partida, su parte mensual; lo que sobra va a ahorro). Solo se guardan filas cuando la persona
-- cambia ese reparto. Lo que no se reparte (importe del ingreso - suma de filas) es ahorro.
-- Una fila con id_budget_type NULL es un reparto explícito a AHORRO (permite, p. ej., mandar todo un ingreso a ahorro).

create table if not exists gnp_fct_income_allocation (
  id_income_allocation uuid primary key default gen_random_uuid(),
  id_family uuid not null references pml_dim_family(id_family),
  id_transaction uuid not null references gnp_fct_transactions(id_transaction) on delete cascade,
  id_budget_type uuid references pml_dim_budget_type(id_budget_type), -- NULL = ahorro
  id_budget_subtype uuid references pml_dim_budget_subtype(id_budget_subtype) on delete set null,
  ft_amount numeric(12, 2) not null check (ft_amount > 0),
  dt_created timestamptz not null default now()
);

-- Si la tabla ya se había creado con la versión anterior (id_budget_type obligatorio)
alter table gnp_fct_income_allocation alter column id_budget_type drop not null;

create index if not exists idx_income_allocation_transaction on gnp_fct_income_allocation (id_transaction);
create index if not exists idx_income_allocation_family on gnp_fct_income_allocation (id_family);

alter table gnp_fct_income_allocation enable row level security;

drop policy if exists "Family members manage income allocations" on gnp_fct_income_allocation;
create policy "Family members manage income allocations"
  on gnp_fct_income_allocation
  for all
  using (
    exists (
      select 1 from pml_rel_user_family uf
      where uf.id_family = gnp_fct_income_allocation.id_family and uf.id_user = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from pml_rel_user_family uf
      where uf.id_family = gnp_fct_income_allocation.id_family and uf.id_user = auth.uid()
    )
  );
