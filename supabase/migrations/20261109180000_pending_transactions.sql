-- Gastos pendientes de completar (llegan desde el móvil, p. ej. un atajo de Apple Pay).
-- Viven en su propia tabla: NO cuentan en presupuestos, analítica ni saldos hasta que
-- la persona los completa (se crea la transacción real) o los borra.
--
-- pml_cfg_api_token: clave personal (guardada con hash) para que el atajo del móvil identifique a la persona.

create table if not exists pml_pending_transaction (
  id_pending_transaction uuid primary key default gen_random_uuid(),
  id_user uuid not null references pml_dim_user(id_user) on delete cascade,
  id_family uuid not null references pml_dim_family(id_family) on delete cascade,
  ft_amount numeric(12, 2) not null check (ft_amount > 0),
  ds_merchant text,
  ds_card text,
  dt_date date not null default current_date,
  ds_source text not null default 'shortcut',
  dt_created timestamptz not null default now()
);

create index if not exists idx_pending_transaction_user_family
  on pml_pending_transaction (id_user, id_family, dt_created desc);

alter table pml_pending_transaction enable row level security;

drop policy if exists "Users manage own pending transactions" on pml_pending_transaction;
create policy "Users manage own pending transactions"
  on pml_pending_transaction
  for all
  using (id_user = auth.uid())
  with check (id_user = auth.uid());

create table if not exists pml_cfg_api_token (
  id_user uuid primary key references pml_dim_user(id_user) on delete cascade,
  id_family uuid not null references pml_dim_family(id_family) on delete cascade,
  ds_token_hash text not null unique,
  dt_created timestamptz not null default now(),
  dt_last_used timestamptz
);

alter table pml_cfg_api_token enable row level security;

drop policy if exists "Users manage own api token" on pml_cfg_api_token;
create policy "Users manage own api token"
  on pml_cfg_api_token
  for all
  using (id_user = auth.uid())
  with check (id_user = auth.uid());
