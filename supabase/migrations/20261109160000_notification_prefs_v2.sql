-- Nuevas preferencias de notificaciones: recordatorio diario y controles de gasto.
-- (is_budget_alerts = presupuesto mensual, is_close_alerts = cierre de mes el día 1)

alter table pml_cfg_notification_pref
  add column if not exists is_daily_reminder boolean not null default true,
  add column if not exists is_goal_alerts boolean not null default true;
