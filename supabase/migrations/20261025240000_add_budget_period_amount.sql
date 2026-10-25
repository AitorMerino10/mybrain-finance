-- Presupuestos de partidas "anuales" (Viaje, Excepcional) con fecha de fin:
-- el importe es para TODO el periodo (inicio → fin), no por año.
-- true  = el importe cubre el periodo completo de la versión
-- false = el importe es por año (comportamiento habitual, sin fecha de fin)
alter table public.pml_cfg_user_budget
  add column if not exists is_period_amount boolean not null default false;
