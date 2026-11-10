-- Horas (de Madrid) a las que cada persona quiere recibir sus avisos programados.
-- Idempotente: se puede ejecutar más de una vez.
alter table pml_cfg_notification_pref
  add column if not exists nu_daily_hour smallint not null default 23,
  add column if not exists nu_pending_hour smallint not null default 20,
  add column if not exists nu_close_hour smallint not null default 9,
  add column if not exists nu_recurring_hour smallint not null default 8;

alter table pml_cfg_notification_pref drop constraint if exists notification_pref_hours_check;
alter table pml_cfg_notification_pref
  add constraint notification_pref_hours_check check (
    nu_daily_hour between 0 and 23 and nu_pending_hour between 0 and 23
    and nu_close_hour between 0 and 23 and nu_recurring_hour between 0 and 23
  );
