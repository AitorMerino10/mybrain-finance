-- Gastos recurrentes (suscripciones, recibos...) + avisos nuevos (pendientes olvidados, previsión de fin de mes).
--
-- Un gasto recurrente NO crea la transacción solo: el día que toca crea un gasto PENDIENTE (igual que los pagos del móvil)
-- y avisa con una notificación, para que la persona lo complete y lo acepte cuando de verdad se cobra.
-- Se puede ejecutar aunque ya se hubiera ejecutado una versión anterior de este fichero.

-- 1) Preferencias de avisos nuevas
alter table pml_cfg_notification_pref
  add column if not exists is_pending_alerts boolean not null default true,
  add column if not exists is_forecast_alerts boolean not null default true,
  add column if not exists is_recurring_alerts boolean not null default true;

-- 2) Reglas de gasto recurrente
create table if not exists pml_cfg_recurring_expense (
  id_recurring_expense uuid primary key default gen_random_uuid(),
  id_family uuid not null references pml_dim_family(id_family) on delete cascade,
  -- Persona a la que le llega el pendiente
  id_user_creator uuid references pml_dim_user(id_user) on delete set null,
  ds_name text not null,
  ft_amount numeric(12, 2) not null check (ft_amount > 0),
  -- Día del mes en que se cobra (si el mes no tiene ese día, se usa el último) y cada cuántos meses
  nu_day_of_month smallint not null default 1 check (nu_day_of_month between 1 and 31),
  nu_every_months smallint not null default 1 check (nu_every_months between 1 and 24),
  -- Primer cobro (fija el mes de partida del ritmo)
  dt_start date not null,
  dt_end date,
  -- Próximo cobro cuyo pendiente aún no se ha creado
  dt_next date not null,
  -- Datos con los que se rellena el formulario al completar el pendiente (opcionales)
  id_category uuid,
  id_subcategory uuid,
  id_budget_type uuid,
  id_budget_subtype uuid,
  ds_comments text,
  ds_user_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  dt_last_generated date,
  dt_created timestamptz not null default now()
);

-- Si existía la versión anterior (frecuencia en texto), se adapta
alter table pml_cfg_recurring_expense
  add column if not exists nu_day_of_month smallint not null default 1,
  add column if not exists nu_every_months smallint not null default 1;
alter table pml_cfg_recurring_expense drop column if exists ds_frequency;

create index if not exists idx_recurring_expense_family on pml_cfg_recurring_expense (id_family, is_active, dt_next);

alter table pml_cfg_recurring_expense enable row level security;

drop policy if exists "Family members manage recurring expenses" on pml_cfg_recurring_expense;
create policy "Family members manage recurring expenses"
  on pml_cfg_recurring_expense
  for all
  using (
    exists (
      select 1 from pml_rel_user_family f
      where f.id_family = pml_cfg_recurring_expense.id_family and f.id_user = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from pml_rel_user_family f
      where f.id_family = pml_cfg_recurring_expense.id_family and f.id_user = auth.uid()
    )
  );

-- 3) El pendiente y la transacción recuerdan de qué regla vienen
alter table pml_pending_transaction
  add column if not exists id_recurring_expense uuid;

create index if not exists idx_pending_recurring on pml_pending_transaction (id_recurring_expense, dt_date)
  where id_recurring_expense is not null;

alter table gnp_fct_transactions
  add column if not exists id_recurring_expense uuid;

create index if not exists idx_transactions_recurring on gnp_fct_transactions (id_recurring_expense)
  where id_recurring_expense is not null;
