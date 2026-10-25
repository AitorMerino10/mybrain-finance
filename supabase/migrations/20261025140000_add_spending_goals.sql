-- Controles de gasto "blandos" por categoría o subcategoría.
-- Son independientes de las partidas de presupuesto: sirven para seguir si te pasas
-- en algo concreto (ocio, ropa, comida fuera...) durante un periodo que defines a medida.

create table if not exists pml_cfg_spending_goal (
  id_spending_goal uuid primary key default gen_random_uuid(),
  id_family uuid not null references pml_dim_family(id_family),
  id_user uuid not null references pml_dim_user(id_user),
  -- Exactamente uno de los dos: categoría completa o subcategoría concreta
  id_category uuid references pml_dim_category(id_category),
  id_subcategory uuid references pml_dim_subcategory(id_subcategory),
  -- monthly: ft_goal_amount es el importe por mes dentro del periodo
  -- annual: ft_goal_amount es el importe total para todo el periodo (normalmente 12 meses)
  ds_periodicity text not null check (ds_periodicity in ('monthly', 'annual')),
  ft_goal_amount numeric(12, 2) not null check (ft_goal_amount >= 0),
  -- Periodo de seguimiento (primer día de cada mes, ambos incluidos)
  dt_start_month date not null,
  dt_end_month date not null,
  ds_comments text,
  is_active boolean not null default true,
  dt_created timestamptz not null default now(),
  dt_updated timestamptz not null default now(),
  constraint ck_spending_goal_single_target
    check (((id_category is not null)::int + (id_subcategory is not null)::int) = 1),
  constraint ck_spending_goal_period
    check (dt_end_month >= dt_start_month)
);

create index if not exists idx_spending_goal_family_user
  on pml_cfg_spending_goal (id_family, id_user)
  where is_active;

alter table pml_cfg_spending_goal enable row level security;

-- Sin permisos finos (igual que presupuestos y fondos): cualquier miembro de la familia puede gestionarlos
drop policy if exists "Family members manage spending goals" on pml_cfg_spending_goal;
create policy "Family members manage spending goals"
  on pml_cfg_spending_goal
  for all
  using (
    exists (
      select 1
      from pml_rel_user_family uf
      where uf.id_family = pml_cfg_spending_goal.id_family
        and uf.id_user = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from pml_rel_user_family uf
      where uf.id_family = pml_cfg_spending_goal.id_family
        and uf.id_user = auth.uid()
    )
  );
