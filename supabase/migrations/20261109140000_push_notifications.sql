-- Notificaciones push (PWA).
--
-- pml_cfg_push_subscription: un dispositivo suscrito por fila (endpoint único del navegador/iPhone).
-- pml_cfg_notification_pref: qué avisos quiere cada persona.
-- pml_log_push_sent: avisos ya enviados (evita repetirlos). Solo la lee/escribe el servidor.

create table if not exists pml_cfg_push_subscription (
  id_push_subscription uuid primary key default gen_random_uuid(),
  id_user uuid not null references pml_dim_user(id_user) on delete cascade,
  ds_endpoint text not null unique,
  ds_p256dh text not null,
  ds_auth text not null,
  ds_user_agent text,
  dt_created timestamptz not null default now(),
  dt_last_used timestamptz
);

create index if not exists idx_push_subscription_user on pml_cfg_push_subscription (id_user);

alter table pml_cfg_push_subscription enable row level security;

drop policy if exists "Users manage own push subscriptions" on pml_cfg_push_subscription;
create policy "Users manage own push subscriptions"
  on pml_cfg_push_subscription
  for all
  using (id_user = auth.uid())
  with check (id_user = auth.uid());

create table if not exists pml_cfg_notification_pref (
  id_user uuid primary key references pml_dim_user(id_user) on delete cascade,
  is_budget_alerts boolean not null default true,
  -- % de la partida a partir del cual se avisa (además de avisar al pasarse del 100 %)
  nu_warn_percent integer not null default 80 check (nu_warn_percent between 10 and 99),
  is_close_alerts boolean not null default true,
  is_unassigned_alerts boolean not null default true,
  dt_updated timestamptz not null default now()
);

alter table pml_cfg_notification_pref enable row level security;

drop policy if exists "Users manage own notification prefs" on pml_cfg_notification_pref;
create policy "Users manage own notification prefs"
  on pml_cfg_notification_pref
  for all
  using (id_user = auth.uid())
  with check (id_user = auth.uid());

create table if not exists pml_log_push_sent (
  id_user uuid not null references pml_dim_user(id_user) on delete cascade,
  ds_key text not null,
  dt_sent timestamptz not null default now(),
  primary key (id_user, ds_key)
);

-- Sin políticas: solo accede el servidor con la service role
alter table pml_log_push_sent enable row level security;
