-- Cierre de presupuesto.
--
-- Al cerrar el presupuesto de una persona hasta un mes, para cada partida se decide qué hace el saldo
-- (aportado por ingresos - gastado + lo arrastrado de antes):
--   - ft_carried:    lo que se queda en la partida y sigue moviéndose en el periodo siguiente
--   - ft_to_savings: lo que pasa a ahorro (pasa a ser "ahorro anterior")
-- Una fila con id_budget_type NULL guarda el ahorro generado en el periodo cerrado (ft_balance = ft_to_savings).
-- El saldo de arranque de cada partida es lo arrastrado en el último cierre; el ciclo siguiente empieza el mes posterior.

create table if not exists pml_cfg_budget_close (
  id_budget_close uuid primary key default gen_random_uuid(),
  id_family uuid not null references pml_dim_family(id_family) on delete cascade,
  id_user uuid not null references pml_dim_user(id_user) on delete cascade,
  -- Último mes incluido en el cierre (siempre día 1)
  dt_close_month date not null,
  id_budget_type uuid references pml_dim_budget_type(id_budget_type) on delete cascade,
  ft_balance numeric(12, 2) not null default 0,
  ft_carried numeric(12, 2) not null default 0,
  ft_to_savings numeric(12, 2) not null default 0,
  dt_created timestamptz not null default now()
);

create unique index if not exists uq_budget_close_row
  on pml_cfg_budget_close (id_user, dt_close_month, coalesce(id_budget_type, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists idx_budget_close_family on pml_cfg_budget_close (id_family, id_user, dt_close_month);

alter table pml_cfg_budget_close enable row level security;

drop policy if exists "Family members manage budget closes" on pml_cfg_budget_close;
create policy "Family members manage budget closes"
  on pml_cfg_budget_close
  for all
  using (
    exists (
      select 1 from pml_rel_user_family uf
      where uf.id_family = pml_cfg_budget_close.id_family and uf.id_user = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from pml_rel_user_family uf
      where uf.id_family = pml_cfg_budget_close.id_family and uf.id_user = auth.uid()
    )
  );
